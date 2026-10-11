/* Chuva com poças, outono com folhas no chão, sangue na parede e corpos em vários estágios de decomposição. */
module.exports = async (page, shot, log) => {
  await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W;
    document.getElementById('toasts').style.display = 'none';
    G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    const b = W.building(Math.floor(p.x), Math.floor(p.y), 0); const d = b.door;
    p.x = d.x + 0.5 + (d.side === 1 ? (W.isIndoor(d.x, d.y, 0) ? -4 : 4) : 1); p.y = d.y + 0.5 + (d.side === 0 ? (W.isIndoor(d.x, d.y, 0) ? -4 : 4) : 1);
    G.state.world.weather = { type: 'rain', until: CP.Time.hours() + 50 }; G.state.world.groundWet = 0.9;
    CP.Render.setZoomIndex(4); CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
  });
  await page.waitForTimeout(1500);
  await shot('chuva-pocas');
  // outono (pula para outubro) sem chuva
  await page.evaluate(() => {
    const G = CP.Game; G.state.world.weather = { type: 'cloudy', until: CP.Time.hours() + 500 }; G.state.world.groundWet = 0.35;
    let n = 0; while (CP.Time.season() !== 'Outono' && n++ < 400) G.state.time += 86400;
  });
  await page.waitForTimeout(1500);
  log('estação', await page.evaluate(() => CP.Time.season()));
  await shot('outono-folhas');
  // corpos de 0, 3, 9 e 20 dias + sangue na parede
  await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W;
    const ch = W.chunkAt(Math.floor(p.x), Math.floor(p.y));
    [0, 3, 9, 20].forEach((days, i) => {
      const lk = CP.Zombies.fromData(CP.Zombies.makeData(new CP.U.Rng(40 + i), p.x, p.y, 0)).look;
      ch.corpses.push({ x: p.x - 1.5 + i * 1.1, y: p.y + 1.2, z: 0, ang: 0.5 + i, look: lk, items: [CP.Items.make('bandage')], t: G.state.time - days * 86400 });
    });
    // sangue nas paredes por perto
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy;
      if (W.wn(x, y, 0) === CP.C.EDGE.WALL && !W.isIndoor(x, y, 0)) { CP.FX.wallBlood(x + 0.5, y + 0.3, 0, -Math.PI / 2); CP.FX.wallBlood(x + 0.5, y + 0.3, 0, -Math.PI / 2); }
      if (W.ww(x, y, 0) === CP.C.EDGE.WALL && !W.isIndoor(x, y, 0)) { CP.FX.wallBlood(x + 0.3, y + 0.5, 0, Math.PI); }
    }
    CP.Render.setZoomIndex(6); G.updateFov(true);
  });
  await page.waitForTimeout(1000);
  await shot('corpos-decomposicao');
};
