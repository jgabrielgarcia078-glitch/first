module.exports = async (page, shot, log) => {
  const r = await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W;
    G.zombies.length = 0;
    // procura escada num raio
    for (let y = Math.floor(p.y) - 100; y < p.y + 100; y++) for (let x = Math.floor(p.x) - 100; x < p.x + 100; x++) {
      const st = W.stairAt(x, y);
      if (st && st.part === 0) {
        W.ensureAround(x, y, 2);
        p.x = x + 0.5; p.y = st.bottom + 0.6; p.z = 0; p.ang = -Math.PI / 2;
        G.activateChunks(true);
        G.zombies.length = 0;
        CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true);
        return { x, y, dir: st.dir, bottom: st.bottom, top: st.top };
      }
    }
    return null;
  });
  log('escada', r);
  if (!r) return;
  await page.waitForTimeout(600);
  await shot('pe-da-escada');
  // sobe: direção "norte" no mundo = (0,-1) → teclas W (−1,−1) + D (+1,−1) juntas
  const keys = r.dir === 0 ? ['KeyW', 'KeyD'] : ['KeyW', 'KeyA'];
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(700);
  await shot('meio-da-escada');
  log(await page.evaluate(() => ({ z: CP.Game.player.z, y: CP.Game.player.y })));
  await page.waitForTimeout(1400);
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => ({ z: CP.Game.player.z, x: CP.Game.player.x, y: CP.Game.player.y }));
  log('final', st);
  await shot('andar-de-cima');
  // desce de novo
  const keys2 = r.dir === 0 ? ['KeyS', 'KeyA'] : ['KeyS', 'KeyD'];
  for (const k of keys2) await page.keyboard.down(k);
  await page.waitForTimeout(2600);
  for (const k of keys2) await page.keyboard.up(k);
  log('desceu', await page.evaluate(() => ({ z: CP.Game.player.z })));
  await shot('desceu');
};
