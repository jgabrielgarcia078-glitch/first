/* Inicia um jogo pela interface e executa um roteiro de passos, tirando screenshots.
 * Uso: node tests/play.js roteiro.js pasta-saida   (roteiro exporta async function(page, shot, log)) */
'use strict';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const script = require(path.resolve(process.argv[2]));
  const out = process.argv[3] || '/tmp/out';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(600);
  await page.evaluate(() => new Promise((res) => { if (CP.Save.db) { CP.Save.db.close(); CP.Save.db = null; } const r = indexedDB.deleteDatabase('condado-perdido'); r.onsuccess = r.onerror = r.onblocked = () => res(); }));
  await page.reload();
  await page.waitForTimeout(600);
  await page.click('[data-a="menu-new"]');
  await page.waitForTimeout(200);
  if (process.env.SEED) { await page.fill('[data-a="seed"]', process.env.SEED); await page.dispatchEvent('[data-a="seed"]', 'change'); await page.waitForTimeout(100); }
  if (process.env.OCC) { await page.click('[data-a="occ"][data-id="' + process.env.OCC + '"]'); }
  await page.click('[data-a="create-start"]');
  await page.waitForTimeout(1200);
  let n = 0;
  const shot = async (name) => { n++; const f = path.join(out, String(n).padStart(2, '0') + '-' + name + '.png'); await page.screenshot({ path: f }); console.log('screenshot', f); };
  const log = (...a) => console.log(...a);
  try { await script(page, shot, log); } catch (e) { console.log('ERRO no roteiro:', e.message); }
  console.log(errors.length ? 'ERROS:\n' + errors.join('\n') : 'sem erros no console');
  await browser.close();
})();
