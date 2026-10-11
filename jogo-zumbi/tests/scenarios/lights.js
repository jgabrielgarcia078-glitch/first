/* Noite com energia: janelas acesas vistas da rua, cortinas abertas/fechadas, interruptor por dentro. */
module.exports = async (page, shot, log) => {
  await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W;
    document.getElementById('toasts').style.display = 'none';
    G.state.world.powerOffDay = 999;
    G.state.time = Math.ceil(G.state.time / 86400) * 86400 + (22 - CP.C.START_HOUR) * 3600;
    G.state.world.weather = { type: 'clear', until: CP.Time.hours() + 50 };
    for (const k in G.activeChunks) for (const r of G.activeChunks[k].rooms) if (r) r.lit = Math.random() < 0.6;
    const b = W.building(Math.floor(p.x), Math.floor(p.y), 0); const d = b.door;
    p.x = d.x + 0.5 + (d.side === 1 ? (W.isIndoor(d.x, d.y, 0) ? -5 : 5) : 2); p.y = d.y + 0.5 + (d.side === 0 ? (W.isIndoor(d.x, d.y, 0) ? -5 : 5) : 2);
    G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    CP.Render.setZoomIndex(3); CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
  });
  await page.waitForTimeout(1500);
  await shot('noite-janelas-acesas');
  const inside = await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W;
    const b = W.building(Math.floor(p.x), Math.floor(p.y), 0) || (() => { for (const k in G.activeChunks) for (const bb of G.activeChunks[k].buildings) if (bb.kind === 'house') return bb; })();
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (W.isIndoor(x, y, 0) && W.tileWalkable(x, y, 0) && !W.obj(x, y, 0)) { p.x = x + 0.5; p.y = y + 0.5; const rm = W.room(x, y, 0); rm.lit = true; CP.Render.setZoomIndex(5); CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true); return true; }
    return false;
  });
  log('dentro', inside);
  await page.waitForTimeout(800);
  await shot('dentro-luz-acesa');
  await page.evaluate(() => { const p = CP.Game.player; const o = CP.Actions.contextOptions(p, p.x, p.y).find(x => /Apagar a luz/.test(x.label)); if (o) o.fn(); });
  await page.waitForTimeout(800);
  await shot('dentro-luz-apagada');
};
