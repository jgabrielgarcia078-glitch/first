/* Animações e poses: zumbis comendo, levantando do chão, cambaleando; jogador se debatendo, derrubado; roupa suja e com sangue. */
module.exports = async (page, shot, log) => {
  await page.evaluate(() => {
    const G = CP.Game, p = G.player;
    G.zombies.length = 0;
    for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    const b = CP.W.building(Math.floor(p.x), Math.floor(p.y), 0); const d = b.door;
    p.x = d.x + 0.5 + (d.side === 1 ? (CP.W.isIndoor(d.x, d.y, 0) ? -3 : 3) : 0); p.y = d.y + 0.5 + (d.side === 0 ? (CP.W.isIndoor(d.x, d.y, 0) ? -3 : 3) : 0);
    CP.Render.setZoomIndex(6); CP.Render.camX = p.x; CP.Render.camY = p.y;
    document.getElementById('toasts').style.display = 'none';
    // corpo com 3 zumbis comendo
    const ch = CP.W.chunkAt(Math.floor(p.x), Math.floor(p.y));
    const cx = p.x + 2.2, cy = p.y - 1.2;
    const zd0 = CP.Zombies.makeData(new CP.U.Rng(77), cx, cy, 0); const lk = CP.Zombies.fromData(zd0).look; lk.zombie = false; lk.skin = '#e3b48f';
    ch.corpses.push({ x: cx, y: cy, z: 0, ang: 0.6, look: lk, items: [], t: G.state.time - 3600 * 5 });
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + 0.4; const zd = CP.Zombies.makeData(new CP.U.Rng(300 + i), cx + Math.cos(a) * 0.65, cy + Math.sin(a) * 0.65, 0);
      zd.crawler = false; zd.fakeDead = false; const z = CP.Zombies.fromData(zd); CP.Zombies.startEat(z, { x: cx, y: cy }); G.zombies.push(z);
    }
    p.ang = -0.5; p.sneaking = true;
    G.updateFov(true);
  });
  await page.waitForTimeout(600);
  await shot('comendo');
  log('estados', await page.evaluate(() => CP.Game.zombies.map(z => z.state).join(',')));
  // a sequência de levantar (jogo pausado para segurar cada fase)
  await page.evaluate(() => {
    const G = CP.Game, p = G.player; G.paused = true;
    G.zombies.length = 0;
    [0.95, 0.75, 0.5, 0.3, 0.1].forEach((gt, i) => {
      const zd = CP.Zombies.makeData(new CP.U.Rng(500 + i), p.x - 2 + i * 1.1, p.y + 1.6, 0); zd.crawler = false; zd.fakeDead = false;
      const z = CP.Zombies.fromData(zd); z.state = 'getup'; z.getDur = 1; z.getT = gt; z.ang = 0.8; G.zombies.push(z);
    });
    const zs = CP.Zombies.makeData(new CP.U.Rng(600), p.x + 2.5, p.y + 0.4, 0); zs.crawler = false; zs.fakeDead = false;
    const st = CP.Zombies.fromData(zs); st.state = 'stagger'; st.staggerT = 0.8; st.ang = 2.4; G.zombies.push(st);
    G.updateFov(true);
  });
  await page.waitForTimeout(500);
  await shot('levantando-cambaleando');
  // jogador mordido se debatendo + roupa suja e com sangue
  await page.evaluate(() => {
    const G = CP.Game, p = G.player; G.paused = false; G.zombies.length = 0; p.sneaking = false;
    const top = p.worn.jacket || p.worn.shirt; if (top) { top.blood = 0.8; top.dirt = 0.6; top.holes = 2; }
    if (p.worn.pants) { p.worn.pants.dirt = 0.9; p.worn.pants.blood = 0.5; p.worn.pants.holes = 1; }
    p.anim.struggle = 30; p.ang = 0.7;
  });
  await page.waitForTimeout(400);
  await shot('mordido-roupa-suja');
  log('sujeira', await page.evaluate(() => CP.Body.grime(CP.Game.player).toFixed(2)), 'roupas sujas', await page.evaluate(() => CP.Actions.dirtyClothes(CP.Game.player).length));
  // derrubado pela horda
  await page.evaluate(() => {
    const G = CP.Game, p = G.player; p.anim.struggle = 0;
    for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.3; const zd = CP.Zombies.makeData(new CP.U.Rng(700 + i), p.x + Math.cos(a) * 0.7, p.y + Math.sin(a) * 0.7, 0); zd.crawler = false; zd.fakeDead = false; const z = CP.Zombies.fromData(zd); z.state = 'chase'; z.ang = a + Math.PI; G.zombies.push(z); }
    CP.Zombies.rebuildHash();
    CP.Body.dragDown(p);
  });
  await page.waitForTimeout(1200);
  await shot('derrubado');
  await page.waitForTimeout(2600);
  await shot('devorado');
  log('morto', await page.evaluate(() => CP.Game.player.dead + ' ' + CP.Game.player.deathCause), 'comendo', await page.evaluate(() => CP.Game.zombies.filter(z => z.state === 'eat').length));
};
