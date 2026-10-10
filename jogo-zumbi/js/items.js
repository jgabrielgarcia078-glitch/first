/* Itens (instâncias), inventário por peso, recipientes e geração de loot. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, D = CP.D;
  var O = C.OBJ;

  var It = {};

  It.def = function (item) { return D.ITEMS[item.id]; };
  It.nowHours = function () { return CP.Game && CP.Game.state ? CP.Game.state.time / 3600 : 0; };

  /* cria uma instância */
  It.make = function (id, opts, rng) {
    var d = D.ITEMS[id];
    if (!d) { throw new Error('Item desconhecido: ' + id); }
    rng = rng || U.rng;
    var it = { id: id };
    if (d.stack) { it.n = (opts && opts.n) || 1; }
    if (d.weapon && !d.gun) { it.cond = d.weapon.cond; }
    if (d.gun) { it.cond = d.weapon.cond; it.ammo = 0; }
    if (d.drink) { it.uses = d.drink.uses; }
    if (d.med && d.med.uses) { it.uses = d.med.uses; }
    if (d.smoke) { it.uses = d.smoke.uses; }
    if (d.uses) { it.uses = d.uses; }
    if (d.fuel) { it.fuel = d.fuel; }
    if (d.water) { it.water = 0; }
    if (d.light) { it.charge = 1; it.on = false; }
    if (d.food) {
      it.at = It.nowHours();
      it.age = (opts && opts.age !== undefined) ? opts.age : (d.food.fresh ? rng.range(0, d.food.fresh * 24 * 0.6) : 0);
    }
    if (d.cloth) {
      var cols = d.cloth.colors;
      it.color = (opts && opts.color) || (cols ? rng.pick(cols) : '#888');
      it.cond = 1; it.blood = 0; it.holes = 0;
    }
    if (d.bag) { it.items = []; }
    if (d.book && d.book.pages) { it.read = 0; }
    if (d.leisure && d.leisure.pages) { it.read = 0; }
    if (opts) { for (var k in opts) { if (k !== 'n' && k !== 'age' && k !== 'color') { it[k] = opts[k]; } } }
    return it;
  };

  /* ---------- envelhecimento de comida ---------- */
  It.touch = function (it, factor) {
    var d = It.def(it);
    if (!d || !d.food || d.food.canned || !d.food.fresh) { return; }
    var now = It.nowHours();
    if (it.at === undefined) { it.at = now; }
    it.age = (it.age || 0) + Math.max(0, now - it.at) * (factor === undefined ? 1 : factor);
    it.at = now;
  };
  It.freshState = function (it) {
    var d = It.def(it);
    if (!d || !d.food || !d.food.fresh) { return 'ok'; }
    var days = (it.age || 0) / 24;
    if (days > d.food.rot) { return 'rotten'; }
    if (days > d.food.fresh) { return 'stale'; }
    return 'fresh';
  };

  /* ---------- nomes e peso ---------- */
  It.name = function (it) {
    var d = It.def(it);
    if (!d) { return '???'; }
    var n = d.name;
    if (it.n && it.n > 1) { n += ' (' + it.n + ')'; }
    var fs = It.freshState(it);
    if (fs === 'stale') { n += ' (passado)'; } else if (fs === 'rotten') { n += ' (podre)'; }
    if (it.cooked === false) { n += ' (cru)'; }
    if (d.drink && it.uses !== undefined && d.drink.uses > 1) { n += ' [' + it.uses + '/' + d.drink.uses + ']'; }
    if (d.gun) { n += ' [' + (it.ammo || 0) + '/' + d.gun.mag + ']'; }
    if (d.light) { n += it.on ? ' (ligada)' : ''; }
    if (it.water !== undefined && d.water) { n += ' [' + Math.round(it.water) + ' L]'; }
    if (it.fuel !== undefined && d.fuel) { n += ' [' + Math.round(it.fuel) + ' L]'; }
    return n;
  };
  It.baseWeight = function (it) {
    var d = It.def(it);
    if (!d) { return 0; }
    var w = d.w * (it.n || 1);
    if (d.drink && d.drink.uses > 1 && it.uses !== undefined) { w = d.w * (0.25 + 0.75 * it.uses / d.drink.uses); }
    if (it.water) { w += it.water; }
    if (it.fuel !== undefined && d.fuel) { w = 0.5 + it.fuel * 0.45; }
    return w;
  };
  /* peso total, incluindo conteúdo da bolsa; worn = vestido (aplica redução) */
  It.weight = function (it, worn) {
    var w = It.baseWeight(it);
    if (it.items) {
      var inner = 0;
      for (var i = 0; i < it.items.length; i++) { inner += It.weight(it.items[i]); }
      var d = It.def(it);
      w += inner * (worn ? (1 - d.bag.wr) : 1);
    }
    return w;
  };
  It.condText = function (it) {
    var d = It.def(it);
    if (d.weapon && it.cond !== undefined) {
      var f = it.cond / d.weapon.cond;
      return f > 0.75 ? 'ótima' : (f > 0.5 ? 'boa' : (f > 0.25 ? 'gasta' : (f > 0 ? 'quase quebrando' : 'quebrada')));
    }
    return '';
  };
  It.hasTag = function (it, tag) {
    var d = It.def(it);
    return !!(d && d.tags && d.tags.indexOf(tag) >= 0);
  };

  /* ---------- inventário ---------- */
  var Inv = {};
  It.Inv = Inv;
  /* adiciona em uma lista, juntando pilhas */
  Inv.addTo = function (list, it) {
    var d = It.def(it);
    if (d.stack) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === it.id && (list[i].n || 1) + (it.n || 1) <= d.stack) { list[i].n = (list[i].n || 1) + (it.n || 1); return list[i]; }
      }
    }
    list.push(it);
    return it;
  };
  Inv.removeFrom = function (list, it) {
    var i = list.indexOf(it);
    if (i >= 0) { list.splice(i, 1); return true; }
    return false;
  };
  /* recipientes que o jogador carrega: inventário principal, mochila nas costas, bolsas nas mãos */
  Inv.containers = function (p) {
    var out = [{ name: 'Inventário', items: p.inv, cap: Inv.capacity(p), owner: null, main: true }];
    var b = p.worn.back;
    if (b) { out.push({ name: It.def(b).name, items: b.items, cap: It.def(b).bag.cap * (p.fx.bagCap || 1), owner: b }); }
    ['hand1', 'hand2'].forEach(function (h) {
      var it = p[h];
      if (it && It.def(it).bag && it !== p.worn.back) { out.push({ name: It.def(it).name, items: it.items, cap: It.def(it).bag.cap * (p.fx.bagCap || 1), owner: it }); }
    });
    return out;
  };
  Inv.capacity = function (p) {
    var str = CP.Player ? CP.Player.skillLevel(p, 'strength') : 5;
    return C.CARRY_BASE + str * C.CARRY_PER_STRENGTH;
  };
  /* peso carregado (o que conta para "carga pesada") */
  Inv.carried = function (p) {
    var w = 0, i;
    for (i = 0; i < p.inv.length; i++) { w += It.weight(p.inv[i]); }
    for (var slot in p.worn) {
      var it = p.worn[slot];
      if (!it) { continue; }
      w += It.def(it).bag ? It.weight(it, true) : It.baseWeight(it) * 0.3;
    }
    ['hand1', 'hand2'].forEach(function (h) {
      var it2 = p[h];
      if (it2 && !Inv.isWorn(p, it2) && p.inv.indexOf(it2) < 0) { w += It.weight(it2); }
    });
    return w;
  };
  Inv.isWorn = function (p, it) {
    for (var s in p.worn) { if (p.worn[s] === it) { return true; } }
    return false;
  };
  Inv.containerWeight = function (list) {
    var w = 0;
    for (var i = 0; i < list.length; i++) { w += It.weight(list[i]); }
    return w;
  };
  /* todos os itens acessíveis (inventário + bolsas + mãos), com a lista de origem */
  Inv.all = function (p) {
    var out = [];
    Inv.containers(p).forEach(function (c) { c.items.forEach(function (it) { out.push({ item: it, list: c.items }); }); });
    ['hand1', 'hand2'].forEach(function (h) {
      var it = p[h];
      if (it && !out.some(function (o) { return o.item === it; })) { out.push({ item: it, list: null, hand: h }); }
    });
    return out;
  };
  Inv.find = function (p, pred) {
    var all = Inv.all(p);
    for (var i = 0; i < all.length; i++) { if (pred(all[i].item)) { return all[i]; } }
    return null;
  };
  Inv.findTag = function (p, tag) { return Inv.find(p, function (it) { return It.hasTag(it, tag) && !(It.def(it).weapon && it.cond <= 0); }); };
  Inv.findId = function (p, id) { return Inv.find(p, function (it) { return it.id === id; }); };
  Inv.count = function (p, id) {
    var n = 0;
    Inv.all(p).forEach(function (o) { if (o.item.id === id) { n += o.item.n || 1; } });
    return n;
  };
  /* consome n unidades de um item (pilhas ou itens separados) */
  Inv.consume = function (p, id, n) {
    var left = n;
    var all = Inv.all(p);
    for (var i = 0; i < all.length && left > 0; i++) {
      var o = all[i];
      if (o.item.id !== id) { continue; }
      var have = o.item.n || 1;
      if (have > left) { o.item.n = have - left; left = 0; } else {
        left -= have;
        Inv.detach(p, o.item);
      }
    }
    return left === 0;
  };
  /* tira o item de onde estiver (lista, mão, roupa) */
  Inv.detach = function (p, it) {
    if (p.hand1 === it) { p.hand1 = null; }
    if (p.hand2 === it) { p.hand2 = null; }
    for (var s in p.worn) { if (p.worn[s] === it) { p.worn[s] = null; } }
    var conts = Inv.containers(p);
    for (var i = 0; i < conts.length; i++) { if (Inv.removeFrom(conts[i].items, it)) { return true; } }
    return true;
  };
  /* adiciona ao inventário do jogador (principal; bolsa se o principal estiver cheio demais) */
  Inv.give = function (p, it) {
    Inv.addTo(p.inv, it);
    return it;
  };

  /* ---------- LOOT ---------- */
  var Loot = {};
  It.Loot = Loot;
  CP.Loot = Loot;
  function tableFor(objId, room, bld) {
    var rt = room ? room.type : null;
    var kind = bld ? bld.kind : null;
    if (kind === 'barn') { return 'barn'; }
    switch (objId) {
      case O.FRIDGE: return 'fridge';
      case O.COUNTER: case O.SINK: case O.STOVE: return rt === 'kitchen' || rt === 'diner' ? 'kitchen' : (D.LOOT[rt] ? rt : 'kitchen');
      case O.MED_CABINET: return rt === 'pharmacy' || rt === 'clinic' ? rt : 'bathroom';
      case O.WARDROBE: case O.DRESSER: case O.NIGHTSTAND: return rt === 'clothes' ? 'clothes' : 'bedroom';
      case O.SHELF: return rt === 'bedroom' ? 'bedroom' : (rt === 'bookstore' ? 'bookstore' : (rt === 'storage' || rt === 'garage' ? 'garage' : (D.LOOT[rt] && rt !== 'kitchen' ? rt : 'living')));
      case O.SHOP_SHELF: return D.LOOT[rt] ? rt : 'grocery';
      case O.CRATE: case O.BARREL: return rt === 'warehouse' || rt === 'storage' ? (rt === 'storage' ? 'storage' : 'warehouse') : 'crate';
      case O.LOCKER: return rt === 'police' ? 'police' : (rt === 'gunstore' ? 'gunstore' : 'office');
      case O.DESK: return rt === 'police' ? 'police' : 'office';
      case O.WORKBENCH: return 'garage';
      case O.MAILBOX: return 'mailbox';
      case O.CAR: return 'car';
      case O.DUMPSTER: return 'dumpster';
      case O.CASH: return rt === 'gas' ? 'gas' : 'office';
      default: return D.LOOT[rt] ? rt : 'crate';
    }
  }
  Loot.tableFor = tableFor;
  Loot.fill = function (cont, x, y, z, objId) {
    var rng = new U.Rng(U.hash2(x * 7 + z, y * 13 + objId, W.seed ^ 0x10075));
    var room = W.room(x, y, z), bld = W.building(x, y, z);
    var key = tableFor(objId, room, bld);
    var tb = D.LOOT[key];
    if (!tb) { return; }
    var mult = (CP.Game && CP.Game.settings && CP.Game.settings.lootMult) || 1;
    var n = rng.int(tb.n[0], tb.n[1]);
    n = Math.round(n * mult + (mult < 1 ? -rng.next() * 0.5 : 0));
    // garagem para estante em casa: só às vezes ferramentas
    for (var i = 0; i < n; i++) {
      var id = rng.weighted(tb.list);
      if (!D.ITEMS[id]) { continue; }
      var d = D.ITEMS[id];
      var opts = {};
      if (d.stack) { opts.n = id === 'nails' || id === 'screws' ? rng.int(5, 40) : (d.cat === 'ammo' ? rng.int(4, 24) : (d.cat === 'seed' ? rng.int(4, 12) : 1)); }
      var it = It.make(id, opts, rng);
      if (d.weapon && it.cond !== undefined) { it.cond = Math.max(1, Math.round(it.cond * rng.range(0.4, 1))); }
      if (d.gun) { it.ammo = rng.chance(0.4) ? rng.int(0, d.gun.mag) : 0; }
      if (d.drink && d.drink.uses > 1 && rng.chance(0.3)) { it.uses = rng.int(1, d.drink.uses); }
      if (id === 'gas_can') { it.fuel = rng.int(2, 10); }
      if (d.light) { it.charge = rng.range(0.3, 1); }
      Inv.addTo(cont.items, it);
    }
  };
  /* itens carregados por um zumbi (ao morrer) */
  Loot.zombie = function (zd, rng) {
    var out = [];
    var extras = [['wallet', 3], ['keyring', 2], ['cigarettes', 1.5], ['lighter', 1], ['photo', 1], ['candy', 1], ['watch', 1], ['bandage', 0.5], ['painkillers', 0.4], ['knife', 0.3], ['flashlight', 0.3], ['water_bottle', 0.5], ['ammo9', 0.2], ['car_key', 0.5]];
    var n = rng.chance(0.55) ? rng.int(1, 2) : 0;
    for (var i = 0; i < n; i++) { out.push(It.make(rng.weighted(extras), null, rng)); }
    (zd.outfit || []).forEach(function (o) {
      if (rng.chance(0.45) && D.ITEMS[o.id]) {
        var it = It.make(o.id, { color: o.color }, rng);
        it.blood = rng.range(0.3, 1); it.cond = rng.range(0.3, 0.9);
        out.push(it);
      }
    });
    if (zd.kind === 'police' && rng.chance(0.25)) { out.push(It.make('pistol', { ammo: rng.int(0, 8) }, rng)); }
    if (zd.kind === 'police' && rng.chance(0.4)) { out.push(It.make('nightstick', null, rng)); }
    if (zd.kind === 'doctor' && rng.chance(0.5)) { out.push(It.make(rng.pick(['bandage', 'painkillers', 'antibiotics', 'disinfectant']), null, rng)); }
    return out;
  };

  CP.Items = It;
})(window.CP = window.CP || {});
