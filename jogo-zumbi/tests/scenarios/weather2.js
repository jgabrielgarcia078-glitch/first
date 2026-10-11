/* Nevasca, raio numa árvore, galhos depois da tempestade, vela dentro de casa e tocha na rua à noite. */
module.exports = async (page, shot, log) => {
  const prep = (fn) => page.evaluate(fn);
  await prep(() => {
    const G = CP.Game, p = G.player, W = CP.W; document.getElementById('toasts').style.display = 'none';
    G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    const b = W.building(Math.floor(p.x), Math.floor(p.y), 0), d = b.door;
    p.x = d.x + 0.5 + (d.side === 1 ? (W.isIndoor(d.x, d.y, 0) ? -4 : 4) : 1); p.y = d.y + 0.5 + (d.side === 0 ? (W.isIndoor(d.x, d.y, 0) ? -4 : 4) : 1);
    G.state.world.weather = { type: 'blizzard', until: CP.Time.hours() + 50 }; G.state.world.snow = 0.8;
    CP.Render.setZoomIndex(3); CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
  });
  await page.waitForTimeout(1500);
  await shot('nevasca');
  await prep(() => { const G = CP.Game; G.state.world.snow = 0; G.state.world.weather = { type: 'storm', until: CP.Time.hours() + 50 }; const hit = CP.Time.lightningStrike(); CP.FX.lightning(); CP.Time.fallenBranches(); G.updateFov(true); window._hit = hit; });
  await page.waitForTimeout(2500);
  log('raio', JSON.stringify(await page.evaluate(() => window._hit)));
  await shot('raio-galhos');
  // noite: vela dentro de casa, sem energia
  await prep(() => {
    const G = CP.Game, p = G.player, W = CP.W;
    G.state.world.fires = []; for (const k in G.activeChunks) G.activeChunks[k].fires = {};
    G.state.world.weather = { type: 'clear', until: CP.Time.hours() + 50 }; G.state.world.powerOffDay = 0;
    G.state.time = Math.ceil(G.state.time / 86400) * 86400 + (23 - CP.C.START_HOUR) * 3600;
    const b = W.building(Math.floor(p.x), Math.floor(p.y), 0) || (() => { for (const k in G.activeChunks) for (const bb of G.activeChunks[k].buildings) if (bb.kind === 'house') return bb; })();
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (W.isIndoor(x, y, 0) && W.tileWalkable(x, y, 0) && !W.obj(x, y, 0)) { p.x = x + 0.5; p.y = y + 0.5; }
    const c = CP.Items.make('candle'); c.on = true; c.burn = 5; CP.Items.Inv.give(p, c); CP.Use.equip(p, c, 'hand2');
    CP.Render.setZoomIndex(5); CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
  });
  await page.waitForTimeout(1200);
  await shot('vela-noite');
  await prep(() => {
    const G = CP.Game, p = G.player; CP.Use.unequip(p, p.hand2);
    const t = CP.Items.make('torch'); t.on = true; t.burn = 1.5; CP.Items.Inv.give(p, t); CP.Use.equip(p, t, 'hand1');
    const W = CP.W, b = W.building(Math.floor(p.x), Math.floor(p.y), 0), d = b.door;
    p.x = d.x + 0.5 + (d.side === 1 ? (W.isIndoor(d.x, d.y, 0) ? -4 : 4) : 1); p.y = d.y + 0.5 + (d.side === 0 ? (W.isIndoor(d.x, d.y, 0) ? -4 : 4) : 1);
    CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
  });
  await page.waitForTimeout(1200);
  await shot('tocha-noite');
};
