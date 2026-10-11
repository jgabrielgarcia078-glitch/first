/* Mundo vivo ao redor: erosão (o mundo envelhecendo), neve acumulada e pegadas, vento (árvores balançando, folhas e papéis
 * voando), corvos que levantam voo quando algo se aproxima e moscas nos corpos.
 * Só a neve acumulada vai para o save (state.world.snow); pegadas, folhas e pássaros são efêmeros. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W;
  var HW = C.TILE_W / 2, HH = C.TILE_H / 2, WH = C.WALL_H;

  var A = { prints: [], debris: [], flocks: [], flying: [], respawnT: 4, audioT: 0, flyCorpse: null };

  function G() { return CP.Game; }
  function ws() { return G().state.world; }
  function ready() { var g = G(); return !!(g && g.state && g.state.world && g.player); }

  /* ---------- erosão: 0 (recém-abandonado) .. 1 (tomado pelo mato) ---------- */
  A.erosion = function () {
    if (!ready()) { return C.EROSION.BASE; }
    var w = ws();
    if (w.erosionOverride !== undefined) { return w.erosionOverride; }
    var E = C.EROSION, d = G().state.time / 86400;
    return U.clamp(E.BASE + (1 - E.BASE) * (d - E.START_DAY) / E.DAYS_FULL, E.BASE, 1);
  };
  /* ---------- neve acumulada (0..1) ---------- */
  A.snow = function () { return ready() ? (ws().snow || 0) : 0; };
  /* ---------- vento: força 0..1 (pelo clima, com rajadas) e direção (radianos no mundo) ---------- */
  A.wind = function () {
    if (!ready()) { return 0; }
    var type = ws().weather.type;
    var base = C.WIND[type] !== undefined ? C.WIND[type] : 0.2;
    var t = G().state.time / 3600;
    return U.clamp(base * (0.75 + 0.25 * Math.sin(t * 2.1) * Math.sin(t * 0.7 + 1.3)), 0, 1);
  };
  A.windAng = function () { return ready() ? 0.6 + Math.sin(G().state.time / 86400 * 1.3) * 0.8 : 0.6; };
  /* inclinação de árvores/arbustos/capim neste quadro (fração da altura) */
  A.sway = function (x, y, amp) {
    var w = A.wind();
    if (w < 0.03) { return 0; }
    var t = performance.now() / 1000, ph = (x * 1.7 + y * 2.3) % 6.28, an = A.windAng();
    var dir = Math.cos(an) - Math.sin(an) >= 0 ? 1 : -1; // para que lado da tela o vento empurra
    return w * amp * (dir * (0.55 + 0.45 * Math.sin(t * 1.9 + ph)) + 0.25 * Math.sin(t * 5.3 + ph * 2));
  };

  /* ---------- atualização (passo de simulação) ---------- */
  A.update = function (dt, gameDt) {
    if (!ready()) { return; }
    var w = ws(), T = CP.Time;
    // neve: acumula enquanto neva, derrete acima de MELT_TEMP (mais rápido com chuva)
    var wt = T.weather(), hrs = gameDt / 3600, sn = w.snow || 0;
    if (wt.snow) { sn += C.SNOW.PER_HOUR * hrs; } else {
      var temp = T.temperature(true);
      if (temp > C.SNOW.MELT_TEMP) { sn -= C.SNOW.MELT_PER_HOUR * hrs * (1 + (temp - C.SNOW.MELT_TEMP) * 0.15) * (wt.rain > 0 ? 2 : 1); }
    }
    w.snow = U.clamp(sn, 0, 1);
    // chão molhado / poças: enchem com a chuva e secam devagar (mais rápido no calor)
    var wet = w.groundWet || 0;
    if (wt.rain > 0 && !wt.snow) { wet += C.PUDDLES.FILL_PER_HOUR * wt.rain * hrs; } else { wet -= C.PUDDLES.DRY_PER_HOUR * hrs * (1 + Math.max(0, T.temperature(true) - 10) * 0.05); }
    w.groundWet = U.clamp(wet, 0, 1);
    updatePrints(gameDt, wt);
    updateDebris(dt);
    updateBirds(dt);
    A.audioT -= dt;
    if (A.audioT <= 0) { A.audioT = 0.5; updateAudio(); }
  };

  /* ---------- pegadas na neve ---------- */
  function stepPrint(e, kind, spacing) {
    var lp = e._pr;
    if (!lp) { e._pr = { x: e.x, y: e.y, s: 0 }; return; }
    var dx = e.x - lp.x, dy = e.y - lp.y, d2 = dx * dx + dy * dy;
    if (d2 < spacing * spacing) { return; }
    lp.x = e.x; lp.y = e.y; lp.s = 1 - lp.s;
    if (d2 > 9) { return; } // teleporte / carregou o jogo
    if (W.levelOf(e.z) !== 0) { return; }
    var tx = Math.floor(e.x), ty = Math.floor(e.y);
    if (W.isIndoor(tx, ty, 0) || W.floor(tx, ty, 0) === C.FLOOR.WATER) { return; }
    A.prints.push({ x: e.x, y: e.y, a: Math.atan2(dy, dx), s: lp.s, t: G().state.time, k: kind });
    if (A.prints.length > C.SNOW.MAX_PRINTS) { A.prints.splice(0, A.prints.length - C.SNOW.MAX_PRINTS); }
  }
  function updatePrints(gameDt, wt) {
    var snow = A.snow();
    var life = C.SNOW.FOOTPRINT_LIFE_H * 3600;
    if (A.prints.length) {
      // neve nova cobre as pegadas; derretida, somem
      var now = G().state.time, fill = wt.snow ? gameDt * 3 : 0;
      for (var i = A.prints.length - 1; i >= 0; i--) {
        var pr = A.prints[i];
        pr.t -= fill;
        if (now - pr.t > life || snow < 0.05) { A.prints.splice(i, 1); }
      }
    }
    if (snow < C.SNOW.FOOTPRINT_MIN) { return; }
    var p = G().player;
    if (!p.vehicle && !p.dead) { stepPrint(p, 'foot', 0.55); }
    var zs = G().zombies;
    for (var k = 0; k < zs.length; k++) {
      var zb = zs[k];
      if (zb.state === 'dead' || Math.abs(zb.x - p.x) > 26 || Math.abs(zb.y - p.y) > 26) { continue; }
      stepPrint(zb, zb.crawler ? 'drag' : 'foot', 0.55);
    }
    if (CP.Vehicles) { CP.Vehicles.active.forEach(function (car) { if (Math.abs(car.speed) > 0.3) { stepPrint(car, 'tire', 0.45); } }); }
  }
  /* desenhadas logo depois dos pisos (com o sangue) */
  A.drawPrints = function (g, lv) {
    if (!A.prints.length) { return; }
    var p = G().player, now = G().state.time, life = C.SNOW.FOOTPRINT_LIFE_H * 3600, snow = Math.min(1, A.snow() * 1.6);
    for (var i = 0; i < A.prints.length; i++) {
      var pr = A.prints[i];
      if (Math.abs(pr.x - p.x) > 34 || Math.abs(pr.y - p.y) > 34) { continue; }
      var al = (1 - (now - pr.t) / life) * snow;
      if (al <= 0.04) { continue; }
      var b = CP.Vis.brightness(Math.floor(pr.x), Math.floor(pr.y), 0, lv);
      var c = Math.round(55 + 55 * b), cb = Math.round(75 + 70 * b);
      g.fillStyle = 'rgba(' + c + ',' + (c + 8) + ',' + cb + ',' + Math.min(0.85, 0.9 * al).toFixed(2) + ')';
      var ca = Math.cos(pr.a), sa = Math.sin(pr.a);
      if (pr.k === 'tire') {
        for (var w = -1; w <= 1; w += 2) {
          var tx = pr.x - sa * 0.33 * w, ty = pr.y + ca * 0.33 * w;
          var x0 = HW * (tx - ty), y0 = HH * (tx + ty);
          var ex = HW * (ca - sa) * 0.25, ey = HH * (ca + sa) * 0.25;
          g.beginPath(); g.moveTo(x0 - ex, y0 - ey - 1.5); g.lineTo(x0 + ex, y0 + ey - 1.5); g.lineTo(x0 + ex, y0 + ey + 1.5); g.lineTo(x0 - ex, y0 - ey + 1.5); g.closePath(); g.fill();
        }
        continue;
      }
      var side = pr.s ? 1 : -1, off = pr.k === 'drag' ? 0 : 0.12;
      var fx = pr.x - sa * off * side, fy = pr.y + ca * off * side;
      var X = HW * (fx - fy), Y = HH * (fx + fy);
      g.beginPath();
      if (pr.k === 'drag') { g.ellipse(X, Y, 6, 2.4, Math.atan2(HH * (ca + sa), HW * (ca - sa)), 0, Math.PI * 2); } else { g.ellipse(X, Y, 4.2, 2.1, Math.atan2(HH * (ca + sa), HW * (ca - sa)), 0, Math.PI * 2); }
      g.fill();
    }
  };

  /* ---------- folhas e papéis levados pelo vento ---------- */
  var LEAVES = [['#5a7a34', '#6a8a3a', '#4e6a2c'], ['#b85a20', '#d8902a', '#9a2a1a', '#c0a030'], ['#7a6a4a', '#8a7a5a'], ['#6a8a3a', '#7aa040', '#c890a8']];
  function spawnDebris(p, anywhere) {
    var ang = A.windAng(), r = 18;
    var x, y;
    if (anywhere) { x = p.x + U.randRange(-r, r); y = p.y + U.randRange(-r, r); } else {
      var side = U.randRange(-r, r);
      x = p.x - Math.cos(ang) * r - Math.sin(ang) * side; y = p.y - Math.sin(ang) * r + Math.cos(ang) * side;
    }
    var season = CP.Render.season || 0, paper = U.chance(season === 1 ? 0.15 : (season === 2 ? 0.7 : 0.4));
    return { x: x, y: y, h: U.randRange(2, 26), k: U.randRange(0.6, 1.3), f: U.randRange(1, 3), ph: U.randRange(0, 6.28), paper: paper, col: paper ? U.pick(['#d8d4c8', '#c8c0a8', '#e0dcd0', '#b0a890']) : U.pick(LEAVES[season]), spin: U.randRange(4, 11) };
  }
  function updateDebris(dt) {
    var p = G().player, wind = A.wind();
    var want = W.levelOf(p.z) === 0 ? Math.round(Math.max(0, wind - 0.12) * 34) : 0;
    if (CP.Time.raining() && !CP.Time.weather().snow) { want = Math.round(want * 0.4); }
    if (!A.debris.length && want) { while (A.debris.length < want) { A.debris.push(spawnDebris(p, true)); } }
    var ang = A.windAng(), sp = 1.2 + wind * 3.4, ca = Math.cos(ang), sa = Math.sin(ang), t = performance.now() / 1000;
    for (var i = A.debris.length - 1; i >= 0; i--) {
      var d = A.debris[i];
      d.x += (ca * sp * d.k + Math.sin(t * d.f + d.ph) * 0.4) * dt;
      d.y += (sa * sp * d.k + Math.cos(t * d.f * 0.8 + d.ph) * 0.4) * dt;
      d.h = Math.max(0, d.h + Math.sin(t * d.f * 1.3 + d.ph) * 14 * dt - (wind < 0.3 ? 6 * dt : 0));
      if (Math.abs(d.x - p.x) > 20 || Math.abs(d.y - p.y) > 20) {
        if (A.debris.length > want) { A.debris.splice(i, 1); } else { A.debris[i] = spawnDebris(p, false); }
      }
    }
    while (A.debris.length < want && U.chance(dt * 6)) { A.debris.push(spawnDebris(p, false)); }
  }
  function drawDebris(g) {
    if (!A.debris.length) { return; }
    var V = CP.Vis, t = performance.now() / 1000;
    for (var i = 0; i < A.debris.length; i++) {
      var d = A.debris[i], tx = Math.floor(d.x), ty = Math.floor(d.y);
      if (!V.isVisible(tx, ty, 0) || W.isIndoor(tx, ty, 0)) { continue; }
      var b = V.brightness(tx, ty, 0, 0);
      var X = HW * (d.x - d.y), Y = HH * (d.x + d.y) - d.h;
      var s = Math.abs(Math.cos(t * d.spin + d.ph));
      g.fillStyle = U.shade(d.col, Math.max(0.25, b));
      if (d.paper) { g.fillRect(X - 3 * s, Y - 2, 6 * s + 1, 4); } else { g.fillRect(X - 1.5 * s, Y - 1, 3 * s + 1, 2); }
      if (d.h > 3) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(X - 1, Y + d.h, 3, 1); }
    }
  }

  /* ---------- corvos ---------- */
  function outdoorGround(x, y) {
    var tx = Math.floor(x), ty = Math.floor(y);
    if (W.isIndoor(tx, ty, 0)) { return false; }
    var f = W.floor(tx, ty, 0);
    if (!f || f === C.FLOOR.WATER || !C.FLOOR_WALKABLE[f]) { return false; }
    var o = W.obj(tx, ty, 0);
    return !(o && C.OBJ_INFO[o].solid);
  }
  function spawnFlock() {
    var g = G(), p = g.player, T = CP.Time;
    if (T.isNight() || T.weather().rain >= 1 || A.snow() > 0.9) { return; }
    var cands = [];
    for (var k in g.activeChunks) {
      var ch = g.activeChunks[k];
      for (var i = 0; i < ch.corpses.length; i++) {
        var c = ch.corpses[i], d = U.dist(c.x, c.y, p.x, p.y);
        if (c.z === 0 && d > 10 && d < 34 && outdoorGround(c.x, c.y)) { cands.push(c); }
      }
    }
    var x = 0, y = 0, found = false;
    if (cands.length && U.chance(0.75)) { var cp = U.pick(cands); x = cp.x + U.randRange(-1, 1); y = cp.y + U.randRange(-1, 1); found = true; }
    for (var tries = 0; !found && tries < 25; tries++) {
      var a = U.randRange(0, Math.PI * 2), dd = U.randRange(14, 32);
      x = p.x + Math.cos(a) * dd; y = p.y + Math.sin(a) * dd;
      found = outdoorGround(x, y);
    }
    if (!found || !outdoorGround(x, y)) { return; }
    if (CP.Vis.isVisible(Math.floor(x), Math.floor(y), 0) && U.dist(x, y, p.x, p.y) < 22) { return; } // não aparece do nada na frente do jogador
    A.spawnFlockAt(x, y, U.randInt(3, 6));
  }
  A.spawnFlockAt = function (x, y, n) {
    var birds = [];
    for (var b = 0; b < n; b++) { birds.push({ ox: U.randRange(-0.9, 0.9), oy: U.randRange(-0.9, 0.9), ph: U.randRange(0, 6.28), dir: U.chance(0.5) ? 1 : -1 }); }
    var fl = { x: x, y: y, z: 0, birds: birds, kind: 'birds', draw: drawFlock, t: 0 };
    A.flocks.push(fl);
    return fl;
  };
  /* espanta o bando: todos levantam voo para longe da ameaça (tx, ty) */
  function scare(fl, tx, ty) {
    var away = Math.atan2(fl.y - ty, fl.x - tx);
    fl.birds.forEach(function (b) {
      var a = away + U.randRange(-0.7, 0.7), sp = U.randRange(4, 6.5);
      A.flying.push({ x: fl.x + b.ox, y: fl.y + b.oy, h: 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vh: U.randRange(45, 75), ph: U.randRange(0, 6.28), t: 0 });
    });
    if (CP.Audio && CP.Audio.crows) { CP.Audio.crows(fl.x, fl.y, fl.birds.length); }
    A.flocks.splice(A.flocks.indexOf(fl), 1);
    A.respawnT = Math.max(A.respawnT, C.BIRDS.RESPAWN_S * U.randRange(0.6, 1.3));
  }
  A.scareFlocks = function (x, y, r) {
    for (var i = A.flocks.length - 1; i >= 0; i--) { var fl = A.flocks[i]; if (U.dist(fl.x, fl.y, x, y) < r) { scare(fl, x, y); } }
  };
  /* barulho no mundo (chamado por Zombies.noise) */
  A.onNoise = function (x, y, z, r) { if (W.levelOf(z || 0) === 0 && r > 3) { A.scareFlocks(x, y, Math.min(r * 0.8, 30)); } };
  function updateBirds(dt) {
    var g = G(), p = g.player, B = C.BIRDS;
    A.respawnT -= dt;
    if (A.respawnT <= 0) { A.respawnT = U.randRange(6, 14); if (A.flocks.length < B.FLOCKS) { spawnFlock(); } }
    for (var i = A.flocks.length - 1; i >= 0; i--) {
      var fl = A.flocks[i];
      fl.t += dt;
      var d = U.dist(fl.x, fl.y, p.x, p.y);
      if (d > 48) { A.flocks.splice(i, 1); continue; }
      var near = B.SCARE_DIST * (p.sneaking ? 0.55 : 1) * (p.running ? 1.4 : 1) * (p.vehicle ? 2.2 : 1);
      if (d < near && W.levelOf(p.z) === 0) { scare(fl, p.x, p.y); continue; }
      var zs = CP.Zombies.near(fl.x, fl.y, B.ZOMBIE_SCARE_DIST, []);
      var zt = null;
      for (var k = 0; k < zs.length; k++) { if (zs[k].state !== 'dead' && W.levelOf(zs[k].z) === 0 && !CP.Zombies.isDown(zs[k])) { zt = zs[k]; break; } }
      if (zt) { scare(fl, zt.x, zt.y); continue; }
      if (CP.Time.isNight() && U.chance(dt * 0.05)) { scare(fl, fl.x + 1, fl.y + 1); }
    }
    for (var j = A.flying.length - 1; j >= 0; j--) {
      var f = A.flying[j];
      f.t += dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.h += f.vh * dt; f.vh = Math.max(8, f.vh - 30 * dt);
      if (f.t > 14 || U.dist(f.x, f.y, p.x, p.y) > 45) { A.flying.splice(j, 1); }
    }
  }
  function drawBird(g, X, Y, b, bright, t) {
    var col = 'rgb(' + Math.round(20 + 18 * bright) + ',' + Math.round(20 + 18 * bright) + ',' + Math.round(24 + 20 * bright) + ')';
    var peck = Math.max(0, Math.sin(t * 2.2 + b.ph * 3)) > 0.85 ? 3 : 0;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(X, Y + 1, 6, 2.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = col;
    g.fillRect(X - 1.5, Y - 2, 1, 3); g.fillRect(X + 1, Y - 2, 1, 3);                                // pernas
    g.beginPath(); g.ellipse(X, Y - 5, 5.6, 3.4, b.dir * 0.3, 0, Math.PI * 2); g.fill();            // corpo
    g.beginPath(); g.moveTo(X - b.dir * 4, Y - 6); g.lineTo(X - b.dir * 10, Y - 8); g.lineTo(X - b.dir * 9.5, Y - 4.5); g.closePath(); g.fill(); // cauda
    var hx = X + b.dir * 4.6, hy = Y - 8 + peck;
    g.beginPath(); g.arc(hx, hy, 2.7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a443c'; g.beginPath(); g.moveTo(hx + b.dir * 2, hy - 1); g.lineTo(hx + b.dir * 5.5, hy + 0.5); g.lineTo(hx + b.dir * 2, hy + 1); g.closePath(); g.fill(); // bico
    g.fillStyle = 'rgba(255,255,255,' + (0.12 + 0.12 * bright).toFixed(2) + ')'; g.beginPath(); g.ellipse(X - b.dir * 0.5, Y - 6.5, 3, 1.2, b.dir * 0.3, 0, Math.PI * 2); g.fill(); // brilho das penas
  }
  function drawFlock(g, sx, sy, bright) {
    var fl = this, t = performance.now() / 1000;
    for (var i = 0; i < fl.birds.length; i++) {
      var b = fl.birds[i];
      if (Math.sin(t * 0.7 + b.ph) > 0.92) { b.dir = -b.dir; b.ph += 1; } // vira de vez em quando
      var X = sx + HW * (b.ox - b.oy), Y = sy + HH * (b.ox + b.oy);
      drawBird(g, X, Y, b, bright, t);
    }
  }
  A.pushEnts = function (list, viewZ) {
    if (viewZ !== 0) { return; }
    for (var i = 0; i < A.flocks.length; i++) {
      var fl = A.flocks[i];
      if (CP.Vis.isVisible(Math.floor(fl.x), Math.floor(fl.y), 0)) { list.push(fl); }
    }
  };
  /* pássaros voando e folhas: por cima de tudo */
  A.drawOverlay = function (g) {
    if (!ready()) { return; }
    var p = G().player;
    if (W.levelOf(p.z) === 0) { drawDebris(g); }
    if (!A.flying.length) { return; }
    var t = performance.now() / 1000, amb = CP.Vis.ambientOut || 1;
    var c = Math.round(18 + 16 * amb);
    for (var i = 0; i < A.flying.length; i++) {
      var f = A.flying[i];
      var X = HW * (f.x - f.y), Y = HH * (f.x + f.y), Yb = Y - f.h;
      g.fillStyle = 'rgba(0,0,0,' + Math.max(0, 0.18 - f.h / 900).toFixed(3) + ')';
      g.beginPath(); g.ellipse(X, Y, 4, 1.6, 0, 0, Math.PI * 2); g.fill();
      var flap = Math.sin(t * 22 + f.ph) * 6;
      g.strokeStyle = 'rgb(' + c + ',' + c + ',' + (c + 4) + ')'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(X - 9, Yb - flap); g.quadraticCurveTo(X - 4, Yb - flap * 0.3 - 2, X, Yb); g.quadraticCurveTo(X + 4, Yb - flap * 0.3 - 2, X + 9, Yb - flap); g.stroke();
      g.fillStyle = g.strokeStyle; g.beginPath(); g.ellipse(X, Yb, 3.2, 2, 0, 0, Math.PI * 2); g.fill();
    }
  };

  /* ---------- moscas sobre corpos velhos ---------- */
  function hasFlies(c) {
    var age = G().state.time - (c.t || 0);
    return age > 3 * 3600 && !c.burnt;
  }
  A.drawFlies = function (g, sx, sy, c, bright) {
    if (!ready() || !hasFlies(c) || A.snow() > 0.5) { return; }
    var t = performance.now() / 1000, n = bright < 0.35 ? 2 : 6, seed = ((c.x * 13 + c.y * 7) * 100) | 0;
    g.fillStyle = 'rgba(15,15,12,0.85)';
    for (var i = 0; i < n; i++) {
      var sp = 2.5 + (seed + i * 37) % 5 * 0.6, a = t * sp + i * 1.9 + seed;
      var r = 6 + ((seed >> 2) + i * 11) % 8;
      g.fillRect(sx + Math.cos(a) * r, sy - 8 - Math.abs(Math.sin(a * 1.7)) * 9 + Math.sin(a) * r * 0.35, 1.5, 1.5);
    }
  };

  /* ---------- sons do ambiente: vento e zumbido de moscas ---------- */
  function updateAudio() {
    var Au = CP.Audio;
    if (!Au || !Au.wind) { return; }
    var g = G(), p = g.player, lv = W.levelOf(p.z);
    var outdoor = !W.isIndoor(Math.floor(p.x), Math.floor(p.y), lv);
    Au.wind(A.wind(), outdoor);
    // corpo com moscas mais perto (até 6 tiles, mesmo andar)
    var best = null, bd = 6;
    for (var k in g.activeChunks) {
      var ch = g.activeChunks[k];
      for (var i = 0; i < ch.corpses.length; i++) {
        var c = ch.corpses[i];
        if (W.levelOf(c.z) !== lv || Math.abs(c.x - p.x) > 6 || Math.abs(c.y - p.y) > 6 || !hasFlies(c)) { continue; }
        var d = U.dist(c.x, c.y, p.x, p.y);
        if (d < bd) { bd = d; best = c; }
      }
    }
    if (Au.flies) { Au.flies(best && !CP.Time.isNight() ? (1 - bd / 6) : 0, best ? U.clamp(((best.x - p.x) - (best.y - p.y)) / 8, -0.9, 0.9) : 0); }
  }

  A.wetness = function () { return ready() ? (ws().groundWet || 0) : 0; };
  A.reset = function () { A.prints.length = 0; A.debris.length = 0; A.flocks.length = 0; A.flying.length = 0; A.respawnT = 4; };

  CP.Amb = A;
})(window.CP = window.CP || {});
