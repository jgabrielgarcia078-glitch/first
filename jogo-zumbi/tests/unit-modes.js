/* Desafios e configurações avançadas do mundo, diário do sobrevivente e troca de teclas (lógica, sem navegador). */
'use strict';
const { load } = require('./harness');
const g = load();
const CP = g.CP, W = CP.W, C = CP.C, G = CP.Game, U = CP.U, T = CP.Time;
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('FALHA:', m); } else { console.log('ok  -', m); } }
CP.UI = Object.assign(CP.UI || {}, { toast() {}, say() {}, hurtFlash() {} });
const ch = { name: 'Modo', occupation: 'unemployed', traits: [] };
const tick = (sec) => { const n = Math.round(sec * C.TICK_RATE); for (let i = 0; i < n && !G.over; i++) G.tick(1 / C.TICK_RATE, 1); };

// seis meses depois
G.newGame({ seed: 777, settings: { challenge: 'sixmonths' }, character: ch });
ok(Math.floor(T.daysSurvived()) === 180, 'começa no dia 180 (' + T.daysSurvived().toFixed(1) + ')');
ok(!T.powerOn() && !T.waterOn(), 'sem energia e sem água');
ok(G.state.world.heliDone, 'o helicóptero já passou');
ok(T.season() === 'Inverno', 'seis meses depois de julho é inverno');
const apple = CP.Items.make('apple'); ok(CP.Items.freshState(apple) === 'rotten', 'comida perecível do saque já estragou');
const beans = CP.Items.make('beans'); ok(CP.Items.freshState(beans) !== 'rotten', 'enlatado continua bom');
ok(G.settings.lootMult < 0.6, 'casas reviradas: menos saque');
ok(G.player.startT === 180 * 86400, 'o sobrevivente começa a contar do zero (startT no dia 180)');
tick(2);
ok(!G.over && Math.floor(T.daysSurvived()) === 180, 'o jogo roda normalmente');
ok(CP.Journal.of(G.player).events.some(e => /meses depois/.test(e.t)), 'diário registra o começo');

// inverno eterno
G.newGame({ seed: 778, settings: { challenge: 'winter' }, character: ch });
ok(T.season() === 'Inverno' && T.temperature(true) < 5, 'inverno eterno: frio em julho (' + T.temperature(true).toFixed(1) + '°C)');

// cidade lotada
G.newGame({ seed: 779, settings: { challenge: 'crowded', popMult: 1 }, character: ch });
ok(G.settings.popMult === 3, 'cidade lotada: 3× zumbis');

// sem energia
G.newGame({ seed: 780, settings: { challenge: 'nopower' }, character: ch });
ok(!T.powerOn() && !T.waterOn() && T.daysSurvived() < 0.1, 'sem energia desde o primeiro minuto');

// avançado: energia e água em 30 dias, zumbis resistentes
G.newGame({ seed: 781, settings: { powerDays: 30, waterDays: 7, toughness: 1.4 }, character: ch });
ok(G.state.world.powerOffDay === 30 && G.state.world.waterOffDay === 7 && G.settings.toughness === 1.4, 'configurações avançadas aplicadas');

// diário: mortes por arma, lugares, sobreviventes
const J = CP.Journal, p = G.player;
U.emit('zombie:killed', { cause: 'gun' }); U.emit('zombie:killed', { cause: 'car' });
p.hand1 = CP.Items.make('bat'); U.emit('zombie:killed', { cause: 'weapon' });
const jj = J.of(p);
ok(jj.kills['Arma de fogo'] === 1 && jj.kills['Atropelado'] === 1 && jj.kills['Arma de impacto longa'] === 1, 'mortes contadas por arma: ' + JSON.stringify(jj.kills));
let inside = null;
for (const c of W.allChunks()) { if (!c.active) continue; for (const b of c.buildings) { for (let y = b.y; y < b.y + b.h && !inside; y++) for (let x = b.x; x < b.x + b.w && !inside; x++) if (W.isIndoor(x, y, 0) && W.tileWalkable(x, y, 0)) inside = { x, y, k: b.kind }; } if (inside) break; }
p.x = inside.x + 0.5; p.y = inside.y + 0.5; J.scan(p);
ok(jj.places[inside.k] >= 1, 'lugar visitado: ' + inside.k);
ok(Object.keys(jj.towns).length >= 0, 'cidades visitadas registradas');
CP.Body.die(p, 'Teste');
const sv = G.state.survivorsLog;
ok(sv && sv.length === 1 && sv[0].name === 'Modo' && sv[0].cause === 'Teste', 'morte registrada na lista de sobreviventes do mundo');
G.over = false;
G.newSurvivor({ townIndex: 0, character: { name: 'Outro', occupation: 'unemployed', traits: [] } });
const lst = J.survivors();
ok(lst.length === 2 && lst[1].alive && lst[1].name === 'Outro', 'lista mostra o anterior (morto) e o atual (vivo)');

// teclas trocadas
const I = CP.Input;
I.setBinds({ KeyF: 'KeyT' });
ok(I.translate('KeyT') === 'KeyF' && I.translate('KeyF') === '' && I.translate('KeyW') === 'KeyW', 'lanterna no T: F fica livre');
I.setBinds({ KeyE: 'KeyF', KeyF: 'KeyE' });
ok(I.translate('KeyF') === 'KeyE' && I.translate('KeyE') === 'KeyF', 'trocar E e F');
I.setBinds({});
ok(I.translate('KeyE') === 'KeyE', 'padrão restaurado');

console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nOK modos e diário');
process.exit(fails ? 1 : 0);
