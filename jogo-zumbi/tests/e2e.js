/* Teste ponta a ponta no Chromium via file://. Uso: node tests/e2e.js [pasta-de-screenshots] */
'use strict';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.argv[2] || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
function ok(c, m) { if (!c) { fails++; console.log('FALHA:', m); } else { console.log('ok  -', m); } }

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(800);
  // menu → criação
  await page.click('[data-a="menu-new"]');
  await page.waitForTimeout(300);
  ok(await page.$('.create'), 'tela de criação aberta');
  // escolhe ocupação e traços
  await page.click('[data-a="occ"][data-id="lumberjack"]');
  await page.click('[data-a="trait"][data-id="strong"]');
  await page.click('[data-a="trait"][data-id="smoker"]');
  await page.click('[data-a="trait"][data-id="weakstomach"]');
  await page.click('[data-a="trait"][data-id="clumsy"]');
  let pts = await page.evaluate(() => CP.Player.validate(CP.UI.creation).points);
  ok(pts < 0, 'Forte custa mais que os negativos escolhidos (' + pts + ')');
  await page.click('[data-a="trait"][data-id="obese"]');
  pts = await page.evaluate(() => CP.Player.validate(CP.UI.creation).points);
  ok(pts >= 0, 'com Obeso o saldo fica ≥ 0 (' + pts + ')');
  await page.screenshot({ path: path.join(OUT, '01-criacao.png') });
  await page.fill('[data-a="seed"]', '4242');
  await page.dispatchEvent('[data-a="seed"]', 'change');
  await page.waitForTimeout(200);
  await page.click('[data-a="create-start"]');
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => ({ running: CP.Game.running, screen: CP.UI.screen, x: CP.Game.player.x, y: CP.Game.player.y, indoor: CP.W.isIndoor(Math.floor(CP.Game.player.x), Math.floor(CP.Game.player.y), 0), str: CP.Player.skillLevel(CP.Game.player, 'strength'), axe: CP.Player.skillLevel(CP.Game.player, 'axe'), traits: CP.Game.player.traits, zs: CP.Game.zombies.length }));
  ok(st.running && st.screen === 'game', 'jogo iniciou');
  ok(st.indoor, 'começa dentro de uma casa');
  ok(st.str === 10 && st.axe === 2, 'Força 5 + Lenhador 1 + Forte 4 = 10; machado 2 (' + st.str + ', ' + st.axe + ')');
  ok(st.traits.indexOf('axeman') >= 0, 'traço oculto da ocupação aplicado');
  console.log('   zumbis ativos:', st.zs);
  await page.screenshot({ path: path.join(OUT, '02-inicio.png') });
  // anda pra frente segurando D por 1.2s
  await page.mouse.move(700, 380);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(1200); await page.keyboard.up('KeyD');
  const moved = await page.evaluate(() => [CP.Game.player.x, CP.Game.player.y]);
  ok(Math.abs(moved[0] - st.x) + Math.abs(moved[1] - st.y) > 0.3, 'jogador se moveu (' + moved.map(v => v.toFixed(1)) + ')');
  // painéis
  for (const k of ['KeyI', 'KeyH', 'KeyK', 'KeyB', 'KeyM']) { await page.keyboard.press(k); await page.waitForTimeout(250); }
  const open = await page.evaluate(() => Object.keys(CP.UI.open).filter(k => CP.UI.open[k]));
  ok(open.length === 5, 'cinco painéis abrem (' + open.join(',') + ')');
  await page.screenshot({ path: path.join(OUT, '03-paineis.png') });
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(80); }
  // inventário sozinho
  await page.keyboard.press('KeyI'); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '04-inventario.png') });
  await page.keyboard.press('KeyI');
  // menu de contexto no chão perto do jogador
  const scr = await page.evaluate(() => { const p = CP.Game.player; const s = CP.Render.toScreen(p.x + 0.8, p.y, p.z); return s; });
  await page.mouse.click(scr.x, scr.y, { button: 'right' });
  await page.waitForTimeout(300);
  ok(await page.$('.ctx'), 'menu de contexto aparece');
  await page.screenshot({ path: path.join(OUT, '05-contexto.png') });
  await page.keyboard.press('Escape');
  // simula 10 segundos de jogo e salva
  await page.waitForTimeout(3000);
  const saved = await page.evaluate(() => CP.Save.save());
  ok(saved === true, 'salvou no IndexedDB');
  const fps = await page.evaluate(() => CP.Game.fps);
  console.log('   FPS:', fps, ' render ms:', await page.evaluate(() => CP.Render.stats.ms.toFixed(1)));
  // recarrega e continua
  await page.reload();
  await page.waitForTimeout(1200);
  const contEnabled = await page.evaluate(() => !document.getElementById('btn-continue').disabled);
  ok(contEnabled, 'botão Continuar habilitado depois de recarregar');
  await page.click('[data-a="menu-continue"]');
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ screen: CP.UI.screen, x: CP.Game.player.x, y: CP.Game.player.y, name: CP.Game.player.name, str: CP.Player.skillLevel(CP.Game.player, 'strength') }));
  ok(after.screen === 'game' && Math.abs(after.x - moved[0]) < 3 && after.str === 10, 'carregou o jogo salvo no mesmo lugar (' + after.name + ' ' + JSON.stringify(after) + ' vs ' + moved + ')');
  await page.screenshot({ path: path.join(OUT, '06-carregado.png') });
  ok(errors.length === 0, 'sem erros no console' + (errors.length ? ':\n  ' + errors.slice(0, 8).join('\n  ') : ''));
  await browser.close();
  console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nE2E OK');
  process.exit(fails ? 1 : 0);
})();
