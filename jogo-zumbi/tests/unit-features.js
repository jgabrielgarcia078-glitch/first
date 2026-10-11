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

/* ================= RODADA 2: zumbis e personagem ================= */
function mkZ(x, y, seed) { const zd = CP.Zombies.makeData(new U.Rng(seed || 11), x, y, 0); zd.crawler = false; zd.fakeDead = false; zd.speed = 'shambler'; const z = CP.Zombies.fromData(zd); z.speedType = 'shambler'; G.zombies.push(z); return z; }
clearZombies(); p.x = open.x; p.y = open.y; p.dead = false; G.over = false;
/* ---------- cair e levantar devagar ---------- */
let zg = mkZ(p.x + 6, p.y, 21);
zg.state = 'down'; zg.downT = 0.5; zg.target = null;
tick(0.6);
ok(zg.state === 'getup', 'depois de cair, o zumbi passa por "levantando" (' + zg.state + ')');
ok(CP.Zombies.isDown(zg), 'levantando ainda conta como caído (dá para pisar)');
const gx = zg.x, gy = zg.y;
tick(zg.getDur + 0.2);
ok(zg.state !== 'getup' && zg.state !== 'down', 'termina de levantar (' + zg.state + ')');
ok(Math.abs(zg.x - gx) < 0.01 && Math.abs(zg.y - gy) < 0.01 || zg.state !== 'idle', 'não anda enquanto levanta');
clearZombies();
/* ---------- comendo um corpo ---------- */
const chp = W.chunkAt(Math.floor(p.x), Math.floor(p.y));
const corpse = { x: p.x + 8, y: p.y, z: 0, ang: 0, look: CP.Zombies.fromData(CP.Zombies.makeData(new U.Rng(2), 0, 0, 0)).look, items: [], t: G.state.time - 7200 };
corpse.look.zombie = false;
chp.corpses.push(corpse);
let ze = mkZ(p.x + 9, p.y + 0.5, 22);
CP.Zombies.startEat(ze, corpse);
p.sneaking = false;
CP.Zombies.noise(p.x, p.y, 0, 6, 'step');
ok(ze.state === 'eat', 'comendo: não liga para passos longe (barulho 6 a ~9 tiles)');
const dsave = CP.Zombies.toData(ze), zback = CP.Zombies.fromData(JSON.parse(JSON.stringify(dsave)));
ok(zback.state === 'eat' && zback.eat && Math.abs(zback.eat.x - corpse.x) < 1e-6, 'estado "comendo" sobrevive ao salvar/carregar');
CP.Zombies.noise(ze.x - 1, ze.y, 0, 8, 'glass');
ok(ze.state === 'investigate', 'barulho bem perto tira o zumbi da refeição (' + ze.state + ')');
clearZombies();
// zumbi parado perto de um corpo humano vai comer sozinho
let zi = mkZ(corpse.x + 4, corpse.y + 1, 23);
zi.state = 'idle'; zi.idleT = 0.01;
const pSave = { x: p.x, y: p.y }; p.x = corpse.x - 26; p.y = corpse.y; // longe da vista
const old = Math.random; let calls = 0; Math.random = () => { calls++; return 0.2; };
tick(0.1);
Math.random = old;
for (let i = 0; i < 30 * 12 && zi.state !== 'eat'; i++) tick(1 / 30);
ok(zi.state === 'eat', 'zumbi ocioso perto de um corpo vai até ele e começa a comer (' + zi.state + ')');
// jogador passando perto (visível) interrompe
p.x = zi.x - 2.5; p.y = zi.y; p.ang = 0; zi.ang = Math.PI;
if (zi.state !== 'eat') { CP.Zombies.startEat(zi, corpse); zi.ang = Math.PI; }
for (let i = 0; i < 30 && zi.state === 'eat'; i++) tick(1 / 30);
ok(zi.state === 'chase', 'jogador chegando perto e à vista: para de comer e persegue (' + zi.state + ')');
clearZombies(); chp.corpses.splice(chp.corpses.indexOf(corpse), 1);
p.x = open.x; p.y = open.y;
// geração: grupos comendo corpos nas ruas
let eaters = 0;
for (const ch of W.allChunks()) eaters += ch.zombies.filter(d => d.state === 'eat').length;
ok(eaters > 3, 'mundo gerado tem zumbis comendo corpos nas ruas (' + eaters + ')');

/* ---------- derrubado pela horda ---------- */
p.body.health = 100; p.dead = false; G.over = false;
for (let i = 0; i < 4; i++) { const z = mkZ(p.x + Math.cos(i * 1.6) * 0.7, p.y + Math.sin(i * 1.6) * 0.7, 30 + i); z.state = 'chase'; }
CP.Zombies.rebuildHash();
CP.Body.dragDown(p);
ok(p.dragged && !p.dead, 'derrubado: ainda vivo, se debatendo');
ok(G.zombies.filter(z => z.state === 'eat').length >= 3, 'zumbis em volta começam a comer');
const hx = p.x;
tick(1);
ok(!p.dead && Math.abs(p.x - hx) < 1e-6, 'não consegue se mexer');
tick(2);
ok(p.dead && /arrastado/.test(p.deathCause), 'morre devorado depois de ~2,6 s: "' + p.deathCause + '"');
clearZombies();

/* ---------- sangue, sujeira e lavar ---------- */
G.newGame({ seed: 4242, settings: { popMult: 1 }, character: { name: 'Teste2', occupation: 'unemployed', traits: [] } });
const q = G.player; clearZombies();
const top = q.worn.jacket || q.worn.shirt;
ok(!!top && !!q.worn.pants, 'tem roupa de cima e calça');
const rnd0 = Math.random; Math.random = () => 0.995;
CP.Body.zombieWound(q, 'thighL', 'laceration', null);
Math.random = rnd0;
ok((q.worn.pants.blood || 0) >= 0.15 && q.anim.struggle > 0, 'corte na coxa suja a calça de sangue (' + (q.worn.pants.blood || 0) + ') e o personagem se debate');
q.body.parts.thighL.wounds.length = 0; q.body.infection = null;
CP.Body.addDirt(q, 0.5);
ok(top.dirt >= 0.5 && q.worn.pants.dirt >= 0.5, 'sujeira nas duas peças');
const look = CP.Player.lookFor(q);
ok(look.stain && look.stain.dt >= 0.5 && look.stain.dl >= 0.5, 'a aparência mostra as manchas (stain)');
top.blood = 0.9;
ok(CP.Body.grime(q) > 0.8, 'roupa imunda (' + CP.Body.grime(q).toFixed(2) + ')');
const un0 = q.body.stats.unhappy;
for (let i = 0; i < 20; i++) CP.Body.update(q, 1 / 30, 3600 * 0.25);
ok(q.body.stats.unhappy > un0, 'roupa imunda deixa infeliz aos poucos (' + un0.toFixed(3) + ' → ' + q.body.stats.unhappy.toFixed(3) + ')');
ok(CP.Actions.dirtyClothes(q).length >= 2, 'lista de roupas sujas para lavar');
// pia com água ligada
let sink = null;
for (const ch of W.allChunks()) { const L = ch.levels[0]; for (let i = 0; i < 1024 && !sink; i++) if (L.obj[i] === O.SINK) sink = { x: ch.cx * 32 + (i % 32), y: ch.cy * 32 + ((i / 32) | 0) }; if (sink) break; }
ok(!!sink, 'achou uma pia');
q.x = sink.x + 0.5; q.y = sink.y + 0.5 + 1; q.z = 0;
let opts = CP.Actions.contextOptions(q, sink.x + 0.5, sink.y + 0.5);
const washC = opts.find(o => /^Lavar roupas/.test(o.label));
ok(washC && !washC.disabled && /sem sabão/.test(washC.label), 'pia oferece "Lavar roupas (sem sabão)": ' + (washC && washC.label));
washC.fn(); tick(15);
ok(top.dirt > 0 && top.dirt < 0.25 && top.blood < 0.35, 'sem sabão a roupa fica só um pouco melhor (sujeira ' + top.dirt.toFixed(2) + ', sangue ' + top.blood.toFixed(2) + ')');
CP.Items.Inv.give(q, CP.Items.make('soap'));
opts = CP.Actions.contextOptions(q, sink.x + 0.5, sink.y + 0.5);
const washS = opts.find(o => /^Lavar roupas/.test(o.label));
ok(washS && /com sabão/.test(washS.label), 'com sabão no inventário: ' + (washS && washS.label));
washS.fn(); tick(15);
ok(!top.dirt && !top.blood && !q.worn.pants.dirt, 'com sabão sai tudo');
const soapIt = CP.Items.Inv.findId(q, 'soap');
ok(soapIt && soapIt.item.uses === 5, 'sabão gastou 1 uso (' + (soapIt && soapIt.item.uses) + ')');
q.bloodSpots = [[0, 0.5, 2]];
opts = CP.Actions.contextOptions(q, sink.x + 0.5, sink.y + 0.5);
const self = opts.find(o => o.label === 'Lavar-se');
ok(self && !self.disabled, 'pode se lavar quando tem sangue no corpo');
self.fn(); tick(8);
ok(q.bloodSpots.length === 0, 'lavou o sangue do corpo');
/* ================= RODADA 3: mecânicas ================= */
const Inv = CP.Items.Inv;
/* ---------- remendar ---------- */
const sh = q.worn.jacket || q.worn.shirt; sh.holes = 2; sh.cond = 0.5;
Inv.give(q, CP.Items.make('needle')); Inv.give(q, CP.Items.make('thread')); Inv.give(q, CP.Items.make('rag'));
let io = CP.Use.itemOptions(q, sh, 'player');
const rem = io.find(o => /^Remendar/.test(o.label));
ok(rem && !rem.disabled, 'roupa rasgada tem "Remendar" com agulha, linha e pano');
rem.fn(); tick(8);
ok(sh.holes === 1 && sh.cond > 0.6, 'remendou: 1 buraco a menos e mais proteção (' + sh.holes + ', ' + sh.cond.toFixed(2) + ')');
ok(!Inv.findId(q, 'rag') && Inv.findTag(q, 'thread').item.uses === 7, 'gastou o pano e 1 uso da linha');
ok(/rasgada/.test(CP.Items.name(sh)), 'nome mostra que ainda está rasgada: ' + CP.Items.name(sh));

/* ---------- fogo que se espalha numa casa ---------- */
let house = null;
for (const ch of W.allChunks()) { for (const b of ch.buildings) { if (b.kind === 'house' && b.floors === 1 && !b.story && b.w >= 8 && b.h >= 8 && ch.active) { house = b; break; } } if (house) break; }
if (!house) for (const ch of W.allChunks()) { for (const b of ch.buildings) { if (b.kind === 'house' && b.floors === 1 && !b.story) { house = b; break; } } if (house) break; }
ok(!!house, 'achou uma casa térrea');
const hx0 = house.x + Math.floor(house.w / 2), hy0 = house.y + Math.floor(house.h / 2);
q.x = house.x - 16; q.y = house.y - 16; q.z = 0; q.dead = false; q.body.health = 100;
G.state.world.weather = { type: 'clear', until: CP.Time.hours() + 500 };
G.state.world.fires = []; CP.Fire.ignite(hx0, hy0, 0, true, 30);
ok(CP.Fire.burningAt(hx0, hy0, 0), 'o fogo pegou no meio da casa');
let maxFires = 0;
for (let i = 0; i < 40; i++) { clearZombies(); tick(1); maxFires = Math.max(maxFires, G.state.world.fires.length); }
ok(maxFires >= 6, 'o fogo se espalhou pela casa (' + maxFires + ' tiles queimando ao mesmo tempo)');
for (let i = 0; i < 400 && G.state.world.fires.length; i++) { clearZombies(); q.body.stats.hunger = 0.1; q.body.stats.thirst = 0.1; tick(1); }
ok(G.state.world.fires.length === 0, 'o incêndio acabou sozinho');
ok(!q.dead, 'o jogador longe do fogo continua vivo ' + (q.deathCause || ''));
let outsideBurnt = 0;
for (let y = house.y - 8; y < house.y + house.h + 8; y++) for (let x = house.x - 8; x < house.x + house.w + 8; x++) { if (!W.isIndoor(x, y, 0) && W.floor(x, y, 0) === F.BURNT) outsideBurnt++; }
ok(outsideBurnt < 60, 'o fogo não vira um incêndio sem fim pela grama (' + outsideBurnt + ' tiles queimados fora)');
let burnt = 0, charred = 0, rubble = 0;
for (let y = house.y; y < house.y + house.h; y++) for (let x = house.x; x < house.x + house.w; x++) { if (W.floor(x, y, 0) === F.BURNT) burnt++; if (W.obj(x, y, 0) === O.RUBBLE) rubble++; }
for (let y = house.y; y <= house.y + house.h; y++) for (let x = house.x; x <= house.x + house.w; x++) { const l = W.lvl(x, y, 0), i = W.idx(x, y); if (l.wns[i] === C.FIRE.BURNT_STYLE || l.wws[i] === C.FIRE.BURNT_STYLE) charred++; }
ok(burnt >= house.w * house.h * 0.4, 'chão carbonizado (' + burnt + '/' + house.w * house.h + ')');
ok(charred > 4, 'paredes pretas (' + charred + ')');
// apagar
G.state.world.fires = [];
const ox = q.x, oy = q.y;
CP.Fire.ignite(Math.floor(ox) + 1, Math.floor(oy), 0, true, 60);
Inv.give(q, CP.Items.make('extinguisher'));
let fo = CP.Actions.contextOptions(q, Math.floor(ox) + 1.5, Math.floor(oy) + 0.5);
const ap = fo.find(o => /extintor/.test(o.label));
ok(ap && !ap.disabled, 'opção de apagar com o extintor');
ap.fn(); tick(2);
ok(!CP.Fire.burningAt(Math.floor(ox) + 1, Math.floor(oy), 0), 'apagou o fogo');
ok(CP.Fire.flammability(Math.floor(ox) + 1, Math.floor(oy), 0) === 0, 'molhado não pega fogo de novo logo');

/* ---------- corpos: queimar, enterrar, cheiro ---------- */
const op2 = findOpen(q.x, q.y, 2);
q.x = op2.x; q.y = op2.y;
const chq = W.chunkAt(Math.floor(q.x), Math.floor(q.y));
function mkCorpse(x, y, age) { const lk = CP.Zombies.fromData(CP.Zombies.makeData(new U.Rng(9), 0, 0, 0)).look; const c = { x: x, y: y, z: 0, ang: 0, look: lk, items: [CP.Items.make('wallet')], t: G.state.time - age }; chq.corpses.push(c); return c; }
const cb = mkCorpse(Math.floor(q.x) + 1.5, Math.floor(q.y) + 0.5, 3600);
const gas = CP.Items.make('gas_can'); gas.fuel = 5; Inv.give(q, gas); Inv.give(q, CP.Items.make('lighter'));
fo = CP.Actions.contextOptions(q, cb.x, cb.y);
const qb = fo.find(o => /^Queimar corpo/.test(o.label));
ok(qb && !qb.disabled, 'corpo: opção "Queimar" com gasolina e isqueiro');
qb.fn(); tick(4);
ok(cb.burnt && CP.Fire.burningAt(Math.floor(cb.x), Math.floor(cb.y), 0) && gas.fuel === 4, 'o corpo pega fogo e gasta 1 L');
G.state.world.fires = []; for (const k in chq.fires) delete chq.fires[k];
q.x = op2.x; q.y = op2.y;
const tile = findOpen(q.x + 3, q.y, 0) || { x: q.x + 3, y: q.y };
const ft = W.floor(Math.floor(tile.x), Math.floor(tile.y), 0);
const cg = mkCorpse(Math.floor(tile.x) + 0.5, Math.floor(tile.y) + 0.5, 3600);
q.x = cg.x - 1; q.y = cg.y;
Inv.give(q, CP.Items.make('shovel'));
fo = CP.Actions.contextOptions(q, cg.x, cg.y);
const en = fo.find(o => /^Enterrar/.test(o.label));
const soft = [F.GRASS, F.DARKGRASS, F.DIRT, F.SAND, F.FARM, F.FIELD, F.FURROW, F.BURNT].indexOf(ft) >= 0;
ok(en && en.disabled === !soft, 'opção "Enterrar" com pá (piso ' + ft + ', ' + (soft ? 'macio' : 'duro') + ')');
if (soft) {
  en.fn(); tick(14);
  ok(chq.corpses.indexOf(cg) < 0 && W.obj(Math.floor(cg.x), Math.floor(cg.y), 0) === O.GRAVE, 'enterrou: corpo some e fica uma cova');
  ok((W.floorItems(Math.floor(cg.x), Math.floor(cg.y), 0) || []).some(it => it.id === 'wallet'), 'os itens do corpo ficam no chão');
}
// cheiro
q.body.stats.sick = 0; q.smellWarned = false;
for (let i = 0; i < 6; i++) mkCorpse(q.x + (i % 3) - 1, q.y + 2 + (i >> 1) * 0.3, 86400 * 2);
for (let i = 0; i < 3; i++) { q._smellT = 0; CP.Body.update(q, 1 / 30, 3600 * 0.5); }
ok(q.body.stats.sick > 0.02 && CP.Fire.smellCount >= 6, 'muitos corpos apodrecendo perto deixam enjoado (sick ' + q.body.stats.sick.toFixed(3) + ', ' + CP.Fire.smellCount + ' corpos)');
chq.corpses.length = 0;

/* ---------- grandes hordas ---------- */
clearZombies();
const wsw = G.state.world; wsw.horde = null; wsw.nextHorde = 0;
CP.Horde.update(1 / 30, 1);
const hd = wsw.horde;
ok(hd && hd.n >= 40 && U.dist(hd.x, hd.y, q.x, q.y) > 70, 'uma horda começa longe (' + (hd && hd.n) + ' zumbis a ' + (hd && U.dist(hd.x, hd.y, q.x, q.y).toFixed(0)) + ' tiles)');
ok(wsw.nextHorde > G.state.time / 86400 + 3, 'a próxima fica para daqui a alguns dias');
const d0 = U.dist(hd.x, hd.y, hd.tx, hd.ty);
for (let i = 0; i < 60; i++) CP.Horde.update(1, G.gameSecondsPerReal());
ok(U.dist(hd.x, hd.y, hd.tx, hd.ty) < d0 - 25, 'o grupo anda em direção ao outro lado');
const zBefore = G.zombies.length;
hd.x = q.x + 20; hd.y = q.y + 5;
CP.Horde.update(1 / 30, 1);
ok(!wsw.horde && G.zombies.length - zBefore >= hd.n * 0.6, 'perto do jogador vira zumbis de verdade (' + (G.zombies.length - zBefore) + ')');
ok(G.zombies.slice(zBefore).every(z => z.state === 'wander' && z.target), 'todos andando juntos para o destino');
clearZombies();
wsw.horde = null; wsw.nextHorde = 0; CP.Horde.update(1 / 30, 1);
const h2 = wsw.horde; h2.x = h2.tx; h2.y = h2.ty;
let before = 0; for (const ch of W.allChunks()) before += ch.zombies.length;
CP.Horde.update(1 / 30, 1);
let after = 0; for (const ch of W.allChunks()) after += ch.zombies.length;
ok(!wsw.horde && after > before, 'passou longe: espalhou ' + (after - before) + ' zumbis nos quarteirões do destino');
clearZombies();

/* ---------- mecânica de carros por peça ---------- */
G.activateChunks(true);
let car = null;
for (let r = 0; r < 4 && !car; r++) { for (const c of CP.Vehicles.active) { car = c; break; } if (!car) { q.x += 32; G.activateChunks(true); } }
ok(!!car, 'achou um carro');
if (car) {
  const V = CP.Vehicles, pt = V.parts(car);
  ok(V.PARTS.every(k => k in pt), 'carro tem motor, bateria, 4 pneus e para-brisa');
  q.x = car.x + 1.6; q.y = car.y; q.z = 0; q.vehicle = null;
  Inv.give(q, CP.Items.make('wrench'));
  pt.tireFL = 0.8;
  let rows = V.partActions(q, car);
  const tr = rows.find(r => r.part === 'tireFL');
  ok(tr.acts[0].id === 'remove' && tr.acts[0].ok, 'pode remover o pneu com chave de roda');
  V.partAction(q, car, 'tireFL', 'remove'); tick(8);
  ok(pt.tireFL === null && Inv.findId(q, 'car_tire'), 'pneu removido vira item no inventário');
  ok(V.flatTires(car) >= 1, 'sem pneu conta como furado');
  V.partAction(q, car, 'tireFL', 'install'); tick(8);
  ok(Math.abs(pt.tireFL - 0.8) < 1e-6 && !Inv.findId(q, 'car_tire'), 'pneu reinstalado com o mesmo estado');
  pt.battery = 0.05; car.keyIn = true; car.fuel = 10; car.broken = false; pt.engine = 0.9;
  q.vehicle = car; CP.Vehicles.toggleEngine(q); tick(3);
  ok(!car.engine, 'bateria descarregada: o carro não liga');
  pt.battery = 0.9;
  for (let k = 0; k < 6 && !car.engine; k++) { CP.Vehicles.toggleEngine(q); tick(3); }
  ok(car.engine, 'com bateria boa e motor bom, liga');
  car.engine = false; q.vehicle = null;
}
console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nOK melhorias');
process.exit(fails ? 1 : 0);
