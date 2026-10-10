module.exports = async (page, shot, log) => {
  // instrumenta tick e render
  const res = await page.evaluate(async () => {
    const G = CP.Game;
    const origTick = G.tick, origRender = G.render;
    let tickMs = 0, ticks = 0, rMs = 0, frames = 0, zMs = 0;
    const origZ = CP.Zombies.update;
    CP.Zombies.update = function (dt) { const t = performance.now(); origZ(dt); zMs += performance.now() - t; };
    G.tick = function (a, b) { const t = performance.now(); origTick(a, b); tickMs += performance.now() - t; ticks++; };
    G.render = function () { const t = performance.now(); origRender(); rMs += performance.now() - t; frames++; };
    // agita os zumbis: barulho grande perto do jogador
    const p = G.player;
    CP.Zombies.noise(p.x, p.y, p.z, 60, 'test');
    await new Promise(r => setTimeout(r, 6000));
    return { zombies: G.zombies.length, chasing: G.zombies.filter(z => z.state !== 'idle').length, tickMs: (tickMs / ticks).toFixed(2), zombieMs: (zMs / ticks).toFixed(2), renderMs: (rMs / frames).toFixed(2), fps: G.fps, pathRuns: CP.Path.stats.runs, pathNodes: CP.Path.stats.nodes };
  });
  log(res);
  await shot('horda');
};
