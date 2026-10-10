/* Geração procedural do mundo (determinística pela semente).
 * Nível macro: grade WORLD_CHUNKS×WORLD_CHUNKS de "quarteirões" (1 chunk cada) com tipo e estradas.
 * Nível de chunk: pisos, estradas, lotes, casas/lojas com cômodos, móveis, natureza, zumbis. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W;
  var CH = C.CHUNK, WC = C.WORLD_CHUNKS, RW = C.ROAD_W;
  var F = C.FLOOR, E = C.EDGE, O = C.OBJ;

  var T = { BORDER: 0, FOREST: 1, FIELD: 2, FARM: 3, TOWN: 4, DOWNTOWN: 5, LAKE: 6 };
  var TOWN_NAMES_A = ['Ash', 'Brook', 'Cedar', 'Elm', 'Fair', 'Glen', 'Green', 'Har', 'Lake', 'Maple', 'Mill', 'Oak', 'Pine', 'Red', 'River', 'Rose', 'Spring', 'Stone', 'Willow', 'West'];
  var TOWN_NAMES_B = ['ford', 'field', 'ville', 'wood', 'dale', 'ton', 'brook', 'haven', 'ridge', 'view', 'burg', 'port', ' Falls', ' Point', ' Creek', ' Hill'];
  var SHOP_TYPES = [
    ['grocery', 5], ['pharmacy', 3], ['hardware', 3], ['diner', 3], ['clothes', 2], ['bar', 2], ['office', 3],
    ['gunstore', 1], ['bookstore', 1], ['electronics', 1], ['parking', 3], ['warehouse', 2]
  ];

  var G = { T: T };

  /* ================= MACRO ================= */
  G.genMacro = function (seed) {
    var rng = new U.Rng(U.hash2(seed, 77, 991));
    var N = WC;
    var m = {
      n: N, type: new Uint8Array(N * N), roadN: new Uint8Array(N * N), roadW: new Uint8Array(N * N),
      townId: new Uint8Array(N * N), towns: [], feature: new Uint8Array(N * N)
    };
    var nTowns = rng.int(C.TOWN_COUNT_MIN, C.TOWN_COUNT_MAX);
    var tries = 0;
    while (m.towns.length < nTowns && tries < 2000) {
      tries++;
      var tx = rng.int(5, N - 6), ty = rng.int(5, N - 6);
      var ok = true;
      for (var i = 0; i < m.towns.length; i++) {
        if (U.dist(tx, ty, m.towns[i].x, m.towns[i].y) < C.TOWN_MIN_DIST) { ok = false; break; }
      }
      if (!ok) { continue; }
      var r = m.towns.length === 0 ? C.TOWN_RADIUS_MAX : rng.int(C.TOWN_RADIUS_MIN, C.TOWN_RADIUS_MAX);
      var name;
      do { name = rng.pick(TOWN_NAMES_A) + rng.pick(TOWN_NAMES_B); } while (m.towns.some(function (t) { return t.name === name; }));
      m.towns.push({ x: tx, y: ty, r: r, name: name, police: false });
    }
    var x, y, k;
    for (y = 0; y < N; y++) {
      for (x = 0; x < N; x++) {
        k = y * N + x;
        if (x < C.BORDER_CHUNKS || y < C.BORDER_CHUNKS || x >= N - C.BORDER_CHUNKS || y >= N - C.BORDER_CHUNKS) { m.type[k] = T.BORDER; continue; }
        var best = -1, bestD = 1e9;
        for (var t = 0; t < m.towns.length; t++) {
          var tw = m.towns[t];
          var d = U.dist(x, y, tw.x, tw.y) / tw.r + (U.fbm(x * 0.35, y * 0.35, seed + 5, 3) - 0.5) * 0.5;
          if (d < bestD) { bestD = d; best = t; }
        }
        if (bestD <= 0.45 && m.towns[best].r >= 3) { m.type[k] = T.DOWNTOWN; m.townId[k] = best + 1; } else if (bestD <= 1.0) { m.type[k] = T.TOWN; m.townId[k] = best + 1; } else {
          var lake = U.fbm(x * 0.17, y * 0.17, seed + 11, 3);
          var forest = U.fbm(x * 0.12, y * 0.12, seed + 23, 4);
          if (lake > 0.70) { m.type[k] = T.LAKE; } else if (forest > 0.52) { m.type[k] = T.FOREST; } else if (bestD < 2.2 && rng.chance(0.35)) { m.type[k] = T.FARM; } else { m.type[k] = T.FIELD; }
        }
      }
    }
    // ruas da cidade: grade completa
    for (y = 1; y < N - 1; y++) {
      for (x = 1; x < N - 1; x++) {
        k = y * N + x;
        if (m.type[k] === T.TOWN || m.type[k] === T.DOWNTOWN) {
          m.roadN[k] = 1; m.roadW[k] = 1;
          m.roadW[k + 1] = 1; m.roadN[k + N] = 1;
        }
      }
    }
    // rodovias: árvore geradora mínima entre cidades + uma ligação extra
    var connected = [0], edges = [];
    while (connected.length < m.towns.length) {
      var bi = -1, bj = -1, bd = 1e9;
      for (var a = 0; a < connected.length; a++) {
        for (var b = 0; b < m.towns.length; b++) {
          if (connected.indexOf(b) >= 0) { continue; }
          var dd = U.dist(m.towns[connected[a]].x, m.towns[connected[a]].y, m.towns[b].x, m.towns[b].y);
          if (dd < bd) { bd = dd; bi = connected[a]; bj = b; }
        }
      }
      edges.push([bi, bj]); connected.push(bj);
    }
    if (m.towns.length > 3) { edges.push([0, m.towns.length - 1]); }
    edges.forEach(function (e) { G.routeRoad(m, m.towns[e[0]], m.towns[e[1]], rng); });
    // lago não pode ter estrada; borda não tem estrada
    for (k = 0; k < N * N; k++) {
      if (m.type[k] === T.LAKE && (m.roadN[k] || m.roadW[k])) { m.type[k] = T.FIELD; }
      if (m.type[k] === T.BORDER) { m.roadN[k] = 0; m.roadW[k] = 0; }
    }
    // recursos especiais: postos, casas isoladas, delegacia por cidade
    for (y = 1; y < N - 1; y++) {
      for (x = 1; x < N - 1; x++) {
        k = y * N + x;
        var ty2 = m.type[k];
        var hasRoad = m.roadN[k] || m.roadW[k];
        if ((ty2 === T.FIELD || ty2 === T.FOREST) && hasRoad) {
          var h = U.hash2(x, y, seed + 4242) / 4294967296;
          if (h < 0.10) { m.feature[k] = 1; } else if (h < 0.26) { m.feature[k] = 2; }
        }
        if (ty2 === T.FARM) { m.feature[k] = 3; }
      }
    }
    m.towns.forEach(function (tw, ti) {
      // delegacia: um quarteirão de cidade perto do centro
      var cands = [];
      for (var yy = tw.y - 2; yy <= tw.y + 2; yy++) {
        for (var xx = tw.x - 2; xx <= tw.x + 2; xx++) {
          var kk = yy * N + xx;
          if (m.townId[kk] === ti + 1) { cands.push(kk); }
        }
      }
      if (cands.length) { m.feature[rng.pick(cands)] = 4; tw.police = true; }
      if (cands.length > 3) {
        var kc = rng.pick(cands);
        if (!m.feature[kc]) { m.feature[kc] = 5; }  // clínica
      }
    });
    return m;
  };

  G.routeRoad = function (m, A, B, rng) {
    var N = m.n;
    var x, y;
    var bendFirstH = rng.chance(0.5);
    var ax = A.x, ay = A.y, bx = B.x, by = B.y;
    if (bendFirstH) {
      for (x = Math.min(ax, bx); x < Math.max(ax, bx); x++) { m.roadN[ay * N + x] = 1; }
      for (y = Math.min(ay, by); y < Math.max(ay, by); y++) { m.roadW[y * N + bx] = 1; }
    } else {
      for (y = Math.min(ay, by); y < Math.max(ay, by); y++) { m.roadW[y * N + ax] = 1; }
      for (x = Math.min(ax, bx); x < Math.max(ax, bx); x++) { m.roadN[by * N + x] = 1; }
    }
  };

  G.macroType = function (m, bx, by) {
    if (bx < 0 || by < 0 || bx >= m.n || by >= m.n) { return T.BORDER; }
    return m.type[by * m.n + bx];
  };
  G.macroRoadN = function (m, bx, by) { return (bx >= 0 && by >= 0 && bx < m.n && by < m.n) ? m.roadN[by * m.n + bx] : 0; };
  G.macroRoadW = function (m, bx, by) { return (bx >= 0 && by >= 0 && bx < m.n && by < m.n) ? m.roadW[by * m.n + bx] : 0; };
  G.isTownType = function (t) { return t === T.TOWN || t === T.DOWNTOWN; };

  /* ================= CHUNK ================= */
  function Ctx(chunk, rng, seed) {
    this.c = chunk; this.rng = rng; this.seed = seed;
    this.ox = chunk.cx * CH; this.oy = chunk.cy * CH;
    this.reserved = new Uint8Array(CH * CH);   // tiles onde não pode ter móveis/natureza
    this.road = new Uint8Array(CH * CH);
  }
  Ctx.prototype.L = function (z) { return this.c.levels[z]; };
  Ctx.prototype.i = function (lx, ly) { return ly * CH + lx; };
  Ctx.prototype.inside = function (lx, ly) { return lx >= 0 && ly >= 0 && lx < CH && ly < CH; };
  Ctx.prototype.setFloor = function (lx, ly, z, f, v) {
    if (!this.inside(lx, ly)) { return; }
    var l = this.L(z), i = this.i(lx, ly);
    l.floor[i] = f; l.fvar[i] = v === undefined ? (this.rng.next() * 4) | 0 : v;
  };
  Ctx.prototype.floor = function (lx, ly, z) { return this.inside(lx, ly) ? this.L(z).floor[this.i(lx, ly)] : 0; };
  Ctx.prototype.setObj = function (lx, ly, z, o, dir) {
    if (!this.inside(lx, ly)) { return; }
    var l = this.L(z), i = this.i(lx, ly);
    l.obj[i] = o; l.odir[i] = dir || 0;
  };
  Ctx.prototype.obj = function (lx, ly, z) { return this.inside(lx, ly) ? this.L(z).obj[this.i(lx, ly)] : 0; };
  Ctx.prototype.edge = function (lx, ly, z, side, type, style) {
    if (!this.inside(lx, ly)) { return; }
    var l = this.L(z), i = this.i(lx, ly);
    if (side === 0) { l.wn[i] = type; l.wns[i] = style || 0; } else { l.ww[i] = type; l.wws[i] = style || 0; }
  };
  Ctx.prototype.getEdge = function (lx, ly, z, side) {
    if (!this.inside(lx, ly)) { return 0; }
    var l = this.L(z), i = this.i(lx, ly);
    return side === 0 ? l.wn[i] : l.ww[i];
  };
  Ctx.prototype.edgeState = function (lx, ly, z, side, st) {
    this.c.edges[(z * CH * CH + this.i(lx, ly)) * 2 + side] = st;
  };
  Ctx.prototype.room = function (lx, ly, z) { return this.inside(lx, ly) ? this.L(z).room[this.i(lx, ly)] : 0; };

  G.genChunk = function (cx, cy, seed, m) {
    var chunk = W.newChunk(cx, cy);
    var rng = new U.Rng(U.hash2(cx, cy, seed ^ 0x51ed));
    var ctx = new Ctx(chunk, rng, seed);
    var type = G.macroType(m, cx, cy);
    var k = cy * m.n + cx;
    chunk.type = type;
    chunk.townId = m.townId[k];
    baseTerrain(ctx, type, m);
    paintRoads(ctx, m, cx, cy, type);
    borderFences(ctx, m, cx, cy, type);
    var feat = m.feature[k];
    if (type === T.TOWN && feat !== 4 && feat !== 5) { genResidentialBlock(ctx, m, cx, cy); } else if (type === T.DOWNTOWN || feat === 4 || feat === 5) { genDowntownBlock(ctx, m, cx, cy, feat); } else if (feat === 1) { genGasStation(ctx, m, cx, cy); } else if (feat === 2) { genRuralHouse(ctx, m, cx, cy); } else if (feat === 3) { genFarm(ctx, m, cx, cy); }
    nature(ctx, type);
    roadProps(ctx, m, cx, cy, type);
    spawnZombies(ctx, type, feat);
    stories(ctx, m, cx, cy, type);
    chunk.initialZ = chunk.zombies.length;
    chunk.dirty = true;
    return chunk;
  };

  /* ---------- Terreno base ---------- */
  function baseTerrain(ctx, type, m) {
    var lx, ly;
    for (ly = 0; ly < CH; ly++) {
      for (lx = 0; lx < CH; lx++) {
        var wx = ctx.ox + lx, wy = ctx.oy + ly;
        var n = U.fbm(wx * 0.08, wy * 0.08, ctx.seed + 3, 3);
        var f = n > 0.62 ? F.DARKGRASS : (n < 0.3 ? F.DIRT : F.GRASS);
        if (type === T.BORDER) { f = n > 0.5 ? F.DIRT : F.GRAVEL; }
        if (type === T.LAKE) {
          var dx = (lx - CH / 2) / (CH * 0.42), dy = (ly - CH / 2) / (CH * 0.42);
          var d = Math.sqrt(dx * dx + dy * dy) + (U.fbm(wx * 0.15, wy * 0.15, ctx.seed + 9, 3) - 0.5) * 0.7;
          if (d < 0.78) { f = F.WATER; } else if (d < 0.92) { f = F.SAND; }
        }
        ctx.setFloor(lx, ly, 0, f);
      }
    }
  }

  /* ---------- Estradas ---------- */
  function paintRoads(ctx, m, cx, cy, type) {
    var rn = G.macroRoadN(m, cx, cy), rw = G.macroRoadW(m, cx, cy);
    var corner = rn || rw || G.macroRoadN(m, cx - 1, cy) || G.macroRoadW(m, cx, cy - 1);
    var town = G.isTownType(type);
    var lx, ly;
    function asphalt(x, y, line) {
      ctx.setFloor(x, y, 0, line ? F.ASPHALT_LINE : F.ASPHALT, line || 0);
      ctx.road[ctx.i(x, y)] = 1; ctx.reserved[ctx.i(x, y)] = 1;
    }
    if (rn) {
      for (lx = 0; lx < CH; lx++) {
        for (ly = 0; ly < RW; ly++) { asphalt(lx, ly, (ly === 2 && lx >= RW && (lx & 3) < 2) ? 1 : 0); }
      }
    }
    if (rw) {
      for (ly = 0; ly < CH; ly++) {
        for (lx = 0; lx < RW; lx++) { asphalt(lx, ly, (lx === 2 && ly >= RW && (ly & 3) < 2) ? 2 : 0); }
      }
    }
    if (corner) { for (ly = 0; ly < RW; ly++) { for (lx = 0; lx < RW; lx++) { asphalt(lx, ly, 0); } } }
    // calçadas em cidade
    if (town) {
      var rs = G.macroRoadN(m, cx, cy + 1), re = G.macroRoadW(m, cx + 1, cy);
      for (var t2 = 0; t2 < CH; t2++) {
        if (rn && t2 >= RW) { sidewalk(ctx, t2, RW); }
        if (rw && t2 >= RW) { sidewalk(ctx, RW, t2); }
        if (rs && t2 >= RW) { sidewalk(ctx, t2, CH - 1); }
        if (re && t2 >= RW) { sidewalk(ctx, CH - 1, t2); }
      }
    }
  }
  function sidewalk(ctx, lx, ly) {
    if (ctx.road[ctx.i(lx, ly)]) { return; }
    ctx.setFloor(lx, ly, 0, F.SIDEWALK);
    ctx.reserved[ctx.i(lx, ly)] = 1;
  }

  function borderFences(ctx, m, cx, cy, type) {
    var isB = type === T.BORDER;
    var westB = G.macroType(m, cx - 1, cy) === T.BORDER;
    var northB = G.macroType(m, cx, cy - 1) === T.BORDER;
    var i;
    if (isB !== westB) { for (i = 0; i < CH; i++) { ctx.edge(0, i, 0, 1, E.FENCE_TALL, 0); } }
    if (isB !== northB) { for (i = 0; i < CH; i++) { ctx.edge(i, 0, 0, 0, E.FENCE_TALL, 0); } }
    if (isB) {
      // barreiras militares (caixotes e barris) perto da cerca
      for (i = 0; i < 6; i++) {
        var lx = ctx.rng.int(2, CH - 3), ly = ctx.rng.int(2, CH - 3);
        if (!ctx.reserved[ctx.i(lx, ly)]) { ctx.setObj(lx, ly, 0, ctx.rng.chance(0.5) ? O.CRATE : O.BARREL); ctx.reserved[ctx.i(lx, ly)] = 1; }
      }
    }
  }

  /* ---------- Natureza ---------- */
  function nature(ctx, type) {
    var dens = { 0: 0.01, 1: 0.32, 2: 0.03, 3: 0.015, 4: 0.0, 5: 0.0, 6: 0.04 }[type];
    for (var ly = 0; ly < CH; ly++) {
      for (var lx = 0; lx < CH; lx++) {
        var i = ctx.i(lx, ly);
        if (ctx.reserved[i] || ctx.L(0).obj[i] || ctx.L(0).room[i]) { continue; }
        var f = ctx.L(0).floor[i];
        if (f !== F.GRASS && f !== F.DARKGRASS && f !== F.DIRT && f !== F.SAND) { continue; }
        var wx = ctx.ox + lx, wy = ctx.oy + ly;
        var local = dens * (0.4 + U.fbm(wx * 0.11, wy * 0.11, ctx.seed + 17, 2) * 1.3);
        var r = ctx.rng.next();
        if (r < local) {
          ctx.setObj(lx, ly, 0, ctx.rng.chance(type === T.FOREST ? 0.45 : 0.25) ? O.TREE_PINE : O.TREE, ctx.rng.int(0, 3));
        } else if (r < local + (type === T.FOREST ? 0.08 : 0.025)) {
          ctx.setObj(lx, ly, 0, O.BUSH, ctx.rng.int(0, 3));
        } else if (r < local + (type === T.FOREST ? 0.16 : 0.07) && f !== F.SAND) {
          ctx.setObj(lx, ly, 0, O.TALL_GRASS, ctx.rng.int(0, 3));
        } else if (r < local + 0.17 && type === T.FOREST && ctx.rng.chance(0.06)) {
          ctx.setObj(lx, ly, 0, ctx.rng.chance(0.5) ? O.LOG : O.ROCK, ctx.rng.int(0, 3));
        }
      }
    }
  }

  function roadProps(ctx, m, cx, cy, type) {
    var town = G.isTownType(type);
    var rn = G.macroRoadN(m, cx, cy), rw = G.macroRoadW(m, cx, cy);
    if (town) {
      if (rn) { for (var x = 8; x < CH; x += 10) { placeIfFree(ctx, x, RW, O.LAMPPOST, 0); } }
      if (rw) { for (var y = 8; y < CH; y += 10) { placeIfFree(ctx, RW, y, O.LAMPPOST, 0); } }
    }
    // carros abandonados nas estradas
    var nCars = town ? ctx.rng.int(0, 2) : (rn || rw ? ctx.rng.int(0, 1) : 0);
    for (var n = 0; n < nCars; n++) {
      if (rn && (!rw || ctx.rng.chance(0.5))) {
        var cxl = ctx.rng.int(RW + 2, CH - 4), cyl = ctx.rng.chance(0.5) ? 1 : 3;
        placeCar(ctx, cxl, cyl, 0);
      } else if (rw) {
        var cy2 = ctx.rng.int(RW + 2, CH - 4), cx2 = ctx.rng.chance(0.5) ? 1 : 3;
        placeCar(ctx, cx2, cy2, 1);
      }
    }
  }
  /* carro ocupa 2 tiles: dir 0 = horizontal (x, x+1), 1 = vertical (y, y+1). odir: bit0 dir, bit1 parte, bits 2-5 cor */
  function placeCar(ctx, lx, ly, dir) {
    var lx2 = dir === 0 ? lx + 1 : lx, ly2 = dir === 0 ? ly : ly + 1;
    if (!ctx.inside(lx2, ly2) || ctx.obj(lx, ly, 0) || ctx.obj(lx2, ly2, 0)) { return false; }
    var color = ctx.rng.int(0, 11);
    ctx.setObj(lx, ly, 0, O.CAR, dir | 0 | (color << 2));
    ctx.setObj(lx2, ly2, 0, O.CAR, dir | 2 | (color << 2));
    return true;
  }
  G.placeCar = placeCar;
  function placeIfFree(ctx, lx, ly, o, dir) {
    if (!ctx.inside(lx, ly) || ctx.obj(lx, ly, 0)) { return false; }
    ctx.setObj(lx, ly, 0, o, dir);
    ctx.reserved[ctx.i(lx, ly)] = 1;
    return true;
  }

  /* ================= CONSTRUÇÕES ================= */
  /* Retângulo r = {x, y, w, h} em coordenadas locais. front: 'N','S','E','W'. */
  function newRoom(ctx, type, bld, z) {
    var rooms = ctx.c.rooms;
    rooms.push({ type: type, bld: bld, z: z, lit: ctx.rng.chance(0.3) });
    return rooms.length - 1;
  }
  function newBuilding(ctx, r, kind, floors) {
    ctx.c.buildings.push({ x: ctx.ox + r.x, y: ctx.oy + r.y, w: r.w, h: r.h, kind: kind, floors: floors, alarm: ctx.rng.chance(C.EVENTS.ALARM_CHANCE) });
    return ctx.c.buildings.length - 1;
  }

  /* paredes externas de um retângulo, em um nível */
  function outerWalls(ctx, r, z, style) {
    for (var x = r.x; x < r.x + r.w; x++) { ctx.edge(x, r.y, z, 0, E.WALL, style); ctx.edge(x, r.y + r.h, z, 0, E.WALL, style); }
    for (var y = r.y; y < r.y + r.h; y++) { ctx.edge(r.x, y, z, 1, E.WALL, style); ctx.edge(r.x + r.w, y, z, 1, E.WALL, style); }
  }
  function fillRoom(ctx, r, z, roomId, floorType) {
    for (var y = r.y; y < r.y + r.h; y++) {
      for (var x = r.x; x < r.x + r.w; x++) {
        if (!ctx.inside(x, y)) { continue; }
        ctx.setFloor(x, y, z, floorType);
        ctx.L(z).room[ctx.i(x, y)] = roomId;
        if (z === 0) { ctx.reserved[ctx.i(x, y)] = 1; }
        ctx.L(z).obj[ctx.i(x, y)] = 0;
      }
    }
  }
  /* BSP: divide r em salas, retorna folhas e lista de divisões (paredes com porta) */
  function bsp(ctx, r, minSize, maxArea, out, splits, depth) {
    var canV = r.w >= minSize * 2 + 0, canH = r.h >= minSize * 2 + 0;
    var area = r.w * r.h;
    if ((!canV && !canH) || (area <= maxArea && (depth > 0 || ctx.rng.chance(0.2))) || depth > 4) { out.push(r); return; }
    var vertical;
    if (canV && canH) { vertical = r.w > r.h ? true : (r.h > r.w ? false : ctx.rng.chance(0.5)); } else { vertical = canV; }
    var a, b, pos;
    if (vertical) {
      pos = ctx.rng.int(r.x + minSize, r.x + r.w - minSize);
      a = { x: r.x, y: r.y, w: pos - r.x, h: r.h }; b = { x: pos, y: r.y, w: r.x + r.w - pos, h: r.h };
      splits.push({ vertical: true, pos: pos, from: r.y, to: r.y + r.h });
    } else {
      pos = ctx.rng.int(r.y + minSize, r.y + r.h - minSize);
      a = { x: r.x, y: r.y, w: r.w, h: pos - r.y }; b = { x: r.x, y: pos, w: r.w, h: r.y + r.h - pos };
      splits.push({ vertical: false, pos: pos, from: r.x, to: r.x + r.w });
    }
    bsp(ctx, a, minSize, maxArea, out, splits, depth + 1);
    bsp(ctx, b, minSize, maxArea, out, splits, depth + 1);
  }
  function wallSplit(ctx, sp, z, style, avoid) {
    var p;
    for (p = sp.from; p < sp.to; p++) {
      if (sp.vertical) { ctx.edge(sp.pos, p, z, 1, E.WALL, style); } else { ctx.edge(p, sp.pos, z, 0, E.WALL, style); }
    }
    // porta: posição que não toque outra parede perpendicular nem a área evitada (escada)
    var cands = [];
    for (p = sp.from; p < sp.to; p++) {
      var x = sp.vertical ? sp.pos : p, y = sp.vertical ? p : sp.pos;
      if (avoid && avoid(x, y, sp.vertical)) { continue; }
      cands.push(p);
    }
    if (!cands.length) { cands.push(Math.floor((sp.from + sp.to) / 2)); }
    var dp = ctx.rng.pick(cands);
    var dx = sp.vertical ? sp.pos : dp, dy = sp.vertical ? dp : sp.pos;
    var doorway = ctx.rng.chance(0.3);
    ctx.edge(dx, dy, z, sp.vertical ? 1 : 0, doorway ? E.DOORWAY : E.DOOR, style);
    if (!doorway) { ctx.edgeState(dx, dy, z, sp.vertical ? 1 : 0, { open: ctx.rng.chance(0.55), locked: false, hp: 25, bar: 0, barHp: 0, broken: false }); }
    // tiles dos dois lados da porta ficam livres
    reserveDoorTiles(ctx, dx, dy, sp.vertical ? 1 : 0, z);
    return { x: dx, y: dy, side: sp.vertical ? 1 : 0 };
  }
  function reserveDoorTiles(ctx, x, y, side, z) {
    var a = side === 0 ? [x, y - 1] : [x - 1, y];
    if (!ctx.doorTiles) { ctx.doorTiles = {}; }
    ctx.doorTiles[z + ':' + x + ',' + y] = 1;
    ctx.doorTiles[z + ':' + a[0] + ',' + a[1]] = 1;
  }
  function isDoorTile(ctx, x, y, z) { return !!(ctx.doorTiles && ctx.doorTiles[z + ':' + x + ',' + y]); }

  /* lista de bordas externas de um retângulo, com o lado (para janelas/portas) */
  function perimeterEdges(r, sideName) {
    var list = [], x, y;
    if (sideName === 'N') { for (x = r.x; x < r.x + r.w; x++) { list.push({ x: x, y: r.y, side: 0, inX: x, inY: r.y }); } }
    if (sideName === 'S') { for (x = r.x; x < r.x + r.w; x++) { list.push({ x: x, y: r.y + r.h, side: 0, inX: x, inY: r.y + r.h - 1 }); } }
    if (sideName === 'W') { for (y = r.y; y < r.y + r.h; y++) { list.push({ x: r.x, y: y, side: 1, inX: r.x, inY: y }); } }
    if (sideName === 'E') { for (y = r.y; y < r.y + r.h; y++) { list.push({ x: r.x + r.w, y: y, side: 1, inX: r.x + r.w - 1, inY: y }); } }
    return list;
  }

  function placeDoorOnSide(ctx, r, z, side, style, locked, kind) {
    var edges = perimeterEdges(r, side).filter(function (e) { return !(ctx.stairTiles && ctx.stairTiles[z + ':' + e.inX + ',' + e.inY]); });
    var mid = edges.slice(1, edges.length - 1);
    if (!mid.length) { mid = edges; }
    // prefere o meio
    mid.sort(function (a, b) { return Math.abs(a.x + a.y - (edges[0].x + edges[0].y + edges.length / 2)) - Math.abs(b.x + b.y - (edges[0].x + edges[0].y + edges.length / 2)); });
    var e = mid[ctx.rng.int(0, Math.min(2, mid.length - 1))];
    ctx.edge(e.x, e.y, z, e.side, kind || E.DOOR, style);
    ctx.edgeState(e.x, e.y, z, e.side, { open: false, locked: locked, hp: 40, bar: 0, barHp: 0, broken: false, ext: true });
    reserveDoorTiles(ctx, e.x, e.y, e.side, z);
    return e;
  }

  function placeWindows(ctx, r, z, style, every) {
    ['N', 'S', 'E', 'W'].forEach(function (s) {
      var edges = perimeterEdges(r, s);
      for (var k = 1; k < edges.length - 1; k++) {
        var e = edges[k];
        if (ctx.getEdge(e.x, e.y, z, e.side) !== E.WALL) { continue; }
        // não ao lado de porta
        var prev = edges[k - 1], next = edges[k + 1];
        if (ctx.getEdge(prev.x, prev.y, z, prev.side) === E.DOOR || ctx.getEdge(next.x, next.y, z, next.side) === E.DOOR) { continue; }
        // não onde uma parede interna encontra a externa
        if (internalWallAt(ctx, e, z)) { continue; }
        if ((k % every) === 1 || ctx.rng.chance(0.08)) {
          ctx.edge(e.x, e.y, z, e.side, E.WINDOW, style);
          ctx.edgeState(e.x, e.y, z, e.side, { open: false, locked: ctx.rng.chance(0.4), hp: 8, bar: 0, barHp: 0, broken: false, glass: true });
        }
      }
    });
  }
  function internalWallAt(ctx, e, z) {
    // parede interna perpendicular tocando qualquer extremidade desta borda
    if (e.side === 0) {
      var y1 = e.inY;
      return ctx.getEdge(e.x, y1, z, 1) === E.WALL && ctx.room(e.x - 1, y1, z) && ctx.room(e.x, y1, z) ||
        ctx.getEdge(e.x + 1, y1, z, 1) === E.WALL && ctx.room(e.x, y1, z) && ctx.room(e.x + 1, y1, z);
    }
    var x1 = e.inX;
    return ctx.getEdge(x1, e.y, z, 0) === E.WALL && ctx.room(x1, e.y - 1, z) && ctx.room(x1, e.y, z) ||
      ctx.getEdge(x1, e.y + 1, z, 0) === E.WALL && ctx.room(x1, e.y, z) && ctx.room(x1, e.y + 1, z);
  }

  function roof(ctx, r, z, color) {
    for (var y = r.y; y < r.y + r.h; y++) {
      for (var x = r.x; x < r.x + r.w; x++) { ctx.setFloor(x, y, z, F.ROOF, color); }
    }
  }

  /* ---------- Móveis ---------- */
  /* tiles candidatos encostados em parede dentro de uma sala (com a direção para onde o móvel "olha") */
  function wallSpots(ctx, r, z, roomId) {
    var spots = [];
    for (var y = r.y; y < r.y + r.h; y++) {
      for (var x = r.x; x < r.x + r.w; x++) {
        if (ctx.room(x, y, z) !== roomId || isDoorTile(ctx, x, y, z) || ctx.obj(x, y, z)) { continue; }
        if (ctx.stairTiles && ctx.stairTiles[z + ':' + x + ',' + y]) { continue; }
        var n = ctx.getEdge(x, y, z, 0), s = ctx.getEdge(x, y + 1, z, 0), w = ctx.getEdge(x, y, z, 1), e = ctx.getEdge(x + 1, y, z, 1);
        if (n === E.WALL) { spots.push({ x: x, y: y, dir: 2 }); }
        if (s === E.WALL) { spots.push({ x: x, y: y, dir: 0 }); }
        if (w === E.WALL) { spots.push({ x: x, y: y, dir: 1 }); }
        if (e === E.WALL) { spots.push({ x: x, y: y, dir: 3 }); }
      }
    }
    return ctx.rng.shuffle(spots);
  }
  /* conectividade: TODOS os tiles livres da sala alcançáveis a partir de uma porta (sem bolsões isolados) */
  var bfsQ = new Int32Array(CH * CH);
  var bfsSeen = new Uint8Array(CH * CH);
  function isStairCol(ctx, x, y) {
    var s = ctx.stairCol;
    return !!(s && x === s.x && y >= s.top && y <= s.top + 2);
  }
  function freeTile(ctx, x, y, z, roomId) {
    if (!ctx.inside(x, y) || ctx.room(x, y, z) !== roomId || isStairCol(ctx, x, y)) { return false; }
    var o = ctx.obj(x, y, z);
    return !(o && C.OBJ_INFO[o].solid);
  }
  function roomOk(ctx, r, z, roomId) {
    var x, y, total = 0, start = -1;
    for (y = r.y; y < r.y + r.h; y++) {
      for (x = r.x; x < r.x + r.w; x++) {
        if (!freeTile(ctx, x, y, z, roomId)) { continue; }
        total++;
        if (start < 0 || isDoorTile(ctx, x, y, z)) { if (start < 0 || !isDoorTile(ctx, start % CH, (start / CH) | 0, z)) { start = y * CH + x; } }
      }
    }
    if (!total) { return false; }
    bfsSeen.fill(0);
    var qh = 0, qt = 0, cnt = 0;
    bfsQ[qt++] = start; bfsSeen[start] = 1;
    var L = ctx.L(z);
    while (qh < qt) {
      var cur = bfsQ[qh++]; cnt++;
      var cx = cur % CH, cy = (cur / CH) | 0;
      // leste
      if (cx + 1 < CH && !bfsSeen[cur + 1] && L.ww[cur + 1] !== E.WALL && freeTile(ctx, cx + 1, cy, z, roomId)) { bfsSeen[cur + 1] = 1; bfsQ[qt++] = cur + 1; }
      if (cx - 1 >= 0 && !bfsSeen[cur - 1] && L.ww[cur] !== E.WALL && freeTile(ctx, cx - 1, cy, z, roomId)) { bfsSeen[cur - 1] = 1; bfsQ[qt++] = cur - 1; }
      if (cy + 1 < CH && !bfsSeen[cur + CH] && L.wn[cur + CH] !== E.WALL && freeTile(ctx, cx, cy + 1, z, roomId)) { bfsSeen[cur + CH] = 1; bfsQ[qt++] = cur + CH; }
      if (cy - 1 >= 0 && !bfsSeen[cur - CH] && L.wn[cur] !== E.WALL && freeTile(ctx, cx, cy - 1, z, roomId)) { bfsSeen[cur - CH] = 1; bfsQ[qt++] = cur - CH; }
    }
    return cnt === total;
  }
  function tryPlace(ctx, r, z, roomId, o, spot) {
    if (!ctx.inside(spot.x, spot.y) || ctx.obj(spot.x, spot.y, z) || ctx.room(spot.x, spot.y, z) !== roomId) { return false; }
    if (ctx.stairTiles && ctx.stairTiles[z + ':' + spot.x + ',' + spot.y]) { return false; }
    ctx.setObj(spot.x, spot.y, z, o, spot.dir);
    if (!roomOk(ctx, r, z, roomId)) { ctx.setObj(spot.x, spot.y, z, 0, 0); return false; }
    return true;
  }
  function placeSome(ctx, r, z, roomId, list) {
    var spots = wallSpots(ctx, r, z, roomId);
    for (var n = 0; n < list.length; n++) {
      var o = list[n];
      for (var s = 0; s < spots.length; s++) {
        if (o === O.BED_HEAD) {
          // cama: 2 tiles, cabeceira na parede
          var sp = spots[s];
          var fx = sp.x + [0, 1, 0, -1][sp.dir], fy = sp.y + [-1, 0, 1, 0][sp.dir];
          if (ctx.room(fx, fy, z) !== roomId || ctx.obj(fx, fy, z) || isDoorTile(ctx, fx, fy, z) || !ctx.inside(fx, fy)) { continue; }
          if (ctx.stairTiles && ctx.stairTiles[z + ':' + fx + ',' + fy]) { continue; }
          if (betweenWall(ctx, sp.x, sp.y, fx, fy, z)) { continue; }
          ctx.setObj(sp.x, sp.y, z, O.BED_HEAD, sp.dir); ctx.setObj(fx, fy, z, O.BED_FOOT, sp.dir);
          if (!roomOk(ctx, r, z, roomId)) { ctx.setObj(sp.x, sp.y, z, 0, 0); ctx.setObj(fx, fy, z, 0, 0); continue; }
          spots.splice(s, 1); break;
        }
        if (tryPlace(ctx, r, z, roomId, o, spots[s])) { spots.splice(s, 1); break; }
      }
    }
  }
  function betweenWall(ctx, ax, ay, bx, by, z) {
    if (bx === ax + 1) { return ctx.getEdge(bx, by, z, 1) !== E.NONE; }
    if (bx === ax - 1) { return ctx.getEdge(ax, ay, z, 1) !== E.NONE; }
    if (by === ay + 1) { return ctx.getEdge(bx, by, z, 0) !== E.NONE; }
    if (by === ay - 1) { return ctx.getEdge(ax, ay, z, 0) !== E.NONE; }
    return false;
  }
  /* móveis no meio da sala (mesa + cadeiras) */
  function centerTable(ctx, r, z, roomId) {
    if (r.w < 4 || r.h < 4) { return; }
    var x = r.x + Math.floor(r.w / 2), y = r.y + Math.floor(r.h / 2);
    if (ctx.room(x, y, z) !== roomId || isDoorTile(ctx, x, y, z) || ctx.obj(x, y, z)) { return; }
    if (!tryPlace(ctx, r, z, roomId, O.TABLE, { x: x, y: y, dir: 0 })) { return; }
    var around = [[0, -1, 2], [0, 1, 0], [-1, 0, 1], [1, 0, 3]];
    for (var k = 0; k < 4; k++) {
      if (ctx.rng.chance(0.7)) { tryPlace(ctx, r, z, roomId, O.CHAIR, { x: x + around[k][0], y: y + around[k][1], dir: around[k][2] }); }
    }
  }

  var ROOM_FURNITURE = {
    living: function (rng) { var l = [O.SOFA, O.TV, O.SHELF]; if (rng.chance(0.6)) { l.push(O.SOFA); } if (rng.chance(0.5)) { l.push(O.SHELF); } return l; },
    kitchen: function (rng) { var l = [O.FRIDGE, O.STOVE, O.COUNTER, O.SINK, O.COUNTER]; if (rng.chance(0.6)) { l.push(O.COUNTER); } return l; },
    bathroom: function () { return [O.TOILET, O.BATHTUB, O.MED_CABINET]; },
    bedroom: function (rng) { var l = [O.BED_HEAD, O.WARDROBE, O.NIGHTSTAND]; if (rng.chance(0.6)) { l.push(O.DRESSER); } if (rng.chance(0.3)) { l.push(O.DESK); } return l; },
    garage: function (rng) { var l = [O.WORKBENCH, O.SHELF, O.CRATE]; if (rng.chance(0.5)) { l.push(O.CRATE); } return l; },
    storage: function (rng) { var l = [O.CRATE, O.CRATE, O.SHELF]; if (rng.chance(0.5)) { l.push(O.CRATE); } return l; },
    office: function () { return [O.DESK, O.DESK, O.SHELF, O.CHAIR]; },
    hall: function () { return []; }
  };

  /* ---------- Casa ---------- */
  function genHouse(ctx, r, front, opts) {
    opts = opts || {};
    var rng = ctx.rng;
    var floors = opts.floors || (r.w >= 7 && r.h >= 7 && rng.chance(0.3) ? 2 : 1);
    var bld = newBuilding(ctx, r, opts.kind || 'house', floors);
    var ext = opts.extStyle !== undefined ? opts.extStyle : rng.pick(C.EXTERIOR_STYLES);
    var roofColor = rng.int(0, 3);
    ctx.stairTiles = {};
    var stair = null;
    // escada (sobrados): coluna de 3 tiles encostada na parede oeste ou leste
    if (floors === 2) {
      var sx = rng.chance(0.5) ? r.x : r.x + r.w - 1;
      var ty = r.y + 1 + rng.int(0, Math.max(0, r.h - 5));
      if (ty + 3 <= r.y + r.h - 1) {
        stair = { x: sx, top: ty };
        ctx.stairCol = stair;
        for (var s = 0; s < 3; s++) { ctx.stairTiles['0:' + sx + ',' + (ty + s)] = 1; ctx.stairTiles['1:' + sx + ',' + (ty + s)] = 1; }
        ctx.stairTiles['0:' + sx + ',' + (ty + 3)] = 1;   // entrada embaixo
        ctx.stairTiles['1:' + sx + ',' + (ty - 1)] = 1;   // patamar em cima
        ctx.stairTiles['0:' + sx + ',' + (ty - 1)] = 1;
      } else { floors = 1; ctx.c.buildings[bld].floors = 1; }
    }
    for (var z = 0; z < floors; z++) {
      var leaves = [], splits = [];
      bsp(ctx, r, 3, z === 0 ? 20 : 18, leaves, splits, 0);
      // tipos de sala
      var types = assignHouseRooms(ctx, leaves, r, front, z, floors);
      var ids = [];
      leaves.forEach(function (lf, li) {
        var t = types[li];
        var fl = t === 'kitchen' ? F.LINOLEUM : (t === 'bathroom' ? F.TILE : (t === 'bedroom' && rng.chance(0.5) ? F.CARPET : F.WOOD));
        var id = newRoom(ctx, t, bld, z);
        ids.push(id);
        fillRoom(ctx, lf, z, id, fl);
      });
      outerWalls(ctx, r, z, ext);
      var intStyleFor = function () { return rng.pick(C.INTERIOR_STYLES); };
      splits.forEach(function (sp) {
        wallSplit(ctx, sp, z, intStyleFor(), function (x, y, vertical) {
          // evita porta que dê direto na coluna da escada
          if (!stair) { return false; }
          var ax = vertical ? x - 1 : x, ay = vertical ? y : y - 1;
          return !!(ctx.stairTiles[z + ':' + x + ',' + y] || ctx.stairTiles[z + ':' + ax + ',' + ay]);
        });
      });
      // remove paredes internas que cortariam a escada/patamar
      if (stair) {
        for (var k = 0; k <= 3; k++) {
          ctx.edge(stair.x, stair.top + k, z, 0, (stair.top + k === r.y) ? E.WALL : E.NONE, ctx.getEdge(stair.x, stair.top + k, z, 0) === E.WALL && stair.top + k === r.y ? ext : 0);
        }
        // as salas da coluna da escada viram uma só passagem: reescreve room ids para a sala do patamar/entrada
        var refY = z === 0 ? stair.top + 3 : stair.top - 1;
        var refRoom = ctx.room(stair.x, refY, z);
        for (var k2 = 0; k2 <= 2; k2++) {
          var yy = stair.top + k2;
          if (yy < r.y || yy >= r.y + r.h) { continue; }
          ctx.L(z).room[ctx.i(stair.x, yy)] = refRoom;
        }
        // paredes laterais da coluna entre tiles da escada e vizinhos permanecem (BSP pode ter posto) — garantimos acesso pelo eixo
      }
      if (z === 0) {
        var fd = placeDoorOnSide(ctx, r, 0, front, ext, rng.chance(0.55));
        ctx.c.buildings[bld].door = { x: ctx.ox + fd.x, y: ctx.oy + fd.y, side: fd.side };
        if (rng.chance(0.5)) { placeDoorOnSide(ctx, r, 0, { N: 'S', S: 'N', E: 'W', W: 'E' }[front], ext, rng.chance(0.6)); }
      }
      placeWindows(ctx, r, z, ext, 3);
      // móveis
      leaves.forEach(function (lf, li) {
        var id = ids[li];
        var t = types[li];
        var fn = ROOM_FURNITURE[t];
        if (fn) { placeSome(ctx, lf, z, id, fn(rng)); }
        if (t === 'kitchen' || (t === 'living' && rng.chance(0.4))) { centerTable(ctx, lf, z, id); }
      });
    }
    if (stair) {
      for (var p = 0; p < 3; p++) {
        ctx.setObj(stair.x, stair.top + p, 0, O.STAIRS, 0 | ((2 - p) << 2));
        ctx.setFloor(stair.x, stair.top + p, 1, F.NONE, 0);
      }
    }
    roof(ctx, r, floors, roofColor);
    ctx.stairTiles = null;
    ctx.stairCol = null;
    return bld;
  }
  function assignHouseRooms(ctx, leaves, r, front, z, floors) {
    var types = new Array(leaves.length);
    var order = leaves.map(function (l, i) { return i; });
    // sala de estar: a maior tocando a frente
    function touchesFront(l) {
      return (front === 'N' && l.y === r.y) || (front === 'S' && l.y + l.h === r.y + r.h) || (front === 'W' && l.x === r.x) || (front === 'E' && l.x + l.w === r.x + r.w);
    }
    order.sort(function (a, b) { return leaves[b].w * leaves[b].h - leaves[a].w * leaves[a].h; });
    var smallest = order[order.length - 1];
    if (z === 0) {
      var living = -1;
      for (var i = 0; i < order.length; i++) { if (touchesFront(leaves[order[i]])) { living = order[i]; break; } }
      if (living < 0) { living = order[0]; }
      types[living] = 'living';
      if (leaves.length > 1 && smallest !== living) { types[smallest] = 'bathroom'; }
      var kitchenSet = false;
      for (var j = 0; j < order.length; j++) {
        var idx = order[j];
        if (types[idx]) { continue; }
        if (!kitchenSet) { types[idx] = 'kitchen'; kitchenSet = true; } else { types[idx] = floors === 2 ? (ctx.rng.chance(0.5) ? 'storage' : 'office') : 'bedroom'; }
      }
      if (!kitchenSet && leaves.length > 1) { types[order[order.length - 1] === living ? order[0] : order[order.length - 1]] = 'kitchen'; }
    } else {
      for (var q = 0; q < order.length; q++) { types[order[q]] = 'bedroom'; }
      if (leaves.length > 2) { types[smallest] = 'bathroom'; }
    }
    for (var t = 0; t < types.length; t++) { if (!types[t]) { types[t] = 'bedroom'; } }
    return types;
  }

  /* ---------- Quarteirão residencial ---------- */
  function genResidentialBlock(ctx, m, cx, cy) {
    var rng = ctx.rng;
    var lots = [
      { x: 6, y: 6, w: 12, h: 12, fronts: ['N', 'W'] },
      { x: 19, y: 6, w: 12, h: 12, fronts: ['N', 'E'] },
      { x: 6, y: 19, w: 12, h: 12, fronts: ['S', 'W'] },
      { x: 19, y: 19, w: 12, h: 12, fronts: ['S', 'E'] }
    ];
    // gramado em todos os lotes
    for (var ly = 6; ly < CH - 1; ly++) { for (var lx = 6; lx < CH - 1; lx++) { ctx.setFloor(lx, ly, 0, F.GRASS); } }
    lots.forEach(function (lot) {
      var front = rng.pick(lot.fronts);
      if (rng.chance(0.08)) { yardOnly(ctx, lot); return; }
      var w = rng.int(7, 10), h = rng.int(7, 10);
      var x, y;
      var setback = rng.int(1, 2);
      if (front === 'N') { y = lot.y + setback; x = lot.x + rng.int(0, lot.w - w); }
      if (front === 'S') { y = lot.y + lot.h - h - setback; x = lot.x + rng.int(0, lot.w - w); }
      if (front === 'W') { x = lot.x + setback; y = lot.y + rng.int(0, lot.h - h); }
      if (front === 'E') { x = lot.x + lot.w - w - setback; y = lot.y + rng.int(0, lot.h - h); }
      var r = { x: x, y: y, w: w, h: h };
      genHouse(ctx, r, front);
      // caminho até a calçada
      walkway(ctx, r, front, lot);
      lotFence(ctx, lot, front);
      // árvores e arbustos no quintal
      for (var t = 0; t < 4; t++) {
        var tx = rng.int(lot.x, lot.x + lot.w - 1), tyy = rng.int(lot.y, lot.y + lot.h - 1);
        if (!ctx.reserved[ctx.i(tx, tyy)] && !ctx.obj(tx, tyy, 0) && !ctx.room(tx, tyy, 0) && ctx.floor(tx, tyy, 0) === F.GRASS) {
          ctx.setObj(tx, tyy, 0, rng.chance(0.4) ? O.TREE : O.BUSH, rng.int(0, 3));
        }
      }
      // caixa de correio perto da calçada
      var mb = mailboxSpot(lot, front);
      if (mb && !ctx.obj(mb.x, mb.y, 0)) { ctx.setObj(mb.x, mb.y, 0, O.MAILBOX, 0); }
    });
  }
  function yardOnly(ctx, lot) {
    for (var i = 0; i < 6; i++) {
      var x = ctx.rng.int(lot.x, lot.x + lot.w - 1), y = ctx.rng.int(lot.y, lot.y + lot.h - 1);
      if (!ctx.obj(x, y, 0)) { ctx.setObj(x, y, 0, ctx.rng.chance(0.5) ? O.TREE : O.BUSH, ctx.rng.int(0, 3)); }
    }
  }
  function walkway(ctx, r, front, lot) {
    var b = ctx.c.buildings[ctx.c.buildings.length - 1];
    if (!b.door) { return; }
    var dx = b.door.x - ctx.ox, dy = b.door.y - ctx.oy;
    var x, y;
    if (front === 'N') { for (y = dy - 1; y >= lot.y - 1; y--) { pave(ctx, dx, y); } }
    if (front === 'S') { for (y = dy; y <= lot.y + lot.h; y++) { pave(ctx, dx, y); } }
    if (front === 'W') { for (x = dx - 1; x >= lot.x - 1; x--) { pave(ctx, x, dy); } }
    if (front === 'E') { for (x = dx; x <= lot.x + lot.w; x++) { pave(ctx, x, dy); } }
  }
  function pave(ctx, x, y) {
    if (!ctx.inside(x, y) || ctx.room(x, y, 0) || ctx.road[ctx.i(x, y)]) { return; }
    if (ctx.floor(x, y, 0) === F.SIDEWALK) { return; }
    ctx.setFloor(x, y, 0, F.CONCRETE);
    ctx.setObj(x, y, 0, 0);
    ctx.reserved[ctx.i(x, y)] = 1;
  }
  function lotFence(ctx, lot, front) {
    var x, y;
    // cerca baixa nas laterais e fundos (não na frente)
    if (front !== 'N') { for (x = lot.x; x < lot.x + lot.w; x++) { fenceEdge(ctx, x, lot.y, 0); } }
    if (front !== 'S') { for (x = lot.x; x < lot.x + lot.w; x++) { fenceEdge(ctx, x, lot.y + lot.h, 0); } }
    if (front !== 'W') { for (y = lot.y; y < lot.y + lot.h; y++) { fenceEdge(ctx, lot.x, y, 1); } }
    if (front !== 'E') { for (y = lot.y; y < lot.y + lot.h; y++) { fenceEdge(ctx, lot.x + lot.w, y, 1); } }
  }
  function fenceEdge(ctx, x, y, side) {
    if (!ctx.inside(x, y)) { return; }
    if (ctx.getEdge(x, y, 0, side) !== E.NONE) { return; }
    var a = side === 0 ? [x, y - 1] : [x - 1, y];
    if (ctx.room(x, y, 0) || (ctx.inside(a[0], a[1]) && ctx.room(a[0], a[1], 0))) { return; }
    if (ctx.road[ctx.i(x, y)] || (ctx.inside(a[0], a[1]) && ctx.road[ctx.i(a[0], a[1])])) { return; }
    if (ctx.floor(x, y, 0) === F.SIDEWALK || ctx.floor(x, y, 0) === F.CONCRETE) { return; }
    if (ctx.inside(a[0], a[1]) && (ctx.floor(a[0], a[1], 0) === F.SIDEWALK || ctx.floor(a[0], a[1], 0) === F.CONCRETE)) { return; }
    ctx.edge(x, y, 0, side, E.FENCE, 0);
  }
  function mailboxSpot(lot, front) {
    var c = { x: lot.x + Math.floor(lot.w / 2) + 1, y: lot.y + Math.floor(lot.h / 2) + 1 };
    if (front === 'N') { return { x: c.x, y: lot.y - 1 }; }
    if (front === 'S') { return { x: c.x, y: lot.y + lot.h }; }
    if (front === 'W') { return { x: lot.x - 1, y: c.y }; }
    return { x: lot.x + lot.w, y: c.y };
  }

  /* ---------- Centro: lojas ---------- */
  function genDowntownBlock(ctx, m, cx, cy, feat) {
    var rng = ctx.rng;
    for (var ly = 6; ly < CH - 1; ly++) { for (var lx = 6; lx < CH - 1; lx++) { ctx.setFloor(lx, ly, 0, F.CONCRETE); } }
    var lots;
    if (rng.chance(0.3) && !feat) {
      lots = [{ x: 6, y: 6, w: 25, h: 25, front: rng.pick(['N', 'W', 'S', 'E']) }];
    } else {
      lots = [{ x: 6, y: 6, w: 25, h: 12, front: 'N' }, { x: 6, y: 19, w: 25, h: 12, front: 'S' }];
    }
    lots.forEach(function (lot, li) {
      var kind;
      if (feat === 4 && li === 0) { kind = 'police'; } else if (feat === 5 && li === 0) { kind = 'clinic'; } else { kind = rng.weighted(SHOP_TYPES); }
      if (kind === 'parking') { parkingLot(ctx, lot); return; }
      var inset = 1;
      var r = { x: lot.x + inset, y: lot.y + inset, w: lot.w - inset * 2, h: lot.h - inset * 2 };
      if (lots.length === 1) { r = { x: lot.x + 2, y: lot.y + 2, w: lot.w - 4, h: lot.h - 4 }; }
      genShop(ctx, r, lot.front, kind);
    });
  }
  function parkingLot(ctx, lot) {
    for (var y = lot.y; y < lot.y + lot.h; y++) {
      for (var x = lot.x; x < lot.x + lot.w; x++) { ctx.setFloor(x, y, 0, F.ASPHALT, 0); }
    }
    for (var n = 0; n < ctx.rng.int(2, 6); n++) {
      placeCar(ctx, ctx.rng.int(lot.x + 1, lot.x + lot.w - 3), ctx.rng.int(lot.y + 1, lot.y + lot.h - 3), ctx.rng.int(0, 1));
    }
    placeIfFree(ctx, lot.x + 1, lot.y + 1, O.LAMPPOST, 0);
    placeIfFree(ctx, lot.x + lot.w - 2, lot.y + lot.h - 2, O.LAMPPOST, 0);
    placeIfFree(ctx, lot.x + lot.w - 2, lot.y + 1, O.DUMPSTER, 0);
  }

  var SHOP_FILL = {
    grocery: { shelf: O.SHOP_SHELF, extra: [O.FRIDGE, O.FRIDGE, O.FRIDGE], room: 'grocery' },
    pharmacy: { shelf: O.SHOP_SHELF, extra: [O.MED_CABINET, O.MED_CABINET], room: 'pharmacy' },
    hardware: { shelf: O.SHOP_SHELF, extra: [O.WORKBENCH, O.CRATE], room: 'hardware' },
    diner: { shelf: null, extra: [O.COUNTER, O.STOVE, O.FRIDGE, O.COUNTER], tables: true, room: 'diner' },
    clothes: { shelf: O.SHOP_SHELF, extra: [O.WARDROBE, O.WARDROBE], room: 'clothes' },
    bar: { shelf: null, extra: [O.COUNTER, O.COUNTER, O.FRIDGE, O.SHELF], tables: true, room: 'bar' },
    office: { shelf: null, extra: [O.DESK, O.DESK, O.DESK, O.SHELF, O.LOCKER], room: 'office' },
    gunstore: { shelf: O.SHOP_SHELF, extra: [O.LOCKER, O.LOCKER], room: 'gunstore' },
    bookstore: { shelf: O.SHELF, extra: [O.SHELF, O.SHELF], room: 'bookstore' },
    electronics: { shelf: O.SHOP_SHELF, extra: [O.TV, O.TV], room: 'electronics' },
    warehouse: { shelf: O.CRATE, extra: [O.CRATE, O.CRATE, O.BARREL], room: 'warehouse' },
    police: { shelf: null, extra: [O.DESK, O.DESK, O.LOCKER, O.LOCKER, O.LOCKER, O.SHELF], room: 'police' },
    clinic: { shelf: null, extra: [O.BED_HEAD, O.BED_HEAD, O.MED_CABINET, O.MED_CABINET, O.DESK], room: 'clinic' },
    gas: { shelf: O.SHOP_SHELF, extra: [O.FRIDGE, O.COUNTER], room: 'gas' }
  };
  function genShop(ctx, r, front, kind) {
    var rng = ctx.rng;
    var fill = SHOP_FILL[kind] || SHOP_FILL.grocery;
    var bld = newBuilding(ctx, r, kind, 1);
    var ext = rng.pick([3, 5, 11, 0, 2]);
    // fundos: depósito com 3-4 de profundidade
    var back = { N: 'S', S: 'N', E: 'W', W: 'E' }[front];
    var depth = Math.min(4, Math.floor((front === 'N' || front === 'S' ? r.h : r.w) / 3));
    var main, store;
    if (back === 'S') { main = { x: r.x, y: r.y, w: r.w, h: r.h - depth }; store = { x: r.x, y: r.y + r.h - depth, w: r.w, h: depth }; }
    if (back === 'N') { main = { x: r.x, y: r.y + depth, w: r.w, h: r.h - depth }; store = { x: r.x, y: r.y, w: r.w, h: depth }; }
    if (back === 'E') { main = { x: r.x, y: r.y, w: r.w - depth, h: r.h }; store = { x: r.x + r.w - depth, y: r.y, w: depth, h: r.h }; }
    if (back === 'W') { main = { x: r.x + depth, y: r.y, w: r.w - depth, h: r.h }; store = { x: r.x, y: r.y, w: depth, h: r.h }; }
    var mainId = newRoom(ctx, fill.room, bld, 0);
    var storeId = newRoom(ctx, kind === 'police' ? 'police' : 'storage', bld, 0);
    var fl = kind === 'diner' || kind === 'bar' ? F.TILE : (kind === 'warehouse' ? F.CONCRETE : F.LINOLEUM);
    fillRoom(ctx, main, 0, mainId, fl);
    fillRoom(ctx, store, 0, storeId, F.CONCRETE);
    outerWalls(ctx, r, 0, ext);
    // parede entre loja e depósito com porta
    var sp;
    if (back === 'S') { sp = { vertical: false, pos: store.y, from: r.x, to: r.x + r.w }; }
    if (back === 'N') { sp = { vertical: false, pos: main.y, from: r.x, to: r.x + r.w }; }
    if (back === 'E') { sp = { vertical: true, pos: store.x, from: r.y, to: r.y + r.h }; }
    if (back === 'W') { sp = { vertical: true, pos: main.x, from: r.y, to: r.y + r.h }; }
    wallSplit(ctx, sp, 0, 11);
    // porta da frente dupla
    var fd = placeDoorOnSide(ctx, r, 0, front, ext, rng.chance(0.5));
    ctx.c.buildings[bld].door = { x: ctx.ox + fd.x, y: ctx.oy + fd.y, side: fd.side };
    var e2 = fd.side === 0 ? { x: fd.x + 1, y: fd.y } : { x: fd.x, y: fd.y + 1 };
    if (ctx.getEdge(e2.x, e2.y, 0, fd.side) === E.WALL) {
      ctx.edge(e2.x, e2.y, 0, fd.side, E.DOOR, ext);
      ctx.edgeState(e2.x, e2.y, 0, fd.side, { open: false, locked: true, hp: 40, bar: 0, barHp: 0, broken: false, ext: true });
      reserveDoorTiles(ctx, e2.x, e2.y, fd.side, 0);
    }
    placeDoorOnSide(ctx, r, 0, back, ext, true);
    placeWindows(ctx, r, 0, ext, 2);
    // prateleiras em fileiras (corredores)
    if (fill.shelf) {
      var horizontal = front === 'N' || front === 'S';
      if (horizontal) {
        for (var yy = main.y + 2; yy < main.y + main.h - 2; yy += 3) {
          for (var xx = main.x + 2; xx < main.x + main.w - 2; xx++) {
            if ((xx - main.x) % 7 === 0) { continue; }
            if (!isDoorTile(ctx, xx, yy, 0)) { tryPlace(ctx, main, 0, mainId, fill.shelf, { x: xx, y: yy, dir: 2 }); }
          }
        }
      } else {
        for (var xx2 = main.x + 2; xx2 < main.x + main.w - 2; xx2 += 3) {
          for (var yy2 = main.y + 2; yy2 < main.y + main.h - 2; yy2++) {
            if ((yy2 - main.y) % 7 === 0) { continue; }
            if (!isDoorTile(ctx, xx2, yy2, 0)) { tryPlace(ctx, main, 0, mainId, fill.shelf, { x: xx2, y: yy2, dir: 1 }); }
          }
        }
      }
    }
    if (fill.tables) {
      for (var t = 0; t < 4; t++) {
        var tx = rng.int(main.x + 2, main.x + main.w - 3), ty = rng.int(main.y + 2, main.y + main.h - 3);
        if (tryPlace(ctx, main, 0, mainId, O.TABLE, { x: tx, y: ty, dir: 0 })) {
          tryPlace(ctx, main, 0, mainId, O.CHAIR, { x: tx + 1, y: ty, dir: 3 });
          tryPlace(ctx, main, 0, mainId, O.CHAIR, { x: tx - 1, y: ty, dir: 1 });
        }
      }
    }
    var extra = fill.extra.slice();
    if (kind !== 'police' && kind !== 'clinic' && kind !== 'office' && kind !== 'warehouse') { extra.unshift(O.CASH); extra.unshift(O.COUNTER); }
    placeSome(ctx, main, 0, mainId, extra);
    placeSome(ctx, store, 0, storeId, ROOM_FURNITURE.storage(rng));
    roof(ctx, r, 1, rng.int(4, 7));
    return bld;
  }

  /* ---------- Rural ---------- */
  function sideWithRoad(m, cx, cy) {
    var s = [];
    if (G.macroRoadN(m, cx, cy)) { s.push('N'); }
    if (G.macroRoadW(m, cx, cy)) { s.push('W'); }
    if (G.macroRoadN(m, cx, cy + 1)) { s.push('S'); }
    if (G.macroRoadW(m, cx + 1, cy)) { s.push('E'); }
    return s;
  }
  function clearArea(ctx, r, floorType) {
    for (var y = r.y; y < r.y + r.h; y++) {
      for (var x = r.x; x < r.x + r.w; x++) {
        if (!ctx.inside(x, y) || ctx.road[ctx.i(x, y)]) { continue; }
        if (floorType !== undefined) { ctx.setFloor(x, y, 0, floorType); }
        ctx.reserved[ctx.i(x, y)] = 1;
      }
    }
  }
  function genGasStation(ctx, m, cx, cy) {
    var sides = sideWithRoad(m, cx, cy);
    var front = sides.length ? ctx.rng.pick(sides) : 'N';
    var apron, shop;
    if (front === 'N') { apron = { x: 8, y: RW, w: 18, h: 7 }; shop = { x: 11, y: RW + 8, w: 10, h: 7 }; }
    if (front === 'S') { apron = { x: 8, y: CH - 8, w: 18, h: 7 }; shop = { x: 11, y: CH - 16, w: 10, h: 7 }; }
    if (front === 'W') { apron = { x: RW, y: 8, w: 7, h: 18 }; shop = { x: RW + 8, y: 11, w: 7, h: 10 }; }
    if (front === 'E') { apron = { x: CH - 8, y: 8, w: 7, h: 18 }; shop = { x: CH - 16, y: 11, w: 7, h: 10 }; }
    clearArea(ctx, apron, F.CONCRETE);
    clearArea(ctx, { x: shop.x - 1, y: shop.y - 1, w: shop.w + 2, h: shop.h + 2 }, F.CONCRETE);
    for (var p = 0; p < 4; p++) {
      var px = apron.x + 3 + (front === 'N' || front === 'S' ? p * 4 : 2), py = apron.y + 3 + (front === 'N' || front === 'S' ? 0 : p * 4);
      placeIfFree(ctx, px, py, O.PUMP, 0);
    }
    placeIfFree(ctx, apron.x, apron.y, O.LAMPPOST, 0);
    genShop(ctx, shop, front, 'gas');
  }
  function genRuralHouse(ctx, m, cx, cy) {
    var sides = sideWithRoad(m, cx, cy);
    var front = sides.length ? ctx.rng.pick(sides) : 'N';
    var w = ctx.rng.int(7, 10), h = ctx.rng.int(7, 10);
    var r;
    if (front === 'N') { r = { x: ctx.rng.int(8, CH - w - 4), y: RW + 3, w: w, h: h }; }
    if (front === 'S') { r = { x: ctx.rng.int(8, CH - w - 4), y: CH - h - 4, w: w, h: h }; }
    if (front === 'W') { r = { x: RW + 3, y: ctx.rng.int(8, CH - h - 4), w: w, h: h }; }
    if (front === 'E') { r = { x: CH - w - 4, y: ctx.rng.int(8, CH - h - 4), w: w, h: h }; }
    clearArea(ctx, { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, F.GRASS);
    genHouse(ctx, r, front);
    var lot = { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 };
    walkway(ctx, r, front, { x: lot.x - (front === 'W' ? 3 : 0), y: lot.y - (front === 'N' ? 3 : 0), w: lot.w + (front === 'E' ? 3 : 0), h: lot.h + (front === 'S' ? 3 : 0) });
  }
  function genFarm(ctx, m, cx, cy) {
    var sides = sideWithRoad(m, cx, cy);
    var front = sides.length ? ctx.rng.pick(sides) : 'N';
    // campos de cultivo
    var field = { x: 8, y: 8, w: CH - 14, h: CH - 14 };
    for (var y = field.y; y < field.y + field.h; y++) {
      for (var x = field.x; x < field.x + field.w; x++) {
        ctx.setFloor(x, y, 0, (y % 3 === 0) ? F.DIRT : F.FIELD, 0);
        ctx.reserved[ctx.i(x, y)] = 1;
      }
    }
    for (var fx = field.x; fx < field.x + field.w; fx++) { ctx.edge(fx, field.y, 0, 0, E.FENCE, 0); ctx.edge(fx, field.y + field.h, 0, 0, E.FENCE, 0); }
    for (var fy = field.y; fy < field.y + field.h; fy++) { ctx.edge(field.x, fy, 0, 1, E.FENCE, 0); ctx.edge(field.x + field.w, fy, 0, 1, E.FENCE, 0); }
    // portão
    ctx.edge(field.x + 2, field.y, 0, 0, E.NONE, 0);
    // casa da fazenda numa ponta, celeiro na outra
    if (ctx.rng.chance(0.7)) {
      var hr = { x: field.x + 1, y: field.y + 1, w: 8, h: 8 };
      clearArea(ctx, hr, F.GRASS);
      genHouse(ctx, hr, front === 'S' ? 'S' : 'N', { floors: ctx.rng.chance(0.4) ? 2 : 1 });
      var barn = { x: field.x + field.w - 10, y: field.y + field.h - 9, w: 9, h: 8 };
      clearArea(ctx, barn, F.DIRT);
      genShop(ctx, barn, 'N', 'warehouse');
      ctx.c.buildings[ctx.c.buildings.length - 1].kind = 'barn';
    }
  }

  /* ---------- Zumbis ---------- */
  function spawnZombies(ctx, type, feat) {
    var Z = C.ZOMBIE;
    var mult = (CP.Game && CP.Game.settings && CP.Game.settings.popMult) || 1;
    var base = { 0: 0, 1: Z.POP_FOREST, 2: Z.POP_RURAL, 3: Z.POP_RURAL, 4: Z.POP_TOWN, 5: Z.POP_DOWNTOWN, 6: Z.POP_FOREST }[type];
    if (feat === 1 || feat === 2) { base += 3; }
    if (feat === 4) { base += 10; }
    var n = Math.round(base * mult * ctx.rng.range(0.6, 1.4));
    var tries = 0;
    while (n > 0 && tries < 400) {
      tries++;
      var lx = ctx.rng.int(0, CH - 1), ly = ctx.rng.int(0, CH - 1);
      var z = 0;
      var i = ctx.i(lx, ly);
      if (!C.FLOOR_WALKABLE[ctx.L(0).floor[i]]) { continue; }
      var o = ctx.L(0).obj[i];
      if (o && C.OBJ_INFO[o].solid) { continue; }
      if (o === O.STAIRS) { continue; }
      var roomId = ctx.L(0).room[i];
      // 2º andar às vezes
      if (roomId && ctx.L(1).room[i] && ctx.rng.chance(0.3)) {
        var o1 = ctx.L(1).obj[i];
        if (!(o1 && C.OBJ_INFO[o1].solid) && C.FLOOR_WALKABLE[ctx.L(1).floor[i]]) { z = 1; roomId = ctx.L(1).room[i]; }
      }
      var room = roomId ? ctx.c.rooms[roomId] : null;
      var bldKind = room ? ctx.c.buildings[room.bld].kind : null;
      ctx.c.zombies.push(CP.Zombies ? CP.Zombies.makeData(ctx.rng, ctx.ox + lx + 0.5, ctx.oy + ly + 0.5, z, bldKind, room && room.type) : { x: ctx.ox + lx + 0.5, y: ctx.oy + ly + 0.5, z: z });
      n--;
    }
  }

  /* ================= HISTÓRIAS ALEATÓRIAS ================= */
  function addZombie(ctx, x, y, z, kind, extra) {
    if (!CP.Zombies) { return; }
    var d = CP.Zombies.makeData(ctx.rng, ctx.ox + x + 0.5, ctx.oy + y + 0.5, z, kind, null);
    if (extra) { for (var k in extra) { d[k] = extra[k]; } }
    ctx.c.zombies.push(d);
  }
  function nearStairs(ctx, x, y) {
    for (var dy = -2; dy <= 2; dy++) { for (var dx = -1; dx <= 1; dx++) { if (ctx.obj(x + dx, y + dy, 0) === O.STAIRS || ctx.obj(x + dy, y + dx, 0) === O.STAIRS) { return true; } } }
    return false;
  }
  function makeItem(ctx, id, opts) { return CP.Items ? CP.Items.make(id, opts, ctx.rng) : { id: id }; }
  function stories(ctx, m, cx, cy, type) {
    var rng = ctx.rng;
    var c = ctx.c;
    // casa de sobrevivente: janelas e portas barricadas, estoque de comida, sobreviventes que viraram zumbis
    c.buildings.forEach(function (b, bi) {
      if (b.kind !== 'house' || !rng.chance(CP.C.EVENTS.SURVIVOR_HOUSE_CHANCE * 2)) { return; }
      b.story = 'survivor';
      var x0 = b.x - ctx.ox, y0 = b.y - ctx.oy;
      for (var z = 0; z < b.floors; z++) {
        for (var y = y0; y <= y0 + b.h; y++) {
          for (var x = x0; x <= x0 + b.w; x++) {
            for (var side = 0; side < 2; side++) {
              var t = ctx.getEdge(x, y, z, side);
              if (t !== E.WINDOW && t !== E.DOOR) { continue; }
              var key = (z * CH * CH + ctx.i(x, y)) * 2 + side;
              var st = c.edges[key];
              if (!st || !st.ext && t === E.DOOR) { if (t === E.DOOR && (!st || !st.ext)) { continue; } }
              st = st || { open: false, locked: false, hp: 8, bar: 0, barHp: 0, broken: false, glass: true };
              st.open = false; st.bar = rng.int(2, 4); st.barHp = 12;
              c.edges[key] = st;
            }
          }
        }
      }
      // estoque em caixotes
      var placed = 0;
      for (var tries = 0; tries < 30 && placed < 2; tries++) {
        var lx = x0 + rng.int(0, b.w - 1), ly = y0 + rng.int(0, b.h - 1);
        if (!ctx.inside(lx, ly) || ctx.obj(lx, ly, 0) || !ctx.room(lx, ly, 0) || isDoorTile(ctx, lx, ly, 0) || nearStairs(ctx, lx, ly)) { continue; }
        ctx.setObj(lx, ly, 0, O.CRATE, 0);
        if (!roomOk(ctx, { x: x0, y: y0, w: b.w, h: b.h }, 0, ctx.room(lx, ly, 0))) { ctx.setObj(lx, ly, 0, 0, 0); continue; }
        var items = [];
        var stock = ['beans', 'soup', 'tuna', 'water_bottle', 'water_bottle', 'crackers', 'peanutbutter', 'bandage', 'painkillers', 'nails', 'plank', 'hammer', 'flashlight', 'battery', 'candy'];
        for (var n = 0; n < rng.int(5, 9); n++) { var id = rng.pick(stock); items.push(makeItem(ctx, id, id === 'nails' ? { n: 20 } : null)); }
        if (rng.chance(0.4)) { items.push(makeItem(ctx, rng.pick(['shotgun', 'pistol', 'axe', 'crowbar']), null)); }
        if (rng.chance(0.3)) { items.push(makeItem(ctx, 'shells', { n: 12 })); }
        c.containers[ctx.i(lx, ly)] = { items: items, gen: true };
        placed++;
      }
      for (var zn = 0; zn < rng.int(1, 3); zn++) {
        var zx = x0 + rng.int(0, b.w - 1), zy = y0 + rng.int(0, b.h - 1);
        if (ctx.inside(zx, zy) && ctx.room(zx, zy, 0) && !ctx.obj(zx, zy, 0)) { addZombie(ctx, zx, zy, 0, 'house', null); }
      }
    });
    // festa em casa: muitos zumbis numa sala
    c.buildings.forEach(function (b) {
      if (b.kind !== 'house' || b.story || !rng.chance(0.025)) { return; }
      b.story = 'party';
      var x0 = b.x - ctx.ox, y0 = b.y - ctx.oy;
      for (var k = 0; k < rng.int(6, 11); k++) {
        var zx = x0 + rng.int(0, b.w - 1), zy = y0 + rng.int(0, b.h - 1);
        if (ctx.inside(zx, zy) && ctx.room(zx, zy, 0) && !ctx.obj(zx, zy, 0)) { addZombie(ctx, zx, zy, 0, 'house', null); }
      }
    });
    // acidente de carro na estrada: carro, corpos com loot, sangue e alguns zumbis
    var rn = G.macroRoadN(m, cx, cy), rw = G.macroRoadW(m, cx, cy);
    if ((rn || rw) && rng.chance(G.isTownType(type) ? 0.06 : 0.12)) {
      var horiz = rn && (!rw || rng.chance(0.5));
      var ax = horiz ? rng.int(RW + 3, CH - 6) : rng.int(0, 2), ay = horiz ? rng.int(0, 2) : rng.int(RW + 3, CH - 6);
      if (placeCar(ctx, ax, ay, horiz ? 0 : 1)) {
        c.decals = c.decals || [];
        for (var bdx = 0; bdx < 10; bdx++) { c.decals.push({ x: ctx.ox + ax + rng.range(-1, 3), y: ctx.oy + ay + rng.range(-1, 3), z: 0, s: rng.range(3, 7), r: 0 }); }
        for (var cn = 0; cn < rng.int(1, 2); cn++) {
          var crx = ctx.ox + ax + rng.range(0, 2), cry = ctx.oy + ay + (horiz ? 1.6 : rng.range(0, 2));
          if (horiz) { cry = ctx.oy + ay + 1.6; } else { crx = ctx.ox + ax + 1.6; }
          var dz = CP.Zombies ? CP.Zombies.makeData(rng, crx, cry, 0, null, null) : null;
          if (dz) {
            var look = CP.Zombies.fromData(dz).look;
            look.zombie = false; look.skin = rng.pick(CP.C.SKIN_TONES);
            c.corpses.push({ x: crx, y: cry, z: 0, ang: rng.range(0, 6.28), look: look, items: [makeItem(ctx, rng.pick(['wallet', 'car_key', 'water_bottle', 'map', 'first_aid_kit', 'cigarettes']), null)], t: -86400 });
          }
        }
        for (var zz = 0; zz < rng.int(1, 3); zz++) { addZombie(ctx, Math.min(CH - 1, ax + rng.int(-2, 3)), Math.min(CH - 1, Math.max(0, ay + rng.int(-2, 3))), 0, null, { crawler: rng.chance(0.3) }); }
      }
    }
    // bloqueio policial na rodovia (fora da cidade)
    if (!G.isTownType(type) && type !== T.BORDER && (rn || rw) && rng.chance(0.05)) {
      var hz = rn && (!rw || rng.chance(0.5));
      for (var bk = 0; bk < RW; bk++) {
        var bx = hz ? 14 : bk, by = hz ? bk : 14;
        if (bk === 2) { continue; }
        if (!ctx.obj(bx, by, 0)) { ctx.setObj(bx, by, 0, rng.chance(0.5) ? O.BARREL : O.CRATE, 0); }
      }
      placeCar(ctx, hz ? 16 : 1, hz ? 1 : 16, hz ? 0 : 1);
      for (var pz = 0; pz < rng.int(2, 4); pz++) { addZombie(ctx, (hz ? 12 : 2) + rng.int(0, 4), (hz ? 2 : 12) + rng.int(0, 4), 0, 'police', null); }
    }
  }

  CP.Gen = G;
})(window.CP = window.CP || {});
