/* Sobrevivência no mato e em casa: armadilhas para bichos pequenos, modo de busca (coleta enquanto anda),
 * exercícios (força e condicionamento, com dor muscular) e pratos montados ingrediente por ingrediente
 * (ensopado, salada, sanduíche) — como as receitas que "evoluem" do original. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, D = CP.D, O = C.OBJ, F = C.FLOOR;
  var Sv = { marks: [] };
  function G() { return CP.Game; }
  function msg(t, k) { if (CP.UI) { CP.UI.toast(t, k); } }
  function lvl(p) { return W.levelOf(p.z); }
  function skill(p, s) { return CP.Player.skillLevel(p, s); }

  /* ================= ARMADILHAS ================= */
  var BAITS = ['worm', 'berries', 'carrot', 'apple', 'cabbage', 'lettuce', 'cheese', 'peanutbutter', 'corn_open', 'bread', 'mushroom'];
  function trapTile(x, y, z) {
    var f = W.floor(x, y, z);
    return z === 0 && !W.isIndoor(x, y, z) && W.tileWalkable(x, y, z) && !W.obj(x, y, z) && f !== F.WATER && f !== F.ASPHALT && f !== F.CONCRETE;
  }
  Sv.placeTrap = function (p, it) {
    var x = Math.floor(p.x + Math.cos(p.ang) * 0.9), y = Math.floor(p.y + Math.sin(p.ang) * 0.9), z = lvl(p);
    if (!trapTile(x, y, z)) { x = Math.floor(p.x); y = Math.floor(p.y); }
    if (!trapTile(x, y, z)) { msg('Arme a armadilha na terra ou na grama, ao ar livre e longe de móveis.', 'warn'); return; }
    var kind = D.ITEMS[it.id].trap;
    CP.Actions.start(p, { name: 'Armando a armadilha', time: 4 * (1.2 - skill(p, 'trapping') * 0.05), anim: 'work', onDone: function () {
      if (!trapTile(x, y, z)) { return; }
      CP.Items.Inv.detach(p, it);
      var ch = W.chunkAt(x, y);
      W.lvl(x, y, z).obj[W.idx(x, y)] = kind === 'box' ? O.TRAP_BOX : O.TRAP_SNARE;
      W.lvl(x, y, z).odir[W.idx(x, y)] = 0;
      ch.traps = ch.traps || {};
      ch.traps[W.key(x, y, z)] = { kind: kind, bait: null, catch: null, set: CP.Time.hours() };
      ch.dirty = true;
      CP.Player.addXp(p, 'trapping', 2);
      msg('Armadilha armada. Ponha uma isca e deixe-a sozinha por algumas horas.');
    } });
  };
  function trapAt(x, y, z) { var ch = W.chunkAt(x, y); return ch && ch.traps ? ch.traps[W.key(x, y, z)] : null; }
  Sv.trapAt = trapAt;
  Sv.trapLabel = function (t) {
    if (!t) { return null; }
    if (t.catch) { return 'pegou: ' + D.ITEMS[t.catch].name.replace(/ \(abatido\)/, '').toLowerCase(); }
    return t.bait ? 'com isca (' + D.ITEMS[t.bait].name.toLowerCase() + ')' : 'vazia, sem isca';
  };
  Sv.trapOptions = function (p, x, y, z, out) {
    var t = trapAt(x, y, z);
    if (!t) { return; }
    var ch = W.chunkAt(x, y);
    out.push({ label: 'Armadilha: ' + Sv.trapLabel(t), disabled: true });
    if (t.catch) {
      out.push({ label: 'Pegar o ' + D.ITEMS[t.catch].name.replace(/ \(abatido\)/, '').toLowerCase(), key: 'E', fn: function () {
        CP.Items.Inv.give(p, CP.Items.make(t.catch, { age: 0 }));
        t.catch = null; W.lvl(x, y, z).odir[W.idx(x, y)] = 0; ch.dirty = true;
        CP.Player.addXp(p, 'trapping', 4);
      } });
    } else if (!t.bait) {
      var bait = CP.Items.Inv.find(p, function (it) { return BAITS.indexOf(it.id) >= 0; });
      out.push({ label: 'Pôr isca' + (bait ? ' (' + D.ITEMS[bait.item.id].name.toLowerCase() + ')' : ''), disabled: !bait, hint: 'Minhoca, frutas, verduras, queijo, pão...', fn: function () {
        if (!bait) { return; }
        var id = bait.item.id;
        if (bait.item.n > 1) { bait.item.n--; } else { CP.Items.Inv.detach(p, bait.item); }
        t.bait = id; ch.dirty = true;
      } });
    }
    out.push({ label: 'Desarmar e recolher', fn: function () {
      CP.Actions.start(p, { name: 'Recolhendo a armadilha', time: 2.5, anim: 'work', onDone: function () {
        if (t.catch) { CP.Items.Inv.give(p, CP.Items.make(t.catch, { age: 0 })); }
        CP.Items.Inv.give(p, CP.Items.make(t.kind === 'box' ? 'trap_box' : 'trap_snare'));
        delete ch.traps[W.key(x, y, z)];
        W.lvl(x, y, z).obj[W.idx(x, y)] = 0; W.lvl(x, y, z).odir[W.idx(x, y)] = 0; ch.dirty = true;
      } });
    } });
  };
  /* chance por hora de cada armadilha pegar um bicho (precisa estar longe do jogador) */
  Sv.trapChance = function (ch, t, p) {
    var TC = C.TRAPS, ty = ch.type;
    var zone = ty === 1 ? TC.FOREST : (ty === 2 || ty === 3 ? TC.FIELD : TC.TOWN);
    return TC.BASE * zone * (t.bait ? TC.BAIT : 1) * (1 + skill(p, 'trapping') * 0.12);
  };
  Sv.hourly = function () {
    var p = G().player, all = W.allChunks();
    for (var i = 0; i < all.length; i++) {
      var ch = all[i];
      if (!ch.traps) { continue; }
      for (var k in ch.traps) {
        var t = ch.traps[k];
        if (t.catch) { continue; }
        var key = +k, z = Math.floor(key / (C.CHUNK * C.CHUNK)), ix = key % (C.CHUNK * C.CHUNK);
        var x = ch.cx * C.CHUNK + (ix & (C.CHUNK - 1)), y = ch.cy * C.CHUNK + (ix >> W.chunkShift);
        if (U.dist(x, y, p.x, p.y) < C.TRAPS.MIN_DIST) { continue; }
        if (Math.random() < Sv.trapChance(ch, t, p)) {
          t.catch = U.rng.weighted(C.TRAPS.ANIMALS[t.kind]); t.bait = null;
          var L = ch.levels[z]; if (L) { L.odir[ix] = 1; }
          ch.dirty = true; ch.saveDirty = true;
        }
      }
    }
  };

  /* ================= MODO DE BUSCA ================= */
  var FORAGE_TABLES = {
    forest: [['berries', 4], ['mushroom', 3], ['worm', 4], ['branch', 5], ['stone', 2], ['herbs', 1.5], ['wild_garlic', 1.5]],
    field: [['worm', 4], ['branch', 2], ['stone', 3], ['berries', 2], ['wild_garlic', 1], ['herbs', 0.8]],
    town: [['worm', 3], ['branch', 2], ['stone', 3], ['bottle_empty', 2], ['empty_beer', 1.5], ['rag', 1], ['scrap', 1], ['berries', 0.6]]
  };
  var NATURE = [];
  [F.GRASS, F.DARKGRASS, F.DIRT, F.FIELD, F.SAND, F.GRAVEL].forEach(function (f) { NATURE[f] = 1; });
  Sv.toggleSearch = function (p) {
    if (p.vehicle) { return; }
    p.searching = !p.searching;
    p.searchT = 0.5;
    msg(p.searching ? 'Modo de busca: ande devagar e olhe o chão em volta (O para parar).' : 'Modo de busca desligado.');
  };
  Sv.searchRadius = function (p) { return C.SEARCH.RADIUS + skill(p, 'foraging') * C.SEARCH.PER_LEVEL; };
  function searchStep(p) {
    var r = Sv.searchRadius(p), z = lvl(p);
    if (z !== 0) { return; }
    var day = Math.floor(CP.Time.daysSurvived());
    for (var tries = 0; tries < 6; tries++) {
      var a = Math.random() * Math.PI * 2, d = Math.random() * r;
      var x = Math.floor(p.x + Math.cos(a) * d), y = Math.floor(p.y + Math.sin(a) * d);
      if (!NATURE[W.floor(x, y, 0)] || W.isIndoor(x, y, 0) || !W.tileWalkable(x, y, 0) || !CP.Vis.isVisible(x, y, 0)) { continue; }
      var ch = W.chunkAt(x, y), k = W.key(x, y, 0);
      ch.foraged = ch.foraged || {};
      if (ch.foraged[k] === day) { continue; }
      ch.foraged[k] = day;
      var dark = CP.Time.isNight() && CP.Vis.lightAt(x, y, 0) < 0.4;
      var chance = (0.22 + skill(p, 'foraging') * 0.04) * (dark ? 0.35 : 1) * (CP.Amb && CP.Amb.snow() > 0.5 ? 0.3 : 1);
      CP.Player.addXp(p, 'foraging', 0.4);
      if (Math.random() >= chance) { return; }
      var zone = ch.type === 1 ? 'forest' : (ch.type === 2 || ch.type === 3 ? 'field' : 'town');
      var near = W.obj(x, y, 0);
      if (near && C.OBJ_INFO[near].tree) { zone = 'forest'; }
      var id = U.rng.weighted(FORAGE_TABLES[zone]);
      if (!D.ITEMS[id]) { return; }
      var it = CP.Items.make(id, { age: 0 });
      W.floorItems(x, y, 0, true).push(it);
      Sv.marks.push({ x: x + 0.5, y: y + 0.5, t: 0, icon: D.ITEMS[id].icon, id: id });
      if (Sv.marks.length > 30) { Sv.marks.shift(); }
      CP.Player.addXp(p, 'foraging', 2);
      msg('Você achou ' + D.ITEMS[id].name.toLowerCase() + ' ali.', 'good');
      return;
    }
  }
  Sv.searchStep = searchStep;

  /* ================= EXERCÍCIOS ================= */
  var EXERCISES = [
    { id: 'pushups', name: 'Flexões', skill: 'strength', group: 'arms', pose: 'pushup' },
    { id: 'squats', name: 'Agachamentos', skill: 'fitness', group: 'legs', pose: 'squat' },
    { id: 'situps', name: 'Abdominais', skill: 'fitness', group: 'core', pose: 'situp' },
    { id: 'jacks', name: 'Polichinelos', skill: 'fitness', group: 'legs', pose: 'jack' }
  ];
  Sv.EXERCISES = EXERCISES;
  function strain(p) { p.body.strain = p.body.strain || { arms: 0, legs: 0, core: 0 }; return p.body.strain; }
  Sv.strain = strain;
  Sv.exerciseOptions = function (p, out) {
    if (p.vehicle || p.dragging) { return; }
    var danger = CP.Zombies.near(p.x, p.y, 10, []).some(function (z) { return z.state === 'chase' || z.state === 'attack'; });
    out.push({ label: 'Exercitar...', sub: true });
    EXERCISES.forEach(function (ex) {
      var sv = strain(p)[ex.group], tired = p.body.stats.endurance < 0.35;
      out.push({ label: '   ' + ex.name + ' (' + D.SKILL[ex.skill].name.toLowerCase() + ')', disabled: danger || tired || sv >= C.EXERCISE.MAX_STRAIN,
        hint: danger ? 'Zumbis por perto' : (tired ? 'Sem fôlego' : 'Músculos doloridos'), fn: function () { Sv.exercise(p, ex); } });
    });
  };
  Sv.exercise = function (p, ex) {
    var E = C.EXERCISE;
    CP.Actions.start(p, { name: ex.name, time: E.TIME, anim: 'exercise', exercise: ex.pose, onTick: function (pp, dt) {
      pp.body.stats.endurance = Math.max(0, pp.body.stats.endurance - E.ENDURANCE / E.TIME * dt);
      pp.body.stats.boredom = Math.max(0, pp.body.stats.boredom - 0.004 * dt);
      pp.body.stats.stress = Math.max(0, pp.body.stats.stress - 0.003 * dt);
      if (pp.body.stats.endurance < 0.12 && CP.Actions) { CP.Actions.cancel(pp, 'cansou'); msg('Você está exausto(a) demais para continuar.', 'warn'); }
    }, onDone: function () {
      var st = strain(p);
      var regular = Math.max(0.5, 1 - st[ex.group]);   // músculo dolorido rende menos
      CP.Player.addXp(p, ex.skill, 7 * regular);
      st[ex.group] = Math.min(1, st[ex.group] + E.STRAIN);
      p.body.stats.unhappy = Math.max(0, p.body.stats.unhappy - 0.03);
      msg(ex.name + ': feito.' + (st[ex.group] > 0.5 ? ' Os músculos estão doloridos.' : ''));
    } });
  };

  /* ================= PRATOS (ensopado, salada, sanduíche) ================= */
  var DISH_MAX = { stew: 6, salad: 5, sandwich: 3 };
  var SALAD_OK = ['lettuce', 'cabbage', 'tomato', 'carrot', 'apple', 'orange', 'banana', 'berries', 'cheese', 'egg_cooked', 'wild_garlic', 'mushroom', 'corn_open', 'tuna_open', 'chicken_cooked'];
  var SANDWICH_OK = ['cheese', 'peanutbutter', 'tuna_open', 'steak_cooked', 'chicken_cooked', 'egg_cooked', 'tomato', 'lettuce', 'rabbit_cooked', 'fish_cooked'];
  function canStew(d, id) { return d.food && !d.food.canned && !d.food.needsCooking && !d.food.dish && id !== 'worm' && id !== 'milk' && id !== 'icecream' && id !== 'candy' && id !== 'chips'; }
  function addToDish(p, dish, it, portion) {
    var f = D.ITEMS[it.id].food, k = portion || 1;
    dish.dish = dish.dish || { hunger: 0, cal: 0, thirst: 0, unhappy: 0, boredom: 0 };
    dish.ingr = dish.ingr || [];
    var q = CP.Items.freshState(it) === 'rotten' ? 0.5 : 1;
    dish.dish.hunger += f.hunger * k * q; dish.dish.cal += f.cal * k * q;
    dish.dish.thirst += (f.thirst || 0) * k; dish.dish.unhappy += (f.unhappy || 0) * k * 0.5 - 0.02; dish.dish.boredom += (f.boredom || 0) * k * 0.5 - 0.02;
    if (f.raw) { dish.hasRaw = true; }
    dish.ingr.push(it.id);
    if ((it.portion || 1) > k + 0.01) { it.portion = (it.portion || 1) - k; } else if (it.n > 1) { it.n--; } else { CP.Items.Inv.detach(p, it); }
  }
  Sv.dishOptions = function (p, it, out) {
    var d = D.ITEMS[it.id], Inv = CP.Items.Inv;
    if (!d.food || d.food.canned) { return; }
    // ensopado: panela com água (ou ensopado cru que ainda cabe mais)
    if (canStew(d, it.id)) {
      var pot = Inv.find(p, function (x) { return x.id === 'stew_raw' && (x.ingr || []).length < DISH_MAX.stew; }) || Inv.findId(p, 'pot_water');
      if (pot) { out.push({ label: 'Pôr no ensopado', fn: function () { Sv.addStew(p, pot.item, it); } }); }
    }
    if (SALAD_OK.indexOf(it.id) >= 0) {
      var sal = Inv.find(p, function (x) { return x.id === 'salad' && x !== it && (x.ingr || []).length < DISH_MAX.salad; });
      var knife = Inv.findTag(p, 'knife');
      out.push({ label: sal ? 'Pôr na salada' : 'Começar uma salada', disabled: !knife, hint: 'Precisa de faca', fn: function () { Sv.addSalad(p, sal ? sal.item : null, it); } });
    }
    if (SANDWICH_OK.indexOf(it.id) >= 0) {
      var sw = Inv.find(p, function (x) { return x.id === 'sandwich' && (x.ingr || []).length < DISH_MAX.sandwich + 1; }) || Inv.findId(p, 'bread');
      if (sw) { out.push({ label: 'Pôr no sanduíche', fn: function () { Sv.addSandwich(p, sw.item, it); } }); }
    }
  };
  Sv.addStew = function (p, base, it) {
    CP.Actions.start(p, { name: 'Cortando para o ensopado', time: 2.5, anim: 'work', onDone: function () {
      var dish = base;
      if (base.id === 'pot_water') { CP.Items.Inv.detach(p, base); dish = CP.Items.make('stew_raw', { age: 0 }); dish.dish = { hunger: 0.05, cal: 20, thirst: -0.1, unhappy: 0, boredom: 0 }; dish.ingr = []; CP.Items.Inv.give(p, dish); }
      addToDish(p, dish, it, 1);
      CP.Player.addXp(p, 'cooking', 1);
    } });
  };
  Sv.addSalad = function (p, base, it) {
    CP.Actions.start(p, { name: 'Montando a salada', time: 2, anim: 'work', onDone: function () {
      var dish = base;
      if (!dish) { dish = CP.Items.make('salad', { age: 0 }); dish.dish = { hunger: 0, cal: 0, thirst: 0, unhappy: -0.05, boredom: -0.05 }; dish.ingr = []; CP.Items.Inv.give(p, dish); }
      addToDish(p, dish, it, 1);
      CP.Player.addXp(p, 'cooking', 1);
    } });
  };
  Sv.addSandwich = function (p, base, it) {
    CP.Actions.start(p, { name: 'Montando o sanduíche', time: 2, anim: 'work', onDone: function () {
      var dish = base;
      if (base.id === 'bread') {
        CP.Items.Inv.detach(p, base);
        dish = CP.Items.make('sandwich', { age: 0 }); dish.dish = { hunger: 0, cal: 0, thirst: 0.02, unhappy: -0.05, boredom: -0.05 }; dish.ingr = [];
        addToDish(p, dish, base, 1);
        CP.Items.Inv.give(p, dish);
      }
      addToDish(p, dish, it, 1);
      CP.Player.addXp(p, 'cooking', 1);
    } });
  };
  /* cozinhar o ensopado cru: rende mais e anima */
  Sv.cookDish = function (dish) {
    var d = dish.dish || { hunger: 0, cal: 0 };
    var out = { hunger: d.hunger * 1.15, cal: d.cal * 1.1, thirst: Math.min(0, d.thirst), unhappy: Math.min(d.unhappy, 0) - 0.12 - dish.ingr.length * 0.02, boredom: Math.min(d.boredom, 0) - 0.1 - dish.ingr.length * 0.02 };
    return out;
  };
  /* nome do prato com os ingredientes */
  Sv.dishName = function (it) {
    if (!it.ingr || !it.ingr.length) { return ''; }
    var names = [], seen = {};
    it.ingr.forEach(function (id) { if (!seen[id] && D.ITEMS[id]) { seen[id] = 1; names.push(D.ITEMS[id].name.replace(/ \(.*\)| cru| crua| enlatad[oa]/g, '').toLowerCase()); } });
    return ' de ' + (names.length > 3 ? names.slice(0, 3).join(', ') + '…' : names.join(', '));
  };

  /* ================= ATUALIZAÇÃO E DESENHO ================= */
  Sv.update = function (dt, gameDt) {
    var p = G().player;
    if (!p || p.dead) { return; }
    // dor muscular passa com as horas
    if (p.body && p.body.strain) { var s = p.body.strain, dec = C.EXERCISE.STRAIN_DECAY_H * gameDt / 3600; s.arms = Math.max(0, s.arms - dec); s.legs = Math.max(0, s.legs - dec); s.core = Math.max(0, s.core - dec); }
    if (p.searching) {
      if (p.vehicle || p.running) { p.searching = false; }
      p.searchT = (p.searchT || 0) - dt;
      if (p.searchT <= 0) { p.searchT = C.SEARCH.EVERY; searchStep(p); }
    }
    for (var i = Sv.marks.length - 1; i >= 0; i--) {
      var m = Sv.marks[i]; m.t += dt;
      var fi = W.floorItems(Math.floor(m.x), Math.floor(m.y), 0);
      if (m.t > C.SEARCH.MARK_S || !fi || !fi.some(function (it) { return it.id === m.id; })) { Sv.marks.splice(i, 1); }
    }
  };
  Sv.drawOverlay = function (g) {
    var p = G().player, HW = C.TILE_W / 2, HH = C.TILE_H / 2;
    if (p.searching && !p.dead) {
      var r = Sv.searchRadius(p), X = HW * (p.x - p.y), Y = HH * (p.x + p.y) - p.z * C.WALL_H;
      g.strokeStyle = 'rgba(230,220,170,0.28)'; g.lineWidth = 1.5; g.setLineDash([5, 7]);
      g.beginPath(); g.ellipse(X, Y, r * HW * 1.414, r * HH * 1.414, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    }
    var now = performance.now() / 1000;
    for (var i = 0; i < Sv.marks.length; i++) {
      var m = Sv.marks[i], mx = HW * (m.x - m.y), my = HH * (m.x + m.y);
      var pulse = 0.6 + Math.sin(now * 4 + i) * 0.25, a = Math.min(1, (C.SEARCH.MARK_S - m.t) / 10);
      g.strokeStyle = 'rgba(255,236,150,' + (0.7 * pulse * a).toFixed(2) + ')'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(mx, my, 13, 6.5, 0, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = a; g.font = '15px "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
      g.fillText(m.icon, mx, my - 8 - Math.sin(now * 3 + i) * 2); g.globalAlpha = 1;
    }
  };
  /* ================= MÓVEIS: pegar, carregar e colocar (barricada atrás da porta) ================= */
  var FU = C.FURNITURE, E = C.EDGE;
  function finfo(o) { return C.OBJ_INFO[o]; }
  Sv.strNeeded = function (kg) { return Math.max(0, Math.ceil((kg - FU.FREE_KG) / FU.KG_PER_STR)); };
  Sv.carrySpeed = function (p) {
    if (!p.carry) { return 1; }
    return U.clamp(FU.SPEED - p.carry.kg * FU.KG_SLOW + skill(p, 'strength') * FU.STR_FAST, 0.35, 0.9);
  };
  /* as 4 bordas de um tile: [x, y, side] */
  function tileEdges(x, y) { return [[x, y, 0], [x, y + 1, 0], [x, y, 1], [x + 1, y, 1]]; }
  function isDoor(t) { return t === E.DOOR || t === E.GARAGE; }
  /* um móvel sólido encostado numa porta fechada a trava (a porta ganha st.block) */
  function blockDoors(x, y, z) {
    var n = 0;
    tileEdges(x, y).forEach(function (e) {
      if (!isDoor(W.edgeType(e[0], e[1], z, e[2]))) { return; }
      var st = W.edgeState(e[0], e[1], z, e[2]);
      if (!st) { st = { open: false, locked: false, hp: 25, bar: 0, barHp: 0, broken: false }; W.setEdgeState(e[0], e[1], z, e[2], st); }
      if (st.open || st.broken) { return; }
      st.block = true; n++;
    });
    return n;
  }
  /* tirou o móvel: a porta só continua travada se ainda houver móvel sólido de um dos lados */
  function unblockDoors(x, y, z) {
    tileEdges(x, y).forEach(function (e) {
      var st = W.edgeState(e[0], e[1], z, e[2]);
      if (!st || !st.block) { return; }
      var a = e[2] === 0 ? [e[0], e[1] - 1] : [e[0] - 1, e[1]], b = [e[0], e[1]];
      st.block = [a, b].some(function (t) { var o = W.obj(t[0], t[1], z); return o && finfo(o).move && finfo(o).solid; });
    });
  }
  Sv.furnOptions = function (p, x, y, z, out) {
    var o = W.obj(x, y, z), info = finfo(o);
    if (!info.move || p.carry || p.vehicle) { return; }
    var cont = info.cap ? W.container(x, y, z) : null, full = cont && cont.items.length > 0;
    var need = Sv.strNeeded(info.move), weak = skill(p, 'strength') < need;
    out.push({ label: 'Pegar ' + info.name.toLowerCase() + ' (' + info.move + ' kg)', disabled: full || weak || !!p.dragging,
      hint: full ? 'Esvazie antes' : (weak ? 'Precisa de força ' + need : 'Solte o corpo antes'), fn: function () { Sv.pickFurniture(p, x, y, z); } });
  };
  Sv.pickFurniture = function (p, x, y, z) {
    var o = W.obj(x, y, z), info = finfo(o);
    if (!info || !info.move || p.carry) { return false; }
    p.ang = Math.atan2(y + 0.5 - p.y, x + 0.5 - p.x);
    CP.Actions.start(p, { name: 'Pegando ' + info.name.toLowerCase(), time: FU.PICK_TIME * (1 + info.move / 40), anim: 'work', noise: { r: 4, every: 1.5 }, onDone: function () {
      if (W.obj(x, y, z) !== o || p.carry) { return; }
      var ch = W.chunkAt(x, y), k = W.key(x, y, z), cont = ch.containers[k];
      if (cont && cont.items.length) { msg('Esvazie antes de carregar.', 'warn'); return; }
      delete ch.containers[k];
      var l = W.lvl(x, y, z), i = W.idx(x, y);
      p.carry = { o: o, dir: l.odir[i] & 3, kg: info.move, name: info.name };
      l.obj[i] = 0; l.odir[i] = 0; ch.dirty = true; ch.saveDirty = true;
      unblockDoors(x, y, z);
      p.running = false; p.sitting = false;
      if (p.body) { p.body.stats.endurance = Math.max(0, p.body.stats.endurance - info.move * 0.002); }
      CP.Player.addXp(p, 'strength', 0.2);
      CP.Game.updateFov(true);
      msg('Carregando: ' + info.name + '. Clique direito num lugar livre para colocar (E coloca à frente).');
    } });
    return true;
  };
  function placeOk(p, x, y, z) {
    if (U.dist(p.x, p.y, x + 0.5, y + 0.5) > 1.9) { return 'Longe demais'; }
    if (Math.floor(p.x) === x && Math.floor(p.y) === y) { return 'Você está no caminho'; }
    if (!W.floor(x, y, z) || W.obj(x, y, z) || !W.tileWalkable(x, y, z) || W.stairAt(x, y)) { return 'Espaço ocupado'; }
    if (CP.Vehicles && CP.Vehicles.carAt && CP.Vehicles.carAt(x + 0.5, y + 0.5, 0.3)) { return 'Tem um carro aqui'; }
    return '';
  }
  Sv.placeFurniture = function (p, x, y, z) {
    var c = p.carry;
    if (!c) { return false; }
    var err = placeOk(p, x, y, z);
    if (err) { msg(err, 'warn'); return false; }
    p.ang = Math.atan2(y + 0.5 - p.y, x + 0.5 - p.x);
    CP.Actions.start(p, { name: 'Colocando ' + c.name.toLowerCase(), time: FU.PLACE_TIME, anim: 'work', onDone: function () {
      if (p.carry !== c || placeOk(p, x, y, z)) { return; }
      var ch = W.chunkAt(x, y), l = W.lvl(x, y, z), i = W.idx(x, y);
      l.obj[i] = c.o; l.odir[i] = c.dir; ch.dirty = true; ch.saveDirty = true;
      if (finfo(c.o).cap) { ch.containers[W.key(x, y, z)] = { items: [], gen: true }; }
      p.carry = null;
      var nb = finfo(c.o).solid ? blockDoors(x, y, z) : 0;
      CP.Game.updateFov(true);
      msg(nb ? 'A porta está travada pelo móvel.' : c.name + ' colocado.');
    } });
    return true;
  };
  var DIR_NAMES = ['sul', 'oeste', 'norte', 'leste'];
  Sv.carryOptions = function (p, x, y, z, out) {
    var c = p.carry;
    if (!c) { return; }
    var err = placeOk(p, x, y, z);
    out.push({ label: 'Colocar ' + c.name.toLowerCase() + ' aqui', key: err ? undefined : 'E', disabled: !!err, hint: err, fn: function () { Sv.placeFurniture(p, x, y, z); } });
    out.push({ label: 'Girar ' + c.name.toLowerCase() + ' (encosta no lado ' + DIR_NAMES[(c.dir + 1) & 3] + ')', fn: function () { c.dir = (c.dir + 1) & 3; } });
  };
  /* porta travada por móvel: zumbis demoram bem mais para derrubar */
  Sv.bashMult = function (st) { return st && st.block ? FU.BLOCK_MULT : 1; };

  /* ================= ESCADA DE MÃO E TELHADO ================= */
  var LDIR = [[0, 1, 0, 1, 0], [-1, 0, 0, 0, 1], [0, -1, 0, 0, 0], [1, 0, 1, 0, 1]]; // dir → [dx, dy, ex, ey, side] (vizinho do outro lado da parede e a borda)
  function ladderTop(x, y, z, dir) {
    var d = LDIR[dir];
    return { x: x + d[0], y: y + d[1], z: z + 1, edge: { x: x + d[2], y: y + d[3], side: d[4] } };
  }
  /* lado da parede (com telhado andável em cima) mais à frente do jogador */
  function ladderSpot(p) {
    var z = lvl(p), x = Math.floor(p.x), y = Math.floor(p.y);
    if (z + 1 >= C.LEVELS || W.isIndoor(x, y, z) || W.obj(x, y, z)) { return null; }
    var best = null, bd = 9;
    for (var dir = 0; dir < 4; dir++) {
      var t = ladderTop(x, y, z, dir), et = W.edgeType(t.edge.x, t.edge.y, z, t.edge.side);
      if (!et || et === E.DOORWAY) { continue; }
      if (!W.tileWalkable(t.x, t.y, t.z) || W.isIndoor(t.x, t.y, t.z)) { continue; }
      var da = Math.abs(U.angleDiff(p.ang, Math.atan2(LDIR[dir][1], LDIR[dir][0])));
      if (da < bd) { bd = da; best = { x: x, y: y, z: z, dir: dir }; }
    }
    return best;
  }
  Sv.ladderItemOptions = function (p, it, out) {
    var sp = ladderSpot(p);
    out.push({ label: 'Apoiar a escada na parede', disabled: !sp, hint: 'Fique colado numa parede com telhado em cima', fn: function () { Sv.placeLadder(p, it); } });
  };
  Sv.placeLadder = function (p, it) {
    var sp = ladderSpot(p);
    if (!sp) { msg('Encoste numa parede com telhado em cima.', 'warn'); return false; }
    CP.Actions.start(p, { name: 'Apoiando a escada', time: 2.5, anim: 'work', onDone: function () {
      if (W.obj(sp.x, sp.y, sp.z)) { return; }
      CP.Items.Inv.detach(p, it);
      var l = W.lvl(sp.x, sp.y, sp.z), i = W.idx(sp.x, sp.y);
      l.obj[i] = O.LADDER; l.odir[i] = sp.dir;
      var ch = W.chunkAt(sp.x, sp.y); ch.dirty = true; ch.saveDirty = true;
      msg('Escada apoiada. Zumbis não sobem escada.');
    } });
    return true;
  };
  Sv.climbLadder = function (p, x, y, z, up) {
    var dir = W.odir(x, y, z) & 3, t = ladderTop(x, y, z, dir);
    var dest = up ? t : { x: x, y: y, z: z };
    if (!W.tileWalkable(dest.x, dest.y, dest.z)) { msg('Não dá: tem algo no caminho.', 'warn'); return false; }
    p.ang = up ? Math.atan2(LDIR[dir][1], LDIR[dir][0]) : Math.atan2(-LDIR[dir][1], -LDIR[dir][0]);
    CP.Actions.start(p, { name: up ? 'Subindo a escada' : 'Descendo a escada', time: up ? 2.2 : 1.8, anim: 'climb', onDone: function () {
      if (W.obj(x, y, z) !== O.LADDER) { return; }
      p.x = dest.x + 0.5; p.y = dest.y + 0.5; p.z = dest.z;
      CP.Player.addXp(p, 'fitness', 0.2);
      CP.Game.updateFov(true);
      if (up) { msg('Você está no telhado.'); }
    } });
    return true;
  };
  Sv.ladderOptions = function (p, x, y, z, out) {
    if (W.obj(x, y, z) !== O.LADDER || U.dist(p.x, p.y, x + 0.5, y + 0.5) > 1.6 || p.carry) { return; }
    out.push({ label: 'Subir no telhado', key: 'E', fn: function () { Sv.climbLadder(p, x, y, z, true); } });
    out.push({ label: 'Recolher a escada', fn: function () { CP.Actions.start(p, { name: 'Recolhendo a escada', time: 2, anim: 'work', onDone: function () { if (W.obj(x, y, z) !== O.LADDER) { return; } var l = W.lvl(x, y, z); l.obj[W.idx(x, y)] = 0; l.odir[W.idx(x, y)] = 0; var ch = W.chunkAt(x, y); ch.dirty = true; ch.saveDirty = true; CP.Items.Inv.give(p, CP.Items.make('step_ladder')); } }); } });
  };
  /* no telhado: escada logo abaixo na beirada → descer */
  Sv.roofOptions = function (p, out) {
    var z = lvl(p);
    if (z < 1 || p.carry) { return; }
    var x = Math.floor(p.x), y = Math.floor(p.y);
    for (var dir = 0; dir < 4; dir++) {
      var d = LDIR[dir], lx = x - d[0], ly = y - d[1];
      if (W.obj(lx, ly, z - 1) === O.LADDER && (W.odir(lx, ly, z - 1) & 3) === dir) {
        out.push({ label: 'Descer pela escada', key: 'E', fn: (function (a, b) { return function () { Sv.climbLadder(p, a, b, z - 1, false); }; })(lx, ly) });
        return;
      }
    }
  };
  Sv.reset = function () { Sv.marks.length = 0; };

  CP.Surv = Sv;
})(window.CP = window.CP || {});
