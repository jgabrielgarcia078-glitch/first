module.exports = async (page, shot, log) => {
  await page.evaluate(() => {
    const G = CP.Game, p = G.player;
    G.zombies.length = 0;
    CP.Render.setZoomIndex(6);
    const bag = CP.Items.make('hiking_bag'); CP.Player.wear(p, bag);
    CP.Use.equip(p, CP.Items.make('axe'), 'hand1');
    // sai pra rua
    const b = CP.W.building(Math.floor(p.x), Math.floor(p.y), 0); const d = b.door;
    p.x = d.x + 0.5 + (d.side === 1 ? (CP.W.isIndoor(d.x, d.y, 0) ? -3 : 3) : 0); p.y = d.y + 0.5 + (d.side === 0 ? (CP.W.isIndoor(d.x, d.y, 0) ? -3 : 3) : 0);
    CP.Render.camX = p.x; CP.Render.camY = p.y;
    for (let i = 0; i < 5; i++) {
      const zd = CP.Zombies.makeData(new CP.U.Rng(200 + i), p.x + 1.5 + i * 0.9, p.y - 1 + (i % 2) * 1.6, 0);
      zd.crawler = i === 4; zd.fakeDead = false;
      const z = CP.Zombies.fromData(zd); z.ang = Math.PI * 0.75; z.state = 'idle'; z.idleT = 999;
      G.zombies.push(z);
    }
    p.ang = 0.3;
    G.updateFov(true);
  });
  await page.waitForTimeout(800);
  await shot('closeup');
};
