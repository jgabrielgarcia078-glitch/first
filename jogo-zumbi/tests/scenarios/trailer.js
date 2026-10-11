/* Reboque engatado numa picape e o balão do rádio portátil ligado. */
module.exports = async (page, shot, log) => {
  const r = await page.evaluate(() => {
    const G = CP.Game, p = G.player, V = CP.Vehicles; document.getElementById('toasts').style.display = 'none';
    G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    G.state.time = Math.floor(G.state.time / 86400) * 86400 + (12 - CP.C.START_HOUR) * 3600;
    let tr = V.active.find(c => c.trailer), car = null;
    if (!tr) {
      car = V.active.find(c => !c.trailer); if (!car) return 'sem carro';
      const c0 = Math.cos(car.ang), s0 = Math.sin(car.ang), L = V.HALF_L * 2 + CP.C.TRAILER.TONGUE;
      tr = { id: 'trS', x: car.x - c0 * L, y: car.y - s0 * L, z: 0, ang: car.ang, color: 3, speed: 0, steer: 0, fuel: 0, cond: 1, model: 'trailer', trailer: true, trunk: [CP.Items.make('plank')], parts: { engine: 1, battery: 0, tireFL: 1, tireFR: 1, tireRL: 1, tireRR: 1, windshield: null }, kind: 'car' };
      tr.draw = V.active[0].draw; V.active.push(tr); car.towId = tr.id; tr.towBy = car.id; V.towFollow(car);
    }
    p.x = tr.x + 2; p.y = tr.y + 2; const rd = CP.Items.make('radio'); CP.Items.Inv.give(p, rd); rd.on = true; rd.freq = 'fm88'; CP.Radio.hear(p, rd); p.sayT = 99;
    CP.Render.setZoomIndex(5); CP.Render.camX = tr.x; CP.Render.camY = tr.y; G.updateFov(true);
    return (car ? 'criado' : 'gerado') + ' ' + Math.round(tr.x) + ',' + Math.round(tr.y);
  });
  log('reboque', r); await page.waitForTimeout(900); await shot('reboque');
};
