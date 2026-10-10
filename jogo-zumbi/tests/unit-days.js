/* Simula 30 dias de jogo (acelerado) e confere eventos do mundo. */
'use strict';
const { load } = require('./harness');
const g = load();
const CP = g.CP, W = CP.W, C = CP.C, G = CP.Game, U = CP.U;
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('FALHA:', m); } else { console.log('ok  -', m); } }
const toasts = [];
CP.UI = { toast: (t) => toasts.push(t), say() {}, hurtFlash() {} };
G.newGame({ seed: 2024, settings: {}, character: { name: 'Dias', occupation: 'farmer', traits: [] } });
const p = G.player;
const ws = G.state.world;
console.log('energia acaba no dia', ws.powerOffDay, '· água no dia', ws.waterOffDay, '· helicóptero no dia', ws.heliDay, '~' + ws.heliHour.toFixed(1) + 'h');
// planta uma cenoura num canteiro fora de casa
let farmTile = null;
for (let r = 3; r < 30 && !farmTile; r++) for (let a = 0; a < 24 && !farmTile; a++) { const x = Math.floor(p.x + Math.cos(a / 24 * 6.28) * r), y = Math.floor(p.y + Math.sin(a / 24 * 6.28) * r); if (W.floor(x, y, 0) === C.FLOOR.GRASS && !W.obj(x, y, 0) && !W.isIndoor(x, y, 0)) farmTile = { x, y }; }
const ch = W.chunkAt(farmTile.x, farmTile.y);
W.lvl(farmTile.x, farmTile.y, 0).floor[W.idx(farmTile.x, farmTile.y)] = C.FLOOR.FURROW;
W.lvl(farmTile.x, farmTile.y, 0).obj[W.idx(farmTile.x, farmTile.y)] = C.OBJ.CROP;
ch.crops[W.key(farmTile.x, farmTile.y, 0)] = { crop: 'carrot', days: 14, yield: [3, 6], grow: 0, water: 1, stage: 0, rot: 0 };
// esconde o jogador dentro de casa e mantém vivo
G.zombies.length = 0;
const weathers = new Set();
// gera pedaços de mapa mais longe (ficam inativos) e esvazia um deles para testar o reaparecimento
const pcx = Math.floor(p.x) >> 5, pcy = Math.floor(p.y) >> 5;
for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) W.ensureChunk(pcx + dx, pcy + dy);
const far = W.chunkByIndex(pcx + 5, pcy + 5);
far.initialZ = Math.max(far.initialZ || 0, 10); far.zombies.length = 0; far.lastActive = 0;
const dist0 = W.allChunks().filter(c => !c.active).map(c => c.zombies.length).join(',');
let stored0 = 0; W.allChunks().forEach(c => { if (!c.active) stored0 += c.zombies.length; });
const totalDays = 30;
const steps = totalDays * 86400 / (1 / 30 * G.gameSecondsPerReal() * 400);
let heliSeen = false;
for (let i = 0; i < steps && !p.dead; i++) {
  G.tick(1 / 30, 400);
  weathers.add(ws.weather.type);
  if (ws.heli) heliSeen = true;
  const s = p.body.stats; s.hunger = 0.1; s.thirst = 0.1; s.fatigue = 0.2; p.body.health = 100; p.body.infection = null;
  for (const k in p.body.parts) p.body.parts[k].wounds = [];
  G.zombies.length = 0;
  const c = ch.crops[W.key(farmTile.x, farmTile.y, 0)]; if (c) c.water = Math.max(c.water, 0.6);
}
const days = CP.Time.daysSurvived();
ok(days >= totalDays - 0.5, 'passaram ' + days.toFixed(1) + ' dias');
ok(!CP.Time.powerOn() && ws.announced.power, 'energia acabou e foi avisado');
ok(!CP.Time.waterOn() && ws.announced.water, 'água acabou e foi avisado');
ok(heliSeen, 'helicóptero apareceu');
ok(weathers.size >= 3, 'clima variou: ' + [...weathers].join(', '));
const crop = ch.crops[W.key(farmTile.x, farmTile.y, 0)];
ok(crop && crop.stage >= 4, 'cenoura cresceu (estágio ' + (crop && crop.stage) + ')');
let stored1 = 0; W.allChunks().forEach(c => { if (!c.active) stored1 += c.zombies.length; });
const dist1 = W.allChunks().filter(c => !c.active).map(c => c.zombies.length).join(',');
ok(stored1 > 0 && dist0 !== dist1, 'zumbis migraram entre pedaços do mapa (' + stored0 + ' → ' + stored1 + ')');
ok(far.zombies.length > 0, 'zumbis reapareceram no pedaço esvaziado (' + far.zombies.length + ')');
ok(toasts.some(t => /Dia \d+/.test(t)), 'avisos de novo dia');
ok(toasts.some(t => /helicóptero/i.test(t)), 'aviso do helicóptero');
console.log('   avisos:', [...new Set(toasts.map(t => t.replace(/\d+/g, 'N')))].slice(0, 12).join(' | '));
console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nOK 30 dias');
process.exit(fails ? 1 : 0);
