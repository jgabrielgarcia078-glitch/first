'use strict';
const { load } = require('./harness');
const files = ['js/config.js', 'js/util.js', 'js/world.js', 'js/worldgen.js'];
const g = load(files);
const CP = g.CP, W = CP.W, C = CP.C;
let fails = 0;
function check(cond, msg) { if (!cond) { fails++; if (fails < 40) console.log('FALHA:', msg); } }

const seeds = process.argv[2] ? [Number(process.argv[2])] : [1, 12345, 987654];
for (const seed of seeds) {
  const t0 = Date.now();
  W.init(seed);
  const m = W.macro;
  check(m.towns.length >= C.TOWN_COUNT_MIN, 'cidades suficientes ' + m.towns.length);
  // gera todos os chunks
  for (let cy = 0; cy < C.WORLD_CHUNKS; cy++) for (let cx = 0; cx < C.WORLD_CHUNKS; cx++) W.ensureChunk(cx, cy);
  const genMs = Date.now() - t0;
  // determinismo: regenerar um chunk dá o mesmo resultado
  const c1 = CP.Gen.genChunk(m.towns[0].x, m.towns[0].y, seed, m);
  const c2 = W.chunkByIndex(m.towns[0].x, m.towns[0].y);
  check(Buffer.from(c1.levels[0].floor).equals(Buffer.from(c2.levels[0].floor)) && Buffer.from(c1.levels[0].wn).equals(Buffer.from(c2.levels[0].wn)), 'determinismo do chunk');
  let nb = 0, nRooms = 0, nStairs = 0, nUnreach = 0, n2 = 0;
  for (const ch of W.allChunks()) {
    ch.buildings.forEach((b, bi) => {
      nb++;
      if (b.floors > 1) n2++;
      if (!b.door) { check(false, 'prédio sem porta ' + b.kind + ' @' + b.x + ',' + b.y); return; }
      // ponto fora da porta
      const d = b.door;
      let sx, sy;
      const inside = W.isIndoor(d.x, d.y, 0);
      if (d.side === 0) { sx = d.x; sy = inside ? d.y - 1 : d.y; } else { sx = inside ? d.x - 1 : d.x; sy = d.y; }
      // BFS
      const seen = new Set(); const q = [[sx, sy, 0]]; seen.add(sx + ',' + sy + ',0');
      let steps = 0;
      while (q.length && steps < 20000) {
        steps++;
        const [x, y, z] = q.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nz = W.stepLevel(x, y, z, dx, dy, { doorsPassable: true });
          if (nz < 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < b.x - 3 || ny < b.y - 3 || nx > b.x + b.w + 3 || ny > b.y + b.h + 3) continue;
          const k = nx + ',' + ny + ',' + nz;
          if (seen.has(k)) continue;
          seen.add(k); q.push([nx, ny, nz]);
        }
      }
      // todos os tiles de salas do prédio (piso caminhável e sem móvel sólido) devem ter sido alcançados
      for (let z = 0; z < b.floors; z++) {
        for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
          if (!W.isIndoor(x, y, z)) continue;
          nRooms++;
          const st = W.stairAt(x, y);
          if (z === 1 && st) continue;
          if (!W.tileWalkable(x, y, z) && !st) continue;
          if (!seen.has(x + ',' + y + ',' + z)) { nUnreach++; if (nUnreach < 8) console.log('inalcançável', b.kind, 'andar', z, x, y, 'prédio', b.x, b.y, b.w, b.h); }
        }
      }
    });
    // escadas consistentes
    for (let i = 0; i < C.CHUNK * C.CHUNK; i++) {
      if (ch.levels[0].obj[i] === C.OBJ.STAIRS) {
        nStairs++;
        const x = ch.cx * C.CHUNK + (i % C.CHUNK), y = ch.cy * C.CHUNK + Math.floor(i / C.CHUNK);
        const st = W.stairAt(x, y);
        check(st && W.floor(x, st.top - 1, 1) !== 0, 'patamar da escada tem piso ' + x + ',' + y);
        check(W.floor(x, y, 1) === 0, 'buraco da escada no andar 1 ' + x + ',' + y);
      }
    }
  }
  let zs = 0; W.allChunks().forEach(c => zs += c.zombies.length);
  check(nUnreach === 0, 'tiles inalcançáveis: ' + nUnreach);
  console.log(`semente ${seed}: ${W.generatedCount} chunks em ${genMs}ms, ${m.towns.length} cidades (${m.towns.map(t => t.name).join(', ')}), ${nb} prédios (${n2} sobrados), ${nRooms} tiles internos, ${nStairs / 3} escadas, ${zs} zumbis`);
}
console.log(fails ? `\n${fails} FALHA(S)` : '\nOK worldgen');
process.exit(fails ? 1 : 0);
