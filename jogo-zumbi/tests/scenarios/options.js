/* Diário aberto, menu de pausa com as opções gráficas, troca de tecla (J → U abre o diário) e interface em 130%. */
module.exports = async (page, shot, log) => {
  await page.evaluate(() => {
    const G = CP.Game, p = G.player; G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    CP.Journal.event('Teste: anotação no diário.'); CP.U.emit('zombie:killed', { cause: 'gun' });
    CP.UI.toggle('journal', true);
  });
  await page.waitForTimeout(600); await shot('diario');
  await page.evaluate(() => { CP.UI.toggle('journal', false); CP.UI.toggle('pause', true); });
  await page.waitForTimeout(400); await shot('pausa-opcoes');
  // troca a tecla do diário para U e testa com o teclado de verdade
  const r = await page.evaluate(() => { CP.UI.toggle('pause', false); CP.UI.rebind('KeyJ', 'KeyU'); return JSON.stringify(CP.UI.prefs.binds); });
  log('binds', r);
  await page.keyboard.press('KeyU'); await page.waitForTimeout(300);
  const open1 = await page.evaluate(() => !!CP.UI.open.journal);
  await page.keyboard.press('KeyU'); await page.waitForTimeout(200);
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(300);
  const open2 = await page.evaluate(() => !!CP.UI.open.journal);
  log('U abre o diário', open1, '· J não abre mais', !open2);
  if (!open1 || open2) throw new Error('troca de tecla não funcionou');
  await page.evaluate(() => { CP.UI.prefs.binds = {}; CP.Input.setBinds({}); CP.UI.prefs.uiScale = 1.3; CP.UI.applyPrefs(); CP.UI.toggle('inv', true); });
  await page.waitForTimeout(500); await shot('interface-130');
  await page.evaluate(() => { CP.UI.toggle('inv', false); CP.UI.prefs.uiScale = 1; CP.UI.applyPrefs(); CP.UI.toggle('keys', true); });
  await page.waitForTimeout(300); await shot('teclas');
  await page.evaluate(() => { CP.UI.toggle('keys', false); CP.UI.creation = null; CP.Game.running = false; CP.UI.showCreate(); CP.UI.creation.settings.challenge = 'sixmonths'; });
  await page.evaluate(() => { CP.UI.showCreate(); document.querySelector('details.adv').open = true; });
  await page.evaluate(() => { const cols = document.querySelectorAll('.create .col'); cols[cols.length - 1].scrollTop = 9999; });
  await page.waitForTimeout(500); await shot('criacao-desafio');
  await page.click('[data-a="create-start"]');
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({ day: CP.Time.daysSurvived(), power: CP.Time.powerOn(), ch: CP.Game.settings.challenge, tough: CP.Game.settings.toughness }));
  log('começou', JSON.stringify(st));
  if (Math.floor(st.day) !== 180 || st.power) throw new Error('desafio seis meses não aplicado');
  await shot('seis-meses');
};
