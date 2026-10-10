/* Campo de visão (raios em grade com bordas) + mapa de luz ao redor do jogador. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W;
  var R = C.VISION_RADIUS;
  var S = R * 2 + 3;

  var V = {
    R: R, size: S, ox: 0, oy: 0, z: 0,
    vis: new Uint8Array(S * S),
    light: new Float32Array(S * S),
    seen: {},              // tiles já vistos (para o mapa) — chave de chunk → Uint8Array
    ambientOut: 1, ambientIn: 0.75,
    px: 0, py: 0,
    stamp: 0
  };

  function idx(x, y) { return (y - V.oy) * S + (x - V.ox); }
  function inWin(x, y) { return x >= V.ox && y >= V.oy && x < V.ox + S && y < V.oy + S; }
  V.inWin = inWin;
  V.isVisible = function (x, y, z) {
    if (z !== V.z || !inWin(x, y)) { return false; }
    return V.vis[idx(x, y)] === 1;
  };
  V.lightAt = function (x, y, z) {
    if (z === V.z && inWin(x, y)) { return V.light[idx(x, y)]; }
    return W.isIndoor(x, y, z) ? V.ambientIn : V.ambientOut;
  };
  /* brilho final do tile para desenho */
  V.brightness = function (x, y, z, viewZ) {
    if (z > viewZ) { return V.ambientOut; }
    if (z < viewZ) { return V.ambientOut * 0.55; }
    if (!inWin(x, y)) { return (W.isIndoor(x, y, z) ? V.ambientIn : V.ambientOut) * C.FOG_DIM; }
    var i = idx(x, y);
    var l = V.light[i];
    return V.vis[i] ? l : l * C.FOG_DIM;
  };

  function markSeen(x, y) {
    var c = W.chunkAt(x, y);
    if (!c) { return; }
    if (!c.seen) { c.seen = new Uint8Array(C.CHUNK * C.CHUNK); }
    c.seen[W.idx(x, y)] = 1;
  }

  /* lança um raio de (x0,y0) até (x1,y1) marcando tiles visíveis até maxDist */
  function cast(x0, y0, x1, y1, z, maxDist) {
    var tx = Math.floor(x0), ty = Math.floor(y0);
    var dx = x1 - x0, dy = y1 - y0;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) { return; }
    var stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    var tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    var tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    var tMaxX = dx !== 0 ? (dx > 0 ? (tx + 1 - x0) : (x0 - tx)) * tDeltaX : Infinity;
    var tMaxY = dy !== 0 ? (dy > 0 ? (ty + 1 - y0) : (y0 - ty)) * tDeltaY : Infinity;
    var tLimit = maxDist / len;
    for (var n = 0; n < 200; n++) {
      var t = Math.min(tMaxX, tMaxY);
      if (t > tLimit) { return; }
      var nx = tx, ny = ty;
      if (Math.abs(tMaxX - tMaxY) < 1e-9) {
        var b1 = W.blockedBetween(tx, ty, tx + stepX, ty, z, true) || W.blockedBetween(tx + stepX, ty, tx + stepX, ty + stepY, z, true);
        var b2 = W.blockedBetween(tx, ty, tx, ty + stepY, z, true) || W.blockedBetween(tx, ty + stepY, tx + stepX, ty + stepY, z, true);
        if (b1 && b2) { return; }
        nx = tx + stepX; ny = ty + stepY; tMaxX += tDeltaX; tMaxY += tDeltaY;
      } else if (tMaxX < tMaxY) {
        nx = tx + stepX; tMaxX += tDeltaX;
        if (W.blockedBetween(tx, ty, nx, ny, z, true)) { return; }
      } else {
        ny = ty + stepY; tMaxY += tDeltaY;
        if (W.blockedBetween(tx, ty, nx, ny, z, true)) { return; }
      }
      tx = nx; ty = ny;
      if (!inWin(tx, ty)) { return; }
      V.vis[idx(tx, ty)] = 1;
      var o = W.obj(tx, ty, z);
      if (o && C.OBJ_INFO[o].opaque) { return; }
    }
  }

  /* calcula visibilidade a partir de (px,py) no nível z olhando para ang */
  V.compute = function (px, py, z, ang, opts) {
    opts = opts || {};
    var ptx = Math.floor(px), pty = Math.floor(py);
    V.ox = ptx - R - 1; V.oy = pty - R - 1; V.z = z; V.px = px; V.py = py;
    V.vis.fill(0);
    if (inWin(ptx, pty)) { V.vis[idx(ptx, pty)] = 1; }
    var cone = (opts.cone || C.VISION_CONE_DEG) * Math.PI / 360;
    var near = opts.near || C.VISION_NEAR;
    var radius = opts.radius || R;
    var n = Math.ceil(radius * 8);
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var inCone = Math.abs(U.angleDiff(ang, a)) <= cone;
      var dist = inCone ? radius : near;
      cast(px, py, px + Math.cos(a) * (dist + 1), py + Math.sin(a) * (dist + 1), z, dist);
    }
    // preenche buracos (tiles cercados por visíveis sem parede entre eles)
    var x, y, k;
    for (y = V.oy + 1; y < V.oy + S - 1; y++) {
      for (x = V.ox + 1; x < V.ox + S - 1; x++) {
        k = idx(x, y);
        if (V.vis[k]) { continue; }
        var cnt = 0;
        if (V.vis[k - 1] === 1 && !W.blockedBetween(x - 1, y, x, y, z, true)) { cnt++; }
        if (V.vis[k + 1] === 1 && !W.blockedBetween(x + 1, y, x, y, z, true)) { cnt++; }
        if (V.vis[k - S] === 1 && !W.blockedBetween(x, y - 1, x, y, z, true)) { cnt++; }
        if (V.vis[k + S] === 1 && !W.blockedBetween(x, y + 1, x, y, z, true)) { cnt++; }
        if (cnt >= 3) {
          var ddx = x + 0.5 - px, ddy = y + 0.5 - py;
          if (Math.abs(U.angleDiff(ang, Math.atan2(ddy, ddx))) <= cone + 0.1) { V.vis[k] = 2; }
        }
      }
    }
    for (k = 0; k < V.vis.length; k++) { if (V.vis[k] === 2) { V.vis[k] = 1; } }
    if (z === 0 || opts.markSeen !== false) {
      for (y = 0; y < S; y += 1) {
        for (x = 0; x < S; x += 1) { if (V.vis[y * S + x]) { markSeen(V.ox + x, V.oy + y); } }
      }
    }
    V.stamp++;
  };

  /* ---------- Luz ---------- */
  /* sources: [{x, y, z, r, i (intensidade), indoor(bool|undefined), cone: {ang, half}}] */
  V.computeLight = function (ambient, sources, power) {
    V.ambientOut = ambient;
    V.ambientIn = Math.max(0.08, ambient * 0.72);
    var z = V.z;
    var x, y, k;
    for (y = 0; y < S; y++) {
      for (x = 0; x < S; x++) {
        k = y * S + x;
        var wx = V.ox + x, wy = V.oy + y;
        var room = W.room(wx, wy, z);
        var l = room ? V.ambientIn : V.ambientOut;
        if (room && power && room.lit) { l = Math.max(l, 0.78); }
        V.light[k] = l;
      }
    }
    for (var s = 0; s < sources.length; s++) {
      var src = sources[s];
      if (src.z !== z) { continue; }
      var r = src.r, r2 = r * r;
      var x0 = Math.max(V.ox, Math.floor(src.x - r)), x1 = Math.min(V.ox + S - 1, Math.floor(src.x + r));
      var y0 = Math.max(V.oy, Math.floor(src.y - r)), y1 = Math.min(V.oy + S - 1, Math.floor(src.y + r));
      for (y = y0; y <= y1; y++) {
        for (x = x0; x <= x1; x++) {
          var ddx = x + 0.5 - src.x, ddy = y + 0.5 - src.y;
          var d2 = ddx * ddx + ddy * ddy;
          if (d2 > r2) { continue; }
          k = idx(x, y);
          if (src.indoor === false && W.isIndoor(x, y, z)) { continue; }
          if (src.cone) {
            if (d2 > 1.5 && Math.abs(U.angleDiff(src.cone.ang, Math.atan2(ddy, ddx))) > src.cone.half) { continue; }
            if (!V.vis[k]) { continue; }
          }
          if (src.los && !V.vis[k] && d2 > 2) { continue; }
          var v = src.i * (1 - Math.sqrt(d2) / r);
          if (v > V.light[k]) { V.light[k] = Math.min(1, v); }
        }
      }
    }
  };

  /* luz do dia conforme a hora (0..24) */
  V.daylight = function (hour, dayOfYear) {
    var dawn = C.DAWN_HOUR, dusk = C.DUSK_HOUR;
    var night = 0.16;
    if (hour >= dawn + 1 && hour <= dusk - 1) { return 1; }
    if (hour < dawn || hour > dusk) { return night; }
    if (hour < dawn + 1) { return night + (1 - night) * (hour - dawn); }
    return night + (1 - night) * (dusk - hour);
  };

  CP.Vis = V;
})(window.CP = window.CP || {});
