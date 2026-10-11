/* Carregar móveis (de frente e de costas), escada apoiada na parede e jogador em cima do telhado. */
module.exports = async (page, shot, log) => {
  await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W, O = CP.C.OBJ; document.getElementById('toasts').style.display = 'none';
    G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    G.state.time = Math.floor(G.state.time / 86400) * 86400 + (12 - CP.C.START_HOUR) * 3600;
    p.carry = { o: O.WARDROBE, dir: 0, kg: 35, name: 'Guarda-roupa' }; p.ang = 0.8;
    CP.Render.setZoomIndex(5); CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
  });
  await page.waitForTimeout(800); await shot('carregando-frente');
  await page.evaluate(() => { const p = CP.Game.player; p.ang = -2.3; p.carry = { o: CP.C.OBJ.TV, dir: 0, kg: 12, name: 'Televisão' }; });
  await page.waitForTimeout(500); await shot('carregando-costas');
  const r = await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W, O = CP.C.OBJ, E = CP.C.EDGE, F = CP.C.FLOOR; p.carry = null;
    let hs = null; for (const ch of W.allChunks()) { if (!ch.active) continue; for (const b of ch.buildings) if (b.kind === 'house' && b.floors === 1) { hs = b; break; } if (hs) break; }
    let spot = null;
    for (let y = hs.y - 1; y <= hs.y + hs.h && !spot; y++) for (let x = hs.x - 1; x <= hs.x + hs.w && !spot; x++) {
      if (W.isIndoor(x, y, 0) || !W.tileWalkable(x, y, 0) || W.obj(x, y, 0)) continue;
      for (const [dx, dy, dir] of [[0, -1, 2], [-1, 0, 1]]) if (W.isIndoor(x + dx, y + dy, 0) && W.floor(x + dx, y + dy, 1) === F.ROOF && W.edgeType(x, y, 0, dx ? 1 : 0) === E.WALL) { spot = { x, y, dir }; break; }
    }
    if (!spot) return 'sem lugar';
    const l = W.lvl(spot.x, spot.y, 0); l.obj[W.idx(spot.x, spot.y)] = O.LADDER; l.odir[W.idx(spot.x, spot.y)] = spot.dir; W.chunkAt(spot.x, spot.y).dirty = true;
    p.x = spot.x + 1.5; p.y = spot.y + 1.5; p.z = 0; p.ang = -2.3;
    CP.Render.setZoomIndex(4); CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
    window._sp = spot; return JSON.stringify(spot);
  });
  log('escada', r);
  await page.waitForTimeout(800); await shot('escada');
  await page.evaluate(() => {
    const G = CP.Game, p = G.player, s = window._sp, d = [[0, 1], [-1, 0], [0, -1], [1, 0]][s.dir];
    p.x = s.x + d[0] + 0.5; p.y = s.y + d[1] + 0.5; p.z = 1;
    CP.Render.camX = p.x; CP.Render.camY = p.y; CP.Render.camZ = 1; G.updateFov(true);
  });
  await page.waitForTimeout(1000); await shot('telhado');
};
