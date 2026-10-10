/* Mede travadas: distribuição do tempo de cada quadro enquanto o jogador anda e luta. */
module.exports = async (page, shot, log) => {
  await page.evaluate(() => {
    window._ft = []; let last = performance.now();
    (function f(t) { window._ft.push(t - last); last = t; requestAnimationFrame(f); })(performance.now());
    const G = CP.Game, parts = {};
    window._parts = parts;
    function wrap(obj, name, key) { const o = obj[name]; obj[name] = function () { const t = performance.now(); const r = o.apply(this, arguments); const d = performance.now() - t; const p = parts[key] || (parts[key] = { tot: 0, max: 0, n: 0 }); p.tot += d; p.n++; if (d > p.max) p.max = d; return r; }; }
    wrap(G, 'tick', 'tick'); wrap(CP.Render, 'draw', 'render'); wrap(CP.Zombies, 'update', 'zombies'); wrap(G, 'updateFov', 'fov'); wrap(CP.UI, 'frame', 'ui'); wrap(CP.Save, 'save', 'save'); wrap(G, 'activateChunks', 'chunks'); wrap(CP.FX, 'drawScreen', 'fxScreen');
    const p = G.player; const b = CP.W.building(Math.floor(p.x), Math.floor(p.y), 0); const d = b.door; CP.W.edgeState(d.x, d.y, 0, d.side).open = true; CP.W.edgeState(d.x, d.y, 0, d.side).locked = false;
  });
  // anda em várias direções por 20s
  const dirs = ['KeyD', 'KeyS', 'KeyA', 'KeyW'];
  for (let i = 0; i < 16; i++) { const k = dirs[i % 4]; await page.keyboard.down(k); await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(1200); await page.keyboard.up('ShiftLeft'); await page.keyboard.up(k); }
  await page.evaluate(() => CP.Save.save());
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const ft = window._ft.slice(5).sort((a, b) => a - b); const q = p => ft[Math.floor(ft.length * p)].toFixed(1); const parts = {}; for (const k in window._parts) { const v = window._parts[k]; parts[k] = 'avg ' + (v.tot / v.n).toFixed(2) + ' max ' + v.max.toFixed(1) + ' n ' + v.n; } return { frames: ft.length, p50: q(0.5), p90: q(0.9), p99: q(0.99), max: ft[ft.length - 1].toFixed(1), over50: ft.filter(x => x > 50).length, zs: CP.Game.zombies.length, parts }; });
  log(JSON.stringify(r, null, 1));
};
