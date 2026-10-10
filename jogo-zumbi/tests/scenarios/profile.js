module.exports = async (page, shot, log) => {
  const client = await page.context().newCDPSession(page);
  await page.evaluate(() => { const p = CP.Game.player; CP.Zombies.noise(p.x, p.y, p.z, 60, 'test'); });
  await client.send('Profiler.enable');
  await client.send('Profiler.start');
  await page.waitForTimeout(5000);
  const { profile } = await client.send('Profiler.stop');
  const self = {};
  const byId = {}; profile.nodes.forEach(n => byId[n.id] = n);
  const dt = profile.timeDeltas; const cnt = {};
  profile.samples.forEach((s, i) => { cnt[s] = (cnt[s] || 0) + (dt[i] || 0); });
  for (const id in cnt) { const n = byId[id]; const k = (n.callFrame.functionName || '(anon)') + ' ' + n.callFrame.url.split('/').pop() + ':' + n.callFrame.lineNumber; self[k] = (self[k] || 0) + cnt[id]; }
  const tot = Object.values(self).reduce((a, b) => a + b, 0);
  Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 22).forEach(e => log((e[1] / tot * 100).toFixed(1) + '%', e[0]));
};
