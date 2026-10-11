/* Animais vivos no mato: coelhos, veados e pássaros no chão. Pastam, andam à toa e fogem do jogador
 * (agachado assusta menos) e de barulho. Dá para caçar com arma de fogo ou de perto; o bicho morto vira comida no chão.
 * São só entidades perto do jogador (não vão para o save). */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, F = C.FLOOR;
  var HW = C.TILE_W / 2, HH = C.TILE_H / 2;
  var An = { list: [], spawnT: 2 };
  var SPECIES = {
    rabbit: { hp: 0.25, walk: 0.7, flee: 3.6, fear: 6, r: 0.18, item: 'dead_rabbit', name: 'Coelho' },
    deer: { hp: 3, walk: 0.9, flee: 4.8, fear: 10, r: 0.4, item: 'venison', name: 'Veado' },
    bird: { hp: 0.1, walk: 0.4, flee: 0, fear: 4, r: 0.12, item: 'dead_bird', name: 'Pássaro' }
  };
  An.SPECIES = SPECIES;
  var NATURE = [];
  [F.GRASS, F.DARKGRASS, F.DIRT, F.FIELD, F.FARM].forEach(function (f) { NATURE[f] = 1; });
  function G() { return CP.Game; }

  function okTile(x, y) {
    var tx = Math.floor(x), ty = Math.floor(y);
    if (!NATURE[W.floor(tx, ty, 0)] || W.isIndoor(tx, ty, 0) || !W.tileWalkable(tx, ty, 0)) { return false; }
    var o = W.obj(tx, ty, 0);
    return !(o && C.OBJ_INFO[o].solid);
  }
  An.spawn = function (kind, x, y) {
    var s = SPECIES[kind];
    var a = { kind: 'animal', species: kind, x: x, y: y, z: 0, ang: Math.random() * 6.28, hp: s.hp, state: 'graze', t: U.randRange(1, 4), tx: x, ty: y, ph: Math.random(), male: Math.random() < 0.5, id: Math.random() };
    a.draw = drawAnimal;
    An.list.push(a);
    return a;
  };
  function spawnStep(p) {
    var A = C.ANIMALS;
    if (An.list.length >= A.MAX || W.levelOf(p.z) !== 0) { return; }
    var ch = W.chunkAt(Math.floor(p.x), Math.floor(p.y));
    if (!ch) { return; }
    var ty = ch.type, table = ty === 1 ? [['deer', 2], ['rabbit', 4], ['bird', 2]] : (ty === 2 || ty === 3 ? [['rabbit', 4], ['bird', 3], ['deer', 1]] : [['bird', 2], ['rabbit', 0.4]]);
    if (CP.Time.isNight() && Math.random() < 0.6) { return; }
    for (var tries = 0; tries < 8; tries++) {
      var a = Math.random() * 6.28, d = U.randRange(A.SPAWN_MIN, A.SPAWN_MAX);
      var x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (!okTile(x, y)) { continue; }
      var kind = U.rng.weighted(table);
      var n = kind === 'deer' ? U.randInt(1, 3) : (kind === 'bird' ? U.randInt(2, 4) : 1);
      for (var i = 0; i < n; i++) { var ox = x + U.randRange(-1.2, 1.2), oy = y + U.randRange(-1.2, 1.2); if (okTile(ox, oy)) { An.spawn(kind, ox, oy); } }
      return;
    }
  }
  /* susto: barulho perto */
  An.onNoise = function (x, y, z, r) {
    for (var i = 0; i < An.list.length; i++) {
      var a = An.list[i];
      if (U.dist(a.x, a.y, x, y) < r * 1.2) { scare(a, x, y); }
    }
  };
  function scare(a, fx, fy) {
    if (a.state === 'dead') { return; }
    if (a.species === 'bird') { // voa embora
      if (CP.Amb && CP.Amb.spawnFlockAt) { CP.Amb.spawnFlockAt(a.x, a.y, 1); }
      a.state = 'gone'; return;
    }
    a.state = 'flee'; a.t = U.randRange(4, 7); a.fx = fx; a.fy = fy;
  }
  An.update = function (dt) {
    var g = G(), p = g.player;
    if (!p || p.dead) { return; }
    An.spawnT -= dt;
    if (An.spawnT <= 0) { An.spawnT = C.ANIMALS.SPAWN_EVERY; spawnStep(p); }
    for (var i = An.list.length - 1; i >= 0; i--) {
      var a = An.list[i], s = SPECIES[a.species];
      if (a.state === 'gone' || U.dist(a.x, a.y, p.x, p.y) > C.ANIMALS.DESPAWN) { An.list.splice(i, 1); continue; }
      if (a.state === 'dead') { continue; }
      var dp = U.dist(a.x, a.y, p.x, p.y), fear = s.fear * (p.sneaking ? 0.45 : 1) * (p.running ? 1.5 : 1) * (p.vehicle ? 2 : 1);
      // agachado chegando por trás de um bicho distraído: quase não percebe
      if (p.sneaking && a.state !== 'walk' && Math.abs(U.angleDiff(a.ang, Math.atan2(p.y - a.y, p.x - a.x))) > 1.9) { fear *= C.ANIMALS.SNEAK_BEHIND; }
      if (dp < fear && a.state !== 'flee' && (dp < fear * 0.5 || W.lineOfSight(a.x, a.y, p.x, p.y, 0, 30))) { scare(a, p.x, p.y); continue; }
      a.t -= dt; a.ph += dt;
      var sp = 0, ang = a.ang;
      if (a.state === 'flee') {
        ang = Math.atan2(a.y - a.fy, a.x - a.fx) + Math.sin(a.ph * 2) * 0.3; sp = s.flee;
        if (a.t <= 0) { a.state = 'graze'; a.t = U.randRange(2, 5); }
      } else if (a.state === 'walk') {
        ang = Math.atan2(a.ty - a.y, a.tx - a.x); sp = s.walk;
        if (U.dist(a.x, a.y, a.tx, a.ty) < 0.3 || a.t <= 0) { a.state = 'graze'; a.t = U.randRange(2, 6); }
      } else if (a.t <= 0) {
        a.state = 'walk'; a.t = 6; a.tx = a.x + U.randRange(-4, 4); a.ty = a.y + U.randRange(-4, 4);
      }
      if (sp > 0) {
        a.ang = U.approachAngle ? U.approachAngle(a.ang, ang, dt * 8) : ang;
        var nx = a.x + Math.cos(a.ang) * sp * dt, ny = a.y + Math.sin(a.ang) * sp * dt;
        if (W.tileWalkable(Math.floor(nx), Math.floor(ny), 0) && !W.blockedBetween(Math.floor(a.x), Math.floor(a.y), Math.floor(nx), Math.floor(ny), 0, false)) { a.x = nx; a.y = ny; a.moving = true; } else { a.ang += U.randRange(1, 2.5); a.moving = false; if (a.state === 'walk') { a.state = 'graze'; } }
      } else { a.moving = false; }
    }
  };
  /* dano: de perto (golpe) ou tiro (raio); devolve true se matou */
  An.damage = function (a, dmg, ang) {
    if (a.state === 'dead') { return false; }
    a.hp -= dmg;
    if (CP.FX) { CP.FX.blood(a.x, a.y, 0, a.species === 'deer' ? 2 : 0.8); }
    if (a.hp > 0) { scare(a, a.x - Math.cos(ang), a.y - Math.sin(ang)); return false; }
    a.state = 'dead'; a.ang = ang;
    var it = CP.Items.make(SPECIES[a.species].item, { age: 0 });
    W.floorItems(Math.floor(a.x), Math.floor(a.y), 0, true).push(it);
    var ch = W.chunkAt(Math.floor(a.x), Math.floor(a.y)); if (ch) { ch.saveDirty = true; }
    An.list.splice(An.list.indexOf(a), 1);
    CP.Player.addXp(G().player, 'trapping', 2);
    return true;
  };
  An.melee = function (p, range, arcDeg, dmg) {
    var hit = 0;
    for (var i = An.list.length - 1; i >= 0; i--) {
      var a = An.list[i];
      var dx = a.x - p.x, dy = a.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > range + SPECIES[a.species].r || Math.abs(U.angleDiff(p.ang, Math.atan2(dy, dx))) > arcDeg * Math.PI / 360) { continue; }
      if (An.damage(a, dmg, p.ang)) { hit++; }
    }
    return hit;
  };
  /* primeiro animal no caminho do tiro (antes de maxD); devolve {a, d} */
  An.ray = function (p, ang, maxD) {
    var best = null, bd = maxD;
    for (var i = 0; i < An.list.length; i++) {
      var a = An.list[i], dx = a.x - p.x, dy = a.y - p.y;
      var along = dx * Math.cos(ang) + dy * Math.sin(ang);
      if (along < 0 || along > bd) { continue; }
      if (Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang)) > SPECIES[a.species].r + 0.15) { continue; }
      bd = along; best = a;
    }
    return best ? { a: best, d: bd } : null;
  };
  An.pushEnts = function (list, viewZ) {
    if (viewZ !== 0) { return; }
    for (var i = 0; i < An.list.length; i++) {
      var a = An.list[i];
      if (CP.Vis.isVisible(Math.floor(a.x), Math.floor(a.y), 0)) { list.push(a); }
    }
  };
  An.reset = function () { An.list.length = 0; An.spawnT = 2; };

  /* ---------- desenho ---------- */
  function sc(c, b) { return CP.Spr.lightColor ? U.shade(c, Math.max(0.3, b)) : c; }
  function drawAnimal(g, sx, sy, bright) {
    var a = this, fx = Math.cos(a.ang), fy = Math.sin(a.ang);
    var dx = HW * (fx - fy), dy = HH * (fx + fy), L = Math.sqrt(dx * dx + dy * dy) || 1; dx /= L; dy /= L;
    var t = performance.now() / 1000 + a.id * 10;
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(sx, sy, a.species === 'deer' ? 13 : 5, a.species === 'deer' ? 5 : 2.4, 0, 0, Math.PI * 2); g.fill();
    if (a.species === 'rabbit') {
      var hop = a.moving ? Math.abs(Math.sin(t * 12)) * 3 : 0, by = sy - 3.5 - hop;
      g.fillStyle = sc('#8a6e52', bright); g.beginPath(); g.ellipse(sx - dx * 1, by, 4.2, 3, Math.atan2(dy, dx), 0, Math.PI * 2); g.fill();
      var hx = sx + dx * 3.5, hy = by - 2 + dy * 1.5;
      g.fillStyle = sc('#7a6048', bright); g.beginPath(); g.arc(hx, hy, 2, 0, Math.PI * 2); g.fill();
      g.fillRect(hx - 1.2, hy - 5.5, 0.9, 4); g.fillRect(hx + 0.4, hy - 5.2, 0.9, 3.8);
      g.fillStyle = sc('#e8e2d6', bright); g.beginPath(); g.arc(sx - dx * 4.8, by - 0.8, 1.2, 0, Math.PI * 2); g.fill();
      return;
    }
    if (a.species === 'bird') {
      var peck = a.moving ? 0 : Math.max(0, Math.sin(t * 6)) * 1.2;
      g.fillStyle = sc('#3a3430', bright); g.beginPath(); g.ellipse(sx, sy - 2.2, 2.6, 1.7, Math.atan2(dy, dx), 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(sx + dx * 2.2, sy - 3.3 + peck, 1.2, 0, Math.PI * 2); g.fill();
      return;
    }
    // veado
    var step = a.moving ? Math.sin(t * (a.state === 'flee' ? 14 : 6)) : 0, bodyY = sy - 16 - (a.state === 'flee' ? Math.abs(step) * 2 : 0);
    var px = -dy, py = dx; // perpendicular na tela
    var legs = [[0.8, 1], [0.8, -1], [-0.8, 1], [-0.8, -1]];
    g.strokeStyle = sc('#5a4030', bright); g.lineWidth = 1.6;
    legs.forEach(function (l, i) { var lx = sx + dx * l[0] * 6 + px * l[1] * 1.6, ly = bodyY + 2 + dy * l[0] * 3, sw = step * (i % 2 ? 1 : -1) * 2.5; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + dx * sw, sy - 0.5 + dy * l[0] * 2); g.stroke(); });
    g.fillStyle = sc('#9a7650', bright); g.beginPath(); g.ellipse(sx, bodyY, 9, 4.6, Math.atan2(dy, dx) * 0.35, 0, Math.PI * 2); g.fill();
    g.fillStyle = sc('#e8dcc8', bright); g.beginPath(); g.ellipse(sx - dx * 8, bodyY - 1, 1.8, 2, 0, 0, Math.PI * 2); g.fill();
    var graze = a.state === 'graze' && !a.moving ? 1 : 0;
    var nx = sx + dx * 8, ny = bodyY - 7 + graze * 12, hx2 = nx + dx * 3, hy2 = ny - 1 + graze * 2;
    g.strokeStyle = sc('#8a6848', bright); g.lineWidth = 3; g.beginPath(); g.moveTo(sx + dx * 6, bodyY - 1); g.lineTo(nx, ny); g.stroke();
    g.fillStyle = sc('#8a6848', bright); g.beginPath(); g.ellipse(hx2, hy2, 3, 2, Math.atan2(dy, dx), 0, Math.PI * 2); g.fill();
    if (a.male) { g.strokeStyle = sc('#d8c8a8', bright); g.lineWidth = 1; g.beginPath(); g.moveTo(hx2 - 1, hy2 - 1.5); g.lineTo(hx2 - 3, hy2 - 7); g.lineTo(hx2 - 5, hy2 - 9); g.moveTo(hx2 - 2.4, hy2 - 5); g.lineTo(hx2, hy2 - 8); g.moveTo(hx2 + 1, hy2 - 1.5); g.lineTo(hx2 + 2.5, hy2 - 7); g.lineTo(hx2 + 4.5, hy2 - 9); g.stroke(); }
  }

  CP.Anim = An;
})(window.CP = window.CP || {});
