/* Trilha e eventos distantes: mede volume (L/R) de cada evento, das camadas da música e se os zumbis vão até o som */
module.exports = async (page, shot, log) => {
  await page.mouse.click(600, 400); // gesto do usuário libera o áudio
  const r = await page.evaluate(async () => {
    const A = CP.Audio, M = CP.Music; A.resume(); await new Promise(r => setTimeout(r, 300));
    const split = A.ctx.createChannelSplitter(2); A.comp.connect(split);
    const aL = A.ctx.createAnalyser(), aR = A.ctx.createAnalyser(); aL.fftSize = aR.fftSize = 2048;
    split.connect(aL, 0); split.connect(aR, 1);
    const bL = new Float32Array(2048), bR = new Float32Array(2048);
    async function measure(fn, ms) {
      let sl = 0, sr = 0, n = 0, peak = 0; if (fn) fn(); const t0 = performance.now();
      while (performance.now() - t0 < ms) { aL.getFloatTimeDomainData(bL); aR.getFloatTimeDomainData(bR); for (let i = 0; i < 2048; i++) { sl += bL[i] * bL[i]; sr += bR[i] * bR[i]; peak = Math.max(peak, Math.abs(bL[i]), Math.abs(bR[i])); } n += 2048; await new Promise(r => setTimeout(r, 30)); }
      return { L: +Math.sqrt(sl / n).toFixed(4), R: +Math.sqrt(sr / n).toFixed(4), peak: +peak.toFixed(3) };
    }
    const out = {};
    // música calma (sem eventos): força uma peça agora
    M.restT = 0; M.playing = false;
    out.calm = await measure(null, 6000);
    out.calmLevels = Object.assign({}, M.level);
    // tensão / perseguição forçadas pelo "bump"
    M.bump = 1; M.bumpT = 30; M.intensity = 1;
    out.tense = await measure(null, 4000);
    M.bump = 2.5; M.bumpT = 30; M.intensity = 2.5;
    out.chase = await measure(null, 4000);
    out.chaseLevels = Object.assign({}, M.level);
    M.bump = 0; M.bumpT = 0; M.intensity = 0;
    A.setVolume(0.7); M.setVolume(0);
    await new Promise(r => setTimeout(r, 2500));
    // eventos: direção leste do mundo (ang 0) = direita na tela; oeste (pi) = esquerda
    for (const k of ['gunshot', 'gunfire', 'scream', 'help', 'dogs', 'crash', 'glass', 'explosion', 'siren']) {
      out[k + 'Right'] = await measure(() => A.distant(k, 0, 40), k === 'siren' ? 6000 : 2500);
      await new Promise(r => setTimeout(r, 1500));
    }
    out.screamLeft = await measure(() => A.distant('scream', Math.PI, 40), 2500);
    // zumbis atraídos pelo evento
    const G = CP.Game, p = G.player;
    const before = G.zombies.map(z => ({ z, d: Math.hypot(z.x - p.x, z.y - p.y) }));
    CP.Time.metaEvent('gunshot');
    const ev = G.state.world ? G.state.world.lastMeta : null;
    out.event = ev;
    out.investigating = G.zombies.filter(z => z.state === 'investigate' || (z.target && ev && Math.hypot(z.target.x - ev.x, z.target.y - ev.y) < 3)).length;
    out.active = G.zombies.length;
    out.musicSpot = typeof M.spotted;
    return out;
  });
  log(JSON.stringify(r, null, 1));
};
