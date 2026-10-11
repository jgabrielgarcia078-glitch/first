/* Micro-ondas no balcão da cozinha e carro blindado com chapas. */
module.exports = async (page, shot, log) => {
  const r = await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W, O = CP.C.OBJ; document.getElementById('toasts').style.display = 'none';
    G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    G.state.time = Math.floor(G.state.time / 86400) * 86400 + (12 - CP.C.START_HOUR) * 3600;
    let mc = null;
    for (const ch of W.allChunks()) { if (!ch.active || mc) continue; for (let i = 0; i < 1024 && !mc; i++) { const x = ch.cx * 32 + (i & 31), y = ch.cy * 32 + (i >> 5); if (ch.levels[0].obj[i] === O.COUNTER && CP.Surv.hasMicrowave(x, y, 0)) mc = { x, y }; } }
    if (!mc) return 'sem micro-ondas';
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]]) if (W.tileWalkable(mc.x + dx, mc.y + dy, 0)) { p.x = mc.x + dx + 0.5; p.y = mc.y + dy + 0.5; break; }
    CP.Render.setZoomIndex(5); CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
    return JSON.stringify(mc);
  });
  log('micro', r); await page.waitForTimeout(900); await shot('micro-ondas');
  await page.evaluate(() => {
    const G = CP.Game, p = G.player, V = CP.Vehicles;
    let car = V.active[0]; if (!car) return;
    car.armor = true; p.x = car.x + 2; p.y = car.y + 1.5;
    CP.Render.setZoomIndex(5); CP.Render.camX = car.x; CP.Render.camY = car.y; G.updateFov(true);
  });
  await page.waitForTimeout(900); await shot('carro-blindado');
};
