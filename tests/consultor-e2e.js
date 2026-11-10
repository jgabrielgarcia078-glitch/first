const { chromium } = require('playwright');
// Uso: node tests/consultor-e2e.js   (abre consultor.html via file:// no Chromium do Playwright)
const fs = require('fs'), path = require('path'), os = require('os');
const FILE = 'file://' + path.join(__dirname, '..', 'consultor.html');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'consultor-e2e-'));
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log(' FALHOU:', name, extra === undefined ? '' : '-> ' + extra); } };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const go = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(60); };
  const kpi = async n => (await page.locator('#toolResults .kpi-v').nth(n).innerText()).trim();
  const setField = async (k, v) => { const el = page.locator('#toolForm [data-k="' + k + '"]:not([data-row])'); await el.fill(String(v)); await el.blur(); await page.waitForTimeout(80); };

  await page.goto(FILE);
  await page.waitForSelector('.tcard');
  ok('marca na barra lateral', (await page.locator('#brandBox').innerText()).includes('GARCIA'));

  // 0. todas as ferramentas abrem com o exemplo, sem erro e sem número inválido
  const hrefs = await page.$$eval('.nav a[href^="#/t/"]', as => as.map(a => a.getAttribute('href')));
  ok('13 ferramentas no menu', hrefs.length === 13, hrefs.length);
  for (const h of hrefs) {
    await go(h);
    await page.waitForSelector('#toolResults .insight');
    const txt = await page.$eval('#toolResults', el => el.innerText);
    ok('ferramenta ' + h + ' sem NaN/undefined', !/NaN|undefined|Infinity|null/.test(txt));
    ok('ferramenta ' + h + ' não estoura a largura', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  }

  // 1. juros no rascunho: número da tela = número do teste de fórmula
  await go('#/t/juros');
  ok('juros: KPI confere com a fórmula fechada', (await kpi(0)) === 'R$ 705.204', await kpi(0));
  await setField('aporte', '2.000');
  ok('juros: recalcula ao digitar', (await kpi(0)) !== 'R$ 705.204', await kpi(0));
  ok('juros: campo formatado ao sair', (await page.locator('#toolForm [data-k="aporte"]').inputValue()) === '2.000');
  await setField('taxa', '12,5');
  ok('juros: aceita vírgula decimal', (await page.locator('#toolForm [data-k="taxa"]').inputValue()) === '12,5');
  const rascunho = await kpi(0);

  // 2. cliente: criar, selecionar, dados separados do rascunho
  await go('#/clientes');
  await page.click('[data-act="client-new"]');
  await page.fill('[data-k="c_nome"]', 'Marina Alves');
  await page.fill('[data-k="c_idade"]', '45');
  await page.fill('[data-k="c_renda"]', '30000');
  await page.fill('[data-k="c_despesas"]', '18000');
  await page.fill('[data-k="c_patrimonio"]', '900000');
  await page.fill('[data-k="c_aporte"]', '6000');
  await page.click('[data-m="ok"]');
  await page.waitForTimeout(100);
  ok('cliente criado e selecionado', (await page.locator('#clientSelect option:checked').innerText()) === 'Marina Alves');
  await go('#/t/juros');
  ok('cliente: aporte vem da ficha', (await page.locator('#toolForm [data-k="aporte"]').inputValue()) === '6.000');
  ok('cliente: não herda o rascunho', (await kpi(0)) !== rascunho);
  await go('#/t/indep');
  ok('cliente: idade vem da ficha', (await page.locator('#toolForm [data-k="idade"]').inputValue()) === '45');
  ok('cliente: patrimônio vem da ficha', (await page.locator('#toolForm [data-k="patrimonio"]').inputValue()) === '900.000');
  await setField('idadeApos', '62');
  const indepKpi = await kpi(0);

  // 3. perfil de risco
  await go('#/t/risco');
  ok('risco: começa incompleto', (await kpi(0)) === '0 de 8');
  for (let q = 1; q <= 8; q++) await page.click('[data-act="choice"][data-k="q' + q + '"][data-v="2"]');
  await page.waitForTimeout(100);
  ok('risco: perfil arrojado com todas as respostas no nível 2', (await kpi(0)) === 'Arrojado', await kpi(0));
  ok('risco: destaca a linha do perfil', (await page.locator('#toolResults tr.best td').first().innerText()).includes('Arrojado'));

  // 4. alocação: carteira-modelo e alerta de soma
  await go('#/t/alocacao');
  await page.click('[data-act="preset"][data-v="agressivo"]');
  await page.waitForTimeout(100);
  ok('alocação: carteira-modelo preenche os alvos', (await page.locator('#toolForm [data-row="4"][data-col="alvo"]').inputValue()) === '30');
  const alvo0 = page.locator('#toolForm [data-row="0"][data-col="alvo"]');
  await alvo0.fill('50'); await alvo0.blur(); await page.waitForTimeout(100);
  ok('alocação: avisa quando os alvos não somam 100%', (await page.locator('#toolResults .warn-box').count()) === 1);

  // 5. metas: adicionar e remover linha
  await go('#/t/metas');
  const n0 = await page.locator('#toolForm .tr:not(.head)').count();
  await page.click('[data-act="addrow"]');
  ok('metas: adiciona linha', (await page.locator('#toolForm .tr:not(.head)').count()) === n0 + 1);
  await page.locator('[data-act="delrow"]').last().click();
  ok('metas: remove linha', (await page.locator('#toolForm .tr:not(.head)').count()) === n0);

  // 6. sucessão: trocar o estado atualiza a alíquota
  await go('#/t/sucessao');
  await page.selectOption('#toolForm [data-k="uf"]', 'MS');
  await page.waitForTimeout(100);
  ok('sucessão: alíquota de referência do estado', (await page.locator('#toolForm [data-k="aliquota"]').inputValue()) === '6');
  ok('sucessão: ITCMD recalculado', (await kpi(1)) === 'R$ 141.000', await kpi(1));

  // 7. dica e gráfico interativo
  await go('#/t/juros');
  await page.hover('#toolForm .q');
  ok('dica aparece ao passar o mouse', await page.locator('#tip').isVisible());
  const box = await page.locator('#toolResults .chart svg').first().boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.waitForTimeout(50);
  const tipTxt = await page.locator('#tip').innerText();
  ok('gráfico: tooltip com rótulo e séries', /anos/i.test(tipTxt) && /Patrimônio/.test(tipTxt) && /R\$/.test(tipTxt), tipTxt);

  // 8. persistência: recarregar mantém cliente e simulações
  await page.reload();
  await page.waitForSelector('#nav a');
  ok('persistência: cliente continua selecionado', (await page.locator('#clientSelect option:checked').innerText()) === 'Marina Alves');
  await go('#/t/indep');
  ok('persistência: simulação do cliente preservada', (await page.locator('#toolForm [data-k="idadeApos"]').inputValue()) === '62' && (await kpi(0)) === indepKpi);
  await go('#/t/risco');
  ok('persistência: respostas do questionário', (await kpi(0)) === 'Arrojado');
  ok('menu marca ferramentas preenchidas', (await page.locator('#nav .tick').count()) >= 5);

  // 9. relatório
  await go('#/relatorio');
  const secs = await page.locator('.rep-sec').count();
  ok('relatório: uma seção por ferramenta preenchida', secs >= 5, secs);
  ok('relatório: nome do cliente e marca', (await page.locator('.rep-meta').innerText()).includes('Marina Alves') && (await page.locator('.report .brand').innerText()).includes('GARCIA'));
  ok('relatório: aviso legal', (await page.locator('.rep-foot').innerText()).includes('Simulações'));
  await page.locator('[data-act="rep-toggle"]').first().click();
  ok('relatório: ocultar seção', (await page.locator('.rep-sec').count()) === secs - 1);
  await page.locator('[data-act="rep-toggle"]').first().click();
  await page.emulateMedia({ media: 'print' });
  ok('impressão: barra lateral escondida', !(await page.locator('.side').isVisible()));
  await page.emulateMedia({ media: 'screen' });

  // 10. configurações: marca e premissas
  await go('#/config');
  const emp = page.locator('[data-cfg="empresa"]');
  await emp.fill('GARCIA CAPITAL');
  ok('config: marca atualiza na hora', (await page.locator('#brandBox').innerText()).includes('CAPITAL'));
  await emp.fill('GARCIA WEALTH');
  const cdi = page.locator('[data-cfg="premissas.cdi"]');
  await cdi.fill('12'); await cdi.blur();
  await go('#/t/rendafixa');
  ok('config: premissa de CDI chega às ferramentas novas', (await page.locator('#toolForm [data-k="cdi"]:not([data-row])').inputValue()) === '12');

  // 11. exportar, apagar e importar
  await go('#/config');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="export"]')]);
  const file = path.join(TMP, 'backup-test.json'); await dl.saveAs(file);
  const bk = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok('backup: contém o cliente e as simulações', bk.state.clients.length === 1 && Object.keys(bk.state.clients[0].tools).length >= 5);
  await page.click('[data-act="wipe"]');
  await page.click('[data-m="ok"]');
  await page.waitForTimeout(100);
  ok('apagar tudo: sem clientes', (await page.locator('#clientSelect option').count()) === 1);
  await go('#/config');
  await page.setInputFiles('#importFile', file);
  await page.waitForSelector('[data-m="ok"]');
  await page.click('[data-m="ok"]');
  await page.waitForTimeout(100);
  ok('importar: cliente de volta', (await page.locator('#clientSelect option').count()) === 2);
  await page.reload(); await page.waitForSelector('#nav a');
  ok('importar: gravado no banco local', (await page.locator('#clientSelect option:checked').innerText()) === 'Marina Alves');

  // 12. excluir cliente
  await go('#/clientes');
  await page.click('[data-act="client-del"]');
  await page.click('[data-m="ok"]');
  await page.waitForTimeout(100);
  ok('excluir cliente', (await page.locator('.crow').count()) === 0);
  await go('#/t/juros');
  ok('rascunho preservado depois de tudo', (await page.locator('#toolForm [data-k="aporte"]').inputValue()) === '2.000');

  ok('nenhum erro no console', errors.length === 0, errors.join(' | '));
  console.log(pass + ' verificações passaram, ' + fail + ' falharam');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
