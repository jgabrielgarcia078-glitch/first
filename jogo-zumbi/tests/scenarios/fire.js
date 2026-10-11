/* Incêndio se espalhando, casa já queimada, cova, horda chegando e painel de mecânica do carro. */
module.exports = async (page, shot, log) => {
  await page.evaluate(() => { document.getElementById('toasts').style.display = 'none'; CP.Game.state.world.weather = { type: 'clear', until: CP.Time.hours() + 500 }; });
  // incêndio numa casa vizinha
  const info = await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W;
    const home = W.building(Math.floor(p.x), Math.floor(p.y), 0);
    let house = null;
    for (const k in G.activeChunks) for (const b of G.activeChunks[k].buildings) if (b.kind === 'house' && b !== home && !b.story && !house) house = b;
    const d = house.door;
    p.x = d.x + 0.5 + (d.side === 1 ? (W.isIndoor(d.x, d.y, 0) ? -6 : 6) : 0); p.y = d.y + 0.5 + (d.side === 0 ? (W.isIndoor(d.x, d.y, 0) ? -6 : 6) : 0);
    CP.Render.setZoomIndex(2); CP.Render.camX = p.x; CP.Render.camY = p.y;
    CP.Fire.ignite(house.x + 2, house.y + 2, 0, true, 40);
    G.updateFov(true);
    return { x: house.x, y: house.y };
  });
  log('casa', JSON.stringify(info));
  for (let i = 0; i < 5; i++) { await page.evaluate(() => { CP.Game.zombies.length = 0; for (const k in CP.Game.activeChunks) CP.Game.activeChunks[k].zombies.length = 0; }); await page.waitForTimeout(3000); }
  await shot('incendio');
  log('queimando', await page.evaluate(() => CP.Game.state.world.fires.length));
  await page.evaluate(() => { CP.Game.state.world.weather = { type: 'clear', until: CP.Time.hours() + 500 }; CP.Game.state.time += 3600 * 9; });
  await page.waitForTimeout(1500);
  await shot('incendio-noite');
  // casa queimada já no mapa
  const burnt = await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W;
    G.state.time -= 3600 * 9;
    for (let cy = 0; cy < CP.C.WORLD_CHUNKS; cy++) for (let cx = 0; cx < CP.C.WORLD_CHUNKS; cx++) {
      const ch = W.chunkByIndex(cx, cy) || null; if (!ch) continue;
      for (const b of ch.buildings) if (b.story === 'burnt') { const d = b.door; p.x = d.x + 0.5 + (d.side === 1 ? 5 : 2); p.y = d.y + 0.5 + (d.side === 0 ? 5 : 2); CP.Render.camX = p.x; CP.Render.camY = p.y; G.activateChunks(true); G.updateFov(true); return { x: b.x, y: b.y }; }
    }
    // gera mais quarteirões até achar
    for (let r = 0; r < 600; r++) {
      const cx = 4 + (r * 7) % 40, cy = 4 + ((r * 13) >> 2) % 40; const ch = W.ensureChunk(cx, cy);
      for (const b of ch.buildings) if (b.story === 'burnt') { const d = b.door; p.x = d.x + 0.5 + (d.side === 1 ? 5 : 2); p.y = d.y + 0.5 + (d.side === 0 ? 5 : 2); CP.Render.camX = p.x; CP.Render.camY = p.y; G.activateChunks(true); G.updateFov(true); return { x: b.x, y: b.y, gen: true }; }
    }
    return null;
  });
  log('casa queimada', JSON.stringify(burnt));
  await page.waitForTimeout(1500);
  await shot('casa-queimada');
  // horda chegando
  await page.evaluate(() => {
    const G = CP.Game, p = G.player; G.zombies.length = 0;
    G.state.world.horde = null; G.state.world.nextHorde = 0; CP.Horde.update(0.03, 1);
    // põe o jogador numa rua aberta e a horda a ~16 tiles, à vista
    let spot = null;
    for (let r = 0; r < 40 && !spot; r++) for (let a = 0; a < 24 && !spot; a++) {
      const x = Math.floor(p.x + Math.cos(a / 24 * 6.28) * r), y = Math.floor(p.y + Math.sin(a / 24 * 6.28) * r);
      if (CP.W.floor(x, y, 0) === CP.C.FLOOR.ASPHALT && CP.W.floor(x + 16, y, 0) === CP.C.FLOOR.ASPHALT) spot = { x: x + 0.5, y: y + 0.5 };
    }
    if (spot) { p.x = spot.x; p.y = spot.y; }
    G.updateFov(true);
    const h = G.state.world.horde; h.x = p.x + 16; h.y = p.y; CP.Horde.update(0.03, 1);
    CP.Render.setZoomIndex(2); CP.Render.camX = p.x + 6; CP.Render.camY = p.y; p.ang = 0; G.updateFov(true);
  });
  await page.waitForTimeout(2500);
  await shot('horda');
  log('zumbis da horda', await page.evaluate(() => CP.Game.zombies.length));
  // painel de mecânica
  const car = await page.evaluate(() => {
    const G = CP.Game, p = G.player; G.zombies.length = 0;
    G.activateChunks(true);
    const c = CP.Vehicles.active[0]; if (!c) return null;
    p.x = c.x + 1.6; p.y = c.y; CP.Render.camX = p.x; CP.Render.camY = p.y; CP.Render.setZoomIndex(5);
    CP.Items.Inv.give(p, CP.Items.make('wrench')); CP.Items.Inv.give(p, CP.Items.make('screwdriver'));
    const pt = CP.Vehicles.parts(c); pt.tireFL = 0; pt.tireRR = null;
    CP.UI.openMechanics(c); G.updateFov(true);
    return { x: c.x, y: c.y };
  });
  log('carro', JSON.stringify(car));
  await page.waitForTimeout(800);
  await shot('mecanica');
};
