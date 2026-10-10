/* Trilha sonora original, composta em tempo real com WebAudio (sem arquivos).
 * Três camadas que entram e saem conforme o perigo:
 *  - calma: piano esparso, violão dedilhado e pads (peças de 16-28 compassos com silêncio entre elas)
 *  - tensão: drone grave, batida de coração, cordas e ruídos metálicos (zumbi perto ou pânico)
 *  - perseguição: percussão grave, ostinato no baixo e cordas em trêmulo (zumbis atrás de você)
 * Mais "sustos" curtos: quando um zumbi te vê, nos eventos distantes e na morte. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U;
  var MC = C.MUSIC;

  /* acordes em lá menor (o 1º número é o baixo); a peça é transposta por KEYS */
  var PROG = {
    day: [[45, 57, 60, 64, 71], [41, 53, 57, 60, 64], [48, 55, 62, 64, 67], [40, 52, 55, 59, 62]],
    day2: [[45, 57, 60, 64, 67], [38, 50, 53, 57, 64], [41, 53, 57, 60, 67], [43, 55, 59, 62, 65]],
    night: [[38, 50, 53, 57, 64], [34, 46, 53, 57, 62], [43, 55, 58, 62, 69], [45, 57, 61, 64, 69]],
    tense: [[33, 45, 52, 57], [34, 46, 53, 58], [33, 45, 52, 57], [31, 43, 50, 55]],
    chase: [[33, 45, 52, 57, 60], [34, 46, 53, 58, 62], [31, 43, 50, 55, 59], [34, 46, 53, 58, 62]]
  };
  var SCALE = [57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];
  var KEYS = [0, 5, -2, 3];
  var ARP = [1, 2, 3, 2, 4, 3, 2, 3];

  var Mu = {
    volume: MC.VOLUME, bus: null, layers: null, revIn: null,
    intensity: 0, bump: 0, bumpT: 0, spotT: 0, dead: false,
    nextT: 0, step8: 0, bar: 0, chordI: 0, per: 2, changed: false, bpm: MC.BPM_CALM, mode: 'calm',
    playing: false, restT: 2, pieceBars: 0, prog: PROG.day, key: 0, arp: true, night: false,
    phrase: false, melLast: 7, motif: null, motifI: 0
  };

  function A() { return CP.Audio; }
  function mtof(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------- montagem: camadas → barramento da música → master (com reverb longo próprio) ---------- */
  function setup() {
    var ctx = A().ctx;
    Mu.bus = ctx.createGain();
    Mu.bus.gain.value = Mu.volume * MC.BUS_GAIN;
    Mu.bus.connect(A().master);
    var rl = Math.floor(ctx.sampleRate * 3.8);
    var ir = ctx.createBuffer(2, rl, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var ch = ir.getChannelData(c); for (var k = 0; k < rl; k++) { ch[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / rl, 2.6); } }
    var rev = ctx.createConvolver(); rev.buffer = ir;
    Mu.revIn = ctx.createGain(); Mu.revIn.gain.value = 0.5;
    Mu.revIn.connect(rev); rev.connect(Mu.bus);
    Mu.layers = {};
    var sends = { calm: 0.75, tense: 0.6, chase: 0.3, sting: 0.7 };
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
  function env(g, t, peak, att, dec, sus, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + att);
    if (sus) { g.gain.exponentialRampToValueAtTime(peak * sus, t + att + dec); }
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  }

  /* ---------- instrumentos ---------- */
  function piano(layer, n, t, vel, len) {
    var ctx = A().ctx, f = mtof(n);
    var dec = U.clamp(4.6 - (n - 48) * 0.06, 1.4, 5) * (len || 1);
    var g = out(layer, rnd(-0.35, 0.35));
    env(g, t, 0.2 * vel, 0.006, 0.3, 0.35, t + dec);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.6), t + dec * 0.7);
    lp.connect(g);
    var parts = [1, 2, 3, 4.02], amps = [1, 0.45, 0.2, 0.08];
    for (var i = 0; i < parts.length; i++) {
      var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * parts[i]; o.detune.value = rnd(-4, 4);
      var a = ctx.createGain(); a.gain.value = amps[i];
      o.connect(a); a.connect(lp); o.start(t); o.stop(t + dec + 0.05);
    }
  }
  function pluck(layer, n, t, vel) {
    var ctx = A().ctx, f = mtof(n), dec = 1.8;
    var g = out(layer, rnd(-0.5, 0.5));
    env(g, t, 0.12 * vel, 0.004, 0.15, 0.4, t + dec);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(420, t + 0.5);
    lp.connect(g);
    var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    var o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f; o2.detune.value = 5;
    var m2 = ctx.createGain(); m2.gain.value = 0.35;
    o.connect(lp); o2.connect(m2); m2.connect(lp);
    o.start(t); o2.start(t); o.stop(t + dec); o2.stop(t + dec);
  }
  function pad(layer, notes, t, dur, vel) {
    var ctx = A().ctx;
    var g = out(layer, 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * vel, t + Math.min(2, dur * 0.4));
    g.gain.setValueAtTime(0.05 * vel, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 2);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.7;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.12; var lg = ctx.createGain(); lg.gain.value = 250;
    lfo.connect(lg); lg.connect(lp.frequency);
    lp.connect(g);
    for (var i = 1; i < notes.length; i++) {
      for (var k = 0; k < 2; k++) {
        var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(notes[i]); o.detune.value = k ? 7 : -7;
        var a = ctx.createGain(); a.gain.value = 0.18;
        o.connect(a); a.connect(lp); o.start(t); o.stop(t + dur + 2.1);
      }
    }
    lfo.start(t); lfo.stop(t + dur + 2.1);
  }
  function strings(layer, notes, t, dur, vel, trem) {
    var ctx = A().ctx;
    var g = out(layer, 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045 * vel, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
    var node = g;
    if (trem) {
      var tg = ctx.createGain(); tg.gain.value = 0.6;
      var lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 9;
      var lg = ctx.createGain(); lg.gain.value = 0.4;
      lfo.connect(lg); lg.connect(tg.gain); tg.connect(g); node = tg;
      lfo.start(t); lfo.stop(t + dur + 0.9);
    }
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
    lp.connect(node);
    notes.forEach(function (n) {
      for (var k = 0; k < 2; k++) {
        var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = k ? 9 : -9;
        var vib = ctx.createOscillator(); vib.frequency.value = 5 + Math.random(); var vg = ctx.createGain(); vg.gain.value = 4;
        vib.connect(vg); vg.connect(o.detune);
        var a = ctx.createGain(); a.gain.value = 0.25;
        o.connect(a); a.connect(lp); o.start(t); vib.start(t); o.stop(t + dur + 0.9); vib.stop(t + dur + 0.9);
      }
    });
  }
  function heart(layer, t, vel) {
    var ctx = A().ctx;
    [0, 0.24].forEach(function (off, i) {
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(62, t + off); o.frequency.exponentialRampToValueAtTime(38, t + off + 0.2);
      var g = out(layer, 0);
      env(g, t + off, 0.5 * vel * (i ? 0.65 : 1), 0.004, 0, 0, t + off + 0.28);
      o.connect(g); o.start(t + off); o.stop(t + off + 0.3);
    });
  }
  function drum(layer, t, vel) {
    var ctx = A().ctx;
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(100, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.35);
    var g = out(layer, 0);
    env(g, t, 0.6 * vel, 0.003, 0, 0, t + 0.5);
    o.connect(g); o.start(t); o.stop(t + 0.55);
    var src = ctx.createBufferSource(); src.buffer = A().noiseBuf;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    var ng = out(layer, 0);
    env(ng, t, 0.25 * vel, 0.002, 0, 0, t + 0.15);
    src.connect(lp); lp.connect(ng); src.start(t, Math.random()); src.stop(t + 0.2);
  }
  function hat(layer, t, vel) {
    var ctx = A().ctx;
    var src = ctx.createBufferSource(); src.buffer = A().noiseBuf;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
    var g = out(layer, rnd(-0.3, 0.3));
    env(g, t, 0.05 * vel, 0.002, 0, 0, t + 0.06);
    src.connect(hp); hp.connect(g); src.start(t, Math.random()); src.stop(t + 0.08);
  }
  function bassSaw(layer, n, t, dur, vel) {
    var ctx = A().ctx;
    var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(180, t + dur);
    var g = out(layer, 0);
    env(g, t, 0.16 * vel, 0.005, 0, 0, t + dur);
    o.connect(lp); lp.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }
  /* ruído metálico arrastado (textura de tensão) */
  function scrape(layer, t, dur, vel) {
    var ctx = A().ctx;
    var src = ctx.createBufferSource(); src.buffer = A().noiseBuf; src.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 18;
    bp.frequency.setValueAtTime(rnd(1800, 2600), t); bp.frequency.exponentialRampToValueAtTime(rnd(3000, 4500), t + dur);
    var g = out(layer, rnd(-0.7, 0.7));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 * vel, t + dur * 0.7);
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

  /* ---------- sequenciador (colcheias, agendadas um pouco à frente) ---------- */
  function newPiece() {
    var T = CP.Time, G = CP.Game;
    Mu.night = !!(G && G.running && T && T.isNight && T.isNight());
    Mu.prog = Mu.night ? PROG.night : (Math.random() < 0.5 ? PROG.day : PROG.day2);
    Mu.key = KEYS[(Math.random() * KEYS.length) | 0];
    Mu.arp = Math.random() < 0.65;
    Mu.pieceBars = MC.PIECE_BARS_MIN + ((Math.random() * (MC.PIECE_BARS_MAX - MC.PIECE_BARS_MIN)) | 0);
    Mu.playing = true; Mu.chordI = 0; Mu.bar = 0; Mu.motif = null;
  }
  function stepDur() { return 60 / Mu.bpm / 2; }
  function chordNow() {
    var P = Mu.mode === 'chase' ? PROG.chase : (Mu.mode === 'tense' ? PROG.tense : Mu.prog);
    var c = P[Mu.chordI % P.length];
    var k = Mu.mode === 'calm' ? Mu.key : 0;
    return c.map(function (n) { return n + k; });
  }
  function melodyNote(chord) {
    // passeio pela escala, puxando para notas do acorde
    var tones = chord.slice(1).map(function (n) { return ((n - Mu.key) % 12 + 12) % 12; });
    var i = U.clamp(Mu.melLast + ((Math.random() * 5) | 0) - 2, 2, SCALE.length - 1);
    for (var tries = 0; tries < 3 && tones.indexOf(SCALE[i] % 12) < 0 && Math.random() < 0.7; tries++) { i = U.clamp(i + (Math.random() < 0.5 ? 1 : -1), 2, SCALE.length - 1); }
    Mu.melLast = i;
    return SCALE[i] + Mu.key;
  }
  function step(t) {
    var s = Mu.step8, lv = Mu.level;
    if (s === 0) { // começo de compasso
      Mu.bar++;
      Mu.mode = Mu.intensity >= 1.5 ? 'chase' : (Mu.intensity >= 0.75 ? 'tense' : 'calm');
      Mu.bpm = Mu.mode === 'chase' ? MC.BPM_CHASE : (Mu.mode === 'tense' ? MC.BPM_TENSE : (Mu.night ? MC.BPM_NIGHT : MC.BPM_CALM));
      Mu.per = Mu.mode === 'calm' ? 2 : 1;
      Mu.changed = Mu.bar % Mu.per === 0;
      if (Mu.changed) { Mu.chordI++; }
      if (Mu.playing && Mu.mode === 'calm' && Mu.bar > Mu.pieceBars) { Mu.playing = false; Mu.restT = rnd(MC.REST_MIN, MC.REST_MAX); }
      Mu.phrase = Math.random() < (Mu.night ? 0.45 : 0.6);
    }
    var chord = chordNow();
    var barLen = stepDur() * 8;
    // camada calma
    if (Mu.playing && lv.calm > 0.04) {
      if (s === 0 && Mu.changed) {
        pad('calm', chord, t, barLen * Mu.per, Mu.night ? 0.8 : 0.6);
        piano('calm', chord[0] + 12, t, 0.45, 1.3);
      }
      if (Mu.arp && Math.random() < 0.85) { pluck('calm', chord[ARP[s] % chord.length] + 12, t, s % 2 ? 0.55 : 0.8); }
      if (Mu.phrase) {
        var pm = (s % 2 === 0 ? 0.32 : 0.1) * (Mu.night ? 0.7 : 1);
        if (Math.random() < pm) {
          var n;
          if (Mu.motif && Mu.motifI < Mu.motif.length && Math.random() < 0.6) { n = Mu.motif[Mu.motifI++]; } else { n = melodyNote(chord); }
          piano('calm', n, t, rnd(0.45, 0.8), 1);
          if (!Mu.motif || Mu.motif.length < 4) { (Mu.motif = Mu.motif || []).push(n); }
        }
      }
      if (s === 0 && Mu.bar % 8 === 0) { Mu.motifI = 0; }
    }
    // camada de tensão
    if (lv.tense > 0.04) {
      if (s === 0 && Mu.bar % 2 === 0) { strings('tense', [chord[0], chord[1], chord[0] + 13], t, barLen * 2, 0.9, false); }
      if (s === 0 || s === 4) { heart('tense', t, Mu.intensity > 1.2 ? 1 : 0.7); }
      if (s === 0 && Math.random() < 0.18) { scrape('tense', t + rnd(0, barLen * 0.5), rnd(2, 4), 0.8); }
      if (s % 2 === 0 && Math.random() < 0.08) { piano('tense', (Math.random() < 0.5 ? 45 : 46) + (Math.random() < 0.5 ? 12 : 0), t, 0.6, 1.4); }
    }
    // camada de perseguição
    if (lv.chase > 0.04) {
      var pat = [1, 0, 0, 1, 1, 0, 1, 0];
      if (pat[s]) { drum('chase', t, s === 0 ? 1 : 0.7); }
      if (s % 2 === 1) { hat('chase', t, 1); }
      bassSaw('chase', chord[0] + (s % 4 === 2 ? 12 : 0), t, stepDur() * 0.9, s === 0 ? 1 : 0.7);
      if (s === 0) { strings('chase', chord.slice(2).map(function (n) { return n + 12; }), t, barLen, 0.7, true); }
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
    lv.calm = Mu.dead ? 0 : (I < 0.6 ? 1 : (I < 1.4 ? 0.45 : 0.12));
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
  /* um zumbi acabou de ver o jogador */
  Mu.spotted = function () {
    if (!ready() || Mu.spotT > 0) { return; }
    Mu.spotT = MC.SPOT_COOLDOWN;
    var t = A().ctx.currentTime + 0.02;
    drum('sting', t, 1);
    strings('sting', [45, 46, 52, 58], t, 2.2, 1.3, true);
    piano('sting', 33, t, 1, 1.5); piano('sting', 34, t + 0.01, 0.8, 1.5);
    Mu.bump = 1.6; Mu.bumpT = 10;
  };
  /* som distante (tiro, grito...): arrepio curto e um pouco de tensão */
  Mu.event = function () {
    if (!ready()) { return; }
    var t = A().ctx.currentTime + 1.2;
    scrape('sting', t, 3.5, 1);
    piano('sting', 46, t + 0.5, 0.7, 1.6);
    Mu.bump = Math.max(Mu.bump, 1); Mu.bumpT = Math.max(Mu.bumpT, 18);
  };
  Mu.death = function () {
    if (!ready()) { return; }
    Mu.dead = true;
    var t = A().ctx.currentTime + 0.8;
    [69, 67, 64, 62, 60, 57].forEach(function (n, i) { piano('sting', n, t + i * 0.9, 0.7 - i * 0.05, 1.8); });
    pad('sting', [45, 57, 60, 64], t, 6, 1.2);
  };
  Mu.reset = function () { Mu.dead = false; Mu.intensity = 0; Mu.bump = 0; Mu.playing = false; Mu.restT = 3; };

  CP.Music = Mu;
})(window.CP = window.CP || {});
