/* Veículos: carros do mapa viram entidades dirigíveis (chave/ligação direta, combustível, dano, atropelar, porta-malas). */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, D = CP.D;
  var O = C.OBJ;
  var HW = C.TILE_W / 2, HH = C.TILE_H / 2;

  var V = {
    HALF_L: 0.98, HALF_W: 0.42,           // meia-largura/comprimento (tiles)
    MAX_FWD: 13, MAX_REV: 4, ACCEL: 5, BRAKE: 9, DRAG: 1.2, STEER: 2.1,
    FUEL_MAX: 40, FUEL_PER_TILE: 0.018,
    active: [], nextId: 1
  };
  var CAR_COLORS = ['#8c2b2b', '#2b4c8c', '#d8d4c8', '#2e2e30', '#5b7b4a', '#b8862f', '#6a6a70', '#7a3f6e', '#c9c2a4', '#3c6d73', '#a14a24', '#425066'];
  V.COLORS = CAR_COLORS;
  /* modelos: forma da lataria, cor fixa (viatura/ambulância), giroflex e o que pode ter no porta-malas */
  CAR_COLORS.push('#e8e6e0', '#1c1c20');
  var MODELS = {
    sedan: { name: 'Sedã', w: 52 },
    pickup: { name: 'Picape', w: 20, trunk: ['plank', 'rope', 'wrench', 'gas_can_empty'] },
    van: { name: 'Van', w: 13, trunk: ['crate_item', 'tote', 'water_bottle'] },
    police: { name: 'Viatura', w: 8, color: CAR_COLORS.length - 1, bar: true, trunk: ['nightstick', 'shells', 'ammo9', 'flashlight', 'bandage'] },
    ambulance: { name: 'Ambulância', w: 7, color: CAR_COLORS.length - 2, bar: true, trunk: ['bandage', 'disinfectant', 'painkillers', 'first_aid_kit', 'suture_needle', 'splint'] },
    trailer: { name: 'Reboque', w: 0, trunk: ['plank', 'log', 'scrap', 'garbage_bag'] }
  };
  V.MODELS = MODELS;
  function pickModel(rng) {
    var tot = 0, k;
    for (k in MODELS) { tot += MODELS[k].w; }
    var r = rng.next() * tot;
    for (k in MODELS) { if (!MODELS[k].w) { continue; } r -= MODELS[k].w; if (r <= 0) { return k; } }
    return 'sedan';
  }
  V.modelOf = function (car) { return MODELS[car.model] ? car.model : 'sedan'; };
  V.modelName = function (car) { return MODELS[V.modelOf(car)].name; };

  /* ---------- conversão dos objetos CAR do mapa em entidades ---------- */
  V.activateChunk = function (ch) {
    if (!ch.cars) { ch.cars = []; }
    if (!ch.carsConverted) {
      ch.carsConverted = true;
      var rng = new U.Rng(U.hash2(ch.cx, ch.cy, W.seed ^ 0xca5));
      for (var z = 0; z < 1; z++) {
        var L = ch.levels[z];
        for (var i = 0; i < L.obj.length; i++) {
          if (L.obj[i] !== O.CAR || !(L.odir[i] & 2)) { continue; }
          var lx = i % C.CHUNK, ly = (i / C.CHUNK) | 0;
          var x = ch.cx * C.CHUNK + lx, y = ch.cy * C.CHUNK + ly;
          var horiz = (L.odir[i] & 1) === 0;
          var color = (L.odir[i] >> 2) % CAR_COLORS.length;
          // a parte da frente fica em (x,y); a de trás em x-1 (horizontal) ou y-1 (vertical)
          var car = {
            id: V.nextId++ + '_' + ch.cx + '_' + ch.cy + '_' + i,
            x: horiz ? x : x + 0.5, y: horiz ? y + 0.5 : y, z: 0,
            ang: horiz ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
            color: color, speed: 0, steer: 0,
            fuel: rng.chance(0.25) ? 0 : rng.range(2, 22), cond: rng.range(0.35, 1),
            keyIn: rng.chance(0.25), keyFits: rng.chance(0.35), locked: rng.chance(0.6), alarm: rng.chance(0.3),
            engine: false, broken: false, trunk: null, hornT: 0
          };
          car.model = pickModel(rng);
          if (MODELS[car.model].color !== undefined) { car.color = MODELS[car.model].color; }
          // porta-malas: aproveita o loot já gerado do objeto (se o jogador abriu) ou gera agora
          var key = W.key(x, y, 0);
          var cont = ch.containers[key];
          if (!cont || !cont.gen) { cont = { items: [], gen: true }; if (CP.Loot) { CP.Loot.fill(cont, x, y, 0, O.CAR); } }
          car.trunk = cont.items;
          (MODELS[car.model].trunk || []).forEach(function (id) { if (rng.chance(0.45) && D.ITEMS[id]) { car.trunk.push(CP.Items.make(id, null, rng)); } });
          delete ch.containers[key];
          L.obj[i] = 0; L.odir[i] = 0;
          // algumas picapes têm um reboque atrás (sorteio à parte: não muda os outros carros)
          var trng = new U.Rng(U.hash2(x, y, W.seed ^ 0x7a11e));
          if (car.model === 'pickup' && trng.chance(C.TRAILER.CHANCE)) {
            var tc = Math.cos(car.ang), ts = Math.sin(car.ang), tl = V.HALF_L * 2 + C.TRAILER.TONGUE;
            var trx = car.x - tc * tl, trY = car.y - ts * tl;
            if (W.tileWalkable(Math.floor(trx), Math.floor(trY), 0) && !W.isIndoor(Math.floor(trx), Math.floor(trY), 0) && !W.blockedBetween(Math.floor(car.x), Math.floor(car.y), Math.floor(trx), Math.floor(trY), 0, false)) {
              var trl = { id: 'tr' + car.id, x: trx, y: trY, z: 0, ang: car.ang, color: trng.int(0, 11), speed: 0, steer: 0, fuel: 0, cond: 1, model: 'trailer', trailer: true, locked: false, engine: false, broken: false, hornT: 0, trunk: [] };
              MODELS.trailer.trunk.forEach(function (id) { if (trng.chance(0.4)) { trl.trunk.push(CP.Items.make(id, null, trng)); } });
              trl.parts = { engine: 1, battery: 0, tireFL: 1, tireFR: 1, tireRL: 1, tireRR: 1, windshield: null };
              ch.cars.push(trl);
            }
          }
          var bx = horiz ? x - 1 : x, by = horiz ? y : y - 1;
          var bi = W.idx(bx, by);
          var bch = W.chunkAt(bx, by);
          if (bch && bch.levels[0].obj[bi] === O.CAR) { bch.levels[0].obj[bi] = 0; bch.levels[0].odir[bi] = 0; }
          ch.cars.push(car);
        }
      }
      ch.dirty = true;
    }
    for (var k = 0; k < ch.cars.length; k++) {
      var c = ch.cars[k];
      if (V.active.indexOf(c) < 0) { c.draw = drawCar; c.kind = 'car'; V.active.push(c); }
    }
  };
  V.deactivateChunk = function (ch) {
    if (!ch.cars) { return; }
    var p = CP.Game.player;
    for (var k = 0; k < ch.cars.length; k++) {
      var i = V.active.indexOf(ch.cars[k]);
      if (i >= 0 && ch.cars[k] !== p.vehicle && !(p.vehicle && p.vehicle.towId === ch.cars[k].id)) { V.active.splice(i, 1); }
    }
  };
  V.reset = function () { V.active.length = 0; };
  /* mantém o carro na lista do chunk onde ele está */
  function rehome(car) {
    var ch = W.chunkAt(Math.floor(car.x), Math.floor(car.y));
    if (!ch) { return; }
    if (!ch.cars) { ch.cars = []; }
    if (ch.cars.indexOf(car) >= 0) { return; }
    W.allChunks().forEach(function (o) { if (o.cars) { var i = o.cars.indexOf(car); if (i >= 0) { o.cars.splice(i, 1); o.saveDirty = true; } } });
    ch.cars.push(car);
    ch.saveDirty = true;
  }

  /* ---------- peças ---------- */
  /* motor (0..1), bateria (carga 0..1), pneus (0 = furado, null = sem), para-brisa (0..1, null = sem) */
  V.PARTS = ['engine', 'battery', 'tireFL', 'tireFR', 'tireRL', 'tireRR', 'windshield'];
  V.PART_NAMES = { engine: 'Motor', battery: 'Bateria', tireFL: 'Pneu dianteiro esquerdo', tireFR: 'Pneu dianteiro direito', tireRL: 'Pneu traseiro esquerdo', tireRR: 'Pneu traseiro direito', windshield: 'Para-brisa' };
  V.PART_ITEM = { battery: 'car_battery', tireFL: 'car_tire', tireFR: 'car_tire', tireRL: 'car_tire', tireRR: 'car_tire', windshield: 'windshield' };
  var TIRES = ['tireFL', 'tireFR', 'tireRL', 'tireRR'];
  V.parts = function (car) {
    if (car.parts) { return car.parts; }
    var rng = new U.Rng(U.hashStr(String(car.id)) ^ 0x9a17);
    var c = car.cond === undefined ? 0.7 : car.cond;
    var pt = { engine: U.clamp(c * rng.range(0.75, 1.1), 0.05, 1), battery: rng.chance(0.3) ? rng.range(0, 0.12) : rng.range(0.35, 1), windshield: rng.range(0.55, 1) };
    TIRES.forEach(function (t) { pt[t] = rng.chance(0.12) ? 0 : rng.range(0.4, 1); });
    car.parts = pt;
    return pt;
  };
  /* estado geral (para mostrar e para o resto do jogo) a partir das peças */
  V.syncCond = function (car) {
    var pt = V.parts(car), tsum = 0;
    TIRES.forEach(function (t) { tsum += pt[t] || 0; });
    car.cond = U.clamp(pt.engine * 0.5 + tsum / 4 * 0.25 + (pt.windshield || 0) * 0.25, 0, 1);
    car.broken = pt.engine <= 0.02;
    return car.cond;
  };
  V.flatTires = function (car) { var pt = V.parts(car), n = 0; TIRES.forEach(function (t) { if (!pt[t] || pt[t] <= 0.05) { n++; } }); return n; };
  function damageParts(car, impact) {
    var pt = V.parts(car);
    if (car.armor) { impact *= C.METAL.CAR_DMG; } // chapas soldadas protegem
    pt.engine = Math.max(0, pt.engine - impact * 0.009);
    if (pt.windshield) { pt.windshield = Math.max(0, pt.windshield - impact * 0.012); }
    if (Math.random() < impact * 0.03) { var t = U.pick(TIRES); if (pt[t]) { pt[t] = Math.max(0, pt[t] - U.randRange(0.2, 0.7)); } }
    V.syncCond(car);
  }

  /* ---------- geometria ---------- */
  function corners(car, x, y, ang, grow) {
    var g = grow || 0;
    var c = Math.cos(ang), s = Math.sin(ang);
    var L = V.HALF_L + g, Wd = V.HALF_W + g;
    return [
      [x + c * L - s * Wd, y + s * L + c * Wd], [x + c * L + s * Wd, y + s * L - c * Wd],
      [x - c * L + s * Wd, y - s * L - c * Wd], [x - c * L - s * Wd, y - s * L + c * Wd]
    ];
  }
  /* segmentos dos carros perto de (cx,cy) para a colisão de círculos (world.moveCircle) */
  V.addBlockers = function (addSeg, cx, cy, z, ignore) {
    for (var i = 0; i < V.active.length; i++) {
      var car = V.active[i];
      if (car === ignore || (ignore && ignore.towId && car.id === ignore.towId) || Math.abs(car.z - z) > 0.4) { continue; }
      if (Math.abs(car.x - cx) > 3 || Math.abs(car.y - cy) > 3) { continue; }
      var k = corners(car, car.x, car.y, car.ang, 0);
      addSeg(k[0][0], k[0][1], k[1][0], k[1][1]); addSeg(k[1][0], k[1][1], k[2][0], k[2][1]);
      addSeg(k[2][0], k[2][1], k[3][0], k[3][1]); addSeg(k[3][0], k[3][1], k[0][0], k[0][1]);
    }
  };
  /* ponto dentro do retângulo do carro? */
  function inside(car, px, py, grow) {
    var c = Math.cos(car.ang), s = Math.sin(car.ang);
    var dx = px - car.x, dy = py - car.y;
    var a = dx * c + dy * s, b = -dx * s + dy * c;
    return Math.abs(a) <= V.HALF_L + (grow || 0) && Math.abs(b) <= V.HALF_W + (grow || 0);
  }
  V.carAt = function (x, y, grow) {
    for (var i = 0; i < V.active.length; i++) { if (inside(V.active[i], x, y, grow || 0)) { return V.active[i]; } }
    return null;
  };
  /* o carro nessa posição bate em parede/objeto/outro carro? (3 círculos ao longo do eixo) */
  var tmp = { x: 0, y: 0, z: 0 };
  function collides(car, x, y, ang) {
    var c = Math.cos(ang), s = Math.sin(ang);
    var pts = [-0.6, 0, 0.6];
    for (var i = 0; i < 3; i++) {
      tmp.x = x + c * pts[i]; tmp.y = y + s * pts[i]; tmp.z = 0;
      var ox = tmp.x, oy = tmp.y;
      W.moveCircle(tmp, 0, 0, 0.42, car);
      if (Math.abs(tmp.x - ox) > 0.01 || Math.abs(tmp.y - oy) > 0.01) { return true; }
      var tx = Math.floor(ox), ty = Math.floor(oy);
      if (W.isIndoor(tx, ty, 0)) { return true; }
    }
    return false;
  }

  /* ---------- dirigir ---------- */
  V.drive = function (p, dt) {
    var car = p.vehicle;
    var In = CP.Input;
    var up = In.isDown('KeyW') || In.isDown('ArrowUp'), dn = In.isDown('KeyS') || In.isDown('ArrowDown');
    var lf = In.isDown('KeyA') || In.isDown('ArrowLeft'), rt = In.isDown('KeyD') || In.isDown('ArrowRight');
    if (In.blockGame) { up = dn = lf = rt = false; }
    var pt = V.parts(car);
    var running = car.engine && car.fuel > 0 && !car.broken && pt.engine > 0.02;
    if (car.engine && pt.engine <= 0.02) { car.engine = false; if (CP.UI) { CP.UI.toast('O motor morreu.', 'danger'); } }
    var flat = V.flatTires(car);
    var maxF = (car.towId ? C.TRAILER.SPEED_MULT : 1) * V.MAX_FWD * (0.45 + pt.engine * 0.55) * (flat ? Math.max(0.35, 1 - flat * 0.25) : 1) * (car.armor ? C.METAL.CAR_SPEED : 1);
    if (running) { pt.battery = Math.min(1, (pt.battery || 0) + dt * 0.004); }
    if (running && up) { car.speed = Math.min(maxF, car.speed + V.ACCEL * dt * (car.speed < 0 ? 2 : 1)); } else if (running && dn) { car.speed = car.speed > 0.2 ? car.speed - V.BRAKE * dt : Math.max(-V.MAX_REV, car.speed - V.ACCEL * 0.6 * dt); } else {
      var dr = V.DRAG * dt * (Math.abs(car.speed) > 0.1 ? 1 : 3);
      car.speed = car.speed > 0 ? Math.max(0, car.speed - dr) : Math.min(0, car.speed + dr);
    }
    if (In.isDown('Space')) { car.speed = car.speed > 0 ? Math.max(0, car.speed - V.BRAKE * 1.5 * dt) : Math.min(0, car.speed + V.BRAKE * 1.5 * dt); }
    // direção relativa ao carro (como no PZ): A/D giram
    var steerIn = (rt ? 1 : 0) - (lf ? 1 : 0);
    car.steer += (steerIn - car.steer) * Math.min(1, dt * 6);
    var turn = car.steer * V.STEER * dt * U.clamp(Math.abs(car.speed) / 4, 0, 1) * (car.speed >= 0 ? 1 : -1);
    // pneu furado puxa o carro para o lado dele
    var pull = ((!pt.tireFL || pt.tireFL <= 0.05) + (!pt.tireRL || pt.tireRL <= 0.05) - (!pt.tireFR || pt.tireFR <= 0.05) - (!pt.tireRR || pt.tireRR <= 0.05));
    if (pull) { turn -= pull * 0.25 * dt * U.clamp(Math.abs(car.speed) / 6, 0, 1); }
    var nang = car.ang + turn;
    var dist = car.speed * dt;
    var nx = car.x + Math.cos(nang) * dist, ny = car.y + Math.sin(nang) * dist;
    if (Math.abs(dist) > 0 || turn) {
      if (!collides(car, nx, ny, nang)) {
        car.x = nx; car.y = ny; car.ang = nang;
        if (car.towId) { V.towFollow(car); }
        car.fuel = Math.max(0, car.fuel - Math.abs(dist) * V.FUEL_PER_TILE * (car.towId ? C.TRAILER.FUEL_MULT : 1));
        if (car.fuel <= 0 && car.engine) { car.engine = false; if (CP.UI) { CP.UI.toast('Acabou a gasolina!', 'warn'); } }
      } else {
        // batida
        var impact = Math.abs(car.speed);
        if (impact > 4) {
          damageParts(car, impact);
          if (CP.Audio) { CP.Audio.thump(car.x, car.y, 0, true); }
          CP.Zombies.noise(car.x, car.y, 0, 20, 'crash');
          if (impact > 9) {
            CP.Body.addWound(p, U.pick(['head', 'torso', 'farmL', 'farmR']), impact > 11 ? 'deep' : 'laceration', { cause: 'Morreu num acidente de carro' });
            if (CP.UI) { CP.UI.toast('Batida forte!', 'danger'); }
          }
          if (car.broken && car.engine) { car.engine = false; if (CP.UI) { CP.UI.toast('O motor quebrou.', 'danger'); } }
        }
        car.speed = -car.speed * 0.25;
      }
    }
    // atropelar zumbis
    if (Math.abs(car.speed) > 2) {
      var zs = CP.Zombies.near(car.x, car.y, 1.6, []);
      for (var i = 0; i < zs.length; i++) {
        var zb = zs[i];
        if (zb.state === 'dead' || !inside(car, zb.x, zb.y, 0.3)) { continue; }
        var sp = Math.abs(car.speed);
        var killed = CP.Zombies.damage(zb, sp * 0.22, car.ang, { knockdown: true, knock: sp * 0.15, cause: 'car' });
        damageParts(car, sp * 0.35);
        car.speed *= killed ? 0.92 : 0.8;
        if (CP.Audio) { CP.Audio.hit('blunt_long', killed, zb.x, zb.y, zb.z); }
      }
    }
    // barulho do motor
    if (car.engine) {
      car.noiseT = (car.noiseT || 0) - dt;
      if (car.noiseT <= 0) { car.noiseT = 1; CP.Zombies.noise(car.x, car.y, 0, 14 + Math.abs(car.speed) * 1.5, 'engine'); }
      car.farT = (car.farT || 0) - dt;
      if (car.farT <= 0) { car.farT = C.ZSMART.ENGINE_EVERY; CP.Zombies.farNoise(car.x, car.y, C.ZSMART.ENGINE_FAR, C.ZSMART.ENGINE_CHANCE); } // motor se ouve de longe
      if (CP.Audio && CP.Audio.engine) { CP.Audio.engine(Math.abs(car.speed) / V.MAX_FWD); }
    }
    // jogador acompanha o carro
    p.x = car.x; p.y = car.y; p.z = 0; p.ang = car.ang;
    p.moving = Math.abs(car.speed) > 0.1;
    rehome(car);
  };

  /* ---------- reboque ---------- */
  V.byId = function (id) { for (var i = 0; i < V.active.length; i++) { if (V.active[i].id === id) { return V.active[i]; } } return null; };
  /* ponto de engate: atrás do para-choque */
  function hitchPoint(car) { var c = Math.cos(car.ang), s = Math.sin(car.ang); return { x: car.x - c * (V.HALF_L + 0.12), y: car.y - s * (V.HALF_L + 0.12) }; }
  /* o reboque vai atrás do engate (a lança aponta para ele) */
  V.towFollow = function (car) {
    var t = V.byId(car.towId);
    if (!t) { car.towId = null; return; }
    var h = hitchPoint(car), a = Math.atan2(h.y - t.y, h.x - t.x), L = V.HALF_L + C.TRAILER.TONGUE;
    t.ang = a; t.x = h.x - Math.cos(a) * L; t.y = h.y - Math.sin(a) * L; t.speed = car.speed;
    rehome(t);
  };
  V.trailerOptions = function (p, t, out) {
    out.push({ label: 'Reboque' + (t.towBy ? ' (engatado)' : ''), disabled: true });
    out.push({ label: 'Abrir a caçamba', key: 'E', fn: function () { if (CP.UI) { CP.UI.openCar(t); } } });
    if (t.towBy) {
      out.push({ label: 'Desengatar o reboque', fn: function () { var c = V.byId(t.towBy); if (c) { c.towId = null; } t.towBy = null; t.speed = 0; if (CP.UI) { CP.UI.toast('Reboque desengatado.'); } } });
      return;
    }
    // carro com a traseira perto da lança
    var tip = { x: t.x + Math.cos(t.ang) * (V.HALF_L + C.TRAILER.TONGUE), y: t.y + Math.sin(t.ang) * (V.HALF_L + C.TRAILER.TONGUE) }, best = null, bd = C.TRAILER.HITCH_DIST;
    V.active.forEach(function (c) { if (c === t || c.trailer || c.towId) { return; } var h = hitchPoint(c), d = U.dist(h.x, h.y, tip.x, tip.y); if (d < bd) { bd = d; best = c; } });
    out.push({ label: 'Engatar no carro', disabled: !best, hint: 'Encoste a traseira de um carro na lança do reboque', fn: function () {
      CP.Actions.start(p, { name: 'Engatando o reboque', time: 3, anim: 'work', onDone: function () { if (!best || best.towId) { return; } best.towId = t.id; t.towBy = best.id; V.towFollow(best); if (CP.UI) { CP.UI.toast('Reboque engatado: mais carga, carro mais lento.'); } } });
    } });
  };
  /* porta-luvas: miudezas geradas na primeira vez que abrem */
  var GLOVE = [['map', 2], ['cigarettes', 2], ['lighter', 1.2], ['note', 1], ['flashlight', 0.6], ['painkillers', 0.6], ['candy', 1], ['battery', 1], ['matches', 0.8], ['wallet', 0.5]];
  V.glovebox = function (car) {
    if (!car.glove) {
      var rng = new U.Rng(U.hashStr(String(car.id)) ^ 0x61c);
      car.glove = [];
      var n = rng.int(0, 2);
      for (var i = 0; i < n; i++) { var id = rng.weighted(GLOVE); if (D.ITEMS[id]) { car.glove.push(CP.Items.make(id, null, rng)); } }
    }
    return car.glove;
  };
  V.seat = function (car) { return car.seat || (car.seat = []); };
  V.canReachInside = function (p, car) { return p.vehicle === car || (!car.locked || car.windowBroken) && U.dist(p.x, p.y, car.x, car.y) < 2.6 && !p.vehicle; };

  /* ---------- entrar / sair / ligar ---------- */
  V.enter = function (p, car) {
    if (car.locked && !car.windowBroken) { if (CP.UI) { CP.UI.toast('O carro está trancado. Quebre o vidro para entrar.', 'warn'); } return; }
    CP.Actions.start(p, { name: 'Entrando no carro', time: 1.2, onDone: function () {
      p.vehicle = car; car.speed = 0;
      p.sneaking = false;
      if (CP.UI) { CP.UI.toast((car.keyIn ? 'A chave está na ignição. G liga o motor, W/S acelera/freia, A/D vira, E sai.' : 'Sem chave na ignição. G liga (se tiver chave ou fizer ligação direta). E sai.') + ' Q buzina, R rádio' + (MODELS[V.modelOf(car)].bar ? ', L sirene.' : '.')); }
    } });
  };
  V.exit = function (p) {
    var car = p.vehicle;
    if (!car) { return; }
    if (Math.abs(car.speed) > 1.5) { if (CP.UI) { CP.UI.toast('Pare o carro antes de sair.', 'warn'); } return; }
    var c = Math.cos(car.ang), s = Math.sin(car.ang);
    var spots = [[-s * 1.0, c * 1.0], [s * 1.0, -c * 1.0], [c * 1.5, s * 1.5], [-c * 1.5, -s * 1.5]];
    for (var i = 0; i < spots.length; i++) {
      var x = car.x + spots[i][0], y = car.y + spots[i][1];
      if (W.tileWalkable(Math.floor(x), Math.floor(y), 0) && !inside(car, x, y, 0.3)) {
        car.engine = false; car.speed = 0;
        p.vehicle = null; p.x = x; p.y = y; p.z = 0;
        if (CP.Audio && CP.Audio.engine) { CP.Audio.engine(null); }
        CP.Game.updateFov(true);
        return;
      }
    }
    if (CP.UI) { CP.UI.toast('Não há espaço para sair aqui.', 'warn'); }
  };
  V.canHotwire = function (p) { return p.traits.indexOf('hotwire') >= 0 || (CP.Player.skillLevel(p, 'electrical') >= 1 && CP.Player.skillLevel(p, 'mechanics') >= 2); };
  V.toggleEngine = function (p) {
    var car = p.vehicle;
    if (!car) { return; }
    if (car.engine) { car.engine = false; if (CP.Audio && CP.Audio.engine) { CP.Audio.engine(null); } return; }
    if (car.broken) { if (CP.UI) { CP.UI.toast('O motor não liga: o carro está quebrado.', 'warn'); } return; }
    if (car.fuel <= 0) { if (CP.UI) { CP.UI.toast('Sem gasolina.', 'warn'); } return; }
    var hasKey = car.keyIn || car.hotwired || (car.keyFits && CP.Items.Inv.findId(p, 'car_key'));
    if (hasKey) { startEngine(p, car, 1.2, 0.95); return; }
    if (V.canHotwire(p)) {
      CP.Actions.start(p, { name: 'Ligação direta', time: 6, noise: { r: 8, every: 2 }, onDone: function () {
        var chance = 0.45 + CP.Player.skillLevel(p, 'electrical') * 0.08 + CP.Player.skillLevel(p, 'mechanics') * 0.05;
        if (Math.random() < chance) { car.hotwired = true; startEngine(p, car, 0.2, 1); CP.Player.addXp(p, 'electrical', 2); } else { if (CP.UI) { CP.UI.toast('A ligação direta falhou. Tente de novo.', 'warn'); } CP.Zombies.noise(car.x, car.y, 0, 12, 'engine'); }
      } });
      return;
    }
    if (CP.UI) { CP.UI.toast(CP.Items.Inv.findId(p, 'car_key') ? 'A chave que você tem não serve neste carro.' : 'Sem chave. É preciso saber fazer ligação direta (Ladrão/Mecânico, ou Elétrica 1 + Mecânica 2).', 'warn'); }
  };
  function startEngine(p, car, time, chance) {
    var pt = V.parts(car);
    if (!pt.battery || pt.battery < 0.15) { if (CP.UI) { CP.UI.toast(pt.battery === null ? 'Não tem bateria no carro.' : 'Só um clique... a bateria está descarregada.', 'warn'); } if (CP.Audio) { CP.Audio.click(); } return; }
    CP.Actions.start(p, { name: 'Dando partida', time: time, onDone: function () {
      pt.battery = Math.max(0, pt.battery - 0.04);
      if (Math.random() < chance * (0.35 + pt.engine * 0.65)) { car.engine = true; CP.Zombies.noise(car.x, car.y, 0, 25, 'engine'); if (CP.UI) { CP.UI.toast('Motor ligado.', 'good'); } } else if (CP.UI) { CP.UI.toast(pt.engine < 0.3 ? 'O motor engasga... está muito estragado.' : 'O motor engasgou. Tente de novo.', 'warn'); }
    } });
  }

  /* ---------- opções de contexto (a pé) ---------- */
  V.contextOptions = function (p, wx, wy, out) {
    var car = V.carAt(wx, wy, 0.35);
    if (!car || p.vehicle) { return; }
    var d = U.dist(p.x, p.y, car.x, car.y);
    if (d > 2.6) { return; }
    if (car.trailer) { V.trailerOptions(p, car, out); return; }
    V.syncCond(car);
    out.push({ label: V.modelName(car) + ': ' + Math.round(car.fuel) + ' L de gasolina · estado ' + Math.round(car.cond * 100) + '%', disabled: true });
    out.push({ label: 'Mecânica (ver peças)', fn: function () { if (CP.UI && CP.UI.openMechanics) { CP.UI.openMechanics(car); } } });
    out.push({ label: 'Entrar no carro', key: 'E', fn: function () { V.enter(p, car); } });
    out.push({ label: 'Abrir porta-malas', fn: function () { if (CP.UI) { CP.UI.openCar(car); } } });
    if (V.canReachInside(p, car)) { out.push({ label: 'Mexer no porta-luvas e no banco', fn: function () { if (CP.UI) { CP.UI.openCar(car); } } }); }
    if (!car.armor) {
      var Inv = CP.Items.Inv, bt = Inv.findTag(p, 'blowtorch'), mk = Inv.findTag(p, 'weldmask'), sheets = Inv.count(p, 'metal_sheet'), M = C.METAL, lvl = CP.Player.skillLevel(p, 'metalworking');
      var miss = !bt ? 'Precisa de maçarico' : (!mk ? 'Precisa de máscara de solda' : (sheets < M.CAR_SHEETS ? 'Precisa de ' + M.CAR_SHEETS + ' chapas de metal' : ((bt.item.uses || 0) < M.CAR_TORCH ? 'Pouco gás no maçarico' : (lvl < M.CAR_SKILL ? 'Metalurgia ' + M.CAR_SKILL : ''))));
      out.push({ label: 'Blindar com chapas de metal (solda)', disabled: !!miss, hint: miss, fn: function () {
        CP.Actions.start(p, { name: 'Soldando chapas no carro', time: 20 * (1.3 - lvl * 0.05), anim: 'work', noise: { r: C.NOISE.BUILD, every: 1.5 }, onDone: function () {
          var b2 = Inv.findTag(p, 'blowtorch');
          if (!b2 || Inv.count(p, 'metal_sheet') < M.CAR_SHEETS || (b2.item.uses || 0) < M.CAR_TORCH) { return; }
          Inv.consume(p, 'metal_sheet', M.CAR_SHEETS); b2.item.uses -= M.CAR_TORCH;
          car.armor = true; car.windowBroken = false; car.locked = false; CP.Player.addXp(p, 'metalworking', 12);
          if (CP.UI) { CP.UI.toast('Carro blindado: aguenta muito mais pancada.'); }
        } });
      } });
    }
    if (car.locked && !car.windowBroken && !car.armor) {
      out.push({ label: 'Quebrar o vidro', fn: function () {
        CP.Actions.start(p, { name: 'Quebrando o vidro', time: 0.9, onDone: function () {
          car.windowBroken = true;
          CP.Zombies.noise(car.x, car.y, 0, 18, 'glass');
          if (CP.Audio) { CP.Audio.glass(car.x, car.y); }
          if (car.alarm && !car.alarmed) { car.alarmed = true; CP.Time.triggerAlarm(car.x, car.y, 0, 'car'); }
          if (!CP.Combat.weaponOf(p) && Math.random() < 0.4) { CP.Body.addWound(p, 'handR', 'laceration', { cause: 'Cortou-se num vidro de carro' }); }
        } });
      } });
    }
    var can = CP.Items.Inv.findTag(p, 'gas');
    out.push({ label: 'Abastecer com galão', disabled: !can || car.fuel >= V.FUEL_MAX - 0.5, hint: !can ? 'Precisa de galão com gasolina' : 'Tanque cheio', fn: function () {
      CP.Actions.start(p, { name: 'Abastecendo o carro', time: 4, onDone: function () {
        var add = Math.min(can.item.fuel, V.FUEL_MAX - car.fuel);
        car.fuel += add; can.item.fuel -= add;
        if (can.item.fuel <= 0) { CP.Items.Inv.detach(p, can.item); CP.Items.Inv.give(p, CP.Items.make('gas_can_empty')); }
        if (CP.UI) { CP.UI.toast('Abasteceu ' + Math.round(add) + ' L.'); }
      } });
    } });
  };

  /* ---------- painel de mecânica: remover/instalar peças, consertar o motor ---------- */
  /* lista de ações possíveis para cada peça (usada pela interface) */
  V.partActions = function (p, car) {
    var pt = V.parts(car), Inv = CP.Items.Inv, mech = CP.Player.skillLevel(p, 'mechanics');
    var wrench = Inv.findTag(p, 'wrench'), screw = Inv.findTag(p, 'screwdriver');
    var near = U.dist(p.x, p.y, car.x, car.y) < 2.8 && !p.vehicle;
    return V.PARTS.map(function (k) {
      var v = pt[k], row = { part: k, name: V.PART_NAMES[k], value: v, acts: [] };
      if (k === 'engine') {
        row.acts.push({ id: 'repair', label: 'Consertar (sucata + chave de roda)', ok: near && !!wrench && !!Inv.findId(p, 'scrap') && v < 1, hint: 'Precisa de chave de roda e sucata de metal' });
        return row;
      }
      var tool = k === 'windshield' ? screw : wrench, toolName = k === 'windshield' ? 'chave de fenda' : 'chave de roda';
      if (v === null || v === undefined) {
        var item = Inv.findId(p, V.PART_ITEM[k]);
        row.acts.push({ id: 'install', label: 'Instalar', ok: near && !!tool && !!item, hint: 'Precisa de ' + D.ITEMS[V.PART_ITEM[k]].name.toLowerCase() + ' e ' + toolName });
      } else {
        row.acts.push({ id: 'remove', label: 'Remover', ok: near && !!tool && !(k === 'battery' && car.engine), hint: car.engine && k === 'battery' ? 'Desligue o motor' : 'Precisa de ' + toolName });
      }
      return row;
    });
  };
  V.partAction = function (p, car, part, act) {
    var pt = V.parts(car), Inv = CP.Items.Inv, mech = CP.Player.skillLevel(p, 'mechanics');
    var times = { engine: 12, battery: 4, windshield: 10 }, t = (times[part] || 6) * (1 - mech * 0.05);
    var name = V.PART_NAMES[part];
    if (act === 'repair') {
      CP.Actions.start(p, { name: 'Consertando o motor', time: t, anim: 'work', noise: { r: 10, every: 2, sound: 'hammer' }, onDone: function () {
        if (!Inv.consume(p, 'scrap', 1)) { return; }
        pt.engine = Math.min(1, pt.engine + 0.15 + mech * 0.03); V.syncCond(car);
        CP.Player.addXp(p, 'mechanics', 5);
        if (CP.UI) { CP.UI.toast('Motor em ' + Math.round(pt.engine * 100) + '%.'); }
      } });
    } else if (act === 'remove') {
      CP.Actions.start(p, { name: 'Removendo: ' + name.toLowerCase(), time: t, anim: 'work', noise: { r: 6, every: 2 }, onDone: function () {
        var v = pt[part];
        if (v === null || v === undefined) { return; }
        var it = CP.Items.make(V.PART_ITEM[part], part === 'battery' ? { charge: v } : { cond: v });
        Inv.give(p, it);
        pt[part] = null; V.syncCond(car);
        if (part === 'windshield') { car.windowBroken = true; }
        CP.Player.addXp(p, 'mechanics', 3);
      } });
    } else if (act === 'install') {
      var found = Inv.findId(p, V.PART_ITEM[part]);
      if (!found) { return; }
      CP.Actions.start(p, { name: 'Instalando: ' + name.toLowerCase(), time: t, anim: 'work', noise: { r: 6, every: 2 }, onDone: function () {
        var f2 = Inv.findId(p, V.PART_ITEM[part]);
        if (!f2) { return; }
        Inv.detach(p, f2.item);
        pt[part] = part === 'battery' ? (f2.item.charge !== undefined ? f2.item.charge : 0.8) : (f2.item.cond !== undefined ? f2.item.cond : 1);
        V.syncCond(car);
        CP.Player.addXp(p, 'mechanics', 4);
      } });
    }
  };

  /* ---------- desenho (caixa orientada em qualquer ângulo) ---------- */
  function iso(x, y, h) { return [HW * (x - y), HH * (x + y) - (h || 0)]; }
  function drawBox(g, cs, cx, cy, h0, h1, color, lf, sxo, syo) {
    // cs: 4 cantos no mundo (em volta), relativos ao centro (cx,cy). Desenha faces visíveis + topo
    var faces = [];
    for (var i = 0; i < 4; i++) {
      var a = cs[i], b = cs[(i + 1) % 4];
      var nx = b[1] - a[1], ny = -(b[0] - a[0]);
      var mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      if (nx + ny > 0) { faces.push({ a: a, b: b, f: (nx > ny ? 0.95 : 0.78) }); }
    }
    faces.forEach(function (fc) {
      var p1 = iso(fc.a[0] - cx, fc.a[1] - cy, h0), p2 = iso(fc.b[0] - cx, fc.b[1] - cy, h0), p3 = iso(fc.b[0] - cx, fc.b[1] - cy, h1), p4 = iso(fc.a[0] - cx, fc.a[1] - cy, h1);
      g.beginPath(); g.moveTo(sxo + p1[0], syo + p1[1]); g.lineTo(sxo + p2[0], syo + p2[1]); g.lineTo(sxo + p3[0], syo + p3[1]); g.lineTo(sxo + p4[0], syo + p4[1]); g.closePath();
      g.fillStyle = U.shade(color, fc.f * lf); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
    });
    g.beginPath();
    for (var k = 0; k < 4; k++) { var q = iso(cs[k][0] - cx, cs[k][1] - cy, h1); if (k === 0) { g.moveTo(sxo + q[0], syo + q[1]); } else { g.lineTo(sxo + q[0], syo + q[1]); } }
    g.closePath(); g.fillStyle = U.shade(color, 1.1 * lf); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke();
  }
  /* reboque: caçamba baixa de madeira com laterais, 2 rodas e a lança na frente */
  function drawTrailer(g, car, sx, sy, lf) {
    var sh = corners(car, car.x, car.y, car.ang, 0.05);
    g.beginPath(); sh.forEach(function (c2, i) { var q = iso(c2[0] - car.x, c2[1] - car.y, 0); if (i === 0) { g.moveTo(sx + q[0], sy + q[1]); } else { g.lineTo(sx + q[0], sy + q[1]); } }); g.closePath(); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fill();
    var c = Math.cos(car.ang), s = Math.sin(car.ang);
    function W2(u, v, h) { var q = iso(c * u - s * v, s * u + c * v, h); return [sx + q[0], sy + q[1]]; }
    var a = W2(V.HALF_L - 0.1, 0, 7), b = W2(V.HALF_L + C.TRAILER.TONGUE, 0, 5);
    g.strokeStyle = U.shade('#3a3a3a', lf); g.lineWidth = 2.5; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    [0.42, -0.42].forEach(function (v) { var q = W2(-0.05, v, 6); g.fillStyle = '#121212'; g.beginPath(); g.ellipse(q[0], q[1], 6.5, 5.5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5a5a58'; g.beginPath(); g.ellipse(q[0], q[1], 2.4, 2, 0, 0, Math.PI * 2); g.fill(); });
    function rect(u0, u1, v0, v1) { return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]; }
    var col = CP.Spr.gradeHex(CAR_COLORS[car.color] || '#777'), wood = CP.Spr.gradeHex('#7a5a3a');
    solid(g, car, rect(-0.9, 0.85, -0.4, 0.4), rect(-0.9, 0.85, -0.4, 0.4), 6, 10, sx, sy, col, col, lf);
    solid(g, car, rect(-0.9, 0.85, -0.4, 0.4), rect(-0.9, 0.85, -0.4, 0.4), 10, 20, sx, sy, wood, wood, lf * 0.95);
    var tp = [W2(-0.82, -0.32, 20), W2(0.77, -0.32, 20), W2(0.77, 0.32, 20), W2(-0.82, 0.32, 20)];
    g.beginPath(); tp.forEach(function (q, i) { if (i === 0) { g.moveTo(q[0], q[1]); } else { g.lineTo(q[0], q[1]); } }); g.closePath(); g.fillStyle = U.shade('#3a2a1c', lf); g.fill();
    if ((car.trunk || []).length) { var m = W2(0, 0, 20); g.fillStyle = U.shade('#8a7a5a', lf); g.fillRect(m[0] - 6, m[1] - 5, 12, 6); g.fillStyle = U.shade('#5a6a4a', lf); g.fillRect(m[0] - 2, m[1] - 8, 8, 5); }
  }
  /* sólido convexo: base e topo (4 cantos em u, v locais, anti-horário visto de cima) → faces voltadas para a câmera */
  function solid(g, car, base, top, h0, h1, sx, sy, colTop, colSide, lf, glassSides) {
    var c = Math.cos(car.ang), s = Math.sin(car.ang);
    function P(p, h) { var wx = c * p[0] - s * p[1], wy = s * p[0] + c * p[1]; var q = iso(wx, wy, h); return [sx + q[0], sy + q[1], wx, wy]; }
    var B = base.map(function (p) { return P(p, h0); }), T = top.map(function (p) { return P(p, h1); });
    function area(pts) { var a = 0; for (var i = 0; i < pts.length; i++) { var j = (i + 1) % pts.length; a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]; } return a; }
    var ref = area(T) > 0 ? 1 : -1;
    function face(pts, fill) {
      if (area(pts) * ref <= 0) { return false; }
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) { g.lineTo(pts[i][0], pts[i][1]); }
      g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
      return true;
    }
    for (var i = 0; i < 4; i++) {
      var j = (i + 1) % 4;
      var nx = B[j][3] - B[i][3], ny = -(B[j][2] - B[i][2]); // normal para fora (no chão)
      var nl = Math.sqrt(nx * nx + ny * ny) || 1; nx /= nl; ny /= nl;
      var f = 0.84 + 0.12 * nx - 0.06 * ny;
      var glass = glassSides && glassSides[i];
      face([B[i], B[j], T[j], T[i]], glass ? U.shade(glass, f * lf) : U.shade(colSide, f * lf));
    }
    face(T, U.shade(colTop, 1.08 * lf));
    return T;
  }
  function drawCar(g, sx, sy, bright) {
    var car = this;
    var lf = Math.max(0.3, bright);
    if (car.trailer) { drawTrailer(g, car, sx, sy, lf); return; }
    var col = CAR_COLORS[car.color] || '#777777';
    if (car.broken) { col = U.mix(col, '#3a3530', 0.4); }
    // ferrugem com o passar dos meses (cada carro enferruja num ritmo) e neve no teto se está parado ao relento
    if (car.rust === undefined) { car.rust = 0.4 + (U.hashStr(String(car.id)) % 600) / 1000; }
    var rustK = CP.Amb ? Math.round(Math.max(0, CP.Amb.erosion() - 0.1) * car.rust * 10) / 10 : 0;
    if (rustK > 0) { col = U.mix(col, '#6e4426', rustK * 0.5); }
    col = CP.Spr.gradeHex(col);
    var snowK = CP.Amb && !car.engine && Math.abs(car.speed) < 0.1 ? Math.round(Math.min(0.85, CP.Amb.snow() * 1.1) * 10) / 10 : 0;
    var colTop = snowK > 0 ? CP.Spr.gradeHex(U.mix(CAR_COLORS[car.color] || '#777777', '#eef1f4', snowK)) : col;
    // sombra
    var sh = corners(car, car.x, car.y, car.ang, 0.08);
    g.beginPath();
    sh.forEach(function (c2, i) { var q = iso(c2[0] - car.x, c2[1] - car.y, 0); if (i === 0) { g.moveTo(sx + q[0], sy + q[1]); } else { g.lineTo(sx + q[0], sy + q[1]); } });
    g.closePath(); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill();
    if (car.siren) { // reflexo do giroflex no chão em volta
      var gb = Math.floor(performance.now() / 160) % 2;
      g.fillStyle = gb ? 'rgba(70,100,255,0.16)' : 'rgba(255,70,50,0.16)'; g.beginPath(); g.ellipse(sx, sy, 70, 35, 0, 0, Math.PI * 2); g.fill();
    }
    // rodas
    var c = Math.cos(car.ang), s = Math.sin(car.ang);
    var ptw = V.parts(car), wheelPart = ['tireFR', 'tireFL', 'tireRR', 'tireRL'];
    [[0.6, 0.4], [0.6, -0.4], [-0.6, 0.4], [-0.6, -0.4]].forEach(function (w, wi) {
      var tv = ptw[wheelPart[wi]];
      var wx = c * w[0] - s * w[1], wy = s * w[0] + c * w[1];
      var flatW = tv === 0 || (tv && tv <= 0.05), gone = tv === null || tv === undefined;
      var q = iso(wx, wy, gone ? 3 : (flatW ? 4 : 6));
      if (gone) { g.fillStyle = '#3a3a38'; g.fillRect(sx + q[0] - 2, sy + q[1] - 1, 4, 2); return; } // só o cubo
      g.fillStyle = '#121212'; g.beginPath(); g.ellipse(sx + q[0], sy + q[1], 6.5, flatW ? 3.6 : 5.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a5a58'; g.beginPath(); g.ellipse(sx + q[0], sy + q[1] - (flatW ? 0.6 : 0), 2.6, flatW ? 1.6 : 2.2, 0, 0, Math.PI * 2); g.fill();
    });
    function rect(u0, u1, v0, v1) { return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]; }
    // lataria, capô/porta-malas e cabine com vidros inclinados (frente = +u); cada modelo tem a sua forma
    var model = V.modelOf(car), glass = CP.Spr.gradeHex(car.armor ? '#6c7074' : (car.windowBroken ? '#2a3238' : '#5d7584')), top;
    var white = CP.Spr.gradeHex('#e8e6e0'), red = CP.Spr.gradeHex('#b02420');
    if (model === 'van' || model === 'ambulance') {
      solid(g, car, rect(-0.92, 0.92, -0.38, 0.38), rect(-0.92, 0.92, -0.38, 0.38), 4, 15, sx, sy, col, col, lf);
      solid(g, car, rect(0.55, 0.92, -0.37, 0.37), rect(0.55, 0.9, -0.36, 0.36), 15, 18, sx, sy, colTop, col, lf);
      // caixa alta (vidro só na frente)
      top = solid(g, car, rect(-0.92, 0.58, -0.38, 0.38), rect(-0.92, 0.46, -0.36, 0.36), 15, 36, sx, sy, colTop, col, lf, [col, glass, col, col]);
      if (model === 'ambulance') {
        [-0.385, 0.385].forEach(function (v) { var a = iso(c * -0.9 - s * v, s * -0.9 + c * v, 22), b = iso(c * 0.5 - s * v, s * 0.5 + c * v, 22); g.strokeStyle = U.shade(red, lf); g.lineWidth = 3; g.beginPath(); g.moveTo(sx + a[0], sy + a[1]); g.lineTo(sx + b[0], sy + b[1]); g.stroke(); });
        var cr = iso(-s * 0, c * 0, 37.5); g.fillStyle = U.shade(red, lf); g.fillRect(sx + cr[0] - 1.5, sy + cr[1] - 4, 3, 8); g.fillRect(sx + cr[0] - 4, sy + cr[1] - 1.5, 8, 3);
      }
    } else if (model === 'pickup') {
      solid(g, car, rect(-0.92, 0.92, -0.38, 0.38), rect(-0.92, 0.92, -0.38, 0.38), 4, 15, sx, sy, col, col, lf);
      solid(g, car, rect(0.45, 0.92, -0.36, 0.36), rect(0.45, 0.9, -0.35, 0.35), 15, 17, sx, sy, colTop, col, lf);
      top = solid(g, car, rect(-0.05, 0.48, -0.35, 0.35), rect(0.02, 0.34, -0.31, 0.31), 15, 31, sx, sy, colTop, col, lf, [glass, glass, glass, glass]);
      // caçamba aberta: bordas finas e o fundo escuro
      var bedBase = [[-0.92, -0.38], [-0.08, -0.38], [-0.08, 0.38], [-0.92, 0.38]];
      g.beginPath(); bedBase.forEach(function (bp, i2) { var q2 = iso(c * bp[0] - s * bp[1], s * bp[0] + c * bp[1], 15); if (i2 === 0) { g.moveTo(sx + q2[0], sy + q2[1]); } else { g.lineTo(sx + q2[0], sy + q2[1]); } }); g.closePath();
      g.fillStyle = U.shade('#2a2622', lf); g.fill();
      [[-0.92, -0.38, -0.08, -0.38], [-0.92, 0.38, -0.08, 0.38], [-0.92, -0.38, -0.92, 0.38]].forEach(function (e2) { var a = iso(c * e2[0] - s * e2[1], s * e2[0] + c * e2[1], 20), b = iso(c * e2[2] - s * e2[3], s * e2[2] + c * e2[3], 20), a0 = iso(c * e2[0] - s * e2[1], s * e2[0] + c * e2[1], 15), b0 = iso(c * e2[2] - s * e2[3], s * e2[2] + c * e2[3], 15); g.beginPath(); g.moveTo(sx + a0[0], sy + a0[1]); g.lineTo(sx + b0[0], sy + b0[1]); g.lineTo(sx + b[0], sy + b[1]); g.lineTo(sx + a[0], sy + a[1]); g.closePath(); g.fillStyle = U.shade(col, 0.9 * lf); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.stroke(); });
    } else {
      solid(g, car, rect(-0.92, 0.92, -0.38, 0.38), rect(-0.92, 0.92, -0.38, 0.38), 4, 15, sx, sy, col, col, lf);
      solid(g, car, rect(-0.9, 0.9, -0.35, 0.35), rect(-0.9, 0.9, -0.35, 0.35), 15, 17, sx, sy, model === 'police' ? white : colTop, col, lf);
      top = solid(g, car, rect(-0.5, 0.38, -0.32, 0.32), rect(-0.3, 0.22, -0.27, 0.27), 17, 30, sx, sy, model === 'police' ? white : colTop, col, lf, [glass, glass, glass, glass]);
      if (model === 'police') { // portas brancas
        [-0.385, 0.385].forEach(function (v) { var a = iso(c * -0.35 - s * v, s * -0.35 + c * v, 9), b = iso(c * 0.35 - s * v, s * 0.35 + c * v, 9); g.strokeStyle = U.shade(white, lf); g.lineWidth = 8; g.beginPath(); g.moveTo(sx + a[0], sy + a[1]); g.lineTo(sx + b[0], sy + b[1]); g.stroke(); });
      }
    }
    if (MODELS[model].bar) { // giroflex no teto: pisca vermelho/azul com a sirene ligada
      var bh = model === 'police' ? 31 : 37, bu = model === 'police' ? -0.04 : 0.35, blink = car.siren ? Math.floor(performance.now() / 160) % 2 : -1;
      [-0.14, 0.14].forEach(function (v, bi) {
        var q3 = iso(c * bu - s * v, s * bu + c * v, bh);
        var on = blink === bi, cc = bi === 0 ? '#d02a20' : '#2a50e0';
        g.fillStyle = on ? cc : U.shade(U.mix(cc, '#222', 0.45), lf); g.beginPath(); g.ellipse(sx + q3[0], sy + q3[1], 3.6, 2.2, 0, 0, Math.PI * 2); g.fill();
        if (on) { g.fillStyle = bi === 0 ? 'rgba(255,70,50,0.35)' : 'rgba(70,100,255,0.35)'; g.beginPath(); g.ellipse(sx + q3[0], sy + q3[1], 7, 4.5, 0, 0, Math.PI * 2); g.fill(); }
      });
    }
    if (rustK >= 0.3) { // manchas de ferrugem na lataria
      var rr = new U.Rng(U.hashStr(String(car.id)));
      for (var ri = 0; ri < Math.round(rustK * 8); ri++) {
        var ru = rr.range(-0.85, 0.85), rv = rr.chance(0.5) ? 0.38 : -0.38, rh = rr.range(6, 14);
        var rq = iso(c * ru - s * rv, s * ru + c * rv, rh);
        g.fillStyle = 'rgba(' + Math.round(110 * lf) + ',' + Math.round(58 * lf) + ',' + Math.round(28 * lf) + ',0.55)'; g.beginPath(); g.ellipse(sx + rq[0], sy + rq[1], rr.range(2, 4.5), rr.range(1, 2.2), 0, 0, Math.PI * 2); g.fill();
      }
    }
    // faróis
    var hl = [[0.93, 0.25], [0.93, -0.25]].map(function (p) { var q = iso(c * p[0] - s * p[1], s * p[0] + c * p[1], 11); return [sx + q[0], sy + q[1]]; });
    hl.forEach(function (q) { g.fillStyle = car.engine ? 'rgba(255,240,180,0.95)' : U.shade('#cfc8a8', lf); g.beginPath(); g.arc(q[0], q[1], car.engine ? 3 : 2, 0, Math.PI * 2); g.fill(); });
    if (top && !car.windowBroken) { g.strokeStyle = 'rgba(255,255,255,' + (0.2 * lf).toFixed(2) + ')'; g.lineWidth = 2; g.beginPath(); g.moveTo(top[1][0], top[1][1] + 3); g.lineTo(top[2][0], top[2][1] + 3); g.stroke(); }
  }
  V.drawCar = drawCar;

  /* buzina (Q dentro do carro), sirene (L, viatura e ambulância) e rádio (R): fazem barulho e chamam zumbis */
  V.horn = function (p) {
    var car = p.vehicle;
    if (!car) { return; }
    if ((V.parts(car).battery || 0) < 0.05) { if (CP.UI) { CP.UI.toast('A bateria está descarregada.', 'warn'); } return; }
    if (car.hornT > 0) { return; }
    car.hornT = 0.7;
    if (CP.Audio && CP.Audio.horn) { CP.Audio.horn(car.x, car.y); }
    CP.Zombies.noise(car.x, car.y, 0, C.NOISE.HORN, 'horn');
  };
  V.toggleSiren = function (p) {
    var car = p.vehicle;
    if (!car || !MODELS[V.modelOf(car)].bar) { return false; }
    if (!car.siren && (V.parts(car).battery || 0) < 0.05) { if (CP.UI) { CP.UI.toast('A bateria está descarregada.', 'warn'); } return false; }
    car.siren = !car.siren; car.sirenT = 0;
    if (CP.UI) { CP.UI.toast(car.siren ? 'Sirene ligada — todos os zumbis da região vão ouvir!' : 'Sirene desligada.', car.siren ? 'warn' : ''); }
    return true;
  };
  V.toggleRadio = function (p) {
    var car = p.vehicle;
    if (!car) { return; }
    if (!car.radio && (V.parts(car).battery || 0) < 0.05) { if (CP.UI) { CP.UI.toast('A bateria está descarregada.', 'warn'); } return; }
    car.radio = !car.radio; car.radioT = 0;
    if (CP.Audio) { CP.Audio.click(); }
    if (CP.UI) { CP.UI.toast(car.radio ? 'Rádio do carro ligado.' : 'Rádio do carro desligado.'); }
  };
  V.update = function (dt) {
    for (var i = 0; i < V.active.length; i++) {
      var car = V.active[i], pt;
      if (car.hornT > 0) { car.hornT -= dt; }
      if (!car.siren && !car.radio) { continue; }
      pt = V.parts(car);
      var drain = (car.siren ? 0.0025 : 0) + (car.radio ? 0.0006 : 0);
      if (!car.engine) { pt.battery = Math.max(0, (pt.battery || 0) - drain * dt); }
      if ((pt.battery || 0) < 0.03) { car.siren = false; car.radio = false; continue; }
      if (car.siren) {
        car.sirenT = (car.sirenT || 0) - dt;
        if (car.sirenT <= 0) { car.sirenT = 1.2; CP.Zombies.noise(car.x, car.y, 0, C.NOISE.SIREN, 'siren'); if (CP.Audio && CP.Audio.siren) { CP.Audio.siren(car.x, car.y); } }
      }
      if (car.radio) {
        car.radioT = (car.radioT || 0) - dt;
        if (car.radioT <= 0) {
          car.radioT = 4; CP.Zombies.noise(car.x, car.y, 0, C.NOISE.RADIO, 'radio');
          var p = CP.Game.player;
          if (p.vehicle === car) {
            car.radioMsgT = (car.radioMsgT || 0) - 4;
            if (car.radioMsgT <= 0) { car.radioMsgT = 24; if (CP.UI) { CP.UI.toast('Rádio: ' + CP.Time.broadcast(), 'info'); } }
            p.body.stats.boredom = Math.max(0, p.body.stats.boredom - 0.01);
          }
          if (CP.Audio && CP.Audio.radioHum) { CP.Audio.radioHum(car.x, car.y); }
        }
      }
    }
  };

  /* luz dos faróis */
  V.lightSources = function (out) {
    for (var i = 0; i < V.active.length; i++) {
      var car = V.active[i];
      if (car.engine && (V.parts(car).battery || 0) > 0.05) { out.push({ x: car.x + Math.cos(car.ang) * 1.2, y: car.y + Math.sin(car.ang) * 1.2, z: 0, r: 12, i: 0.9, cone: { ang: car.ang, half: 0.45 }, indoor: false }); }
    }
  };

  CP.Vehicles = V;
})(window.CP = window.CP || {});
