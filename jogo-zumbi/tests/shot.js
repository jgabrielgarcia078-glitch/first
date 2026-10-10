/* Abre o jogo via file:// no Chromium, executa passos e tira screenshot.
 * Uso: node tests/shot.js saida.png "[js para avaliar]" [ms de espera] */
'use strict';
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || 'shot.png';
  const script = process.argv[3] || '';
  const wait = Number(process.argv[4] || 1500);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); else if (process.env.LOG) console.log('log:', m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  const url = 'file://' + path.join(__dirname, '..', 'index.html') + (process.env.Q || '');
  await page.goto(url);
  await page.waitForTimeout(wait);
  if (script) {
    const r = await page.evaluate(script);
    if (r !== undefined) console.log('resultado:', typeof r === 'string' ? r : JSON.stringify(r));
    await page.waitForTimeout(Number(process.env.AFTER || 600));
  }
  await page.screenshot({ path: out });
  console.log(errors.length ? errors.join('\n') : 'sem erros no console');
  await browser.close();
})();
