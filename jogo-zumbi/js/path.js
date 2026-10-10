/* A* em grade 8-direções com níveis (escadas), portas como passáveis com custo (zumbis batem nelas). */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W;
  var SQ2 = Math.SQRT2;
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  var Path = { stats: { runs: 0, nodes: 0 } };

  function key(x, y, z) { return (x * 4096 + y) * 4 + z; }

  /* opts: { maxNodes, doorsPassable, fencesPassable, doorCost } */
  Path.find = function (sx, sy, sz, tx, ty, tz, opts) {
    opts = opts || {};
    var maxNodes = opts.maxNodes || C.ZOMBIE.PATH_MAX_NODES;
    var doorCost = opts.doorCost || 8;
    Path.stats.runs++;
    if (sx === tx && sy === ty && sz === tz) { return []; }
    var open = new U.Heap();
    var g = new Map(), from = new Map();
    var sk = key(sx, sy, sz), tk = key(tx, ty, tz);
    g.set(sk, 0);
    open.push(sk, 0);
    var nodes = 0;
    var best = sk, bestH = Infinity;
    var stepOpts = { doorsPassable: !!opts.doorsPassable, fencesPassable: !!opts.fencesPassable };
    while (open.size() && nodes < maxNodes) {
      var cur = open.pop();
      if (cur === tk) { break; }
      nodes++;
      var cz = cur & 3, rest = (cur - cz) / 4, cy = rest % 4096, cx = (rest - cy) / 4096;
      var gc = g.get(cur);
      var hcur = Math.abs(cx - tx) + Math.abs(cy - ty) + Math.abs(cz - tz) * 4;
      if (hcur < bestH) { bestH = hcur; best = cur; }
      for (var d = 0; d < 8; d++) {
        var dx = DIRS[d][0], dy = DIRS[d][1];
        var diag = dx !== 0 && dy !== 0;
        var nz = W.stepLevel(cx, cy, cz, dx, dy, diag ? null : stepOpts);
        if (nz < 0) { continue; }
        var nx = cx + dx, ny = cy + dy;
        var cost = diag ? SQ2 : 1;
        if (!diag && nz === cz && W.blockedBetween(cx, cy, nx, ny, cz, false)) {
          var et = edgeTypeBetween(cx, cy, nx, ny, cz);
          cost += et === C.EDGE.FENCE ? 2.5 : doorCost;
        }
        var nk = key(nx, ny, nz);
        var ng = gc + cost;
        var og = g.get(nk);
        if (og !== undefined && og <= ng) { continue; }
        g.set(nk, ng);
        from.set(nk, cur);
        var h = Math.max(Math.abs(nx - tx), Math.abs(ny - ty)) + Math.abs(nz - tz) * 3;
        open.push(nk, ng + h * 1.05);
      }
    }
    Path.stats.nodes += nodes;
    var end = from.has(tk) || tk === sk ? tk : (opts.partial ? best : -1);
    if (end < 0 || end === sk) { return null; }
    var out = [];
    var k = end;
    while (k !== sk && k !== undefined) {
      var z = k & 3, r = (k - z) / 4, y = r % 4096, x = (r - y) / 4096;
      out.push({ x: x, y: y, z: z });
      k = from.get(k);
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
