module.exports = async (page, shot, log) => {
  const opt = async (wx, wy, text) => {
    const s = await page.evaluate(([x, y]) => { CP.Render.camX = CP.Game.player.x; CP.Render.camY = CP.Game.player.y; return CP.Render.toScreen(x, y, 0); }, [wx, wy]);
    await page.mouse.click(s.x, s.y, { button: 'right' }); await page.waitForTimeout(200);
    const all = await page.evaluate(() => [...document.querySelectorAll('.ctx div')].map(e => e.textContent));
    const el = await page.$('.ctx div[data-a="ctx"]:has-text("' + text + '")');
    if (!el) { log('opção não achada:', text, '| tem:', all.join(' | ')); await page.keyboard.press('Escape'); return false; }
    await el.click(); return true;
  };
  const t = await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W; G.zombies.length = 0;
    ['shovel', 'seeds_carrot', 'plank', 'plank', 'plank', 'pot', 'water_bottle', 'steak', 'generator_item', 'gas_can', 'lighter'].forEach(id => CP.Items.Inv.give(p, CP.Items.make(id, id === 'seeds_carrot' ? { n: 5 } : (id === 'gas_can' ? { fuel: 10 } : null))));
    p.body.stats.hunger = 0.2;
    // acha grama aberta
    for (let r = 4; r < 40; r++) for (let a = 0; a < 32; a++) { const x = Math.floor(p.x + Math.cos(a / 32 * 6.28) * r), y = Math.floor(p.y + Math.sin(a / 32 * 6.28) * r);
      let okk = true; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const f = W.floor(x + dx, y + dy, 0); if (f !== CP.C.FLOOR.GRASS && f !== CP.C.FLOOR.DARKGRASS || W.obj(x + dx, y + dy, 0) || W.isIndoor(x + dx, y + dy, 0) || W.wn(x + dx, y + dy, 0) || W.ww(x + dx, y + dy, 0)) okk = false; }
      if (okk) { p.x = x + 0.5; p.y = y + 0.5; G.updateFov(true); return { x, y }; } }
    return null;
  });
  log('grama em', t);
  // cava canteiro ao lado e planta
  if (await opt(t.x + 1.5, t.y + 0.5, 'Cavar canteiro')) await page.waitForTimeout(6500);
  if (await opt(t.x + 1.5, t.y + 0.5, 'Plantar')) await page.waitForTimeout(3500);
  log('planta:', await page.evaluate(([x, y]) => JSON.stringify(CP.W.chunkAt(x, y).crops[CP.W.key(x, y, 0)]), [t.x + 1, t.y]));
  // fogueira via construção
  await page.evaluate(() => CP.Build.start(CP.D.BUILD.b_campfire));
  const s = await page.evaluate(([x, y]) => CP.Render.toScreen(x, y, 0), [t.x - 0.5, t.y + 0.5]);
  await page.mouse.move(s.x, s.y); await page.waitForTimeout(200);
  await page.mouse.click(s.x, s.y); await page.waitForTimeout(8000);
  await page.evaluate(() => CP.Build.cancel());
  log('fogueira:', await page.evaluate(([x, y]) => CP.W.obj(x, y, 0) === CP.C.OBJ.CAMPFIRE, [t.x - 1, t.y]));
  // cozinha o bife
  await page.keyboard.press('KeyI'); await page.waitForTimeout(300);
  await (await page.$('.item:has-text("Bife")')).click(); await page.waitForTimeout(150);
  await (await page.$('.ctx div:has-text("Cozinhar")')).click(); await page.waitForTimeout(10000);
  log('itens:', await page.evaluate(() => CP.Game.player.inv.map(i => CP.Items.name(i)).join(', ')));
  await page.keyboard.press('KeyI');
  // gerador
  await page.keyboard.press('KeyI'); await page.waitForTimeout(300);
  await (await page.$('.item:has-text("Gerador")')).click(); await page.waitForTimeout(150);
  await (await page.$('.ctx div:has-text("Instalar")')).click(); await page.waitForTimeout(5000);
  await page.keyboard.press('KeyI');
  const g = await page.evaluate(() => { const p = CP.Game.player, W = CP.W; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (W.obj(Math.floor(p.x) + dx, Math.floor(p.y) + dy, 0) === CP.C.OBJ.GENERATOR) return { x: Math.floor(p.x) + dx, y: Math.floor(p.y) + dy }; return null; });
  log('gerador em', g);
  if (g) { if (await opt(g.x + 0.5, g.y + 0.5, 'Abastecer')) await page.waitForTimeout(5000); if (await opt(g.x + 0.5, g.y + 0.5, 'Ligar gerador')) await page.waitForTimeout(500); log('gerador:', await page.evaluate(() => JSON.stringify(CP.Game.state.world.generators))); }
  await shot('sobrevivencia');
};
