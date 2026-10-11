/* Testes de lógica das melhorias "mais perto do original": mundo vivo (neve, erosão, vento, corvos), quintais/placas,
 * e (nas rodadas seguintes) animações, comer corpos, roupas, fogo, corpos, hordas, carros, interface e bilhetes. */
'use strict';
const { load } = require('./harness');
const g = load();
const CP = g.CP, W = CP.W, C = CP.C, G = CP.Game, U = CP.U, O = C.OBJ, F = C.FLOOR;
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('FALHA:', m); } else { console.log('ok  -', m); } }
function tick(sec, timeMult) { const n = Math.round(sec * C.TICK_RATE); for (let i = 0; i < n && !G.over; i++) G.tick(1 / C.TICK_RATE, timeMult || 1); }
function clearZombies() { G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0; }
function findOpen(cx, cy, r) {
  for (let d = 0; d < 60; d++) for (let a = 0; a < 16; a++) {
    const x = Math.floor(cx + Math.cos(a / 16 * 6.283) * d), y = Math.floor(cy + Math.sin(a / 16 * 6.283) * d);
    let good = true;
    for (let yy = y - r; yy <= y + r && good; yy++) for (let xx = x - r; xx <= x + r && good; xx++) {
      if (!W.tileWalkable(xx, yy, 0) || W.isIndoor(xx, yy, 0) || W.wn(xx, yy, 0) || W.ww(xx, yy, 0) || W.obj(xx, yy, 0)) good = false;
    }
    if (good) return { x: x + 0.5, y: y + 0.5 };
  }
  return null;
}

G.newGame({ seed: 4242, settings: { popMult: 1 }, character: { name: 'Teste', occupation: 'unemployed', traits: [] } });
const p = G.player;
clearZombies();
const open = findOpen(p.x, p.y, 3);
ok(!!open, 'achou área aberta');
p.x = open.x; p.y = open.y; p.z = 0;
const A = CP.Amb;

/* ---------- erosão ---------- */
const w = G.state.world;
const e0 = A.erosion();
ok(Math.abs(e0 - C.EROSION.BASE) < 1e-6, 'erosão começa no mínimo (' + e0 + ')');
const t0 = G.state.time;
G.state.time = t0 + 86400 * 50;
const e50 = A.erosion();
G.state.time = t0 + 86400 * 400;
const e400 = A.erosion();
G.state.time = t0;
ok(e50 > e0 && e50 < 1 && e400 === 1, 'erosão cresce com os dias e satura em 1 (' + e50.toFixed(2) + ', ' + e400 + ')');
ok(CP.Render.erosionAt(F.GRASS, 10, 10, 0) === -1, 'sem erosão, nenhum mato');
let grassOv = 0, asphaltOv = 0;
for (let i = 0; i < 400; i++) { if (CP.Render.erosionAt(F.GRASS, i, i * 3, 1) >= 0) grassOv++; if (CP.Render.erosionAt(F.ASPHALT, i, i * 7, 1) >= 0) asphaltOv++; }
ok(grassOv > 300 && asphaltOv > 80 && asphaltOv < 260, 'com erosão total: gramado quase todo alto (' + grassOv + '/400), asfalto com mato nas rachaduras (' + asphaltOv + '/400)');
ok(CP.Render.erosionAt(F.WOOD, 1, 1, 1) === -1, 'piso de dentro de casa não cria mato');

/* ---------- neve: acumula nevando, derrete no calor ---------- */
w.snow = 0;
w.weather = { type: 'snow', until: CP.Time.hours() + 100 };
const tempF = CP.Time.temperature;
CP.Time.temperature = () => -5;
A.update(1 / 30, 3600 * 5);
ok(w.snow > 0.4 && w.snow < 0.5, 'neve acumula ~0,09/h nevando (' + w.snow.toFixed(2) + ' em 5 h)');
A.update(1 / 30, 3600 * 20);
ok(w.snow === 1, 'neve satura em 1');
w.weather = { type: 'clear', until: CP.Time.hours() + 100 };
A.update(1 / 30, 3600 * 10);
ok(w.snow === 1, 'abaixo de zero não derrete');
CP.Time.temperature = () => 8;
A.update(1 / 30, 3600 * 5);
const melted = w.snow;
ok(melted < 0.75 && melted > 0, 'derrete no calor (' + melted.toFixed(2) + ' depois de 5 h a 8 °C)');
CP.Time.temperature = tempF;

/* ---------- pegadas ---------- */
w.snow = 1;
A.prints.length = 0;
p._pr = null;
for (let i = 0; i < 40; i++) { p.x += 0.1; A.update(1 / 30, 1); }
ok(A.prints.length >= 5 && A.prints.length <= 9, 'pegadas a cada ~0,55 tile ao andar na neve (' + A.prints.length + ')');
ok(A.prints.every(pr => pr.k === 'foot'), 'pegadas de pé');
w.snow = 0; A.update(1 / 30, 1);
ok(A.prints.length === 0, 'neve derretida apaga as pegadas');
p.x = open.x;

/* ---------- vento ---------- */
w.weather = { type: 'storm', until: CP.Time.hours() + 100 };
const ws = A.wind();
w.weather = { type: 'fog', until: CP.Time.hours() + 100 };
const wf = A.wind();
ok(ws > 0.7 && wf < 0.1, 'vento forte na tempestade (' + ws.toFixed(2) + '), quase nada na neblina (' + wf.toFixed(2) + ')');
w.weather = { type: 'clear', until: CP.Time.hours() + 100 };

/* ---------- corvos ---------- */
A.flocks.length = 0; A.flying.length = 0;
const fl = A.spawnFlockAt(p.x + 10, p.y, 5);
A.update(1 / 30, 1);
ok(A.flocks.length === 1, 'bando longe do jogador fica no chão');
CP.Zombies.noise(p.x + 9, p.y, 0, 20, 'test');
ok(A.flocks.length === 0 && A.flying.length === 5, 'barulho perto espanta os 5 corvos');
A.spawnFlockAt(p.x + 2, p.y, 4);
A.update(1 / 30, 1);
ok(A.flying.length === 9, 'jogador chegando perto espanta o bando');
const zd = CP.Zombies.makeData(new U.Rng(3), p.x + 14, p.y + 0.5, 0); zd.crawler = false; zd.fakeDead = false;
const zb = CP.Zombies.fromData(zd); zb.state = 'idle'; zb.idleT = 999; G.zombies.push(zb);
A.spawnFlockAt(p.x + 15, p.y + 0.5, 3);
tick(0.1);
ok(A.flying.length === 12, 'zumbi passando perto também espanta (revela que tem algo vindo)');
clearZombies();
for (let i = 0; i < 30 * 16; i++) A.update(1 / 30, 1);
ok(A.flying.length === 0, 'pássaros voando somem depois de um tempo');

/* ---------- geração: quintais, varandas, placas, outdoor, vitrines ---------- */
const counts = {};
let deck = 0, brokenStore = 0;
for (let cy = 4; cy < 44; cy++) for (let cx = 4; cx < 44; cx++) {
  const ch = W.ensureChunk(cx, cy); if (!ch) continue;
  const L = ch.levels[0];
  for (let i = 0; i < 1024; i++) { const o = L.obj[i]; if (o >= O.STREET_SIGN) counts[o] = (counts[o] || 0) + 1; if (L.floor[i] === F.DECK) deck++; }
  for (const k in ch.edges) { const st = ch.edges[k]; if (st && st.broken && st.glass === false) brokenStore++; }
}
const name = id => Object.keys(O).find(k => O[k] === +id);
ok(counts[O.STREET_SIGN] > 10 && counts[O.GRILL] > 5 && counts[O.CLOTHESLINE] > 5 && counts[O.SWING] > 2 && counts[O.FLOWERBED] > 10, 'objetos novos espalhados: ' + Object.keys(counts).map(k => name(k) + ' ' + counts[k]).join(', '));
ok(counts[O.BILLBOARD] > 2, 'outdoors na beira das rodovias (' + (counts[O.BILLBOARD] || 0) + ')');
ok(deck > 30, 'varandas de madeira (' + deck + ' tiles)');
ok(brokenStore > 5, 'vitrines quebradas (' + brokenStore + ')');
let signs = 0, shops = 0;
for (const ch of W.allChunks()) for (const b of ch.buildings) { if (b.kind !== 'house' && b.kind !== 'barn') { shops++; if (CP.Render.signText(b)) signs++; } }
ok(shops > 0 && signs === shops, 'toda loja tem nome no letreiro (' + signs + '/' + shops + ')');

console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nOK melhorias');
process.exit(fails ? 1 : 0);
