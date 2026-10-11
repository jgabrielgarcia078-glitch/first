/* Uso de itens, artesanato (receitas), construção (carpintaria) e agricultura. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, D = CP.D;
  var O = C.OBJ, E = C.EDGE, F = C.FLOOR;

  var Use = {};
  var It, Inv, A;
  function init() { It = CP.Items; Inv = It.Inv; A = CP.Actions; }
  function msg(t, k) { if (CP.UI) { CP.UI.toast(t, k); } }

  /* ---------- opções de um item do inventário ---------- */
  Use.itemOptions = function (p, it, where) {
    init();
    var d = It.def(it);
    var out = [];
    var inMain = where === 'player';
    if (d.food) {
      var fs = It.freshState(it);
      if (d.food.canned) {
        var opener = Inv.findTag(p, 'canopener') || Inv.findTag(p, 'knife') || Inv.findTag(p, 'screwdriver');
        out.push({ label: 'Abrir lata', disabled: !opener, hint: 'Precisa de abridor de latas (ou faca)', fn: function () { openCan(p, it); } });
      } else if (d.food.needsCooking) {
        out.push({ label: 'Precisa cozinhar (panela com água)', disabled: true });
      } else {
        out.push({ label: 'Comer' + (fs === 'rotten' ? ' (podre!)' : ''), fn: function () { eat(p, it, 1); } });
        out.push({ label: 'Comer metade', fn: function () { eat(p, it, 0.5); } });
        if (d.food.cookable) { out.push({ label: 'Cozinhar (fogão/fogueira)', fn: function () { cook(p, it); } }); }
        if (Use.warmable(it) && !(it.warmUntil && CP.Game.state.time < it.warmUntil)) { out.push({ label: 'Esquentar (fogão/fogueira)', disabled: !Use.nearHeat(p), hint: 'Precisa de fogão ou fogueira por perto', fn: function () { Use.warm(p, it, null); } }); }
      }
    }
    if (d.drink) {
      out.push({ label: 'Beber', disabled: (it.uses || 0) <= 0, fn: function () { drink(p, it); } });
      if (d.drink.refill && it.uses > 0) { out.push({ label: 'Esvaziar', fn: function () { it.uses = 0; if (it.id === 'water_bottle' || it.id === 'water_dirty') { swapItem(p, it, 'bottle_empty'); } } }); }
      if (it.id === 'water_dirty' && Inv.findTag(p, 'pot')) { out.push({ label: 'Ferver (use a panela com água)', disabled: true }); }
    }
    if (d.med) { medOptions(p, it, d, out); }
    if (d.smoke) { out.push({ label: 'Fumar', disabled: !Inv.findTag(p, 'lighter'), hint: 'Precisa de isqueiro', fn: function () { smoke(p, it); } }); }
    if (d.book || d.leisure || d.recipe) { out.push({ label: 'Ler', disabled: !!p.fx.illiterate && !!d.book, hint: 'Você não sabe ler', fn: function () { read(p, it); } }); }
    if (d.weapon || d.gun || d.asWeapon || d.cat === 'tool' || d.bag && d.bag.slot === 'hand' || d.throwable || d.light) {
      if (p.hand1 !== it) { out.push({ label: 'Equipar (mão principal)', fn: function () { Use.equip(p, it, 'hand1'); } }); }
      if (p.hand2 !== it && !(d.weapon && d.weapon.twoHand)) { out.push({ label: 'Equipar (mão secundária)', fn: function () { Use.equip(p, it, 'hand2'); } }); }
      if (p.hand1 === it || p.hand2 === it) { out.push({ label: 'Desequipar', fn: function () { Use.unequip(p, it); } }); }
    }
    if (d.gun) { out.push({ label: 'Recarregar (R)', fn: function () { if (p.hand1 !== it) { Use.equip(p, it, 'hand1'); } CP.Combat.reload(p); } }); }
    if (d.cloth || (d.bag && d.bag.slot === 'back')) {
      if (Inv.isWorn(p, it)) { out.push({ label: 'Tirar', fn: function () { Use.takeOff(p, it); } }); } else { out.push({ label: 'Vestir', fn: function () { Use.wearItem(p, it); } }); }
    }
    if (d.cloth && !Inv.isWorn(p, it)) { out.push({ label: 'Rasgar em panos', fn: function () { rip(p, it); } }); }
    if (d.cloth && ((it.holes || 0) > 0 || (it.cond !== undefined && it.cond < 0.9))) {
      var hasKit = Inv.findTag(p, 'needle') && Inv.findTag(p, 'thread') && Inv.findId(p, 'rag');
      out.push({ label: 'Remendar (agulha, linha e pano)', disabled: !hasKit, hint: 'Precisa de agulha, linha e um pano', fn: function () { Use.patch(p, it); } });
    }
    if (d.light) { out.push({ label: p.flashlightOn ? 'Desligar lanterna (F)' : 'Ligar lanterna (F)', disabled: it.charge <= 0, hint: 'Sem pilha', fn: function () { Use.toggleFlashlight(p); } }); if (it.charge < 0.9 && Inv.findId(p, 'battery')) { out.push({ label: 'Trocar pilha', fn: function () { Inv.consume(p, 'battery', 1); it.charge = 1; msg('Pilha trocada.'); } }); } }
    if (d.radio && CP.Radio) { CP.Radio.itemOptions(p, it, out); }
    if (it.id === 'alarm_clock' && CP.Radio) { CP.Radio.alarmOptions(p, it, out); }
    if (d.throwable) { out.push({ label: 'Arremessar (no mouse)', fn: function () { Use.equip(p, it, 'hand1'); msg('Mire com o botão direito e clique com o esquerdo para arremessar.'); } }); }
    if (d.seed) { out.push({ label: 'Plantar (clique direito num canteiro)', disabled: true }); }
    if (d.flame) {
      var lt = Inv.findTag(p, 'lighter');
      if (!it.on) { out.push({ label: 'Acender', disabled: !lt || (it.burn !== undefined && it.burn <= 0), hint: !lt ? 'Precisa de fósforo ou isqueiro' : 'Acabou o combustível', fn: function () { if (lt.item.uses !== undefined) { lt.item.uses--; if (lt.item.uses <= 0) { Inv.detach(p, lt.item); } } if (it.burn === undefined) { it.burn = d.flame.hours; } it.on = true; if (p.hand1 !== it && p.hand2 !== it) { Use.equip(p, it, p.hand1 ? 'hand2' : 'hand1'); } CP.Game.updateLight(); msg(d.name + ' acesa.'); } }); } else { out.push({ label: 'Apagar', fn: function () { it.on = false; CP.Game.updateLight(); } }); }
      if (d.flame.refill) { var gas = Inv.findTag(p, 'gas'); out.push({ label: 'Encher com gasolina', disabled: !gas || (it.burn || 0) >= d.flame.hours - 0.2, hint: 'Precisa de galão com gasolina', fn: function () { gas.item.fuel = Math.max(0, gas.item.fuel - 0.3); it.burn = d.flame.hours; msg('Lampião cheio.'); } }); }
      out.push({ label: 'Combustível: ' + Math.round((it.burn !== undefined ? it.burn : d.flame.hours) / d.flame.hours * 100) + '%', disabled: true });
    }
    if (It.hasTag(it, 'blowtorch')) {
      var tank = Inv.find(p, function (o) { return It.def(o).gasTank && (o.gas === undefined || o.gas > 0.2); });
      out.push({ label: 'Encher com o botijão', disabled: !tank || (it.uses || 0) >= C.METAL.TORCH_USES, hint: !tank ? 'Precisa de botijão com gás' : 'Cheio', fn: function () { tank.item.gas = (tank.item.gas === undefined ? C.KITCHEN.TANK_H : tank.item.gas) - 1; it.uses = C.METAL.TORCH_USES; msg('Maçarico cheio.'); } });
    }
    if (d.ladder && CP.Surv) { CP.Surv.ladderItemOptions(p, it, out); }
    if (d.trap && CP.Surv) { out.push({ label: 'Armar armadilha aqui', fn: function () { CP.Surv.placeTrap(p, it); } }); }
    if (d.food && CP.Surv) { CP.Surv.dishOptions(p, it, out); }
    if (D.ITEMS[it.id].note) { out.push({ label: 'Ler bilhete', fn: function () { it.seen = true; if (CP.UI) { CP.UI.showNote(it.text, 'Bilhete'); } } }); }
    if (it.id === 'map') { out.push({ label: 'Ler mapa (revela a região)', fn: function () { readMap(p, it); } }); }
    if (it.id === 'generator_item') { out.push({ label: 'Instalar gerador aqui', fn: function () { placeGenerator(p, it); } }); }
    if (d.bag && it.items && it.items.length && !Inv.isWorn(p, it)) { out.push({ label: 'Esvaziar no chão', fn: function () { var fl = W.floorItems(Math.floor(p.x), Math.floor(p.y), W.levelOf(p.z), true); it.items.splice(0).forEach(function (x) { fl.push(x); }); } }); }
    out.push({ label: 'Largar no chão', fn: function () { Use.drop(p, it); } });
    return out;
  };

  /* remendar: fecha um buraco e recupera parte da proteção; gasta 1 pano e 1 uso de linha */
  Use.patch = function (p, it) {
    init();
    var lvl = CP.Player.skillLevel(p, 'tailoring');
    A.start(p, { name: 'Remendando', time: Math.max(2.5, 6 - lvl * 0.4), anim: 'work', onDone: function () {
      var th = Inv.findTag(p, 'thread');
      if (!Inv.findTag(p, 'needle') || !th || !Inv.consume(p, 'rag', 1)) { msg('Faltou material para remendar.', 'warn'); return; }
      if (th.item.uses !== undefined) { th.item.uses--; if (th.item.uses <= 0) { Inv.detach(p, th.item); msg('A linha acabou.'); } } else { Inv.detach(p, th.item); }
      if (it.holes) { it.holes--; }
      it.cond = Math.min(1, (it.cond === undefined ? 1 : it.cond) + 0.12 + lvl * 0.025);
      CP.Player.addXp(p, 'tailoring', 4);
      msg('Remendado: ' + It.def(it).name + (it.holes ? ' (ainda tem ' + it.holes + ' buraco' + (it.holes > 1 ? 's' : '') + ')' : '') + '.');
    } });
  };

  function swapItem(p, it, newId, opts) {
    Inv.detach(p, it);
    var n = It.make(newId, opts);
    Inv.give(p, n);
    return n;
  }

  /* ---------- equipar / vestir ---------- */
  Use.equip = function (p, it, hand) {
    init();
    var d = It.def(it);
    if (p.hand1 === it) { p.hand1 = null; }
    if (p.hand2 === it) { p.hand2 = null; }
    // tira da lista onde estava
    Inv.containers(p).forEach(function (c) { Inv.removeFrom(c.items, it); });
    var old = p[hand];
    if (old && old !== it) { Inv.give(p, old); }
    p[hand] = it;
    if (d.weapon && d.weapon.twoHand && hand === 'hand1') { if (p.hand2) { Inv.give(p, p.hand2); } p.hand2 = null; }
    if (CP.Audio) { CP.Audio.equip(); }
  };
  Use.unequip = function (p, it) {
    if (p.hand1 === it) { p.hand1 = null; }
    if (p.hand2 === it) { p.hand2 = null; }
    Inv.give(p, it);
    if (It.def(it).light) { p.flashlightOn = false; }
  };
  Use.wearItem = function (p, it) {
    init();
    var d = It.def(it);
    Inv.containers(p).forEach(function (c) { Inv.removeFrom(c.items, it); });
    if (p.hand1 === it) { p.hand1 = null; }
    if (p.hand2 === it) { p.hand2 = null; }
    A.start(p, { name: 'Vestindo', time: d.bag ? 0.8 : 2, onDone: function () {
      var old = CP.Player.wear(p, it);
      if (old) { Inv.give(p, old); }
      msg('Vestiu: ' + d.name);
    }, onCancel: function () { Inv.give(p, it); } });
  };
  Use.takeOff = function (p, it) {
    A.start(p, { name: 'Tirando', time: 1.5, onDone: function () {
      for (var s in p.worn) { if (p.worn[s] === it) { p.worn[s] = null; } }
      Inv.give(p, it);
    } });
  };
  Use.drop = function (p, it) {
    init();
    Inv.detach(p, it);
    if (It.def(it).light && !Inv.find(p, function (x) { return It.def(x).light; })) { p.flashlightOn = false; }
    W.floorItems(Math.floor(p.x), Math.floor(p.y), W.levelOf(p.z), true).push(it);
  };
  Use.toggleFlashlight = function (p) {
    init();
    var fl = Inv.find(p, function (it) { return It.def(it).light && it.charge > 0; });
    if (!fl) { msg('Você não tem lanterna com pilha.', 'warn'); p.flashlightOn = false; return; }
    p.flashlightOn = !p.flashlightOn;
    if (CP.Audio) { CP.Audio.click(); }
    CP.Game.updateLight();
  };

  /* ---------- comer / beber ---------- */
  function eat(p, it, portion) {
    var d = It.def(it);
    It.touch(it, 1);
    A.start(p, { name: 'Comendo', time: 3 * portion + 1, anim: 'eat', onDone: function () {
      var f = it.dish ? Object.assign({}, d.food, it.dish) : d.food, s = p.body.stats;
      var fs = It.freshState(it);
      var q = fs === 'rotten' ? 0.5 : (fs === 'stale' ? 0.8 : 1);
      var mult = (it.portion || 1) * portion;
      s.hunger = Math.max(0, s.hunger - f.hunger * q * mult);
      s.calories += f.cal * mult;
      s.thirst = U.clamp(s.thirst + (f.thirst || 0) * mult, 0, 1);
      s.unhappy = U.clamp(s.unhappy + (f.unhappy || 0) * mult + (fs === 'stale' ? 0.04 : 0), 0, 1);
      s.boredom = U.clamp(s.boredom + (f.boredom || 0) * mult, 0, 1);
      if (it.warmUntil && CP.Game.state.time < it.warmUntil) { s.unhappy = Math.max(0, s.unhappy - C.KITCHEN.WARM_HAPPY * mult); s.boredom = Math.max(0, s.boredom - C.KITCHEN.WARM_BORED * mult); } // comida quente
      if (s.hunger <= 0) { s.stuffed = Math.min(1, s.stuffed + 0.3); }
      var poison = (fs === 'rotten' ? 0.45 : 0) + (f.raw || it.hasRaw && f.dish !== 'stew' ? 0.3 : 0);
      if (poison && Math.random() < 0.75) { s.sick = Math.min(1, s.sick + poison * (p.fx.poisonMult || 1)); msg('Seu estômago não gostou disso...', 'warn'); }
      if (portion >= 1 || (it.portion || 1) <= 0.5) { Inv.detach(p, it); if (it.potBack) { Inv.give(p, It.make('pot')); } } else { it.portion = (it.portion || 1) - portion; }
    } });
  }
  Use.eat = eat;
  function drink(p, it) {
    var d = It.def(it);
    A.start(p, { name: 'Bebendo', time: 1.5, anim: 'eat', onDone: function () {
      var s = p.body.stats, dr = d.drink;
      s.thirst = Math.max(0, s.thirst - dr.thirst);
      s.unhappy = U.clamp(s.unhappy + (dr.unhappy || 0), 0, 1);
      s.calories += dr.cal || 0;
      if (dr.drunk) { s.drunk = Math.min(1, s.drunk + dr.drunk); s.panic = Math.max(0, s.panic - 20); s.stress = Math.max(0, s.stress - 0.1); }
      if (dr.dirty && Math.random() < 0.45) { s.sick = Math.min(1, s.sick + 0.3 * (p.fx.poisonMult || 1)); msg('A água suja te fez mal.', 'warn'); }
      it.uses = (it.uses || 1) - 1;
      if (it.uses <= 0) {
        if (dr.refill) { swapItem(p, it, 'bottle_empty'); } else if (it.id === 'beer') { swapItem(p, it, 'empty_beer'); } else { Inv.detach(p, it); }
      }
    } });
  }
  Use.drink = drink;
  function openCan(p, it) {
    var d = It.def(it);
    A.start(p, { name: 'Abrindo lata', time: 2.5, onDone: function () {
      var tool = Inv.findTag(p, 'canopener');
      if (!tool && Math.random() < 0.15) { CP.Body.addWound(p, 'handL', 'scratch', { cause: 'Cortou-se abrindo uma lata' }); }
      swapItem(p, it, d.food.opens, { age: 0 });
    } });
  }
  function cook(p, it) {
    if (!Use.nearHeat(p)) { msg('Precisa estar perto de um fogão (com energia ou botijão) ou de uma fogueira.', 'warn'); return; }
    var d = It.def(it);
    A.start(p, { name: 'Cozinhando', time: 8 * (1.2 - CP.Player.skillLevel(p, 'cooking') * 0.05), anim: 'work', onDone: function () {
      if (it.dish && CP.Surv) { Use.useHeat(p); var cooked = swapItem(p, it, d.food.cookable, { age: 0 }); cooked.warmUntil = CP.Game.state.time + C.KITCHEN.WARM_H * 3600; cooked.dish = CP.Surv.cookDish(it); cooked.ingr = it.ingr; cooked.potBack = true; CP.Player.addXp(p, 'cooking', 3 + it.ingr.length); msg('Pronto: ' + CP.Items.name(cooked)); return; }
      Use.useHeat(p);
      var KC = C.KITCHEN, burn = Math.max(KC.BURN_MIN, KC.BURN - CP.Player.skillLevel(p, 'cooking') * KC.BURN_PER_LVL);
      if (Math.random() < burn) { swapItem(p, it, 'burnt_food', { age: 0 }); CP.Player.addXp(p, 'cooking', 2); msg('Queimou! Ficou mais tempo no fogo do que devia.', 'warn'); return; }
      swapItem(p, it, d.food.cookable, { age: 0 }).warmUntil = CP.Game.state.time + KC.WARM_H * 3600;
      CP.Player.addXp(p, 'cooking', 5);
      msg('Pronto: ' + D.ITEMS[d.food.cookable].name);
    } });
  }
  /* gás do fogão (botijão instalado fica no recipiente do fogão) */
  Use.stoveGas = function (x, y, z) { var ch = W.chunkAt(x, y), c = ch && ch.containers[W.key(x, y, z)]; return c && c.gas > 0 ? c.gas : 0; };
  /* fonte de calor ao alcance: fogão com energia, fogão com botijão ou fogueira acesa */
  Use.heatSource = function (p) {
    var z = W.levelOf(p.z), best = null;
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        var x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy;
        var o = W.obj(x, y, z);
        if (o === O.STOVE && CP.Time.powerAt(x, y)) { return { x: x, y: y, z: z, kind: 'power' }; }
        if (o === O.STOVE && Use.stoveGas(x, y, z) > 0) { best = best || { x: x, y: y, z: z, kind: 'gas' }; }
        if (o === O.CAMPFIRE && !(W.odir(x, y, z) & 4)) { best = best || { x: x, y: y, z: z, kind: 'fire' }; }
      }
    }
    return best;
  };
  Use.nearHeat = function (p) { return !!Use.heatSource(p); };
  /* gasta o gás quando a chama é do botijão */
  Use.useHeat = function (p, mult) {
    var hs = Use.heatSource(p);
    if (!hs || hs.kind !== 'gas') { return; }
    var c = W.chunkAt(hs.x, hs.y).containers[W.key(hs.x, hs.y, hs.z)];
    c.gas = Math.max(0, c.gas - C.KITCHEN.GAS_PER_COOK * (mult || 1)); W.chunkAt(hs.x, hs.y).saveDirty = true;
    if (c.gas <= 0) { msg('O botijão do fogão acabou.', 'warn'); }
  };
  /* comida que dá para esquentar: lata aberta, prato cozido, assado */
  Use.warmable = function (it) {
    var d = It.def(it);
    if (!d || !d.food || d.food.raw || d.food.canned || d.food.needsCooking || it.cooked === false) { return false; }
    return /_open$|_cooked$/.test(it.id) || !!it.dish || it.id === 'soup' || it.id === 'stew';
  };
  Use.warm = function (p, it, micro) {
    var KC = C.KITCHEN;
    A.start(p, { name: micro ? 'Esquentando no micro-ondas' : 'Esquentando', time: micro ? 1.5 : 4, anim: 'work', onDone: function () {
      if (micro && /_open$/.test(it.id) && Math.random() < KC.SPARK) { // lata de metal no micro-ondas
        msg('Lata de metal no micro-ondas! Faíscas e fogo!', 'danger');
        if (CP.Fire) { CP.Fire.ignite(micro.x, micro.y, micro.z, true, 8); }
        CP.Zombies.noise(micro.x + 0.5, micro.y + 0.5, micro.z, 10, 'bang');
        return;
      }
      if (!micro) { Use.useHeat(p, 0.4); }
      it.warmUntil = CP.Game.state.time + KC.WARM_H * 3600;
      msg(It.name(it) + ' — pronto para comer.');
    } });
  };
  function smoke(p, it) {
    A.start(p, { name: 'Fumando', time: 5, onDone: function () {
      var s = p.body.stats;
      s.stress = Math.max(0, s.stress - 0.3); s.unhappy = Math.max(0, s.unhappy - 0.05); s.smokeT = 0;
      it.uses--; if (it.uses <= 0) { Inv.detach(p, it); }
    } });
  }

  /* ---------- remédios ---------- */
  function medOptions(p, it, d, out) {
    var m = d.med;
    if (m.type === 'pain' || m.type === 'antibiotic' || m.type === 'panic' || m.type === 'happy' || m.type === 'sleep' || m.type === 'flu') {
      out.push({ label: 'Tomar 1 comprimido', fn: function () {
        A.start(p, { name: 'Tomando remédio', time: 1.5, onDone: function () {
          CP.Body.takePill(p, m.type);
          it.uses--; if (it.uses <= 0) { Inv.detach(p, it); }
          msg('Você tomou ' + d.name.toLowerCase() + '.');
        } });
      } });
    }
    if (m.type === 'bandage' || m.type === 'disinfect' || m.type === 'suture' || m.type === 'tweezers' || m.type === 'splint') {
      out.push({ label: 'Usar (abre a Saúde — H)', fn: function () { if (CP.UI) { CP.UI.openHealth(); } } });
    }
  }
  /* ações de primeiros socorros (chamadas pelo painel de saúde) */
  Use.treat = function (p, partId, kind) {
    init();
    var B = CP.Body;
    var part = p.body.parts[partId];
    var name = D.PART[partId].name.toLowerCase();
    if (kind === 'bandage') {
      var bd = Inv.find(p, function (it) { return It.def(it).med && It.def(it).med.type === 'bandage'; });
      if (!bd) { msg('Sem bandagem ou pano.', 'warn'); return; }
      A.start(p, { name: 'Fazendo curativo', time: B.treatTime(p, 3), anim: 'work', onDone: function () { B.applyBandage(p, partId, bd.item); Inv.detach(p, bd.item); msg('Curativo no(a) ' + name + '.'); } });
    } else if (kind === 'unbandage') {
      A.start(p, { name: 'Tirando curativo', time: 1.5, onDone: function () { B.removeBandage(p, partId); } });
    } else if (kind === 'disinfect') {
      var ds = Inv.find(p, function (it) { return It.def(it).med && It.def(it).med.type === 'disinfect'; }) || Inv.findId(p, 'whiskey');
      if (!ds) { msg('Sem desinfetante.', 'warn'); return; }
      A.start(p, { name: 'Desinfetando', time: B.treatTime(p, 2), anim: 'work', onDone: function () { B.disinfect(p, partId); ds.item.uses = (ds.item.uses || 1) - 1; if (ds.item.uses <= 0) { Inv.detach(p, ds.item); } } });
    } else if (kind === 'stitch') {
      var needle = Inv.findId(p, 'suture_needle');
      var sew = Inv.findTag(p, 'needle') && Inv.findTag(p, 'thread');
      if (!needle && !sew) { msg('Precisa de agulha de sutura (ou agulha + linha).', 'warn'); return; }
      A.start(p, { name: 'Costurando ferimento', time: B.treatTime(p, 8), anim: 'work', onDone: function () {
        if (B.stitch(p, partId)) {
          if (needle) { needle.item.uses--; if (needle.item.uses <= 0) { Inv.detach(p, needle.item); } } else { Inv.consume(p, 'thread', 1); }
          msg('Ferimento costurado.');
        }
      } });
    } else if (kind === 'tweezers') {
      if (!Inv.findId(p, 'tweezers')) { msg('Precisa de uma pinça.', 'warn'); return; }
      A.start(p, { name: 'Removendo objeto', time: B.treatTime(p, 6), anim: 'work', onDone: function () { if (B.removeForeign(p, partId)) { msg('Removido. Agora faça um curativo.'); } } });
    } else if (kind === 'splint') {
      var sp = Inv.findId(p, 'splint');
      if (!sp) { msg('Precisa de uma tala.', 'warn'); return; }
      A.start(p, { name: 'Colocando tala', time: B.treatTime(p, 5), anim: 'work', onDone: function () { if (B.applySplint(p, partId)) { Inv.detach(p, sp.item); } } });
    }
    return part;
  };

  /* ---------- leitura ---------- */
  function read(p, it) {
    var d = It.def(it);
    var light = CP.Vis.lightAt(Math.floor(p.x), Math.floor(p.y), W.levelOf(p.z));
    if (light < 0.3 && !p.flashlightOn) { msg('Está escuro demais para ler.', 'warn'); return; }
    var pages = (d.book && d.book.pages) || (d.leisure && d.leisure.pages) || 40;
    var left = pages - (it.read || 0);
    if (d.book) {
      var key = d.book.skill + '_' + d.book.vol;
      var lv = CP.Player.skillLevel(p, d.book.skill);
      if (p.readBooks[key]) { msg('Você já leu este livro.'); return; }
      if (lv < (d.book.vol - 1) * 2) { msg('Este livro é avançado demais para você (precisa de nível ' + ((d.book.vol - 1) * 2) + ').', 'warn'); return; }
    }
    var spd = 0.45 * (p.fx.readSpeed || 1);
    A.start(p, { name: 'Lendo ' + d.name, time: left * spd, anim: 'read', onTick: function (pp, dt) {
      it.read = Math.min(pages, (it.read || 0) + dt / spd);
      var s = pp.body.stats;
      if (d.leisure) {
        s.boredom = Math.max(0, s.boredom + (d.leisure.boredom || 0) / pages * dt / spd);
        s.unhappy = U.clamp(s.unhappy + (d.leisure.unhappy || 0) / pages * dt / spd, 0, 1);
        if (d.leisure.stress) { s.stress = Math.max(0, s.stress + d.leisure.stress / pages * dt / spd); }
      } else { s.boredom = Math.max(0, s.boredom - 0.002 * dt); }
    }, onDone: function () {
      if (d.book) { p.readBooks[d.book.skill + '_' + d.book.vol] = true; msg('Terminou de ler. XP de ' + D.SKILL[d.book.skill].name + ' multiplicado (níveis ' + ((d.book.vol - 1) * 2) + '-' + ((d.book.vol - 1) * 2 + 1) + ').'); }
      if (d.recipe) { d.recipe.forEach(function (r) { if (p.knownRecipes.indexOf(r) < 0) { p.knownRecipes.push(r); } }); msg('Você aprendeu: ' + d.recipe.map(function (r) { return (D.RECIPE[r] || D.BUILDS.filter(function (b) { return b.recipe === r; })[0] || { name: r }).name; }).join(', ')); }
      if (d.leisure && !d.book && !d.recipe) { msg('Leitura terminada.'); }
      it.read = 0;
    } });
  }
  function readMap(p) {
    A.start(p, { name: 'Estudando o mapa', time: 4, onDone: function () { p.mapRevealed = true; msg('O mapa da região foi adicionado ao seu mapa (M).'); } });
  }
  function rip(p, it) {
    A.start(p, { name: 'Rasgando', time: 3, onDone: function () {
      Inv.detach(p, it);
      var n = Math.max(1, Math.round(It.def(it).w * 6));
      for (var i = 0; i < Math.min(4, n); i++) { Inv.give(p, It.make(it.blood > 0.3 ? 'rag' : 'rag')); }
      CP.Player.addXp(p, 'tailoring', 1);
    } });
  }
  function placeGenerator(p, it) {
    var x = Math.floor(p.x + Math.cos(p.ang)), y = Math.floor(p.y + Math.sin(p.ang)), z = W.levelOf(p.z);
    if (W.obj(x, y, z) || !W.tileWalkable(x, y, z)) { msg('Não há espaço na sua frente.', 'warn'); return; }
    A.start(p, { name: 'Instalando gerador', time: 4, onDone: function () {
      Inv.detach(p, it);
      W.lvl(x, y, z).obj[W.idx(x, y)] = O.GENERATOR;
      W.chunkAt(x, y).dirty = true;
      CP.Player.addXp(p, 'electrical', 3);
      msg('Gerador instalado. Abasteça e ligue (clique direito).');
    } });
  }

  /* ---------- arremessar ---------- */
  Use.throwItem = function (p, it, wx, wy) {
    init();
    var d = It.def(it);
    var dist = Math.min(9, U.dist(p.x, p.y, wx, wy));
    var a = Math.atan2(wy - p.y, wx - p.x);
    var tx = p.x + Math.cos(a) * dist, ty = p.y + Math.sin(a) * dist;
    if (p.hand1 === it) { p.hand1 = null; }
    Inv.detach(p, it);
    var z = W.levelOf(p.z);
    p.anim.attack = 0.3; p.attackDur = 0.5; p.swingWeapon = null;
    setTimeout(function () {
      CP.Zombies.noise(tx, ty, z, d.throwable.noise, 'throw');
      if (CP.Audio) { CP.Audio.glass(tx, ty); }
      if (d.throwable.fire) { Use.fire(Math.floor(tx), Math.floor(ty), z); }
      if (d.throwable.alarm) { CP.Time.triggerAlarm(tx, ty, z, 'clock'); }
      if (!d.throwable.fire && it.id !== 'empty_beer') { W.floorItems(Math.floor(tx), Math.floor(ty), z, true).push(it); }
    }, 400);
  };
  /* fogo (molotov): área 3x3 que se espalha — ver js/fire.js */
  Use.fire = function (x, y, z) { CP.Fire.burst(x, y, z); };
  Use.updateFires = function (dt) { CP.Fire.update(dt); };

  /* ================= ARTESANATO ================= */
  function catMatch(p, it, need) {
    var d = It.def(it);
    if (d.cat !== need.cat || Inv.isWorn(p, it)) { return false; }
    if (d.food && (d.food.canned || d.food.needsCooking)) { return false; }
    return !need.fresh || It.freshState(it) !== 'rotten';
  }
  function countFor(p, need) {
    if (need.item) { return Inv.count(p, need.item); }
    if (need.tag) { return Inv.all(p).filter(function (o) { return It.hasTag(o.item, need.tag) && (!need.fuel || (o.item.fuel || 0) >= need.fuel); }).length; }
    if (need.cat) { return Inv.all(p).filter(function (o) { return catMatch(p, o.item, need); }).length; }
    return 0;
  }
  Use.recipeStatus = function (p, r) {
    init();
    if (r.special) { return { ok: true, missing: [] }; }
    var missing = [];
    (r.needs || []).forEach(function (n) {
      var have = countFor(p, n);
      if (have < n.n) { missing.push((n.item ? D.ITEMS[n.item].name : (n.tag ? D.tagName(n.tag) : ({ food: 'ingrediente', clothing: 'roupa' }[n.cat] || n.cat))) + ' (' + have + '/' + n.n + ')'); }
    });
    if (r.learned && p.knownRecipes.indexOf(r.id) < 0) { missing.unshift('Receita desconhecida (leia a revista)'); }
    if (r.needsHeat && !Use.nearHeat(p)) { missing.push('Fonte de calor por perto'); }
    if (r.skill && CP.Player.skillLevel(p, r.skill[0]) < r.skill[1]) { missing.push(D.SKILL[r.skill[0]].name + ' ' + r.skill[1]); }
    return { ok: missing.length === 0, missing: missing };
  };
  Use.craft = function (p, r) {
    init();
    var stt = Use.recipeStatus(p, r);
    if (!stt.ok) { msg('Faltando: ' + stt.missing.join(', '), 'warn'); return; }
    A.start(p, { name: r.name, time: r.time, anim: 'work', onDone: function () {
      if (!Use.recipeStatus(p, r).ok) { msg('Faltou material.', 'warn'); return; }
      (r.needs || []).forEach(function (n) {
        if (n.keep) { return; }
        if (n.item) {
          if (n.uses) { var f = Inv.findId(p, n.item); f.item.uses -= n.uses; if (f.item.uses <= 0) { Inv.detach(p, f.item); } } else { Inv.consume(p, n.item, n.n); }
        } else if (n.tag && n.fuel) {
          var g = Inv.find(p, function (it) { return It.hasTag(it, n.tag) && (it.fuel || 0) >= n.fuel; });
          g.item.fuel -= n.fuel;
        } else if (n.cat) {
          var list = Inv.all(p).filter(function (o) { return catMatch(p, o.item, n); });
          for (var i = 0; i < n.n && i < list.length; i++) { Inv.detach(p, list[i].item); }
        } else if (n.tag) {
          var t = Inv.findTag(p, n.tag); Inv.detach(p, t.item);
        }
      });
      (r.out || []).forEach(function (o) { for (var i = 0; i < o.n; i++) { Inv.give(p, It.make(o.item, { age: 0 })); } });
      if (r.xp) { CP.Player.addXp(p, r.xp[0], r.xp[1]); }
      if (r.needsHeat) { Use.useHeat(p); }
      if (r.id === 'stew') { Inv.give(p, It.make('pot')); }
      msg('Feito: ' + r.name);
    } });
  };
  /* ferver água: panela com água no fogo */
  Use.boil = function (p) {
    init();
    var pot = Inv.findId(p, 'pot_water');
    if (!pot) { msg('Precisa de panela com água.', 'warn'); return; }
    if (!Use.nearHeat(p)) { msg('Precisa de fogão com energia ou fogueira.', 'warn'); return; }
    A.start(p, { name: 'Fervendo água', time: 8, onDone: function () {
      pot.item.dirty = false; Use.useHeat(p);
      // enche garrafas vazias com água limpa
      var n = 0;
      Inv.all(p).forEach(function (o) { if ((o.item.id === 'bottle_empty' || o.item.id === 'water_dirty') && n < 3) { swapItem(p, o.item, 'water_bottle'); n++; } });
      msg(n ? 'Água fervida: ' + n + ' garrafa(s) de água limpa.' : 'Água fervida na panela (beba direto ou encha garrafas).');
    } });
  };

  /* ================= CONSTRUÇÃO ================= */
  var Build = { mode: null };
  CP.Build = Build;
  Build.status = function (p, b) {
    init();
    var missing = [];
    b.mats.forEach(function (m) { var have = Inv.count(p, m.item); if (have < m.n) { missing.push(D.ITEMS[m.item].name + ' (' + have + '/' + m.n + ')'); } });
    if (b.tool && !Inv.findTag(p, b.tool)) { missing.push('Ferramenta: ' + D.tagName(b.tool)); }
    if (b.tool2 && !Inv.findTag(p, b.tool2)) { missing.push('Ferramenta: ' + D.tagName(b.tool2)); }
    if (b.torch) { var bt = Inv.findTag(p, 'blowtorch'); if (!bt || (bt.item.uses || 0) < b.torch) { missing.push('Gás do maçarico (' + (bt ? bt.item.uses || 0 : 0) + '/' + b.torch + ')'); } }
    var sk = b.skillId || 'carpentry';
    if (CP.Player.skillLevel(p, sk) < b.skill) { missing.push(D.SKILL[sk].name + ' ' + b.skill); }
    if (b.recipe && p.knownRecipes.indexOf(b.recipe) < 0) { missing.push('Projeto desconhecido (revista)'); }
    return { ok: missing.length === 0, missing: missing };
  };
  Build.start = function (b) { Build.mode = { def: b, side: 0 }; msg('Modo construção: clique para construir, R gira, Esc cancela.'); };
  Build.cancel = function () { Build.mode = null; };
  /* onde vai construir dado o ponto do mouse */
  Build.target = function (wx, wy) {
    var m = Build.mode;
    if (!m) { return null; }
    var x = Math.floor(wx), y = Math.floor(wy);
    if (m.def.kind === 'edge') {
      var side = m.side;
      return { x: x, y: y, side: side, kind: 'edge' };
    }
    return { x: x, y: y, kind: m.def.kind };
  };
  Build.valid = function (p, t) {
    var z = W.levelOf(p.z);
    var b = Build.mode.def;
    if (U.dist(p.x, p.y, t.x + 0.5, t.y + 0.5) > 3) { return 'Longe demais'; }
    if (t.kind === 'edge') {
      if (W.edgeType(t.x, t.y, z, t.side)) { return 'Já existe algo aqui'; }
      return '';
    }
    if (t.kind === 'floor') {
      if (z === 0) { return 'Piso só em andares de cima'; }
      if (W.floor(t.x, t.y, z)) { return 'Já tem piso'; }
      // precisa de piso vizinho
      var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { return W.floor(t.x + d[0], t.y + d[1], z); });
      return nb ? '' : 'Precisa estar ao lado de outro piso';
    }
    if (!W.tileWalkable(t.x, t.y, z) || W.obj(t.x, t.y, z)) { return 'Espaço ocupado'; }
    if (Math.floor(p.x) === t.x && Math.floor(p.y) === t.y) { return 'Você está no caminho'; }
    if (b.obj === 'CAMPFIRE' && W.isIndoor(t.x, t.y, z)) { return 'Fogueira só ao ar livre'; }
    return '';
  };
  Build.place = function (p, wx, wy) {
    var t = Build.target(wx, wy);
    if (!t) { return; }
    var err = Build.valid(p, t);
    var b = Build.mode.def;
    if (err) { msg(err, 'warn'); return; }
    var stt = Build.status(p, b);
    if (!stt.ok) { msg('Faltando: ' + stt.missing.join(', '), 'warn'); return; }
    var z = W.levelOf(p.z);
    var skId = b.skillId || 'carpentry';
    A.start(p, { name: 'Construindo ' + b.name.toLowerCase(), time: b.time * (1.3 - CP.Player.skillLevel(p, skId) * 0.05), anim: 'work', noise: { r: C.NOISE.BUILD, every: 1.2, sound: b.torch ? null : 'hammer' }, onDone: function () {
      if (!Build.status(p, b).ok) { msg('Faltou material.', 'warn'); return; }
      b.mats.forEach(function (m) { Inv.consume(p, m.item, m.n); });
      if (b.torch) { var bt = Inv.findTag(p, 'blowtorch'); bt.item.uses -= b.torch; }
      if (t.kind === 'edge') {
        var type = E[b.edge];
        W.setEdge(t.x, t.y, z, t.side, type, b.style || 10);
        if (type === E.DOOR) { W.setEdgeState(t.x, t.y, z, t.side, { open: false, locked: false, hp: b.hp || 30, bar: 0, barHp: 0, broken: false, ext: true, built: true, metal: !!b.torch }); }
        if (type === E.WALL) { W.setEdgeState(t.x, t.y, z, t.side, { hp: b.hp || 40, built: true, metal: !!b.torch }); }
      } else if (t.kind === 'floor') {
        var l = W.lvl(t.x, t.y, z); l.floor[W.idx(t.x, t.y)] = F.WOOD; W.chunkAt(t.x, t.y).dirty = true; W.chunkAt(t.x, t.y)._roof = null;
      } else {
        var lv = W.lvl(t.x, t.y, z); lv.obj[W.idx(t.x, t.y)] = O[b.obj]; lv.odir[W.idx(t.x, t.y)] = 0; W.chunkAt(t.x, t.y).dirty = true;
        if (b.obj === 'CRATE' || b.obj === 'WORKBENCH') { var c = W.chunkAt(t.x, t.y); c.containers[W.key(t.x, t.y, z)] = { items: [], gen: true }; }
        if (b.obj === 'RAIN_BARREL') { (CP.Game.state.world.rainBarrels = CP.Game.state.world.rainBarrels || []).push({ x: t.x, y: t.y, z: z, water: 0 }); }
      }
      CP.Player.addXp(p, skId, b.xp);
      CP.Game.updateFov(true);
      msg('Construído: ' + b.name);
    } });
  };

  /* ================= AGRICULTURA ================= */
  var Farm = {};
  CP.Farm = Farm;
  var CROPS = { carrot: { name: 'Cenoura', item: 'carrot' }, potato: { name: 'Batata', item: 'potato' }, tomato: { name: 'Tomate', item: 'tomato' }, cabbage: { name: 'Repolho', item: 'cabbage' } };
  Farm.tileOptions = function (p, x, y, z, out) {
    init();
    if (z !== 0 || U.dist(p.x, p.y, x + 0.5, y + 0.5) > 1.8 || W.isIndoor(x, y, z)) { return; }
    var f = W.floor(x, y, z);
    var o = W.obj(x, y, z);
    if ((f === F.GRASS || f === F.DIRT || f === F.DARKGRASS || f === F.FIELD || f === F.FARM) && !o) {
      var tool = Inv.findTag(p, 'shovel') || Inv.findTag(p, 'trowel');
      out.push({ label: 'Cavar canteiro', disabled: !tool, hint: 'Precisa de pá ou pá de jardim', fn: function () {
        A.start(p, { name: 'Cavando canteiro', time: 5, anim: 'work', onDone: function () { var l = W.lvl(x, y, z); l.floor[W.idx(x, y)] = F.FURROW; l.fvar[W.idx(x, y)] = 0; W.chunkAt(x, y).dirty = true; CP.Player.addXp(p, 'farming', 1); } });
      } });
    }
    if (f === F.FURROW && !o) {
      Inv.all(p).filter(function (q) { return It.def(q.item).seed; }).forEach(function (q) {
        var sd = It.def(q.item).seed;
        out.push({ label: 'Plantar ' + CROPS[sd.crop].name.toLowerCase(), fn: function () {
          A.start(p, { name: 'Plantando', time: 3, anim: 'work', onDone: function () {
            if (W.obj(x, y, z)) { return; }
            Inv.consume(p, q.item.id, 1);
            W.lvl(x, y, z).obj[W.idx(x, y)] = O.CROP;
            W.chunkAt(x, y).crops[W.key(x, y, z)] = { crop: sd.crop, days: sd.days, yield: sd.yield, grow: 0, water: 0.5, stage: 0, rot: 0 };
            W.chunkAt(x, y).dirty = true;
            CP.Player.addXp(p, 'farming', 2);
          } });
        } });
      });
    }
  };
  Farm.cropOptions = function (p, x, y, z, out) {
    var ch = W.chunkAt(x, y);
    var c = ch.crops[W.key(x, y, z)];
    if (!c) { return; }
    var stages = ['Semente', 'Brotando', 'Crescendo', 'Quase pronto', 'Pronto para colher', 'Podre'];
    out.push({ label: CROPS[c.crop].name + ': ' + stages[c.stage] + ' · água ' + Math.round(c.water * 100) + '%', disabled: true });
    var water = Inv.find(p, function (it) { return (it.id === 'watering_can' && it.water > 0) || ((it.id === 'water_bottle' || it.id === 'water_dirty') && it.uses > 0); });
    out.push({ label: 'Regar', disabled: !water, hint: 'Precisa de regador ou garrafa com água', fn: function () {
      A.start(p, { name: 'Regando', time: 2, onDone: function () {
        c.water = Math.min(1, c.water + 0.5);
        if (water.item.id === 'watering_can') { water.item.water = Math.max(0, water.item.water - 1); } else { water.item.uses--; if (water.item.uses <= 0) { swapItem(p, water.item, 'bottle_empty'); } }
        CP.Player.addXp(p, 'farming', 0.5);
      } });
    } });
    if (c.stage >= 4) {
      out.push({ label: c.stage === 5 ? 'Arrancar planta podre' : 'Colher', fn: function () {
        A.start(p, { name: 'Colhendo', time: 3, anim: 'work', onDone: function () {
          if (c.stage === 4) {
            var n = U.randInt(c.yield[0], c.yield[1]) + Math.floor(CP.Player.skillLevel(p, 'farming') / 3);
            for (var i = 0; i < n; i++) { Inv.give(p, It.make(CROPS[c.crop].item, { age: 0 })); }
            if (Math.random() < 0.5) { Inv.give(p, It.make('seeds_' + c.crop, { n: U.randInt(1, 3) })); }
            CP.Player.addXp(p, 'farming', 8);
            msg('Colheu ' + n + ' ' + CROPS[c.crop].name.toLowerCase() + '(s).');
          }
          W.lvl(x, y, z).obj[W.idx(x, y)] = 0;
          delete ch.crops[W.key(x, y, z)];
          ch.dirty = true;
        } });
      } });
    }
  };
  /* crescimento por hora (em todos os chunks carregados) */
  Farm.hourly = function () {
    var T = CP.Time;
    var temp = T.temperature(true);
    var rain = T.raining() ? T.rainIntensity() * 0.15 : 0;
    var all = W.allChunks();
    for (var i = 0; i < all.length; i++) {
      var ch = all[i];
      for (var k in ch.crops) {
        var c = ch.crops[k];
        c.water = U.clamp(c.water - (temp > 25 ? 0.025 : 0.015) + rain, 0, 1);
        if (c.stage < 4 && c.water > 0.15 && temp > 4 && temp < 36) {
          c.grow += 1 / 24 * (c.water > 0.4 ? 1 : 0.5);
          c.stage = Math.min(4, Math.floor(c.grow / c.days * 4));
        } else if (c.stage === 4) {
          c.rot += 1 / 24;
          if (c.rot > 5) { c.stage = 5; }
        }
        if (c.water <= 0 && c.stage < 4) { c.dry = (c.dry || 0) + 1; if (c.dry > 72) { c.stage = 5; } } else { c.dry = 0; }
      }
    }
  };

  CP.Use = Use;
})(window.CP = window.CP || {});
