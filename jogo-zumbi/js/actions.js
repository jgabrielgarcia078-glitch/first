/* Ações com tempo (fila, barra de progresso) e interações com o mundo (portas, janelas, móveis, água, árvores...). */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, D = CP.D;
  var E = C.EDGE, O = C.OBJ, OI = C.OBJ_INFO;

  var A = {};

  /* ---------- núcleo ---------- */
  /* opts: { name, time (s reais), onDone(p), onTick(p, dt, frac), cancelOnMove, anim, noise: {r, every}, check() } */
  A.start = function (p, opts) {
    if (p.dead) { return false; }
    if (p.action) { p.queue.push(opts); return true; }
    if (opts.check && !opts.check(p)) { return false; }
    p.action = { opts: opts, t: 0, time: Math.max(0.05, opts.time * (opts.noSpeedMult ? 1 : CP.Body.actionSpeedMult(p))), noiseT: 0 };
    if (p.sitting && opts.anim !== 'sit') { p.sitting = false; }
    return true;
  };
  A.cancel = function (p, why) {
    if (!p.action) { return; }
    var o = p.action.opts;
    p.action = null;
    p.queue.length = 0;
    if (o.onCancel) { o.onCancel(p, why); }
  };
  A.update = function (p, dt, gameDt) {
    if (!p.action) {
      if (p.queue.length) { A.start(p, p.queue.shift()); }
      return;
    }
    var a = p.action;
    a.t += dt;
    var frac = Math.min(1, a.t / a.time);
    if (a.opts.onTick) { a.opts.onTick(p, dt, frac, gameDt); }
    if (a.opts.noise) {
      a.noiseT -= dt;
      if (a.noiseT <= 0) { a.noiseT = a.opts.noise.every || 2; CP.Zombies.noise(p.x, p.y, p.z, a.opts.noise.r, 'work'); if (a.opts.noise.sound && CP.Audio) { CP.Audio[a.opts.noise.sound](); } }
    }
    if (a.t >= a.time && p.action === a) {
      p.action = null;
      if (a.opts.onDone) { a.opts.onDone(p); }
      if (!p.action && p.queue.length) { A.start(p, p.queue.shift()); }
    }
  };
  A.drawProgress = function (g, sx, sy, p) {
    var a = p.action;
    if (!a || a.time < 0.4) { return; }
    var f = Math.min(1, a.t / a.time);
    var y = sy - 72, w = 34;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(sx - w / 2 - 1, y - 1, w + 2, 6);
    g.fillStyle = '#7ec46a'; g.fillRect(sx - w / 2, y, w * f, 4);
  };

  /* ---------- utilidades ---------- */
  function msg(t, kind) { if (CP.UI) { CP.UI.toast(t, kind); } }
  A.msg = msg;
  function has(p, tag) { return CP.Items.Inv.findTag(p, tag); }
  function edgeMid(e) { return e.side === 0 ? { x: e.x + 0.5, y: e.y } : { x: e.x, y: e.y + 0.5 }; }
  function distToEdge(p, e) { var m = edgeMid(e); return U.dist(p.x, p.y, m.x, m.y); }
  /* lado da borda onde o jogador está: true se do lado "de dentro" (x,y) */
  function onTileSide(p, e) { return e.side === 0 ? p.y >= e.y : p.x >= e.x; }
  function otherSide(p, e) {
    // posição do outro lado da borda
    if (e.side === 0) { return onTileSide(p, e) ? { x: e.x + 0.5, y: e.y - 0.5 } : { x: e.x + 0.5, y: e.y + 0.5 }; }
    return onTileSide(p, e) ? { x: e.x - 0.5, y: e.y + 0.5 } : { x: e.x + 0.5, y: e.y + 0.5 };
  }
  function playerIndoorSide(p, e, z) {
    var a = onTileSide(p, e) ? { x: e.x, y: e.y } : (e.side === 0 ? { x: e.x, y: e.y - 1 } : { x: e.x - 1, y: e.y });
    return W.isIndoor(a.x, a.y, z);
  }
  function lvl(p) { return W.levelOf(p.z); }
  function workTime(p, base, skill) { return base * (skill ? 1.3 - CP.Player.skillLevel(p, skill) * 0.06 : 1); }
  function face(p, x, y) { p.ang = Math.atan2(y - p.y, x - p.x); }

  /* ---------- alarme ao invadir ---------- */
  function breakIn(x, y, z) {
    var b = W.building(x, y, z) || W.building(x, y - 1, z) || W.building(x - 1, y, z);
    if (b && b.alarm && !b.alarmed && CP.Time.powerOn()) { b.alarmed = true; CP.Time.triggerAlarm(b.x + b.w / 2, b.y + b.h / 2, 0, 'house'); }
  }

  /* ---------- opções de borda (porta/janela/cerca) ---------- */
  function edgeOptions(p, e, out) {
    var z = lvl(p);
    var type = W.edgeType(e.x, e.y, z, e.side);
    if (!type || type === E.WALL || type === E.DOORWAY) { return; }
    var st = W.edgeState(e.x, e.y, z, e.side);
    if (!st && (type === E.DOOR || type === E.WINDOW || type === E.GARAGE)) {
      st = { open: false, locked: false, hp: type === E.WINDOW ? 8 : 25, bar: 0, barHp: 0, broken: false, glass: type === E.WINDOW };
      W.setEdgeState(e.x, e.y, z, e.side, st);
    }
    var near = distToEdge(p, e) < 1.35;
    if (!near) { return; }
    var mid = edgeMid(e);
    if (type === E.DOOR || type === E.GARAGE) {
      if (st.broken) { return; }
      if (st.bar > 0) {
        if (has(p, 'hammer') || has(p, 'crowbar')) { out.push({ label: 'Remover tábua da barricada', fn: function () { unbarricade(p, e, z); } }); }
      } else if (st.open) {
        out.push({ label: 'Fechar porta', key: 'E', fn: function () { toggleDoor(p, e, z, st); } });
      } else if (st.locked) {
        if (playerIndoorSide(p, e, z)) { out.push({ label: 'Destrancar porta', key: 'E', fn: function () { st.locked = false; msg('Porta destrancada.'); if (CP.Audio) { CP.Audio.click(); } } }); } else {
          out.push({ label: 'Porta trancada', disabled: true });
          if (has(p, 'crowbar')) { out.push({ label: 'Arrombar com pé de cabra', fn: function () { pry(p, e, z, st); } }); }
          out.push({ label: 'Chutar a porta', fn: function () { kickDoor(p, e, z, st); } });
        }
      } else {
        out.push({ label: 'Abrir porta', key: 'E', fn: function () { toggleDoor(p, e, z, st); } });
        if (playerIndoorSide(p, e, z) && st.ext) { out.push({ label: 'Trancar porta', fn: function () { st.locked = true; msg('Porta trancada.'); if (CP.Audio) { CP.Audio.click(); } } }); }
      }
      if (!st.open && st.bar < 4 && playerIndoorSide(p, e, z)) { barricadeOpt(p, e, z, st, out); }
    } else if (type === E.WINDOW) {
      if (st.bar > 0) {
        if (has(p, 'hammer') || has(p, 'crowbar')) { out.push({ label: 'Remover tábua da barricada', fn: function () { unbarricade(p, e, z); } }); }
        if (st.bar < 4 && (st.broken || !st.open)) { barricadeOpt(p, e, z, st, out); }
        return;
      }
      if (st.broken) {
        if (st.glass) { out.push({ label: 'Tirar cacos de vidro', fn: function () { A.start(p, { name: 'Tirando cacos', time: 2.2, anim: 'work', onDone: function () { st.glass = false; msg('Cacos removidos.'); } }); } }); }
        out.push({ label: 'Pular a janela', key: 'E', fn: function () { climbWindow(p, e, z, st); } });
      } else if (st.open) {
        out.push({ label: 'Pular a janela', key: 'E', fn: function () { climbWindow(p, e, z, st); } });
        out.push({ label: 'Fechar janela', fn: function () { st.open = false; CP.Zombies.noise(mid.x, mid.y, z, 4, 'window'); } });
      } else {
        if (st.locked && !playerIndoorSide(p, e, z)) {
          out.push({ label: 'Janela trancada', disabled: true });
          if (has(p, 'crowbar')) { out.push({ label: 'Forçar janela (pé de cabra)', fn: function () { pryWindow(p, e, z, st); } }); }
        } else {
          out.push({ label: 'Abrir janela', key: 'E', fn: function () { A.start(p, { name: 'Abrindo janela', time: 0.9, anim: 'work', onDone: function () { st.open = true; st.locked = false; CP.Zombies.noise(mid.x, mid.y, z, 5, 'window'); if (!playerIndoorSide(p, e, z)) { breakIn(e.x, e.y, z); } } }); } });
        }
      }
      if (!st.broken) { out.push({ label: 'Quebrar janela', fn: function () { smashWindow(p, e, z, st); } }); }
      if (st.bar < 4 && (st.broken || !st.open) && playerIndoorSide(p, e, z)) { barricadeOpt(p, e, z, st, out); }
    } else if (type === E.FENCE) {
      out.push({ label: 'Pular a cerca', key: 'E', fn: function () { vault(p, e, z, 1.0, 'cerca'); } });
    }
  }
  function toggleDoor(p, e, z, st) {
    st.open = !st.open;
    var m = edgeMid(e);
    CP.Zombies.noise(m.x, m.y, z, C.NOISE.DOOR * 0.6, 'door');
    if (CP.Audio) { CP.Audio.door(st.open); }
    if (st.open && !playerIndoorSide(p, e, z) && st.ext) { breakIn(e.x, e.y, z); }
    // não fecha com o jogador no meio
    if (!st.open) { W.moveCircle(p, 0, 0, C.PLAYER_RADIUS); }
    CP.Game.updateFov(true);
  }
  function pry(p, e, z, st) {
    face(p, edgeMid(e).x, edgeMid(e).y);
    A.start(p, { name: 'Arrombando a porta', time: workTime(p, 6, 'strength'), anim: 'work', noise: { r: 12, every: 1.5 }, onDone: function () {
      if (Math.random() < 0.6 + CP.Player.skillLevel(p, 'strength') * 0.04) { st.locked = false; st.open = true; msg('Você arrombou a porta.'); breakIn(e.x, e.y, z); CP.Game.updateFov(true); } else { msg('Não conseguiu desta vez.', 'warn'); }
      CP.Player.addXp(p, 'strength', 1);
    } });
  }
  function kickDoor(p, e, z, st) {
    var m = edgeMid(e);
    face(p, m.x, m.y);
    A.start(p, { name: 'Chutando', time: 1.1, anim: 'shove', onDone: function () {
      CP.Zombies.noise(m.x, m.y, z, C.NOISE.DOOR_BASH * 1.4, 'kick');
      if (CP.Audio) { CP.Audio.thump(m.x, m.y, z, false); }
      st.hp -= U.randRange(2, 5) * (0.6 + CP.Player.skillLevel(p, 'strength') * 0.08);
      if (p.body) { p.body.stats.endurance = Math.max(0, p.body.stats.endurance - 0.06); }
      if (st.hp <= 0) { st.broken = true; st.open = true; msg('A porta cedeu!'); breakIn(e.x, e.y, z); CP.Game.updateFov(true); } else if (Math.random() < 0.05) { CP.Body.addWound(p, Math.random() < 0.5 ? 'footL' : 'footR', 'scratch', { cause: 'Chutou uma porta' }); }
    } });
  }
  function pryWindow(p, e, z, st) {
    A.start(p, { name: 'Forçando janela', time: workTime(p, 4, 'strength'), anim: 'work', noise: { r: 8, every: 1.5 }, onDone: function () { st.locked = false; st.open = true; msg('Janela aberta.'); breakIn(e.x, e.y, z); } });
  }
  function smashWindow(p, e, z, st) {
    var m = edgeMid(e);
    face(p, m.x, m.y);
    A.start(p, { name: 'Quebrando janela', time: 0.8, anim: 'shove', onDone: function () {
      st.broken = true; st.glass = true; st.open = false;
      CP.Zombies.noise(m.x, m.y, z, C.NOISE.WINDOW_BREAK, 'glass');
      if (CP.Audio) { CP.Audio.glass(m.x, m.y); }
      if (!CP.Combat.weaponOf(p) && Math.random() < 0.5) { CP.Body.addWound(p, Math.random() < 0.5 ? 'handR' : 'farmR', 'laceration', { cause: 'Cortou-se num vidro' }); }
      if (!playerIndoorSide(p, e, z)) { breakIn(e.x, e.y, z); }
      CP.Game.updateFov(true);
    } });
  }
  function climbWindow(p, e, z, st) {
    var dest = otherSide(p, e);
    face(p, dest.x, dest.y);
    A.start(p, { name: 'Pulando a janela', time: 1.6 - CP.Player.skillLevel(p, 'nimble') * 0.05, anim: 'climb', onDone: function () {
      if (W.blockedBetween(Math.floor(p.x), Math.floor(p.y), Math.floor(dest.x), Math.floor(dest.y), z, false) && !(st.broken || st.open)) { return; }
      if (st.broken && st.glass && Math.random() < 0.55) { CP.Body.addWound(p, U.pick(['farmL', 'farmR', 'handL', 'handR', 'thighL', 'shinR']), Math.random() < 0.3 ? 'glass' : 'laceration', { cause: 'Cortou-se pulando uma janela quebrada' }); }
      p.x = dest.x; p.y = dest.y;
      if (!playerIndoorSide(p, e, z)) { /* saiu */ } else { breakIn(e.x, e.y, z); }
      // pulou do 2º andar: queda
      if (z > 0 && !W.tileWalkable(Math.floor(p.x), Math.floor(p.y), z)) {
        p.z = 0;
        var falls = ['thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR'];
        CP.Body.addWound(p, U.pick(falls), Math.random() < 0.4 ? 'fracture' : 'laceration', { cause: 'Morreu com a queda' });
        CP.Body.hurt(p, 15, 'Morreu com a queda');
        msg('Você caiu do andar de cima!', 'danger');
      }
      CP.Game.updateFov(true);
      CP.Zombies.noise(p.x, p.y, p.z, 6, 'climb');
    } });
  }
  function vault(p, e, z, time) {
    var dest = otherSide(p, e);
    face(p, dest.x, dest.y);
    A.start(p, { name: 'Pulando', time: time - CP.Player.skillLevel(p, 'nimble') * 0.04, anim: 'climb', onDone: function () {
      p.x = dest.x; p.y = dest.y; CP.Zombies.noise(p.x, p.y, p.z, 5, 'vault'); CP.Player.addXp(p, 'nimble', 1);
    } });
  }
  function barricadeOpt(p, e, z, st, out) {
    var ok = has(p, 'hammer') && CP.Items.Inv.count(p, 'plank') >= 1 && CP.Items.Inv.count(p, 'nails') >= 2;
    out.push({ label: 'Barricar (tábua + 2 pregos)' + (st.bar ? ' [' + st.bar + '/4]' : ''), disabled: !ok, hint: ok ? '' : 'Precisa de martelo, tábua e 2 pregos', fn: function () {
      A.start(p, { name: 'Barricando', time: workTime(p, 4, 'carpentry') * (CP.D.TRAIT.handy && p.traits.indexOf('handy') >= 0 ? 0.7 : 1), anim: 'work', noise: { r: C.NOISE.BARRICADE, every: 1, sound: 'hammer' }, onDone: function () {
        if (!has(p, 'hammer') || !CP.Items.Inv.consume(p, 'plank', 1) || !CP.Items.Inv.consume(p, 'nails', 2)) { msg('Faltou material.', 'warn'); return; }
        st.bar = (st.bar || 0) + 1; st.barHp = 12; st.open = false;
        CP.Player.addXp(p, 'carpentry', 3);
        CP.Game.updateFov(true);
      } });
    } });
  }
  function unbarricade(p, e, z) {
    var st = W.edgeState(e.x, e.y, z, e.side);
    A.start(p, { name: 'Removendo tábua', time: workTime(p, 3.5, 'carpentry'), anim: 'work', noise: { r: 10, every: 1.2 }, onDone: function () {
      if (st.bar > 0) { st.bar--; st.barHp = st.bar ? 12 : 0; CP.Items.Inv.give(p, CP.Items.make('plank')); if (Math.random() < 0.5) { CP.Items.Inv.give(p, CP.Items.make('nails', { n: 1 })); } }
      CP.Game.updateFov(true);
    } });
  }

  /* ---------- opções de objeto ---------- */
  function objOptions(p, x, y, z, out) {
    var o = W.obj(x, y, z);
    if (!o) { return; }
    var info = OI[o];
    var d = U.dist(p.x, p.y, x + 0.5, y + 0.5);
    var reach = info.tree ? 1.7 : 1.6;
    if (d > reach) { return; }
    var label = info.name;
    if (info.cap) { out.push({ label: 'Abrir ' + label.toLowerCase(), key: 'E', fn: function () { if (CP.UI) { CP.UI.openLoot(x, y, z); } } }); }
    if (info.bed) { out.push({ label: o === O.SOFA ? 'Dormir no sofá' : 'Dormir', fn: function () { A.sleepAt(p, o === O.SOFA ? 0.75 : 1); } }); }
    if (info.seat) { out.push({ label: 'Sentar', fn: function () { p.sitting = true; msg('Você se sentou para descansar.'); } }); }
    if (info.water) { waterOptions(p, x, y, z, o, out); }
    if (info.rain) {
      var rb = rainBarrel(x, y, z);
      out.push({ label: 'Coletor: ' + Math.round(rb ? rb.water || 0 : 0) + ' L', disabled: true });
      waterOptions(p, x, y, z, o, out, rb);
    }
    if (info.tv) {
      out.push({ label: 'Assistir TV', disabled: !CP.Time.powerAt(x, y), hint: 'Sem energia', fn: function () { watchTv(p); } });
    }
    if (info.stove) { out.push({ label: 'Cozinhar (artesanato)', disabled: !CP.Time.powerAt(x, y), hint: 'Sem energia', fn: function () { if (CP.UI) { CP.UI.openCrafting(); } } }); }
    if (info.tree) {
      var axe = CP.Items.Inv.findTag(p, 'chop');
      out.push({ label: 'Cortar árvore', disabled: !axe, hint: 'Precisa de machado', fn: function () { chopTree(p, x, y, z); } });
    }
    if (info.forage) { out.push({ label: 'Procurar algo útil (coleta)', fn: function () { forage(p, x, y, z); } }); }
    if (info.dismantle) {
      var tool = info.dismantle[0] === 'scrap' ? (has(p, 'screwdriver') || has(p, 'wrench')) : (has(p, 'hammer') || has(p, 'saw'));
      out.push({ label: 'Desmontar ' + label.toLowerCase(), disabled: !tool, hint: info.dismantle[0] === 'scrap' ? 'Precisa de chave de fenda' : 'Precisa de martelo ou serrote', fn: function () { dismantle(p, x, y, z); } });
    }
    if (info.car) {
      out.push({ label: 'Quebrar vidro do carro', fn: function () {
        A.start(p, { name: 'Quebrando vidro', time: 0.8, onDone: function () { CP.Zombies.noise(x, y, z, 18, 'glass'); if (CP.Audio) { CP.Audio.glass(x, y); } if (Math.random() < 0.35) { CP.Time.triggerAlarm(x + 0.5, y + 0.5, z, 'car'); } msg('Vidro quebrado.'); } });
      } });
    }
    if (info.fuel) {
      out.push({ label: 'Encher galão de gasolina', disabled: !CP.Time.powerAt(x, y) || !(has(p, 'gas_empty') || has(p, 'gas')), hint: CP.Time.powerAt(x, y) ? 'Precisa de um galão' : 'Bomba sem energia', fn: function () { fillGas(p); } });
    }
    if (info.generator) { generatorOptions(p, x, y, z, out); }
    if (info.crop && CP.Farm) { CP.Farm.cropOptions(p, x, y, z, out); }
    if (info.fire) { out.push({ label: 'Apagar fogueira', fn: function () { W.lvl(x, y, z).obj[W.idx(x, y)] = 0; W.chunkAt(x, y).dirty = true; } }); }
  }

  /* ---------- água ---------- */
  function rainBarrel(x, y, z) {
    var list = CP.Game.state.world.rainBarrels || (CP.Game.state.world.rainBarrels = []);
    for (var i = 0; i < list.length; i++) { if (list[i].x === x && list[i].y === y && list[i].z === z) { return list[i]; } }
    var rb = { x: x, y: y, z: z, water: 0 };
    list.push(rb);
    return rb;
  }
  function tankFor(x, y, z, o) {
    // água que sobra no encanamento/caixa depois do corte
    var ch = W.chunkAt(x, y);
    var k = W.key(x, y, z);
    if (ch.water[k] === undefined) { ch.water[k] = o === O.TOILET ? 6 : (o === O.BATHTUB ? 0 : 2); }
    return { get: function () { return ch.water[k]; }, take: function (n) { ch.water[k] = Math.max(0, ch.water[k] - n); ch.dirty = true; } };
  }
  function waterOptions(p, x, y, z, o, out, rb) {
    var src;
    if (rb) { src = { amount: rb.water || 0, take: function (n) { rb.water = Math.max(0, rb.water - n); }, dirty: true }; } else if (CP.Time.waterOn()) { src = { amount: 999, take: function () {}, dirty: false }; } else {
      var t = tankFor(x, y, z, o);
      src = { amount: t.get(), take: t.take, dirty: o === O.TOILET };
    }
    var ok = src.amount > 0.2;
    out.push({ label: 'Beber água' + (src.dirty ? ' (sem ferver)' : ''), disabled: !ok, hint: 'Sem água', fn: function () {
      A.start(p, { name: 'Bebendo', time: 2, anim: 'eat', onDone: function () {
        var need = Math.min(p.body.stats.thirst, 0.6);
        src.take(need * 2);
        p.body.stats.thirst = Math.max(0, p.body.stats.thirst - need);
        if (src.dirty && Math.random() < 0.35) { p.body.stats.sick = Math.min(1, p.body.stats.sick + 0.25 * (p.fx.poisonMult || 1)); msg('A água não parecia muito limpa...', 'warn'); }
        msg('Você matou a sede.');
      } });
    } });
    var bottle = CP.Items.Inv.find(p, function (it) { return it.id === 'bottle_empty' || it.id === 'water_dirty' || (it.id === 'water_bottle' && it.uses < D.ITEMS.water_bottle.drink.uses); });
    out.push({ label: 'Encher garrafa', disabled: !ok || !bottle, hint: !bottle ? 'Precisa de garrafa' : 'Sem água', fn: function () {
      A.start(p, { name: 'Enchendo garrafa', time: 2, onDone: function () {
        var it = bottle.item;
        var id = src.dirty ? 'water_dirty' : 'water_bottle';
        if (it.id !== id) { var neu = CP.Items.make(id); CP.Items.Inv.detach(p, it); CP.Items.Inv.give(p, neu); it = neu; }
        it.uses = D.ITEMS[id].drink.uses;
        src.take(2);
        msg('Garrafa cheia.');
      } });
    } });
    var pot = CP.Items.Inv.findId(p, 'pot');
    if (pot) {
      out.push({ label: 'Encher panela', disabled: !ok, fn: function () { A.start(p, { name: 'Enchendo panela', time: 2, onDone: function () { CP.Items.Inv.detach(p, pot.item); CP.Items.Inv.give(p, CP.Items.make('pot_water', { dirty: src.dirty })); src.take(3); } }); } });
    }
  }
  /* beber de lago/rio */
  function lakeOptions(p, x, y, z, out) {
    if (W.floor(x, y, z) !== C.FLOOR.WATER || U.dist(p.x, p.y, x + 0.5, y + 0.5) > 1.8) { return; }
    waterOptions(p, x, y, z, O.SINK, out, { water: 999 });
    out.forEach(function (o) { if (o.label.indexOf('Beber') === 0) { o.label = 'Beber do lago (água suja)'; } });
    var rod = has(p, 'fishing_rod');
    out.push({ label: 'Pescar', disabled: !rod, hint: 'Precisa de vara de pescar', fn: function () { fish(p); } });
  }

  function watchTv(p) {
    var show = CP.Time.tvShow();
    msg('TV: "' + show.name + '" — ' + CP.Time.broadcast());
    A.start(p, { name: 'Assistindo TV', time: 25, anim: 'sit', onTick: function (pp, dt) {
      pp.body.stats.boredom = Math.max(0, pp.body.stats.boredom - 0.004 * dt);
    }, onDone: function () {
      var seen = CP.Game.state.world.tvSeen;
      var key = show.name + Math.floor(CP.Time.daysSurvived());
      if (!seen[key]) { seen[key] = 1; CP.Player.addXp(p, show.skill, show.xp); msg('Você aprendeu algo sobre ' + D.SKILL[show.skill].name.toLowerCase() + '.'); }
    } });
  }

  function chopTree(p, x, y, z) {
    var axe = CP.Items.Inv.findTag(p, 'chop');
    if (!axe) { return; }
    if (p.hand1 !== axe.item && CP.UI) { CP.UI.equip(axe.item, 'hand1'); }
    face(p, x + 0.5, y + 0.5);
    var base = OI[W.obj(x, y, z)].chop * 2.2;
    A.start(p, { name: 'Cortando árvore', time: base * (1.3 - CP.Player.skillLevel(p, 'axe') * 0.05) / (p.fx.axeSpeed || 1), anim: 'chop', noise: { r: C.NOISE.CHOP, every: 1.3, sound: 'chop' }, onTick: function (pp, dt) {
      pp.body.stats.endurance = Math.max(0, pp.body.stats.endurance - 0.006 * dt);
    }, onDone: function () {
      if (W.obj(x, y, z) === 0) { return; }
      W.lvl(x, y, z).obj[W.idx(x, y)] = 0;
      W.chunkAt(x, y).dirty = true;
      var items = W.floorItems(x, y, z, true);
      var n = U.randInt(2, 3);
      for (var i = 0; i < n; i++) { items.push(CP.Items.make('log')); }
      CP.Player.addXp(p, 'axe', 4); CP.Player.addXp(p, 'strength', 1);
      if (axe.item.cond !== undefined && Math.random() < 0.3) { axe.item.cond = Math.max(0, axe.item.cond - 1); }
      msg('A árvore caiu. Toras no chão.');
      CP.Game.updateFov(true);
    } });
  }
  function dismantle(p, x, y, z) {
    var o = W.obj(x, y, z), info = OI[o];
    face(p, x + 0.5, y + 0.5);
    A.start(p, { name: 'Desmontando', time: workTime(p, 7, 'carpentry'), anim: 'work', noise: { r: C.NOISE.BUILD, every: 1.2, sound: 'hammer' }, onDone: function () {
      if (W.obj(x, y, z) !== o) { return; }
      var cont = W.container(x, y, z);
      var floor = W.floorItems(x, y, z, true);
      if (cont) { cont.items.forEach(function (it) { floor.push(it); }); }
      var ch = W.chunkAt(x, y);
      delete ch.containers[W.key(x, y, z)];
      var l = W.lvl(x, y, z), i = W.idx(x, y);
      // cama: remove as duas partes
      if (o === O.BED_HEAD || o === O.BED_FOOT) {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) { var ob = W.obj(x + dd[0], y + dd[1], z); if (ob === (o === O.BED_HEAD ? O.BED_FOOT : O.BED_HEAD)) { W.lvl(x + dd[0], y + dd[1], z).obj[W.idx(x + dd[0], y + dd[1])] = 0; } });
      }
      l.obj[i] = 0; ch.dirty = true;
      var skill = CP.Player.skillLevel(p, 'carpentry');
      var n = Math.max(1, Math.round(info.dismantle[1] * (0.5 + skill * 0.07 + Math.random() * 0.3)));
      for (var k = 0; k < n; k++) { floor.push(CP.Items.make(info.dismantle[0])); }
      if (info.dismantle[0] === 'plank' && Math.random() < 0.6) { floor.push(CP.Items.make('nails', { n: U.randInt(1, 4) })); }
      CP.Player.addXp(p, 'carpentry', 2);
      msg('Desmontado. Os materiais ficaram no chão.');
    } });
  }
  var FORAGE = [['berries', 4], ['mushroom', 3], ['rag', 0.5], ['bottle_empty', 1], ['empty_beer', 0.6], ['plank', 0.8], ['apple', 1], ['seeds_carrot', 0.4], ['rope', 0.2], ['scrap', 0.4]];
  function forage(p, x, y, z) {
    var ch = W.chunkAt(x, y);
    ch.foraged = ch.foraged || {};
    var k = W.key(x, y, z);
    var day = Math.floor(CP.Time.daysSurvived());
    A.start(p, { name: 'Procurando', time: 4, anim: 'work', onDone: function () {
      if (ch.foraged[k] === day) { msg('Não há mais nada aqui hoje.'); return; }
      ch.foraged[k] = day;
      var chance = 0.35 + CP.Player.skillLevel(p, 'foraging') * 0.05;
      CP.Player.addXp(p, 'foraging', 1.5);
      if (Math.random() < chance) {
        var it = CP.Items.make(U.rng.weighted(FORAGE));
        CP.Items.Inv.give(p, it);
        msg('Encontrou: ' + CP.Items.name(it));
      } else { msg('Nada útil por aqui.'); }
    } });
  }
  function fish(p) {
    A.start(p, { name: 'Pescando', time: 20, anim: 'sit', onTick: function (pp, dt) { pp.body.stats.boredom = Math.max(0, pp.body.stats.boredom - 0.001 * dt); }, onDone: function () {
      var chance = 0.3 + CP.Player.skillLevel(p, 'fishing') * 0.06;
      CP.Player.addXp(p, 'fishing', 3);
      if (Math.random() < chance) { CP.Items.Inv.give(p, CP.Items.make('fish', { age: 0 })); msg('Você pescou um peixe!'); } else { msg('Nenhum peixe mordeu a isca.'); }
    } });
  }
  function fillGas(p) {
    var can = CP.Items.Inv.findTag(p, 'gas_empty') || CP.Items.Inv.findTag(p, 'gas');
    if (!can) { return; }
    A.start(p, { name: 'Enchendo galão', time: 5, onDone: function () {
      if (can.item.id === 'gas_can_empty') { CP.Items.Inv.detach(p, can.item); CP.Items.Inv.give(p, CP.Items.make('gas_can', { fuel: 10 })); } else { can.item.fuel = 10; }
      msg('Galão cheio de gasolina.');
    } });
  }
  function generatorOptions(p, x, y, z, out) {
    var gens = CP.Game.state.world.generators || (CP.Game.state.world.generators = []);
    var g = null;
    for (var i = 0; i < gens.length; i++) { if (gens[i].x === x && gens[i].y === y) { g = gens[i]; } }
    if (!g) { g = { x: x, y: y, z: z, on: false, fuel: 0 }; gens.push(g); }
    out.push({ label: 'Gerador: ' + (g.on ? 'ligado' : 'desligado') + ', ' + Math.round(g.fuel) + ' L', disabled: true });
    out.push({ label: g.on ? 'Desligar gerador' : 'Ligar gerador', disabled: !g.on && g.fuel <= 0, hint: 'Sem combustível', fn: function () { g.on = !g.on; msg(g.on ? 'Gerador ligado (faz barulho!).' : 'Gerador desligado.'); } });
    var can = CP.Items.Inv.findTag(p, 'gas');
    out.push({ label: 'Abastecer gerador', disabled: !can, hint: 'Precisa de galão com gasolina', fn: function () {
      A.start(p, { name: 'Abastecendo', time: 4, onDone: function () { var add = Math.min(can.item.fuel, 20 - g.fuel); g.fuel += add; can.item.fuel -= add; if (can.item.fuel <= 0) { CP.Items.Inv.detach(p, can.item); CP.Items.Inv.give(p, CP.Items.make('gas_can_empty')); } } });
    } });
  }

  /* ---------- dormir ---------- */
  A.sleepAt = function (p, quality) {
    var zs = CP.Zombies.near(p.x, p.y, 8, []).filter(function (zb) { return zb.state !== 'dead' && (zb.state === 'chase' || zb.state === 'attack'); });
    if (zs.length) { msg('Não dá para dormir com zumbis tão perto!', 'warn'); return; }
    CP.Body.sleep(p, quality);
  };

  /* ---------- montagem do menu de contexto ---------- */
  /* (wx, wy) = ponto do mundo clicado */
  A.contextOptions = function (p, wx, wy) {
    var z = lvl(p);
    var x = Math.floor(wx), y = Math.floor(wy);
    var out = [];
    if (CP.Vehicles) { CP.Vehicles.contextOptions(p, wx, wy, out); }
    // borda mais próxima do clique
    var fx = wx - x, fy = wy - y;
    var edges = [];
    edges.push({ e: { x: x, y: y, side: 0 }, d: fy });
    edges.push({ e: { x: x, y: y + 1, side: 0 }, d: 1 - fy });
    edges.push({ e: { x: x, y: y, side: 1 }, d: fx });
    edges.push({ e: { x: x + 1, y: y, side: 1 }, d: 1 - fx });
    edges.sort(function (a, b) { return a.d - b.d; });
    for (var i = 0; i < 2; i++) { if (edges[i].d < 0.4) { edgeOptions(p, edges[i].e, out); } }
    objOptions(p, x, y, z, out);
    // outra parte de cama/carro etc.
    lakeOptions(p, x, y, z, out);
    // cadáveres e itens no chão
    var ch = W.chunkAt(x, y);
    if (ch) {
      var corpses = ch.corpses.filter(function (c) { return Math.floor(c.x) === x && Math.floor(c.y) === y && W.levelOf(c.z) === z; });
      if (corpses.length && U.dist(p.x, p.y, x + 0.5, y + 0.5) < 1.8) { out.push({ label: 'Revistar corpo', key: 'E', fn: function () { if (CP.UI) { CP.UI.openLoot(x, y, z); } } }); }
      var fi = W.floorItems(x, y, z);
      if (fi && fi.length && U.dist(p.x, p.y, x + 0.5, y + 0.5) < 1.8) { out.push({ label: 'Ver itens no chão (' + fi.length + ')', key: 'E', fn: function () { if (CP.UI) { CP.UI.openLoot(x, y, z); } } }); }
    }
    if (CP.Farm) { CP.Farm.tileOptions(p, x, y, z, out); }
    if (CP.Build && CP.Build.tileOptions) { CP.Build.tileOptions(p, x, y, z, out); }
    return out;
  };

  /* tecla E: interação mais provável na frente do jogador */
  A.interact = function (p) {
    if (p.vehicle && CP.Vehicles) { CP.Vehicles.exit(p); return true; }
    var z = lvl(p);
    var fx = Math.cos(p.ang), fy = Math.sin(p.ang);
    var cands = [];
    // pontos à frente
    var pts = [[p.x + fx * 0.55, p.y + fy * 0.55], [p.x + fx * 0.95, p.y + fy * 0.95], [p.x, p.y]];
    for (var i = 0; i < pts.length; i++) {
      var opts = A.contextOptions(p, pts[i][0], pts[i][1]);
      for (var k = 0; k < opts.length; k++) { if (opts[k].key === 'E' && !opts[k].disabled) { cands.push(opts[k]); } }
      if (cands.length) { break; }
    }
    if (cands.length) { cands[0].fn(); return true; }
    // nada à frente: abre o chão/arredores
    if (CP.UI) { CP.UI.openLoot(Math.floor(p.x), Math.floor(p.y), z); }
    return false;
  };

  CP.Actions = A;
})(window.CP = window.CP || {});
