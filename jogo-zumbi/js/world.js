/* Modelo do mundo: chunks, acesso a tiles/bordas, colisão, linha de visão, escadas.
 * Paredes ficam nas bordas NORTE (wn) e OESTE (ww) de cada tile:
 *   wn(x,y) separa (x,y-1) de (x,y);  ww(x,y) separa (x-1,y) de (x,y). */
(function (CP) {
  'use strict';

  var C = CP.C;
  var CH = C.CHUNK;
  var SHIFT = Math.round(Math.log(CH) / Math.LN2);
  var MASK = CH - 1;
  var WC = C.WORLD_CHUNKS;
  var WORLD_TILES = WC * CH;
  var NLEV = C.LEVELS;
  var AREA = CH * CH;
  var E = C.EDGE;
  var OI = C.OBJ_INFO;
  var O = C.OBJ;

  var W = {
    seed: 0,
    macro: null,
    grid: new Array(WC * WC),     // chunk ou null
    size: WORLD_TILES,
    chunkShift: SHIFT,
    generatedCount: 0
  };

  function newLevel() {
    return {
      floor: new Uint8Array(AREA), fvar: new Uint8Array(AREA),
      wn: new Uint8Array(AREA), wns: new Uint8Array(AREA),
      ww: new Uint8Array(AREA), wws: new Uint8Array(AREA),
      obj: new Uint8Array(AREA), odir: new Uint8Array(AREA),
      room: new Uint16Array(AREA)
    };
  }
  W.newChunk = function (cx, cy) {
    var levels = [];
    for (var z = 0; z < NLEV; z++) { levels.push(newLevel()); }
    return {
      cx: cx, cy: cy, levels: levels,
      rooms: [null], buildings: [],
      edges: {},            // chave numérica → estado de porta/janela
      containers: {},       // chave → { items: [], gen: bool }
      items: {},            // itens no chão: chave → [itens]
      zombies: [],          // zumbis guardados (dados simples) quando o chunk está inativo
      corpses: [],          // cadáveres { x, y, z, look, items }
      crops: {},            // plantações
      water: {},            // água em coletores/vasos: chave → litros
      fires: {},
      active: false,
      dirty: true
    };
  };

  /* ---------- Acesso básico ---------- */
  W.inBounds = function (x, y) { return x >= 0 && y >= 0 && x < WORLD_TILES && y < WORLD_TILES; };
  W.chunkAt = function (x, y) {
    if (x < 0 || y < 0 || x >= WORLD_TILES || y >= WORLD_TILES) { return null; }
    return W.grid[(y >> SHIFT) * WC + (x >> SHIFT)] || null;
  };
  W.chunkByIndex = function (cx, cy) {
    if (cx < 0 || cy < 0 || cx >= WC || cy >= WC) { return null; }
    return W.grid[cy * WC + cx] || null;
  };
  W.idx = function (x, y) { return ((y & MASK) << SHIFT) | (x & MASK); };
  W.key = function (x, y, z) { return z * AREA + (((y & MASK) << SHIFT) | (x & MASK)); };
  W.lvl = function (x, y, z) {
    if (z < 0 || z >= NLEV) { return null; }
    var c = W.chunkAt(x, y);
    return c ? c.levels[z] : null;
  };
  W.floor = function (x, y, z) { var l = W.lvl(x, y, z); return l ? l.floor[W.idx(x, y)] : 0; };
  W.wn = function (x, y, z) { var l = W.lvl(x, y, z); return l ? l.wn[W.idx(x, y)] : 0; };
  W.ww = function (x, y, z) { var l = W.lvl(x, y, z); return l ? l.ww[W.idx(x, y)] : 0; };
  W.obj = function (x, y, z) { var l = W.lvl(x, y, z); return l ? l.obj[W.idx(x, y)] : 0; };
  W.odir = function (x, y, z) { var l = W.lvl(x, y, z); return l ? l.odir[W.idx(x, y)] : 0; };
  W.roomId = function (x, y, z) { var l = W.lvl(x, y, z); return l ? l.room[W.idx(x, y)] : 0; };
  W.room = function (x, y, z) {
    var c = W.chunkAt(x, y);
    if (!c || z < 0 || z >= NLEV) { return null; }
    var r = c.levels[z].room[W.idx(x, y)];
    return r ? c.rooms[r] : null;
  };
  W.isIndoor = function (x, y, z) { return W.roomId(x, y, z) > 0; };
  W.building = function (x, y, z) {
    var r = W.room(x, y, z);
    if (!r) { return null; }
    var c = W.chunkAt(x, y);
    return c.buildings[r.bld] || null;
  };

  /* ---------- Bordas (portas, janelas) ---------- */
  /* side: 0 = norte, 1 = oeste */
  W.edgeType = function (x, y, z, side) { return side === 0 ? W.wn(x, y, z) : W.ww(x, y, z); };
  W.edgeKey = function (x, y, z, side) { return W.key(x, y, z) * 2 + side; };
  W.edgeState = function (x, y, z, side) {
    var c = W.chunkAt(x, y);
    if (!c) { return null; }
    return c.edges[W.edgeKey(x, y, z, side)] || null;
  };
  W.setEdgeState = function (x, y, z, side, st) {
    var c = W.chunkAt(x, y);
    if (!c) { return; }
    c.edges[W.edgeKey(x, y, z, side)] = st;
    c.dirty = true;
  };
  W.setEdge = function (x, y, z, side, type, style) {
    var l = W.lvl(x, y, z);
    if (!l) { return; }
    var i = W.idx(x, y);
    if (side === 0) { l.wn[i] = type; l.wns[i] = style || 0; } else { l.ww[i] = type; l.wws[i] = style || 0; }
    W.chunkAt(x, y).dirty = true;
  };

  /* Uma borda bloqueia movimento? */
  W.edgeBlocksMove = function (type, st) {
    if (type === E.NONE || type === E.DOORWAY) { return false; }
    if (type === E.DOOR || type === E.GARAGE) {
      if (!st) { return true; }
      if (st.bar > 0 && !st.broken) { return true; }
      return !(st.open || st.broken);
    }
    return true; // parede, janela, cerca
  };
  /* bloqueia visão? */
  W.edgeBlocksSight = function (type, st) {
    if (type === E.NONE || type === E.DOORWAY || type === E.FENCE || type === E.FENCE_TALL) { return false; }
    if (type === E.WINDOW) { return !!(st && (st.bar >= 3 || st.curtain)); }
    if (type === E.DOOR || type === E.GARAGE) {
      if (!st) { return true; }
      if (st.broken) { return st.bar >= 3; }
      return !st.open || st.bar >= 3;
    }
    return true;
  };
  /* Bloqueio entre tiles vizinhos ortogonais (a → b) */
  W.blockedBetween = function (ax, ay, bx, by, z, forSight) {
    var x, y, side;
    if (bx === ax + 1 && by === ay) { x = bx; y = by; side = 1; } else if (bx === ax - 1 && by === ay) { x = ax; y = ay; side = 1; } else if (by === ay + 1 && bx === ax) { x = bx; y = by; side = 0; } else if (by === ay - 1 && bx === ax) { x = ax; y = ay; side = 0; } else { return false; }
    var t = W.edgeType(x, y, z, side);
    if (t === E.NONE) { return false; }
    var st = W.edgeState(x, y, z, side);
    return forSight ? W.edgeBlocksSight(t, st) : W.edgeBlocksMove(t, st);
  };

  /* ---------- Escadas ----------
   * Objeto STAIRS no nível 0, 3 tiles em coluna. odir: bits 0-1 = direção (0 = sobe para o norte, 1 = sobe para oeste),
   * bits 2-3 = parte (0 = base, 1 = meio, 2 = topo). */
  W.stairAt = function (x, y) {
    var l = W.lvl(x, y, 0);
    if (!l) { return null; }
    var i = W.idx(x, y);
    if (l.obj[i] !== O.STAIRS) { return null; }
    var d = l.odir[i] & 3, part = (l.odir[i] >> 2) & 3;
    if (d === 0) { return { dir: 0, part: part, sx: x, top: y - (2 - part), bottom: y + part + 1 }; }
    return { dir: 1, part: part, sy: y, top: x - (2 - part), bottom: x + part + 1 };
  };
  /* Altura (z) em cima da escada para a posição contínua */
  W.stairZ = function (st, px, py) {
    var v = st.dir === 0 ? py : px;
    return CP.U.clamp((st.bottom - v) / 3, 0, 1);
  };

  /* ---------- Caminhabilidade de um tile ---------- */
  W.tileWalkable = function (x, y, z) {
    var l = W.lvl(x, y, z);
    if (!l) { return false; }
    var i = W.idx(x, y);
    if (z > 0 && W.stairAt(x, y)) { return true; }
    if (!C.FLOOR_WALKABLE[l.floor[i]]) { return false; }
    var o = l.obj[i];
    if (o && OI[o].solid) { return false; }
    return true;
  };
  W.tileSolidObj = function (x, y, z) {
    var o = W.obj(x, y, z);
    return o ? OI[o].solid : false;
  };

  /* ---------- Colisão de círculo ----------
   * Move (x,y) por (dx,dy) com raio r no nível z. Desliza nas paredes.
   * Retorna { x, y, hit } — também trata escadas (z contínuo). */
  var segs = [];
  function addSeg(x1, y1, x2, y2) { segs.push(x1, y1, x2, y2); }
  function gatherBlockers(cx, cy, z, r, onStairs) {
    segs.length = 0;
    var x0 = Math.floor(cx - r - 1), x1 = Math.floor(cx + r + 1);
    var y0 = Math.floor(cy - r - 1), y1 = Math.floor(cy + r + 1);
    var lz = z;
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var l = W.lvl(x, y, lz);
        if (!l) { addSeg(x, y, x + 1, y); addSeg(x, y, x, y + 1); addSeg(x + 1, y, x + 1, y + 1); addSeg(x, y + 1, x + 1, y + 1); continue; }
        var i = W.idx(x, y);
        var t = l.wn[i];
        if (t && W.edgeBlocksMove(t, W.edgeState(x, y, lz, 0))) { addSeg(x, y, x + 1, y); }
        t = l.ww[i];
        if (t && W.edgeBlocksMove(t, W.edgeState(x, y, lz, 1))) { addSeg(x, y, x, y + 1); }
        var st = W.stairAt(x, y);
        if (st) {
          // paredes virtuais nas laterais da escada e na entrada errada
          if (st.dir === 0) {
            addSeg(x, y, x, y + 1); addSeg(x + 1, y, x + 1, y + 1);
            if (st.part === 2 && !(onStairs || lz >= 1)) { addSeg(x, y, x + 1, y); }
            if (st.part === 0 && lz >= 1) { addSeg(x, y + 1, x + 1, y + 1); }
          } else {
            addSeg(x, y, x + 1, y); addSeg(x, y + 1, x + 1, y + 1);
            if (st.part === 2 && !(onStairs || lz >= 1)) { addSeg(x, y, x, y + 1); }
            if (st.part === 0 && lz >= 1) { addSeg(x + 1, y, x + 1, y + 1); }
          }
          continue;
        }
        // piso inexistente/água ou objeto sólido = caixa
        var blockedTile = !C.FLOOR_WALKABLE[l.floor[i]] || (l.obj[i] && OI[l.obj[i]].solid);
        if (blockedTile) {
          var m = (l.obj[i] && OI[l.obj[i]].solid && C.FLOOR_WALKABLE[l.floor[i]]) ? 0.12 : 0;
          addSeg(x + m, y + m, x + 1 - m, y + m); addSeg(x + 1 - m, y + m, x + 1 - m, y + 1 - m);
          addSeg(x + m, y + 1 - m, x + 1 - m, y + 1 - m); addSeg(x + m, y + m, x + m, y + 1 - m);
        }
      }
    }
  }
  function pushOut(p, r) {
    var hit = false;
    for (var k = 0; k < segs.length; k += 4) {
      var ax = segs[k], ay = segs[k + 1], bx = segs[k + 2], by = segs[k + 3];
      var abx = bx - ax, aby = by - ay;
      var t = ((p.x - ax) * abx + (p.y - ay) * aby) / (abx * abx + aby * aby);
      if (t < 0) { t = 0; } else if (t > 1) { t = 1; }
      var qx = ax + abx * t, qy = ay + aby * t;
      var dx = p.x - qx, dy = p.y - qy;
      var d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        var d = Math.sqrt(d2);
        if (d < 1e-6) { dx = -aby; dy = abx; d = Math.sqrt(dx * dx + dy * dy); }
        var push = (r - d) + 1e-4;
        p.x += dx / d * push; p.y += dy / d * push;
        hit = true;
      }
    }
    return hit;
  }
  var tmpP = { x: 0, y: 0 };
  W.moveCircle = function (ent, dx, dy, r) {
    var lz = ent.z >= 0.5 ? Math.round(ent.z) : 0;
    if (ent.z >= 0.5 && ent.z < 1.5) { lz = 1; }
    var curSt = W.stairAt(Math.floor(ent.x), Math.floor(ent.y));
    var onStairs = !!curSt && (lz === 0 || ent.z < 0.999);
    var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (r * 0.8)));
    var sx = dx / steps, sy = dy / steps;
    var hit = false;
    tmpP.x = ent.x; tmpP.y = ent.y;
    for (var s = 0; s < steps; s++) {
      tmpP.x += sx; tmpP.y += sy;
      gatherBlockers(tmpP.x, tmpP.y, lz, r, onStairs);
      for (var it = 0; it < 3; it++) { if (!pushOut(tmpP, r)) { break; } hit = true; }
    }
    ent.x = tmpP.x; ent.y = tmpP.y;
    // escadas: atualiza z contínuo
    var st = W.stairAt(Math.floor(ent.x), Math.floor(ent.y));
    if (st) {
      ent.z = W.stairZ(st, ent.x, ent.y);
    } else if (onStairs && curSt) {
      // saiu da escada: pelo topo → andar 1, pela base → 0
      ent.z = ent.z >= 0.5 ? 1 : 0;
    } else {
      ent.z = lz;
    }
    return hit;
  };
  W.levelOf = function (z) { return z >= 0.5 ? (z >= 1.5 ? 2 : 1) : 0; };

  /* ---------- Linha de visão (DDA em grade com bordas) ---------- */
  W.lineOfSight = function (x0, y0, x1, y1, z, maxSteps) {
    var tx = Math.floor(x0), ty = Math.floor(y0);
    var ex = Math.floor(x1), ey = Math.floor(y1);
    var dx = x1 - x0, dy = y1 - y0;
    var stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    var tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    var tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    var tMaxX = dx !== 0 ? (dx > 0 ? (tx + 1 - x0) : (x0 - tx)) * tDeltaX : Infinity;
    var tMaxY = dy !== 0 ? (dy > 0 ? (ty + 1 - y0) : (y0 - ty)) * tDeltaY : Infinity;
    var n = maxSteps || 200;
    while ((tx !== ex || ty !== ey) && n-- > 0) {
      var nx = tx, ny = ty;
      if (Math.abs(tMaxX - tMaxY) < 1e-9) {
        // passa exatamente pelo canto: bloqueia só se ambos os caminhos bloquearem
        var b1 = W.blockedBetween(tx, ty, tx + stepX, ty, z, true) || W.blockedBetween(tx + stepX, ty, tx + stepX, ty + stepY, z, true);
        var b2 = W.blockedBetween(tx, ty, tx, ty + stepY, z, true) || W.blockedBetween(tx, ty + stepY, tx + stepX, ty + stepY, z, true);
        if (b1 && b2) { return false; }
        tx += stepX; ty += stepY; tMaxX += tDeltaX; tMaxY += tDeltaY;
        continue;
      }
      if (tMaxX < tMaxY) { nx = tx + stepX; tMaxX += tDeltaX; } else { ny = ty + stepY; tMaxY += tDeltaY; }
      if (W.blockedBetween(tx, ty, nx, ny, z, true)) { return false; }
      tx = nx; ty = ny;
      var o = W.obj(tx, ty, z);
      if (o && OI[o].opaque) { return false; }
    }
    return true;
  };

  /* linha reta "andável" (sem paredes/portas fechadas/objetos sólidos) entre dois pontos no mesmo nível */
  W.walkLine = function (x0, y0, x1, y1, z, maxSteps) {
    var tx = Math.floor(x0), ty = Math.floor(y0);
    var ex = Math.floor(x1), ey = Math.floor(y1);
    var dx = x1 - x0, dy = y1 - y0;
    var stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    var tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    var tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    var tMaxX = dx !== 0 ? (dx > 0 ? (tx + 1 - x0) : (x0 - tx)) * tDeltaX : Infinity;
    var tMaxY = dy !== 0 ? (dy > 0 ? (ty + 1 - y0) : (y0 - ty)) * tDeltaY : Infinity;
    var n = maxSteps || 60;
    while ((tx !== ex || ty !== ey) && n-- > 0) {
      var nx = tx, ny = ty;
      if (Math.abs(tMaxX - tMaxY) < 1e-9) {
        if (W.stepLevel(tx, ty, z, stepX, stepY) !== z) { return false; }
        tx += stepX; ty += stepY; tMaxX += tDeltaX; tMaxY += tDeltaY;
        continue;
      }
      if (tMaxX < tMaxY) { nx = tx + stepX; tMaxX += tDeltaX; } else { ny = ty + stepY; tMaxY += tDeltaY; }
      if (W.stepLevel(tx, ty, z, nx - tx, ny - ty) !== z) { return false; }
      tx = nx; ty = ny;
    }
    return n > 0;
  };

  /* ---------- Passo de pathfinding entre tiles ----------
   * Retorna o nível de destino ou -1. Diagonais exigem os dois caminhos ortogonais livres.
   * opts.doorsPassable: portas/janelas fechadas contam como passáveis (zumbis batem nelas). */
  W.stepLevel = function (x, y, z, dx, dy, opts) {
    var nx = x + dx, ny = y + dy;
    if (!W.inBounds(nx, ny)) { return -1; }
    var st = W.stairAt(x, y), nst = W.stairAt(nx, ny);
    if (dx !== 0 && dy !== 0) {
      if (st || nst) { return -1; }
      if (W.stepLevel(x, y, z, dx, 0, opts) !== z || W.stepLevel(x + dx, y, z, 0, dy, opts) !== z) { return -1; }
      if (W.stepLevel(x, y, z, 0, dy, opts) !== z || W.stepLevel(x, y + dy, z, dx, 0, opts) !== z) { return -1; }
      return z;
    }
    // escadas
    if (st) {
      var along = st.dir === 0 ? (dx === 0 && dy !== 0) : (dy === 0 && dx !== 0);
      if (!along) { return -1; }
      var up = st.dir === 0 ? dy < 0 : dx < 0;
      if (up && st.part === 2) { return W.tileWalkable(nx, ny, 1) ? 1 : -1; }
      if (!up && st.part === 0) { return W.tileWalkable(nx, ny, 0) && !W.blockedBetween(x, y, nx, ny, 0, false) ? 0 : -1; }
      return nst ? 0 : -1;
    }
    if (nst) {
      var along2 = nst.dir === 0 ? (dx === 0) : (dy === 0);
      if (!along2) { return -1; }
      var goingUp = nst.dir === 0 ? dy < 0 : dx < 0;
      if (goingUp && nst.part === 0 && z === 0) { return W.blockedBetween(x, y, nx, ny, 0, false) ? -1 : 0; }
      if (!goingUp && nst.part === 2 && z === 1) { return 0; }
      return -1;
    }
    if (!W.tileWalkable(nx, ny, z)) { return -1; }
    var ex, ey, side;
    if (dx === 1) { ex = nx; ey = ny; side = 1; } else if (dx === -1) { ex = x; ey = y; side = 1; } else if (dy === 1) { ex = nx; ey = ny; side = 0; } else { ex = x; ey = y; side = 0; }
    var t = W.edgeType(ex, ey, z, side);
    if (t !== E.NONE) {
      var es = W.edgeState(ex, ey, z, side);
      if (W.edgeBlocksMove(t, es)) {
        if (opts && opts.doorsPassable && (t === E.DOOR || t === E.WINDOW || t === E.GARAGE)) { return z; }
        if (opts && opts.fencesPassable && t === E.FENCE) { return z; }
        return -1;
      }
    }
    return z;
  };

  /* ---------- Criação / carregamento ---------- */
  W.init = function (seed) {
    W.seed = seed >>> 0;
    W.grid = new Array(WC * WC);
    W.generatedCount = 0;
    W.macro = CP.Gen.genMacro(W.seed);
  };
  W.ensureChunk = function (cx, cy) {
    if (cx < 0 || cy < 0 || cx >= WC || cy >= WC) { return null; }
    var k = cy * WC + cx;
    var c = W.grid[k];
    if (!c) {
      c = CP.Gen.genChunk(cx, cy, W.seed, W.macro);
      W.grid[k] = c;
      W.generatedCount++;
    }
    return c;
  };
  W.ensureAround = function (x, y, radius) {
    var cx = x >> SHIFT, cy = y >> SHIFT;
    for (var dy = -radius; dy <= radius; dy++) {
      for (var dx = -radius; dx <= radius; dx++) { W.ensureChunk(cx + dx, cy + dy); }
    }
  };
  W.allChunks = function () {
    var out = [];
    for (var i = 0; i < W.grid.length; i++) { if (W.grid[i]) { out.push(W.grid[i]); } }
    return out;
  };

  /* ---------- Itens no chão / recipientes ---------- */
  W.floorItems = function (x, y, z, create) {
    var c = W.chunkAt(x, y);
    if (!c) { return null; }
    var k = W.key(x, y, z);
    if (!c.items[k] && create) { c.items[k] = []; }
    return c.items[k] || null;
  };
  W.container = function (x, y, z) {
    var c = W.chunkAt(x, y);
    if (!c) { return null; }
    var o = W.obj(x, y, z);
    if (!o || !OI[o].cap) { return null; }
    var k = W.key(x, y, z);
    var cont = c.containers[k];
    if (!cont) { cont = c.containers[k] = { items: [], gen: false }; }
    if (!cont.gen) {
      cont.gen = true;
      if (CP.Loot) { CP.Loot.fill(cont, x, y, z, o); }
      c.dirty = true;
    }
    return cont;
  };

  CP.W = W;
})(window.CP = window.CP || {});
