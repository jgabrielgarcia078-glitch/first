module.exports = async (page, shot, log) => {
  await page.evaluate(() => {
    const G = CP.Game, p = G.player;
    G.zombies.length = 0;
    const bat = CP.Items.make('bat'); CP.Use.equip(p, bat, 'hand1');
    const zd = CP.Zombies.makeData(new CP.U.Rng(1), p.x + 0.9, p.y, 0); zd.crawler = false; zd.fakeDead = false;
    const z = CP.Zombies.fromData(zd); z.state = 'idle'; G.zombies.push(z); window._z = z;
  });
  const t = await page.evaluate(() => CP.Render.toScreen(_z.x, _z.y, 0));
  await page.mouse.move(t.x, t.y - 20);
  await page.mouse.down();
  await page.waitForTimeout(50);
  log(await page.evaluate(() => ({ left: CP.Input.mouse.left, anim: CP.Game.player.anim.attack, cd: CP.Game.player.attackCd, guard: CP.Game.player.uiClickGuard, action: !!CP.Game.player.action, hp: _z.hp, paused: CP.Game.paused })));
  await page.mouse.up();
  await page.waitForTimeout(1000);
  log(await page.evaluate(() => ({ anim: CP.Game.player.anim.attack, hp: _z.hp, state: _z.state, ang: CP.Game.player.ang, dist: Math.hypot(_z.x - CP.Game.player.x, _z.y - CP.Game.player.y) })));
};
