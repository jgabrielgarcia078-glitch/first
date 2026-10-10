/* Simulações de lógica no Node (sem navegador): dados, combate, IA, portas, escadas, necessidades, infecção. */
'use strict';
const { load } = require('./harness');
const g = load();
const CP = g.CP, W = CP.W, C = CP.C, D = CP.D, G = CP.Game, U = CP.U;
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('FALHA:', m); } else { console.log('ok  -', m); } }

/* ---------- integridade dos dados ---------- */
let bad = [];
for (const k in D.LOOT) D.LOOT[k].list.forEach(([id]) => { if (!D.ITEMS[id]) bad.push('loot ' + k + ':' + id); });
D.RECIPES.forEach(r => (r.needs || []).concat(r.out || []).forEach(n => { if (n.item && !D.ITEMS[n.item]) bad.push('receita ' + r.id + ':' + n.item); }));
D.BUILDS.forEach(b => b.mats.forEach(m => { if (!D.ITEMS[m.item]) bad.push('build ' + b.id + ':' + m.item); }));
for (const k in D.OUTFITS) D.OUTFITS[k].forEach(o => o.forEach(id => { if (!D.ITEMS[id]) bad.push('outfit ' + k + ':' + id); }));
D.TRAITS.forEach(t => (t.excl || []).forEach(x => { if (!D.TRAIT[x]) bad.push('traço ' + t.id + ' exclui ' + x); }));
D.OCCUPATIONS.forEach(o => { Object.keys(o.skills).forEach(s => { if (!D.SKILL[s]) bad.push('occ ' + o.id + ' skill ' + s); }); (o.traits || []).forEach(t => { if (!D.TRAIT[t]) bad.push('occ trait ' + t); }); });
for (const id in D.ITEMS) { const it = D.ITEMS[id]; if (it.food && it.food.opens && !D.ITEMS[it.food.opens]) bad.push('opens ' + id); if (it.food && it.food.cookable && !D.ITEMS[it.food.cookable]) bad.push('cookable ' + id); if (it.asWeapon && !D.ITEMS[it.asWeapon]) bad.push('asWeapon ' + id); if (it.gun && !D.ITEMS[it.gun.ammo]) bad.push('ammo ' + id); }
ok(bad.length === 0, 'todos os ids de itens/traços referenciados existem ' + bad.join(', '));
ok(Object.keys(D.ITEMS).length >= 150, 'quantidade de itens: ' + Object.keys(D.ITEMS).length);
// exclusões simétricas no validador
const v1 = CP.Player.validate({ occupation: 'unemployed', traits: ['strong', 'weak'] });
ok(!v1.ok && v1.errors.some(e => e.indexOf('não combina') >= 0), 'Forte + Fraco é recusado');
const v2 = CP.Player.validate({ occupation: 'veteran', traits: ['strong'] });
ok(!v2.ok && v2.points === -18, 'Veterano (−8) + Forte (−10) = −18 pontos');

/* ---------- partida de teste ---------- */
G.newGame({ seed: 777, settings: { popMult: 1 }, character: { name: 'Teste', occupation: 'unemployed', traits: [] } });
const p = G.player;
ok(p && p.body && p.inv.length >= 2, 'jogador criado com corpo e itens iniciais');
ok(Object.keys(p.worn).some(k => p.worn[k]), 'jogador começa vestido');
function tick(sec, timeMult) { const n = Math.round(sec * C.TICK_RATE); for (let i = 0; i < n && !G.over; i++) G.tick(1 / C.TICK_RATE, timeMult || 1); }
function clearZombies() { G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0; }
// acha uma rua aberta perto
function findOpen(cx, cy, r) {
  for (let d = 0; d < 60; d++) for (let a = 0; a < 16; a++) {
    const x = Math.floor(cx + Math.cos(a / 16 * 6.283) * d), y = Math.floor(cy + Math.sin(a / 16 * 6.283) * d);
    let good = true;
    for (let yy = y - r; yy <= y + r && good; yy++) for (let xx = x - r; xx <= x + r && good; xx++) {
      if (!W.tileWalkable(xx, yy, 0) || W.isIndoor(xx, yy, 0) || W.wn(xx, yy, 0) || W.ww(xx, yy, 0)) good = false;
    }
    if (good) return { x: x + 0.5, y: y + 0.5 };
  }
  return null;
}
const open = findOpen(p.x, p.y, 4);
ok(!!open, 'achou área aberta para testes');

/* ---------- combate: taco contra zumbi parado ---------- */
clearZombies();
p.x = open.x; p.y = open.y; p.z = 0;
const bat = CP.Items.make('bat');
CP.Use.equip(p, bat, 'hand1');
const zd = CP.Zombies.makeData(new U.Rng(5), p.x + 0.9, p.y, 0, null, null);
zd.crawler = false; zd.fakeDead = false; zd.hp = 1.8;
const zb = CP.Zombies.fromData(zd);
G.zombies.push(zb);
p.ang = 0;
CP.Input.mouse.x = 99999; // não usado: forçamos o ângulo
let swings = 0;
for (let s = 0; s < 12 && zb.state !== 'dead'; s++) {
  p.anim.attack = 0; p.attackCd = 0;
  CP.Input.mouse.left = true; p.uiClickGuard = false;
  p.ang = Math.atan2(zb.y - p.y, zb.x - p.x);
  CP.Zombies.rebuildHash();
  CP.Combat.playerUpdate(p, 1 / 30);
  CP.Input.mouse.left = false;
  for (let i = 0; i < 60; i++) { CP.Combat.playerUpdate(p, 1 / 30); p.ang = Math.atan2(zb.y - p.y, zb.x - p.x); }
  swings++;
  zb.state = zb.state === 'dead' ? 'dead' : 'idle'; zb.vx = zb.vy = 0;
  if (U.dist(zb.x, zb.y, p.x, p.y) > 1.1) { zb.x = p.x + 0.9; zb.y = p.y; }
}
ok(zb.state === 'dead', 'zumbi morto com o taco em ' + swings + ' golpes');
ok(bat.cond <= D.ITEMS.bat.weapon.cond, 'arma tem condição registrada (' + bat.cond + ')');
ok(p.xp.longBlunt > 0, 'ganhou XP de Contundente longa (' + p.xp.longBlunt.toFixed(1) + ')');
ok(W.chunkAt(Math.floor(zb.x), Math.floor(zb.y)).corpses.length > 0, 'deixou um cadáver');

/* ---------- empurrão derruba e pisão mata ---------- */
clearZombies();
const z2 = CP.Zombies.fromData(Object.assign(CP.Zombies.makeData(new U.Rng(9), p.x + 0.8, p.y, 0), { crawler: false, fakeDead: false, hp: 1.5 }));
G.zombies.push(z2);
let downed = false;
for (let i = 0; i < 30 && !downed; i++) {
  p.shoveCd = 0; p.anim.shove = 0; p.anim.attack = 0;
  p.ang = Math.atan2(z2.y - p.y, z2.x - p.x);
  CP.Zombies.rebuildHash();
  CP.Combat.spaceAction(p);
  for (let k = 0; k < 20; k++) CP.Combat.playerUpdate(p, 1 / 30);
  if (z2.state === 'down') downed = true; else { z2.state = 'idle'; z2.x = p.x + 0.8; z2.y = p.y; z2.vx = z2.vy = 0; }
}
ok(downed, 'empurrão derruba o zumbi');
let stomps = 0;
while (z2.state !== 'dead' && stomps < 20) { CP.Zombies.rebuildHash(); p.shoveCd = 0; p.anim.shove = 0; p.ang = Math.atan2(z2.y - p.y, z2.x - p.x); z2.downT = 5; CP.Combat.spaceAction(p); stomps++; }
ok(z2.state === 'dead', 'pisões matam o zumbi caído (' + stomps + ')');

/* ---------- IA: zumbi vê e persegue o jogador ---------- */
clearZombies();
p.body.health = 100;
const z3 = CP.Zombies.fromData(Object.assign(CP.Zombies.makeData(new U.Rng(11), p.x + 3.5, p.y + 0.2, 0), { crawler: false, fakeDead: false }));
z3.ang = Math.PI; // olhando para o jogador
G.zombies.push(z3);
p.hand1 = null;
const d0 = U.dist(z3.x, z3.y, p.x, p.y);
for (let i = 0; i < 30 * 4; i++) { G.tick(1 / 30, 1); p.x = open.x; p.y = open.y; }
ok(z3.state === 'chase' || z3.state === 'attack', 'zumbi viu e persegue (' + z3.state + ')');
ok(U.dist(z3.x, z3.y, p.x, p.y) < d0 - 1, 'zumbi se aproximou');
// deixa ele atacar por um tempo
const woundsBefore = Object.values(p.body.parts).reduce((a, x) => a + x.wounds.length, 0);
tick(12);
const woundsAfter = Object.values(p.body.parts).reduce((a, x) => a + x.wounds.length, 0);
ok(woundsAfter > woundsBefore || p.body.health < 100, 'zumbi feriu o jogador (feridas ' + woundsAfter + ', vida ' + Math.round(p.body.health) + ')');

/* ---------- audição: barulho atrai ---------- */
clearZombies();
const z4 = CP.Zombies.fromData(Object.assign(CP.Zombies.makeData(new U.Rng(12), p.x + 12, p.y + 12, 0), { crawler: false, fakeDead: false }));
z4.ang = 0;
G.zombies.push(z4);
CP.Zombies.noise(p.x, p.y, 0, 30, 'shout');
ok(z4.state === 'investigate' && z4.target, 'grito faz zumbi investigar');

/* ---------- casa: zumbi bate na porta trancada até quebrar ---------- */
clearZombies();
G.over = false; p.dead = false; p.body.health = 100;
for (const k in p.body.parts) p.body.parts[k].wounds = [];
p.body.infection = null;
let house = null;
for (const ch of W.allChunks()) { for (const b of ch.buildings) { if (b.kind === 'house' && b.door && U.dist(b.x, b.y, p.x, p.y) < 70) { house = b; break; } } if (house) break; }
ok(!!house, 'achou uma casa');
const dr = house.door;
const st = W.edgeState(dr.x, dr.y, 0, dr.side);
st.open = false; st.locked = true; st.broken = false; st.hp = 12;
// jogador dentro, zumbi fora
const inside = dr.side === 0 ? { x: dr.x + 0.5, y: W.isIndoor(dr.x, dr.y, 0) ? dr.y + 1.5 : dr.y - 1.5 } : { x: W.isIndoor(dr.x, dr.y, 0) ? dr.x + 1.5 : dr.x - 1.5, y: dr.y + 0.5 };
const outside = dr.side === 0 ? { x: dr.x + 0.5, y: W.isIndoor(dr.x, dr.y, 0) ? dr.y - 1.5 : dr.y + 1.5 } : { x: W.isIndoor(dr.x, dr.y, 0) ? dr.x - 1.5 : dr.x + 1.5, y: dr.y + 0.5 };
p.x = inside.x; p.y = inside.y;
const z5 = CP.Zombies.fromData(Object.assign(CP.Zombies.makeData(new U.Rng(13), outside.x, outside.y, 0), { crawler: false, fakeDead: false, hp: 50 }));
G.zombies.push(z5);
for (let i = 0; i < 40 * 30; i++) { G.tick(1 / 30, 1); p.x = inside.x; p.y = inside.y; if (i % 30 === 0) CP.Zombies.noise(p.x, p.y, 0, 10, 'test'); if (st.broken) break; }
ok(st.broken, 'zumbi arrombou a porta batendo (estado final: ' + z5.state + ', hp porta ' + st.hp.toFixed(1) + ')');

/* ---------- escadas: caminho até o 2º andar ---------- */
let stairHouse = null;
for (const ch of W.allChunks()) { for (const b of ch.buildings) { if (b.floors === 2 && b.door) { stairHouse = b; break; } } if (stairHouse) break; }
if (!stairHouse) { for (let cy = 0; cy < C.WORLD_CHUNKS && !stairHouse; cy++) for (let cx = 0; cx < C.WORLD_CHUNKS && !stairHouse; cx++) { const ch = W.ensureChunk(cx, cy); for (const b of ch.buildings) if (b.floors === 2 && b.door) { stairHouse = b; break; } } }
ok(!!stairHouse, 'achou um sobrado');
let up = null;
for (let y = stairHouse.y; y < stairHouse.y + stairHouse.h && !up; y++) for (let x = stairHouse.x; x < stairHouse.x + stairHouse.w && !up; x++) if (W.isIndoor(x, y, 1) && W.tileWalkable(x, y, 1) && !W.stairAt(x, y)) up = { x, y };
const dd = stairHouse.door;
const startT = W.isIndoor(dd.x, dd.y, 0) ? { x: dd.x, y: dd.y } : (dd.side === 0 ? { x: dd.x, y: dd.y - 1 } : { x: dd.x - 1, y: dd.y });
// abre todas as portas internas para o teste de movimento
const path = CP.Path.find(startT.x, startT.y, 0, up.x, up.y, 1, { doorsPassable: true });
ok(path && path.length && path[path.length - 1].z === 1, 'A* acha caminho até o 2º andar (' + (path ? path.length : 0) + ' passos)');
// um zumbi segue esse caminho de verdade
clearZombies();
for (const ch of W.allChunks()) for (const k in ch.edges) { const e = ch.edges[k]; if (e && !e.ext) { e.open = true; } }
const z6 = CP.Zombies.fromData(Object.assign(CP.Zombies.makeData(new U.Rng(14), startT.x + 0.5, startT.y + 0.5, 0), { crawler: false, fakeDead: false, hp: 50 }));
z6.target = { x: up.x + 0.5, y: up.y + 0.5, z: 1 }; z6.memT = 999; z6.state = 'investigate';
G.zombies.push(z6);
p.x = open.x; p.y = open.y; p.z = 0;
for (let i = 0; i < 80 * 30 && !(z6.z >= 0.999 && !W.stairAt(Math.floor(z6.x), Math.floor(z6.y))); i++) { G.tick(1 / 30, 1); z6.memT = 999; if (z6.state === 'idle' || z6.state === 'wander') { z6.state = 'investigate'; z6.target = { x: up.x + 0.5, y: up.y + 0.5, z: 1 }; } }
ok(z6.z >= 0.999 && !W.stairAt(Math.floor(z6.x), Math.floor(z6.y)), 'zumbi subiu a escada e chegou ao andar de cima (z=' + z6.z.toFixed(2) + ', estado ' + z6.state + ')');

/* ---------- necessidades ao longo de um dia ---------- */
clearZombies();
p.x = open.x; p.y = open.y; p.z = 0;
const s0 = Object.assign({}, p.body.stats);
const t0 = G.state.time;
for (let i = 0; i < 24 * 60; i++) { CP.Body.update(p, 0.05, 60); G.state.time += 60; }
ok(p.body.stats.hunger > s0.hunger + 0.5, 'fome sobe em 24h (' + s0.hunger.toFixed(2) + '→' + p.body.stats.hunger.toFixed(2) + ')');
ok(p.body.stats.thirst > 0.84 || p.body.stats.thirst > s0.thirst + 0.8, 'sede sobe em 24h (' + p.body.stats.thirst.toFixed(2) + ')');
ok(p.body.stats.fatigue > 0.8, 'cansaço sobe em 24h (' + p.body.stats.fatigue.toFixed(2) + ')');
// comer e beber
p.body.stats.hunger = 0.6; p.body.stats.thirst = 0.6;
const can = CP.Items.make('beans_open'); CP.Items.Inv.give(p, can);
CP.Use.eat(p, can, 1); tick(6);
ok(p.body.stats.hunger < 0.6, 'comer reduz a fome (' + p.body.stats.hunger.toFixed(2) + ')');
const wb = CP.Items.make('water_bottle'); CP.Items.Inv.give(p, wb);
CP.Use.drink(p, wb); tick(3);
ok(p.body.stats.thirst < 0.6 && wb.uses === 3, 'beber reduz a sede e gasta um gole');
// dormir
p.body.stats.fatigue = 0.8;
const slept = CP.Body.sleep(p, 1);
ok(slept && p.sleeping, 'consegue dormir cansado');
let guard = 0;
while (p.sleeping && guard++ < 20000) { G.tick(1 / 30, C.SLEEP_SPEED); }
ok(!p.sleeping && p.body.stats.fatigue < 0.2, 'acordou descansado (cansaço ' + p.body.stats.fatigue.toFixed(2) + ')');

/* ---------- curativo para sangramento ---------- */
p.body.health = 100;
CP.Body.addWound(p, 'farmL', 'laceration', { bleeding: true });
ok(CP.Body.bleeding(p) > 0, 'corte sangra');
CP.Items.Inv.give(p, CP.Items.make('bandage'));
CP.Use.treat(p, 'farmL', 'bandage'); tick(8);
ok(p.body.parts.farmL.wounds[0].bandage, 'curativo aplicado');

/* ---------- infecção mata em 2-3 dias ---------- */
p.body.infection = null;
CP.Body.infect(p);
const infDur = p.body.infection.dur;
ok(infDur >= 48 && infDur <= 72 * 1.3, 'duração da infecção ' + infDur.toFixed(1) + 'h');
for (let i = 0; i < 4 * 24 * 60 && !p.dead; i++) { G.state.time += 60; CP.Body.update(p, 0.05, 60); p.body.stats.hunger = 0.1; p.body.stats.thirst = 0.1; }
ok(p.dead && /infec/.test(p.deathCause), 'morreu pela infecção: "' + p.deathCause + '"');

/* ---------- loot ---------- */
let filled = 0, total = 0;
for (const ch of W.allChunks()) { for (let i = 0; i < 1024; i++) { const o = ch.levels[0].obj[i]; if (o && C.OBJ_INFO[o].cap) { total++; const x = ch.cx * 32 + (i % 32), y = ch.cy * 32 + Math.floor(i / 32); const c = W.container(x, y, 0); if (c.items.length) filled++; } } }
ok(total > 50 && filled / total > 0.3, 'recipientes com loot: ' + filled + '/' + total);

/* ---------- serialização ---------- */
const sChunk = CP.Save.serializeChunk(W.allChunks()[0]);
let cloneOk = true;
try { structuredClone(sChunk); } catch (e) { cloneOk = false; console.log(e.message); }
ok(cloneOk, 'chunk serializável (structured clone)');

console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nOK simulação');
process.exit(fails ? 1 : 0);
