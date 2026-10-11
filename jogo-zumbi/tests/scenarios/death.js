/* Morrer infectado: levanta como zumbi com as coisas; "Novo sobrevivente neste mundo" continua o mesmo mundo;
 * salvar, recarregar e "Continuar o mundo" depois de morrer de novo. */
module.exports = async (page, shot, log) => {
  const fail = [];
  const info0 = await page.evaluate(() => {
    const G = CP.Game, p = G.player;
    document.getElementById('toasts').style.display = 'none';
    G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    CP.Items.Inv.give(p, CP.Items.make('hammer')); CP.Items.Inv.give(p, CP.Items.make('beans'));
    G.state.time += 3600 * 30;
    return { seed: G.state.seed, time: G.state.time, x: p.x, y: p.y, name: p.name, items: CP.Body.belongings(p).length };
  });
  await page.evaluate(() => { CP.Body.die(CP.Game.player, 'Morreu de infecção'); });
  await page.waitForTimeout(2600);
  await shot('morte');
  const z = await page.evaluate(() => { const zb = CP.Game.zombies.find(z => z.data && z.data.player); return zb ? { carry: zb.data.carry.length, look: !!zb.data.look, name: zb.data.player } : null; });
  log('zumbi do jogador', JSON.stringify(z));
  if (!z || z.carry < info0.items) fail.push('zumbi não levou os pertences');
  const btn = await page.$('[data-a="menu-sameworld"]');
  if (!btn) fail.push('sem botão de novo sobrevivente neste mundo');
  else {
    await btn.click(); await page.waitForTimeout(400);
    await shot('criacao-mesmo-mundo');
    const hasSeed = await page.evaluate(() => !!document.querySelector('[data-a="seed"]'));
    if (hasSeed) fail.push('mesmo mundo não deveria mostrar a semente');
    await page.click('[data-a="create-start"]'); await page.waitForTimeout(1500);
    const info1 = await page.evaluate(() => ({ seed: CP.Game.state.seed, time: CP.Game.state.time, name: CP.Game.player.name, dead: CP.Game.player.dead, running: CP.Game.running }));
    log('novo sobrevivente', JSON.stringify(info1));
    if (info1.seed !== info0.seed || info1.time < info0.time || info1.dead || !info1.running) fail.push('não continuou no mesmo mundo');
    // o zumbi antigo continua no mundo (ativo ou guardado no chunk) com as coisas
    const found = await page.evaluate((pos) => {
      const W = CP.W; let n = 0;
      CP.Game.zombies.forEach(z => { if (z.data && z.data.player) n++; });
      const ch = W.chunkAt(Math.floor(pos.x), Math.floor(pos.y)); if (ch) ch.zombies.forEach(d => { if (d.player) n++; });
      return n;
    }, info0);
    log('zumbi antigo no mundo', found);
    if (!found) fail.push('o zumbi do sobrevivente anterior sumiu');
    await shot('novo-sobrevivente');
    // salva, morre sem infecção (vira corpo), vai ao menu e continua pelo menu
    await page.evaluate(() => CP.Save.save()); await page.waitForTimeout(500);
    await page.evaluate(() => { CP.Body.die(CP.Game.player, 'Morreu de fome'); });
    await page.waitForTimeout(2600);
    const corpse = await page.evaluate(() => { const p = CP.Game.player, ch = CP.W.chunkAt(Math.floor(p.x), Math.floor(p.y)); const c = ch.corpses.find(c => c.player === p.name); return c ? c.items.length : -1; });
    log('corpo com itens', corpse);
    if (corpse < 1) fail.push('corpo não ficou com os itens');
    await page.waitForTimeout(800);
    await page.reload(); await page.waitForTimeout(1200);
    const label = await page.evaluate(() => { const b = document.getElementById('btn-continue'); return b ? b.textContent + (b.disabled ? ' [desab]' : '') : ''; });
    log('menu', label);
    if (!/novo sobrevivente/.test(label)) fail.push('menu não oferece continuar o mundo');
    await page.click('#btn-continue'); await page.waitForTimeout(1500);
    const cr = await page.evaluate(() => ({ screen: CP.UI.screen, same: !!(CP.UI.creation && CP.UI.creation.sameWorld) }));
    log('depois de continuar', JSON.stringify(cr));
    if (cr.screen !== 'create' || !cr.same) fail.push('continuar não abriu a criação no mesmo mundo');
    await page.click('[data-a="create-start"]'); await page.waitForTimeout(1500);
    const info2 = await page.evaluate(() => ({ seed: CP.Game.state.seed, time: CP.Game.state.time, running: CP.Game.running, dead: CP.Game.player.dead, surv: CP.Game.state.survivors }));
    log('terceiro sobrevivente', JSON.stringify(info2));
    if (info2.seed !== info0.seed || !info2.running || info2.dead) fail.push('terceiro sobrevivente não entrou no mesmo mundo');
    await shot('terceiro');
  }
  log('FALHAS', fail.length ? fail.join(' | ') : 'nenhuma');
};
