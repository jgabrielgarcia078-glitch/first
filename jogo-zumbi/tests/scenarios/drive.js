module.exports = async (page, shot, log) => {
  const car = await page.evaluate(() => {
    const G = CP.Game, p = G.player, V = CP.Vehicles;
    let best = null, bd = 1e9;
    V.active.forEach(c => { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } });
    if (!best) return null;
    best.keyIn = true; best.locked = false; best.fuel = 30; best.cond = 1;
    // fica ao lado do carro
    const s = Math.sin(best.ang), c = Math.cos(best.ang);
    p.x = best.x - s * 1.2; p.y = best.y + c * 1.2;
    if (!CP.W.tileWalkable(Math.floor(p.x), Math.floor(p.y), 0)) { p.x = best.x + s * 1.2; p.y = best.y - c * 1.2; }
    CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
    G.zombies.forEach(z => { if (Math.hypot(z.x - p.x, z.y - p.y) < 8) z.x += 30; });
    window._car = best;
    return { x: best.x, y: best.y, ang: best.ang, n: V.active.length };
  });
  log('carro', car);
  if (!car) return;
  await page.waitForTimeout(400);
  await shot('ao-lado-do-carro');
  const sc = await page.evaluate(() => CP.Render.toScreen(_car.x, _car.y, 0));
  await page.mouse.click(sc.x, sc.y - 10, { button: 'right' }); await page.waitForTimeout(250);
  log('menu:', await page.evaluate(() => [...document.querySelectorAll('.ctx div')].map(e => e.textContent).join(' | ')));
  await shot('menu-carro');
  await (await page.$('.ctx div:has-text("Entrar no carro")')).click();
  await page.waitForTimeout(1600);
  log('dentro:', await page.evaluate(() => !!CP.Game.player.vehicle));
  await page.keyboard.press('KeyG'); await page.waitForTimeout(1600);
  log('motor:', await page.evaluate(() => _car.engine));
  // põe zumbis na frente
  await page.evaluate(() => { const G = CP.Game, c = _car; for (let i = 0; i < 3; i++) { const zd = CP.Zombies.makeData(new CP.U.Rng(50 + i), c.x + Math.cos(c.ang) * (6 + i * 1.5), c.y + Math.sin(c.ang) * (6 + i * 1.5), 0); zd.crawler = false; zd.fakeDead = false; G.zombies.push(CP.Zombies.fromData(zd)); } });
  const start = await page.evaluate(() => [_car.x, _car.y]);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500);
  await shot('dirigindo');
  await page.keyboard.down('KeyD'); await page.waitForTimeout(700); await page.keyboard.up('KeyD');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('Space'); await page.waitForTimeout(1500); await page.keyboard.up('Space');
  const st = await page.evaluate(() => ({ x: _car.x, y: _car.y, speed: _car.speed, fuel: _car.fuel, cond: _car.cond, kills: CP.Game.state.kills }));
  log('depois de dirigir', st, 'andou', Math.hypot(st.x - start[0], st.y - start[1]).toFixed(1), 'tiles');
  await shot('parado');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(500);
  log('saiu:', await page.evaluate(() => !CP.Game.player.vehicle));
  // salvar e carregar mantém o carro
  log('salvou:', await page.evaluate(() => CP.Save.save()));
  await page.reload(); await page.waitForTimeout(1500);
  log('tem save:', await page.evaluate(() => CP.Save.hasSave().then(r => r ? r.meta : null)));
  await page.click('[data-a="menu-continue"]'); await page.waitForTimeout(1500);
  log('carro depois de carregar:', await page.evaluate((s) => { const c = CP.Vehicles.active.filter(c => Math.hypot(c.x - s.x, c.y - s.y) < 0.5)[0]; return c ? { fuel: c.fuel.toFixed(1), cond: c.cond.toFixed(2) } : null; }, st));
  await shot('carregado');
};
