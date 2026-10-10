module.exports = async (page, shot, log) => {
  // vai para as 22h, dá uma lanterna e liga
  await page.evaluate(() => {
    const G = CP.Game, p = G.player;
    G.state.time += (22 - 9) * 3600;
    const fl = CP.Items.make('flashlight'); CP.Items.Inv.give(p, fl);
    CP.Use.toggleFlashlight(p);
    G.updateFov(true);
  });
  await page.mouse.move(900, 450);
  await page.waitForTimeout(1200);
  await shot('noite-lanterna-dentro');
  // sai de casa
  await page.evaluate(() => { const p = CP.Game.player; const b = CP.W.building(Math.floor(p.x), Math.floor(p.y), 0); const d = b.door; p.x = d.x + 0.5 + (d.side === 1 ? (CP.W.isIndoor(d.x, d.y, 0) ? -3 : 3) : 0); p.y = d.y + 0.5 + (d.side === 0 ? (CP.W.isIndoor(d.x, d.y, 0) ? -3 : 3) : 0); CP.Game.updateFov(true); });
  await page.waitForTimeout(1200);
  await shot('noite-rua');
  // de dia de novo, abre geladeira mais próxima
  const r = await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W;
    G.state.time += 12 * 3600;
    let best = null, bd = 1e9;
    for (let y = Math.floor(p.y) - 25; y < p.y + 25; y++) for (let x = Math.floor(p.x) - 25; x < p.x + 25; x++) { if (W.obj(x, y, 0) === CP.C.OBJ.FRIDGE) { const d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = { x, y }; } } }
    if (!best) return 'sem geladeira';
    // fica no tile livre vizinho
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (W.tileWalkable(best.x + dx, best.y + dy, 0) && !W.blockedBetween(best.x, best.y, best.x + dx, best.y + dy, 0, false)) { p.x = best.x + dx + 0.5; p.y = best.y + dy + 0.5; break; } }
    G.updateFov(true);
    CP.UI.openLoot(best.x, best.y, 0);
    return best;
  });
  log('geladeira', r);
  await page.waitForTimeout(800);
  await shot('saque-geladeira');
  // pega tudo
  await page.click('[data-a="takeall"]').catch(() => log('sem botão pegar tudo'));
  await page.waitForTimeout(4000);
  await shot('depois-de-pegar');
  log(await page.evaluate(() => CP.Game.player.inv.map(i => CP.Items.name(i))));
  // morte
  await page.keyboard.press('Escape');
  await page.evaluate(() => CP.Body.die(CP.Game.player, 'Teste: tropeçou num cadáver'));
  await page.waitForTimeout(2500);
  await shot('morte');
};
