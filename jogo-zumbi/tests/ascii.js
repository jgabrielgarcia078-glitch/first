'use strict';
/* Desenha um retângulo do mundo em ASCII (para depurar). Uso: node tests/ascii.js seed x y w h z */
const { load } = require('./harness');
const g = load(['js/config.js', 'js/util.js', 'js/world.js', 'js/worldgen.js']);
const CP = g.CP, W = CP.W, C = CP.C;
const [seed, x0, y0, w, h, z] = process.argv.slice(2).map(Number);
W.init(seed);
W.ensureAround(x0 + (w >> 1), y0 + (h >> 1), 1);
const E = C.EDGE;
const objCh = { 0: '.', 21: 'S' };
function edgeChar(t, side) {
  if (!t) return side === 0 ? '  ' : ' ';
  const m = { 1: side ? '|' : '--', 2: side ? 'D' : 'DD', 3: side ? 'W' : 'WW', 4: side ? ':' : '..', 5: side ? '#' : '##', 6: side ? "'" : "''", 7: 'G' };
  return m[t] || '?';
}
let out = '';
for (let y = y0; y < y0 + h; y++) {
  let top = '', mid = '';
  for (let x = x0; x < x0 + w; x++) {
    top += '+' + edgeChar(W.wn(x, y, z), 0);
    const o = W.obj(x, y, z);
    let c = o ? (o === 21 ? 'S' : (C.OBJ_INFO[o].solid ? '#' : 'o')) : (W.isIndoor(x, y, z) ? String.fromCharCode(96 + (W.roomId(x, y, z) % 26)) : (C.FLOOR_WALKABLE[W.floor(x, y, z)] ? ' ' : '~'));
    if (W.floor(x, y, z) === 0) c = 'x';
    mid += edgeChar(W.ww(x, y, z), 1) + c + c;
  }
  out += top + '\n' + mid + '\n';
}
console.log(out);
