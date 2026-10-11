/* Trilha sonora original, composta em tempo real com WebAudio (sem arquivos).
 * Três camadas que entram e saem conforme o perigo:
 *  - calma: violão dedilhado (corda sintetizada), piano com melodia que volta e pad quente; peças de 16-24
 *    compassos com introdução, partes A/B e final, separadas por silêncio
 *  - tensão: cello arrastado, drone, coração, notas dissonantes no agudo e ruídos metálicos
 *  - perseguição: tambores, baixo pulsando e acordes curtos
 * Mais "sustos" curtos: quando um zumbi te vê, nos eventos distantes e na morte.
 * Mixagem: nada abaixo de ~80 Hz (alto-falantes pequenos distorcem), timbres suaves e limitador no fim. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U;
  var MC = C.MUSIC;

  /* acordes como no violão (MIDI, do grave ao agudo) */
  var CH = {
    Am: [45, 52, 57, 60, 64], F: [41, 48, 53, 57, 60], C: [48, 52, 55, 60, 64], G: [43, 50, 55, 59, 62],
    Em: [40, 47, 52, 55, 59], Dm: [50, 57, 62, 65, 69], E: [40, 47, 52, 56, 59], Bb: [46, 53, 58, 62, 65],
    A: [45, 52, 57, 61, 64], Fmaj7: [41, 48, 52, 57, 60], Am7: [45, 52, 55, 60, 64]
  };
  var PROGS = {
    day: [['Am', 'F', 'C', 'G'], ['Am', 'Em', 'F', 'G'], ['Am7', 'Fmaj7', 'C', 'G'], ['F', 'C', 'Am', 'E']],
    night: [['Dm', 'Bb', 'F', 'A'], ['Am', 'Dm', 'E', 'Am'], ['Am', 'F', 'Dm', 'E']]
  };
  var TENSE = [[45, 46], [45, 51], [44, 45], [46, 47]]; // pares dissonantes (graves, uma oitava acima no cello)
  var CHASE = [['Am', 'F'], ['Am', 'Bb'], ['Dm', 'E']];
  /* dedilhado: índice da corda em cada colcheia (0 = baixo) */
  var PICKS = [[0, 2, 3, 4, 1, 3, 2, 4], [0, 3, 2, 3, 1, 4, 2, 3], [0, 2, 4, 2, 1, 2, 3, 2]];
  var SCALE = [57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81];

  var Mu = {
    volume: MC.VOLUME, bus: null, layers: null, revIn: null, level: null,
    intensity: 0, bump: 0, bumpT: 0, spotT: 0, dead: false,
    nextT: 0, step8: 0, bar: 0, bpm: MC.BPM_CALM, mode: 'calm',
    playing: false, restT: 2, pieceBars: 0, prog: PROGS.day[0], pick: PICKS[0], night: false, motif: null, chaseProg: CHASE[0]
  };

  function A() { return CP.Audio; }
  function mtof(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pickOf(a) { return a[(Math.random() * a.length) | 0]; }

  /* ---------- mixagem: camadas → bus → corta-grave → compressor suave → limitador → saída ---------- */
  function setup() {
    var ctx = A().ctx;
    Mu.bus = ctx.createGain();
    Mu.bus.gain.value = Mu.volume * MC.BUS_GAIN;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = MC.LOW_CUT; hp.Q.value = 0.7;
    var hp2 = ctx.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = MC.LOW_CUT; hp2.Q.value = 0.7;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.3;
    var lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
    Mu.bus.connect(hp); hp.connect(hp2); hp2.connect(comp); comp.connect(lim); lim.connect(A().out || ctx.destination);
    // reverb de sala grande: ruído com decaimento, suavizado (sem chiado agudo)
    var rl = Math.floor(ctx.sampleRate * 3.2);
    var ir = ctx.createBuffer(2, rl, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var ch = ir.getChannelData(c), prev = 0;
      for (var k = 0; k < rl; k++) { prev = prev * 0.6 + (Math.random() * 2 - 1) * 0.4; ch[k] = prev * Math.pow(1 - k / rl, 3); }
    }
    var rev = ctx.createConvolver(); rev.buffer = ir;
    Mu.revIn = ctx.createGain(); Mu.revIn.gain.value = 0.35;
    Mu.revIn.connect(rev); rev.connect(Mu.bus);
    Mu.layers = {};
    var sends = { calm: 0.7, tense: 0.6, chase: 0.25, sting: 0.6 };
    for (var name in sends) {
      var g = ctx.createGain(); g.gain.value = name === 'sting' ? 1 : 0;
      var s = ctx.createGain(); s.gain.value = sends[name];
      g.connect(Mu.bus); g.connect(s); s.connect(Mu.revIn);
      Mu.layers[name] = g;
    }
    Mu.level = { calm: 0, tense: 0, chase: 0, sting: 1 };
    Mu.nextT = ctx.currentTime + 0.1;
  }
  Mu.setVolume = function (v) {
    Mu.volume = v;
    if (Mu.bus) { Mu.bus.gain.setTargetAtTime(v * MC.BUS_GAIN, A().ctx.currentTime, 0.2); }
  };
  function out(layer, pan) {
    var ctx = A().ctx, g = ctx.createGain();
    if (pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(Mu.layers[layer]); } else { g.connect(Mu.layers[layer]); }
    return g;
  }

  /* ---------- instrumentos ---------- */
  /* violão: corda dedilhada (Karplus-Strong), buffer gerado uma vez por nota */
  var ksCache = {};
  function ksBuffer(n) {
    if (ksCache[n]) { return ksCache[n]; }
    var ctx = A().ctx, sr = ctx.sampleRate, f = mtof(n);
    var P = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * 2.6);
    var b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    var decay = 0.9965 + Math.min(0.003, (60 - n) * 0.00006), i, prev = 0;
    for (i = 0; i < P; i++) { prev = prev * 0.5 + (Math.random() * 2 - 1) * 0.5; d[i] = prev; } // ataque suave (palheta macia)
    for (i = P; i < len; i++) { d[i] = (d[i - P] + (i - P - 1 >= 0 ? d[i - P - 1] : 0)) * 0.5 * decay; }
    var peak = 0;
    for (i = 0; i < len; i++) { peak = Math.max(peak, Math.abs(d[i])); }
    for (i = 0; i < len; i++) { d[i] = d[i] / (peak || 1) * 0.6; }
    ksCache[n] = b;
    return b;
  }
  function guitar(layer, n, t, vel, pan) {
    var ctx = A().ctx;
    var src = ctx.createBufferSource(); src.buffer = ksBuffer(n);
    src.playbackRate.value = 1 + rnd(-0.002, 0.002);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400 + vel * 1600;
    var g = out(layer, pan);
    g.gain.setValueAtTime(0.22 * vel, t);
    g.gain.setTargetAtTime(0.0001, t + 2.2, 0.15);
    src.connect(lp); lp.connect(g); src.start(t); src.stop(t + 2.6);
  }
  /* piano: parciais levemente inarmônicos que somem em tempos diferentes + martelo */
  function piano(layer, n, t, vel, len) {
    var ctx = A().ctx, f = mtof(n);
    var dec = U.clamp(5 - (n - 48) * 0.07, 1.2, 5) * (len || 1);
    var g = out(layer, U.clamp((n - 64) / 30, -0.5, 0.5));
    g.gain.value = 0.11 * vel;
    var amps = [1, 0.42, 0.22, 0.1, 0.05];
    for (var k = 0; k < amps.length; k++) {
      var fk = f * (k + 1) * Math.sqrt(1 + 0.0004 * (k + 1) * (k + 1));
      if (fk > 9000) { break; }
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fk; o.detune.value = rnd(-2, 2);
      var e = ctx.createGain();
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(amps[k], t + 0.004);
      e.gain.exponentialRampToValueAtTime(0.0001, t + dec / (1 + k * 0.6));
      o.connect(e); e.connect(g); o.start(t); o.stop(t + dec + 0.05);
    }
    var src = ctx.createBufferSource(); src.buffer = A().noiseBuf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(4000, f * 4); bp.Q.value = 1.2;
    var he = ctx.createGain(); he.gain.setValueAtTime(0.12 * vel, t); he.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(bp); bp.connect(he); he.connect(g); src.start(t, Math.random()); src.stop(t + 0.06);
  }
  /* pad quente: triângulos levemente desafinados, bem filtrados, entrada lenta */
  function pad(layer, notes, t, dur, vel) {
    var ctx = A().ctx;
    var g = out(layer, 0);
    var peak = 0.03 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(2.5, dur * 0.4));
    g.gain.setValueAtTime(peak, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 2.5);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 0.5;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.1; var lg = ctx.createGain(); lg.gain.value = 180;
    lfo.connect(lg); lg.connect(lp.frequency); lp.connect(g);
    for (var i = 1; i < notes.length; i++) {
      for (var k = 0; k < 2; k++) {
        var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(notes[i]); o.detune.value = k ? 6 : -6;
        var a = ctx.createGain(); a.gain.value = 0.3;
        o.connect(a); a.connect(lp); o.start(t); o.stop(t + dur + 2.6);
      }
    }
    lfo.start(t); lfo.stop(t + dur + 2.6);
  }
  /* cello / corda arrastada: entrada lenta, vibrato, filtro de corpo de madeira */
  function bowed(layer, n, t, dur, vel, trem) {
    var ctx = A().ctx, f = mtof(n);
    var g = out(layer, rnd(-0.2, 0.2));
    var peak = 0.05 * vel;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(1.4, dur * 0.4));
    g.gain.setValueAtTime(peak, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1);
    var node = g;
    if (trem) {
      var tg = ctx.createGain(); tg.gain.value = 0.65;
      var tl = ctx.createOscillator(); tl.frequency.value = 7.5; var tlg = ctx.createGain(); tlg.gain.value = 0.35;
      tl.connect(tlg); tlg.connect(tg.gain); tg.connect(g); node = tg; tl.start(t); tl.stop(t + dur + 1.1);
    }
    var body = ctx.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = Math.min(2600, f * 5); body.Q.value = 0.8;
    body.connect(node);
    var vib = ctx.createOscillator(); vib.frequency.value = 5 + Math.random(); var vg = ctx.createGain(); vg.gain.value = 0;
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(8, t + 1.2);
    vib.connect(vg);
    [['sawtooth', 0.35, 0], ['triangle', 0.8, 4], ['sine', 0.5, -3]].forEach(function (w) {
      var o = ctx.createOscillator(); o.type = w[0]; o.frequency.value = f; o.detune.value = w[2];
      vg.connect(o.detune);
      var a = ctx.createGain(); a.gain.value = w[1];
      o.connect(a); a.connect(body); o.start(t); o.stop(t + dur + 1.1);
    });
    vib.start(t); vib.stop(t + dur + 1.1);
  }
  function heart(layer, t, vel) {
    var ctx = A().ctx;
    [0, 0.26].forEach(function (off, i) {
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(95, t + off); o.frequency.exponentialRampToValueAtTime(62, t + off + 0.16);
      var g = out(layer, 0);
      var pk = 0.22 * vel * (i ? 0.6 : 1);
      g.gain.setValueAtTime(0.0001, t + off); g.gain.exponentialRampToValueAtTime(pk, t + off + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.24);
      o.connect(g); o.start(t + off); o.stop(t + off + 0.26);
      // "toque" que dá presença em alto-falante pequeno
      var src = ctx.createBufferSource(); src.buffer = A().noiseBuf;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
      var cg = out(layer, 0); cg.gain.setValueAtTime(0.06 * vel, t + off); cg.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.05);
      src.connect(lp); lp.connect(cg); src.start(t + off, Math.random()); src.stop(t + off + 0.06);
    });
  }
  function tom(layer, t, vel, pitch) {
    var ctx = A().ctx, f0 = pitch || 150;
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.3);
    var g = out(layer, rnd(-0.15, 0.15));
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.26 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); o.start(t); o.stop(t + 0.42);
    var src = ctx.createBufferSource(); src.buffer = A().noiseBuf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8;
    var ng = out(layer, 0); ng.gain.setValueAtTime(0.09 * vel, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(bp); bp.connect(ng); src.start(t, Math.random()); src.stop(t + 0.1);
  }
  function shaker(layer, t, vel) {
    var ctx = A().ctx;
    var src = ctx.createBufferSource(); src.buffer = A().noiseBuf;
    var hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 6000; hp.Q.value = 0.7;
    var g = out(layer, rnd(-0.3, 0.3));
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.025 * vel, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(hp); hp.connect(g); src.start(t, Math.random()); src.stop(t + 0.08);
  }
  /* baixo pulsando (região média-grave, audível em qualquer alto-falante) */
  function pulse(layer, n, t, dur, vel) {
    var ctx = A().ctx;
    var g = out(layer, 0);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1 * vel, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1100, t); lp.frequency.exponentialRampToValueAtTime(300, t + dur); lp.Q.value = 1;
    lp.connect(g);
    [['triangle', 1, 0], ['sawtooth', 0.25, 7]].forEach(function (w) {
      var o = ctx.createOscillator(); o.type = w[0]; o.frequency.value = mtof(n); o.detune.value = w[2];
      var a = ctx.createGain(); a.gain.value = w[1]; o.connect(a); a.connect(lp); o.start(t); o.stop(t + dur + 0.02);
    });
  }
  /* acorde curto de cordas (staccato) */
  function stab(layer, notes, t, vel) {
    notes.forEach(function (n) { bowed(layer, n, t, 0.18, vel * 0.9, false); });
  }
  function drone(layer, n, t, dur) {
    var ctx = A().ctx;
    var g = out(layer, 0);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.5);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.connect(g);
    [0, 7, -5].forEach(function (dt2, i) { var o = ctx.createOscillator(); o.type = i ? 'triangle' : 'sine'; o.frequency.value = mtof(n) * (i === 2 ? 1.5 : 1); o.detune.value = dt2; o.connect(lp); o.start(t); o.stop(t + dur + 1.6); });
    // vento por baixo
    var src = ctx.createBufferSource(); src.buffer = A().noiseBuf; src.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(rnd(350, 600), t); bp.frequency.linearRampToValueAtTime(rnd(500, 900), t + dur); bp.Q.value = 1.5;
    var wg = out(layer, rnd(-0.5, 0.5)); wg.gain.setValueAtTime(0.0001, t); wg.gain.exponentialRampToValueAtTime(0.035, t + dur * 0.5); wg.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1);
    src.connect(bp); bp.connect(wg); src.start(t, Math.random()); src.stop(t + dur + 1.1);
  }
  /* ruído metálico arrastado (textura de tensão) */
  function scrape(layer, t, dur, vel) {
    var ctx = A().ctx;
    var src = ctx.createBufferSource(); src.buffer = A().noiseBuf; src.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 14;
    bp.frequency.setValueAtTime(rnd(1400, 2200), t); bp.frequency.exponentialRampToValueAtTime(rnd(2600, 3800), t + dur);
    var g = out(layer, rnd(-0.7, 0.7));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045 * vel, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  /* ---------- intensidade a partir do jogo ---------- */
  function measure() {
    var G = CP.Game, p = G && G.player;
    if (!G || !G.running || !p || p.dead) { return 0; }
    var chase = 0, near = 0, nearest = 99;
    for (var i = 0; i < G.zombies.length; i++) {
      var zb = G.zombies[i];
      if (zb.state === 'fakedead' || zb.state === 'down') { continue; }
      var d = U.dist(zb.x, zb.y, p.x, p.y);
      if (d < nearest) { nearest = d; }
      if ((zb.state === 'chase' || zb.state === 'attack' || zb.state === 'bash') && d < 22) { chase++; } else if (d < 9) { near++; }
    }
    var I = 0;
    if (near > 0 || (p.body && p.body.stats.panic > 25)) { I = 1; }
    if (chase > 0) { I = Math.max(I, nearest < 6 || chase >= 3 ? 2.2 : 1.6); }
    if (chase >= 6) { I = 3; }
    if (p.sleeping) { I = Math.min(I, 0.5); }
    return Math.max(I, Mu.bump);
  }

  /* ---------- composição ---------- */
  function newPiece() {
    var T = CP.Time, G = CP.Game;
    Mu.night = !!(G && G.running && T && T.isNight && T.isNight());
    Mu.prog = pickOf(Mu.night ? PROGS.night : PROGS.day);
    Mu.pick = pickOf(PICKS);
    Mu.pieceBars = MC.PIECE_BARS_MIN + ((Math.random() * (MC.PIECE_BARS_MAX - MC.PIECE_BARS_MIN)) | 0);
    Mu.pieceBars -= Mu.pieceBars % 4;
    Mu.motif = makeMotif();
    Mu.playing = true; Mu.bar = -1; Mu.step8 = 0;
  }
  /* motivo de 2 compassos: ritmo (em colcheias) e graus da escala; volta várias vezes, encaixado no acorde */
  function makeMotif() {
    var rhythms = [[0, 3, 4, 6, 8, 12], [0, 2, 4, 8, 11], [0, 4, 6, 7, 8, 12], [2, 4, 5, 8, 12]];
    var r = pickOf(rhythms), deg = [], cur = 7 + ((Math.random() * 3) | 0);
    for (var i = 0; i < r.length; i++) { deg.push(cur); cur = U.clamp(cur + pickOf([-2, -1, -1, 1, 1, 2, 0, -3]), 4, SCALE.length - 2); }
    deg[deg.length - 1] = deg[0] - pickOf([0, 2, 3]);
    return { r: r, deg: deg, len: [2, 1, 1, 2, 3, 2].slice(0, r.length) };
  }
  function nearestChordTone(n, chord) {
    var best = n, bd = 99;
    for (var i = 1; i < chord.length; i++) { for (var o = -24; o <= 24; o += 12) { var c = chord[i] + o, d = Math.abs(c - n); if (d < bd) { bd = d; best = c; } } }
    return bd <= 2 ? best : n;
  }
  function stepDur() { return 60 / Mu.bpm / 2; }
  function step(t) {
    var s = Mu.step8, lv = Mu.level;
    if (s === 0) { // começo de compasso
      Mu.bar++;
      Mu.mode = Mu.intensity >= 1.5 ? 'chase' : (Mu.intensity >= 0.75 ? 'tense' : 'calm');
      Mu.bpm = Mu.mode === 'chase' ? MC.BPM_CHASE : (Mu.mode === 'tense' ? MC.BPM_TENSE : (Mu.night ? MC.BPM_NIGHT : MC.BPM_CALM));
      if (Mu.playing && Mu.mode === 'calm' && Mu.bar >= Mu.pieceBars) { Mu.playing = false; Mu.restT = rnd(MC.REST_MIN, MC.REST_MAX); }
      if (Mu.mode === 'chase' && Mu.bar % 4 === 0) { Mu.chaseProg = pickOf(CHASE); }
    }
    var barLen = stepDur() * 8, b = Math.max(0, Mu.bar);
    // camada calma: violão sempre, pad a partir do 3º compasso, piano nas partes B (e nunca no final)
    if (Mu.playing && lv.calm > 0.04) {
      var chord = CH[Mu.prog[Math.floor(b / 2) % Mu.prog.length]];
      var outro = b >= Mu.pieceBars - 2, intro = b < 2;
      var vStr = Mu.pick[s];
      var playNote = !(outro && s % 2 === 1) && !(intro && b === 0 && s > 4);
      if (playNote) {
        var gn = chord[Math.min(vStr, chord.length - 1)] + (vStr === 0 && s === 4 ? 0 : 0);
        guitar('calm', gn, t + rnd(0, 0.012), (s === 0 ? 0.95 : (s === 4 ? 0.75 : 0.55)) * (outro ? 0.7 : 1), (vStr - 2) * 0.15);
      }
      if (s === 0 && b % 2 === 0 && b >= 2 && !outro) { pad('calm', chord, t, barLen * 2, Mu.night ? 1 : 0.8); }
      var section = Math.floor(b / 4);
      if (!intro && !outro && section % 2 === 1 && Mu.motif) {
        var pos = (b % 2) * 8 + s, mi = Mu.motif.r.indexOf(pos);
        if (mi >= 0) {
          var n = SCALE[Mu.motif.deg[mi]] + (Mu.night ? -12 : 0) + (section >= 3 ? 12 : 0);
          piano('calm', nearestChordTone(n, chord), t, rnd(0.55, 0.8), 1);
        }
      }
      if (outro && s === 0 && b === Mu.pieceBars - 1) { piano('calm', chord[0] + 24, t + barLen * 0.5, 0.5, 1.6); }
    }
    // camada de tensão
    if (lv.tense > 0.04) {
      var tp = TENSE[Math.floor(b / 2) % TENSE.length];
      if (s === 0 && b % 2 === 0) { bowed('tense', tp[0] + 12, t, barLen * 2, 1, false); drone('tense', tp[0] + 24, t, barLen * 2); }
      if (s === 0 && b % 4 === 2) { bowed('tense', tp[1] + 24, t + barLen * 0.5, barLen * 1.5, 0.6, true); }
      if (s === 0 || s === 4) { heart('tense', t, Mu.intensity > 1.2 ? 1 : 0.7); }
      if (s === 0 && Math.random() < 0.15) { scrape('tense', t + rnd(0, barLen * 0.5), rnd(2, 4), 0.8); }
      if (s % 4 === 2 && Math.random() < 0.12) { var hn = tp[0] + 36 + pickOf([0, 1, 6]); piano('tense', hn, t, 0.5, 1.4); piano('tense', hn + 1, t + 0.02, 0.35, 1.4); }
    }
    // camada de perseguição
    if (lv.chase > 0.04) {
      var cc = CH[Mu.chaseProg[Math.floor(b / 2) % 2]];
      var pat = [1, 0, 1, 0, 1, 1, 0, 1];
      if (s === 0 || s === 4) { tom('chase', t, 1, 110); }
      if (pat[s] && s !== 0 && s !== 4) { tom('chase', t, 0.6, 170); }
      shaker('chase', t, s % 2 ? 0.6 : 1);
      pulse('chase', cc[0] + 12 + (s % 4 === 3 ? 7 : 0), t, stepDur() * 0.85, s === 0 ? 1 : 0.7);
      if (s === 0 || s === 3) { stab('chase', [cc[2] + 12, cc[3] + 12], t, s === 0 ? 1 : 0.7); }
    }
    Mu.step8 = (s + 1) % 8;
  }

  /* ---------- por quadro ---------- */
  Mu.update = function (dt) {
    var Au = A();
    if (!Au || !Au.ctx || !Au.enabled || Au.ctx.state !== 'running') { return; }
    if (!Mu.bus) { setup(); }
    var ctx = Au.ctx;
    Mu.bumpT -= dt;
    if (Mu.bumpT <= 0) { Mu.bump = 0; }
    Mu.spotT -= dt;
    var target = Mu.dead ? 0 : measure();
    var k = target > Mu.intensity ? Math.min(1, dt / MC.RISE) : Math.min(1, dt / MC.FALL);
    Mu.intensity += (target - Mu.intensity) * k;
    var I = Mu.intensity;
    var lv = Mu.level;
    lv.calm = Mu.dead ? 0 : (I < 0.6 ? 1 : (I < 1.4 ? 0.35 : 0.08));
    lv.tense = Mu.dead ? 0 : U.clamp(I, 0, 1) * (I > 2.4 ? 0.6 : 1);
    lv.chase = Mu.dead ? 0 : U.clamp(I - 1.4, 0, 1);
    for (var name in lv) { if (name !== 'sting') { Mu.layers[name].gain.setTargetAtTime(lv[name], ctx.currentTime, 0.8); } }
    // descanso entre peças calmas (depois de um susto, a música volta mais cedo)
    if (!Mu.playing && !Mu.dead) {
      Mu.restT -= dt * (I > 0.75 ? 4 : 1);
      if (Mu.restT <= 0) { newPiece(); }
    }
    if (Mu.nextT < ctx.currentTime - 0.5) { Mu.nextT = ctx.currentTime + 0.05; } // voltou de aba escondida
    var ahead = ctx.currentTime + 0.25;
    while (Mu.nextT < ahead) { step(Mu.nextT); Mu.nextT += stepDur(); }
  };

  /* ---------- sustos e eventos ---------- */
  function ready() { var Au = A(); return Au && Au.ctx && Au.enabled && Au.ctx.state === 'running' && Mu.bus && !Mu.dead; }
  /* um zumbi acabou de ver o jogador: pancada + cordas dissonantes subindo */
  Mu.spotted = function () {
    if (!ready() || Mu.spotT > 0) { return; }
    Mu.spotT = MC.SPOT_COOLDOWN;
    var t = A().ctx.currentTime + 0.02;
    tom('sting', t, 1, 120); tom('sting', t + 0.01, 0.8, 90);
    [57, 58, 63, 69, 70].forEach(function (n, i) { bowed('sting', n, t + i * 0.03, 1.6, 0.9, true); });
    piano('sting', 81, t, 0.7, 1.2); piano('sting', 82, t + 0.01, 0.6, 1.2);
    Mu.bump = 1.6; Mu.bumpT = 10;
  };
  /* som distante (tiro, grito...): arrepio curto e um pouco de tensão */
  Mu.event = function () {
    if (!ready()) { return; }
    var t = A().ctx.currentTime + 1.2;
    scrape('sting', t, 3.5, 1);
    bowed('sting', 58, t + 0.3, 3, 0.7, false);
    piano('sting', 70, t + 0.6, 0.5, 1.6);
    Mu.bump = Math.max(Mu.bump, 1); Mu.bumpT = Math.max(Mu.bumpT, 18);
  };
  Mu.death = function () {
    if (!ready()) { return; }
    Mu.dead = true;
    var t = A().ctx.currentTime + 0.8;
    [76, 74, 72, 71, 69, 64].forEach(function (n, i) { piano('sting', n, t + i * 0.95, 0.75 - i * 0.06, 1.8); });
    pad('sting', CH.Am, t, 6, 1.4);
    bowed('sting', 57, t + 1, 5, 0.8, false);
  };
  Mu.reset = function () { Mu.dead = false; Mu.intensity = 0; Mu.bump = 0; Mu.playing = false; Mu.restT = 3; };

  CP.Music = Mu;
})(window.CP = window.CP || {});
