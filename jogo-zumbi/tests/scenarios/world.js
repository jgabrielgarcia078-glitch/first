/* Mundo vivo: erosão, neve, letreiros/toldos, quintais, outdoor, vento, corvos e moscas. */
module.exports = async (page, shot, log) => {
  const goOut = () => page.evaluate(() => {
    const G = CP.Game, p = G.player;
    const b = CP.W.building(Math.floor(p.x), Math.floor(p.y), 0) || G.homeB; G.homeB = b;
    const d = b.door;
    p.x = d.x + 0.5 + (d.side === 1 ? (CP.W.isIndoor(d.x, d.y, 0) ? -3 : 3) : 0); p.y = d.y + 0.5 + (d.side === 0 ? (CP.W.isIndoor(d.x, d.y, 0) ? -3 : 3) : 0);
    p.z = 0; CP.Render.camX = p.x; CP.Render.camY = p.y; G.zombies.length = 0; G.updateFov(true);
    return { x: p.x, y: p.y };
  });
  await page.evaluate(() => { CP.Render.setZoomIndex(2); CP.Game.state.world.weather = { type: 'clear', until: CP.Time.hours() + 50 }; });
  log('fora', JSON.stringify(await goOut()));
  await page.waitForTimeout(700);
  await shot('quintais-inicio');
  // mundo tomado pelo mato
  await page.evaluate(() => { CP.Game.state.world.erosionOverride = 1; });
  await page.waitForTimeout(600);
  await shot('erosao-total');
  await page.evaluate(() => { CP.Game.state.world.erosionOverride = 0.5; });
  await page.waitForTimeout(400);
  await shot('erosao-meio');
  // neve
  await page.evaluate(() => { CP.Time.season = () => 'Inverno'; const w = CP.Game.state.world; w.erosionOverride = undefined; w.snow = 0.5; w.weather = { type: 'snow', until: CP.Time.hours() + 50 }; });
  await page.waitForTimeout(600);
  await shot('neve-media');
  await page.evaluate(() => { CP.Game.state.world.snow = 1; });
  // anda para fazer pegadas
  await page.keyboard.down('KeyD'); await page.waitForTimeout(1600); await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyS'); await page.waitForTimeout(1200); await page.keyboard.up('KeyS');
  await page.waitForTimeout(300);
  await shot('neve-cheia-pegadas');
  log('pegadas', await page.evaluate(() => CP.Amb.prints.length));
  // centro: letreiros e toldos
  const shop = await page.evaluate(() => {
    const W = CP.W, G = CP.Game, p = G.player;
    CP.Time.season = () => 'Verão'; G.state.world.snow = 0; G.state.world.weather = { type: 'clear', until: CP.Time.hours() + 50 };
    for (const ch of W.allChunks()) for (const b of ch.buildings) {
      if (b.kind !== 'house' && b.kind !== 'barn' && b.door && (b.door.side === 0 ? !W.isIndoor(b.door.x, b.door.y, 0) : !W.isIndoor(b.door.x, b.door.y, 0))) {
        const d = b.door; p.x = d.x + 0.5 + (d.side === 1 ? 4 : 1); p.y = d.y + 0.5 + (d.side === 0 ? 4 : 1); p.z = 0;
        CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true); return { kind: b.kind, text: CP.Render.signText(b), side: d.side };
      }
    }
    // nenhuma com fachada para a câmera: qualquer loja
    for (const ch of W.allChunks()) for (const b of ch.buildings) if (b.kind !== 'house' && b.door) { const d = b.door; p.x = d.x + 2.5; p.y = d.y + 2.5; CP.Render.camX = p.x; CP.Render.camY = p.y; G.updateFov(true); return { kind: b.kind, text: CP.Render.signText(b), side: d.side, other: true }; }
    return null;
  });
  log('loja', JSON.stringify(shop));
  await page.waitForTimeout(700);
  await shot('letreiro-toldo');
  // vento forte: folhas/papéis voando e árvores inclinadas
  await page.evaluate(() => { CP.Game.state.world.weather = { type: 'storm', until: CP.Time.hours() + 50 }; CP.Game.state.time += 3600 * 0; });
  await goOut();
  await page.waitForTimeout(1500);
  await shot('vento-tempestade');
  log('folhas', await page.evaluate(() => CP.Amb.debris.length), 'vento', await page.evaluate(() => CP.Amb.wind().toFixed(2)));
  // corvos perto de um corpo + moscas
  await page.evaluate(() => {
    const G = CP.Game, p = G.player, A = CP.Amb;
    G.state.world.weather = { type: 'clear', until: CP.Time.hours() + 50 };
    const ch = CP.W.chunkAt(Math.floor(p.x), Math.floor(p.y));
    const zd = CP.Zombies.makeData(new CP.U.Rng(9), p.x + 3, p.y + 1, 0); const look = CP.Zombies.fromData(zd).look;
    ch.corpses.push({ x: p.x + 3, y: p.y + 1, z: 0, ang: 1, look: look, items: [], t: G.state.time - 86400 });
    CP.Render.setZoomIndex(5);
  });
  await page.waitForTimeout(500);
  await shot('corpo-moscas');
  const fl = await page.evaluate(() => { const p = CP.Game.player; CP.Amb.flocks.length = 0; CP.Amb.spawnFlockAt(p.x + 5.5, p.y - 3.5, 5); return CP.Amb.flocks.length; });
  log('bandos', fl);
  await page.waitForTimeout(400);
  await shot('corvos-no-chao');
  await page.evaluate(() => { const p = CP.Game.player; p.x += 3; p.y -= 2; CP.Game.updateFov(true); });
  await page.waitForTimeout(450);
  await shot('corvos-voando');
  log('voando', await page.evaluate(() => CP.Amb.flying.length));
  // outdoor na rodovia
  const bb = await page.evaluate(() => {
    const W = CP.W, G = CP.Game, p = G.player, O = CP.C.OBJ;
    for (let cy = 0; cy < CP.C.WORLD_CHUNKS; cy++) for (let cx = 0; cx < CP.C.WORLD_CHUNKS; cx++) {
      const ch = W.ensureChunk(cx, cy); if (!ch) continue;
      const L = ch.levels[0];
      for (let i = 0; i < L.obj.length; i++) if (L.obj[i] === O.BILLBOARD) {
        const x = cx * 32 + (i % 32), y = cy * 32 + ((i / 32) | 0);
        p.x = x + 2.5; p.y = y + 3.5; CP.Render.camX = p.x; CP.Render.camY = p.y; CP.Render.setZoomIndex(3); G.activateChunks(true); G.updateFov(true); return { x, y };
      }
    }
    return null;
  });
  log('outdoor', JSON.stringify(bb));
  await page.waitForTimeout(800);
  await shot('outdoor');
  // varanda e quintal de perto
  const pc = await page.evaluate(() => {
    const W = CP.W, G = CP.Game, p = G.player, F = CP.C.FLOOR;
    for (const ch of W.allChunks()) {
      const L = ch.levels[0];
      for (let i = 0; i < L.floor.length; i++) if (L.floor[i] === F.DECK) {
        const x = ch.cx * 32 + (i % 32), y = ch.cy * 32 + ((i / 32) | 0);
        p.x = x + 2.5; p.y = y + 2.5; CP.Render.camX = p.x; CP.Render.camY = p.y; CP.Render.setZoomIndex(4); G.activateChunks(true); G.updateFov(true); return { x, y };
      }
    }
    return null;
  });
  log('varanda', JSON.stringify(pc));
  await page.waitForTimeout(800);
  await shot('varanda');
  // corpo com moscas de perto
  await page.evaluate(() => {
    const G = CP.Game, p = G.player; CP.Render.setZoomIndex(6);
    const ch = CP.W.chunkAt(Math.floor(p.x), Math.floor(p.y));
    const zd = CP.Zombies.makeData(new CP.U.Rng(11), p.x + 1.2, p.y + 0.4, 0); const look = CP.Zombies.fromData(zd).look;
    ch.corpses.push({ x: p.x + 1.2, y: p.y + 0.4, z: 0, ang: 2, look: look, items: [], t: G.state.time - 86400 });
  });
  await page.waitForTimeout(500);
  await shot('moscas-perto');
};
