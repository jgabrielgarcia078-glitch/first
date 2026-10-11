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
  return firstOpen; // perto daqui não tem: volta para a primeira área aberta achada
}
let firstOpen = null;

G.newGame({ seed: 4242, settings: { popMult: 1 }, character: { name: 'Teste', occupation: 'unemployed', traits: [] } });
const p = G.player;
clearZombies();
const open = findOpen(p.x, p.y, 3);
firstOpen = open;
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
ok(outsideBurnt < 120, 'o fogo não vira um incêndio sem fim pela grama (' + outsideBurnt + ' tiles queimados fora)');
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
{ const rnd = Math.random; Math.random = () => 0.99; ap.fn(); tick(2); Math.random = rnd; } // sem o fogo pular para o tile do jogador no meio da ação
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
for (let k = 0; k < 8 && !W.tileWalkable(Math.floor(wsw.horde.tx), Math.floor(wsw.horde.ty), 0); k++) { wsw.horde = null; wsw.nextHorde = 0; CP.Horde.update(1 / 30, 1); } // destino em terra firme
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

/* ---------- R5: bilhetes, recados nas portas, pichações e acampamentos ---------- */
{
  const N = CP.Notes, rng = new U.Rng(5);
  let bad = 0;
  for (let i = 0; i < 300; i++) { const t = N.gen(rng); if (!t || /[{}]/.test(t) || /undefined/.test(t)) bad++; }
  ok(bad === 0, 'textos de bilhete gerados sem marcadores sobrando');
  N.KINDS.forEach(k => ok(N.gen(new U.Rng(1), k, 'Westwood').length > 20, 'bilhete do tipo ' + k));
  const it = CP.Items.make('note', null, new U.Rng(3));
  ok(typeof it.text === 'string' && it.text.length > 10, 'item Bilhete nasce com texto');
  ok(/não lido/.test(CP.Items.name(it)), 'nome do bilhete marca não lido');
  it.seen = true; ok(/“/.test(CP.Items.name(it)), 'depois de lido mostra a 1ª linha no nome');
  // varre chunks: histórias com recado na porta, acampamentos com barraca e bilhete
  let goodbye = 0, notesOnDoors = 0, survivorNotes = 0, camps = 0, campNotes = 0, notesLoot = 0;
  for (let cy = 0; cy < C.WORLD_CHUNKS; cy++) for (let cx = 0; cx < C.WORLD_CHUNKS; cx++) {
    const ch = W.ensureChunk(cx, cy);
    ch.buildings.forEach(b => { if (b.story === 'goodbye') goodbye++; });
    for (const k in ch.edges) { const st = ch.edges[k]; if (st && st.note) { notesOnDoors++; } }
    ch.buildings.forEach(b => { if (b.story === 'survivor') for (const k in ch.containers) if (ch.containers[k].items.some(i => i.id === 'note')) survivorNotes++; });
    for (let i = 0; i < C.CHUNK * C.CHUNK; i++) if (ch.levels[0].obj[i] === O.TENT) camps++;
    for (const k in ch.items) if (ch.items[k].some(i => i.id === 'note')) campNotes++;
    for (const k in ch.containers) if (ch.containers[k].items.some(i => i.id === 'note')) notesLoot++;
    if (cy > 30) break;
  }
  ok(goodbye > 0 && notesOnDoors >= goodbye, 'casas de quem foi embora com recado na porta (' + goodbye + ' casas, ' + notesOnDoors + ' recados)');
  ok(camps > 0 && campNotes > 0, 'acampamentos abandonados com bilhete no chão (' + camps + ' barracas, ' + campNotes + ' bilhetes)');
  ok(notesLoot > 0, 'bilhetes em recipientes gerados (' + notesLoot + ')');
  // determinismo: o mesmo chunk gera o mesmo recado
  let det = null;
  for (let cy = 0; cy < 20 && !det; cy++) for (let cx = 0; cx < C.WORLD_CHUNKS && !det; cx++) {
    const ch = W.ensureChunk(cx, cy);
    for (const k in ch.edges) if (ch.edges[k] && ch.edges[k].note) { det = { cx, cy, k, t: ch.edges[k].note }; break; }
  }
  if (det) {
    const ch2 = CP.Gen.genChunk(det.cx, det.cy, G.state.seed, W.macro);
    ok(ch2.edges[det.k] && ch2.edges[det.k].note === det.t, 'recado na porta é determinístico pela semente');
  }
  // pegar o bilhete da porta pelo menu de contexto
  if (det) {
    const ch = W.chunkByIndex(det.cx, det.cy), key = +det.k, side = key % 2, kk = (key - side) / 2;
    const ix = kk % (C.CHUNK * C.CHUNK), lx = ix & (C.CHUNK - 1), ly = ix >> Math.log2(C.CHUNK);
    const ex = det.cx * C.CHUNK + lx, ey = det.cy * C.CHUNK + ly;
    const q = G.player; q.x = ex + 0.5 + (side === 1 ? -0.6 : 0); q.y = ey + 0.5 + (side === 0 ? -0.6 : 0); q.z = 0;
    if (W.isIndoor(Math.floor(q.x), Math.floor(q.y), 0)) { q.x = ex + 0.5; q.y = ey + 0.5; }
    G.activateChunks(true); clearZombies();
    const opts = CP.Actions.contextOptions(q, ex + 0.5 - (side === 1 ? 0.45 : 0), ey + 0.5 - (side === 0 ? 0.45 : 0));
    const take = opts.find(o => /Pegar o bilhete/.test(o.label)), read = opts.find(o => /Ler o bilhete/.test(o.label));
    ok(!!take && !!read, 'porta com recado oferece ler e pegar');
    if (take) { take.fn(); ok(!ch.edges[det.k].note && CP.Items.Inv.findId(q, 'note'), 'pegar o recado vira item Bilhete'); }
  }
  // fogueira apagada não esquenta nem ilumina; acender exige fósforo + tábua
  const q = G.player, fx = Math.floor(q.x) + 1, fy = Math.floor(q.y);
  const L = W.lvl(fx, fy, 0), ii = W.idx(fx, fy);
  L.obj[ii] = O.CAMPFIRE; L.odir[ii] = 4;
  ok(!CP.Use.nearHeat(q), 'fogueira apagada não serve para cozinhar');
  let o2 = CP.Actions.contextOptions(q, fx + 0.5, fy + 0.5).find(o => /Acender fogueira/.test(o.label));
  ok(o2 && o2.disabled, 'acender sem fósforo fica desabilitado');
  CP.Items.Inv.give(q, CP.Items.make('matches')); CP.Items.Inv.give(q, CP.Items.make('plank'));
  o2 = CP.Actions.contextOptions(q, fx + 0.5, fy + 0.5).find(o => /Acender fogueira/.test(o.label));
  ok(o2 && !o2.disabled, 'com fósforo e tábua dá para acender');
  if (o2) { o2.fn(); tick(6); }
  ok(!(L.odir[ii] & 4) && CP.Use.nearHeat(q), 'fogueira acesa esquenta');
  L.obj[ii] = 0; L.odir[ii] = 0;
}

/* ---------- S1: cortinas, interruptor, janelas acesas, luz que atrai zumbis ---------- */
{
  const E = C.EDGE, q = G.player;
  // acha uma janela de casa com cortina, com o lado de dentro andável
  let win = null;
  for (const k in G.activeChunks) {
    const ch = G.activeChunks[k];
    for (const key in ch.edges) {
      const st = ch.edges[key]; if (!st || !st.hasCurt || st.broken) continue;
      const kk = +key, side = kk % 2, ix = ((kk - side) / 2) % (C.CHUNK * C.CHUNK), z = Math.floor(((kk - side) / 2) / (C.CHUNK * C.CHUNK));
      if (z !== 0) continue;
      const ex = ch.cx * C.CHUNK + (ix & (C.CHUNK - 1)), ey = ch.cy * C.CHUNK + (ix >> Math.log2(C.CHUNK));
      if (W.edgeType(ex, ey, 0, side) !== E.WINDOW) continue;
      const inX = W.isIndoor(ex, ey, 0) ? ex : (side === 1 ? ex - 1 : ex), inY = W.isIndoor(ex, ey, 0) ? ey : (side === 0 ? ey - 1 : ey);
      if (!W.isIndoor(inX, inY, 0) || !W.tileWalkable(inX, inY, 0) || W.obj(inX, inY, 0)) continue;
      win = { ex, ey, side, st, inX, inY }; break;
    }
    if (win) break;
  }
  let curtCount = 0;
  for (const k in G.activeChunks) for (const key in G.activeChunks[k].edges) { const st = G.activeChunks[k].edges[key]; if (st && st.hasCurt) curtCount++; }
  ok(curtCount > 0, 'janelas de casa nascem com cortina (' + curtCount + ')');
  ok(W.edgeBlocksSight(E.WINDOW, { curtain: true }) && !W.edgeBlocksSight(E.WINDOW, { hasCurt: true, curtain: false }), 'cortina fechada bloqueia a visão, aberta não');
  if (win) {
    q.x = win.inX + 0.5; q.y = win.inY + 0.5; q.z = 0; q.vehicle = null; clearZombies();
    const mx = win.side === 0 ? win.ex + 0.5 : win.ex + 0.08, my = win.side === 0 ? win.ey + 0.08 : win.ey + 0.5;
    const before = win.st.curtain;
    let o = CP.Actions.contextOptions(q, mx, my).find(x => /cortina/.test(x.label));
    ok(!!o, 'de dentro dá para ' + (o ? o.label.toLowerCase() : 'mexer na cortina'));
    if (o) { o.fn(); ok(win.st.curtain === !before, 'cortina mudou de estado'); }
    // interruptor
    G.state.world.powerOffDay = 999;
    const rm = W.room(win.inX, win.inY, 0); rm.lit = false;
    o = CP.Actions.contextOptions(q, q.x, q.y).find(x => /Acender a luz/.test(x.label));
    ok(o && !o.disabled, 'interruptor: acender a luz com energia');
    if (o) { o.fn(); ok(rm.lit, 'luz do cômodo acesa'); }
    o = CP.Actions.contextOptions(q, q.x, q.y).find(x => /Apagar a luz/.test(x.label));
    ok(!!o, 'interruptor: apagar a luz');
    // janela acesa à noite joga luz para fora
    const t0 = G.state.time; G.state.time = Math.ceil(t0 / 86400) * 86400 + (23 - C.START_HOUR) * 3600;
    G.state.world.weather = { type: 'clear', until: CP.Time.hours() + 50 };
    win.st.curtain = false; win.st.bar = 0;
    const srcs = CP.Time.lightSources(q);
    ok(CP.Time.isNight() && srcs.some(sr => sr.r === 2.6), 'janela de cômodo aceso ilumina o lado de fora à noite');
    win.st.curtain = true;
    ok(!CP.Time.lightSources(q).some(sr => sr.r === 2.6 && Math.abs(sr.x - (win.side === 0 ? win.ex + 0.5 : win.ex + 0.5)) < 1.2 && Math.abs(sr.y - win.ey - 0.5) < 1.6), 'cortina fechada esconde a luz');
    G.state.time = t0;
  }
  // luz atrai zumbis à noite (lanterna em área aberta)
  const open2 = findOpen(q.x + 40, q.y, 2) || findOpen(q.x, q.y, 2);
  q.x = open2.x; q.y = open2.y; q.z = 0; G.activateChunks(true); clearZombies();
  const t1 = G.state.time; G.state.time = Math.ceil(t1 / 86400) * 86400 + (23 - C.START_HOUR) * 3600;
  G.state.world.weather = { type: 'clear', until: CP.Time.hours() + 50 };
  const zs = [];
  const toMeEarly = z => (z.state === 'investigate' || z.state === 'chase') && z.target && U.dist(z.target.x, z.target.y, q.x, q.y) < 4;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * 6.283, zx = q.x + Math.cos(a) * 15, zy = q.y + Math.sin(a) * 15;
    if (!W.tileWalkable(Math.floor(zx), Math.floor(zy), 0)) continue;
    const zd = CP.Zombies.makeData(new U.Rng(1000 + i), zx, zy, 0); zd.crawler = false; zd.fakeDead = false;
    const zb = CP.Zombies.fromData(zd); zb.state = 'idle'; zb.idleT = 999; zb.ang = a + Math.PI; G.zombies.push(zb); zs.push(zb);
  }
  q.flashlightOn = false; G.updateFov(true); tick(4);
  zs.forEach(z => { if (!toMeEarly(z)) { z.state = 'idle'; z.target = null; } });
  const toMe = z => (z.state === 'investigate' || z.state === 'chase') && z.target && U.dist(z.target.x, z.target.y, q.x, q.y) < 4;
  ok(!zs.some(toMe), 'sem luz, zumbis longe não reparam no jogador à noite (' + zs.map(z => z.state + (z.target ? '@' + (z.target.x - q.x).toFixed(0) + ',' + (z.target.y - q.y).toFixed(0) : '')).join(' ') + ' luz ' + CP.Vis.lightAt(Math.floor(q.x), Math.floor(q.y), 0).toFixed(2) + ')');
  CP.Items.Inv.give(q, CP.Items.make('flashlight')); q.flashlightOn = true; tick(9);
  ok(zs.some(toMe), 'lanterna acesa à noite chama zumbis de longe (' + zs.filter(toMe).length + '/' + zs.length + ')');
  q.flashlightOn = false; clearZombies(); G.state.time = t1;
}

/* ---------- S2: poças, sangue na parede, rastro, decomposição ---------- */
{
  const q = G.player, w = G.state.world;
  w.groundWet = 0;
  w.weather = { type: 'rain', until: CP.Time.hours() + 50 };
  for (let i = 0; i < 60; i++) A.update(0.5, 120);
  const wetRain = w.groundWet;
  ok(wetRain > 0.3, 'chuva molha o chão (' + wetRain.toFixed(2) + ')');
  w.weather = { type: 'clear', until: CP.Time.hours() + 50 };
  for (let i = 0; i < 60; i++) A.update(0.5, 120);
  ok(w.groundWet < wetRain, 'sem chuva o chão seca (' + w.groundWet.toFixed(2) + ')');
  w.groundWet = 0;
  // sangue na parede: zumbi encostado numa parede leva um golpe na direção dela
  let spot = null;
  for (const k in G.activeChunks) {
    const ch = G.activeChunks[k];
    for (let i = 0; i < C.CHUNK * C.CHUNK && !spot; i++) {
      const x = ch.cx * C.CHUNK + (i & (C.CHUNK - 1)), y = ch.cy * C.CHUNK + (i >> Math.log2(C.CHUNK));
      if (W.wn(x, y, 0) === C.EDGE.WALL && W.tileWalkable(x, y, 0) && !W.obj(x, y, 0)) spot = { x, y };
    }
    if (spot) break;
  }
  ok(!!spot, 'achou tile encostado numa parede');
  if (spot) {
    const okW = CP.FX.wallBlood(spot.x + 0.5, spot.y + 0.3, 0, -Math.PI / 2);
    const ch = W.chunkAt(spot.x, spot.y), k = W.edgeKey(spot.x, spot.y, 0, 0);
    ok(okW && ch.wallBlood && ch.wallBlood[k] && ch.wallBlood[k].n === 1, 'golpe perto da parede respinga sangue nela');
    CP.FX.wallBlood(spot.x + 0.5, spot.y + 0.3, 0, -Math.PI / 2); CP.FX.wallBlood(spot.x + 0.5, spot.y + 0.3, 0, -Math.PI / 2); CP.FX.wallBlood(spot.x + 0.5, spot.y + 0.3, 0, -Math.PI / 2);
    ok(ch.wallBlood[k].n === 3, 'respingos acumulam até 3');
    ok(!!CP.Save.serializeChunk(ch).wallBlood[k], 'sangue na parede vai para o save');
    ok(!CP.FX.wallBlood(spot.x + 0.5, spot.y + 0.5, 0, Math.PI / 2) || W.wn(spot.x, spot.y + 1, 0), 'sem parede na direção do golpe, não respinga');
  }
  // rastejante deixa rastro
  const open3 = findOpen(q.x, q.y, 3); q.x = open3.x; q.y = open3.y; clearZombies();
  const chq = W.chunkAt(Math.floor(q.x), Math.floor(q.y)); const d0 = (chq.decals || []).length;
  const zd = CP.Zombies.makeData(new U.Rng(77), q.x + 6, q.y, 0); zd.crawler = true; zd.fakeDead = false;
  const cz = CP.Zombies.fromData(zd); cz.state = 'chase'; cz.target = { x: q.x, y: q.y, z: 0 }; cz.memT = 99; G.zombies.push(cz);
  for (let i = 0; i < 30 * 12; i++) { G.tick(1 / 30, 1); q.body.health = 100; if (U.dist(cz.x, cz.y, q.x, q.y) < 1.5) break; }
  const d1 = Object.values(G.activeChunks).reduce((a, ch) => a + (ch.decals || []).length, 0);
  ok(d1 > d0, 'zumbi rastejando deixa rastro de sangue');
  clearZombies();
  // decomposição: idade do corpo calculada pelo tempo
  const cch = W.chunkAt(Math.floor(q.x), Math.floor(q.y));
  const lk = CP.Zombies.fromData(CP.Zombies.makeData(new U.Rng(5), q.x, q.y, 0)).look;
  const corpse = { x: q.x + 1, y: q.y, z: 0, ang: 0, look: lk, items: [CP.Items.make('bandage')], t: G.state.time - 86400 * 16 };
  cch.corpses.push(corpse);
  const list = []; CP.Zombies.pushCorpses(list, 0);
  ok(corpse.age > 15 && corpse.age < 17, 'idade do corpo em dias (' + (corpse.age || 0).toFixed(1) + ')');
  cch.corpses.splice(cch.corpses.indexOf(corpse), 1);
}

/* ---------- S3: modelos de carro, buzina, sirene, rádio, roupa molhada, respiração ---------- */
{
  const V = CP.Vehicles, q = G.player;
  const counts = {};
  let nCars = 0;
  for (let cy = 4; cy < 40 && nCars < 160; cy += 2) for (let cx = 4; cx < 40 && nCars < 160; cx += 2) {
    const ch = W.ensureChunk(cx, cy); if (ch.active) continue;
    V.activateChunk(ch);
    (ch.cars || []).forEach(c => { counts[V.modelOf(c)] = (counts[V.modelOf(c)] || 0) + 1; nCars++; });
    V.deactivateChunk(ch);
  }
  ok(nCars > 30 && Object.keys(counts).length >= 4, 'vários modelos de carro (' + JSON.stringify(counts) + ')');
  ok(V.modelName({ model: 'police' }) === 'Viatura' && V.modelName({}) === 'Sedã', 'nome do modelo (carro antigo sem modelo vira sedã)');
  // buzina chama zumbis
  G.activateChunks(true); clearZombies();
  const open4 = findOpen(q.x, q.y, 3); q.x = open4.x; q.y = open4.y;
  const car = { id: 'teste', x: q.x, y: q.y, z: 0, ang: 0, color: 1, model: 'police', speed: 0, steer: 0, fuel: 10, cond: 1, keyIn: true, engine: false, broken: false, trunk: [], hornT: 0 };
  V.active.push(car); V.parts(car).battery = 1;
  q.vehicle = car;
  const zd = CP.Zombies.makeData(new U.Rng(91), q.x + 24, q.y, 0); zd.crawler = false; zd.fakeDead = false;
  const zh = CP.Zombies.fromData(zd); zh.state = 'idle'; zh.idleT = 999; G.zombies.push(zh);
  V.horn(q); tick(0.5);
  ok(zh.state === 'investigate' && zh.target && U.dist(zh.target.x, zh.target.y, car.x, car.y) < 5, 'buzina chama zumbi a 24 tiles');
  // sirene só em viatura/ambulância
  ok(V.toggleSiren(q) && car.siren, 'viatura liga a sirene');
  const zd2 = CP.Zombies.makeData(new U.Rng(92), q.x - 40, q.y, 0); zd2.crawler = false; zd2.fakeDead = false;
  const zs2 = CP.Zombies.fromData(zd2); zs2.state = 'idle'; zs2.idleT = 999; G.zombies.push(zs2);
  tick(2);
  ok(zs2.state === 'investigate' || zs2.state === 'chase', 'sirene chama zumbi a 40 tiles');
  const b0 = V.parts(car).battery; tick(5);
  ok(V.parts(car).battery < b0, 'sirene com motor desligado gasta a bateria');
  V.toggleSiren(q);
  car.model = 'sedan'; ok(!V.toggleSiren(q), 'sedã não tem sirene');
  // rádio
  V.toggleRadio(q); ok(car.radio, 'rádio do carro liga');
  const bd0 = q.body.stats.boredom = 0.5; tick(9);
  ok(q.body.stats.boredom < bd0, 'ouvir o rádio diminui o tédio');
  V.toggleRadio(q);
  q.vehicle = null; V.active.splice(V.active.indexOf(car), 1); clearZombies();
  // roupa molhada fica mais escura
  q.body.stats.wet = 0; const dry = CP.Player.lookFor(q);
  q.body.stats.wet = 0.9; const wetL = CP.Player.lookFor(q);
  ok(wetL.wet > 0 && (wetL.pants !== dry.pants || wetL.shirt !== dry.shirt), 'molhado: roupa mais escura');
  q.body.stats.wet = 0;
  // respiração no frio
  const tempF = CP.Time.temperature; CP.Time.temperature = () => -6;
  let sawBreath = false; G.effects.length = 0;
  for (let i = 0; i < 12; i++) { tick(0.3); if (G.effects.some(e => e.type === 'breath')) sawBreath = true; }
  ok(sawBreath, 'no frio a respiração solta vapor');
  CP.Time.temperature = () => 22; G.effects.length = 0; sawBreath = false;
  for (let i = 0; i < 12; i++) { tick(0.3); if (G.effects.some(e => e.type === 'breath')) sawBreath = true; }
  ok(!sawBreath, 'no calor não');
  CP.Time.temperature = tempF;
}

/* ---------- S4: matar por trás, corda de lençol, arrastar corpo ---------- */
{
  const q = G.player, K = CP.Combat;
  G.activateChunks(true); clearZombies();
  const op = findOpen(q.x, q.y, 3); q.x = op.x; q.y = op.y; q.z = 0; q.vehicle = null;
  const knife = CP.Items.make('knife'); Inv.give(q, knife); CP.Use.equip(q, knife, 'hand1');
  q.sneaking = true; q.ang = 0; q.anim.attack = 0; q.attackCd = 0; q.stealth = null;
  const mk = (ang, dx) => { const zd = CP.Zombies.makeData(new U.Rng(300 + dx * 10), q.x + dx, q.y, 0); zd.crawler = false; zd.fakeDead = false; const z = CP.Zombies.fromData(zd); z.state = 'idle'; z.idleT = 999; z.ang = ang; z.seesPlayer = false; G.zombies.push(z); return z; };
  const back = mk(0, 0.75);   // de costas para o jogador (olhando para +x)
  CP.Zombies.rebuildHash();
  ok(K.stealthTarget(q, K.weaponOf(q)) === back, 'zumbi de costas, agachado e com faca: dá para matar por trás');
  const kills0 = q.kills;
  CP.Input.mouse.left = true; q.uiClickGuard = false; tick(0.1); CP.Input.mouse.left = false;
  ok(!!q.stealth && back.state === 'held', 'segurou o zumbi');
  tick(1.6);
  ok(back.state === 'dead' && q.kills === kills0 + 1 && !q.stealth, 'matou em silêncio');
  clearZombies();
  const front = mk(Math.PI, 0.75); // olhando para o jogador
  CP.Zombies.rebuildHash();
  ok(!K.stealthTarget(q, K.weaponOf(q)), 'de frente não dá');
  front.ang = 0; q.sneaking = false;
  ok(!K.stealthTarget(q, K.weaponOf(q)), 'de pé (sem agachar) não dá');
  clearZombies(); q.sneaking = false; CP.Use.unequip(q, knife);
  // arrastar corpo
  const ch = W.chunkAt(Math.floor(q.x), Math.floor(q.y));
  ch.corpses = ch.corpses.filter(c => !(Math.abs(c.x - q.x) < 2 && Math.abs(c.y - q.y) < 2));
  const lk = CP.Zombies.fromData(CP.Zombies.makeData(new U.Rng(8), q.x, q.y, 0)).look;
  const corpse = { x: q.x + 0.6, y: q.y + 0.2, z: 0, ang: 0, look: lk, items: [], t: G.state.time };
  ch.corpses.push(corpse);
  const og = CP.Actions.contextOptions(q, corpse.x, corpse.y).find(o => /Arrastar o corpo/.test(o.label));
  ok(!!og, 'opção de arrastar o corpo');
  og.fn();
  ok(q.dragging === corpse && ch.corpses.indexOf(corpse) < 0, 'corpo saiu do chão e está sendo arrastado');
  const sx0 = q.x;
  for (let i = 0; i < 40; i++) { q.x += 0.05; q.ang = 0; tick(1 / 30); }
  ok(U.dist(corpse.x, corpse.y, q.x, q.y) < 1.6 && corpse.x < q.x, 'corpo vem atrás do jogador (' + (q.x - sx0).toFixed(1) + ' tiles)');
  const walk = () => { const x0 = q.x, y0 = q.y; CP.Input.down.KeyD = true; tick(1); CP.Input.down.KeyD = false; return U.dist(x0, y0, q.x, q.y); };
  const dDrag = walk(); const dc = q.dragging; q.dragging = null; const dFree = walk(); q.dragging = dc;
  ok(dDrag < dFree * 0.75, 'arrastando anda mais devagar (' + dDrag.toFixed(2) + ' vs ' + dFree.toFixed(2) + ')');
  const od = CP.Actions.contextOptions(q, q.x, q.y).find(o => /Soltar o corpo/.test(o.label));
  ok(!!od && od.key === 'E', 'soltar o corpo (tecla E)');
  od.fn();
  const ch2 = W.chunkAt(Math.floor(corpse.x), Math.floor(corpse.y));
  ok(!q.dragging && ch2.corpses.indexOf(corpse) >= 0, 'corpo largado no novo lugar');
  ch2.corpses.splice(ch2.corpses.indexOf(corpse), 1);
  // corda de lençol: acha uma janela no 1º andar com chão andável do lado de fora
  let rw = null;
  for (let cy = 0; cy < C.WORLD_CHUNKS && !rw; cy++) for (let cx = 0; cx < C.WORLD_CHUNKS && !rw; cx++) {
    const c2 = W.chunkByIndex(cx, cy); if (!c2) continue;
    for (const key in c2.edges) {
      const kk = +key, side = kk % 2, rest = (kk - side) / 2, z = Math.floor(rest / (C.CHUNK * C.CHUNK)), ix = rest % (C.CHUNK * C.CHUNK);
      if (z !== 1) continue;
      const ex = cx * C.CHUNK + (ix & (C.CHUNK - 1)), ey = cy * C.CHUNK + (ix >> Math.log2(C.CHUNK));
      if (W.edgeType(ex, ey, 1, side) !== C.EDGE.WINDOW) continue;
      const inA = W.isIndoor(ex, ey, 1), ins = inA ? { x: ex, y: ey } : (side === 0 ? { x: ex, y: ey - 1 } : { x: ex - 1, y: ey }), outs = inA ? (side === 0 ? { x: ex, y: ey - 1 } : { x: ex - 1, y: ey }) : { x: ex, y: ey };
      if (!W.isIndoor(ins.x, ins.y, 1) || !W.tileWalkable(ins.x, ins.y, 1) || W.obj(ins.x, ins.y, 1) || !W.tileWalkable(outs.x, outs.y, 0) || W.isIndoor(outs.x, outs.y, 0)) continue;
      rw = { ex, ey, side, ins, outs, st: c2.edges[key] }; break;
    }
  }
  ok(!!rw, 'achou janela de sobrado');
  if (rw) {
    q.x = rw.ins.x + 0.5; q.y = rw.ins.y + 0.5; q.z = 1; G.activateChunks(true); clearZombies();
    rw.st.open = true; rw.st.broken = false; rw.st.rope = false; rw.st.bar = 0;
    Inv.give(q, CP.Items.make('sheet_rope'));
    const mx = rw.side === 0 ? rw.ex + 0.5 : rw.ex + 0.06, my = rw.side === 0 ? rw.ey + 0.06 : rw.ey + 0.5;
    let o = CP.Actions.contextOptions(q, mx, my).find(x => /Pendurar corda/.test(x.label));
    ok(!!o, 'janela aberta do andar de cima: pendurar corda de lençol');
    o.fn(); tick(4);
    ok(rw.st.rope && !Inv.findId(q, 'sheet_rope'), 'corda pendurada (usa o item)');
    o = CP.Actions.contextOptions(q, mx, my).find(x => /Descer pela corda/.test(x.label));
    ok(!!o, 'opção de descer pela corda');
    o.fn(); tick(5); clearZombies();
    ok(W.levelOf(q.z) === 0 && Math.floor(q.x) === rw.outs.x && Math.floor(q.y) === rw.outs.y, 'desceu até o chão do lado de fora');
    const up = CP.Actions.contextOptions(q, mx, my).find(x => /Subir pela corda/.test(x.label));
    ok(!!up, 'do chão: subir pela corda');
    const rnd = Math.random; Math.random = () => 0.01; q.body.stats.endurance = 1;
    up.fn(); tick(6); Math.random = rnd; clearZombies();
    ok(W.levelOf(q.z) === 1 && Math.floor(q.x) === rw.ins.x && Math.floor(q.y) === rw.ins.y, 'subiu de volta pela janela');
    q.z = 0; q.x = op.x; q.y = op.y; G.activateChunks(true); clearZombies();
  }
}

/* ---------- S5: armadilhas, modo de busca, exercícios, pratos ---------- */
{
  const q = G.player, Sv = CP.Surv;
  G.activateChunks(true); clearZombies();
  const op = findOpen(q.x, q.y, 3); q.x = op.x; q.y = op.y; q.z = 0; q.ang = 0;
  // armadilha de caixa: receita, armar, isca, pegar bicho longe do jogador
  ['plank', 'plank', 'hammer'].forEach(id => Inv.give(q, CP.Items.make(id)));
  Inv.give(q, CP.Items.make('nails', { n: 5 }));
  const rec = CP.D.RECIPE.trap_box; ok(CP.Use.recipeStatus(q, rec).ok, 'dá para fazer armadilha de caixa');
  CP.Use.craft(q, rec); tick(10);
  const trapIt = Inv.findId(q, 'trap_box'); ok(!!trapIt, 'fez a armadilha');
  // acha um tile de grama/terra perto
  let tx = null;
  for (let r = 1; r < 30 && !tx; r++) for (let a = 0; a < 16 && !tx; a++) { const x = Math.floor(q.x + Math.cos(a / 16 * 6.28) * r), y = Math.floor(q.y + Math.sin(a / 16 * 6.28) * r); const f = W.floor(x, y, 0); if ((f === F.GRASS || f === F.DIRT || f === F.DARKGRASS) && !W.obj(x, y, 0) && W.tileWalkable(x, y, 0) && !W.isIndoor(x, y, 0)) tx = { x, y }; }
  q.x = tx.x + 0.5; q.y = tx.y + 0.5; q.ang = 0;
  const pl = CP.Use.itemOptions(q, trapIt.item, 'player').find(o => /Armar armadilha/.test(o.label));
  ok(!!pl, 'opção de armar a armadilha');
  pl.fn(); tick(6);
  let trapPos = null;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = tx.x + dx, y = tx.y + dy; if (W.obj(x, y, 0) === O.TRAP_BOX) trapPos = { x, y }; }
  ok(!!trapPos && !Inv.findId(q, 'trap_box'), 'armadilha no chão');
  const tr = Sv.trapAt(trapPos.x, trapPos.y, 0);
  Inv.give(q, CP.Items.make('worm'));
  let to = CP.Actions.contextOptions(q, trapPos.x + 0.5, trapPos.y + 0.5).find(o => /Pôr isca/.test(o.label));
  ok(to && !to.disabled, 'pôr isca (minhoca)'); to.fn();
  ok(tr.bait === 'worm', 'isca colocada');
  const ch = W.chunkAt(trapPos.x, trapPos.y);
  ok(Sv.trapChance(ch, tr, q) > Sv.trapChance(ch, { kind: 'box' }, q), 'isca aumenta a chance');
  q.x += 30; for (let h = 0; h < 200 && !tr.catch; h++) Sv.hourly(); q.x -= 30;
  ok(!!tr.catch && /dead_/.test(tr.catch), 'pegou um bicho (' + tr.catch + ')');
  q.x = trapPos.x - 0.5; q.y = trapPos.y + 0.5;
  to = CP.Actions.contextOptions(q, trapPos.x + 0.5, trapPos.y + 0.5).find(o => /^Pegar o /.test(o.label));
  ok(!!to, 'opção de pegar o bicho'); const caught = tr.catch; to.fn();
  ok(Inv.findId(q, caught) && !tr.catch, 'bicho foi para o inventário');
  ok(!!CP.D.ITEMS[caught].food.cookable, 'carne de caça precisa cozinhar');
  to = CP.Actions.contextOptions(q, trapPos.x + 0.5, trapPos.y + 0.5).find(o => /Desarmar/.test(o.label)); to.fn(); tick(4);
  ok(!W.obj(trapPos.x, trapPos.y, 0) && Inv.findId(q, 'trap_box'), 'recolheu a armadilha');
  // modo de busca
  q.x = tx.x + 0.5; q.y = tx.y + 0.5; G.updateFov(true);
  const sp0 = CP.Player.speed(q); Sv.toggleSearch(q); const sp1 = CP.Player.speed(q);
  ok(q.searching && sp1 < sp0, 'modo de busca anda mais devagar');
  const before = Sv.marks.length; q.skills.foraging = 10;
  for (let i = 0; i < 40; i++) { const t0 = G.state.time; Sv.searchStep(q); }
  ok(Sv.marks.length > before, 'achou coisas no chão em volta (' + (Sv.marks.length - before) + ')');
  const mk0 = Sv.marks[Sv.marks.length - 1]; const fl = W.floorItems(Math.floor(mk0.x), Math.floor(mk0.y), 0);
  ok(fl && fl.some(i => i.id === mk0.id), 'o achado fica no chão marcado');
  Sv.toggleSearch(q); q.skills.foraging = 0;
  // exercícios
  q.body.stats.endurance = 1; q.body.strain = null;
  const xp0 = q.xp.strength || 0;
  let ex = CP.Actions.contextOptions(q, q.x, q.y).find(o => /Flexões/.test(o.label));
  ok(ex && !ex.disabled, 'opção de fazer flexões'); ex.fn(); tick(C.EXERCISE.TIME + 1);
  ok((q.xp.strength || 0) > xp0 && q.body.strain.arms > 0, 'flexões dão XP de força e deixam o braço dolorido');
  ok(CP.Body.pain(q) > 0, 'músculo dolorido dói');
  q.body.strain.arms = 0.9;
  ex = CP.Actions.contextOptions(q, q.x, q.y).find(o => /Flexões/.test(o.label));
  ok(ex && ex.disabled, 'dolorido demais para repetir');
  const st0 = q.body.strain.arms; G.state.time += 0; for (let i = 0; i < 20; i++) Sv.update(0.5, 3600); ok(q.body.strain.arms < st0, 'dor muscular passa com o tempo');
  q.body.strain = null;
  // ensopado
  ['pot_water', 'carrot', 'potato', 'chicken'].forEach(id => Inv.give(q, CP.Items.make(id, { age: 0 })));
  const addStew = id => { const it = Inv.findId(q, id).item; const o = CP.Use.itemOptions(q, it, 'player').find(x => /ensopado/.test(x.label)); o.fn(); tick(3.5); };
  addStew('carrot'); addStew('potato'); addStew('chicken');
  const raw = Inv.findId(q, 'stew_raw');
  ok(raw && raw.item.ingr.length === 3 && !Inv.findId(q, 'pot_water'), 'ensopado cru com 3 ingredientes');
  ok(/cenoura/.test(CP.Items.name(raw.item)), 'nome mostra os ingredientes (' + CP.Items.name(raw.item) + ')');
  const L = W.lvl(Math.floor(q.x) + 1, Math.floor(q.y), 0), ii = W.idx(Math.floor(q.x) + 1, Math.floor(q.y)); const o0 = L.obj[ii];
  L.obj[ii] = O.CAMPFIRE; L.odir[ii] = 0;
  const ck = CP.Use.itemOptions(q, raw.item, 'player').find(x => /Cozinhar/.test(x.label)); ck.fn(); tick(12);
  const stew = Inv.findId(q, 'stew');
  ok(stew && stew.item.dish && stew.item.dish.cal > 650, 'ensopado cozido soma as calorias (' + (stew ? Math.round(stew.item.dish.cal) : 0) + ' kcal)');
  q.body.stats.hunger = 0.9; const ub = q.body.stats.unhappy = 0.5;
  CP.Use.eat(q, stew.item, 1); tick(6);
  ok(q.body.stats.hunger < 0.6 && q.body.stats.unhappy < ub && Inv.findId(q, 'pot'), 'comer o ensopado mata a fome, anima e devolve a panela');
  L.obj[ii] = o0;
  // sanduíche
  ['bread', 'cheese'].forEach(id => Inv.give(q, CP.Items.make(id, { age: 0 })));
  const sw = CP.Use.itemOptions(q, Inv.findId(q, 'cheese').item, 'player').find(x => /sanduíche/.test(x.label)); sw.fn(); tick(3);
  const sand = Inv.findId(q, 'sandwich');
  ok(sand && sand.item.ingr.length === 2 && !Inv.findId(q, 'bread'), 'sanduíche de pão com queijo');
}

/* ---------- S6: chaves de casa, pertences ao morrer ---------- */
{
  const q = G.player;
  // moradores-zumbi com a chave da casa no bolso
  let withKey = 0, zd0 = null;
  for (let cy = 0; cy < 30; cy++) for (let cx = 0; cx < C.WORLD_CHUNKS; cx++) { const ch = W.ensureChunk(cx, cy); ch.zombies.forEach(z => { if (z.carry && z.carry[0].id === 'house_key') { withKey++; zd0 = zd0 || z; } }); }
  ok(withKey > 10, 'moradores-zumbi com chave de casa (' + withKey + ')');
  const loot = CP.Items.Loot.zombie(zd0, new U.Rng(3));
  ok(loot.some(i => i.id === 'house_key' && i.keyId === zd0.carry[0].keyId), 'matar o morador dá a chave');
  ok(/Chave de casa \(.+, \d+\)/.test(CP.Items.name(loot.find(i => i.id === 'house_key'))), 'chave mostra o endereço (' + CP.Items.name(loot.find(i => i.id === 'house_key')) + ')');
  // porta da frente trancada: destrancar com a chave certa
  let door = null;
  for (const k in G.activeChunks) { const ch = G.activeChunks[k]; for (const b of ch.buildings) { if (b.kind === 'house' && b.door && !door) door = { b, d: b.door }; } }
  const st = W.edgeState(door.d.x, door.d.y, 0, door.d.side) || {}; st.locked = true; st.open = false; st.broken = false; st.bar = 0; st.ext = true; st.spareChecked = false; W.setEdgeState(door.d.x, door.d.y, 0, door.d.side, st);
  const inA = W.isIndoor(door.d.x, door.d.y, 0);
  const outT = inA ? (door.d.side === 0 ? { x: door.d.x, y: door.d.y - 1 } : { x: door.d.x - 1, y: door.d.y }) : { x: door.d.x, y: door.d.y };
  q.x = outT.x + 0.5; q.y = outT.y + 0.5; q.z = 0; clearZombies();
  const mx = door.d.side === 0 ? door.d.x + 0.5 : door.d.x + (inA ? -0.06 : 0.06), my = door.d.side === 0 ? door.d.y + (inA ? -0.06 : 0.06) : door.d.y + 0.5;
  let opts = CP.Actions.contextOptions(q, mx, my);
  ok(!opts.some(o => /chave$/.test(o.label) && /Destrancar/.test(o.label)), 'sem a chave não destranca');
  const spare = opts.find(o => /chave reserva/.test(o.label));
  ok(!!spare, 'pode procurar chave reserva no capacho');
  spare.fn(); tick(4);
  ok(st.spareChecked && !CP.Actions.contextOptions(q, mx, my).some(o => /chave reserva/.test(o.label)), 'só dá para procurar uma vez');
  Inv.give(q, CP.Items.make('house_key', { keyId: CP.Notes.keyId(door.b), keyLabel: CP.Notes.address(door.b) }));
  const un = CP.Actions.contextOptions(q, mx, my).find(o => /Destrancar com a chave/.test(o.label));
  ok(!!un && un.key === 'E', 'com a chave: destrancar (E)');
  un.fn(); tick(2);
  ok(!st.locked, 'porta destrancada');
  const lk = CP.Actions.contextOptions(q, mx, my).find(o => /Trancar com a chave/.test(o.label));
  ok(!!lk, 'trancar de fora com a chave'); lk.fn(); ok(st.locked, 'trancada de novo');
  // pertences ao morrer (sem morrer de verdade: só a lista)
  const bl = CP.Body.belongings(q);
  ok(bl.length >= Inv.all(q).length && bl.some(i => i.id === 'house_key'), 'pertences incluem inventário, mãos e roupas (' + bl.length + ')');
}

/* ---------- T1: golpes por arma, arma nas costas ---------- */
{
  const q = G.player;
  ok(CP.Spr.ATTACK_STYLE.axe === 'overhead' && CP.Spr.ATTACK_STYLE.spear === 'thrust' && !CP.Spr.ATTACK_STYLE.blunt_short, 'cada tipo de arma golpeia de um jeito');
  q.inv = q.inv.filter(i => !CP.D.ITEMS[i.id].weapon);
  ok(!CP.Player.lookFor(q).backWeapon, 'sem arma longa guardada, nada nas costas');
  Inv.give(q, CP.Items.make('axe'));
  ok(CP.Player.lookFor(q).backWeapon === 'axe', 'machado guardado aparece nas costas');
}

/* ---------- T2: corpo que muda, barba/cabelo, curativos e cicatrizes visíveis, mancar ---------- */
{
  const q = G.player, T0 = G.state.time;
  q.female = false; q.look.beard = false; q.look.hairStyle = 'curto'; q.groom = { cut: T0, shave: T0 };
  let lk = CP.Player.lookFor(q);
  ok(lk.hairStyle === 'curto' && !lk.beard && !lk.stubble, 'recém cortado e barbeado');
  G.state.time = T0 + 86400 * 5; lk = CP.Player.lookFor(q);
  ok(lk.stubble > 0 && !lk.beard, 'barba por fazer depois de alguns dias');
  G.state.time = T0 + 86400 * 30; lk = CP.Player.lookFor(q);
  ok(lk.beard && lk.hairStyle === 'longo', 'em um mês: barba cheia e cabelo comprido (' + lk.hairStyle + ')');
  // espelho
  const sx = Math.floor(q.x) + 1, sy = Math.floor(q.y), L = W.lvl(sx, sy, 0), ii = W.idx(sx, sy), o0 = L.obj[ii];
  const indoorF = W.isIndoor; W.isIndoor = () => true;
  L.obj[ii] = O.SINK; Inv.give(q, CP.Items.make('scissors')); Inv.give(q, CP.Items.make('razor'));
  let opts = CP.Actions.contextOptions(q, sx + 0.5, sy + 0.5);
  const cut = opts.find(o => /deixar curto/.test(o.label)), shave = opts.find(o => /Fazer a barba/.test(o.label));
  ok(cut && !cut.disabled && shave && !shave.disabled, 'espelho: cortar o cabelo e fazer a barba');
  cut.fn(); tick(7); shave.fn(); tick(6);
  W.isIndoor = indoorF; L.obj[ii] = o0;
  lk = CP.Player.lookFor(q);
  ok(lk.hairStyle === 'curto' && !lk.beard && !lk.stubble, 'cortado e barbeado de novo');
  G.state.time = T0;
  // peso
  const w0 = q.body.stats.weight; q.body.stats.weight = 105; const fat = CP.Player.lookFor(q).fat; q.body.stats.weight = 58; const thin = CP.Player.lookFor(q).fat; q.body.stats.weight = w0;
  ok(fat > 0 && thin < 0, 'peso muda a silhueta (' + fat + ' / ' + thin + ')');
  // curativo visível, mancar e cicatriz
  CP.Body.addWound(q, 'shinL', 'deep', { bleeding: false });
  ok(CP.Player.lookFor(q) && CP.Body.legInjury(q) > 0, 'ferida na perna');
  q.body.parts.shinL.wounds[0].bandage = { dirty: 0 };
  ok(CP.Player.lookFor(q).bandages && CP.Player.lookFor(q).bandages.shinL, 'curativo aparece na canela');
  CP.Body.addWound(q, 'head', 'laceration', { bleeding: false });
  q.body.parts.head.wounds.forEach(w => { w.sev = 0.001; }); q.body.parts.shinL.wounds.forEach(w => { w.sev = 0.001; w.stitched = true; });
  CP.Body.update(q, 0.1, 3600 * 6);
  ok((q.body.scars || []).indexOf('head') >= 0 && CP.Player.lookFor(q).faceScar, 'corte na cabeça deixa cicatriz no rosto');
}

/* ---------- T3: nevasca, raio, galhos caídos, velas/tochas/lampiões ---------- */
{
  const q = G.player, w = G.state.world, T = CP.Time;
  q.x = firstOpen.x; q.y = firstOpen.y; q.z = 0; G.activateChunks(true); clearZombies();
  w.weather = { type: 'clear', until: T.hours() + 50 };
  ok(T.visionMult() === 1, 'céu limpo: visão normal');
  w.weather = { type: 'blizzard', until: T.hours() + 50 };
  ok(T.weather().blizzard && T.visionMult() < 0.6 && T.temperature(true) < T.temperature(false), 'nevasca: visão curta e muito frio');
  w.snow = 0; for (let i = 0; i < 10; i++) A.update(0.5, 360); const snowB = w.snow;
  w.weather = { type: 'snow', until: T.hours() + 50 }; w.snow = 0; for (let i = 0; i < 10; i++) A.update(0.5, 360);
  ok(snowB > w.snow, 'nevasca acumula neve mais rápido');
  w.weather = { type: 'clear', until: T.hours() + 50 }; w.snow = 0;
  const hit = T.lightningStrike();
  ok(!!hit && CP.Fire.burningAt(hit.x, hit.y, 0), 'raio põe fogo numa árvore');
  G.state.world.fires = []; for (const k in G.activeChunks) G.activeChunks[k].fires = {};
  const nb = T.fallenBranches();
  ok(nb > 0, 'depois da tempestade há galhos caídos (' + nb + ')');
  let br = null; for (const k in G.activeChunks) { const ch = G.activeChunks[k]; for (let i = 0; i < 1024 && !br; i++) if (ch.levels[0].obj[i] === O.BRANCHES) br = { x: ch.cx * 32 + (i & 31), y: ch.cy * 32 + (i >> 5) }; if (br) break; }
  q.x = br.x - 0.5; q.y = br.y + 0.5; G.activateChunks(true); clearZombies();
  const gb = CP.Actions.contextOptions(q, br.x + 0.5, br.y + 0.5).find(o => /Recolher os galhos/.test(o.label));
  ok(!!gb, 'dá para recolher os galhos'); const nbr = Inv.count(q, 'branch'); gb.fn(); tick(4);
  ok(Inv.count(q, 'branch') > nbr && W.obj(br.x, br.y, 0) !== O.BRANCHES, 'galhos viram gravetos');
  // vela acesa ilumina e queima
  const cdl = CP.Items.make('candle'); Inv.give(q, cdl); Inv.give(q, CP.Items.make('matches'));
  const lo = CP.Use.itemOptions(q, cdl, 'player').find(o => o.label === 'Acender');
  ok(lo && !lo.disabled, 'acender a vela com fósforo'); lo.fn();
  ok(cdl.on && T.handFlame(q) === cdl && T.lightSources(q).some(sr => sr.glow === 'fire' && sr.r > 4), 'vela acesa na mão ilumina em volta');
  const b0 = cdl.burn; G.state.world.lastHourTick = -1; T.update(0.01, 1);
  ok(cdl.burn < b0, 'vela vai queimando');
  const torch = CP.D.RECIPE.torch; ok(!!torch, 'receita de tocha existe');
  cdl.on = false; CP.Use.unequip(q, cdl);
}
/* ---------- T4: lugares especiais e animais caçáveis ---------- */
{
  const q = G.player, An = CP.Anim, D = CP.D;
  ok(['hospital', 'school', 'cityhall', 'mall', 'military'].every(k => D.LOOT[k]), 'tabelas de loot dos lugares especiais');
  ok(D.LOOT.military.list.some(e => e[0] === 'army_jacket') && D.ITEMS.mre && D.ITEMS.venison, 'base militar tem farda; existem ração e carne de veado');
  q.x = firstOpen.x; q.y = firstOpen.y; q.z = 0; q.vehicle = null; G.activateChunks(true); clearZombies(); An.reset();
  q.sneaking = false; q.running = false;
  // acha um tile de mato perto
  let spot = null;
  for (let r = 3; r < 30 && !spot; r++) for (let a = 0; a < 24 && !spot; a++) { const x = q.x + Math.cos(a / 24 * 6.28) * r, y = q.y + Math.sin(a / 24 * 6.28) * r; const f = W.floor(Math.floor(x), Math.floor(y), 0); if ((f === F.GRASS || f === F.DARKGRASS) && !W.isIndoor(Math.floor(x), Math.floor(y), 0) && W.tileWalkable(Math.floor(x), Math.floor(y), 0) && !W.obj(Math.floor(x), Math.floor(y), 0)) spot = { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5 }; }
  ok(!!spot, 'tem grama perto para os bichos');
  // nascem sozinhos com o tempo
  const W0 = G.state.world.weather; G.state.world.weather = { type: 'clear', until: CP.Time.hours() + 50 };
  const isN = CP.Time.isNight; CP.Time.isNight = () => false;
  for (let i = 0; i < 40 && An.list.length === 0; i++) { An.spawnT = 0; An.update(0.01); }
  CP.Time.isNight = isN;
  ok(An.list.length > 0, 'animais aparecem no mato (' + An.list.map(a => a.species).join(',') + ')');
  An.reset();
  // foge do jogador que chega de pé
  const rb = An.spawn('rabbit', spot.x, spot.y);
  q.x = spot.x - 2; q.y = spot.y; rb.ang = Math.PI; rb.state = 'graze'; rb.t = 99;
  An.update(0.05);
  ok(rb.state === 'flee', 'coelho foge de quem chega perto');
  const d0 = U.dist(rb.x, rb.y, q.x, q.y); for (let i = 0; i < 20; i++) An.update(0.05);
  ok(U.dist(rb.x, rb.y, q.x, q.y) > d0 || An.list.indexOf(rb) < 0, 'e se afasta');
  An.reset();
  // agachado por trás: chega perto e mata com a faca
  const rb2 = An.spawn('rabbit', spot.x, spot.y); rb2.ang = 0; rb2.state = 'graze'; rb2.t = 99;
  q.x = spot.x - 0.8; q.y = spot.y; q.sneaking = true; An.update(0.05);
  ok(rb2.state !== 'flee', 'agachado por trás o coelho não percebe');
  const knife = CP.Items.make('knife'); Inv.give(q, knife); CP.Use.equip(q, knife, 'hand1');
  const onN = An.onNoise; An.onNoise = () => {}; clearZombies(); // barulhos aleatórios do mundo não espantam o coelho do teste
  q.ang = 0; q.anim.attack = 0; q.attackCd = 0; q.stealth = null; CP.Zombies.rebuildHash();
  const fl0 = (W.floorItems(Math.floor(spot.x), Math.floor(spot.y), 0) || []).filter(i => i.id === 'dead_rabbit').length;
  CP.Input.mouse.left = true; q.uiClickGuard = false; CP.Combat.playerUpdate(q, 1 / 30); CP.Input.mouse.left = false;
  for (let i = 0; i < 60; i++) CP.Combat.playerUpdate(q, 1 / 30);
  const fl1 = (W.floorItems(Math.floor(rb2.x), Math.floor(rb2.y), 0) || []).filter(i => i.id === 'dead_rabbit').length;
  ok(An.list.indexOf(rb2) < 0 && fl1 > fl0, 'golpe mata o coelho e deixa a carcaça no chão');
  q.sneaking = false; CP.Use.unequip(q, knife); An.onNoise = onN;
  // tiro: o raio acha o veado e o dano mata
  const dr = An.spawn('deer', spot.x + 6, spot.y); q.x = spot.x; q.y = spot.y;
  const hit = An.ray(q, 0, 20);
  ok(hit && hit.a === dr && Math.abs(hit.d - 6) < 0.5, 'tiro na direção do veado acerta ele');
  ok(!An.ray(q, Math.PI / 2, 20), 'tiro para o lado não acerta');
  An.damage(dr, 1, 0); ok(dr.state === 'flee' && An.list.indexOf(dr) >= 0, 'veado ferido foge');
  An.damage(dr, 5, 0); ok(An.list.indexOf(dr) < 0 && (W.floorItems(Math.floor(dr.x), Math.floor(dr.y), 0) || []).some(i => i.id === 'venison'), 'veado abatido vira carne');
  // barulho espanta
  const dr2 = An.spawn('deer', spot.x + 3, spot.y); dr2.state = 'graze';
  CP.Zombies.noise(spot.x + 3, spot.y + 2, 0, 10, 'test'); ok(dr2.state === 'flee', 'barulho espanta o veado');
  // longe demais some
  dr2.x += 100; An.update(0.05); ok(An.list.indexOf(dr2) < 0, 'bicho longe some');
  An.reset(); G.state.world.weather = W0;
}
/* ---------- T5: mover móveis (porta travada) e escada de mão até o telhado ---------- */
{
  const q = G.player, Sv = CP.Surv, E = C.EDGE;
  q.x = firstOpen.x; q.y = firstOpen.y; q.z = 0; q.vehicle = null; q.carry = null; q.dragging = null; q.action = null; G.activateChunks(true); clearZombies();
  // uma casa térrea com porta
  let hs = null;
  for (const ch of W.allChunks()) { if (!ch.active) continue; for (const b of ch.buildings) if (b.kind === 'house' && b.floors === 1 && b.door && W.edgeType(b.door.x, b.door.y, 0, b.door.side) === E.DOOR) { hs = b; break; } if (hs) break; }
  ok(!!hs, 'achou casa térrea com porta');
  const d = hs.door, inA = W.isIndoor(d.x, d.y, 0), inT = inA ? { x: d.x, y: d.y } : (d.side === 0 ? { x: d.x, y: d.y - 1 } : { x: d.x - 1, y: d.y });
  const st = W.edgeState(d.x, d.y, 0, d.side) || (W.setEdgeState(d.x, d.y, 0, d.side, { open: false, locked: false, hp: 25, bar: 0, barHp: 0, broken: false }), W.edgeState(d.x, d.y, 0, d.side));
  st.open = false; st.locked = false; st.bar = 0; st.broken = false; st.block = false;
  // limpa o tile de dentro da porta e põe uma mesa ao lado para pegar
  const L0 = W.lvl(inT.x, inT.y, 0); L0.obj[W.idx(inT.x, inT.y)] = 0;
  let tbl = null;
  for (const dd of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const x = inT.x + dd[0], y = inT.y + dd[1]; if (W.isIndoor(x, y, 0) && W.building(x, y, 0) === W.building(inT.x, inT.y, 0) && !W.blockedBetween(inT.x, inT.y, x, y, 0, false)) { if (!tbl) tbl = { x, y }; } }
  ok(!!tbl, 'tile vizinho dentro da casa');
  const Lt = W.lvl(tbl.x, tbl.y, 0); Lt.obj[W.idx(tbl.x, tbl.y)] = O.TABLE; Lt.odir[W.idx(tbl.x, tbl.y)] = 2;
  q.x = inT.x + 0.5; q.y = inT.y + 0.5;
  const opts = CP.Actions.contextOptions(q, tbl.x + 0.5, tbl.y + 0.5), pk = opts.find(o => /^Pegar mesa/.test(o.label));
  ok(pk && !pk.disabled, 'dá para pegar a mesa');
  pk.fn(); tick(6);
  ok(q.carry && q.carry.o === O.TABLE && !W.obj(tbl.x, tbl.y, 0), 'mesa nas mãos, tile vazio');
  ok(Sv.carrySpeed(q) < 0.9 && Sv.carrySpeed(q) > 0.3, 'carregando anda mais devagar (' + Sv.carrySpeed(q).toFixed(2) + ')');
  ok(!CP.Actions.contextOptions(q, tbl.x + 0.5, tbl.y + 0.5).some(o => /^Pegar/.test(o.label)), 'não pega outro com as mãos ocupadas');
  // coloca encostada na porta (por dentro)
  q.x = tbl.x + 0.5; q.y = tbl.y + 0.5;
  const pl = CP.Actions.contextOptions(q, inT.x + 0.5, inT.y + 0.5).find(o => /^Colocar mesa aqui/.test(o.label));
  ok(pl && !pl.disabled, 'opção de colocar a mesa');
  pl.fn(); tick(3);
  ok(!q.carry && W.obj(inT.x, inT.y, 0) === O.TABLE && st.block, 'mesa no lugar trava a porta');
  ok(Sv.bashMult(st) < 0.5, 'porta travada aguenta mais os zumbis');
  // de fora não abre
  const out = inA ? (d.side === 0 ? { x: d.x, y: d.y - 1 } : { x: d.x - 1, y: d.y }) : { x: d.x, y: d.y };
  q.x = out.x + 0.5; q.y = out.y + 0.5;
  const mid = d.side === 0 ? { x: d.x + 0.5, y: d.y } : { x: d.x, y: d.y + 0.5 };
  const dop = CP.Actions.contextOptions(q, mid.x + (d.side === 1 ? (q.x < mid.x ? -0.1 : 0.1) : 0), mid.y + (d.side === 0 ? (q.y < mid.y ? -0.1 : 0.1) : 0));
  ok(dop.some(o => /travada por um móvel/.test(o.label)) && !dop.some(o => o.label === 'Abrir porta'), 'porta travada não abre');
  // tira a mesa: destrava
  q.x = tbl.x + 0.5; q.y = tbl.y + 0.5;
  CP.Actions.contextOptions(q, inT.x + 0.5, inT.y + 0.5).find(o => /^Pegar mesa/.test(o.label)).fn(); tick(6);
  ok(q.carry && !st.block, 'tirou a mesa: porta destravada');
  q.carry = null;
  ok(Sv.strNeeded(40) === 4 && Sv.strNeeded(10) === 0, 'móvel pesado pede força');
  // recipiente cheio não sai do lugar
  Lt.obj[W.idx(tbl.x, tbl.y)] = O.CRATE; W.chunkAt(tbl.x, tbl.y).containers[W.key(tbl.x, tbl.y, 0)] = { items: [CP.Items.make('nails')], gen: true };
  const cr = CP.Actions.contextOptions(q, tbl.x + 0.5, tbl.y + 0.5).find(o => /^Pegar caixote/.test(o.label));
  ok(cr && cr.disabled && /Esvazie/.test(cr.hint), 'caixote cheio: esvazie antes');
  Lt.obj[W.idx(tbl.x, tbl.y)] = 0;
  // escada de mão: parede de fora com telhado em cima
  let spot = null;
  for (let y = hs.y - 1; y <= hs.y + hs.h && !spot; y++) for (let x = hs.x - 1; x <= hs.x + hs.w && !spot; x++) {
    if (W.isIndoor(x, y, 0) || !W.tileWalkable(x, y, 0) || W.obj(x, y, 0)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (W.isIndoor(x + dx, y + dy, 0) && W.floor(x + dx, y + dy, 1) === F.ROOF && W.edgeType(dx === 1 ? x + 1 : x, dy === 1 ? y + 1 : y, 0, dx ? 1 : 0) === E.WALL) { spot = { x, y, a: Math.atan2(dy, dx) }; break; }
  }
  ok(!!spot, 'parede de fora com telhado');
  q.x = spot.x + 0.5; q.y = spot.y + 0.5; q.ang = spot.a; clearZombies();
  const lad = CP.Items.make('step_ladder'); Inv.give(q, lad);
  const lo = CP.Use.itemOptions(q, lad, 'player').find(o => /Apoiar a escada/.test(o.label));
  ok(lo && !lo.disabled, 'dá para apoiar a escada na parede'); lo.fn(); tick(4);
  ok(W.obj(spot.x, spot.y, 0) === O.LADDER && !Inv.findId(q, 'step_ladder'), 'escada apoiada');
  const up = CP.Actions.contextOptions(q, spot.x + 0.5, spot.y + 0.5).find(o => o.label === 'Subir no telhado');
  ok(!!up, 'opção de subir'); up.fn(); tick(4);
  ok(W.levelOf(q.z) === 1 && W.floor(Math.floor(q.x), Math.floor(q.y), 1) === F.ROOF, 'em cima do telhado');
  const dn = CP.Actions.contextOptions(q, q.x, q.y).find(o => o.label === 'Descer pela escada');
  ok(!!dn, 'no telhado: descer pela escada'); dn.fn(); tick(4);
  ok(W.levelOf(q.z) === 0 && Math.floor(q.x) === spot.x && Math.floor(q.y) === spot.y, 'desceu');
  CP.Actions.contextOptions(q, spot.x + 0.5, spot.y + 0.5).find(o => o.label === 'Recolher a escada').fn(); tick(3);
  ok(!W.obj(spot.x, spot.y, 0) && Inv.findId(q, 'step_ladder'), 'escada recolhida');
}
/* ---------- T6: resfriado, cozinha completa, metalurgia ---------- */
{
  const q = G.player, B = CP.Body, s = q.body.stats, K = C.KITCHEN, w = G.state.world;
  const idle = (max) => { for (let t = 0; t < (max || 60) && (q.action || q.queue.length); t += 0.5) { clearZombies(); tick(0.5); } };
  q.x = firstOpen.x; q.y = firstOpen.y; q.z = 0; q.vehicle = null; q.carry = null; q.action = null; q.sleeping = false; q.sitting = false; G.activateChunks(true); clearZombies();
  // resfriado: frio e molhado acumula friagem e acaba pegando
  s.cold = 0; s.coldOn = 0; s.chill = 0; s.temp = 35.5; s.wet = 1;
  let caught = false; for (let i = 0; i < 300 && !caught; i++) { B.updateFlu(q, 0, 1, 5, false); caught = !!s.coldOn; }
  ok(caught && s.chill > 0.3, 'frio e molhado: pegou resfriado');
  ok(B.moodles(q).some(m => m.id === 'flu'), 'moodle de resfriado');
  s.temp = 36.8; s.wet = 0;
  let hrs = 0; while (s.coldOn && hrs < 600) { B.updateFlu(q, 0, 1, 22, true); hrs++; }
  ok(!s.coldOn && s.cold === 0 && hrs > 10, 'resfriado passa sozinho descansando aquecido (' + hrs + ' h)');
  B.catchCold(q); s.cold = 0.5;
  const r1 = B.sneeze(q); Inv.give(q, CP.Items.make('tissues')); const r2 = B.sneeze(q);
  ok(r1 >= C.FLU.NOISE * 0.7 && r2 === C.FLU.MUFFLED && Inv.findId(q, 'tissues').item.uses === 11, 'espirro faz barulho; lenço abafa e gasta');
  s.cold = 0; s.coldOn = 0; s.chill = 0;
  // fogão sem energia + botijão
  const day0 = w.powerOffDay; w.powerOffDay = 0;
  let st = null;
  for (const ch of W.allChunks()) { if (!ch.active) continue; for (let i = 0; i < 1024 && !st; i++) if (ch.levels[0].obj[i] === O.STOVE) st = { x: ch.cx * 32 + (i & 31), y: ch.cy * 32 + (i >> 5) }; if (st) break; }
  ok(!!st, 'achou um fogão');
  let near = null; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) if (!near && W.tileWalkable(st.x + dx, st.y + dy, 0) && W.isIndoor(st.x + dx, st.y + dy, 0)) near = { x: st.x + dx, y: st.y + dy };
  q.x = near.x + 0.5; q.y = near.y + 0.5;
  ok(!CP.Use.nearHeat(q), 'sem energia o fogão não esquenta');
  const tank = CP.Items.make('propane_tank'); Inv.give(q, tank);
  const io = CP.Actions.contextOptions(q, st.x + 0.5, st.y + 0.5).find(o => /Instalar botijão/.test(o.label));
  ok(io && !io.disabled, 'opção de instalar o botijão'); io.fn(); idle();
  ok(CP.Use.nearHeat(q) && CP.Use.stoveGas(st.x, st.y, 0) === K.TANK_H && !Inv.findId(q, 'propane_tank'), 'fogão a gás funciona sem energia');
  // cozinhar (sem queimar) gasta gás; com azar queima
  const rnd = Math.random;
  const meat = CP.Items.make('dead_rabbit', { age: 0 }); Inv.give(q, meat);
  Math.random = () => 0.99; CP.Use.itemOptions(q, meat, 'player').find(o => /^Cozinhar/.test(o.label)).fn(); idle(); Math.random = rnd;
  ok(Inv.findId(q, 'rabbit_cooked') && CP.Use.stoveGas(st.x, st.y, 0) < K.TANK_H, 'cozinhou no gás e gastou botijão');
  ok(/quente/.test(CP.Items.name(Inv.findId(q, 'rabbit_cooked').item)), 'comida sai quente do fogo');
  const meat2 = CP.Items.make('dead_rabbit', { age: 0 }); Inv.give(q, meat2);
  Math.random = () => 0.0; CP.Use.itemOptions(q, meat2, 'player').find(o => /^Cozinhar/.test(o.label)).fn(); idle(); Math.random = rnd;
  ok(!!Inv.findId(q, 'burnt_food'), 'com azar a comida queima');
  // esquentar lata aberta no fogo e comer quente
  const beans = CP.Items.make('beans_open', { age: 0 }); Inv.give(q, beans);
  const wo = CP.Use.itemOptions(q, beans, 'player').find(o => /^Esquentar/.test(o.label));
  ok(wo && !wo.disabled, 'dá para esquentar a lata aberta'); wo.fn(); idle();
  ok(beans.warmUntil > G.state.time && /quente/.test(CP.Items.name(beans)), 'lata esquentada');
  s.unhappy = 0.5; s.hunger = 0.6; const u0 = s.unhappy; CP.Use.eat(q, beans, 1); idle();
  ok(s.unhappy < u0 - 0.03, 'comida quente anima');
  // retirar o botijão
  CP.Actions.contextOptions(q, st.x + 0.5, st.y + 0.5).find(o => o.label === 'Retirar o botijão').fn();
  ok(Inv.findId(q, 'propane_tank') && CP.Use.stoveGas(st.x, st.y, 0) === 0, 'botijão retirado com o gás que sobrou');
  // micro-ondas num balcão de cozinha
  w.powerOffDay = 999;
  let mc = null;
  for (const ch of W.allChunks()) { if (!ch.active || mc) continue; for (let i = 0; i < 1024 && !mc; i++) { const x = ch.cx * 32 + (i & 31), y = ch.cy * 32 + (i >> 5); if (ch.levels[0].obj[i] === O.COUNTER && CP.Surv.hasMicrowave(x, y, 0)) mc = { x, y }; } }
  if (!mc) { for (const ch of W.allChunks()) { if (!ch.active || mc) continue; for (let i = 0; i < 1024 && !mc; i++) { const x = ch.cx * 32 + (i & 31), y = ch.cy * 32 + (i >> 5); const b = W.building(x, y, 0); if (b && b.kind === 'house' && W.isIndoor(x, y, 0) && !ch.levels[0].obj[i] && ((x * 73856093 ^ y * 19349663) >>> 0) % K.MICRO === 0) { ch.levels[0].obj[i] = O.COUNTER; mc = { x, y }; } } } }
  ok(!!mc && CP.Surv.hasMicrowave(mc.x, mc.y, 0), 'há micro-ondas em balcão de casa');
  let mn = null; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!mn && W.tileWalkable(mc.x + dx, mc.y + dy, 0) && !W.blockedBetween(mc.x, mc.y, mc.x + dx, mc.y + dy, 0, false)) mn = { x: mc.x + dx, y: mc.y + dy };
  q.x = (mn || mc).x + 0.5; q.y = (mn || mc).y + 0.5;
  const soup = CP.Items.make('rabbit_cooked', { age: 0 }); Inv.give(q, soup);
  const mo = CP.Actions.contextOptions(q, mc.x + 0.5, mc.y + 0.5).find(o => /micro-ondas/.test(o.label) && /coelho/.test(o.label));
  ok(mo && !mo.disabled, 'esquentar no micro-ondas'); mo.fn(); idle();
  ok(soup.warmUntil > G.state.time, 'micro-ondas esquentou');
  const can = CP.Items.make('beans_open', { age: 0 }); Inv.give(q, can); w.fires = [];
  Math.random = () => 0.0; CP.Actions.contextOptions(q, mc.x + 0.5, mc.y + 0.5).find(o => /micro-ondas/.test(o.label) && /feijão/i.test(o.label)).fn(); idle(); Math.random = rnd;
  ok(CP.Fire.burningAt(mc.x, mc.y, 0), 'lata de metal no micro-ondas pega fogo');
  w.fires = []; for (const k in G.activeChunks) G.activeChunks[k].fires = {};
  for (const k in q.body.parts) q.body.parts[k].wounds = []; q.body.health = 100; q.dead = false; q.deathCause = null; G.over = false;
  w.powerOffDay = day0;
  // metalurgia: parede de metal soldada
  q.x = firstOpen.x; q.y = firstOpen.y; G.activateChunks(true); clearZombies();
  const op = findOpen(q.x, q.y, 3); q.x = op.x; q.y = op.y;
  const bd = CP.D.BUILD.b_metal_wall;
  CP.Build.mode = { def: bd, side: 0 };
  ok(!CP.Build.status(q, bd).ok, 'sem maçarico e chapas não solda');
  ['blowtorch', 'welding_mask'].forEach(id => Inv.give(q, CP.Items.make(id)));
  Inv.give(q, CP.Items.make('metal_sheet')); Inv.give(q, CP.Items.make('metal_sheet')); Inv.give(q, CP.Items.make('scrap')); Inv.give(q, CP.Items.make('scrap'));
  const ms0 = q.skills.metalworking; q.skills.metalworking = 1;
  ok(CP.Build.status(q, bd).ok, 'com maçarico, máscara, chapas e Metalurgia 1 dá para soldar');
  let tx = null; for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1]]) { const x = Math.floor(q.x) + dx, y = Math.floor(q.y) + dy; if (!tx && !W.edgeType(x, y, 0, 0) && W.tileWalkable(x, y, 0) && W.tileWalkable(x, y - 1, 0)) tx = { x, y }; }
  CP.Build.place(q, tx.x + 0.5, tx.y + 0.02); idle();
  const es = W.edgeState(tx.x, tx.y, 0, 0);
  ok(W.edgeType(tx.x, tx.y, 0, 0) === C.EDGE.WALL && es && es.hp === 120 && es.metal, 'parede de metal soldada (hp 120)');
  ok(Inv.findTag(q, 'blowtorch').item.uses === C.METAL.TORCH_USES - 2, 'solda gastou gás do maçarico');
  CP.Build.mode = null;
  // blindar carro
  let car2 = null; for (let r = 0; r < 4 && !car2; r++) { for (const c of CP.Vehicles.active) { car2 = c; break; } if (!car2) { q.x += 32; G.activateChunks(true); } }
  if (car2) {
    q.x = car2.x + 1.6; q.y = car2.y; q.vehicle = null; car2.armor = false; clearZombies(); q.action = null; q.queue.length = 0;
    for (let i = 0; i < 3; i++) Inv.give(q, CP.Items.make('metal_sheet'));
    Inv.findTag(q, 'blowtorch').item.uses = C.METAL.TORCH_USES;
    const ao = CP.Actions.contextOptions(q, car2.x, car2.y).find(o => /Blindar/.test(o.label));
    ok(ao && !ao.disabled, 'opção de blindar o carro'); ao.fn(); idle();
    ok(car2.armor && Inv.count(q, 'metal_sheet') === 0, 'carro blindado');
  } else ok(false, 'achou carro para blindar');
  q.skills.metalworking = ms0;
}
console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nOK melhorias');
process.exit(fails ? 1 : 0);
