/* Fogo que se espalha: madeira, carpete, móveis e mato pegam fogo; o vento empurra, a chuva e a neve apagam.
 * O que queima vira chão carbonizado e entulho; paredes ficam pretas, portas e janelas quebram, telhado pode cair.
 * Fumaça subindo, estalos que atraem zumbis, apagar com água ou extintor. Também: queimar e enterrar corpos,
 * e o cheiro de corpos apodrecendo por perto deixa o personagem doente. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W;
  var F = C.FLOOR, O = C.OBJ, E = C.EDGE, FC = C.FIRE;
  var HW = C.TILE_W / 2, HH = C.TILE_H / 2, WH = C.WALL_H;

  var Fi = { noiseT: 0, crackleT: 0, sickT: 0 };

  function G() { return CP.Game; }
  function ws() { return G().state.world; }
  function list() { var w = ws(); return w.fires || (w.fires = []); }

  /* quão fácil pega fogo (0 = não queima) */
  var FLOOR_FLAM = [];
  FLOOR_FLAM[F.WOOD] = 0.9; FLOOR_FLAM[F.CARPET] = 1; FLOOR_FLAM[F.LINOLEUM] = 0.55; FLOOR_FLAM[F.TILE] = 0.35; FLOOR_FLAM[F.DECK] = 0.9;
  // grama verde quase não alastra (só com vento forte e mato seco); plantação seca e mato alto queimam bem
  FLOOR_FLAM[F.GRASS] = 0.1; FLOOR_FLAM[F.DARKGRASS] = 0.07; FLOOR_FLAM[F.FIELD] = 0.35; FLOOR_FLAM[F.FARM] = 0.05; FLOOR_FLAM[F.FURROW] = 0.05; FLOOR_FLAM[F.CONCRETE] = 0.12;
  function plantObj(o) { return o === O.TREE || o === O.TREE_PINE || o === O.BUSH || o === O.TALL_GRASS || o === O.CROP || o === O.FLOWERBED; }
  function woodObj(o) { var info = C.OBJ_INFO[o]; return !!(info && (info.dismantle && info.dismantle[0] === 'plank' || info.bed || info.seat) && o !== O.TENT) || o === O.CRATE || o === O.SHELF || o === O.TENT || o === O.CLOTHESLINE || o === O.DOGHOUSE || o === O.PATIO_SET; }
  Fi.flammability = function (x, y, z) {
    var f = W.floor(x, y, z);
    if (!f || f === F.WATER || f === F.BURNT) { return 0; }
    var k = FLOOR_FLAM[f] || 0;
    var o = W.obj(x, y, z);
    if (o) { if (plantObj(o)) { k += 0.35; } else if (woodObj(o)) { k += 0.5; } }
    var indoor = W.isIndoor(x, y, z);
    if (!indoor) {
      var amb = CP.Amb;
      if (amb && amb.snow() > 0.3) { return 0; }
      if (CP.Time && CP.Time.raining()) { k *= 0.2; }
    }
    var wet = ws().wet;
    if (wet && wet[x + ',' + y + ',' + z] > G().state.time) { return 0; }
    return Math.min(1.2, k);
  };

  function burningAt(x, y, z) { var ch = W.chunkAt(x, y); return !!(ch && ch.fires[W.key(x, y, z)]); }
  Fi.burningAt = burningAt;

  /* acende um tile (se puder queimar); force = acende até no concreto (molotov, gasolina) */
  Fi.ignite = function (x, y, z, force, life) {
    var fl = list();
    if (fl.length >= FC.MAX_TILES || burningAt(x, y, z)) { return false; }
    var k = Fi.flammability(x, y, z);
    if (!force && k <= 0) { return false; }
    var ch = W.chunkAt(x, y);
    if (!ch) { return false; }
    fl.push({ x: x, y: y, z: z, t: life || (FC.BURN_MIN + Math.max(0.3, k) * FC.BURN_PER_FLAM) * U.randRange(0.8, 1.2), sp: U.randRange(0, 1), k: Math.max(k, force ? 0.4 : 0) });
    ch.fires[W.key(x, y, z)] = 1;
    return true;
  };
  /* molotov: área 3x3 (espalha a partir dela) */
  Fi.burst = function (x, y, z) {
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && Math.random() < 0.25) { continue; }
        Fi.ignite(x + dx, y + dy, z, true, U.randRange(14, 26));
      }
    }
    CP.Zombies.noise(x, y, z, 25, 'fire');
  };

  /* ---------- o que sobra depois de queimar ---------- */
  function charEdge(x, y, z, side) {
    var t = W.edgeType(x, y, z, side);
    if (!t) { return; }
    var l = W.lvl(x, y, z), i = W.idx(x, y);
    if (t === E.WALL || t === E.WINDOW || t === E.DOOR) { if (side === 0) { l.wns[i] = FC.BURNT_STYLE; } else { l.wws[i] = FC.BURNT_STYLE; } }
    var st = W.edgeState(x, y, z, side);
    if (t === E.DOOR) { st = st || {}; st.broken = true; st.open = true; st.bar = 0; W.setEdgeState(x, y, z, side, st); }
    if (t === E.WINDOW) { st = st || {}; st.broken = true; st.glass = false; st.bar = 0; st.curtain = false; W.setEdgeState(x, y, z, side, st); }
    if (t === E.FENCE || t === E.FENCE_TALL) { W.setEdge(x, y, z, side, E.NONE, 0); }
  }
  Fi.burnTile = function (x, y, z) {
    var ch = W.chunkAt(x, y);
    if (!ch) { return; }
    var l = ch.levels[z], i = W.idx(x, y), key = W.key(x, y, z);
    var f = l.floor[i];
    if (FLOOR_FLAM[f] && f !== F.CONCRETE) { l.floor[i] = F.BURNT; l.fvar[i] = (x * 7 + y * 3) & 3; }
    var o = l.obj[i];
    if (o && (plantObj(o) || woodObj(o))) {
      l.obj[i] = (o === O.TREE || o === O.TREE_PINE || C.OBJ_INFO[o].solid) ? O.RUBBLE : 0; l.odir[i] = 0;
      if (ch.containers[key]) { ch.containers[key] = { items: [], gen: true }; }
    }
    if (ch.items[key]) { delete ch.items[key]; }
    ch.corpses.forEach(function (c) { if (Math.floor(c.x) === x && Math.floor(c.y) === y && W.levelOf(c.z) === z) { c.burnt = true; } });
    // paredes e aberturas em volta ficam pretas/quebradas
    charEdge(x, y, z, 0); charEdge(x, y, z, 1); charEdge(x, y + 1, z, 0); charEdge(x + 1, y, z, 1);
    // casa: quando metade do térreo queimou, o telhado inteiro desaba (fica a ruína a céu aberto)
    var b = l.room[i] ? W.building(x, y, z) : null;
    if (b && z === 0) {
      b.burntN = (b.burntN || 0) + 1;
      if (!b.roofGone && b.burntN >= b.w * b.h * FC.ROOF_COLLAPSE) { b.roofGone = true; Fi.removeRoof(b); }
    }
    ch.dirty = true; ch.saveDirty = true;
  };

  /* tira todos os tiles de telhado de um prédio (desabou) */
  Fi.removeRoof = function (b) {
    for (var zz = 1; zz < C.LEVELS; zz++) {
      for (var yy = b.y; yy < b.y + b.h; yy++) {
        for (var xx = b.x; xx < b.x + b.w; xx++) {
          var lv = W.lvl(xx, yy, zz);
          if (lv && lv.floor[W.idx(xx, yy)] === F.ROOF) { lv.floor[W.idx(xx, yy)] = F.NONE; var c2 = W.chunkAt(xx, yy); c2._roof = null; c2.dirty = true; c2.saveDirty = true; }
        }
      }
    }
  };

  /* ---------- atualização ---------- */
  var tmpZ = [];
  Fi.update = function (dt) {
    var fl = list();
    if (!fl.length) { return; }
    var g = G(), p = g.player, amb = CP.Amb;
    var wind = amb ? amb.wind() : 0.2, wa = amb ? amb.windAng() : 0, wx = Math.cos(wa), wy = Math.sin(wa);
    var raining = CP.Time && CP.Time.raining();
    var n0 = fl.length;
    for (var i = fl.length - 1; i >= 0; i--) {
      var f = fl[i];
      var outdoor = !W.isIndoor(f.x, f.y, f.z);
      f.t -= dt * (outdoor && raining ? 3 : 1);
      // queima quem está no fogo
      var zs = CP.Zombies.near(f.x + 0.5, f.y + 0.5, 0.9, tmpZ);
      for (var k = 0; k < zs.length; k++) { var zb = zs[k]; if (Math.abs(zb.z - f.z) < 0.5) { CP.Zombies.damage(zb, 0.6 * dt, undefined, { cause: 'fire' }); } }
      if (!p.dead && Math.floor(p.x) === f.x && Math.floor(p.y) === f.y && W.levelOf(p.z) === f.z && Math.random() < dt * 2) { CP.Body.addWound(p, U.pick(['footL', 'footR', 'shinL', 'shinR']), 'burn', { cause: 'Morreu queimado' }); }
      // espalha para os vizinhos (o vento empurra; paredes seguram bastante)
      f.sp -= dt;
      if (f.sp <= 0 && n0 < FC.MAX_TILES) {
        f.sp = 1;
        for (var d = 0; d < 4; d++) {
          var dx = [1, -1, 0, 0][d], dy = [0, 0, 1, -1][d], nx = f.x + dx, ny = f.y + dy;
          if (burningAt(nx, ny, f.z)) { continue; }
          var kk = Fi.flammability(nx, ny, f.z);
          if (kk <= 0) { continue; }
          var wb = Math.max(0.3, 1 + wind * (dx * wx + dy * wy) * 1.6);
          var ch2 = FC.SPREAD * kk * wb;
          if (W.blockedBetween(f.x, f.y, nx, ny, f.z, false)) {
            var et = dx ? W.ww(dx > 0 ? nx : f.x, f.y, f.z) : W.wn(f.x, dy > 0 ? ny : f.y, f.z);
            if (et === E.WALL || et === E.WINDOW || et === E.DOOR) { ch2 *= 0.25; }
          }
          if (Math.random() < ch2 && Fi.ignite(nx, ny, f.z, false)) { n0++; }
        }
        // sobe para o andar de cima (chão de madeira por cima)
        if (f.z + 1 < C.LEVELS && Math.random() < FC.SPREAD_UP && W.isIndoor(f.x, f.y, f.z)) { Fi.ignite(f.x, f.y, f.z + 1, false); }
      }
      if (f.t <= 0) {
        var ch = W.chunkAt(f.x, f.y);
        if (ch) { delete ch.fires[W.key(f.x, f.y, f.z)]; }
        fl.splice(i, 1);
        Fi.burnTile(f.x, f.y, f.z);
      }
    }
    // estalos e barulho que atrai zumbis
    Fi.noiseT -= dt;
    if (Fi.noiseT <= 0 && fl.length) {
      Fi.noiseT = 3;
      var nf = fl[(Math.random() * fl.length) | 0];
      CP.Zombies.noise(nf.x + 0.5, nf.y + 0.5, nf.z, Math.min(18, 8 + fl.length * 0.2), 'fire');
    }
    Fi.crackleT -= dt;
    if (Fi.crackleT <= 0 && fl.length && CP.Audio && CP.Audio.crackle) {
      Fi.crackleT = U.randRange(0.15, 0.5);
      var best = null, bd = 400;
      for (var j = 0; j < fl.length; j += Math.max(1, (fl.length / 30) | 0)) { var dd = U.dist2(fl[j].x + 0.5, fl[j].y + 0.5, p.x, p.y); if (dd < bd) { bd = dd; best = fl[j]; } }
      if (best) { CP.Audio.crackle(best.x + 0.5, best.y + 0.5, best.z, Math.min(1, fl.length / 20)); }
    }
    if (fl.length && !ws().fireWarned && g.running) {
      var near = fl.some(function (q) { return U.dist2(q.x, q.y, p.x, p.y) < 30 * 30; });
      if (near && fl.length > 6 && CP.UI) { ws().fireWarned = true; CP.UI.toast('Fogo! O incêndio está se espalhando.', 'danger'); }
    }
  };

  /* luzes dos incêndios (só os mais perto, para não pesar) */
  Fi.lightSources = function (out, p, lz) {
    var fl = list();
    if (!fl.length) { return; }
    var arr = fl.filter(function (f) { return W.levelOf(f.z) === lz && Math.abs(f.x - p.x) < 34 && Math.abs(f.y - p.y) < 34; });
    if (arr.length > FC.MAX_LIGHTS) { arr.sort(function (a, b) { return U.dist2(a.x, a.y, p.x, p.y) - U.dist2(b.x, b.y, p.x, p.y); }); arr.length = FC.MAX_LIGHTS; }
    arr.forEach(function (f) { out.push({ x: f.x + 0.5, y: f.y + 0.5, z: lz, r: 6, i: 0.9, glow: 'fire' }); });
  };

  /* fumaça subindo dos tiles em chamas (por cima de tudo) */
  Fi.drawSmoke = function (g) {
    var fl = list();
    if (!fl.length) { return; }
    var p = G().player, t = performance.now() / 1000, amb = CP.Vis.ambientOut || 1, drawn = 0;
    var c = Math.round(60 + 70 * amb), wind = CP.Amb ? CP.Amb.wind() : 0.2, wa = CP.Amb ? CP.Amb.windAng() : 0;
    var drift = HW * (Math.cos(wa) - Math.sin(wa)) * wind * 0.04;
    for (var i = 0; i < fl.length && drawn < 90; i++) {
      var f = fl[i];
      if (Math.abs(f.x - p.x) > 40 || Math.abs(f.y - p.y) > 40) { continue; }
      drawn++;
      var X = HW * (f.x + 0.5 - f.y - 0.5), Y = HH * (f.x + f.y + 1) - f.z * WH;
      // dentro de casa com telhado: as chamas também saem por cima (vistas de fora)
      var roofed = W.isIndoor(f.x, f.y, f.z) && W.floor(f.x, f.y, f.z + 1) === F.ROOF && W.levelOf(p.z) === f.z && !W.isIndoor(Math.floor(p.x), Math.floor(p.y), f.z);
      var base = roofed ? WH + 26 : 14;
      if (roofed && ((f.x + f.y) & 1) === 0) {
        for (var tg = 0; tg < 2; tg++) {
          var ox = tg ? 9 : -8, oy = tg ? -3 : 4;
          for (var q = 0; q < 3; q++) {
            var hq = (24 + Math.sin(t * 7 + q * 2 + f.x + tg * 3) * 8) * (1.25 - q * 0.28);
            var wq = 15 - q * 4;
            g.fillStyle = ['rgba(255,140,40,0.8)', 'rgba(255,80,20,0.75)', 'rgba(255,225,130,0.85)'][q];
            g.beginPath(); g.moveTo(X + ox - wq, Y - base + 10 + oy); g.bezierCurveTo(X + ox - wq * 0.6, Y - base - hq * 0.6 + oy, X + ox + Math.sin(t * 5 + q + tg) * 6, Y - base - hq * 1.3 + oy, X + ox + Math.sin(t * 6 + q) * 3, Y - base - hq * 1.5 + oy);
            g.bezierCurveTo(X + ox + wq * 0.3, Y - base - hq * 0.7 + oy, X + ox + wq * 0.7, Y - base - hq * 0.3 + oy, X + ox + wq, Y - base + 10 + oy); g.fill();
          }
        }
      }
      for (var k = 0; k < 3; k++) {
        var ph = ((t * 0.35 + k / 3 + (f.x * 0.37 + f.y * 0.71) % 1) % 1);
        var r = 7 + ph * 26, h = base + ph * 170;
        g.fillStyle = 'rgba(' + (c - 15) + ',' + (c - 15) + ',' + (c - 10) + ',' + (0.42 * (1 - ph)).toFixed(3) + ')';
        g.beginPath(); g.arc(X + Math.sin(t + k + f.x) * 4 + drift * h, Y - h, r, 0, Math.PI * 2); g.fill();
      }
    }
  };

  /* ---------- apagar ---------- */
  function extinguishTile(x, y, z) {
    var fl = list();
    for (var i = fl.length - 1; i >= 0; i--) {
      var f = fl[i];
      if (f.x === x && f.y === y && f.z === z) { fl.splice(i, 1); var ch = W.chunkAt(x, y); if (ch) { delete ch.fires[W.key(x, y, z)]; } }
    }
    var w = ws(); w.wet = w.wet || {};
    w.wet[x + ',' + y + ',' + z] = G().state.time + 3600; // molhado: não pega fogo por uma hora de jogo
  }
  Fi.extinguish = function (x, y, z, r) {
    for (var dy = -Math.floor(r); dy <= Math.floor(r); dy++) { for (var dx = -Math.floor(r); dx <= Math.floor(r); dx++) { if (dx * dx + dy * dy <= r * r) { extinguishTile(x + dx, y + dy, z); } } }
  };
  /* opções no tile em chamas (ou do lado) */
  Fi.options = function (p, x, y, z, out) {
    var near = false;
    for (var dy = -1; dy <= 1 && !near; dy++) { for (var dx = -1; dx <= 1 && !near; dx++) { if (burningAt(x + dx, y + dy, z)) { near = true; } } }
    if (!near || U.dist(p.x, p.y, x + 0.5, y + 0.5) > 2.6) { return; }
    var Inv = CP.Items.Inv;
    var ext = Inv.find(p, function (it) { return it.id === 'extinguisher' && (it.uses === undefined || it.uses > 0); });
    var water = Inv.find(p, function (it) { return (it.id === 'water_bottle' || it.id === 'water_dirty') && it.uses > 0 || it.id === 'pot_water'; });
    out.push({ label: ext ? 'Apagar o fogo com o extintor' : 'Jogar água no fogo', disabled: !ext && !water, hint: 'Precisa de extintor ou água (garrafa/panela)', fn: function () {
      CP.Actions.start(p, { name: 'Apagando o fogo', time: ext ? 1.2 : 1.6, anim: 'work', onDone: function () {
        if (ext) { Fi.extinguish(x, y, z, 1.6); if (ext.item.uses !== undefined) { ext.item.uses--; if (ext.item.uses <= 0) { Inv.detach(p, ext.item); } } } else {
          Fi.extinguish(x, y, z, 0.8);
          var it = water.item;
          if (it.id === 'pot_water') { Inv.detach(p, it); Inv.give(p, CP.Items.make('pot')); Fi.extinguish(x, y, z, 1.2); } else { it.uses = Math.max(0, it.uses - 3); if (it.uses <= 0) { Inv.detach(p, it); Inv.give(p, CP.Items.make('bottle_empty')); } }
        }
        if (CP.Audio && CP.Audio.hiss) { CP.Audio.hiss(x + 0.5, y + 0.5); }
      } });
    } });
  };

  /* ---------- corpos: queimar e enterrar ---------- */
  Fi.corpseOptions = function (p, x, y, z, corpses, out) {
    if (!corpses.length || U.dist(p.x, p.y, x + 0.5, y + 0.5) > 1.8) { return; }
    var Inv = CP.Items.Inv;
    var gas = Inv.find(p, function (it) { return CP.Items.hasTag(it, 'gas') && (it.fuel || 0) >= 1; });
    var fireTool = Inv.findTag(p, 'lighter') || Inv.findId(p, 'matches');
    var fresh = corpses.filter(function (c) { return !c.burnt; });
    if (fresh.length) {
      out.push({ label: 'Queimar corpo' + (fresh.length > 1 ? 's (' + fresh.length + ')' : ''), disabled: !gas || !fireTool, hint: 'Precisa de galão com gasolina e isqueiro/fósforos', fn: function () {
        CP.Actions.start(p, { name: 'Jogando gasolina', time: 2.5, anim: 'work', onDone: function () {
          var g2 = Inv.find(p, function (it) { return CP.Items.hasTag(it, 'gas') && (it.fuel || 0) >= 1; });
          if (!g2) { return; }
          g2.item.fuel -= 1;
          if (g2.item.fuel <= 0) { Inv.detach(p, g2.item); Inv.give(p, CP.Items.make('gas_can_empty')); }
          fresh.forEach(function (c) { c.burnt = true; c.burnT = G().state.time; });
          Fi.ignite(x, y, z, true, 20);
          CP.Zombies.noise(x, y, z, 12, 'fire');
          if (CP.UI) { CP.UI.toast('O corpo pega fogo. Afaste-se!', 'warn'); }
        } });
      } });
    }
    var f = W.floor(x, y, z), soft = f === F.GRASS || f === F.DARKGRASS || f === F.DIRT || f === F.SAND || f === F.FARM || f === F.FIELD || f === F.FURROW || f === F.BURNT;
    if (z === 0 && !W.isIndoor(x, y, z)) {
      var shovel = Inv.findTag(p, 'shovel');
      out.push({ label: 'Enterrar corpo' + (corpses.length > 1 ? 's' : ''), disabled: !shovel || !soft || !!W.obj(x, y, z), hint: !shovel ? 'Precisa de uma pá' : 'Só em terra ou grama, sem nada em cima', fn: function () {
        CP.Actions.start(p, { name: 'Cavando uma cova', time: 12 - CP.Player.skillLevel(p, 'strength') * 0.4, anim: 'work', noise: { r: 8, every: 2 }, onDone: function () {
          var ch = W.chunkAt(x, y);
          if (!ch || W.obj(x, y, z)) { return; }
          var fi = W.floorItems(x, y, z, true);
          for (var i = ch.corpses.length - 1; i >= 0; i--) {
            var c = ch.corpses[i];
            if (Math.floor(c.x) === x && Math.floor(c.y) === y && W.levelOf(c.z) === z) { (c.items || []).forEach(function (it) { fi.push(it); }); ch.corpses.splice(i, 1); }
          }
          var l = ch.levels[z]; l.obj[W.idx(x, y)] = O.GRAVE; l.odir[W.idx(x, y)] = 0;
          ch.dirty = true; ch.saveDirty = true;
          CP.Player.addXp(p, 'strength', 1.5); CP.Player.addXp(p, 'fitness', 1);
          p.body.stats.unhappy = Math.max(0, p.body.stats.unhappy - 0.03);
          if (CP.Body) { CP.Body.addDirt(p, 0.15); }
          if (CP.UI) { CP.UI.toast('Você enterrou o corpo.'); }
        } });
      } });
    }
  };
  /* corpos queimados somem depois de um tempo (só sobram cinzas) */
  Fi.cleanBurnt = function (ch) {
    var now = G().state.time;
    for (var i = ch.corpses.length - 1; i >= 0; i--) { var c = ch.corpses[i]; if (c.burnT && now - c.burnT > FC.BURNT_CORPSE_S) { ch.corpses.splice(i, 1); ch.saveDirty = true; } }
  };

  /* ---------- cheiro de corpos apodrecendo: doença ---------- */
  Fi.corpseSickness = function (p, h) {
    var g = G(), lv = W.levelOf(p.z), n = 0, now = g.state.time;
    for (var k in g.activeChunks) {
      var ch = g.activeChunks[k];
      Fi.cleanBurnt(ch);
      for (var i = 0; i < ch.corpses.length; i++) {
        var c = ch.corpses[i];
        if (c.burnt || W.levelOf(c.z) !== lv || now - (c.t || 0) < FC.ROT_AFTER_S) { continue; }
        if (Math.abs(c.x - p.x) < FC.SMELL_R && Math.abs(c.y - p.y) < FC.SMELL_R) { n++; }
      }
    }
    Fi.smellCount = n;
    if (n >= FC.SMELL_MIN) {
      var s = p.body.stats, indoorK = W.isIndoor(Math.floor(p.x), Math.floor(p.y), lv) ? 1.6 : 1;
      s.sick = Math.min(1, s.sick + FC.SICK_PER_HOUR * (n - FC.SMELL_MIN + 1) * indoorK * h);
      if (!p.smellWarned && CP.UI) { p.smellWarned = true; CP.UI.toast('O cheiro dos corpos apodrecendo por perto está te deixando enjoado. Queime ou enterre-os.', 'warn'); }
    }
  };

  CP.Fire = Fi;
})(window.CP = window.CP || {});
