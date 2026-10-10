module.exports = async (page, shot, log) => {
  const r = await page.evaluate(async () => {
    const p = CP.Game.player, V = CP.Vehicles;
    const car = V.active[0];
    car.keyIn = true; car.locked = false; p.vehicle = car;
    const errs = [];
    const origErr = console.error; console.error = (...a) => { errs.push(a.map(String).join(' ')); origErr(...a); };
    let ok1 = await CP.Save.save();
    p.vehicle = null;
    let ok2 = await CP.Save.save();
    // tenta clonar cada chunk
    const bad = [];
    CP.W.allChunks().forEach(ch => { try { structuredClone(CP.Save.serializeChunk(ch)); } catch (e) { bad.push(ch.cx + ',' + ch.cy + ': ' + e.message); } });
    return { ok1, ok2, errs, bad: bad.slice(0, 3) };
  });
  log(r);
};
