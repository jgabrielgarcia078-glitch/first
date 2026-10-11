/* Modelos de veículo lado a lado (sedã, picape, van, viatura com giroflex, ambulância), jogador molhado e vapor da respiração. */
module.exports = async (page, shot, log) => {
  await page.evaluate(() => {
    const G = CP.Game, p = G.player, W = CP.W, V = CP.Vehicles;
    document.getElementById('toasts').style.display = 'none';
    G.zombies.length = 0; for (const k in G.activeChunks) G.activeChunks[k].zombies.length = 0;
    let spot = null;
    for (let r = 0; r < 120 && !spot; r++) for (let a = 0; a < 32 && !spot; a++) {
      const x = Math.floor(p.x + Math.cos(a / 32 * 6.28) * r), y = Math.floor(p.y + Math.sin(a / 32 * 6.28) * r);
      let okk = true; for (let dx = -2; dx <= 14 && okk; dx++) for (let dy = -2; dy <= 3 && okk; dy++) { if (!W.tileWalkable(x + dx, y + dy, 0) || W.isIndoor(x + dx, y + dy, 0) || W.obj(x + dx, y + dy, 0) || W.wn(x + dx, y + dy, 0) || W.ww(x + dx, y + dy, 0)) okk = false; }
      if (okk) spot = { x, y };
    }
    p.x = spot.x + 6.5; p.y = spot.y + 2.6;
    ['sedan', 'pickup', 'van', 'police', 'ambulance'].forEach((m, i) => {
      const car = { id: 'cena' + i, x: spot.x + i * 2.8, y: spot.y + 0.5, z: 0, ang: Math.PI / 2 * (i % 2 ? 1 : -1) * 0 + 0.0, color: i * 2, model: m, speed: 0, steer: 0, fuel: 10, cond: 1, keyIn: true, engine: false, broken: false, trunk: [], hornT: 0 };
      car.ang = Math.PI / 2; if (V.MODELS[m].color !== undefined) car.color = V.MODELS[m].color;
      car.draw = V.drawCar; car.kind = 'car'; V.active.push(car); V.parts(car).battery = 1;
      if (m === 'police') car.siren = true;
    });
    CP.Render.setZoomIndex(5); CP.Render.camX = p.x - 0.5; CP.Render.camY = p.y - 1; G.updateFov(true);
    G.state.world.weather = { type: 'clear', until: CP.Time.hours() + 50 };
  });
  await page.waitForTimeout(1200);
  await shot('modelos');
  await page.evaluate(() => { const G = CP.Game; G.state.time = Math.ceil(G.state.time / 86400) * 86400 + (21 - CP.C.START_HOUR) * 3600; G.updateFov(true); });
  await page.waitForTimeout(800);
  await shot('giroflex-noite');
  // molhado e vapor no frio
  await page.evaluate(() => {
    const G = CP.Game, p = G.player; G.state.time -= 10 * 3600; p.body.stats.wet = 0.9;
    CP.Time._t = CP.Time.temperature; CP.Time.temperature = () => -4;
    G.state.world.weather = { type: 'rain', until: CP.Time.hours() + 50 };
    CP.Render.setZoomIndex(7); CP.Render.camX = p.x; CP.Render.camY = p.y; p.running = true;
  });
  await page.waitForTimeout(2600);
  await shot('molhado-vapor');
};
