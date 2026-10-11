/* Interface nova: arrastar e soltar itens, anotações no mapa, minimapa e rótulos ao passar o mouse. */
module.exports = async (page, shot, log) => {
  const fail = [];
  await page.evaluate(() => {
    const G = CP.Game, p = G.player; G.zombies.length = 0;
    for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    document.getElementById('toasts').style.display = 'none';
    CP.Game.state.world.weather = { type: 'clear', until: CP.Time.hours() + 500 };
    CP.Items.Inv.give(p, CP.Items.make('hammer'));
    CP.UI.toggle('inv', true);
  });
  await page.waitForTimeout(600);
  // arrastar o martelo do inventário para o chão (janela da direita)
  const pos = await page.evaluate(() => {
    const it = [...document.querySelectorAll('#p-inv .pane-wrap[data-side="p"] .item')].find(e => /Martelo/.test(e.textContent));
    const dst = document.querySelector('#p-inv .pane-wrap[data-side="l"] .pane-list');
    if (!it || !dst) return null;
    const a = it.getBoundingClientRect(), b = dst.getBoundingClientRect();
    return { ax: a.left + 40, ay: a.top + a.height / 2, bx: b.left + b.width / 2, by: b.top + b.height / 2 };
  });
  if (!pos) fail.push('item ou janela não encontrados');
  else {
    await page.mouse.move(pos.ax, pos.ay); await page.mouse.down();
    await page.mouse.move(pos.ax + 30, pos.ay + 10, { steps: 4 });
    await page.mouse.move(pos.bx, pos.by, { steps: 8 });
    await shot('arrastando');
    const ghost = await page.evaluate(() => !!document.querySelector('.drag-ghost'));
    if (!ghost) fail.push('sem fantasma ao arrastar');
    await page.mouse.up();
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const p = CP.Game.player, src = CP.UI.lootSources[CP.UI.lootTab];
      return { noChao: src.items.some(i => i.id === 'hammer'), onde: src.name, naMochila: !!CP.Items.Inv.findId(p, 'hammer'), menu: CP.UI.ctxOpen };
    });
    log('soltar no chão', JSON.stringify(r));
    if (!r.noChao || r.naMochila) fail.push('martelo não foi para a janela da direita');
    if (r.menu) fail.push('menu de contexto abriu depois de arrastar');
  }
  await shot('solto-no-chao');
  // arrastar de volta para a aba do inventário
  const pos2 = await page.evaluate(() => {
    const it = [...document.querySelectorAll('#p-inv .pane-wrap[data-side="l"] .item')].find(e => /Martelo/.test(e.textContent));
    const tab = document.querySelector('#p-inv .tab-v[data-side="p"][data-i="0"]');
    if (!it || !tab) return null;
    const a = it.getBoundingClientRect(), b = tab.getBoundingClientRect();
    return { ax: a.left + 40, ay: a.top + a.height / 2, bx: b.left + b.width / 2, by: b.top + b.height / 2 };
  });
  if (!pos2) fail.push('martelo não aparece no chão');
  else {
    await page.mouse.move(pos2.ax, pos2.ay); await page.mouse.down();
    await page.mouse.move(pos2.bx, pos2.by, { steps: 10 }); await page.mouse.up();
    await page.waitForTimeout(1500);
    const back = await page.evaluate(() => !!CP.Items.Inv.findId(CP.Game.player, 'hammer'));
    log('de volta', back);
    if (!back) fail.push('martelo não voltou ao inventário');
  }
  // vestir arrastando para "Equipado e vestido"
  const pos3 = await page.evaluate(() => {
    const p = CP.Game.player; CP.Items.Inv.give(p, CP.Items.make('bat'));
    CP.UI.toggle('inv', false); CP.UI.toggle('inv', true);
    const it = [...document.querySelectorAll('#p-inv .pane-wrap[data-side="p"] .item')].find(e => /Taco/.test(e.textContent));
    const tabs = document.querySelectorAll('#p-inv .tab-v[data-side="p"]'); const tab = tabs[tabs.length - 1];
    if (!it || !tab) return null;
    const a = it.getBoundingClientRect(), b = tab.getBoundingClientRect();
    return { ax: a.left + 40, ay: a.top + a.height / 2, bx: b.left + b.width / 2, by: b.top + b.height / 2 };
  });
  if (pos3) {
    await page.mouse.move(pos3.ax, pos3.ay); await page.mouse.down();
    await page.mouse.move(pos3.bx, pos3.by, { steps: 10 }); await page.mouse.up();
    await page.waitForTimeout(500);
    const eq = await page.evaluate(() => CP.Game.player.hand1 && CP.Game.player.hand1.id);
    log('na mão', eq);
    if (eq !== 'bat') fail.push('taco não foi equipado');
  } else fail.push('taco não encontrado');
  // soltar fora das janelas (no mundo) larga no chão
  const pos4 = await page.evaluate(() => {
    const it = [...document.querySelectorAll('#p-inv .pane-wrap[data-side="p"] .item')].find(e => /Garrafa/.test(e.textContent));
    if (!it) return null; const a = it.getBoundingClientRect(); return { ax: a.left + 40, ay: a.top + a.height / 2 };
  });
  if (pos4) {
    await page.mouse.move(pos4.ax, pos4.ay); await page.mouse.down();
    await page.mouse.move(900, 600, { steps: 10 }); await page.mouse.up();
    await page.waitForTimeout(1500);
    const fl = await page.evaluate(() => { const p = CP.Game.player; return CP.W.floorItems(Math.floor(p.x), Math.floor(p.y), CP.W.levelOf(p.z), true).map(i => i.id).join(','); });
    log('chão', fl);
    if (!/water/.test(fl)) fail.push('soltar no mundo não largou no chão');
  } else fail.push('garrafa não encontrada');
  // mapa: anotações
  await page.evaluate(() => { CP.UI.toggle('inv', false); CP.UI.mapMode = 'local'; CP.UI.toggle('map', true); });
  await page.waitForTimeout(400);
  const mc = await page.evaluate(() => { const r = document.getElementById('mapc').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; });
  await page.mouse.click(mc.x + mc.w * 0.5 + 30, mc.y + mc.w * 0.5 - 20);
  await page.evaluate(() => { CP.UI.mapSym = 3; document.getElementById('mapnote-text').value = 'Casa segura'; });
  await page.mouse.click(mc.x + mc.w * 0.5 - 2, mc.y + mc.w * 0.5 + 2);
  await page.evaluate(() => { CP.UI.mapSym = 4; });
  await page.mouse.click(mc.x + mc.w * 0.5 - 60, mc.y + mc.w * 0.5 + 50);
  await page.waitForTimeout(300);
  const n1 = await page.evaluate(() => CP.Game.player.mapNotes.length);
  await shot('mapa-anotacoes');
  await page.mouse.click(mc.x + mc.w * 0.5 - 60, mc.y + mc.w * 0.5 + 50, { button: 'right' });
  await page.waitForTimeout(200);
  const n2 = await page.evaluate(() => CP.Game.player.mapNotes.length);
  log('anotações', n1, '→', n2);
  if (n1 !== 3 || n2 !== 2) fail.push('anotações: ' + n1 + ' → ' + n2);
  // zoom com a roda e arrastar para mover (sem criar anotação)
  const z0 = await page.evaluate(() => CP.UI.mapView.z);
  await page.mouse.move(mc.x + mc.w * 0.5, mc.y + mc.w * 0.5); await page.mouse.wheel(0, -200); await page.waitForTimeout(150);
  const z1 = await page.evaluate(() => CP.UI.mapView.z);
  const cx0 = await page.evaluate(() => CP.UI.mapView.cx), notes0 = await page.evaluate(() => CP.Game.player.mapNotes.length);
  await page.mouse.down(); await page.mouse.move(mc.x + mc.w * 0.5 + 120, mc.y + mc.w * 0.5 + 30, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(150);
  const cx1 = await page.evaluate(() => CP.UI.mapView.cx), notes1 = await page.evaluate(() => CP.Game.player.mapNotes.length);
  log('mapa zoom', z0.toFixed(2), '→', z1.toFixed(2), 'arrastar cx', cx0.toFixed(1), '→', cx1.toFixed(1));
  if (!(z1 > z0)) fail.push('roda não deu zoom no mapa');
  if (!(cx1 < cx0) || notes1 !== notes0) fail.push('arrastar o mapa não moveu (ou criou anotação)');
  await page.evaluate(() => { CP.UI.mapView.z = 5; CP.UI.mapView.cx = CP.Game.player.x; CP.UI.mapView.cy = CP.Game.player.y; CP.Game.player.mapRevealed = true; CP.UI.toggle('map', false); CP.UI.toggle('map', true); });
  await page.waitForTimeout(300);
  await shot('mapa-perto-ruas');
  // região
  await page.evaluate(() => { CP.Game.player.mapRevealed = false; CP.UI.mapView = null; CP.UI.mapMode = 'region'; CP.UI.toggle('map', false); CP.UI.toggle('map', true); });
  await page.waitForTimeout(300);
  await shot('mapa-regiao');
  await page.evaluate(() => CP.UI.toggle('map', false));
  // rótulo: aponta para a porta da casa
  const door = await page.evaluate(() => {
    const p = CP.Game.player, W = CP.W, b = W.building(Math.floor(p.x), Math.floor(p.y), 0) || null;
    let d = b && b.door;
    if (!d) { for (const k in CP.Game.activeChunks) for (const bb of CP.Game.activeChunks[k].buildings) if (!d && bb.door) d = bb.door; }
    p.x = d.x + 0.5 + (d.side === 1 ? 2.5 : 0); p.y = d.y + 0.5 + (d.side === 0 ? 2.5 : 0);
    if (W.isIndoor(Math.floor(p.x), Math.floor(p.y), 0)) { p.x = d.x + 0.5 - (d.side === 1 ? 2.5 : 0); p.y = d.y + 0.5 - (d.side === 0 ? 2.5 : 0); }
    p.ang = Math.atan2(d.y + 0.5 - p.y, d.x + 0.5 - p.x);
    CP.Render.setZoomIndex(5); CP.Render.camX = p.x; CP.Render.camY = p.y; CP.Game.updateFov(true);
    const mx = d.side === 0 ? d.x + 0.5 : d.x, my = d.side === 0 ? d.y : d.y + 0.5;
    const sc = CP.Render.toScreen(mx, my, 0);
    return { x: sc.x, y: sc.y - 30 * CP.Render.zoom };
  });
  await page.waitForTimeout(400);
  await page.mouse.move(door.x - 5, door.y - 5); await page.mouse.move(door.x, door.y, { steps: 3 });
  await page.waitForTimeout(400);
  const lbl = await page.evaluate(() => { const e = document.getElementById('hover-label'); return e.style.display !== 'none' ? e.textContent : ''; });
  log('rótulo da porta', lbl);
  if (!/Porta|Janela|Portão/.test(lbl)) fail.push('rótulo da porta: "' + lbl + '"');
  await shot('rotulo-porta');
  // varre a tela e junta os rótulos que aparecem
  const seen = await page.evaluate(() => {
    const out = {}; const w = innerWidth, h = innerHeight;
    for (let y = 60; y < h - 60; y += 23) for (let x = 60; x < w - 60; x += 31) { const t = CP.UI.hoverText(x, y); if (t) out[t] = (out[t] || 0) + 1; }
    return out;
  });
  log('rótulos na tela', JSON.stringify(seen));
  // minimapa: N esconde e mostra
  await page.keyboard.press('KeyN'); await page.waitForTimeout(200);
  const hid = await page.evaluate(() => document.getElementById('minimap').style.display);
  await page.keyboard.press('KeyN'); await page.waitForTimeout(300);
  const shown = await page.evaluate(() => document.getElementById('minimap').style.display);
  log('minimapa', JSON.stringify([hid, shown]));
  if (hid !== 'none' || shown !== '') fail.push('tecla N do minimapa');
  await shot('minimapa');
  // salvar e carregar mantém as anotações
  log('FALHAS', fail.length ? fail.join(' | ') : 'nenhuma');
};
