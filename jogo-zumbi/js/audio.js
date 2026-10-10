/* Áudio sintetizado com WebAudio (sem arquivos): passos, golpes, gemidos, portas, vidro, tiros, chuva, helicóptero... */
(function (CP) {
  'use strict';

  var U = CP.U;
  var Au = { ctx: null, master: null, volume: 0.7, enabled: true, noiseBuf: null, rainNode: null, heliNode: null };

  Au.init = function () {
    if (Au.ctx || !Au.enabled) { return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { Au.enabled = false; return; }
    try {
      Au.ctx = new AC();
      Au.master = Au.ctx.createGain();
      Au.master.gain.value = Au.volume;
      Au.master.connect(Au.ctx.destination);
      var len = Au.ctx.sampleRate * 2;
      Au.noiseBuf = Au.ctx.createBuffer(1, len, Au.ctx.sampleRate);
      var d = Au.noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) { d[i] = Math.random() * 2 - 1; }
    } catch (e) { Au.enabled = false; }
  };
  Au.resume = function () { Au.init(); if (Au.ctx && Au.ctx.state === 'suspended') { Au.ctx.resume(); } };
  Au.setVolume = function (v) { Au.volume = v; if (Au.master) { Au.master.gain.value = v; } };

  function ok() { return Au.ctx && Au.enabled && Au.ctx.state === 'running'; }
  /* volume/pan por posição em relação ao jogador */
  function spatial(x, y) {
    var p = CP.Game && CP.Game.player;
    if (!p || x === undefined) { return { g: 1, pan: 0 }; }
    var dx = x - p.x, dy = y - p.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    return { g: Math.max(0, 1 - d / 40), pan: U.clamp((dx - dy) / 20, -0.9, 0.9) };
  }
  function out(gain, pan) {
    var g = Au.ctx.createGain();
    g.gain.value = gain;
    if (pan && Au.ctx.createStereoPanner) {
      var pn = Au.ctx.createStereoPanner(); pn.pan.value = pan;
      g.connect(pn); pn.connect(Au.master);
    } else { g.connect(Au.master); }
    return g;
  }
  /* ruído filtrado com envelope */
  function noise(dur, freq, q, gain, type, pan, attack) {
    if (!ok()) { return; }
    var t = Au.ctx.currentTime;
    var src = Au.ctx.createBufferSource();
    src.buffer = Au.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    var f = Au.ctx.createBiquadFilter();
    f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    var g = out(0, pan);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }
  function tone(freq, dur, gain, type, slide, pan) {
    if (!ok()) { return; }
    var t = Au.ctx.currentTime;
    var o = Au.ctx.createOscillator();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) { o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur); }
    var g = out(0, pan);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  }

  Au.step = function (run) { noise(0.07, run ? 500 : 380, 1.2, run ? 0.09 : 0.05, 'lowpass'); };
  Au.swing = function (type) { if (type === 'miss') { noise(0.15, 1500, 0.8, 0.05, 'bandpass'); return; } noise(0.18, type === 'shove' ? 700 : 1100, 0.7, 0.07, 'bandpass', 0, 0.06); };
  Au.hit = function (type, killed) {
    if (type === 'blade_short' || type === 'blade_long' || type === 'axe') { noise(0.12, 2400, 1.5, 0.12); noise(0.2, 300, 1, 0.18, 'lowpass'); } else { noise(0.16, 220, 1, 0.3, 'lowpass'); tone(90, 0.12, 0.15, 'sine', 0.6); }
    if (killed) { noise(0.35, 180, 0.8, 0.2, 'lowpass'); }
  };
  Au.groan = function (zb, aggressive) {
    if (!ok()) { return; }
    var s = spatial(zb.x, zb.y);
    if (s.g <= 0.02) { return; }
    var t = Au.ctx.currentTime;
    var o = Au.ctx.createOscillator();
    o.type = 'sawtooth';
    var base = (zb.look && zb.look.female ? 150 : 95) * (0.85 + Math.random() * 0.3);
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * (aggressive ? 1.35 : 0.8), t + 0.7);
    var lfo = Au.ctx.createOscillator(); lfo.frequency.value = 6 + Math.random() * 4;
    var lg = Au.ctx.createGain(); lg.gain.value = base * 0.08;
    lfo.connect(lg); lg.connect(o.frequency);
    var f = Au.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = aggressive ? 900 : 600;
    var g = out(0, s.pan);
    var vol = (aggressive ? 0.16 : 0.08) * s.g;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (aggressive ? 1.0 : 1.4));
    o.connect(f); f.connect(g);
    o.start(t); lfo.start(t); o.stop(t + 1.5); lfo.stop(t + 1.5);
  };
  Au.thump = function (x, y, z, glassy) { var s = spatial(x, y); if (s.g > 0) { noise(0.25, 120, 1, 0.35 * s.g, 'lowpass', s.pan); if (glassy) { noise(0.1, 3000, 2, 0.06 * s.g, 'bandpass', s.pan); } } };
  Au.glass = function (x, y) { var s = spatial(x, y); for (var i = 0; i < 5; i++) { setTimeout(function () { noise(0.12, 3000 + Math.random() * 3000, 3, 0.12 * Math.max(0.2, s.g), 'bandpass', s.pan); }, i * 40); } };
  Au.door = function (open) { tone(open ? 220 : 180, 0.25, 0.05, 'triangle', open ? 1.4 : 0.7); noise(0.1, 200, 1, 0.12, 'lowpass'); };
  Au.click = function () { tone(1400, 0.04, 0.05, 'square'); };
  Au.equip = function () { noise(0.08, 900, 1, 0.06); };
  Au.breakItem = function () { noise(0.25, 1800, 2, 0.15); tone(300, 0.2, 0.08, 'square', 0.5); };
  Au.hurt = function (type) { tone(type === 'bite' ? 160 : 220, 0.25, 0.12, 'sawtooth', 0.6); noise(0.15, 500, 1, 0.1); };
  Au.gunshot = function (x, y, near, id) {
    var s = spatial(x, y);
    noise(near ? 0.5 : 1.2, near ? 900 : 300, 0.6, (near ? 0.6 : 0.25) * Math.max(0.3, s.g), near ? 'lowpass' : 'lowpass', s.pan, 0.002);
    tone(near ? 70 : 50, 0.3, near ? 0.3 : 0.1, 'sine', 0.5);
  };
  Au.reload = function () { tone(800, 0.05, 0.06, 'square'); setTimeout(function () { tone(600, 0.06, 0.07, 'square'); }, 300); };
  Au.alarm = function (x, y) { var s = spatial(x, y); tone(880, 0.35, 0.12 * Math.max(0.15, s.g), 'square', 1, s.pan); setTimeout(function () { tone(660, 0.35, 0.12 * Math.max(0.15, s.g), 'square', 1, s.pan); }, 400); };
  Au.thunder = function () { setTimeout(function () { noise(2.5, 90, 0.7, 0.5, 'lowpass', 0, 0.2); }, 300 + Math.random() * 1200); };
  Au.distant = function (kind, ang) {
    var pan = Math.cos(ang) * 0.6;
    if (kind === 'gunshot') { for (var i = 0; i < 3; i++) { setTimeout(function () { noise(0.8, 250, 0.7, 0.15, 'lowpass', pan, 0.002); }, i * 350 + Math.random() * 200); } } else if (kind === 'scream') { tone(700, 1.2, 0.05, 'sawtooth', 1.4, pan); } else if (kind === 'dogs') { for (var j = 0; j < 4; j++) { setTimeout(function () { tone(420, 0.12, 0.05, 'square', 0.7, pan); }, j * 260); } } else { noise(1.2, 160, 0.6, 0.25, 'lowpass', pan); }
  };
  Au.hammer = function () { noise(0.08, 1500, 3, 0.15); tone(500, 0.06, 0.06, 'square'); };
  Au.chop = function () { noise(0.12, 600, 1.5, 0.25); tone(140, 0.1, 0.1, 'sine', 0.6); };
  Au.powerDown = function () { tone(120, 2.5, 0.12, 'sawtooth', 0.3); };
  /* helicóptero contínuo (dx, dy relativo ao jogador; null desliga) */
  Au.heli = function (dx, dy) {
    if (!ok()) { return; }
    if (dx === null) { if (Au.heliNode) { Au.heliNode.g.gain.setTargetAtTime(0, Au.ctx.currentTime, 1); var hn = Au.heliNode; setTimeout(function () { try { hn.o.stop(); hn.src.stop(); } catch (e) { /* já parou */ } }, 3000); Au.heliNode = null; } return; }
    if (!Au.heliNode) {
      var src = Au.ctx.createBufferSource(); src.buffer = Au.noiseBuf; src.loop = true;
      var f = Au.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
      var am = Au.ctx.createGain(); am.gain.value = 0.5;
      var o = Au.ctx.createOscillator(); o.frequency.value = 11; var og = Au.ctx.createGain(); og.gain.value = 0.5;
      o.connect(og); og.connect(am.gain);
      var g = out(0, 0);
      src.connect(f); f.connect(am); am.connect(g);
      src.start(); o.start();
      Au.heliNode = { src: src, o: o, g: g };
    }
    var d = Math.sqrt(dx * dx + dy * dy);
    Au.heliNode.g.gain.setTargetAtTime(Math.max(0.02, 0.6 * (1 - d / 90)), Au.ctx.currentTime, 0.3);
  };
  /* motor do carro (level 0..1; null desliga) */
  Au.engine = function (level) {
    if (!ok()) { return; }
    if (level === null) { if (Au.engNode) { Au.engNode.g.gain.setTargetAtTime(0, Au.ctx.currentTime, 0.2); var en = Au.engNode; setTimeout(function () { try { en.o.stop(); } catch (e) { /* já parou */ } }, 800); Au.engNode = null; } return; }
    if (!Au.engNode) {
      var o = Au.ctx.createOscillator(); o.type = 'sawtooth';
      var f = Au.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      var g = out(0, 0);
      o.connect(f); f.connect(g); o.start();
      Au.engNode = { o: o, g: g };
    }
    Au.engNode.o.frequency.setTargetAtTime(38 + level * 90, Au.ctx.currentTime, 0.1);
    Au.engNode.g.gain.setTargetAtTime(0.05 + level * 0.05, Au.ctx.currentTime, 0.1);
  };
  /* chuva contínua */
  Au.ambient = function (rain, outdoor) {
    if (!ok()) { return; }
    if (!Au.rainNode) {
      var src = Au.ctx.createBufferSource(); src.buffer = Au.noiseBuf; src.loop = true;
      var f = Au.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 900;
      var g = out(0, 0);
      src.connect(f); f.connect(g); src.start();
      Au.rainNode = { g: g, f: f };
    }
    var target = rain * (outdoor ? 0.12 : 0.05);
    Au.rainNode.g.gain.setTargetAtTime(target, Au.ctx.currentTime, 1.5);
    Au.rainNode.f.frequency.setTargetAtTime(outdoor ? 900 : 400, Au.ctx.currentTime, 1);
  };

  CP.Audio = Au;
})(window.CP = window.CP || {});
