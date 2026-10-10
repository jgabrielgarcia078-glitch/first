module.exports = async (page, shot, log) => {
  // leva o jogador para a rua e solta 6 zumbis ao redor, dá um taco
  const info = await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W;
    const b = W.building(Math.floor(p.x), Math.floor(p.y), 0);
    const d = b.door;
    p.x = d.x + 0.5 + (d.side === 1 ? (W.isIndoor(d.x, d.y, 0) ? -2 : 2) : 0); p.y = d.y + 0.5 + (d.side === 0 ? (W.isIndoor(d.x, d.y, 0) ? -2.5 : 2) : 0);
    const bat = CP.Items.make('bat'); CP.Use.equip(p, bat, 'hand1');
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + 0.3;
      const zd = CP.Zombies.makeData(new CP.U.Rng(100 + i), p.x + Math.cos(a) * 4.5, p.y + Math.sin(a) * 4.5, 0);
      zd.crawler = false; zd.fakeDead = false;
      const z = CP.Zombies.fromData(zd); z.state = 'chase'; z.target = { x: p.x, y: p.y, z: 0 }; z.memT = 60;
      G.zombies.push(z);
    }
    G.updateFov(true);
    return { x: p.x, y: p.y, z: G.zombies.length };
  });
  log('posição', info);
  await page.waitForTimeout(1500);
  await shot('zumbis-chegando');
  // ataca na direção do zumbi mais perto várias vezes
  for (let k = 0; k < 16; k++) {
    const t = await page.evaluate(() => { const p = CP.Game.player; let best = null, bd = 99; CP.Game.zombies.forEach(z => { const d = Math.hypot(z.x - p.x, z.y - p.y); if (d < bd && z.state !== 'dead') { bd = d; best = z; } }); return best ? CP.Render.toScreen(best.x, best.y, best.z) : null; });
    if (!t) break;
    await page.mouse.move(t.x, t.y - 20);
    await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up();
    await page.waitForTimeout(700);
    if (k === 1) await shot('golpe');
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
  }
  await shot('depois-da-luta');
  const res = await page.evaluate(() => ({ kills: CP.Game.state.kills, hp: Math.round(CP.Game.player.body.health), dead: CP.Game.player.dead, moodles: CP.Body.moodles(CP.Game.player).map(m => m.name) }));
  log('resultado', res);
  await page.keyboard.press('KeyH'); await page.waitForTimeout(400);
  await shot('saude');
};
