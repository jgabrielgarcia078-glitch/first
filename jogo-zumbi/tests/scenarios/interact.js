module.exports = async (page, shot, log) => {
  const W = 'CP.W';
  // 1) Porta: fica ao lado da porta da frente (dentro), olhando para ela, aperta E
  const door = await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W;
    G.zombies.length = 0;
    const b = W.building(Math.floor(p.x), Math.floor(p.y), 0);
    const d = b.door;
    const st = W.edgeState(d.x, d.y, 0, d.side);
    st.locked = false; st.open = false;
    // tile de dentro
    const inside = d.side === 0 ? (W.isIndoor(d.x, d.y, 0) ? [d.x, d.y] : [d.x, d.y - 1]) : (W.isIndoor(d.x, d.y, 0) ? [d.x, d.y] : [d.x - 1, d.y]);
    p.x = inside[0] + 0.5; p.y = inside[1] + 0.5;
    const mid = d.side === 0 ? [d.x + 0.5, d.y] : [d.x, d.y + 0.5];
    p.ang = Math.atan2(mid[1] - p.y, mid[0] - p.x);
    G.updateFov(true);
    return { d, open0: st.open };
  });
  await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
  const open1 = await page.evaluate((d) => CP.W.edgeState(d.x, d.y, 0, d.side).open, door.d);
  log('porta abriu com E:', open1);
  await shot('porta-aberta');
  await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
  log('porta fechou com E:', !(await page.evaluate((d) => CP.W.edgeState(d.x, d.y, 0, d.side).open, door.d)));
  // 2) barricar a porta pelo menu de contexto (dá martelo, tábuas, pregos)
  await page.evaluate(() => { const p = CP.Game.player; CP.Items.Inv.give(p, CP.Items.make('hammer')); for (let i = 0; i < 6; i++) CP.Items.Inv.give(p, CP.Items.make('plank')); CP.Items.Inv.give(p, CP.Items.make('nails', { n: 10 })); });
  const mid = await page.evaluate((d) => { const m = d.side === 0 ? [d.x + 0.5, d.y] : [d.x, d.y + 0.5]; return CP.Render.toScreen(m[0], m[1], 0); }, door.d);
  await page.mouse.click(mid.x, mid.y, { button: 'right' }); await page.waitForTimeout(250);
  const opts = await page.evaluate(() => [...document.querySelectorAll('.ctx div')].map(e => e.textContent));
  log('menu da porta:', opts.join(' | '));
  await shot('menu-porta');
  const bar = await page.$('.ctx div:has-text("Barricar")');
  if (bar) { await bar.click(); await page.waitForTimeout(6000); }
  log('tábuas na porta:', await page.evaluate((d) => CP.W.edgeState(d.x, d.y, 0, d.side).bar, door.d));
  await shot('barricada');
  // 3) comer e beber pelo inventário
  await page.evaluate(() => { const p = CP.Game.player; p.body.stats.hunger = 0.5; p.body.stats.thirst = 0.5; CP.Items.Inv.give(p, CP.Items.make('apple', { age: 0 })); });
  await page.keyboard.press('KeyI'); await page.waitForTimeout(300);
  const appleRow = await page.$('.item:has-text("Maçã")');
  await appleRow.click(); await page.waitForTimeout(200);
  await (await page.$('.ctx div:has-text("Comer")')).click();
  await page.waitForTimeout(4500);
  log('fome depois da maçã:', await page.evaluate(() => CP.Game.player.body.stats.hunger.toFixed(2)));
  const waterRow = await page.$('.item:has-text("Garrafa")');
  await waterRow.click(); await page.waitForTimeout(200);
  await (await page.$('.ctx div:has-text("Beber")')).click();
  await page.waitForTimeout(2200);
  log('sede depois da água:', await page.evaluate(() => CP.Game.player.body.stats.thirst.toFixed(2)));
  await page.keyboard.press('KeyI');
  // 4) artesanato: rasgar lençol
  await page.evaluate(() => CP.Items.Inv.give(CP.Game.player, CP.Items.make('sheet')));
  await page.keyboard.press('KeyB'); await page.waitForTimeout(300);
  await shot('artesanato');
  const rip = await page.$('[data-a="craft"][data-id="rip_sheet"]');
  await rip.click(); await page.waitForTimeout(4000);
  log('panos:', await page.evaluate(() => CP.Items.Inv.count(CP.Game.player, 'rag')));
  // 5) construção: caixote
  await page.click('[data-a="ctab"][data-t="build"]'); await page.waitForTimeout(200);
  await shot('construcao');
  const b = await page.$('[data-a="build"][data-id="b_crate"]');
  const dis = await b.getAttribute('disabled');
  log('construir caixote disponível:', dis === null);
  if (dis === null) {
    await b.click(); await page.waitForTimeout(200);
    // acha um tile livre perto
    const tgt = await page.evaluate(() => { const p = CP.Game.player, W = CP.W; for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]]) { const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy; if (W.tileWalkable(x, y, 0) && !W.obj(x, y, 0)) return CP.Render.toScreen(x + 0.5, y + 0.5, 0); } return null; });
    if (tgt) { await page.mouse.move(tgt.x, tgt.y); await page.waitForTimeout(200); await shot('fantasma-construcao'); await page.mouse.click(tgt.x, tgt.y); await page.waitForTimeout(12000); }
    log('caixote construído:', await page.evaluate(() => { const p = CP.Game.player, W = CP.W; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (W.obj(Math.floor(p.x) + dx, Math.floor(p.y) + dy, 0) === CP.C.OBJ.CRATE) return true; return false; }));
  }
  // 6) arma de fogo: pistola carregada, mira e atira num zumbi
  await page.evaluate(() => {
    const G = CP.Game, p = G.player;
    const gun = CP.Items.make('pistol', { ammo: 15 }); CP.Use.equip(p, gun, 'hand1');
    const zd = CP.Zombies.makeData(new CP.U.Rng(3), p.x + 4, p.y + 4, 0); zd.crawler = false; zd.fakeDead = false; zd.hp = 1.5;
    G.zombies.push(CP.Zombies.fromData(zd)); window._zz = G.zombies[G.zombies.length - 1];
  });
  const zs = await page.evaluate(() => CP.Render.toScreen(_zz.x, _zz.y, 0));
  await page.mouse.move(zs.x, zs.y - 30);
  await page.mouse.down({ button: 'right' }); await page.waitForTimeout(400);
  for (let i = 0; i < 5; i++) { const z2 = await page.evaluate(() => CP.Render.toScreen(_zz.x, _zz.y, 0)); await page.mouse.move(z2.x, z2.y - 30); await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(500); if (i === 0) await shot('tiro'); }
  await page.mouse.up({ button: 'right' });
  log('zumbi após tiros:', await page.evaluate(() => _zz.state + ' hp ' + _zz.hp.toFixed(2) + ' munição ' + CP.Game.player.hand1.ammo));
  // 7) dormir numa cama
  const bed = await page.evaluate(() => { const p = CP.Game.player, W = CP.W; p.body.stats.fatigue = 0.75; CP.Game.zombies.length = 0; for (let y = Math.floor(p.y) - 40; y < p.y + 40; y++) for (let x = Math.floor(p.x) - 40; x < p.x + 40; x++) { if (W.obj(x, y, 0) === CP.C.OBJ.BED_HEAD) { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (W.tileWalkable(x + dx, y + dy, 0) && !W.blockedBetween(x, y, x + dx, y + dy, 0, false)) { p.x = x + dx + 0.5; p.y = y + dy + 0.5; CP.Render.camX = p.x; CP.Render.camY = p.y; CP.Game.updateFov(true); return CP.Render.toScreen(x + 0.5, y + 0.5, 0); } } } } return null; });
  if (bed) {
    await page.waitForTimeout(50);
    await page.mouse.click(bed.x, bed.y - 8, { button: 'right' }); await page.waitForTimeout(250);
    log('menu da cama:', await page.evaluate(() => [...document.querySelectorAll('.ctx div')].map(e => e.textContent).join(' | ')));
    const sl = await page.$('.ctx div:has-text("Dormir")');
    if (sl) { await sl.click(); await page.waitForTimeout(1500); await shot('dormindo'); const t0 = await page.evaluate(() => CP.Time.clockText()); await page.waitForTimeout(4000); log('dormindo:', await page.evaluate(() => CP.Game.player.sleeping), t0, '→', await page.evaluate(() => CP.Time.clockText())); }
  }
};
