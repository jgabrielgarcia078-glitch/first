/* Bilhetes e cenas: recado preso na porta, pichações nas fachadas, acampamento abandonado e o bilhete aberto. */
module.exports = async (page, shot, log) => {
  await page.evaluate(() => { document.getElementById('toasts').style.display = 'none'; CP.Game.state.world.weather = { type: 'clear', until: CP.Time.hours() + 500 }; });
  const go = (fn, arg) => page.evaluate(([src, a]) => {
    const G = CP.Game, p = G.player, W = CP.W, C = CP.C;
    const f = new Function('G', 'p', 'W', 'C', 'a', src);
    const r = f(G, p, W, C, a);
    G.activateChunks(true); G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
    return r;
  }, [fn, arg]);
  // 1) porta com recado (casa de quem foi embora)
  const door = await go(`
    for (let r = 0; r < 48 * 48; r++) {
      const cx = r % 48, cy = (r / 48) | 0; const ch = W.ensureChunk(cx, cy);
      for (const k in ch.edges) { const st = ch.edges[k]; if (!st || !st.note) continue;
        const key = +k, side = key % 2, ix = ((key - side) / 2) % (C.CHUNK * C.CHUNK);
        const ex = cx * C.CHUNK + (ix & (C.CHUNK - 1)), ey = cy * C.CHUNK + (ix >> 5);
        if (W.isIndoor(ex, ey, 0)) continue; // só portas com a face de fora virada para a câmera
        const out = side === 0 ? (W.isIndoor(ex, ey, 0) ? -1 : 1) : (W.isIndoor(ex, ey, 0) ? -1 : 1);
        p.x = ex + 0.5 + (side === 1 ? out * 1.6 : 0.8); p.y = ey + 0.5 + (side === 0 ? out * 1.6 : 0.8); p.z = 0;
        p.ang = Math.atan2(ey + 0.5 - p.y, ex + 0.5 - p.x);
        CP.Render.setZoomIndex(6);
        return { ex, ey, side, note: st.note };
      }
    }
    return null;`);
  log('porta com recado', JSON.stringify(door));
  await page.waitForTimeout(800);
  await shot('recado-na-porta');
  if (door) {
    await page.evaluate((d) => CP.UI.showNote(d.note, 'Recado na porta'), door);
    await page.waitForTimeout(300);
    await shot('recado-aberto');
    await page.evaluate(() => CP.UI.toggle('note', false));
  }
  // 2) pichações: procura uma fachada com pichação
  const gf = await go(`
    for (let r = 0; r < 48 * 48; r++) {
      const cx = (r * 7) % 48, cy = ((r * 7 / 48) | 0) % 48; const ch = W.ensureChunk(cx, cy);
      for (let i = 0; i < C.CHUNK * C.CHUNK; i++) for (let side = 0; side < 2; side++) {
        const x = cx * C.CHUNK + (i & 31), y = cy * C.CHUNK + (i >> 5);
        const t = CP.Render.graffitiAt(x, y, 0, side);
        if (t && t.length > 4) { p.x = x + 2.5; p.y = y + 2.5; p.z = 0; p.ang = -2.3; CP.Render.setZoomIndex(5); return { x, y, side, t }; }
      }
    }
    return null;`);
  log('pichação', JSON.stringify(gf));
  await page.waitForTimeout(800);
  await shot('pichacao');
  // 3) acampamento abandonado
  const camp = await go(`
    for (let r = 0; r < 48 * 48; r++) {
      const cx = r % 48, cy = (r / 48) | 0; const ch = W.ensureChunk(cx, cy);
      for (let i = 0; i < C.CHUNK * C.CHUNK; i++) if (ch.levels[0].obj[i] === C.OBJ.TENT) {
        const x = cx * C.CHUNK + (i & 31), y = cy * C.CHUNK + (i >> 5);
        p.x = x + 2.5; p.y = y + 4.6; p.z = 0; p.ang = -1.6; CP.Render.setZoomIndex(6); return { x, y };
      }
    }
    return null;`);
  log('acampamento', JSON.stringify(camp));
  await page.waitForTimeout(800);
  await shot('acampamento');
  const n = await page.evaluate(() => { const p = CP.Game.player; const it = [];
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const fi = CP.W.floorItems(Math.floor(p.x) + dx, Math.floor(p.y) + dy, 0); if (fi) fi.forEach(i => it.push(i)); }
    const note = it.find(i => i.id === 'note'); if (note) { note.seen = true; CP.UI.showNote(note.text, 'Bilhete'); } return note ? note.text : null; });
  log('bilhete do acampamento', JSON.stringify(n));
  await page.waitForTimeout(300);
  await shot('bilhete-acampamento');
};
