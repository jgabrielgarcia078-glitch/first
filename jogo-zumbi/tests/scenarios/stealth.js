/* Matar por trás (segurando o zumbi), corda de lençol na janela de um sobrado e arrastar um corpo. */
module.exports = async (page, shot, log) => {
  await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W;
    document.getElementById('toasts').style.display = 'none';
    G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    const b = W.building(Math.floor(p.x), Math.floor(p.y), 0); const d = b.door;
    p.x = d.x + 0.5 + (d.side === 1 ? (W.isIndoor(d.x, d.y, 0) ? -4 : 4) : 1); p.y = d.y + 0.5 + (d.side === 0 ? (W.isIndoor(d.x, d.y, 0) ? -4 : 4) : 1);
    const knife = CP.Items.make('knife'); CP.Items.Inv.give(p, knife); CP.Use.equip(p, knife, 'hand1');
    p.sneaking = true; p.ang = 0.6;
    const zd = CP.Zombies.makeData(new CP.U.Rng(55), p.x + Math.cos(0.6) * 0.75, p.y + Math.sin(0.6) * 0.75, 0); zd.crawler = false; zd.fakeDead = false;
    const z = CP.Zombies.fromData(zd); z.state = 'idle'; z.idleT = 999; z.ang = 0.6; G.zombies.push(z); CP.Zombies.rebuildHash();
    CP.Render.setZoomIndex(6); CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
    G.state.world.weather = { type: 'clear', until: CP.Time.hours() + 50 };
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => { CP.Game.player.uiClickGuard = false; CP.Input.mouse.left = true; });
  await page.waitForTimeout(120);
  await page.evaluate(() => { CP.Input.mouse.left = false; });
  await page.waitForTimeout(350);
  await shot('segurando-zumbi');
  log('estado', await page.evaluate(() => (CP.Game.player.stealth ? 'segurando' : 'livre') + ' zumbis ' + CP.Game.zombies.length));
  await page.waitForTimeout(1500);
  log('depois', await page.evaluate(() => 'zumbis ' + CP.Game.zombies.length + ' mortos ' + CP.Game.player.kills));
  // arrastar o corpo
  await page.evaluate(() => { const G = CP.Game, p = G.player; const ch = CP.W.chunkAt(Math.floor(p.x), Math.floor(p.y)); const c = ch.corpses[ch.corpses.length - 1]; CP.Actions.grabCorpse(p, c, ch); p.sneaking = false; });
  await page.keyboard.down('KeyS'); await page.waitForTimeout(1300); await page.keyboard.up('KeyS');
  await shot('arrastando-corpo');
  await page.evaluate(() => CP.Actions.dropCorpse(CP.Game.player));
  // corda de lençol num sobrado
  const r = await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W, C = CP.C;
    for (const k in G.activeChunks) { const c2 = G.activeChunks[k];
      for (const key in c2.edges) {
        const kk = +key, side = kk % 2, rest = (kk - side) / 2, z = Math.floor(rest / 1024), ix = rest % 1024;
        if (z !== 1) continue;
        const ex = c2.cx * 32 + (ix & 31), ey = c2.cy * 32 + (ix >> 5);
        if (W.edgeType(ex, ey, 1, side) !== C.EDGE.WINDOW) continue;
        const inA = W.isIndoor(ex, ey, 1); if (inA) continue; // a face de fora virada para a câmera
        const outs = { x: ex, y: ey };
        if (!W.tileWalkable(outs.x, outs.y, 0) || W.isIndoor(outs.x, outs.y, 0)) continue;
        const st = c2.edges[key]; st.open = true; st.bar = 0; st.rope = true;
        p.x = outs.x + 0.5 + (side === 1 ? 1.2 : 0.8); p.y = outs.y + 0.5 + (side === 0 ? 1.2 : 0.8); p.z = 0;
        CP.Render.setZoomIndex(5); CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
        return { ex, ey, side };
      }
    }
    return null;
  });
  log('janela com corda', JSON.stringify(r));
  await page.waitForTimeout(700);
  await shot('corda-de-lencol');
};
