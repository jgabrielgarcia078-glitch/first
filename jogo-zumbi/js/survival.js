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
  Sv.reset = function () { Sv.marks.length = 0; };

  CP.Surv = Sv;
})(window.CP = window.CP || {});
