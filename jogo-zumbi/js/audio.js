/* Áudio sintetizado com WebAudio (sem arquivos).
 * Som posicional: pan pela posição na tela, volume pela distância, abafado (passa-baixa) atrás de paredes ou em outro andar,
 * e um pouco de eco ao ar livre. Vozes de zumbi = fonte glótica + formantes de vogal + aspereza, com limite de vozes. */
(function (CP) {
  'use strict';

  var U = CP.U;
  var Au = {
    ctx: null, master: null, comp: null, reverb: null, volume: 0.7, enabled: true, noiseBuf: null,
    rainNode: null, heliNode: null, engNode: null, voices: 0, lastStep: 0, MAX_VOICES: 3
  };

  Au.init = function () {
    if (Au.ctx || !Au.enabled) { return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { Au.enabled = false; return; }
    try {
      var ctx = Au.ctx = new AC();
      Au.comp = ctx.createDynamicsCompressor();
      Au.comp.threshold.value = -18; Au.comp.ratio.value = 4;
      Au.master = ctx.createGain();
      Au.master.gain.value = Au.volume;
      // saída final: corta o subgrave (alto-falantes pequenos distorcem) e limita os picos (nada passa de ~-1 dB)
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 50; hp.Q.value = 0.7;
      Au.out = ctx.createDynamicsCompressor();
      Au.out.threshold.value = -3; Au.out.knee.value = 0; Au.out.ratio.value = 20; Au.out.attack.value = 0.002; Au.out.release.value = 0.12;
      Au.master.connect(Au.comp); Au.comp.connect(hp); hp.connect(Au.out); Au.out.connect(ctx.destination);
      var len = ctx.sampleRate * 2;
      Au.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = Au.noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) { d[i] = Math.random() * 2 - 1; }
      // eco/reverberação curta (resposta ao impulso gerada: ruído com decaimento)
      var rl = Math.floor(ctx.sampleRate * 1.4);
      var ir = ctx.createBuffer(2, rl, ctx.sampleRate);
      for (var c = 0; c < 2; c++) { var ch = ir.getChannelData(c); for (var k = 0; k < rl; k++) { ch[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / rl, 3.2); } }
      Au.reverb = ctx.createConvolver(); Au.reverb.buffer = ir;
      Au.reverbIn = ctx.createGain(); Au.reverbIn.gain.value = 0.35;
      Au.reverbIn.connect(Au.reverb); Au.reverb.connect(Au.master);
      // curva de distorção suave (aspereza da voz)
      Au.rasp = makeCurve(18);
    } catch (e) { Au.enabled = false; }
  };
  function makeCurve(k) {
    var n = 1024, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; curve[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    return curve;
  }
  Au.resume = function () { Au.init(); if (Au.ctx && Au.ctx.state === 'suspended') { Au.ctx.resume(); } };
  Au.setVolume = function (v) { Au.volume = v; if (Au.master) { Au.master.gain.value = v; } };
  function ok() { return Au.ctx && Au.enabled && Au.ctx.state === 'running'; }

  /* ---------- posição ---------- */
  /* calcula volume, pan e abafamento de um som no mundo */
  function spatial(x, y, z, range) {
    var G = CP.Game, p = G && G.player;
    if (!p || x === undefined) { return { g: 1, pan: 0, muffle: false, outdoor: false }; }
    var dx = x - p.x, dy = y - p.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var r = range || 40;
    var g = Math.max(0, 1 - d / r);
    g = g * g;
    // pan pela posição horizontal na tela (isométrico: x - y)
    var pan = U.clamp((dx - dy) / 14, -0.95, 0.95);
    var W = CP.W;
    var pl = W.levelOf(p.z), zl = W.levelOf(z || 0);
    var muffle = pl !== zl;
    if (!muffle && d > 1.5 && d < 40) { muffle = !W.lineOfSight(p.x, p.y, x, y, pl, 60); }
    var outdoor = !W.isIndoor(Math.floor(x), Math.floor(y), zl);
    return { g: g, pan: pan, muffle: muffle, outdoor: outdoor, d: d };
  }
  /* cadeia de saída: ganho → (passa-baixa) → pan → master (+ eco) */
  function output(sp, vol) {
    var ctx = Au.ctx;
    var g = ctx.createGain();
    g.gain.value = vol * sp.g;
    var node = g;
    if (sp.muffle) {
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
      node.connect(lp); node = lp;
      g.gain.value *= 0.7;
    }
    var pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pn) { pn.pan.value = sp.pan; node.connect(pn); node = pn; }
    node.connect(Au.master);
    if (sp.outdoor && sp.d > 3) { var send = ctx.createGain(); send.gain.value = Math.min(0.6, sp.d / 30); node.connect(send); send.connect(Au.reverbIn); }
    return g;
  }
  var CENTER = { g: 1, pan: 0, muffle: false, outdoor: false, d: 0 };

  /* ruído filtrado com envelope */
  function noise(sp, dur, freq, q, vol, type, attack, rate) {
    var ctx = Au.ctx, t = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = Au.noiseBuf;
    src.playbackRate.value = rate || (0.85 + Math.random() * 0.3);
    var f = ctx.createBiquadFilter();
    f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + (attack || 0.004));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var out = output(sp, vol);
    src.connect(f); f.connect(env); env.connect(out);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
    return f;
  }
  function tone(sp, freq, dur, vol, type, slide, attack) {
    var ctx = Au.ctx, t = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) { o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur); }
    var env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + (attack || 0.008));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var out = output(sp, vol);
    o.connect(env); env.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }

  /* ---------- voz de zumbi ---------- */
  /* kind: 'idle' (gemido baixo e longo), 'alert' (rosnado ao ver), 'attack' (rosnado curto), 'hurt', 'die' */
  var VOWELS = [[520, 920, 2400], [600, 1040, 2500], [450, 800, 2300], [680, 1150, 2600]];
  function zombieVoice(x, y, z, kind, pitch) {
    if (!ok()) { return; }
    var sp = spatial(x, y, z, kind === 'idle' ? 22 : 30);
    if (sp.g < 0.02) { return; }
    if (Au.voices >= Au.MAX_VOICES && kind === 'idle') { return; }
    var ctx = Au.ctx, t = ctx.currentTime;
    var P = { idle: [1.6, 2.6, 0.1, 0.15], alert: [0.9, 1.4, 0.05, 0.55], attack: [0.35, 0.55, 0.01, 0.8], hurt: [0.3, 0.45, 0.01, 0.6], die: [1.0, 1.4, 0.02, 0.5] }[kind] || [1, 1.5, 0.05, 0.3];
    var dur = P[0] + Math.random() * (P[1] - P[0]);
    var f0 = (pitch || 1) * (kind === 'idle' ? 78 : 95) * (0.9 + Math.random() * 0.2);
    // fonte glótica: dente de serra + ruído de respiração
    var osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * (kind === 'alert' ? 1.25 : 1), t);
    if (kind === 'alert' || kind === 'die') { osc.frequency.linearRampToValueAtTime(f0 * 1.45, t + dur * 0.25); }
    osc.frequency.linearRampToValueAtTime(f0 * (kind === 'die' ? 0.55 : 0.8), t + dur);
    // tremor irregular (voz "quebrada")
    var jit = ctx.createOscillator(); jit.type = 'triangle'; jit.frequency.value = 5 + Math.random() * 4;
    var jg = ctx.createGain(); jg.gain.value = f0 * 0.06; jit.connect(jg); jg.connect(osc.frequency);
    var breath = ctx.createBufferSource(); breath.buffer = Au.noiseBuf; breath.loop = true;
    var bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1400; bf.Q.value = 0.6;
    var bg = ctx.createGain(); bg.gain.value = kind === 'idle' ? 0.35 : 0.55;
    breath.connect(bf); bf.connect(bg);
    // aspereza
    var shaper = ctx.createWaveShaper(); shaper.curve = Au.rasp;
    var pre = ctx.createGain(); pre.gain.value = 0.25 + P[3];
    osc.connect(pre); pre.connect(shaper);
    var mix = ctx.createGain(); mix.gain.value = 0.5;
    shaper.connect(mix); bg.connect(mix);
    // formantes (vogal "ô/á" abafada)
    var vw = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    var env = ctx.createGain();
    var amps = [1, 0.55, 0.18];
    for (var i = 0; i < 3; i++) {
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = vw[i] * (0.95 + Math.random() * 0.1); bp.Q.value = i === 0 ? 6 : 9;
      if (i === 0) { bp.frequency.linearRampToValueAtTime(vw[0] * 0.75, t + dur); }
      var ag = ctx.createGain(); ag.gain.value = amps[i] * 3;
      mix.connect(bp); bp.connect(ag); ag.connect(env);
    }
    // envelope
    var vol = { idle: 0.22, alert: 0.4, attack: 0.45, hurt: 0.35, die: 0.38 }[kind] || 0.3;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + Math.max(0.03, P[2] + 0.05));
    env.gain.setValueAtTime(1, t + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var out = output(sp, vol);
    env.connect(out);
    osc.start(t); jit.start(t); breath.start(t, Math.random());
    var end = t + dur + 0.1;
    osc.stop(end); jit.stop(end); breath.stop(end);
    Au.voices++;
    setTimeout(function () { Au.voices = Math.max(0, Au.voices - 1); }, (dur + 0.1) * 1000);
  }
  /* chamado pela IA: gemido ocioso (aggressive=false) ou rosnado ao ver o jogador */
  Au.groan = function (zb, aggressive) {
    if (!zb.voice) { zb.voice = 0.8 + ((zb.id * 7919) % 100) / 250 + (zb.look && zb.look.female ? 0.35 : 0); }
    zombieVoice(zb.x, zb.y, zb.z, aggressive ? 'alert' : 'idle', zb.voice);
  };
  Au.zombieAttack = function (zb) { zombieVoice(zb.x, zb.y, zb.z, 'attack', zb.voice || 1); };
  Au.zombieDie = function (zb) { zombieVoice(zb.x, zb.y, zb.z, 'die', zb.voice || 1); };

  /* ---------- passos (por superfície) ---------- */
  Au.step = function (run) {
    if (!ok()) { return; }
    var p = CP.Game.player;
    var F = CP.C.FLOOR;
    var f = CP.W.floor(Math.floor(p.x), Math.floor(p.y), CP.W.levelOf(p.z));
    var vol = run ? 0.09 : 0.05;
    if (f === F.GRASS || f === F.DARKGRASS || f === F.FIELD || f === F.FARM || f === F.DIRT) {
      noise(CENTER, 0.12, 900 + Math.random() * 300, 0.7, vol * 0.8, 'bandpass', 0.01);
      noise(CENTER, 0.08, 220, 1, vol * 0.6, 'lowpass', 0.005);
    } else if (f === F.WOOD || f === F.CARPET) {
      noise(CENTER, 0.07, 300, 2, vol, 'bandpass', 0.003);
      tone(CENTER, 140 + Math.random() * 30, 0.06, vol * 0.4, 'sine', 0.7);
    } else if (f === F.GRAVEL || f === F.SAND) {
      noise(CENTER, 0.14, 2500, 0.5, vol * 0.7, 'bandpass', 0.01);
    } else {
      noise(CENTER, 0.05, 1800, 1.5, vol * 0.7, 'bandpass', 0.002);
      noise(CENTER, 0.06, 250, 1, vol * 0.6, 'lowpass', 0.002);
    }
  };

  /* ---------- combate ---------- */
  Au.swing = function (type) {
    if (!ok()) { return; }
    if (type === 'miss') { noise(CENTER, 0.18, 900, 0.7, 0.06, 'bandpass', 0.05); return; }
    var heavy = type === 'blunt_long' || type === 'axe' || type === 'shove';
    noise(CENTER, heavy ? 0.22 : 0.15, heavy ? 700 : 1300, 0.8, 0.07, 'bandpass', 0.07, heavy ? 0.7 : 1.1);
  };
  Au.hit = function (type, killed, x, y, z) {
    if (!ok()) { return; }
    var sp = x !== undefined ? spatial(x, y, z, 25) : CENTER;
    if (type === 'blade_short' || type === 'blade_long' || type === 'axe' || type === 'spear') {
      noise(sp, 0.09, 3200, 2, 0.18, 'bandpass', 0.002);
      noise(sp, 0.18, 380, 1.5, 0.35, 'lowpass', 0.004);
    } else if (type === 'stomp') {
      noise(sp, 0.12, 160, 1, 0.5, 'lowpass', 0.002);
      noise(sp, 0.06, 1800, 3, 0.12, 'bandpass', 0.002);
    } else {
      noise(sp, 0.16, 180, 1, 0.45, 'lowpass', 0.002);
      tone(sp, 85, 0.12, 0.25, 'sine', 0.6);
    }
    if (killed) { noise(sp, 0.3, 300, 0.8, 0.25, 'lowpass', 0.01); }
  };
  Au.hurt = function (type) {
    if (!ok()) { return; }
    var p = CP.Game.player;
    // grito curto do jogador (voz humana: formantes de "a")
    var f0 = p.female ? 230 : 130;
    var ctx = Au.ctx, t = ctx.currentTime, dur = 0.35;
    var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * 1.3, t); o.frequency.exponentialRampToValueAtTime(f0, t + dur);
    var env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(1, t + 0.02); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var out = output(CENTER, 0.18);
    [800, 1200, 2600].forEach(function (fr, i) { var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = 7; var gg = ctx.createGain(); gg.gain.value = [3, 2, 0.8][i]; o.connect(bp); bp.connect(gg); gg.connect(env); });
    env.connect(out); o.start(t); o.stop(t + dur + 0.05);
    if (type === 'bite') { noise(CENTER, 0.15, 1200, 2, 0.15, 'bandpass', 0.003); }
  };

  /* ---------- mundo ---------- */
  Au.thump = function (x, y, z, glassy) {
    if (!ok()) { return; }
    var sp = spatial(x, y, z, 35);
    if (sp.g <= 0.01) { return; }
    noise(sp, 0.3, 110, 1.2, 0.55, 'lowpass', 0.003);
    tone(sp, 70, 0.2, 0.3, 'sine', 0.7);
    if (glassy) { noise(sp, 0.08, 3500, 3, 0.08, 'bandpass', 0.002); }
  };
  Au.glass = function (x, y) {
    if (!ok()) { return; }
    var sp = spatial(x, y, 0, 40);
    for (var i = 0; i < 6; i++) { (function (k) { setTimeout(function () { if (ok()) { noise(sp, 0.1 + Math.random() * 0.15, 2500 + Math.random() * 4000, 4, 0.12, 'bandpass', 0.002); } }, k * 35 + Math.random() * 30); })(i); }
    noise(sp, 0.12, 600, 1, 0.2, 'lowpass', 0.002);
  };
  Au.door = function (open) {
    if (!ok()) { return; }
    // rangido: fricção (dente de serra com tremor) num passa-banda
    var ctx = Au.ctx, t = ctx.currentTime, dur = 0.45;
    var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(open ? 320 : 260, t); o.frequency.linearRampToValueAtTime(open ? 520 : 200, t + dur);
    var am = ctx.createOscillator(); am.frequency.value = 30; var ag = ctx.createGain(); ag.gain.value = 0.5; am.connect(ag);
    var vca = ctx.createGain(); vca.gain.value = 0.5; ag.connect(vca.gain);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 5;
    var env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(1, t + 0.05); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(vca); vca.connect(bp); bp.connect(env); env.connect(output(CENTER, 0.22));
    o.start(t); am.start(t); o.stop(t + dur + 0.05); am.stop(t + dur + 0.05);
    if (!open) { setTimeout(function () { if (ok()) { noise(CENTER, 0.15, 150, 1, 0.25, 'lowpass', 0.002); } }, 380); }
  };
  Au.click = function () { if (ok()) { noise(CENTER, 0.03, 3000, 3, 0.08, 'bandpass', 0.001); } };
  Au.equip = function () { if (ok()) { noise(CENTER, 0.1, 1200, 1, 0.05, 'bandpass', 0.01); } };
  Au.breakItem = function () { if (ok()) { noise(CENTER, 0.25, 1800, 2, 0.15, 'bandpass', 0.002); noise(CENTER, 0.2, 300, 1, 0.2, 'lowpass', 0.002); } };
  Au.gunshot = function (x, y, near) {
    if (!ok()) { return; }
    var sp = near ? Object.assign({}, CENTER, { outdoor: true, d: 20 }) : spatial(x, y, 0, 120);
    noise(sp, 0.08, 2500, 0.7, 0.5, 'highpass', 0.001);
    noise(sp, 0.6, 400, 0.6, 0.7, 'lowpass', 0.001);
    tone(sp, 60, 0.35, 0.5, 'sine', 0.5, 0.001);
  };
  Au.reload = function () { if (ok()) { noise(CENTER, 0.05, 2200, 4, 0.12, 'bandpass', 0.001); setTimeout(function () { if (ok()) { noise(CENTER, 0.06, 1600, 4, 0.14, 'bandpass', 0.001); } }, 320); } };
  Au.alarm = function (x, y) {
    if (!ok()) { return; }
    var sp = spatial(x, y, 0, 80);
    if (sp.g <= 0.01) { return; }
    tone(sp, 950, 0.5, 0.18, 'square', 0.75, 0.01);
    setTimeout(function () { if (ok()) { tone(sp, 700, 0.5, 0.18, 'square', 1.3, 0.01); } }, 550);
  };
  /* buzina de carro: dois tons quadrados juntos */
  Au.horn = function (x, y) {
    if (!ok()) { return; }
    var sp = spatial(x, y, 0, 60);
    if (sp.g <= 0.01) { return; }
    tone(sp, 415, 0.6, 0.13, 'square', 1, 0.01); tone(sp, 520, 0.6, 0.1, 'square', 1, 0.01);
  };
  /* sirene: sobe e desce (chamada a cada ~1,2 s) */
  var sirenUp = false;
  Au.siren = function (x, y) {
    if (!ok()) { return; }
    var sp = spatial(x, y, 0, 90);
    if (sp.g <= 0.01) { return; }
    sirenUp = !sirenUp;
    tone(sp, sirenUp ? 620 : 1000, 1.15, 0.1, 'sawtooth', sirenUp ? 1.6 : 0.62, 0.02);
  };
  /* rádio do carro: chiado baixo com voz distante */
  Au.radioHum = function (x, y) {
    if (!ok()) { return; }
    var sp = spatial(x, y, 0, 14);
    if (sp.g <= 0.01) { return; }
    noise(sp, 1.2, 1800, 0.8, 0.035, 'bandpass', 0.05);
    for (var i = 0; i < 5; i++) { (function (k) { setTimeout(function () { if (ok()) { tone(spatial(x, y, 0, 14), 180 + Math.random() * 120, 0.18, 0.025, 'triangle', 1.1, 0.02); } }, k * 220); })(i); }
  };
  /* espirro ("ah... tchim") ou tosse (dois estouros graves); abafado no lenço */
  Au.sneeze = function (x, y, cough, muffled) {
    if (!ok()) { return; }
    var sp = spatial(x, y, 0, 20), k = muffled ? 0.35 : 1;
    if (sp.g <= 0.01) { return; }
    if (cough) {
      for (var i = 0; i < 2; i++) { (function (j) { setTimeout(function () { if (ok()) { noise(spatial(x, y, 0, 20), 0.16, 700, 1.2, 0.16 * k, muffled ? 'lowpass' : 'bandpass', 0.01); } }, j * 260); })(i); }
      return;
    }
    tone(sp, 330, 0.35, 0.03 * k, 'triangle', 1.3, 0.15);
    setTimeout(function () { if (ok()) { noise(spatial(x, y, 0, 20), 0.22, muffled ? 1200 : 2600, 0.9, 0.2 * k, muffled ? 'lowpass' : 'bandpass', 0.005); } }, 380);
  };
  Au.thunder = function () {
    if (!ok()) { return; }
    var sp = Object.assign({}, CENTER, { pan: Math.random() * 1.4 - 0.7, outdoor: true, d: 30 });
    setTimeout(function () { if (ok()) { noise(sp, 3, 70, 0.7, 0.6, 'lowpass', 0.25, 0.5); noise(sp, 0.6, 400, 0.6, 0.25, 'lowpass', 0.01); } }, 300 + Math.random() * 1500);
  };
  /* ---------- eventos distantes (tiros, gritos, cachorros...) ---------- */
  /* saída para som longe: passa-baixa pela distância, pan pela direção, muito eco */
  function farOut(pan, d, vol) {
    var ctx = Au.ctx;
    var g = ctx.createGain(); g.gain.value = vol * U.clamp(1.25 - d / 60, 0.25, 1);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = U.clamp(4200 - d * 45, 900, 3200);
    g.connect(lp);
    var node = lp;
    if (ctx.createStereoPanner) { var pn = ctx.createStereoPanner(); pn.pan.value = pan; lp.connect(pn); node = pn; }
    node.connect(Au.master);
    var send = ctx.createGain(); send.gain.value = 0.9; node.connect(send); send.connect(Au.reverbIn);
    return g;
  }
  function burst(o, t, dur, freq, type, q, vol, att) {
    var ctx = Au.ctx;
    var src = ctx.createBufferSource(); src.buffer = Au.noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    var e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + (att || 0.002)); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(e); e.connect(o); src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  function boom(o, t, f0, f1, dur, vol) {
    var ctx = Au.ctx, os = ctx.createOscillator(); os.type = 'sine';
    os.frequency.setValueAtTime(f0, t); os.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var e = ctx.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(e); e.connect(o); os.start(t); os.stop(t + dur + 0.05);
  }
  /* tiro com eco nos prédios */
  function farShot(o, t, v) {
    burst(o, t, 0.05, 2200, 'highpass', 0.7, 0.5 * v);
    burst(o, t, 0.5, 500, 'lowpass', 0.8, 0.9 * v);
    boom(o, t, 75, 38, 0.45, 0.6 * v);
    burst(o, t + 0.33, 0.6, 420, 'lowpass', 0.6, 0.3 * v, 0.02);
    burst(o, t + 0.85, 0.8, 350, 'lowpass', 0.6, 0.14 * v, 0.04);
  }
  /* voz humana: f0 e formantes (vogais) automatizados ao longo do tempo */
  var VOW = { a: [820, 1200, 2800], o: [520, 880, 2500], e: [560, 1700, 2600], u: [380, 800, 2400] };
  function humanVoice(o, t, pts, vowels, dur, vol, breathy) {
    var ctx = Au.ctx;
    var osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pts[0][1], t);
    for (var i = 1; i < pts.length; i++) { osc.frequency.linearRampToValueAtTime(pts[i][1], t + pts[i][0] * dur); }
    var vib = ctx.createOscillator(); vib.frequency.value = 5.5 + Math.random() * 1.5;
    var vg = ctx.createGain(); vg.gain.value = pts[0][1] * 0.035; vib.connect(vg); vg.connect(osc.frequency);
    var src = ctx.createBufferSource(); src.buffer = Au.noiseBuf; src.loop = true;
    var ng = ctx.createGain(); ng.gain.value = breathy || 0.25;
    var mix = ctx.createGain(); mix.gain.value = 0.5;
    var sh = ctx.createWaveShaper(); sh.curve = Au.rasp;
    var pre = ctx.createGain(); pre.gain.value = 0.35;
    osc.connect(pre); pre.connect(sh); sh.connect(mix); src.connect(ng); ng.connect(mix);
    var e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.05);
    e.gain.setValueAtTime(vol, t + dur * 0.75); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (var k = 0; k < 3; k++) {
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = k ? 10 : 7;
      bp.frequency.setValueAtTime(VOW[vowels[0][1]][k], t);
      for (var j = 1; j < vowels.length; j++) { bp.frequency.linearRampToValueAtTime(VOW[vowels[j][1]][k], t + vowels[j][0] * dur); }
      var ag = ctx.createGain(); ag.gain.value = [3, 2, 0.8][k];
      mix.connect(bp); bp.connect(ag); ag.connect(e);
    }
    e.connect(o);
    osc.start(t); vib.start(t); src.start(t, Math.random());
    osc.stop(t + dur + 0.05); vib.stop(t + dur + 0.05); src.stop(t + dur + 0.05);
  }
  /* horda ao longe: coro de gemidos graves (k = 0..1, mais perto = mais alto) */
  Au.hordeMoan = function (ang, dist, k) {
    if (!ok()) { return; }
    var pan = U.clamp((Math.cos(ang) - Math.sin(ang)) * 0.6, -0.9, 0.9);
    var o = farOut(pan, dist, 0.22 + 0.4 * k);
    var t = Au.ctx.currentTime + 0.05, n = 5 + Math.round(k * 4);
    for (var i = 0; i < n; i++) {
      var f0 = 70 + Math.random() * 45, dur = 1.8 + Math.random() * 1.6, t0 = t + Math.random() * 1.6;
      humanVoice(o, t0, [[0, f0], [0.4, f0 * 1.15], [1, f0 * 0.8]], [[0, 'o'], [0.5, 'u'], [1, 'o']], dur, 0.07 + Math.random() * 0.05, 0.5);
    }
    burst(o, t, 3.5, 160, 'lowpass', 0.5, 0.08 + 0.12 * k, 0.8); // passos arrastados de muitos
  };
  /* kind: gunshot, gunfire, scream, help, dogs, crash, glass, explosion, siren; ang = direção no mundo; dist = tiles */
  Au.distant = function (kind, ang, dist) {
    if (!ok()) { return; }
    var d = dist || 45;
    var pan = U.clamp((Math.cos(ang) - Math.sin(ang)) * 0.6, -0.9, 0.9);
    var ctx = Au.ctx, t = ctx.currentTime + 0.05, i;
    var female = Math.random() < 0.5;
    var o;
    if (kind === 'gunshot') {
      o = farOut(pan, d, 0.7); farShot(o, t, 1);
      if (Math.random() < 0.4) { farShot(o, t + U.randRange(1.5, 4), 0.9); }
    } else if (kind === 'gunfire') {
      o = farOut(pan, d, 0.6);
      var tt = t, n = 4 + ((Math.random() * 8) | 0);
      for (i = 0; i < n; i++) { farShot(o, tt, U.randRange(0.7, 1)); tt += Math.random() < 0.3 ? U.randRange(0.8, 2) : U.randRange(0.12, 0.35); }
    } else if (kind === 'scream') {
      o = farOut(pan, d, 0.5);
      var f0 = female ? 360 : 230;
      humanVoice(o, t, [[0, f0], [0.15, f0 * 1.45], [0.6, f0 * 1.35], [1, f0 * 0.8]], [[0, 'a'], [1, 'a']], U.randRange(1.4, 2.2), 1, 0.35);
      if (Math.random() < 0.55) { humanVoice(o, t + U.randRange(2.4, 3.2), [[0, f0 * 1.2], [0.3, f0 * 1.5], [1, f0 * 0.9]], [[0, 'a'], [0.6, 'e']], U.randRange(0.9, 1.4), 0.85, 0.4); }
    } else if (kind === 'help') {
      o = farOut(pan, d, 0.55);
      var b0 = female ? 300 : 175;
      for (i = 0; i < 3; i++) { // "so-CÔR-ro!"
        var ts = t + i * U.randRange(1.4, 1.9);
        burst(o, ts, 0.09, 5200, 'bandpass', 2, 0.25);
        humanVoice(o, ts + 0.08, [[0, b0], [0.35, b0 * 1.35], [0.65, b0 * 1.3], [1, b0 * 0.85]], [[0, 'o'], [0.3, 'o'], [0.55, 'u'], [1, 'u']], 0.75, 0.9, 0.3);
      }
    } else if (kind === 'dogs') {
      o = farOut(pan, d, 0.5);
      var dogs = 1 + (Math.random() < 0.5 ? 1 : 0);
      for (var dg = 0; dg < dogs; dg++) {
        var pf = dg ? 520 : 380, tb = t + dg * 0.6;
        for (i = 0; i < 4 + ((Math.random() * 4) | 0); i++) {
          humanVoice(o, tb, [[0, pf], [0.3, pf * 1.25], [1, pf * 0.7]], [[0, 'a'], [1, 'o']], 0.16, 0.9, 0.5);
          tb += Math.random() < 0.3 ? 0.9 : U.randRange(0.25, 0.4);
        }
      }
    } else if (kind === 'crash') {
      o = farOut(pan, d, 0.7);
      burst(o, t, 1.6, 300, 'lowpass', 0.6, 1);
      boom(o, t, 90, 35, 0.8, 0.7);
      [1700, 2600, 3900].forEach(function (f) { burst(o, t + 0.02, 1.4, f, 'bandpass', 25, 0.35); });
      for (i = 0; i < 6; i++) { burst(o, t + 0.1 + Math.random() * 0.6, 0.12, 4000 + Math.random() * 2500, 'bandpass', 6, 0.15); }
    } else if (kind === 'glass') {
      o = farOut(pan, Math.min(d, 30), 1.1);
      burst(o, t, 0.15, 900, 'lowpass', 1, 0.5);
      for (i = 0; i < 10; i++) { burst(o, t + Math.random() * 0.5, 0.08 + Math.random() * 0.15, 3000 + Math.random() * 4500, 'bandpass', 12, 0.3); }
    } else if (kind === 'explosion') {
      o = farOut(pan, d, 0.9);
      boom(o, t, 60, 22, 2.2, 1);
      burst(o, t, 3.2, 140, 'lowpass', 0.5, 1, 0.01);
      burst(o, t + 0.05, 0.4, 1400, 'bandpass', 0.6, 0.4);
      for (i = 0; i < 8; i++) { burst(o, t + 0.4 + Math.random() * 2.5, 0.06, 2500, 'bandpass', 3, 0.12); }
    } else if (kind === 'siren') {
      o = farOut(pan, d, 0.35);
      var os = ctx.createOscillator(); os.type = 'square';
      var lfo = ctx.createOscillator(); lfo.frequency.value = 0.22;
      var lg = ctx.createGain(); lg.gain.value = 280;
      os.frequency.value = 900; lfo.connect(lg); lg.connect(os.frequency);
      var se = ctx.createGain(); se.gain.setValueAtTime(0.0001, t); se.gain.exponentialRampToValueAtTime(0.5, t + 3); se.gain.setValueAtTime(0.5, t + 7); se.gain.exponentialRampToValueAtTime(0.0001, t + 12);
      var slp = ctx.createBiquadFilter(); slp.type = 'lowpass'; slp.frequency.value = 1800;
      os.connect(slp); slp.connect(se); se.connect(o);
      os.start(t); lfo.start(t); os.stop(t + 12.1); lfo.stop(t + 12.1);
    }
  };
  Au.hammer = function () { if (ok()) { noise(CENTER, 0.06, 2000, 4, 0.18, 'bandpass', 0.001); noise(CENTER, 0.08, 400, 2, 0.15, 'lowpass', 0.001); } };
  Au.chop = function () { if (ok()) { noise(CENTER, 0.12, 700, 1.5, 0.3, 'bandpass', 0.001); tone(CENTER, 110, 0.12, 0.15, 'sine', 0.6); } };
  Au.powerDown = function () { if (ok()) { tone(CENTER, 110, 2.5, 0.12, 'sine', 0.3); } };

  /* ---------- contínuos ---------- */
  /* helicóptero: (dx, dy) relativo ao jogador; null desliga */
  Au.heli = function (dx, dy) {
    if (!ok()) { return; }
    var ctx = Au.ctx;
    if (dx === null) {
      if (Au.heliNode) { var hn = Au.heliNode; hn.g.gain.setTargetAtTime(0, ctx.currentTime, 1); setTimeout(function () { try { hn.o.stop(); hn.src.stop(); } catch (e) { /* já parou */ } }, 3000); Au.heliNode = null; }
      return;
    }
    if (!Au.heliNode) {
      var src = ctx.createBufferSource(); src.buffer = Au.noiseBuf; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
      var am = ctx.createGain(); am.gain.value = 0.4;
      var o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 12; var og = ctx.createGain(); og.gain.value = 0.6;
      o.connect(og); og.connect(am.gain);
      var g = ctx.createGain(); g.gain.value = 0;
      var pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      src.connect(f); f.connect(am); am.connect(g);
      if (pn) { g.connect(pn); pn.connect(Au.master); } else { g.connect(Au.master); }
      src.start(); o.start();
      Au.heliNode = { src: src, o: o, g: g, pn: pn };
    }
    var d = Math.sqrt(dx * dx + dy * dy);
    Au.heliNode.g.gain.setTargetAtTime(Math.max(0.02, 0.7 * (1 - d / 100)), ctx.currentTime, 0.3);
    if (Au.heliNode.pn) { Au.heliNode.pn.pan.setTargetAtTime(U.clamp((dx - dy) / 30, -0.9, 0.9), ctx.currentTime, 0.3); }
  };
  /* motor do carro (level 0..1; null desliga) */
  Au.engine = function (level) {
    if (!ok()) { return; }
    var ctx = Au.ctx;
    if (level === null) { if (Au.engNode) { Au.engNode.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2); var en = Au.engNode; setTimeout(function () { try { en.o.stop(); en.o2.stop(); } catch (e) { /* já parou */ } }, 800); Au.engNode = null; } return; }
    if (!Au.engNode) {
      var o = ctx.createOscillator(); o.type = 'sawtooth';
      var o2 = ctx.createOscillator(); o2.type = 'square';
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 2;
      var g = ctx.createGain(); g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(Au.master);
      o.start(); o2.start();
      Au.engNode = { o: o, o2: o2, g: g, f: f };
    }
    var t = ctx.currentTime;
    Au.engNode.o.frequency.setTargetAtTime(32 + level * 70, t, 0.15);
    Au.engNode.o2.frequency.setTargetAtTime(16 + level * 35, t, 0.15);
    Au.engNode.f.frequency.setTargetAtTime(260 + level * 500, t, 0.15);
    Au.engNode.g.gain.setTargetAtTime(0.06 + level * 0.06, t, 0.1);
  };
  /* chuva (e vento leve ao ar livre) */
  Au.ambient = function (rain, outdoor) {
    if (!ok()) { return; }
    var ctx = Au.ctx;
    if (!Au.rainNode) {
      var src = ctx.createBufferSource(); src.buffer = Au.noiseBuf; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 0.4;
      var g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(Au.master); src.start();
      Au.rainNode = { g: g, f: f };
    }
    var target = rain > 0 ? rain * (outdoor ? 0.1 : 0.04) : 0;
    Au.rainNode.g.gain.setTargetAtTime(target, ctx.currentTime, 1.5);
    Au.rainNode.f.frequency.setTargetAtTime(outdoor ? 3000 : 900, ctx.currentTime, 1);
  };

  /* vento: ruído grave com rajadas lentas e um assobio leve quando forte (dentro de casa, abafado) */
  Au.wind = function (level, outdoor) {
    if (!ok()) { return; }
    var ctx = Au.ctx, t = ctx.currentTime;
    if (!Au.windNode) {
      var src = ctx.createBufferSource(); src.buffer = Au.noiseBuf; src.loop = true; src.playbackRate.value = 0.5;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.6;
      var w = ctx.createBiquadFilter(); w.type = 'bandpass'; w.frequency.value = 900; w.Q.value = 6;
      var g = ctx.createGain(); g.gain.value = 0;
      var gw = ctx.createGain(); gw.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(Au.master);
      src.connect(w); w.connect(gw); gw.connect(Au.master);
      src.start();
      Au.windNode = { g: g, gw: gw, f: f, w: w };
    }
    var n = Au.windNode, gust = 0.7 + Math.random() * 0.6;
    var v = Math.max(0, level - 0.1) * (outdoor ? 0.07 : 0.02) * gust;
    n.g.gain.setTargetAtTime(v, t, 1.2);
    n.f.frequency.setTargetAtTime((outdoor ? 300 : 180) + level * 400 * gust, t, 1.5);
    n.gw.gain.setTargetAtTime(level > 0.55 && outdoor ? (level - 0.55) * 0.03 * gust : 0, t, 1.5);
    n.w.frequency.setTargetAtTime(700 + Math.random() * 500, t, 2);
  };
  /* zumbido de moscas perto de um corpo (vol 0..1, pan -1..1) */
  Au.flies = function (vol, pan) {
    if (!ok()) { return; }
    var ctx = Au.ctx, t = ctx.currentTime;
    if (!Au.flyNode) {
      var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'sawtooth';
      o1.frequency.value = 196; o2.frequency.value = 211;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 7.5; var lg = ctx.createGain(); lg.gain.value = 18;
      lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 1.2;
      var g = ctx.createGain(); g.gain.value = 0;
      var pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      o1.connect(f); o2.connect(f); f.connect(g);
      if (pn) { g.connect(pn); pn.connect(Au.master); } else { g.connect(Au.master); }
      o1.start(); o2.start(); lfo.start();
      Au.flyNode = { g: g, pn: pn };
    }
    Au.flyNode.g.gain.setTargetAtTime(vol * 0.03, t, 0.6);
    if (Au.flyNode.pn) { Au.flyNode.pn.pan.setTargetAtTime(pan || 0, t, 0.4); }
  };
  /* fogo: estalos (intensidade 0..1 = tamanho do incêndio) e chiado da água apagando */
  Au.crackle = function (x, y, z, k) {
    if (!ok()) { return; }
    var sp = spatial(x, y, z, 26);
    if (sp.g <= 0.02) { return; }
    noise(sp, 0.03 + Math.random() * 0.04, 2500 + Math.random() * 2500, 2, 0.1 + k * 0.12, 'bandpass', 0.001);
    if (Math.random() < 0.4) { noise(sp, 0.25, 300, 0.8, 0.06 + k * 0.08, 'lowpass', 0.05); }
  };
  Au.hiss = function (x, y) { if (ok()) { noise(spatial(x, y, 0, 20), 0.9, 4000, 0.6, 0.25, 'highpass', 0.02); } };
  /* zumbi comendo: rasgar molhado e mastigar */
  Au.chew = function (x, y, z) {
    if (!ok()) { return; }
    var sp = spatial(x, y, z, 18);
    if (sp.g <= 0.02) { return; }
    noise(sp, 0.18, 420 + Math.random() * 200, 1.4, 0.22, 'lowpass', 0.01, 0.6 + Math.random() * 0.3);
    setTimeout(function () { if (ok()) { noise(sp, 0.07, 1400 + Math.random() * 600, 3, 0.12, 'bandpass', 0.002); } }, 120 + Math.random() * 120);
  };
  /* corvos levantando voo: grasnados e bater de asas */
  Au.crows = function (x, y, n) {
    if (!ok()) { return; }
    var sp = spatial(x, y, 0, 45);
    if (sp.g <= 0.01) { return; }
    for (var w = 0; w < 7; w++) { (function (k) { setTimeout(function () { if (ok()) { noise(sp, 0.07, 700 + Math.random() * 300, 1.2, 0.16 * (1 - k / 8), 'bandpass', 0.003); } }, k * 75); })(w); }
    var caws = Math.min(3, Math.max(1, Math.round(n / 2)));
    for (var c = 0; c < caws; c++) {
      (function (k) {
        setTimeout(function () {
          if (!ok()) { return; }
          var ctx = Au.ctx, t = ctx.currentTime;
          for (var r = 0; r < 2; r++) {
            var o = ctx.createOscillator(); o.type = 'sawtooth';
            var f0 = 560 + Math.random() * 120, t0 = t + r * 0.24;
            o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * 0.72, t0 + 0.2);
            var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 2.5;
            var ws = ctx.createWaveShaper(); ws.curve = Au.rasp;
            var env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t0); env.gain.exponentialRampToValueAtTime(1, t0 + 0.02); env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
            var out = output(sp, 0.13);
            o.connect(ws); ws.connect(bp); bp.connect(env); env.connect(out); o.start(t0); o.stop(t0 + 0.25);
          }
        }, 120 + k * 380 + Math.random() * 200);
      })(c);
    }
  };

  CP.Audio = Au;
})(window.CP = window.CP || {});
