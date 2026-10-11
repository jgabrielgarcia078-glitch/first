/* Efeitos visuais: manchas de sangue (persistem no chunk), traçantes, clarão, lascas, textos, chuva, relâmpago. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W;
  var HW = C.TILE_W / 2, HH = C.TILE_H / 2, WH = C.WALL_H;

  var FX = { flash: 0, drops: [] };

  function sx(x, y) { return HW * (x - y); }
  function sy(x, y, z) { return HH * (x + y) - z * WH; }

  FX.blood = function (x, y, z, size) {
    var ch = W.chunkAt(Math.floor(x), Math.floor(y));
    if (!ch) { return; }
    if (!ch.decals) { ch.decals = []; }
    var n = Math.ceil(size);
    for (var i = 0; i < n; i++) {
      ch.decals.push({ x: x + U.randRange(-0.4, 0.4) * size * 0.5, y: y + U.randRange(-0.4, 0.4) * size * 0.5, z: W.levelOf(z), s: U.randRange(2, 5) * (0.6 + size * 0.25), r: U.randRange(0, 3.14) });
    }
    if (ch.decals.length > 300) { ch.decals.splice(0, ch.decals.length - 300); }
    ch.dirty = true;
    CP.Game.effects.push({ type: 'spray', x: x, y: y, z: z, t: 0, life: 0.35, n: 6 + n * 2, seed: Math.random() });
  };
  /* pingo de sangue no chão (sem respingo no ar): quem sangra deixa rastro */
  FX.drip = function (x, y, z, s) {
    var ch = W.chunkAt(Math.floor(x), Math.floor(y));
    if (!ch) { return; }
    if (!ch.decals) { ch.decals = []; }
    ch.decals.push({ x: x + U.randRange(-0.15, 0.15), y: y + U.randRange(-0.15, 0.15), z: W.levelOf(z), s: s || U.randRange(0.9, 1.6), r: U.randRange(0, 3.14) });
    if (ch.decals.length > 300) { ch.decals.splice(0, ch.decals.length - 300); }
    ch.dirty = true;
  };
  /* respingo na parede atrás de quem levou o golpe (na direção do golpe, se houver parede a menos de ~1 tile) */
  FX.wallBlood = function (x, y, z, ang) {
    var lz = W.levelOf(z), tx = Math.floor(x), ty = Math.floor(y);
    var nx = Math.floor(x + Math.cos(ang) * 0.9), ny = Math.floor(y + Math.sin(ang) * 0.9);
    var cand = [];
    if (nx !== tx) { cand.push({ x: Math.max(tx, nx), y: ty, side: 1 }); }
    if (ny !== ty) { cand.push({ x: tx, y: Math.max(ty, ny), side: 0 }); }
    for (var i = 0; i < cand.length; i++) {
      var e = cand[i], t = W.edgeType(e.x, e.y, lz, e.side);
      if (t !== C.EDGE.WALL && t !== C.EDGE.WINDOW && t !== C.EDGE.DOOR) { continue; }
      var ch = W.chunkAt(e.x, e.y);
      if (!ch) { return false; }
      ch.wallBlood = ch.wallBlood || {};
      var k = W.edgeKey(e.x, e.y, lz, e.side), cur = ch.wallBlood[k];
      if (cur) { cur.n = Math.min(3, cur.n + 1); } else { ch.wallBlood[k] = { n: 1, v: (Math.random() * 3) | 0 }; }
      ch.dirty = true;
      return true;
    }
    return false;
  };
  FX.splinter = function (x, y, z) { CP.Game.effects.push({ type: 'splinter', x: x, y: y, z: z, t: 0, life: 0.5, seed: Math.random() }); };
  FX.tracer = function (x0, y0, z, x1, y1) { CP.Game.effects.push({ type: 'tracer', x: x0, y: y0, z: z, x1: x1, y1: y1, t: 0, life: 0.08 }); };
  FX.muzzle = function (x, y, z, ang) { CP.Game.effects.push({ type: 'muzzle', x: x, y: y, z: z, ang: ang, t: 0, life: 0.06 }); FX.flash = Math.max(FX.flash, 0.15); };
  FX.noiseRing = function (x, y, z, r) { if (CP.Game.viewDebug) { CP.Game.effects.push({ type: 'ring', x: x, y: y, z: z, r: r, t: 0, life: 0.6 }); } };
  FX.floatText = function (x, y, z, text, color) { if (text) { CP.Game.effects.push({ type: 'text', x: x, y: y, z: z, text: text, color: color || '#fff', t: 0, life: 1.1 }); } };
  FX.lightning = function () { FX.flash = 0.6; };

  /* respingo de sangue pontilhado (8 formas × 9 níveis de luz, em cache) */
  var splats = [];
  function splat(v, li) {
    var k = v * 9 + li;
    if (splats[k]) { return splats[k]; }
    var c = document.createElement('canvas'); c.width = 48; c.height = 24;
    var g = c.getContext('2d'), rng = new U.Rng(v * 97 + 11);
    var b = 0.25 + 0.75 * li / 8;
    function col(k2) { return 'rgba(' + Math.round((100 + k2 * 60) * b) + ',' + Math.round((8 + k2 * 10) * b) + ',' + Math.round((8 + k2 * 8) * b) + ',' + (0.55 + k2 * 0.35).toFixed(2) + ')'; }
    // miolo + pingos em volta, mais esparsos para fora (perspectiva achatada)
    for (var i = 0; i < 70; i++) {
      var a = rng.range(0, Math.PI * 2), r = Math.pow(rng.next(), 1.6) * 22;
      var x = 24 + Math.cos(a) * r, y = 12 + Math.sin(a) * r * 0.5;
      g.fillStyle = col(rng.next());
      var w = r < 7 ? 2 + rng.int(0, 2) : 1 + rng.int(0, 1);
      g.fillRect(x | 0, y | 0, w, Math.max(1, w - 1));
    }
    for (var j = 0; j < 3; j++) { var a2 = rng.range(0, Math.PI * 2); g.fillStyle = col(0.4); for (var t = 0; t < 8; t++) { g.fillRect((24 + Math.cos(a2) * (6 + t * 2)) | 0, (12 + Math.sin(a2) * (3 + t)) | 0, 1, 1); } }
    splats[k] = c;
    return c;
  }
  /* manchas no chão (chamado pelo renderizador depois dos pisos) */
  FX.drawDecals = function (g) {
    var G = CP.Game, p = G.player;
    var lv = W.levelOf(p.z);
    g.fillStyle = 'rgba(95,10,10,0.75)';
    for (var k in G.activeChunks) {
      var ch = G.activeChunks[k];
      if (!ch.decals) { continue; }
      for (var i = 0; i < ch.decals.length; i++) {
        var d = ch.decals[i];
        if (d.z !== 0 && d.z !== lv) { continue; }
        if (Math.abs(d.x - p.x) > 40 || Math.abs(d.y - p.y) > 40) { continue; }
        var b = CP.Vis.brightness(Math.floor(d.x), Math.floor(d.y), d.z, lv);
        var sp = splat(((d.r * 1000) | 0) % 8, Math.min(8, Math.round(b * 8)));
        var sc = d.s / 5;
        g.drawImage(sp, sx(d.x, d.y) - 24 * sc, sy(d.x, d.y, d.z) - 12 * sc, 48 * sc, 24 * sc);
      }
    }
    if (CP.Amb) { CP.Amb.drawPrints(g, lv); }
  };

  /* efeitos em coordenadas de mundo (depois de tudo) */
  FX.drawOverlay = function (g) {
    var G = CP.Game;
    var effs = G.effects;
    for (var i = 0; i < effs.length; i++) {
      var e = effs[i];
      var k = e.t / e.life;
      var X = sx(e.x, e.y), Y = sy(e.x, e.y, e.z);
      if (e.type === 'tracer') {
        g.strokeStyle = 'rgba(255,230,150,' + (1 - k) + ')'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(X, Y - 30); g.lineTo(sx(e.x1, e.y1), sy(e.x1, e.y1, e.z) - 30); g.stroke();
      } else if (e.type === 'muzzle') {
        g.fillStyle = 'rgba(255,220,120,0.9)';
        var mx = X + Math.cos(e.ang) * 20 - Math.sin(e.ang) * 20, my = Y - 30 + (Math.cos(e.ang) + Math.sin(e.ang)) * 8;
        g.beginPath(); g.arc(mx, my, 6, 0, Math.PI * 2); g.fill();
      } else if (e.type === 'spray') {
        var rng = new U.Rng(Math.floor(e.seed * 1e9));
        g.fillStyle = 'rgba(130,10,10,' + (1 - k) + ')';
        for (var j = 0; j < e.n; j++) {
          var a = rng.range(0, Math.PI * 2), r = rng.range(4, 18) * (0.4 + k);
          g.fillRect(X + Math.cos(a) * r, Y - 30 + Math.sin(a) * r * 0.6 + k * 20, 2, 2);
        }
      } else if (e.type === 'splinter') {
        var rng2 = new U.Rng(Math.floor(e.seed * 1e9));
        g.fillStyle = 'rgba(150,110,60,' + (1 - k) + ')';
        for (var q = 0; q < 8; q++) { g.fillRect(X + rng2.range(-14, 14) * (1 + k), Y - 40 + rng2.range(-10, 10) + k * 30, 3, 1.5); }
      } else if (e.type === 'ring') {
        g.strokeStyle = 'rgba(255,255,255,' + (0.4 * (1 - k)) + ')'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(X, Y, e.r * HW * k * 1.4, e.r * HH * k * 1.4, 0, 0, Math.PI * 2); g.stroke();
      } else if (e.type === 'text') {
        g.font = 'bold 13px system-ui, sans-serif'; g.textAlign = 'center';
        g.fillStyle = 'rgba(0,0,0,' + (0.6 * (1 - k)) + ')'; g.fillText(e.text, X + 1, Y - 70 - k * 20 + 1);
        g.fillStyle = e.color; g.globalAlpha = 1 - k; g.fillText(e.text, X, Y - 70 - k * 20); g.globalAlpha = 1;
      }
    }
    // helicóptero (sombra + corpo, visto de cima)
    var hl = G.state.world.heli;
    if (hl) {
      var hx = sx(hl.x, hl.y), hy = sy(hl.x, hl.y, 0);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(hx, hy, 40, 18, 0, 0, Math.PI * 2); g.fill();
      var by = hy - 260;
      g.fillStyle = '#2f3a2f'; g.beginPath(); g.ellipse(hx, by, 26, 12, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(hx + 10, by - 3, 40, 5);
      var rot = performance.now() / 40;
      g.strokeStyle = 'rgba(30,30,30,0.6)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(hx + Math.cos(rot) * 55, by - 14 + Math.sin(rot) * 22); g.lineTo(hx - Math.cos(rot) * 55, by - 14 - Math.sin(rot) * 22); g.stroke();
      if (CP.Time.isNight()) { g.fillStyle = 'rgba(255,255,220,0.07)'; g.beginPath(); g.moveTo(hx, by); g.lineTo(hx - 60, hy); g.lineTo(hx + 60, hy); g.fill(); }
    }
    // balões de fala
    var p = G.player;
    if (p.say && p.sayT > 0) {
      var px = sx(p.x, p.y), py = sy(p.x, p.y, p.z) - 78;
      g.font = '12px system-ui, sans-serif'; g.textAlign = 'center';
      var w = g.measureText(p.say).width + 12;
      g.fillStyle = 'rgba(20,20,24,0.8)'; g.fillRect(px - w / 2, py - 14, w, 20);
      g.fillStyle = '#f0ece0'; g.fillText(p.say, px, py);
    }
  };

  /* camada de tela: chuva, neve, clarão, escurecer bordas */
  /* brilho quente das luzes no escuro (postes, fogueiras, lanterna), somado à cena */
  FX.drawGlows = function (g) {
    var V = CP.Vis, src = V.sources;
    if (!src) { return; }
    var dark = U.clamp((0.8 - V.ambientOut) / 0.5, 0, 1);
    if (dark <= 0.02) { return; }
    var HW = C.TILE_W / 2, HH = C.TILE_H / 2, WH = C.WALL_H, K = HW * Math.SQRT2;
    var t = performance.now() / 1000;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (var i = 0; i < src.length; i++) {
      var s = src[i];
      if (!s.glow) { continue; }
      var sx = HW * (s.x - s.y), sy = HH * (s.x + s.y) - s.z * WH;
      var col = s.glow === 'fire' ? '255,120,40' : (s.glow === 'lamp' ? '255,176,96' : '255,236,200');
      var k = s.glow === 'fire' ? 0.8 + 0.15 * Math.sin(t * 13 + i) + 0.08 * Math.sin(t * 7.3) : 1;
      var a = (s.glow === 'flash' ? 0.16 : (s.glow === 'fire' ? 0.3 : 0.24)) * dark * k;
      g.save();
      g.translate(sx, sy); g.scale(1, 0.5);
      var R = s.r * K;
      var gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
      gr.addColorStop(0, 'rgba(' + col + ',' + a.toFixed(3) + ')'); gr.addColorStop(0.5, 'rgba(' + col + ',' + (a * 0.35).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = gr;
      g.beginPath();
      if (s.cone) {
        var an = s.cone.ang + Math.PI / 4;
        g.moveTo(0, 0); g.arc(0, 0, R, an - s.cone.half, an + s.cone.half); g.closePath();
      } else { g.arc(0, 0, R, 0, Math.PI * 2); }
      g.fill();
      g.restore();
      if (s.glow === 'lamp') { // a lâmpada no alto do poste
        var hx = sx + 20, hy = sy - 190;
        var hg = g.createRadialGradient(hx, hy, 0, hx, hy, 34);
        hg.addColorStop(0, 'rgba(255,214,150,' + (0.55 * dark).toFixed(3) + ')'); hg.addColorStop(1, 'rgba(255,214,150,0)');
        g.fillStyle = hg; g.fillRect(hx - 34, hy - 34, 68, 68);
      }
    }
    g.restore();
  };
  FX.drawScreen = function (g, w, h, dt) {
    var T = CP.Time;
    if (!T) { return; }
    var wt = T.weather();
    var p = CP.Game.player;
    var outdoor = !W.isIndoor(Math.floor(p.x), Math.floor(p.y), W.levelOf(p.z));

    if (wt.rain > 0) {
      var n = Math.round(wt.rain * 260 * (outdoor ? 1 : 0.35));
      while (FX.drops.length < n) { FX.drops.push({ x: Math.random() * w, y: Math.random() * h, v: 700 + Math.random() * 400 }); }
      FX.drops.length = n;
      g.strokeStyle = wt.snow ? 'rgba(240,240,255,0.8)' : 'rgba(170,190,220,0.35)';
      g.lineWidth = wt.snow ? 2 : 1;
      g.beginPath();
      for (var i = 0; i < FX.drops.length; i++) {
        var d = FX.drops[i];
        d.y += d.v * dt * (wt.snow ? 0.12 : 1); d.x -= d.v * dt * (wt.snow ? 0.03 : 0.15);
        if (d.y > h) { d.y = -10; d.x = Math.random() * w * 1.2; }
        if (d.x < 0) { d.x += w; }
        if (wt.snow) { g.moveTo(d.x, d.y); g.lineTo(d.x + 1, d.y + 1); } else { g.moveTo(d.x, d.y); g.lineTo(d.x - 3, d.y + 14); }
      }
      g.stroke();
    } else { FX.drops.length = 0; }
    if (wt.fog) {
      var grd = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.6);
      grd.addColorStop(0, 'rgba(180,185,190,0)'); grd.addColorStop(1, 'rgba(180,185,190,0.55)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }
    if (FX.flash > 0) {
      g.fillStyle = 'rgba(255,255,255,' + Math.min(0.5, FX.flash) + ')'; g.fillRect(0, 0, w, h);
      FX.flash = Math.max(0, FX.flash - dt * 2.5);
    }
    // vinheta e grão são camadas CSS (#vignette, #grain) — não custam nada no canvas
    FX.hurtEdge(g, w, h, p);
  };
  FX.hurtEdge = function (g, w, h, p) {
    if (p.body) {
      var hurt = Math.max(0, (60 - p.body.health) / 60);
      if (CP.UI && CP.UI.hurtT > 0) { hurt = Math.max(hurt, CP.UI.hurtT); }
      if (hurt > 0) {
        var r = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
        r.addColorStop(0, 'rgba(120,0,0,0)'); r.addColorStop(1, 'rgba(140,0,0,' + (0.45 * hurt) + ')');
        g.fillStyle = r; g.fillRect(0, 0, w, h);
      }
    }
  };

  CP.FX = FX;
})(window.CP = window.CP || {});
