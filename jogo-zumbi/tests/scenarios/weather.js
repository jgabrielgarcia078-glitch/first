module.exports = async (page, shot, log) => {
  await page.evaluate(() => { const ws = CP.Game.state.world; ws.weather = { type: 'storm', until: CP.Time.hours() + 5 }; const p = CP.Game.player; const b = CP.W.building(Math.floor(p.x), Math.floor(p.y), 0); const d = b.door; p.x = d.x + 0.5 + (d.side === 1 ? (CP.W.isIndoor(d.x, d.y, 0) ? -3 : 3) : 0); p.y = d.y + 0.5 + (d.side === 0 ? (CP.W.isIndoor(d.x, d.y, 0) ? -3 : 3) : 0); CP.Render.camX = p.x; CP.Render.camY = p.y; CP.Game.updateFov(true); });
  await page.waitForTimeout(1500);
  await shot('tempestade');
  await page.evaluate(() => { CP.Game.state.world.weather = { type: 'fog', until: CP.Time.hours() + 5 }; });
  await page.waitForTimeout(800);
  await shot('neblina');
  await page.evaluate(() => { CP.Game.player.mapRevealed = true; });
  await page.keyboard.press('KeyM'); await page.waitForTimeout(500);
  await shot('mapa-regiao');
  await page.click('[data-a="mapmode"][data-m="local"]'); await page.waitForTimeout(500);
  await shot('mapa-local');
};
