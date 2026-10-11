/* Mixagem: mede na saída final (depois do limitador) pico, RMS, amostras cortadas e energia abaixo de 80 Hz
 * para cada camada da trilha, para os sustos e para música + efeitos juntos. */
module.exports = async (page, shot, log) => {
  await page.mouse.click(600, 400);
  const r = await page.evaluate(async () => {
    const A = CP.Audio, M = CP.Music; A.resume(); await new Promise(r => setTimeout(r, 400));
    const an = A.ctx.createAnalyser(); an.fftSize = 4096; A.out.connect(an);
    const td = new Float32Array(an.fftSize), fd = new Float32Array(an.frequencyBinCount);
    const binHz = A.ctx.sampleRate / an.fftSize;
    async function measure(ms) {
      let peak = 0, sum = 0, n = 0, clip = 0, low = 0, all = 0; const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        an.getFloatTimeDomainData(td);
        for (const v of td) { const a = Math.abs(v); if (a > peak) peak = a; if (a > 0.99) clip++; sum += v * v; n++; }
        an.getFloatFrequencyData(fd);
        for (let i = 1; i < fd.length; i++) { const p = Math.pow(10, fd[i] / 10); all += p; if (i * binHz < 80) low += p; }
        await new Promise(r => setTimeout(r, 40));
      }
      return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4), clip, sub80: +(low / (all || 1) * 100).toFixed(1) + '%' };
    }
    CP.Game.zombies.length = 0;
    const out = {};
    M.restT = 0; M.playing = false; M.bump = 0; M.intensity = 0;
    out.calm = await measure(14000);
    M.bump = 1; M.bumpT = 60; M.intensity = 1;
    out.tense = await measure(9000);
    M.bump = 2.5; M.bumpT = 60; M.intensity = 2.5;
    out.chase = await measure(9000);
    M.spotT = 0; M.spotted();
    out.spotted = await measure(2500);
    // tudo junto: perseguição + tiro + gemidos + passos
    const p = CP.Game.player;
    const z = { id: 5, x: p.x + 2, y: p.y, z: p.z, look: {} };
    A.gunshot(p.x, p.y, true); A.groan(z, true); A.groan({ id: 6, x: p.x - 2, y: p.y + 1, z: p.z, look: {} }, true); A.step(true);
    out.allTogether = await measure(1500);
    M.bump = 0; M.intensity = 0;
    return out;
  });
  log(JSON.stringify(r, null, 1));
};
