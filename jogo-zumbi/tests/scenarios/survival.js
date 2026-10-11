/* Armadilhas (vazia e com bicho), modo de busca com achados marcados, exercícios e prato montado. */
module.exports = async (page, shot, log) => {
  await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W, C = CP.C, F = C.FLOOR;
    document.getElementById('toasts').style.display = 'none';
    G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    G.state.world.weather = { type: 'clear', until: CP.Time.hours() + 50 };
    let spot = null;
    for (let r = 2; r < 80 && !spot; r++) for (let a = 0; a < 24 && !spot; a++) {
      const x = Math.floor(p.x + Math.cos(a / 24 * 6.28) * r), y = Math.floor(p.y + Math.sin(a / 24 * 6.28) * r);
      let ok = true; for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2 && ok; dx++) { const f = W.floor(x + dx, y + dy, 0); if (!(f === F.GRASS || f === F.DARKGRASS || f === F.DIRT) || W.obj(x + dx, y + dy, 0) || W.isIndoor(x + dx, y + dy, 0) || W.wn(x + dx, y + dy, 0) || W.ww(x + dx, y + dy, 0)) ok = false; }
      if (ok) spot = { x, y };
    }
    p.x = spot.x + 0.5; p.y = spot.y + 0.5;
    const ch = W.chunkAt(spot.x, spot.y); ch.traps = ch.traps || {};
    const set = (x, y, o, caught) => { W.lvl(x, y, 0).obj[W.idx(x, y)] = o; W.lvl(x, y, 0).odir[W.idx(x, y)] = caught ? 1 : 0; ch.traps[W.key(x, y, 0)] = { kind: o === C.OBJ.TRAP_BOX ? 'box' : 'snare', bait: caught ? null : 'worm', catch: caught ? 'dead_rabbit' : null }; };
    set(spot.x + 1, spot.y - 1, C.OBJ.TRAP_BOX, false); set(spot.x + 2, spot.y, C.OBJ.TRAP_BOX, true);
    set(spot.x - 1, spot.y + 1, C.OBJ.TRAP_SNARE, false); set(spot.x, spot.y + 2, C.OBJ.TRAP_SNARE, true);
    CP.Render.setZoomIndex(6); CP.Render.camX = p.x; CP.Render.camY = p.y; p.ang = 0.8; G.updateFov(true);
    p.skills.foraging = 10; p.searching = true;
    for (let i = 0; i < 30; i++) CP.Surv.searchStep(p);
  });
  await page.waitForTimeout(1000);
  await shot('armadilhas-busca');
  log('achados', await page.evaluate(() => CP.Surv.marks.length));
  // exercícios
  for (const ex of [0, 1, 3]) {
    await page.evaluate((i) => { const p = CP.Game.player; p.searching = false; p.body.stats.endurance = 1; p.body.strain = null; CP.Actions.cancel(p); CP.Surv.exercise(p, CP.Surv.EXERCISES[i]); CP.Render.setZoomIndex(6); }, ex);
    await page.waitForTimeout(900);
    await shot('exercicio-' + ex);
  }
};
