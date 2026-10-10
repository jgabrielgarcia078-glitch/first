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
          // porta-malas: aproveita o loot já gerado do objeto (se o jogador abriu) ou gera agora
          var key = W.key(x, y, 0);
          var cont = ch.containers[key];
          if (!cont || !cont.gen) { cont = { items: [], gen: true }; if (CP.Loot) { CP.Loot.fill(cont, x, y, 0, O.CAR); } }
          car.trunk = cont.items;
          delete ch.containers[key];
          L.obj[i] = 0; L.odir[i] = 0;
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
      if (i >= 0 && ch.cars[k] !== p.vehicle) { V.active.splice(i, 1); }
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
      if (car === ignore || Math.abs(car.z - z) > 0.4) { continue; }
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
    var running = car.engine && car.fuel > 0 && !car.broken;
    var maxF = V.MAX_FWD * (0.55 + car.cond * 0.45);
    if (running && up) { car.speed = Math.min(maxF, car.speed + V.ACCEL * dt * (car.speed < 0 ? 2 : 1)); } else if (running && dn) { car.speed = car.speed > 0.2 ? car.speed - V.BRAKE * dt : Math.max(-V.MAX_REV, car.speed - V.ACCEL * 0.6 * dt); } else {
      var dr = V.DRAG * dt * (Math.abs(car.speed) > 0.1 ? 1 : 3);
      car.speed = car.speed > 0 ? Math.max(0, car.speed - dr) : Math.min(0, car.speed + dr);
    }
    if (In.isDown('Space')) { car.speed = car.speed > 0 ? Math.max(0, car.speed - V.BRAKE * 1.5 * dt) : Math.min(0, car.speed + V.BRAKE * 1.5 * dt); }
    // direção relativa ao carro (como no PZ): A/D giram
    var steerIn = (rt ? 1 : 0) - (lf ? 1 : 0);
    car.steer += (steerIn - car.steer) * Math.min(1, dt * 6);
    var turn = car.steer * V.STEER * dt * U.clamp(Math.abs(car.speed) / 4, 0, 1) * (car.speed >= 0 ? 1 : -1);
    var nang = car.ang + turn;
    var dist = car.speed * dt;
    var nx = car.x + Math.cos(nang) * dist, ny = car.y + Math.sin(nang) * dist;
    if (Math.abs(dist) > 0 || turn) {
      if (!collides(car, nx, ny, nang)) {
        car.x = nx; car.y = ny; car.ang = nang;
        car.fuel = Math.max(0, car.fuel - Math.abs(dist) * V.FUEL_PER_TILE);
        if (car.fuel <= 0 && car.engine) { car.engine = false; if (CP.UI) { CP.UI.toast('Acabou a gasolina!', 'warn'); } }
      } else {
        // batida
        var impact = Math.abs(car.speed);
        if (impact > 4) {
          car.cond = Math.max(0, car.cond - impact * 0.012);
          if (CP.Audio) { CP.Audio.thump(car.x, car.y, 0, true); }
          CP.Zombies.noise(car.x, car.y, 0, 20, 'crash');
          if (impact > 9) {
            CP.Body.addWound(p, U.pick(['head', 'torso', 'farmL', 'farmR']), impact > 11 ? 'deep' : 'laceration', { cause: 'Morreu num acidente de carro' });
            if (CP.UI) { CP.UI.toast('Batida forte!', 'danger'); }
          }
          if (car.cond <= 0) { car.broken = true; car.engine = false; if (CP.UI) { CP.UI.toast('O carro quebrou.', 'danger'); } }
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
        car.cond = Math.max(0, car.cond - 0.004 * sp);
        car.speed *= killed ? 0.92 : 0.8;
        if (CP.Audio) { CP.Audio.hit('blunt_long', killed); }
      }
    }
    // barulho do motor
    if (car.engine) {
      car.noiseT = (car.noiseT || 0) - dt;
      if (car.noiseT <= 0) { car.noiseT = 1; CP.Zombies.noise(car.x, car.y, 0, 14 + Math.abs(car.speed) * 1.5, 'engine'); }
      if (CP.Audio && CP.Audio.engine) { CP.Audio.engine(Math.abs(car.speed) / V.MAX_FWD); }
    }
    // jogador acompanha o carro
    p.x = car.x; p.y = car.y; p.z = 0; p.ang = car.ang;
    p.moving = Math.abs(car.speed) > 0.1;
    rehome(car);
  };

  /* ---------- entrar / sair / ligar ---------- */
  V.enter = function (p, car) {
    if (car.locked && !car.windowBroken) { if (CP.UI) { CP.UI.toast('O carro está trancado. Quebre o vidro para entrar.', 'warn'); } return; }
    CP.Actions.start(p, { name: 'Entrando no carro', time: 1.2, onDone: function () {
      p.vehicle = car; car.speed = 0;
      p.sneaking = false;
      if (CP.UI) { CP.UI.toast(car.keyIn ? 'A chave está na ignição. G liga o motor, W/S acelera/freia, A/D vira, E sai.' : 'Sem chave na ignição. G liga (se tiver chave ou fizer ligação direta). E sai.'); }
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
    CP.Actions.start(p, { name: 'Dando partida', time: time, onDone: function () {
      if (Math.random() < chance * (0.6 + car.cond * 0.4)) { car.engine = true; CP.Zombies.noise(car.x, car.y, 0, 25, 'engine'); if (CP.UI) { CP.UI.toast('Motor ligado.', 'good'); } } else if (CP.UI) { CP.UI.toast('O motor engasgou. Tente de novo.', 'warn'); }
    } });
  }

  /* ---------- opções de contexto (a pé) ---------- */
  V.contextOptions = function (p, wx, wy, out) {
    var car = V.carAt(wx, wy, 0.35);
    if (!car || p.vehicle) { return; }
    var d = U.dist(p.x, p.y, car.x, car.y);
    if (d > 2.6) { return; }
    out.push({ label: 'Carro: ' + Math.round(car.fuel) + ' L de gasolina · estado ' + Math.round(car.cond * 100) + '%', disabled: true });
    out.push({ label: 'Entrar no carro', key: 'E', fn: function () { V.enter(p, car); } });
    out.push({ label: 'Abrir porta-malas', fn: function () { if (CP.UI) { CP.UI.openCar(car); } } });
    if (car.locked && !car.windowBroken) {
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
    if (car.cond < 0.95 && CP.Items.Inv.findTag(p, 'wrench')) {
      out.push({ label: 'Consertar (chave de roda + sucata)', disabled: !CP.Items.Inv.findId(p, 'scrap'), hint: 'Precisa de sucata de metal', fn: function () {
        CP.Actions.start(p, { name: 'Consertando o carro', time: 12 - CP.Player.skillLevel(p, 'mechanics'), noise: { r: 10, every: 2, sound: 'hammer' }, onDone: function () {
          if (!CP.Items.Inv.consume(p, 'scrap', 1)) { return; }
          car.cond = Math.min(1, car.cond + 0.15 + CP.Player.skillLevel(p, 'mechanics') * 0.03); car.broken = false;
          CP.Player.addXp(p, 'mechanics', 5);
        } });
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
  function drawCar(g, sx, sy, bright) {
    var car = this;
    var lf = Math.max(0.3, bright);
    var col = CAR_COLORS[car.color] || '#777';
    if (car.broken) { col = U.mix(col, '#3a3530', 0.4); }
    // sombra
    var sh = corners(car, car.x, car.y, car.ang, 0.08);
    g.beginPath();
    sh.forEach(function (c2, i) { var q = iso(c2[0] - car.x, c2[1] - car.y, 0); if (i === 0) { g.moveTo(sx + q[0], sy + q[1]); } else { g.lineTo(sx + q[0], sy + q[1]); } });
    g.closePath(); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill();
    // rodas
    var c = Math.cos(car.ang), s = Math.sin(car.ang);
    [[0.62, 0.44], [0.62, -0.44], [-0.62, 0.44], [-0.62, -0.44]].forEach(function (w) {
      var wx = c * w[0] - s * w[1], wy = s * w[0] + c * w[1];
      var q = iso(wx, wy, 5);
      g.fillStyle = '#151515'; g.beginPath(); g.ellipse(sx + q[0], sy + q[1], 6, 4.5, 0, 0, Math.PI * 2); g.fill();
    });
    drawBox(g, corners(car, car.x, car.y, car.ang, 0), car.x, car.y, 4, 18, col, lf, sx, sy);
    // cabine (deslocada para trás um pouco)
    var cab = { x: car.x - c * 0.12, y: car.y - s * 0.12, ang: car.ang };
    var cs = (function () { var L = 0.52, Wd = 0.36; return [[cab.x + c * L - s * Wd, cab.y + s * L + c * Wd], [cab.x + c * L + s * Wd, cab.y + s * L - c * Wd], [cab.x - c * L + s * Wd, cab.y - s * L - c * Wd], [cab.x - c * L - s * Wd, cab.y - s * L + c * Wd]]; })();
    drawBox(g, cs, car.x, car.y, 18, 30, car.windowBroken ? '#2a3238' : '#6f8fa3', lf, sx, sy);
    // faróis
    if (car.engine) {
      var fq = iso(c * 1.0, s * 1.0, 12);
      g.fillStyle = 'rgba(255,240,180,0.9)'; g.beginPath(); g.arc(sx + fq[0], sy + fq[1], 3, 0, Math.PI * 2); g.fill();
    }
  }
  V.drawCar = drawCar;

  /* luz dos faróis */
  V.lightSources = function (out) {
    for (var i = 0; i < V.active.length; i++) {
      var car = V.active[i];
      if (car.engine) { out.push({ x: car.x + Math.cos(car.ang) * 1.2, y: car.y + Math.sin(car.ang) * 1.2, z: 0, r: 12, i: 0.9, cone: { ang: car.ang, half: 0.45 }, indoor: false }); }
    }
  };

  CP.Vehicles = V;
})(window.CP = window.CP || {});
