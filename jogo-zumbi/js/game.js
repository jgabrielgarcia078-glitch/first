/* Núcleo: estado da partida, loop com passo fixo, ativação de chunks, câmera, visão. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W;

  var G = {
    running: false, paused: false, over: false,
    state: null,          // dados salváveis da partida
    player: null,
    zombies: [],          // zumbis ativos (entidades)
    effects: [],          // efeitos visuais temporários
    texts: [],            // textos flutuantes
    settings: { popMult: 1, zombieSpeed: 'shambler', infection: true, dayMinutes: C.REAL_MINUTES_PER_DAY },
    speedIndex: 0,
    acc: 0, last: 0, frame: 0,
    fovTimer: 0, lightTimer: 0, activateTimer: 0,
    fps: 0, fpsAcc: 0, fpsFrames: 0,
    activeChunks: {},
    viewDebug: false
  };

  /* ---------- tempo de jogo ---------- */
  G.gameSecondsPerReal = function () { return 86400 / (G.settings.dayMinutes * 60); };
  G.speed = function () {
    var p = G.player;
    if (p && p.sleeping) { return C.SLEEP_SPEED; }
    return C.GAME_SPEEDS[G.speedIndex] || 1;
  };

  /* ---------- nova partida ---------- */
  G.newGame = function (opts) {
    var seed = opts.seed >>> 0 || ((Math.random() * 4294967295) >>> 0);
    G.settings = Object.assign({}, G.settings, opts.settings || {});
    W.init(seed);
    G.state = {
      version: C.SCHEMA_VERSION, seed: seed,
      time: 0,                                   // segundos de jogo desde o início
      startDate: Date.UTC(C.START_YEAR, C.START_MONTH, C.START_DAY, C.START_HOUR),
      kills: 0, settings: G.settings,
      world: CP.Time ? CP.Time.newWorldState(seed) : {}
    };
    G.zombies = []; G.effects = []; G.texts = []; G.activeChunks = {};
    if (CP.Vehicles) { CP.Vehicles.reset(); }
    var spawn = G.findSpawn(seed, opts.townIndex);
    W.ensureAround(Math.floor(spawn.x), Math.floor(spawn.y), C.LOAD_RADIUS);
    G.player = CP.Player.create(opts.character || {}, spawn.x, spawn.y, spawn.z || 0);
    // nenhum zumbi colado no jogador no começo
    G.clearAround(spawn.x, spawn.y, spawn.z || 0, 9);
    G.afterLoad();
  };

  G.afterLoad = function () {
    var p = G.player;
    CP.Render.camX = p.x; CP.Render.camY = p.y; CP.Render.camZ = p.z;
    G.activateChunks(true);
    G.updateFov(true);
    G.over = false; G.paused = false;
    G.running = true;
    U.emit('game:start');
  };

  /* ponto inicial: dentro de uma casa na cidade escolhida (ou na primeira) */
  G.findSpawn = function (seed, townIndex) {
    var m = W.macro;
    var t = m.towns[townIndex || 0] || m.towns[0];
    var rng = new U.Rng(seed ^ 0xabc);
    for (var attempt = 0; attempt < 60; attempt++) {
      var cx = t.x + rng.int(-t.r + 1, t.r - 1), cy = t.y + rng.int(-t.r + 1, t.r - 1);
      var ch = W.ensureChunk(cx, cy);
      if (!ch || !ch.buildings.length) { continue; }
      var houses = ch.buildings.filter(function (b) { return b.kind === 'house'; });
      if (!houses.length) { continue; }
      var b = rng.pick(houses);
      // um tile livre dentro, de preferência quarto ou sala
      for (var k = 0; k < 80; k++) {
        var x = b.x + rng.int(0, b.w - 1), y = b.y + rng.int(0, b.h - 1);
        if (W.isIndoor(x, y, 0) && W.tileWalkable(x, y, 0) && !W.stairAt(x, y)) {
          return { x: x + 0.5, y: y + 0.5, z: 0, bld: b };
        }
      }
    }
    // fallback: meio da cidade, na rua
    return { x: t.x * C.CHUNK + 2.5, y: t.y * C.CHUNK + 2.5, z: 0 };
  };

  /* remove zumbis dentro de um raio (início de jogo) */
  G.clearAround = function (x, y, z, r) {
    var cx = Math.floor(x) >> W.chunkShift, cy = Math.floor(y) >> W.chunkShift;
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        var ch = W.chunkByIndex(cx + dx, cy + dy);
        if (!ch) { continue; }
        ch.zombies = ch.zombies.filter(function (zd) { return U.dist(zd.x, zd.y, x, y) > r; });
      }
    }
    G.zombies = G.zombies.filter(function (zb) { return U.dist(zb.x, zb.y, x, y) > r; });
  };

  /* ---------- chunks ativos ---------- */
  G.activateChunks = function (force) {
    var p = G.player;
    var pcx = Math.floor(p.x) >> W.chunkShift, pcy = Math.floor(p.y) >> W.chunkShift;
    var want = {};
    var genBudget = force ? 999 : 2;
    for (var dy = -C.LOAD_RADIUS; dy <= C.LOAD_RADIUS; dy++) {
      for (var dx = -C.LOAD_RADIUS; dx <= C.LOAD_RADIUS; dx++) {
        var cx = pcx + dx, cy = pcy + dy;
        var ch = W.chunkByIndex(cx, cy);
        if (!ch) {
          if (genBudget <= 0) { continue; }
          ch = W.ensureChunk(cx, cy); genBudget--;
          if (!ch) { continue; }
        }
        var k = cx + ',' + cy;
        want[k] = ch;
        if (!G.activeChunks[k]) {
          G.activeChunks[k] = ch;
          ch.active = true;
          ch.saveDirty = true;
          if (CP.Zombies) { CP.Zombies.activateChunk(ch); }
          if (CP.Vehicles) { CP.Vehicles.activateChunk(ch); }
        }
      }
    }
    // desativa chunks longe
    for (var key in G.activeChunks) {
      var c = G.activeChunks[key];
      if (Math.abs(c.cx - pcx) > C.UNLOAD_RADIUS || Math.abs(c.cy - pcy) > C.UNLOAD_RADIUS) {
        if (CP.Zombies) { CP.Zombies.deactivateChunk(c); }
        if (CP.Vehicles) { CP.Vehicles.deactivateChunk(c); }
        c.active = false;
        delete G.activeChunks[key];
      }
    }
  };

  /* ---------- visão ---------- */
  G.updateFov = function (force) {
    var p = G.player;
    var lv = W.levelOf(p.z);
    var nightMult = CP.Time ? CP.Time.visionMult() : 1;
    CP.Vis.compute(p.x, p.y, lv, p.ang, { radius: C.VISION_RADIUS, cone: C.VISION_CONE_DEG, near: C.VISION_NEAR, nightMult: nightMult });
    G.updateLight();
  };
  G.updateLight = function () {
    var p = G.player;
    var amb = CP.Time ? CP.Time.ambient() : 1;
    var power = CP.Time ? CP.Time.powerOn() : true;
    var sources = CP.Time ? CP.Time.lightSources(p) : [];
    CP.Vis.computeLight(amb, sources, power);
  };

  /* ---------- loop ---------- */
  G.start = function () {
    G.last = performance.now();
    requestAnimationFrame(G.loop);
  };
  G.loop = function (now) {
    var dtReal = Math.min(0.25, (now - G.last) / 1000);
    G.last = now;
    G.fpsAcc += dtReal; G.fpsFrames++;
    if (G.fpsAcc >= 0.5) { G.fps = Math.round(G.fpsFrames / G.fpsAcc); G.fpsAcc = 0; G.fpsFrames = 0; }
    try {
      if (G.running) { G.frameUpdate(dtReal); }
      if (CP.UI) { CP.UI.frame(dtReal); }
    } catch (err) {
      console.error(err);
      if (CP.UI && CP.UI.fatal) { CP.UI.fatal(err); }
      G.running = false;
    }
    requestAnimationFrame(G.loop);
  };

  var STEP = 1 / C.TICK_RATE;
  G.frameUpdate = function (dtReal) {
    if (CP.UI) { CP.UI.handleInput(); }
    if (!G.paused && !G.over) {
      var spd = G.speed();
      var sleeping = G.player.sleeping;
      // dormindo: o tempo passa rápido mas a simulação física segue em passos normais
      var simSpd = sleeping ? 1 : spd;
      G.acc += dtReal * simSpd;
      var steps = 0;
      while (G.acc >= STEP && steps < 12) {
        G.tick(STEP, sleeping ? spd : 1);
        G.acc -= STEP; steps++;
        if (G.over) { break; }
      }
      if (steps >= 12) { G.acc = 0; }
    }
    G.updateCamera(dtReal);
    G.lastDt = dtReal;
    G.render();
    G.frame++;
  };

  /* dt = segundos "reais" simulados; timeMult = multiplicador extra para o relógio (sono) */
  G.tick = function (dt, timeMult) {
    var gameDt = dt * G.gameSecondsPerReal() * timeMult;
    G.state.time += gameDt;
    var p = G.player;
    CP.Player.update(p, dt, gameDt);
    if (CP.Zombies) { CP.Zombies.update(dt); }
    if (CP.Time) { CP.Time.update(dt, gameDt); }
    if (CP.Body) { CP.Body.update(p, dt, gameDt); }
    if (CP.Use) { CP.Use.updateFires(dt); }
    if (p.sayT > 0) { p.sayT -= dt; }
    // efeitos
    for (var i = G.effects.length - 1; i >= 0; i--) {
      var ef = G.effects[i];
      ef.t += dt;
      if (ef.t >= ef.life) { G.effects.splice(i, 1); }
    }
    for (var j = G.texts.length - 1; j >= 0; j--) {
      G.texts[j].t += dt;
      if (G.texts[j].t > G.texts[j].life) { G.texts.splice(j, 1); }
    }
    G.activateTimer -= dt;
    if (G.activateTimer <= 0) { G.activateTimer = 0.4; G.activateChunks(false); }
    G.fovTimer -= dt;
    var tile = Math.floor(p.x) * 100000 + Math.floor(p.y);
    if (G.fovTimer <= 0 || tile !== G.lastFovTile || Math.abs(U.angleDiff(p.ang, G.lastFovAng || 0)) > 0.25) {
      G.fovTimer = 0.15; G.lastFovTile = tile; G.lastFovAng = p.ang;
      G.updateFov();
    }
  };

  G.updateCamera = function (dt) {
    var p = G.player;
    var R = CP.Render;
    var k = 1 - Math.pow(0.0015, dt);
    // olha um pouco para onde o mouse aponta ao mirar
    var tx = p.x, ty = p.y;
    if (p.aiming && CP.Input.mouse) {
      var m = R.toWorld(CP.Input.mouse.x, CP.Input.mouse.y, p.z);
      tx += (m.x - p.x) * 0.25; ty += (m.y - p.y) * 0.25;
    }
    R.camX += (tx - R.camX) * k; R.camY += (ty - R.camY) * k; R.camZ += (p.z - R.camZ) * k;
    if (Math.abs(R.camX - tx) > 20 || Math.abs(R.camY - ty) > 20) { R.camX = tx; R.camY = ty; }
  };

  /* ---------- desenho ---------- */
  var drawList = [];
  G.render = function () {
    var p = G.player;
    var viewZ = W.levelOf(p.z);
    var bld = W.building(Math.floor(p.x), Math.floor(p.y), viewZ);
    var onStairs = !!W.stairAt(Math.floor(p.x), Math.floor(p.y));
    if (onStairs) { bld = W.building(Math.floor(p.x), Math.floor(p.y), 0); }
    var indoor = !!bld;
    drawList.length = 0;
    if (!p.vehicle) { drawList.push(p); }
    if (CP.Vehicles) {
      var cars = CP.Vehicles.active;
      for (var ci = 0; ci < cars.length; ci++) {
        var car = cars[ci];
        if (Math.abs(car.x - p.x) > 40 || Math.abs(car.y - p.y) > 40) { continue; }
        car.bright = undefined;
        drawList.push(car);
      }
    }
    var V = CP.Vis;
    for (var i = 0; i < G.zombies.length; i++) {
      var zb = G.zombies[i];
      if (CP.Zombies.visibleToPlayer(zb)) { drawList.push(zb); }
    }
    if (CP.Zombies) { CP.Zombies.pushCorpses(drawList, viewZ); }
    CP.Render.draw({
      viewZ: viewZ,
      maxZ: indoor ? (onStairs ? 1 : viewZ) : C.LEVELS - 1,
      px: p.x, py: p.y, bld: bld,
      ents: drawList,
      decals: CP.FX ? CP.FX.drawDecals : null,
      overlay: G.drawOverlay
    });
    var R = CP.Render;
    R.g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    if (CP.FX) { CP.FX.drawScreen(R.g, R.w, R.h, G.lastDt || 0.016); }
    if (V) { V.lastDraw = G.frame; }
  };

  /* sobreposições em coordenadas de mundo: efeitos, mira, construção */
  G.drawOverlay = function (g) {
    if (CP.FX) { CP.FX.drawOverlay(g); }
    var p = G.player;
    if (CP.UI && CP.UI.drawBuildGhost) { CP.UI.drawBuildGhost(g); }
    if (p.aiming && !p.dead) {
      var wp = CP.Combat.weaponOf(p);
      var HW = C.TILE_W / 2, HH = C.TILE_H / 2;
      var sx = HW * (p.x - p.y), sy = HH * (p.x + p.y) - p.z * C.WALL_H - 32;
      var m = CP.Render.toWorld(CP.Input.mouse.x, CP.Input.mouse.y, p.z);
      var range = wp && wp.def.gun ? wp.def.gun.range : (p.hand1 && CP.D.ITEMS[p.hand1.id].throwable ? 9 : 1.4);
      var a = Math.atan2(m.y - p.y, m.x - p.x);
      var ex = p.x + Math.cos(a) * range, ey = p.y + Math.sin(a) * range;
      g.strokeStyle = 'rgba(255,240,200,0.35)'; g.lineWidth = 1.5; g.setLineDash([6, 6]);
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(HW * (ex - ey), HH * (ex + ey) - p.z * C.WALL_H - 32); g.stroke();
      g.setLineDash([]);
    }
  };

  CP.Game = G;
})(window.CP = window.CP || {});
