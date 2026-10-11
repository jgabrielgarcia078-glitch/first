/* Zumbis: dados, ativação por chunk, percepção (visão/audição/memória), IA, caminhos, portas, ataques. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, D = CP.D;
  var ZC = C.ZOMBIE, E = C.EDGE;

  var Z = { nextId: 1, hash: new Map(), pathBudget: 0, corpseDraw: [] };

  /* ---------- dados (formato salvo/guardado no chunk) ---------- */
  Z.makeData = function (rng, x, y, z, bldKind, roomType) {
    var female = rng.chance(0.48);
    var kind = 'civil';
    if (bldKind === 'police' && rng.chance(0.6)) { kind = 'police'; } else if ((bldKind === 'clinic' || bldKind === 'hospital') && rng.chance(0.6)) { kind = 'doctor'; } else if (bldKind === 'military' && rng.chance(0.8)) { kind = 'military'; } else if ((bldKind === 'hardware' || bldKind === 'warehouse' || bldKind === 'barn') && rng.chance(0.4)) { kind = 'worker'; } else if ((bldKind === 'diner' || bldKind === 'bar') && rng.chance(0.6)) { kind = rng.chance(0.5) ? 'chef' : 'fastfood'; } else if (rng.chance(0.02)) { kind = 'police'; } else if (rng.chance(0.015)) { kind = 'fire'; } else if (rng.chance(0.015)) { kind = 'fastfood'; } else if (rng.chance(0.012)) { kind = 'roadworker'; } else if (rng.chance(0.01)) { kind = rng.chance(0.5) ? 'ranger' : 'chef'; }
    var outfitKey = kind === 'civil' ? (female ? 'civil_f' : 'civil_m') : kind;
    var ids = rng.pick(D.OUTFITS[outfitKey]);
    var outfit = ids.map(function (spec) {
      var pr = spec.split(':'), id = pr[0], d = D.ITEMS[id];
      return { id: id, color: pr[1] || (d && d.cloth && d.cloth.colors ? rng.pick(d.cloth.colors) : '#666') };
    });
    var settings = (CP.Game && CP.Game.settings) || {};
    var sp = C.ZOMBIE_SPEED_SETTINGS[settings.zombieSpeed || 'shambler'] || C.ZOMBIE_SPEED_SETTINGS.shambler;
    var r = rng.next();
    var speed = r < sp.sprint ? 'sprinter' : (r < sp.sprint + sp.fast ? 'fast' : 'shambler');
    var blood = [];
    var nb = rng.int(0, 4);
    for (var i = 0; i < nb; i++) { blood.push([rng.range(-1, 1), rng.range(0, 1), rng.range(1.5, 4)]); }
    return {
      x: x, y: y, z: z, ang: rng.range(0, Math.PI * 2), female: female, kind: kind, outfit: outfit, speed: speed,
      hp: rng.range(ZC.HP_MIN, ZC.HP_MAX) * (settings.toughness || 1),
      crawler: rng.chance(ZC.CRAWLER_CHANCE), fakeDead: rng.chance(ZC.FAKEDEAD_CHANCE),
      skin: rng.pick(C.ZOMBIE_SKIN), hair: rng.pick(C.HAIR_COLORS), hairStyle: female ? rng.pick(['longo', 'médio', 'rabo', 'curto']) : rng.pick(['curto', 'curto', 'médio', 'raspado', 'médio', 'careca']),
      blood: blood, seed: rng.int(0, 1e9)
    };
  };

  /* entidade ativa a partir dos dados */
  function fromData(d) {
    var zb = {
      kind: 'zombie', id: Z.nextId++, x: d.x, y: d.y, z: d.z, ang: d.ang || 0, data: d,
      hp: d.hp, speedType: d.speed, crawler: !!d.crawler,
      state: d.fakeDead ? 'fakedead' : (d.state === 'wander' ? 'wander' : (d.state === 'eat' && d.eat ? 'eat' : 'idle')), eat: d.state === 'eat' ? d.eat : null,
      target: null, memT: 0, path: null, pathI: 0, repathT: 0, thinkT: Math.random() * ZC.THINK_INTERVAL,
      attackT: 0, attackCd: 0, staggerT: 0, downT: 0, climbT: 0, climb: null, bash: null, bashT: 0,
      vx: 0, vy: 0, phase: Math.random(), moving: false, seesPlayer: false, idleT: U.randRange(2, 10),
      groanT: U.randRange(8, 40), lastSeenT: 99
    };
    zb.look = d.look ? d.look : CP.Spr.buildLook({ skin: d.skin, hair: d.hair, hairStyle: d.hairStyle, female: d.female, zombie: true, seed: d.seed || zb.id, blood: d.blood },
      (d.outfit || []).map(function (o) { return { id: o.id, color: U.mix(o.color, '#5a5a4a', 0.35) }; }));
    zb.draw = drawZombie;
    return zb;
  }
  function toData(zb) {
    var d = zb.data;
    d.x = zb.x; d.y = zb.y; d.z = zb.z; d.ang = zb.ang; d.hp = zb.hp; d.crawler = zb.crawler;
    d.fakeDead = zb.state === 'fakedead';
    d.state = zb.state === 'wander' ? 'wander' : (zb.state === 'eat' && zb.eat ? 'eat' : 'idle');
    d.eat = d.state === 'eat' ? zb.eat : null;
    return d;
  }
  Z.toData = toData;
  Z.fromData = fromData;

  /* chunk ficou ativo: os zumbis dele só viram entidades quando chegam perto (Z.syncActive) */
  Z.activateChunk = function (ch) { Z.syncT = 0; };
  /* converte dados ↔ entidades conforme a distância ao jogador (só os próximos gastam CPU) */
  Z.syncActive = function () {
    var G = CP.Game, p = G.player;
    var rin = ZC.ACTIVE_IN, rout = ZC.ACTIVE_OUT;
    var i, zb;
    for (i = G.zombies.length - 1; i >= 0; i--) {
      zb = G.zombies[i];
      if (zb.state === 'chase' || zb.state === 'attack' || zb.state === 'bash') { continue; }
      if (Math.abs(zb.x - p.x) > rout || Math.abs(zb.y - p.y) > rout) {
        var ch = W.chunkAt(Math.floor(zb.x), Math.floor(zb.y));
        if (ch) { ch.zombies.push(toData(zb)); ch.saveDirty = true; G.zombies.splice(i, 1); }
      }
    }
    for (var k in G.activeChunks) {
      var c = G.activeChunks[k];
      var arr = c.zombies;
      for (i = arr.length - 1; i >= 0; i--) {
        var d = arr[i];
        if (Math.abs(d.x - p.x) < rin && Math.abs(d.y - p.y) < rin) { G.zombies.push(fromData(d)); arr.splice(i, 1); }
      }
    }
  };
  Z.deactivateChunk = function (ch) {
    var G = CP.Game;
    ch.lastActive = G.state.time;
    var x0 = ch.cx * C.CHUNK, y0 = ch.cy * C.CHUNK;
    for (var i = G.zombies.length - 1; i >= 0; i--) {
      var zb = G.zombies[i];
      if (zb.x >= x0 && zb.x < x0 + C.CHUNK && zb.y >= y0 && zb.y < y0 + C.CHUNK) {
        ch.zombies.push(toData(zb));
        G.zombies.splice(i, 1);
      }
    }
  };
  /* zumbis que saíram da área ativa voltam a ser dados no chunk onde estão */
  Z.storeStrays = function () {
    var G = CP.Game;
    for (var i = G.zombies.length - 1; i >= 0; i--) {
      var zb = G.zombies[i];
      var ch = W.chunkAt(Math.floor(zb.x), Math.floor(zb.y));
      if (!ch) { continue; }
      if (!ch.active) { ch.zombies.push(toData(zb)); ch.saveDirty = true; G.zombies.splice(i, 1); }
    }
  };

  /* ---------- grade espacial ---------- */
  function hkey(x, y) { return (Math.floor(x / 2) & 0xffff) | ((Math.floor(y / 2) & 0xffff) << 16); }
  Z.rebuildHash = rebuildHash;
  function rebuildHash() {
    Z.hash.clear();
    var zs = CP.Game.zombies;
    for (var i = 0; i < zs.length; i++) {
      var zb = zs[i];
      var k = hkey(zb.x, zb.y);
      var a = Z.hash.get(k);
      if (!a) { a = []; Z.hash.set(k, a); }
      a.push(zb);
    }
  }
  /* vizinhos num raio r */
  Z.near = function (x, y, r, out) {
    out = out || [];
    out.length = 0;
    var c0x = Math.floor((x - r) / 2), c1x = Math.floor((x + r) / 2);
    var c0y = Math.floor((y - r) / 2), c1y = Math.floor((y + r) / 2);
    for (var cy = c0y; cy <= c1y; cy++) {
      for (var cx = c0x; cx <= c1x; cx++) {
        var a = Z.hash.get((cx & 0xffff) | ((cy & 0xffff) << 16));
        if (!a) { continue; }
        for (var i = 0; i < a.length; i++) {
          var zb = a[i];
          var dx = zb.x - x, dy = zb.y - y;
          if (dx * dx + dy * dy <= r * r) { out.push(zb); }
        }
      }
    }
    return out;
  };
  var tmpNear = [];
  /* empurra uma entidade para fora dos zumbis (colisão suave) */
  Z.pushApart = function (ent, r) {
    var list = Z.near(ent.x, ent.y, 1.2, tmpNear);
    for (var i = 0; i < list.length; i++) {
      var zb = list[i];
      if (zb === ent || zb.state === 'dead' || isDown(zb) || Math.abs(zb.z - ent.z) > 0.4) { continue; }
      var dx = ent.x - zb.x, dy = ent.y - zb.y;
      var d2 = dx * dx + dy * dy, min = r + ZC.RADIUS;
      if (d2 < min * min && d2 > 1e-6) {
        var d = Math.sqrt(d2);
        var push = (min - d) * 0.5;
        W.moveCircle(ent, dx / d * push, dy / d * push, r);
      }
    }
  };
  function isDown(zb) { return zb.state === 'down' || zb.state === 'fakedead' || zb.state === 'getup' || zb.crawler; }
  Z.isDown = isDown;

  /* ---------- ruído ---------- */
  Z.noise = function (x, y, z, radius, type) {
    var G = CP.Game;
    if (!G || !G.zombies) { return; }
    var mult = ((G.settings && G.settings.hearing) || 1) * ZC.HEARING_MULT;
    var r = radius * mult;
    if (CP.Amb) { CP.Amb.onNoise(x, y, z, radius); }
    if (CP.Anim) { CP.Anim.onNoise(x, y, z, radius); }
    var zs = G.zombies;
    for (var i = 0; i < zs.length; i++) {
      var zb = zs[i];
      if (zb.state === 'dead') { continue; }
      var dx = zb.x - x, dy = zb.y - y;
      var d2 = dx * dx + dy * dy;
      if (d2 > r * r) { continue; }
      // andares diferentes ouvem menos
      if (Math.abs(zb.z - z) > 0.5 && d2 > (r * 0.4) * (r * 0.4)) { continue; }
      if (zb.state === 'chase' && zb.seesPlayer) { continue; }
      var d = Math.sqrt(d2);
      if (zb.state === 'eat') { if (d > r * 0.45) { continue; } zb.eat = null; } // comendo: só barulho bem perto tira a atenção
      var jitter = Math.min(4, d * 0.12);
      zb.target = { x: x + U.randRange(-jitter, jitter), y: y + U.randRange(-jitter, jitter), z: z };
      zb.memT = ZC.MEMORY_SECONDS * ((G.settings && G.settings.memory) || 1);
      if (zb.state === 'fakedead' && d < 4) { zb.state = 'down'; zb.downT = 0.8; } else if (zb.state !== 'down' && zb.state !== 'stagger' && zb.state !== 'fakedead' && zb.state !== 'bash' && zb.state !== 'climb' && zb.state !== 'held') { zb.state = 'investigate'; zb.path = null; zb.repathT = U.randRange(0, 0.4); }
      if (zb.state === 'bash' && type !== 'bash') { zb.path = null; zb.state = 'investigate'; }
    }
    if (r >= 20) {
      for (var k in G.activeChunks) {
        var arr = G.activeChunks[k].zombies;
        for (var j = 0; j < arr.length; j++) {
          var d = arr[j];
          var ddx = x - d.x, ddy = y - d.y, dd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd > r || dd < 1) { continue; }
          var step = Math.min(dd - 2, dd * 0.35);
          var nx = d.x + ddx / dd * step, ny = d.y + ddy / dd * step;
          if (W.tileWalkable(Math.floor(nx), Math.floor(ny), d.z)) { d.x = nx; d.y = ny; d.state = 'wander'; }
        }
      }
    }
    if (CP.FX && radius >= 12) { CP.FX.noiseRing(x, y, z, radius); }
  };

  /* ---------- percepção ---------- */
  function canSeePlayer(zb, p) {
    if (p.dead || p.sleeping && Math.random() < 0.5) { return false; }
    var dz = Math.abs(zb.z - p.z);
    if (dz > 0.45) { return false; }
    var dx = p.x - zb.x, dy = p.y - zb.y;
    var d2 = dx * dx + dy * dy;
    var amb = CP.Time ? CP.Time.ambient() : 1;
    var light = CP.Vis.lightAt(Math.floor(p.x), Math.floor(p.y), W.levelOf(p.z));
    var lit = Math.max(light, p.flashlightOn ? 0.9 : 0);
    var sight = U.lerp(ZC.SIGHT_NIGHT, ZC.SIGHT_DAY, U.clamp((lit - 0.15) / 0.7, 0, 1));
    sight *= (CP.Game.settings.sight || 1) * (p.fx.notice || 1) * (CP.Time ? CP.Time.weather().vis || 1 : 1);
    if (p.sneaking) { sight *= 0.55 - CP.Player.skillLevel(p, 'sneaking') * 0.025; }
    if (!p.moving) { sight *= 0.85; }
    if (W.isIndoor(Math.floor(p.x), Math.floor(p.y), W.levelOf(p.z)) !== W.isIndoor(Math.floor(zb.x), Math.floor(zb.y), W.levelOf(zb.z))) { sight *= 0.7; }
    if (d2 > sight * sight) { return false; }
    var d = Math.sqrt(d2);
    if (d > 1.6 || (p.sneaking && d > 0.45)) { // agachado, dá para chegar perto pelas costas sem ser visto
      var a = Math.atan2(dy, dx);
      var cone = ZC.SIGHT_CONE_DEG * Math.PI / 360;
      if (Math.abs(U.angleDiff(zb.ang, a)) > cone) { return false; }
    }
    return W.lineOfSight(zb.x, zb.y, p.x, p.y, W.levelOf(zb.z), 60);
  }

  /* ---------- atualização ---------- */
  var hashT = 0, strayT = 0, lightT = 1.5;
  /* à noite, luz acesa chama atenção de longe: lanterna ligada ou cômodo iluminado visto pela janela (cortina fechada esconde) */
  Z.playerGlows = function (p) {
    if (!CP.Time || !CP.Time.isNight() || p.dead || p.vehicle) { return false; }
    if (p.flashlightOn || (CP.Time.handFlame && CP.Time.handFlame(p))) { return true; }
    var lz = W.levelOf(p.z), rm = W.room(Math.floor(p.x), Math.floor(p.y), lz);
    return !!(rm && rm.lit && CP.Time.powerAt(Math.floor(p.x), Math.floor(p.y)));
  };
  function lightAttract(p) {
    if (!Z.playerGlows(p)) { return; }
    var zs = CP.Game.zombies, R2 = ZC.LIGHT_ATTRACT * ZC.LIGHT_ATTRACT, lz = W.levelOf(p.z);
    for (var i = 0; i < zs.length; i++) {
      var zb = zs[i];
      if (zb.state !== 'idle' && zb.state !== 'wander') { continue; }
      var d2 = U.dist2(zb.x, zb.y, p.x, p.y);
      if (d2 > R2 || d2 < 4 || Math.abs(zb.z - p.z) > 0.5 || Math.random() > ZC.LIGHT_CHANCE) { continue; }
      var cone = ZC.SIGHT_CONE_DEG * Math.PI / 360;
      if (Math.abs(U.angleDiff(zb.ang, Math.atan2(p.y - zb.y, p.x - zb.x))) > cone) { continue; }   // só quem está olhando para lá
      if (!W.lineOfSight(zb.x, zb.y, p.x, p.y, lz, 60)) { continue; }
      zb.target = { x: p.x + U.randRange(-2, 2), y: p.y + U.randRange(-2, 2), z: p.z };
      zb.memT = ZC.MEMORY_SECONDS * 0.5; zb.state = 'investigate'; zb.path = null; zb.repathT = U.randRange(0, 0.5);
    }
  }
  Z.update = function (dt) {
    var G = CP.Game;
    var p = G.player;
    rebuildHash();
    Z.nodeBudget = 1500;
    Z.tickN = (Z.tickN || 0) + 1;
    var zs = G.zombies;
    var attackers = 0;
    for (var i = 0; i < zs.length; i++) {
      var zb = zs[i];
      // zumbis longe e calmos pensam/andam com menos frequência (nível de detalhe)
      var far = Math.abs(zb.x - p.x) + Math.abs(zb.y - p.y) > 45;
      if (far && (zb.state === 'idle' || zb.state === 'wander' || zb.state === 'fakedead')) {
        zb.lodAcc = (zb.lodAcc || 0) + dt;
        if (((i + Z.tickN) & 3) !== 0) { continue; }
        var ldt = zb.lodAcc; zb.lodAcc = 0;
        updateOne(zb, p, Math.min(ldt, 0.2));
        continue;
      }
      updateOne(zb, p, dt);
      if (zb.crawler && CP.FX) { // rastejante deixa rastro de sangue
        if (zb._tx === undefined) { zb._tx = zb.x; zb._ty = zb.y; }
        if (U.dist2(zb.x, zb.y, zb._tx, zb._ty) > 0.8) { if (Math.random() < 0.6) { CP.FX.drip(zb.x, zb.y, zb.z, U.randRange(1.8, 2.8)); } zb._tx = zb.x; zb._ty = zb.y; }
      }
      if (zb.attackT > 0 && U.dist2(zb.x, zb.y, p.x, p.y) < 2.2) { attackers++; }
    }
    Z.attackers = attackers;
    lightT -= dt;
    if (lightT <= 0) { lightT = 1.5; lightAttract(p); }
    strayT -= dt;
    if (strayT <= 0) { strayT = 2; Z.storeStrays(); }
    Z.syncT = (Z.syncT || 0) - dt;
    if (Z.syncT <= 0) { Z.syncT = 0.5; Z.syncActive(); }
  };

  function speedOf(zb) {
    var base = zb.speedType === 'sprinter' ? ZC.SPEED_SPRINTER : (zb.speedType === 'fast' ? ZC.SPEED_FAST : ZC.SPEED_SHAMBLER);
    if (zb.crawler) { return ZC.SPEED_CRAWL; }
    if (zb.state === 'wander') { return ZC.SPEED_WANDER; }
    if (zb.state === 'investigate' && zb.speedType === 'shambler') { return base * 0.85; }
    return base;
  }

  function updateOne(zb, p, dt) {
    if (zb.state === 'dead') { return; }
    zb.moving = false;
    if (zb.attackCd > 0) { zb.attackCd -= dt; }
    // empurrão/recuo
    if (zb.vx || zb.vy) {
      W.moveCircle(zb, zb.vx * dt, zb.vy * dt, ZC.RADIUS);
      var damp = Math.pow(0.02, dt);
      zb.vx *= damp; zb.vy *= damp;
      if (Math.abs(zb.vx) + Math.abs(zb.vy) < 0.05) { zb.vx = zb.vy = 0; }
    }
    switch (zb.state) {
      case 'fakedead':
        if (U.dist2(zb.x, zb.y, p.x, p.y) < 2.2 * 2.2 && Math.abs(zb.z - p.z) < 0.5 && !p.dead) { zb.state = 'down'; zb.downT = 0.5; zb.target = { x: p.x, y: p.y, z: p.z }; zb.memT = 20; if (CP.Audio) { CP.Audio.groan(zb, true); } }
        return;
      case 'held': // seguro pelo jogador (matar por trás): não reage
        return;
      case 'stagger':
        zb.staggerT -= dt;
        if (zb.staggerT <= 0) { zb.state = zb.target ? 'chase' : 'idle'; }
        return;
      case 'down':
        zb.downT -= dt;
        if (zb.downT <= 0) {
          if (zb.crawler) { zb.state = zb.target ? 'chase' : 'idle'; zb.path = null; } else {
            // levanta devagar: apoia as mãos, fica de joelhos e depois de pé
            zb.state = 'getup'; zb.getDur = zb.getT = (zb.speedType === 'sprinter' ? 0.7 : (zb.speedType === 'fast' ? 1.0 : 1.6)) * U.randRange(0.85, 1.2);
          }
        }
        return;
      case 'getup':
        zb.getT -= dt;
        if (zb.getT <= 0) { zb.state = zb.target ? 'chase' : 'idle'; zb.path = null; }
        return;
      case 'eat':
        updateEat(zb, p, dt);
        return;
      case 'climb':
        zb.climbT -= dt;
        zb.moving = true;
        if (zb.climbT <= 0) { finishClimb(zb); }
        return;
    }
    // pensar (percepção) em intervalos
    zb.thinkT -= dt;
    zb.lastSeenT += dt;
    if (zb.thinkT <= 0) {
      zb.thinkT = ZC.THINK_INTERVAL * (0.8 + Math.random() * 0.4);
      var sees = !p.dead && canSeePlayer(zb, p);
      zb.seesPlayer = sees;
      if (sees) {
        if (zb.state !== 'chase' && zb.state !== 'attack') {
          if (CP.Audio && Math.random() < 0.5) { CP.Audio.groan(zb, true); }
          if (CP.Music && U.dist(zb.x, zb.y, p.x, p.y) < 16) { CP.Music.spotted(); }
        }
        zb.lastSeenT = 0;
        zb.target = { x: p.x, y: p.y, z: p.z };
        zb.memT = ZC.MEMORY_SECONDS * (CP.Game.settings.memory || 1);
        if (zb.state !== 'attack' && zb.state !== 'bash') { zb.state = 'chase'; }
        if (zb.state === 'bash' && zb.bash && !edgeStillBlocks(zb.bash)) { zb.state = 'chase'; zb.bash = null; }
      }
    }
    zb.groanT -= dt;
    if (zb.groanT <= 0) {
      // só os mais próximos gemem (evita um coro constante)
      zb.groanT = U.randRange(12, 35);
      if (CP.Audio && U.dist2(zb.x, zb.y, p.x, p.y) < 20 * 20 && Math.random() < 0.6) { CP.Audio.groan(zb, zb.state === 'chase'); }
    }
    // memória
    if (zb.target && !zb.seesPlayer) {
      zb.memT -= dt;
      if (zb.memT <= 0) { zb.target = null; zb.path = null; zb.state = 'idle'; zb.idleT = U.randRange(3, 12); }
    }
    switch (zb.state) {
      case 'idle':
        zb.idleT -= dt;
        if (zb.idleT <= 0) {
          var meal = Math.random() < 0.5 ? findMeal(zb) : null;
          if (meal) {
            var ma = Math.random() * Math.PI * 2;
            zb.goEat = { x: meal.x, y: meal.y };
            zb.target = { x: meal.x + Math.cos(ma) * 0.7, y: meal.y + Math.sin(ma) * 0.7, z: zb.z };
            zb.memT = 30; zb.state = 'wander'; zb.path = null;
          } else if (Math.random() < 0.55) {
            var a = Math.random() * Math.PI * 2, r = U.randRange(2, 8);
            zb.target = { x: zb.x + Math.cos(a) * r, y: zb.y + Math.sin(a) * r, z: zb.z };
            zb.memT = 14; zb.state = 'wander'; zb.path = null;
          } else { zb.ang += U.randRange(-1.2, 1.2); }
          zb.idleT = U.randRange(4, 14);
        }
        break;
      case 'wander':
      case 'investigate':
      case 'chase':
        moveToTarget(zb, p, dt);
        break;
      case 'attack':
        doAttack(zb, p, dt);
        break;
      case 'bash':
        doBash(zb, dt);
        break;
    }
    // decide atacar
    if ((zb.state === 'chase') && !p.dead && zb.attackCd <= 0 && Math.abs(zb.z - p.z) < 0.45) {
      var d2 = U.dist2(zb.x, zb.y, p.x, p.y);
      var rng = ZC.ATTACK_RANGE + (zb.crawler ? -0.2 : 0);
      if (d2 < rng * rng && W.lineOfSight(zb.x, zb.y, p.x, p.y, W.levelOf(zb.z), 4)) {
        zb.state = 'attack'; zb.attackT = ZC.ATTACK_WINDUP * (zb.speedType === 'sprinter' ? 0.7 : 1);
      }
    }
  }

  function edgeStillBlocks(b) {
    var t = W.edgeType(b.x, b.y, b.z, b.side);
    return W.edgeBlocksMove(t, W.edgeState(b.x, b.y, b.z, b.side));
  }

  function steer(zb, tx, ty, speed, dt) {
    var dx = tx - zb.x, dy = ty - zb.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.02) { return true; }
    var want = Math.atan2(dy, dx);
    zb.ang = U.approachAngle(zb.ang, want, dt * (zb.speedType === 'sprinter' ? 9 : 4.5));
    var step = Math.min(d, speed * dt);
    // anda na direção que está virado (curvas suaves), mas corrige se muito desalinhado
    var face = Math.abs(U.angleDiff(zb.ang, want)) < 0.9 ? zb.ang : want;
    var ox = zb.x, oy = zb.y;
    W.moveCircle(zb, Math.cos(face) * step, Math.sin(face) * step, ZC.RADIUS);
    Z.pushApart(zb, ZC.RADIUS);
    var moved = Math.abs(zb.x - ox) + Math.abs(zb.y - oy);
    if (moved > 0.0005) {
      zb.moving = true;
      zb.phase = (zb.phase + moved * 0.6) % 1;
      zb.stuckT = 0;
    } else {
      zb.stuckT = (zb.stuckT || 0) + dt;
    }
    return d < 0.15;
  }

  function moveToTarget(zb, p, dt) {
    if (!zb.target) { zb.state = 'idle'; return; }
    var t = zb.target;
    var spd = speedOf(zb);
    var zl = W.levelOf(zb.z);
    // perseguindo e vendo o jogador: vai direto
    if (zb.state === 'chase' && zb.seesPlayer && Math.abs(zb.z - p.z) < 0.45 && W.lineOfSight(zb.x, zb.y, p.x, p.y, zl, 3)) {
      zb.path = null;
      steer(zb, p.x, p.y, spd, dt);
      if ((zb.stuckT || 0) > 1.0) { zb.seesPlayer = false; zb.stuckT = 0; }
      return;
    }
    // linha reta livre até o alvo (mesmo nível)? anda direto, sem A*
    var tl = W.levelOf(t.z);
    if (tl === zl && !W.stairAt(Math.floor(zb.x), Math.floor(zb.y))) {
      zb.lineT = (zb.lineT || 0) - dt;
      if (zb.lineT <= 0) {
        zb.lineT = 0.5 + Math.random() * 0.3;
        var dl = U.dist(zb.x, zb.y, t.x, t.y);
        zb.lineOk = dl < 45 && W.walkLine(zb.x, zb.y, t.x, t.y, zl, 60);
      }
      if (zb.lineOk) {
        zb.path = null;
        if (steer(zb, t.x, t.y, spd, dt)) { arrive(zb); }
        if ((zb.stuckT || 0) > 1.2) { zb.lineOk = false; zb.lineT = 3; zb.stuckT = 0; }
        return;
      }
    }
    // segue caminho (A*), com orçamento de nós por passo de simulação
    zb.repathT -= dt;
    var ttx = Math.floor(t.x), tty = Math.floor(t.y);
    if (!zb.path || zb.repathT <= 0 || zb.pathTarget !== ttx * 100000 + tty) {
      if (Z.nodeBudget > 0) {
        zb.repathT = ZC.REPATH_INTERVAL * (0.8 + Math.random() * 0.6) * (zb.state === 'chase' ? 1 : 2.5);
        zb.pathTarget = ttx * 100000 + tty;
        var maxN = zb.state === 'wander' ? 200 : (zb.state === 'chase' ? ZC.PATH_MAX_NODES : 900);
        zb.path = CP.Path.find(Math.floor(zb.x), Math.floor(zb.y), zl, ttx, tty, tl, { doorsPassable: true, fencesPassable: true, partial: true, maxNodes: maxN });
        Z.nodeBudget -= CP.Path.lastNodes + 20;
        zb.pathI = 0;
        if (!zb.path || !zb.path.length) {
          // sem caminho: vai direto
          zb.path = null;
          if (steer(zb, t.x, t.y, spd, dt) || (zb.stuckT || 0) > 2) { arrive(zb); }
          return;
        }
      } else if (!zb.path) {
        if (steer(zb, t.x, t.y, spd, dt)) { arrive(zb); }
        return;
      }
    }
    if (zb.pathI >= zb.path.length) {
      if (steer(zb, t.x, t.y, spd, dt)) { arrive(zb); }
      return;
    }
    var n = zb.path[zb.pathI];
    var cx = Math.floor(zb.x), cy = Math.floor(zb.y);
    // próximo passo atravessa uma borda bloqueada? (porta/janela/cerca)
    if (n.z === zl && (Math.abs(n.x - cx) + Math.abs(n.y - cy) === 1) && W.blockedBetween(cx, cy, n.x, n.y, zl, false)) {
      var e = CP.Path.edgeBetween(cx, cy, n.x, n.y);
      var mx = e.side === 0 ? e.x + 0.5 : e.x, my = e.side === 0 ? e.y : e.y + 0.5;
      var dEdge = U.dist(zb.x, zb.y, mx, my);
      if (dEdge < 0.62) {
        var type = W.edgeType(e.x, e.y, zl, e.side);
        var st = W.edgeState(e.x, e.y, zl, e.side);
        zb.ang = Math.atan2(n.y + 0.5 - zb.y, n.x + 0.5 - zb.x);
        if (type === E.FENCE || (type === E.WINDOW && st && (st.broken || st.open) && !(st.bar > 0))) {
          startClimb(zb, n, type === E.FENCE ? 1.6 : 2.4);
        } else if (type === E.DOOR || type === E.WINDOW || type === E.GARAGE) {
          zb.state = 'bash'; zb.bash = { x: e.x, y: e.y, z: zl, side: e.side }; zb.bashT = ZC.BASH_INTERVAL * Math.random();
        } else {
          zb.path = null; zb.repathT = 0;
        }
        return;
      }
      steer(zb, mx, my, spd, dt);
      return;
    }
    if (steer(zb, n.x + 0.5, n.y + 0.5, spd, dt) || (Math.floor(zb.x) === n.x && Math.floor(zb.y) === n.y && W.levelOf(zb.z) === n.z)) {
      zb.pathI++;
    }
    if ((zb.stuckT || 0) > 1.5) { zb.path = null; zb.repathT = 0; zb.stuckT = 0; }
  }

  function arrive(zb) {
    if (zb.goEat && U.dist(zb.x, zb.y, zb.goEat.x, zb.goEat.y) < 1.5) { startEat(zb, zb.goEat); zb.goEat = null; return; }
    zb.goEat = null;
    if (zb.state === 'wander') { zb.state = 'idle'; zb.target = null; zb.idleT = U.randRange(3, 10); return; }
    // investigou e não achou nada: olha em volta
    if (!zb.seesPlayer) { zb.ang += U.randRange(-1.5, 1.5); }
    if (zb.memT < ZC.MEMORY_SECONDS - 6) { zb.state = 'idle'; zb.target = null; zb.idleT = U.randRange(4, 12); }
  }

  /* ---------- comendo um corpo ---------- */
  /* corpo humano (não zumbi) mais perto, até 7 tiles */
  function findMeal(zb) {
    var G = CP.Game, best = null, bd = 49;
    for (var k in G.activeChunks) {
      var cs = G.activeChunks[k].corpses;
      for (var i = 0; i < cs.length; i++) {
        var c = cs[i];
        if (c.zombie || c.burnt || Math.abs(c.z - zb.z) > 0.5) { continue; }
        var d2 = U.dist2(c.x, c.y, zb.x, zb.y);
        if (d2 < bd) { bd = d2; best = c; }
      }
    }
    return best;
  }
  function startEat(zb, at) {
    zb.state = 'eat'; zb.eat = { x: at.x, y: at.y }; zb.target = null; zb.path = null; zb.eatT = 0;
    zb.ang = Math.atan2(at.y - zb.y, at.x - zb.x);
  }
  Z.startEat = startEat;
  /* ajoelhado comendo: quase não presta atenção (só vê o jogador bem perto) */
  function updateEat(zb, p, dt) {
    zb.moving = false;
    var e = zb.eat;
    if (!e) { zb.state = 'idle'; zb.idleT = U.randRange(2, 6); return; }
    zb.ang = U.approachAngle(zb.ang, Math.atan2(e.y - zb.y, e.x - zb.x), dt * 3);
    zb.eatT = (zb.eatT || 0) + dt;
    zb.thinkT -= dt;
    if (zb.thinkT <= 0) {
      zb.thinkT = 0.5 + Math.random() * 0.3;
      if (!p.dead && !p.dragged && Math.abs(zb.z - p.z) < 0.45) {
        var near = p.sneaking ? 2.2 : 4.5;
        if (U.dist2(zb.x, zb.y, p.x, p.y) < near * near && canSeePlayer(zb, p)) {
          zb.state = 'chase'; zb.seesPlayer = true; zb.lastSeenT = 0; zb.eat = null;
          zb.target = { x: p.x, y: p.y, z: p.z }; zb.memT = ZC.MEMORY_SECONDS * (CP.Game.settings.memory || 1);
          if (CP.Audio) { CP.Audio.groan(zb, true); }
          if (CP.Music) { CP.Music.spotted(); }
          return;
        }
      }
    }
    if (CP.Audio && CP.Audio.chew && Math.random() < dt * 0.45 && U.dist2(zb.x, zb.y, p.x, p.y) < 14 * 14) { CP.Audio.chew(zb.x, zb.y, zb.z); }
  }

  function startClimb(zb, n, time) {
    zb.state = 'climb'; zb.climbT = time; zb.climb = { x: n.x + 0.5, y: n.y + 0.5, z: n.z };
  }
  function finishClimb(zb) {
    var c = zb.climb;
    zb.x = c.x; zb.y = c.y; zb.z = c.z;
    zb.climb = null; zb.pathI++;
    // cair do outro lado da janela: fica caído um instante
    zb.state = 'down'; zb.downT = 0.9;
  }

  function doBash(zb, dt) {
    var b = zb.bash;
    if (!b || !edgeStillBlocks(b)) { zb.state = zb.target ? 'chase' : 'idle'; zb.bash = null; zb.path = null; zb.repathT = 0; return; }
    zb.bashT -= dt;
    zb.moving = false;
    zb.phase = (zb.phase + dt * 1.5) % 1;
    if (zb.bashT > 0) { return; }
    zb.bashT = ZC.BASH_INTERVAL * U.randRange(0.8, 1.2);
    var st = W.edgeState(b.x, b.y, b.z, b.side);
    var type = W.edgeType(b.x, b.y, b.z, b.side);
    if (!st) { st = { open: false, locked: false, hp: type === E.WINDOW ? 8 : 25, bar: 0, barHp: 0, broken: false, glass: type === E.WINDOW }; W.setEdgeState(b.x, b.y, b.z, b.side, st); }
    var dmg = ZC.BASH_DAMAGE * ((CP.Game.settings.strength) || 1) * U.randRange(0.6, 1.4) * (CP.Surv ? CP.Surv.bashMult(st) : 1);
    var mx = b.side === 0 ? b.x + 0.5 : b.x, my = b.side === 0 ? b.y : b.y + 0.5;
    Z.noise(mx, my, b.z, C.NOISE.DOOR_BASH, 'bash');
    if (CP.Audio) { CP.Audio.thump(mx, my, b.z, type === E.WINDOW && !st.bar); }
    if (st.bar > 0) {
      st.barHp -= dmg;
      if (st.barHp <= 0) { st.bar--; st.barHp = st.bar > 0 ? 12 : 0; if (CP.FX) { CP.FX.splinter(mx, my, b.z); } }
    } else {
      st.hp -= dmg;
      if (st.hp <= 0) {
        if (type === E.WINDOW) {
          st.broken = true; st.glass = false;
          Z.noise(mx, my, b.z, C.NOISE.WINDOW_BREAK, 'glass');
          if (CP.Audio) { CP.Audio.glass(mx, my); }
        } else { st.broken = true; st.open = true; if (CP.FX) { CP.FX.splinter(mx, my, b.z); } }
      }
    }
    W.chunkAt(b.x, b.y).dirty = true;
  }

  function doAttack(zb, p, dt) {
    zb.attackT -= dt;
    var a = Math.atan2(p.y - zb.y, p.x - zb.x);
    zb.ang = U.approachAngle(zb.ang, a, dt * 6);
    if (zb.attackT > 0) { return; }
    zb.attackCd = ZC.ATTACK_COOLDOWN * U.randRange(0.85, 1.2);
    zb.state = 'chase';
    var d = U.dist(zb.x, zb.y, p.x, p.y);
    if (CP.Audio && Math.random() < 0.7) { CP.Audio.zombieAttack(zb); }
    if (p.dead || d > ZC.ATTACK_RANGE + 0.35 || Math.abs(zb.z - p.z) > 0.45) { return; }
    if (CP.Combat) { CP.Combat.zombieHits(zb, p); }
  }

  /* ---------- dano / morte ---------- */
  Z.damage = function (zb, amount, fromAng, opts) {
    opts = opts || {};
    if (zb.state === 'dead') { return false; }
    zb.hp -= amount;
    if (CP.FX) { CP.FX.blood(zb.x, zb.y, zb.z, Math.min(3, 1 + amount)); if (fromAng !== undefined && Math.random() < 0.45) { CP.FX.wallBlood(zb.x, zb.y, zb.z, fromAng); } }
    if (zb.hp <= 0) { Z.kill(zb, fromAng, opts.cause); return true; }
    // reação
    if (zb.state === 'fakedead') { zb.state = 'down'; zb.downT = 1; }
    if (opts.knockdown && !zb.crawler) {
      zb.state = 'down'; zb.downT = U.randRange(ZC.DOWN_TIME_MIN, ZC.DOWN_TIME_MAX); zb.attackT = 0;
    } else if (opts.stagger && zb.state !== 'down' && !zb.crawler) {
      zb.state = 'stagger'; zb.staggerT = ZC.STAGGER_TIME * U.randRange(0.7, 1.2); zb.attackT = 0;
    }
    if (opts.knock && fromAng !== undefined) { zb.vx += Math.cos(fromAng) * opts.knock * 3; zb.vy += Math.sin(fromAng) * opts.knock * 3; }
    // perna quebrada vira rastejante às vezes
    if (opts.legs && Math.random() < 0.15) { zb.crawler = true; }
    var p = CP.Game.player;
    zb.target = { x: p.x, y: p.y, z: p.z }; zb.memT = ZC.MEMORY_SECONDS;
    return false;
  };
  Z.kill = function (zb, fromAng, cause) {
    zb.state = 'dead';
    var G = CP.Game;
    var i = G.zombies.indexOf(zb);
    if (i >= 0) { G.zombies.splice(i, 1); }
    var ch = W.chunkAt(Math.floor(zb.x), Math.floor(zb.y));
    var rng = new U.Rng(zb.data.seed || 1);
    var corpse = { x: zb.x, y: zb.y, z: zb.z, ang: fromAng !== undefined ? fromAng + Math.PI : zb.ang, look: zb.look, items: CP.Items.Loot.zombie(zb.data, rng), t: G.state.time, zombie: true };
    if (ch) { ch.corpses.push(corpse); ch.dirty = true; }
    G.state.kills++;
    G.player.kills++;
    if (CP.Audio && cause !== 'car') { CP.Audio.zombieDie(zb); }
    if (CP.FX) { CP.FX.blood(zb.x, zb.y, zb.z, 4); }
    U.emit('zombie:killed', { zombie: zb, cause: cause });
  };

  /* ---------- visibilidade para o jogador ---------- */
  Z.visibleToPlayer = function (zb) {
    var p = CP.Game.player;
    var lz = W.levelOf(zb.z), pl = W.levelOf(p.z);
    var dx = zb.x - p.x, dy = zb.y - p.y;
    var d2 = dx * dx + dy * dy;
    // ouvindo por perto (mesmo pelas costas)
    var hr = C.HEARING_RADIUS * (p.fx.hearing || 1);
    if (d2 < hr * hr && Math.abs(zb.z - p.z) < 1.2 && (zb.moving || zb.state === 'attack' || zb.state === 'bash' || d2 < 4)) { zb.bright = undefined; return true; }
    if (lz !== pl) {
      // escada: vê quem está no outro andar bem perto
      return d2 < 6 && W.stairAt(Math.floor(p.x), Math.floor(p.y)) !== null;
    }
    if (!CP.Vis.isVisible(Math.floor(zb.x), Math.floor(zb.y), lz)) { return false; }
    var light = CP.Vis.lightAt(Math.floor(zb.x), Math.floor(zb.y), lz);
    var nightSee = 4.5 * (p.fx.night || 1);
    if (light < 0.3 && d2 > nightSee * nightSee) { return false; }
    zb.bright = undefined;
    return true;
  };

  /* cadáveres próximos para o desenho */
  var corpseEnts = [];
  Z.pushCorpses = function (list, viewZ) {
    var G = CP.Game;
    var p = G.player;
    corpseEnts.length = 0;
    if (p.dragging) { var dc = p.dragging; dc.age = (G.state.time - dc.t) / 86400; if (!dc.draw) { dc.draw = drawCorpse; } list.push(dc); }
    for (var k in G.activeChunks) {
      var ch = G.activeChunks[k];
      for (var i = ch.corpses.length - 1; i >= 0; i--) {
        var c = ch.corpses[i];
        var ageDays = (G.state.time - c.t) / 86400;
        if (ageDays > 25 && !c.items.length) { ch.corpses.splice(i, 1); continue; }
        c.decay = Math.min(1, Math.max(0, (ageDays - 2) / 12)); c.age = ageDays;
        if (Math.abs(c.x - p.x) > 40 || Math.abs(c.y - p.y) > 40) { continue; }
        if (W.levelOf(c.z) === W.levelOf(p.z) && !CP.Vis.isVisible(Math.floor(c.x), Math.floor(c.y), W.levelOf(c.z)) && U.dist2(c.x, c.y, p.x, p.y) > 9) { continue; }
        if (!c.draw) { c.draw = drawCorpse; }
        list.push(c);
      }
    }
  };

  /* ---------- desenho ---------- */
  function drawZombie(g, sx, sy, bright) {
    var zb = this;
    var pose = {
      ang: zb.ang, phase: zb.phase, moving: zb.moving, run: zb.speedType === 'sprinter' && zb.state === 'chase',
      attack: zb.state === 'attack' ? 1 - zb.attackT / ZC.ATTACK_WINDUP * 0.6 : 0,
      down: zb.state === 'down' || zb.state === 'fakedead', crawl: zb.crawler && zb.state !== 'down' && zb.state !== 'fakedead',
      lunge: zb.state === 'attack', reach: zb.state === 'chase' || zb.state === 'attack' || zb.state === 'bash'
    };
    var now = performance.now() / 1000;
    if (zb.state === 'stagger') { pose.ang += Math.sin(zb.staggerT * 20) * 0.2; pose.stagger = Math.min(1, zb.staggerT / 0.4); pose.t = now; }
    if (zb.state === 'climb') { sy -= 10 * Math.sin((1 - zb.climbT / 2.4) * Math.PI); }
    if (zb.state === 'getup') {
      var gt = 1 - zb.getT / (zb.getDur || 1);
      if (gt < 0.4) { pose.crawl = true; pose.phase = gt * 0.6; } else { pose.kneel = 1 - (gt - 0.4) / 0.6; }
    }
    if (zb.state === 'eat') { pose.kneel = 1; pose.eat = now + (zb.id % 13) * 0.37; pose.reach = false; }
    CP.Spr.drawHuman(g, sx, sy, zb.look, pose, Math.max(0.25, bright));
  }
  function drawCorpse(g, sx, sy, bright) {
    var look = this.look;
    if (this.burnt) { // carbonizado
      if (!this.bLook) { this.bLook = Object.assign({}, look, { skin: '#2c241e', shirt: '#1e1a16', jacket: look.jacket ? '#1a1612' : null, pants: '#221c18', hair: '#141210', hat: null, blood: null }); }
      CP.Spr.drawHuman(g, sx, sy, this.bLook, { ang: this.ang, dead: true, phase: 0 }, Math.max(0.2, bright * 0.9));
      return;
    }
    var age = this.age || 0;
    if (age > 1.5) {
      // apodrecendo: incha e esverdeia, depois escurece e por fim só sobram ossos e trapos
      var st = age < 6 ? 1 : (age < 14 ? 2 : 3), k = Math.round(age);
      if (!this.dLook || this.dLookAt !== k) {
        this.dLookAt = k;
        var bloat = U.clamp((age - 1.5) / 4.5, 0, 1), rot = U.clamp((age - 6) / 8, 0, 1);
        var skin = st === 3 ? '#cfc6ae' : U.mix(U.mix(look.skin, '#7d8a5c', bloat * 0.75), '#4a3e2e', rot * 0.85);
        var dark = function (c, a) { return c ? U.mix(c, '#2e2a24', a) : c; };
        this.dLook = Object.assign({}, look, { skin: skin, shirt: dark(look.shirt || '#777', 0.15 + rot * 0.45), jacket: dark(look.jacket, 0.15 + rot * 0.45), pants: dark(look.pants, 0.1 + rot * 0.4),
          hairStyle: st === 3 ? 'careca' : look.hairStyle, beard: st === 3 ? false : look.beard, skeleton: st === 3, gloves: st === 3 ? null : look.gloves, blood: st >= 2 ? null : look.blood });
      }
      look = this.dLook;
      // poça escura de decomposição embaixo do corpo
      var pa = st === 1 ? 0.12 : (st === 2 ? 0.28 : 0.18);
      g.fillStyle = 'rgba(30,24,16,' + (pa * Math.max(0.3, bright)).toFixed(2) + ')'; g.beginPath(); g.ellipse(sx, sy, 22, 9, 0, 0, Math.PI * 2); g.fill();
    }
    CP.Spr.drawHuman(g, sx, sy, look, { ang: this.ang, dead: true, phase: 0 }, Math.max(0.2, bright * 0.9));
    if (CP.Amb) { CP.Amb.drawFlies(g, sx, sy, this, bright); }
  }

  /* ---------- migração e reaparecimento (chamado uma vez por dia de jogo) ---------- */
  Z.daily = function () {
    var G = CP.Game;
    var all = W.allChunks();
    var rng = U.rng;
    var settings = G.settings || {};
    for (var i = 0; i < all.length; i++) {
      var ch = all[i];
      if (ch.active || ch.type === 0) { continue; }
      // migração: alguns andam para um chunk vizinho
      if (ch.zombies.length > 3) {
        var move = Math.floor(ch.zombies.length * 0.12);
        for (var k = 0; k < move; k++) {
          var dir = rng.int(0, 3);
          var nx = ch.cx + [1, -1, 0, 0][dir], ny = ch.cy + [0, 0, 1, -1][dir];
          var nb = W.chunkByIndex(nx, ny);
          if (!nb || nb.active || nb.type === 0) { continue; }
          var zd = ch.zombies.pop();
          zd.x = nx * C.CHUNK + rng.range(2, C.CHUNK - 2); zd.y = ny * C.CHUNK + rng.range(2, C.CHUNK - 2); zd.z = 0;
          if (!W.tileWalkable(Math.floor(zd.x), Math.floor(zd.y), 0)) { ch.zombies.push(zd); continue; }
          nb.zombies.push(zd); nb.saveDirty = true; ch.saveDirty = true;
        }
      }
      // reaparecimento lento onde o jogador limpou, se faz mais de 3 dias que não passa por lá
      if (settings.respawn !== false && ch.initialZ && ch.zombies.length < ch.initialZ * 0.4 && (G.state.time - (ch.lastActive || 0)) > 3 * 86400) {
        var add = rng.int(1, 3);
        for (var a = 0; a < add; a++) {
          var x = ch.cx * C.CHUNK + rng.int(0, C.CHUNK - 1), y = ch.cy * C.CHUNK + rng.int(0, C.CHUNK - 1);
          if (!W.tileWalkable(x, y, 0) || W.isIndoor(x, y, 0)) { continue; }
          ch.zombies.push(Z.makeData(rng, x + 0.5, y + 0.5, 0, null, null));
        }
      }
    }
  };

  CP.Zombies = Z;
})(window.CP = window.CP || {});
