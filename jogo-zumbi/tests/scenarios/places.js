/* Lugares especiais (escola, prefeitura, hospital, shopping, base militar) e animais vivos no mato. */
module.exports = async (page, shot, log) => {
  const go = (feat) => page.evaluate((feat) => {
    const G = CP.Game, p = G.player, W = CP.W, m = W.macro, N = m.n || Math.round(Math.sqrt(m.feature.length));
    document.getElementById('toasts').style.display = 'none';
    let k = -1; for (let i = 0; i < m.feature.length; i++) if (m.feature[i] === feat) { k = i; break; }
    if (k < 0) return 'sem ' + feat;
    const cs = 1 << W.chunkShift; p.x = (k % N) * cs + 4.5; p.y = ((k / N) | 0) * cs + 4.5; p.z = 0;
    G.activateChunks(true);
    for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy; if (!W.isIndoor(x, y, 0) && W.tileWalkable(x, y, 0) && !W.obj(x, y, 0)) { p.x = x + 0.5; p.y = y + 0.5; r = 99; dy = 99; break; } }
    G.zombies.length = 0; for (const kk in G.activeChunks) G.activeChunks[kk].zombies.length = 0;
    G.state.time = Math.floor(G.state.time / 86400) * 86400 + (12 - CP.C.START_HOUR) * 3600;
    G.state.world.weather = { type: 'clear', until: CP.Time.hours() + 50 };
    CP.Render.setZoomIndex(2); CP.Render.camX = p.x + 8; CP.Render.camY = p.y + 8; G.updateFov(true);
    return 'ok ' + Math.round(p.x) + ',' + Math.round(p.y);
  }, feat);
  for (const [f, n] of [[7, 'escola'], [8, 'prefeitura'], [6, 'hospital'], [9, 'shopping'], [10, 'base-militar']]) {
    log(n, await go(f)); await page.waitForTimeout(900); await shot(n);
  }
  // animais: perto do jogador, no mato
  await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W, An = CP.Anim; An.reset();
    const spots = [];
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy, f = W.floor(x, y, 0); if ((f === CP.C.FLOOR.GRASS || f === CP.C.FLOOR.DARKGRASS || f === CP.C.FLOOR.DIRT) && !W.obj(x, y, 0) && W.tileWalkable(x, y, 0) && Math.abs(dx) + Math.abs(dy) > 2 && CP.Vis.isVisible(x, y, 0)) spots.push([x + 0.5, y + 0.5]); }
    G.updateFov(true); const kinds = ['deer', 'deer', 'rabbit', 'rabbit', 'bird', 'bird', 'bird'];
    kinds.forEach((k, i) => { const s = spots[(i * 7) % spots.length]; if (s) { const a = An.spawn(k, s[0], s[1]); a.state = 'graze'; a.t = 99; a.male = i === 0; } });
    p.sneaking = true; CP.Anim.update = () => {}; // congela para a foto
    CP.Render.setZoomIndex(5); CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
  });
  await page.waitForTimeout(900);
  await shot('animais');
};
