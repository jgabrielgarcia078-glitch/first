/* A* em grade 8-direções com níveis (escadas). Portas/janelas fechadas contam como passáveis com custo
 * (zumbis batem nelas). Usa arrays tipados numa janela em volta da origem (rápido, sem Map). */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W;
  var SQ2 = Math.SQRT2;
  var DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  var S = 160, HALF = S / 2, NL = C.LEVELS;
  var N = S * S * NL;
  var gArr = new Float32Array(N), par = new Int32Array(N), stamp = new Uint32Array(N), closed = new Uint32Array(N);
  var run = 0;
  /* heap binário de índices */
  var hIdx = new Int32Array(N), hPri = new Float32Array(N), hSize = 0;
  function hPush(i, p) {
    var k = hSize++;
    hIdx[k] = i; hPri[k] = p;
    while (k > 0) {
      var pa = (k - 1) >> 1;
      if (hPri[pa] <= hPri[k]) { break; }
      var ti = hIdx[k]; hIdx[k] = hIdx[pa]; hIdx[pa] = ti;
      var tp = hPri[k]; hPri[k] = hPri[pa]; hPri[pa] = tp;
      k = pa;
    }
  }
  function hPop() {
    var top = hIdx[0];
    hSize--;
    if (hSize > 0) {
      hIdx[0] = hIdx[hSize]; hPri[0] = hPri[hSize];
      var k = 0;
      for (;;) {
        var l = k * 2 + 1, r = l + 1, m = k;
        if (l < hSize && hPri[l] < hPri[m]) { m = l; }
        if (r < hSize && hPri[r] < hPri[m]) { m = r; }
        if (m === k) { break; }
        var ti = hIdx[k]; hIdx[k] = hIdx[m]; hIdx[m] = ti;
        var tp = hPri[k]; hPri[k] = hPri[m]; hPri[m] = tp;
        k = m;
      }
    }
    return top;
  }

  var Path = { stats: { runs: 0, nodes: 0 }, lastNodes: 0 };

  /* opts: { maxNodes, doorsPassable, fencesPassable, doorCost, partial } */
  Path.find = function (sx, sy, sz, tx, ty, tz, opts) {
    opts = opts || {};
    var maxNodes = opts.maxNodes || C.ZOMBIE.PATH_MAX_NODES;
    var doorCost = opts.doorCost || 8;
    Path.stats.runs++;
    if (sx === tx && sy === ty && sz === tz) { Path.lastNodes = 0; return []; }
    run++;
    if (run >= 4294967000) { run = 1; stamp.fill(0); closed.fill(0); }
    var ox = sx - HALF, oy = sy - HALF;
    // alvo fora da janela: aproxima pela borda (caminho parcial)
    var ctx = U.clamp(tx, ox + 1, ox + S - 2), cty = U.clamp(ty, oy + 1, oy + S - 2);
    var clamped = ctx !== tx || cty !== ty;
    var startI = (sz * S + (sy - oy)) * S + (sx - ox);
    var goalI = (tz * S + (cty - oy)) * S + (ctx - ox);
    hSize = 0;
    stamp[startI] = run; gArr[startI] = 0; par[startI] = -1;
    hPush(startI, 0);
    var nodes = 0, found = false;
    var best = startI, bestH = 1e9;
    var stepOpts = { doorsPassable: !!opts.doorsPassable, fencesPassable: !!opts.fencesPassable };
    while (hSize > 0 && nodes < maxNodes) {
      var cur = hPop();
      if (closed[cur] === run) { continue; }
      closed[cur] = run;
      if (cur === goalI) { found = true; break; }
      nodes++;
      var lx = cur % S, rest = (cur - lx) / S, ly = rest % S, cz = (rest - ly) / S;
      var cx = lx + ox, cy = ly + oy;
      var gc = gArr[cur];
      var hcur = Math.abs(cx - ctx) + Math.abs(cy - cty) + Math.abs(cz - tz) * 4;
      if (hcur < bestH) { bestH = hcur; best = cur; }
      for (var d = 0; d < 8; d++) {
        var dx = DX[d], dy = DY[d];
        var nlx = lx + dx, nly = ly + dy;
        if (nlx < 0 || nly < 0 || nlx >= S || nly >= S) { continue; }
        var diag = d >= 4;
        var nz = W.stepLevel(cx, cy, cz, dx, dy, diag ? null : stepOpts);
        if (nz < 0) { continue; }
        var ni = (nz * S + nly) * S + nlx;
        if (closed[ni] === run) { continue; }
        var cost = diag ? SQ2 : 1;
        if (!diag && nz === cz && W.blockedBetween(cx, cy, cx + dx, cy + dy, cz, false)) {
          cost += edgeTypeBetween(cx, cy, cx + dx, cy + dy, cz) === C.EDGE.FENCE ? 2.5 : doorCost;
        }
        var ng = gc + cost;
        if (stamp[ni] === run && gArr[ni] <= ng) { continue; }
        stamp[ni] = run; gArr[ni] = ng; par[ni] = cur;
        var hx = Math.abs(nlx + ox - ctx), hy = Math.abs(nly + oy - cty);
        var h = (hx > hy ? hx : hy) + Math.abs(nz - tz) * 3;
        hPush(ni, ng + h * 1.05);
      }
    }
    Path.stats.nodes += nodes;
    Path.lastNodes = nodes;
    var end = found ? goalI : ((opts.partial || clamped) ? best : -1);
    if (end < 0 || end === startI) { return null; }
    var out = [];
    var k = end, guard = 0;
    while (k !== startI && k >= 0 && guard++ < 20000) {
      var x = k % S, r2 = (k - x) / S, y = r2 % S, z = (r2 - y) / S;
      out.push({ x: x + ox, y: y + oy, z: z });
      k = par[k];
    }
    out.reverse();
    return out;
  };

  function edgeTypeBetween(ax, ay, bx, by, z) {
    if (bx === ax + 1) { return W.ww(bx, by, z); }
    if (bx === ax - 1) { return W.ww(ax, ay, z); }
    if (by === ay + 1) { return W.wn(bx, by, z); }
    return W.wn(ax, ay, z);
  }
  Path.edgeBetween = function (ax, ay, bx, by) {
    if (bx === ax + 1) { return { x: bx, y: by, side: 1 }; }
    if (bx === ax - 1) { return { x: ax, y: ay, side: 1 }; }
    if (by === ay + 1) { return { x: bx, y: by, side: 0 }; }
    if (by === ay - 1) { return { x: ax, y: ay, side: 0 }; }
    return null;
  };

  CP.Path = Path;
})(window.CP = window.CP || {});
