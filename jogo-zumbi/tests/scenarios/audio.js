module.exports = async (page, shot, log) => {
  await page.mouse.click(600, 400); // gesto do usuário libera o áudio
  const r = await page.evaluate(async () => {
    const A = CP.Audio; A.resume(); await new Promise(r => setTimeout(r, 300));
    const an = A.ctx.createAnalyser(); an.fftSize = 2048; A.comp.connect(an);
    const buf = new Float32Array(an.fftSize);
    async function measure(fn, ms) { let peak = 0, sum = 0, n = 0; fn(); const t0 = performance.now(); while (performance.now() - t0 < ms) { an.getFloatTimeDomainData(buf); for (const v of buf) { const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; n++; } await new Promise(r => setTimeout(r, 30)); } return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4) }; }
    const p = CP.Game.player;
    const z = { id: 5, x: p.x + 3, y: p.y, z: p.z, look: {} };
    const zl = { id: 6, x: p.x - 3, y: p.y + 3, z: p.z, look: {} };
    const out = { state: A.ctx.state };
    out.groanIdle = await measure(() => A.groan(z, false), 2200);
    out.groanAlert = await measure(() => A.groan(z, true), 1500);
    out.attack = await measure(() => A.zombieAttack(z), 700);
    out.step = await measure(() => A.step(false), 300);
    out.hit = await measure(() => A.hit('blunt_long', false, z.x, z.y, z.z), 400);
    out.door = await measure(() => A.door(true), 600);
    out.glass = await measure(() => A.glass(z.x, z.y), 600);
    out.gun = await measure(() => A.gunshot(p.x, p.y, true), 900);
    out.far = await measure(() => A.groan({ id: 9, x: p.x + 60, y: p.y, z: 0, look: {} }, true), 800);
    // pan: zumbi à direita na tela vs à esquerda
    const sp = (x, y) => { const s = A.ctx.createStereoPanner(); return s; };
    out.panRight = +(((z.x - p.x) - (z.y - p.y)) / 14).toFixed(2); out.panLeft = +(((zl.x - p.x) - (zl.y - p.y)) / 14).toFixed(2);
    out.voices = A.voices;
    return out;
  });
  log(JSON.stringify(r));
};
