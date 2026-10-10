/* Arte procedural: tudo é desenhado por código em canvases escondidos e guardado em cache.
 * Cada sprite tem variações de iluminação (LIGHT_STEPS) geradas sob demanda. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U;
  var TW = C.TILE_W, TH = C.TILE_H, HW = TW / 2, HH = TH / 2, WH = C.WALL_H;
  var F = C.FLOOR, E = C.EDGE, O = C.OBJ;

  var LIGHT_STEPS = [0.10, 0.18, 0.27, 0.37, 0.48, 0.60, 0.73, 0.86, 1.0];

  var S = { LIGHT_STEPS: LIGHT_STEPS, cache: {}, count: 0 };

  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  S.mk = mk;

  /* Registro: key → { base: canvas, ax, ay, lv: [] } */
  /* gradação de cor do jogo (menos saturação + tom sujo), aplicada UMA vez em cada sprite guardada e nas cores dos personagens */
  function gradeCanvas(c) {
    var GR = C.GRADE;
    var copy = mk(c.width, c.height);
    copy.getContext('2d').drawImage(c, 0, 0);
    var g = c.getContext('2d');
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'saturation'; g.globalAlpha = GR.DESAT;
    g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'soft-light'; g.globalAlpha = GR.TINT_ALPHA;
    g.fillStyle = GR.TINT; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.globalAlpha = 1;
    g.drawImage(copy, 0, 0);
    g.restore();
  }
  var gradeMemo = {};
  function softLight(b, s) { return s < 0.5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * ((b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b)) - b); }
  /* a mesma gradação, calculada numa cor hex (personagens, carros) */
  S.gradeHex = function (hex) {
    var r = gradeMemo[hex];
    if (r) { return r; }
    var GR = C.GRADE, rgb = U.hexToRgb(hex), t = U.hexToRgb(GR.TINT), out = [];
    var lum = (0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]) / 255;
    for (var i = 0; i < 3; i++) {
      var c = rgb[i] / 255;
      c = c + (lum - c) * GR.DESAT;
      c = c + (softLight(c, t[i] / 255) - c) * GR.TINT_ALPHA;
      out.push(Math.round(U.clamp(c, 0, 1) * 255));
    }
    r = '#' + ((1 << 24) | (out[0] << 16) | (out[1] << 8) | out[2]).toString(16).slice(1);
    gradeMemo[hex] = r;
    return r;
  };
  /* bordas sem meio-transparente (tiles que se encaixam: senão a luz/névoa "vaza" e aparece uma grade) */
  function hardEdges(c) {
    var g = c.getContext('2d'), im = g.getImageData(0, 0, c.width, c.height), d = im.data;
    for (var i = 3; i < d.length; i += 4) { d[i] = d[i] >= 96 ? 255 : 0; }
    g.putImageData(im, 0, 0);
  }
  function store(key, canvas, ax, ay, hard) {
    gradeCanvas(canvas);
    if (hard) { hardEdges(canvas); }
    var s = { base: canvas, ax: ax, ay: ay, lv: new Array(LIGHT_STEPS.length) };
    S.cache[key] = s; S.count++;
    return s;
  }
  /* cor de "luz" multiplicada na sprite: neutra com luz alta, azul-arroxeada no escuro */
  function lightColor(b) {
    var N = C.NIGHT, k = U.clamp((N.TINT_FROM - b) / (N.TINT_FROM - 0.15), 0, 1);
    return U.shade(U.mix('#ffffff', N.COLOR, k), N.FLOOR + (1 - N.FLOOR) * b);
  }
  S.lightColor = lightColor;
  /* versão escurecida da sprite (nível de luz li): no escuro tudo puxa para o azul-arroxeado (como a noite do original) */
  S.lit = function (s, li) {
    if (li >= LIGHT_STEPS.length - 1) { return s.base; }
    var c = s.lv[li];
    if (c) { return c; }
    c = mk(s.base.width, s.base.height);
    var g = c.getContext('2d');
    g.drawImage(s.base, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = lightColor(LIGHT_STEPS[li]);
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(s.base, 0, 0);
    s.lv[li] = c;
    return c;
  };
  /* versão fora do campo de visão: mais escura e com menos cor (memória do lugar) */
  S.litFog = function (s, li) {
    var arr = s.fv || (s.fv = new Array(LIGHT_STEPS.length));
    var c = arr[li];
    if (c) { return c; }
    c = mk(s.base.width, s.base.height);
    var g = c.getContext('2d');
    g.drawImage(S.lit(s, li), 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = U.shade('#ffffff', C.FOG_DIM);
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'saturation';
    g.globalAlpha = C.FOG_DESAT;
    g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(s.base, 0, 0);
    arr[li] = c;
    return c;
  };
  S.lightIndex = function (b) {
    if (b >= 0.99) { return LIGHT_STEPS.length - 1; }
    for (var i = 0; i < LIGHT_STEPS.length; i++) { if (b <= LIGHT_STEPS[i] + 0.05) { return i; } }
    return LIGHT_STEPS.length - 1;
  };

  /* ---------- helpers de desenho isométrico ---------- */
  /* ponto do mundo (dentro do tile, 0..1) + altura px → tela, relativo ao canto norte do tile */
  function ip(wx, wy, h) { return [HW * (wx - wy), HH * (wx + wy) - (h || 0)]; }
  S.ip = ip;
  function poly(g, pts, fill, stroke, lw) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) { g.lineTo(pts[i][0], pts[i][1]); }
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
  }
  /* caixa isométrica: x0,y0 (0..1), w (eixo x), d (eixo y), z0/h em px */
  function box(g, x0, y0, w, d, z0, h, color, opts) {
    opts = opts || {};
    var top = U.shade(color, opts.topF || 1.12), east = U.shade(color, opts.eastF || 0.95), south = U.shade(color, opts.southF || 0.78);
    var z1 = z0 + h;
    // face leste (x = x0+w)
    poly(g, [ip(x0 + w, y0, z0), ip(x0 + w, y0 + d, z0), ip(x0 + w, y0 + d, z1), ip(x0 + w, y0, z1)], east);
    // face sul (y = y0+d)
    poly(g, [ip(x0, y0 + d, z0), ip(x0 + w, y0 + d, z0), ip(x0 + w, y0 + d, z1), ip(x0, y0 + d, z1)], south);
    // topo
    poly(g, [ip(x0, y0, z1), ip(x0 + w, y0, z1), ip(x0 + w, y0 + d, z1), ip(x0, y0 + d, z1)], top);
    if (opts.outline !== false) {
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
      g.beginPath();
      var a = ip(x0, y0 + d, z1), b = ip(x0 + w, y0 + d, z1), c = ip(x0 + w, y0, z1), d1 = ip(x0, y0, z1);
      var e = ip(x0, y0 + d, z0), f = ip(x0 + w, y0 + d, z0), gg = ip(x0 + w, y0, z0);
      g.moveTo(d1[0], d1[1]); g.lineTo(a[0], a[1]); g.lineTo(e[0], e[1]); g.lineTo(f[0], f[1]); g.lineTo(gg[0], gg[1]); g.lineTo(c[0], c[1]); g.lineTo(d1[0], d1[1]);
      g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]);
      g.moveTo(b[0], b[1]); g.lineTo(f[0], f[1]);
      g.stroke();
    }
  }
  S.box = box;
  /* retângulo no topo de uma caixa (detalhe) */
  function topRect(g, x0, y0, w, d, h, color) { poly(g, [ip(x0, y0, h), ip(x0 + w, y0, h), ip(x0 + w, y0 + d, h), ip(x0, y0 + d, h)], color); }
  function ellipseAt(g, cx, cy, rx, ry, fill) { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }

  /* caixa encostada na parede conforme a direção (dir = para onde o móvel olha) */
  function againstWall(dir, depth, margin) {
    margin = margin === undefined ? 0.08 : margin;
    var w = 1 - margin * 2;
    if (dir === 2) { return [margin, 0.02, w, depth]; }
    if (dir === 0) { return [margin, 0.98 - depth, w, depth]; }
    if (dir === 1) { return [0.02, margin, depth, w]; }
    return [0.98 - depth, margin, depth, w];
  }

  /* ---------- Pisos ---------- */
  var FLOOR_COLORS = {};
  FLOOR_COLORS[F.GRASS] = ['#5b8a2e', '#57852b', '#5f8f31', '#55822a'];
  FLOOR_COLORS[F.DARKGRASS] = ['#4c7426', '#487023', '#4f7829', '#456c22'];
  FLOOR_COLORS[F.DIRT] = ['#7b6449', '#806a4e', '#756046', '#7e6650'];
  FLOOR_COLORS[F.ASPHALT] = ['#5d5e60', '#5a5b5d', '#606163', '#58595b'];
  FLOOR_COLORS[F.ASPHALT_LINE] = ['#5d5e60', '#5d5e60', '#5d5e60', '#5d5e60'];
  FLOOR_COLORS[F.SIDEWALK] = ['#b4b0a6', '#b1ada3', '#b7b3a9', '#aeaaa0'];
  FLOOR_COLORS[F.WOOD] = ['#8a5a32', '#7c5230', '#946238', '#6c4a2e'];
  FLOOR_COLORS[F.TILE] = ['#d8dcd8', '#cfd6da', '#ddd6c8', '#d4d0c8'];
  FLOOR_COLORS[F.CARPET] = ['#7a4a52', '#4f5f7c', '#5f6e4a', '#8a6e48'];
  FLOOR_COLORS[F.WATER] = ['#2f5f7a', '#2c5c77', '#32637e', '#2d5a74'];
  FLOOR_COLORS[F.SAND] = ['#c9b588', '#c5b184', '#cdb98c', '#c2ae81'];
  FLOOR_COLORS[F.FARM] = ['#5b4632', '#58432f', '#5e4934', '#56412e'];
  FLOOR_COLORS[F.FURROW] = ['#5b4632', '#58432f', '#5e4934', '#56412e'];
  FLOOR_COLORS[F.FIELD] = ['#7d8a3f', '#7a873d', '#808d42', '#77843b'];
  FLOOR_COLORS[F.ROOF] = ['#6e3b2e', '#4a4a50', '#5a4636', '#3d4a5a', '#6a6a62', '#5c5048', '#4f5a4a', '#705a40'];
  FLOOR_COLORS[F.CONCRETE] = ['#8a8984', '#878681', '#8d8c87', '#84837e'];
  FLOOR_COLORS[F.GRAVEL] = ['#86807a', '#827c76', '#8a847e', '#7e7872'];
  FLOOR_COLORS[F.LINOLEUM] = ['#d6c9a8', '#c9c4b8', '#d8cfb6', '#e2ddd2'];

  function diamondPath(g) {
    g.beginPath(); g.moveTo(HW, 0); g.lineTo(TW, HH); g.lineTo(HW, TH); g.lineTo(0, HH); g.closePath();
  }
  var floorArr = [], wallArr = [], objArr = [];
  function floorSprite(f, v) {
    var nk = f * 64 + (v & 63);
    var s0 = floorArr[nk];
    if (s0) { return s0; }
    var key = 'f' + f + '_' + v;
    var c = mk(TW + 2, TH + 2), g = c.getContext('2d');
    var cols = FLOOR_COLORS[f] || ['#ff00ff'];
    var base = cols[v % cols.length];
    var rng = new U.Rng(f * 977 + v * 31 + 7);
    // losango 1px maior para não aparecer fresta entre tiles com zoom
    g.beginPath(); g.moveTo(HW + 1, 0); g.lineTo(TW + 2, HH + 1); g.lineTo(HW + 1, TH + 2); g.lineTo(0, HH + 1); g.closePath();
    g.fillStyle = base; g.fill();
    g.translate(1, 1);
    g.save(); diamondPath(g); g.clip();
    var i, x, y;
    // textura por tipo — coordenadas do losango em espaço do tile
    function tline(ax, ay, bx, by, color, lw) {
      var a = ip(ax, ay, 0), b = ip(bx, by, 0);
      g.strokeStyle = color; g.lineWidth = lw || 1; g.beginPath(); g.moveTo(a[0] + HW, a[1]); g.lineTo(b[0] + HW, b[1]); g.stroke();
    }
    var sh = function (k) { return U.shade(base, k); };
    if (f === F.GRASS || f === F.DARKGRASS || f === F.FIELD) {
      // terra aparecendo entre as folhas
      for (i = 0; i < 8; i++) { g.fillStyle = 'rgba(70,55,35,0.25)'; g.fillRect(rng.next() * TW, rng.next() * TH, 2, 1); }
      var tones = [sh(0.72), sh(0.84), sh(1.1), sh(1.22), sh(0.95)];
      for (i = 0; i < 150; i++) {
        x = rng.next() * TW; y = rng.next() * TH;
        g.fillStyle = tones[(rng.next() * tones.length) | 0];
        var bh = 1 + ((rng.next() * 3) | 0);
        g.fillRect(x, y - bh, 1, bh);
      }
      if (f === F.FIELD) { for (i = 0; i < 4; i++) { tline(0, i * 0.25 + 0.12, 1, i * 0.25 + 0.12, sh(0.75), 1.5); } }
      if (f !== F.FIELD && rng.chance(0.14)) { for (i = 0; i < 3; i++) { g.fillStyle = ['#d8d36a', '#e8e8e0', '#c57ad1'][rng.int(0, 2)]; g.fillRect(rng.next() * TW, rng.next() * TH, 2, 2); } }
      if (f !== F.FIELD && rng.chance(0.2)) { var cx0 = rng.next() * TW, cy0 = rng.next() * TH; g.fillStyle = 'rgba(30,45,20,0.25)'; g.beginPath(); g.ellipse(cx0, cy0, 6, 3, 0, 0, Math.PI * 2); g.fill(); }
    } else if (f === F.DIRT || f === F.FARM || f === F.SAND || f === F.GRAVEL) {
      var n0 = f === F.GRAVEL ? 90 : 70;
      for (i = 0; i < n0; i++) {
        x = rng.next() * TW; y = rng.next() * TH;
        g.fillStyle = rng.chance(0.5) ? sh(1.14) : sh(0.82);
        g.fillRect(x, y, rng.chance(0.25) ? 2 : 1, 1);
      }
      var peb = f === F.GRAVEL ? 26 : (f === F.SAND ? 2 : 6);
      for (i = 0; i < peb; i++) {
        x = rng.next() * TW; y = rng.next() * TH;
        g.fillStyle = sh(0.7); g.fillRect(x, y + 1, 2, 1);
        g.fillStyle = f === F.GRAVEL ? U.shade('#9a948c', 0.9 + rng.next() * 0.3) : sh(1.2); g.fillRect(x, y, 2, 1);
      }
      if (f === F.FARM) { for (i = 0; i < 4; i++) { tline(0.12 + i * 0.25, 0, 0.12 + i * 0.25, 1, sh(0.7), 2); } }
    } else if (f === F.ASPHALT || f === F.ASPHALT_LINE) {
      for (i = 0; i < 120; i++) {
        x = rng.next() * TW; y = rng.next() * TH;
        var r0 = rng.next();
        g.fillStyle = r0 < 0.45 ? sh(1.14) : (r0 < 0.9 ? sh(0.86) : sh(1.3));
        g.fillRect(x, y, 1, 1);
      }
      if (f === F.ASPHALT_LINE && v === 1) { tline(0.05, 0.5, 0.95, 0.5, '#cbb557', 2); }
      if (f === F.ASPHALT_LINE && v === 2) { tline(0.5, 0.05, 0.5, 0.95, '#cbb557', 2); }
      if (f === F.ASPHALT && rng.chance(0.3)) { // rachadura
        var cx = rng.next(), cy = rng.next(), q0 = ip(cx, cy, 0);
        g.strokeStyle = sh(0.62); g.lineWidth = 1; g.beginPath(); g.moveTo(q0[0] + HW, q0[1]);
        for (i = 0; i < 5; i++) { cx += rng.range(-0.15, 0.15); cy += rng.range(-0.15, 0.15); var q1 = ip(cx, cy, 0); g.lineTo(q1[0] + HW, q1[1]); }
        g.stroke();
      }
      if (f === F.ASPHALT && rng.chance(0.12)) { var oc = ip(rng.next(), rng.next(), 0); g.fillStyle = 'rgba(10,10,12,0.22)'; g.beginPath(); g.ellipse(oc[0] + HW, oc[1], rng.range(4, 9), rng.range(2, 4), 0, 0, Math.PI * 2); g.fill(); }
      if (f === F.ASPHALT && rng.chance(0.08)) { var pa = rng.range(0, 0.5), pb = rng.range(0, 0.5); poly(g, [ip(pa, pb, 0), ip(pa + 0.45, pb, 0), ip(pa + 0.45, pb + 0.4, 0), ip(pa, pb + 0.4, 0)].map(function (q) { return [q[0] + HW, q[1]]; }), 'rgba(0,0,0,0.12)'); }
    } else if (f === F.SIDEWALK || f === F.CONCRETE) {
      for (i = 0; i < 45; i++) { g.fillStyle = sh(rng.chance(0.5) ? 1.08 : 0.9); g.fillRect(rng.next() * TW, rng.next() * TH, 1, 1); }
      if (rng.chance(0.25)) { var st0 = ip(rng.next(), rng.next(), 0); g.fillStyle = 'rgba(40,35,30,0.12)'; g.beginPath(); g.ellipse(st0[0] + HW, st0[1], rng.range(3, 8), rng.range(2, 4), 0, 0, Math.PI * 2); g.fill(); }
      tline(0, 0.5, 1, 0.5, sh(0.8), 1); tline(0.5, 0, 0.5, 1, sh(0.8), 1);
      tline(0, 0.52, 1, 0.52, sh(1.07), 1); tline(0.52, 0, 0.52, 1, sh(1.07), 1);
      tline(0, 0.02, 1, 0.02, sh(1.07), 1); tline(0.02, 0, 0.02, 1, sh(1.07), 1);
      if (rng.chance(0.15)) { var k0 = rng.next() * 0.5; tline(k0, 0.05, k0 + 0.2, 0.45, sh(0.75), 1); }
    } else if (f === F.WOOD) {
      // tábuas compridas, tons variados, juntas desencontradas e veios
      var NP = 6;
      for (i = 0; i < NP; i++) {
        var y0p = i / NP, y1p = (i + 1) / NP, cut = rng.range(0.2, 0.8);
        [[0, cut], [cut, 1]].forEach(function (seg) {
          var pk = U.mix(base, rng.chance(0.5) ? '#a87a4a' : '#5a3a22', rng.next() * 0.22);
          poly(g, [ip(seg[0], y0p, 0), ip(seg[1], y0p, 0), ip(seg[1], y1p, 0), ip(seg[0], y1p, 0)].map(function (q) { return [q[0] + HW, q[1]]; }), pk);
          for (var gI = 0; gI < 2; gI++) { var gy = y0p + (gI + 0.5) / 2 / NP + rng.range(-0.02, 0.02); tline(seg[0] + 0.05, gy, seg[1] - 0.05, gy + rng.range(-0.01, 0.01), U.mix(pk, rng.chance(0.5) ? '#3a2412' : '#c09060', 0.12), 1); }
        });
        tline(cut, y0p, cut, y1p, sh(0.74), 1);
      }
      for (i = 0; i <= NP; i++) { tline(0, i / NP, 1, i / NP, sh(0.76), 1); }
      for (i = 0; i < 3; i++) { var sc = ip(rng.next(), rng.next(), 0); g.fillStyle = 'rgba(30,20,10,0.12)'; g.beginPath(); g.ellipse(sc[0] + HW, sc[1], rng.range(3, 8), rng.range(1.5, 3), 0, 0, Math.PI * 2); g.fill(); }
    } else if (f === F.TILE || f === F.LINOLEUM) {
      // piso de cerâmica: quadrados grandes alternados (cozinha) ou pequenos com rejunte (banheiro)
      var n = f === F.TILE ? 4 : 2;
      var alt = f === F.LINOLEUM && (v & 3) === 3 ? '#4a4844' : U.mix(base, '#3a3020', f === F.TILE ? 0.07 : 0.16);
      for (i = 0; i < n; i++) { for (var j = 0; j < n; j++) {
        var col0 = (i + j) % 2 ? alt : base;
        poly(g, [ip(i / n, j / n, 0), ip((i + 1) / n, j / n, 0), ip((i + 1) / n, (j + 1) / n, 0), ip(i / n, (j + 1) / n, 0)].map(function (q) { return [q[0] + HW, q[1]]; }), U.shade(col0, 0.97 + rng.next() * 0.06));
      } }
      for (i = 0; i <= n; i++) { tline(0, i / n, 1, i / n, 'rgba(60,55,45,0.35)', 1); tline(i / n, 0, i / n, 1, 'rgba(60,55,45,0.35)', 1); }
      for (i = 0; i < 18; i++) { g.fillStyle = 'rgba(80,70,50,0.08)'; g.fillRect(rng.next() * TW, rng.next() * TH, 2, 1); }
    } else if (f === F.CARPET) {
      for (i = 0; i < 160; i++) { g.fillStyle = U.shade(base, 0.86 + rng.next() * 0.26); g.fillRect(rng.next() * TW, rng.next() * TH, 1, 1); }
      if (rng.chance(0.2)) { var cs = ip(rng.next(), rng.next(), 0); g.fillStyle = 'rgba(40,25,15,0.15)'; g.beginPath(); g.ellipse(cs[0] + HW, cs[1], rng.range(4, 9), rng.range(2, 4), 0, 0, Math.PI * 2); g.fill(); }
    } else if (f === F.WATER) {
      for (i = 0; i < 6; i++) { x = rng.next() * TW; y = rng.next() * TH; g.strokeStyle = 'rgba(200,230,255,0.25)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y); g.stroke(); }
    } else if (f === F.ROOF) {
      for (i = 0; i <= 8; i++) { tline(0, i / 8, 1, i / 8, U.shade(base, 0.8), 1); }
      for (i = 0; i < 8; i++) { for (var k = 0; k < 4; k++) { var ox = (k + (i % 2) * 0.5) / 4; tline(ox, i / 8, ox, (i + 1) / 8, U.shade(base, 0.85), 1); } }
    }
    g.restore();
    return (floorArr[nk] = store(key, c, HW + 1, 1, true));
  }
  S.floor = floorSprite;

  /* ---------- Lixo e abandono no chão (decalques por tile, escolhidos por posição em render.js) ---------- */
  /* kind: 0 papel, 1 lata, 2 folhas secas, 3 saco de lixo, 4 mancha de óleo, 5 mato na rachadura, 6 cacos de vidro,
   * 7 sangue seco, 8 papelão, 9 garrafa, 10 marca de pneu, 11 entulho */
  var litArr = [];
  S.LITTER_KINDS = 12;
  S.litter = function (kind, v) {
    var k = kind * 4 + (v & 3);
    if (litArr[k]) { return litArr[k]; }
    var c = mk(TW + 8, TH + 24), g = c.getContext('2d');
    var ax = HW + 4, ay = 18;
    g.translate(ax, ay);
    var rng = new U.Rng(kind * 101 + v * 13 + 5);
    var ctr = ip(rng.range(0.3, 0.7), rng.range(0.3, 0.7), 0);
    var i;
    function flat(fn) { g.save(); g.translate(ctr[0], ctr[1]); g.scale(1, 0.5); g.rotate(rng.range(0, Math.PI * 2)); fn(); g.restore(); }
    switch (kind) {
      case 0: flat(function () {
        g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(-6, -4, 14, 10);
        g.fillStyle = rng.pick(['#b4ad98', '#a8a088', '#bab3a0']); g.fillRect(-6, -4, 12, 8);
        g.fillStyle = 'rgba(60,60,60,0.2)'; for (i = 0; i < 3; i++) { g.fillRect(-4, -2 + i * 2.2, rng.range(4, 8), 0.7); }
      }); break;
      case 1: flat(function () { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-2, 1, 7, 4); g.fillStyle = rng.pick(['#a8302a', '#b8bcc0', '#2f6a3a', '#c9a23a']); g.fillRect(-3, -2, 7, 4); g.fillStyle = '#d8dadc'; g.fillRect(-3, -2, 1.5, 4); }); break;
      case 2: for (i = 0; i < 14; i++) { var lp = ip(rng.range(0.15, 0.85), rng.range(0.15, 0.85), 0); g.fillStyle = rng.pick(['#7a5a2a', '#8a6a30', '#5a4220', '#9a7a3a', '#6a5a2a']); g.beginPath(); g.ellipse(lp[0], lp[1], rng.range(1.5, 3), rng.range(1, 1.8), rng.range(0, 3), 0, Math.PI * 2); g.fill(); } break;
      case 3: ellipseAt(g, ctr[0] + 2, ctr[1] + 2, 10, 4.5, 'rgba(0,0,0,0.3)');
        ellipseAt(g, ctr[0], ctr[1] - 4, 9, 7, '#1e1f22'); ellipseAt(g, ctr[0] + 4, ctr[1] - 3, 6, 5, '#26282c');
        ellipseAt(g, ctr[0] - 3, ctr[1] - 7, 3, 2, 'rgba(255,255,255,0.18)'); break;
      case 4: flat(function () { g.fillStyle = 'rgba(12,12,14,0.32)'; g.beginPath(); g.ellipse(0, 0, rng.range(9, 15), rng.range(6, 10), 0, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(12,12,14,0.2)'; g.beginPath(); g.ellipse(6, 3, 6, 4, 0, 0, Math.PI * 2); g.fill(); }); break;
      case 5: for (i = 0; i < 16; i++) { var wx = ctr[0] + rng.range(-9, 9), wy = ctr[1] + rng.range(-3, 3); g.strokeStyle = rng.pick(['#5d6e2e', '#6e7a34', '#4e5e26', '#7a7a3a']); g.lineWidth = 1.2; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + rng.range(-3, 3), wy - rng.range(3, 9)); g.stroke(); } break;
      case 6: for (i = 0; i < 9; i++) { var gp = ip(rng.range(0.2, 0.8), rng.range(0.2, 0.8), 0); g.fillStyle = rng.chance(0.5) ? 'rgba(190,220,230,0.8)' : 'rgba(140,170,180,0.7)'; g.beginPath(); g.moveTo(gp[0], gp[1]); g.lineTo(gp[0] + rng.range(1, 4), gp[1] + rng.range(-1, 1)); g.lineTo(gp[0] + rng.range(0, 2), gp[1] + rng.range(1, 2)); g.fill(); } break;
      case 7: flat(function () { g.fillStyle = 'rgba(70,12,10,0.6)'; g.beginPath(); g.ellipse(0, 0, rng.range(6, 11), rng.range(4, 7), 0, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(70,12,10,0.45)'; for (i = 0; i < 5; i++) { g.beginPath(); g.arc(rng.range(-14, 14), rng.range(-9, 9), rng.range(1, 2.5), 0, Math.PI * 2); g.fill(); } g.fillRect(4, -1, 14, 2.5); }); break;
      case 8: flat(function () { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(-9, -6, 20, 14); g.fillStyle = '#9a7a4e'; g.fillRect(-10, -7, 20, 14); g.strokeStyle = '#7a5e38'; g.lineWidth = 1; g.strokeRect(-10, -7, 20, 14); g.beginPath(); g.moveTo(0, -7); g.lineTo(0, 7); g.stroke(); }); break;
      case 9: flat(function () { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-4, 2, 12, 4); g.fillStyle = rng.pick(['rgba(60,110,60,0.85)', 'rgba(120,80,40,0.85)', 'rgba(200,220,220,0.6)']); g.fillRect(-5, -2, 9, 4); g.fillRect(4, -1, 4, 2); }); break;
      case 10: g.strokeStyle = 'rgba(15,15,15,0.28)'; g.lineWidth = 3; for (i = 0; i < 2; i++) { var a0 = ip(0.05, 0.3 + i * 0.25, 0), a1 = ip(0.95, 0.4 + i * 0.25 + rng.range(-0.1, 0.1), 0); g.beginPath(); g.moveTo(a0[0], a0[1]); g.quadraticCurveTo((a0[0] + a1[0]) / 2 + rng.range(-6, 6), (a0[1] + a1[1]) / 2 + rng.range(-3, 3), a1[0], a1[1]); g.stroke(); } break;
      case 11: for (i = 0; i < 10; i++) { var rp = ip(rng.range(0.2, 0.8), rng.range(0.2, 0.8), 0); var rc = rng.pick(['#7a7670', '#8a8680', '#6a6660', '#9a8a7a']); ellipseAt(g, rp[0] + 1, rp[1] + 1, rng.range(1.5, 3.5), rng.range(1, 2), 'rgba(0,0,0,0.25)'); ellipseAt(g, rp[0], rp[1], rng.range(1.5, 3.5), rng.range(1, 2), rc); } break;
    }
    return (litArr[k] = store('lit' + k, c, ax, ay));
  };

  /* ---------- Telhados ---------- */
  /* code (montado em render.js): bits 0-1 tipo (1 = cumeeira ao longo de x, 2 = ao longo de y, 3 = plano), 2-7 altura na borda inicial / 2,
   * 8-13 altura na borda final / 2, 14-19 pico no meio do tile / 2, 20-22 cor, 23 empena visível, 24-27 estilo da parede, 28-31 beirais (N=1, L=2, S=4, O=8) */
  var roofMap = new Map();
  S.roof = function (code) {
    var s0 = roofMap.get(code);
    if (s0) { return s0; }
    var kind = code & 3, a = ((code >>> 2) & 63) * 2, b = ((code >>> 8) & 63) * 2, p = ((code >>> 14) & 63) * 2;
    var colI = (code >>> 20) & 7, gable = (code >>> 23) & 1, style = (code >>> 24) & 15, fl = (code >>> 28) & 15;
    var maxH = Math.max(a, b, p) + 14;
    var c = mk(TW + 6, TH + maxH + 8), g = c.getContext('2d');
    var ax = HW + 3, ay = maxH + 2;
    g.translate(ax, ay);
    var base = FLOOR_COLORS[F.ROOF][colI];
    var rng = new U.Rng((code >>> 0) % 100000 + 13);
    var i, k;
    if (kind === 3) {
      var flat = U.mix(base, '#5c5b57', 0.65);
      poly(g, [ip(0, 0, 0), ip(1, 0, 0), ip(1, 1, 0), ip(0, 1, 0)], flat);
      for (i = 0; i < 40; i++) { var dp = ip(rng.next(), rng.next(), 0); g.fillStyle = U.shade(flat, rng.chance(0.5) ? 1.15 : 0.82); g.fillRect(dp[0], dp[1], 1, 1); }
      var lip = U.shade(flat, 0.92);
      if (fl & 1) { box(g, 0, 0, 1, 0.09, 0, 6, lip); }
      if (fl & 8) { box(g, 0, 0, 0.09, 1, 0, 6, lip); }
      if (fl & 4) { box(g, 0, 0.91, 1, 0.09, 0, 6, lip); }
      if (fl & 2) { box(g, 0.91, 0, 0.09, 1, 0, 6, lip); }
    } else {
      var X = kind === 1;
      var hAt = function (u) { if (p) { return u <= 0.5 ? a + (p - a) * u * 2 : p + (b - p) * (u - 0.5) * 2; } return a + (b - a) * u; };
      // t corre ao longo da cumeeira, u atravessa (do lado inicial ao final)
      var pt = function (t, u, dh) { return X ? ip(t, u, hAt(u) + (dh || 0)) : ip(u, t, hAt(u) + (dh || 0)); };
      if (gable) {
        var st = C.WALL_STYLES[style] || C.WALL_STYLES[0];
        var gf = X ? 0.95 : 0.8;
        var gp = X ? [ip(1, 0, 0), ip(1, 1, 0), ip(1, 1, b)] : [ip(0, 1, 0), ip(1, 1, 0), ip(1, 1, b)];
        if (p) { gp.push(X ? ip(1, 0.5, p) : ip(0.5, 1, p)); }
        gp.push(X ? ip(1, 0, a) : ip(0, 1, a));
        poly(g, gp, U.shade(st.base, gf), 'rgba(0,0,0,0.35)');
        g.save(); poly(g, gp); g.clip();
        g.strokeStyle = U.shade(st.base, gf * 0.86); g.lineWidth = 1;
        for (k = 7; k < maxH; k += 7) {
          var l0 = X ? ip(1, 0, k) : ip(0, 1, k), l1 = X ? ip(1, 1, k) : ip(1, 1, k);
          g.beginPath(); g.moveTo(l0[0], l0[1]); g.lineTo(l1[0], l1[1]); g.stroke();
        }
        if (p > 26) { // respiro do sótão
          var vc = X ? ip(1, 0.5, Math.max(a, b, p) * 0.45) : ip(0.5, 1, Math.max(a, b, p) * 0.45);
          g.fillStyle = U.shade(st.trim, 0.7); g.fillRect(vc[0] - 3, vc[1] - 4, 6, 7);
        }
        g.restore();
      }
      var segs = p ? [[0, 0.5], [0.5, 1]] : [[0, 1]];
      for (var sI = 0; sI < segs.length; sI++) {
        var u0 = segs[sI][0], u1 = segs[sI][1], h0 = hAt(u0), h1 = hAt(u1);
        var f = h1 > h0 + 0.5 ? (X ? 0.74 : 0.84) : (h1 < h0 - 0.5 ? (X ? 1.08 : 0.97) : 0.95);
        var face = [pt(0, u0), pt(1, u0), pt(1, u1), pt(0, u1)];
        var fc = U.shade(base, f);
        poly(g, face, fc);
        g.save(); poly(g, face); g.clip();
        // fiadas de telhas paralelas à cumeeira, com juntas desencontradas
        var rows = Math.max(3, Math.round((u1 - u0) * 8));
        g.lineWidth = 1;
        for (k = 0; k < rows; k++) {
          var ua = u0 + (u1 - u0) * k / rows, ub = u0 + (u1 - u0) * (k + 1) / rows;
          var r0 = pt(0, ua), r1 = pt(1, ua);
          g.strokeStyle = U.shade(base, f * 0.72);
          g.beginPath(); g.moveTo(r0[0], r0[1] + 0.5); g.lineTo(r1[0], r1[1] + 0.5); g.stroke();
          g.strokeStyle = U.shade(base, f * 1.12);
          g.beginPath(); g.moveTo(r0[0], r0[1] + 1.5); g.lineTo(r1[0], r1[1] + 1.5); g.stroke();
          g.strokeStyle = U.shade(base, f * 0.8);
          for (var j = 0; j < 5; j++) {
            var tt = (j + (k % 2) * 0.5) / 5;
            var j0 = pt(tt, ua), j1 = pt(tt, ub);
            g.beginPath(); g.moveTo(j0[0], j0[1]); g.lineTo(j1[0], j1[1]); g.stroke();
          }
        }
        for (i = 0; i < 26; i++) {
          var sp = pt(rng.next(), u0 + (u1 - u0) * rng.next());
          g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.12)';
          g.fillRect(sp[0], sp[1], 2, 1);
        }
        g.restore();
      }
      // cumeeira (no meio do tile)
      if (p) {
        var k0 = pt(0, 0.5, 1), k1 = pt(1, 0.5, 1);
        g.strokeStyle = U.shade(base, 0.55); g.lineWidth = 3; g.beginPath(); g.moveTo(k0[0], k0[1]); g.lineTo(k1[0], k1[1]); g.stroke();
        g.strokeStyle = U.shade(base, 1.05); g.lineWidth = 1; g.beginPath(); g.moveTo(k0[0], k0[1] - 1); g.lineTo(k1[0], k1[1] - 1); g.stroke();
      }
      // beirais: tábua escura na borda baixa da frente, linha na de trás
      var fasc = '#2c2520';
      var front = X ? (fl & 4) : (fl & 2), back = X ? (fl & 1) : (fl & 8);
      if (front) { var e0 = pt(0, 1), e1 = pt(1, 1); poly(g, [e0, e1, [e1[0], e1[1] + 3], [e0[0], e0[1] + 3]], fasc); }
      if (back) { var b0 = pt(0, 0), b1 = pt(1, 0); g.strokeStyle = fasc; g.lineWidth = 1.5; g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.stroke(); }
      if (gable) { // acabamento da empena
        var vg = p ? [pt(1, 0), pt(1, 0.5), pt(1, 1)] : [pt(1, 0), pt(1, 1)];
        g.strokeStyle = fasc; g.lineWidth = 2; g.beginPath(); g.moveTo(vg[0][0], vg[0][1]);
        for (k = 1; k < vg.length; k++) { g.lineTo(vg[k][0], vg[k][1]); }
        g.stroke();
      }
    }
    var sr = store('r' + code, c, ax, ay, true);
    roofMap.set(code, sr);
    return sr;
  };

  /* ---------- Paredes ---------- */
  /* ponto ao longo da parede: side 0 = norte (vai para +x), 1 = oeste (vai para +y) */
  function wp(side, u, h) { return side === 0 ? [HW * u, HH * u - h] : [-HW * u, HH * u - h]; }
  function wquad(g, side, u0, u1, h0, h1, fill, ox, oy) {
    var a = wp(side, u0, h0), b = wp(side, u1, h0), c = wp(side, u1, h1), d = wp(side, u0, h1);
    poly(g, [[a[0] + ox, a[1] + oy], [b[0] + ox, b[1] + oy], [c[0] + ox, c[1] + oy], [d[0] + ox, d[1] + oy]], fill);
  }
  function wline(g, side, u0, h0, u1, h1, color, lw, ox, oy) {
    var a = wp(side, u0, h0), b = wp(side, u1, h1);
    g.strokeStyle = color; g.lineWidth = lw || 1; g.beginPath(); g.moveTo(a[0] + ox, a[1] + oy); g.lineTo(b[0] + ox, b[1] + oy); g.stroke();
  }
  /* state: 0 normal; para porta: 1 aberta, 2 quebrada; janela: 1 aberta, 2 quebrada; bar = 0..4 tábuas; cut = parede baixa */
  function wallSprite(type, style, side, state, bar, cut, extra, grime) {
    grime = grime || 0;
    var nk = ((((((type * 16 + style) * 2 + side) * 4 + state) * 5 + bar) * 2 + (cut ? 1 : 0)) * 2 + (extra ? 1 : 0)) * 3 + grime;
    var s0 = wallArr[nk];
    if (s0) { return s0; }
    var key = 'w' + type + '_' + style + '_' + side + '_' + state + '_' + bar + '_' + (cut ? 1 : 0) + '_' + (extra || 0) + '_' + grime;
    var H = cut ? C.CUT_WALL_H : WH;
    var pad = 6;
    var c = mk(TW * 2, HH + WH + pad * 2 + 4), g = c.getContext('2d');
    var ox = TW, oy = WH + pad;
    var st = C.WALL_STYLES[style] || C.WALL_STYLES[0];
    var faceF = side === 0 ? 0.82 : 1.0;
    var baseCol = U.shade(st.base, faceF);
    var trim = U.shade(st.trim, faceF);
    var T2 = 3; // espessura (px de "topo")
    var full = type === E.WALL || type === E.WINDOW || type === E.DOOR || type === E.DOORWAY || type === E.GARAGE;
    if (full) {
      // sombra de contato no chão junto à parede (oclusão ambiente)
      var aoD = side === 0 ? [-HW * 0.3, HH * 0.3] : [HW * 0.3, HH * 0.3];
      var w0 = wp(side, 0, 0), w1 = wp(side, 1, 0);
      var mx = (w0[0] + w1[0]) / 2 + ox, my = (w0[1] + w1[1]) / 2 + oy;
      var ao = g.createLinearGradient(mx, my, mx + aoD[0], my + aoD[1]);
      ao.addColorStop(0, 'rgba(0,0,0,0.3)'); ao.addColorStop(1, 'rgba(0,0,0,0)');
      poly(g, [[w0[0] + ox, w0[1] + oy], [w1[0] + ox, w1[1] + oy], [w1[0] + ox + aoD[0], w1[1] + oy + aoD[1]], [w0[0] + ox + aoD[0], w0[1] + oy + aoD[1]]], ao);
      // face
      wquad(g, side, 0, 1, 0, H, baseCol, ox, oy);
      // escurece de leve a base da parede
      if (!cut) {
        var a0 = wp(side, 0.5, 0), a1 = wp(side, 0.5, 22);
        var wg = g.createLinearGradient(a0[0] + ox, a0[1] + oy, a1[0] + ox, a1[1] + oy);
        wg.addColorStop(0, 'rgba(0,0,0,0.18)'); wg.addColorStop(1, 'rgba(0,0,0,0)');
        wquad(g, side, 0, 1, 0, 22, wg, ox, oy);
      }
      if (!cut) {
        if (st.brick) {
          // tijolos com tons variados e rejunte claro
          var brng = new U.Rng(style * 31 + side * 7 + (extra || 0) * 3 + grime * 101);
          var mort = U.shade('#a89a8a', faceF * 0.95);
          wquad(g, side, 0, 1, 0, H, mort, ox, oy);
          for (var r = 0; r < H / 5; r++) {
            for (var b = -1; b < 8; b++) {
              var u0b = (b + (r % 2) * 0.5) / 8 + 0.008, u1b = (b + 1 + (r % 2) * 0.5) / 8 - 0.008;
              if (u1b <= 0 || u0b >= 1) { continue; }
              wquad(g, side, Math.max(0, u0b), Math.min(1, u1b), r * 5 + 1, r * 5 + 4.6, U.shade(st.base, faceF * (0.82 + brng.next() * 0.3)), ox, oy);
            }
          }
        } else if (st.tiles) {
          for (var r2 = 0; r2 < H / 10; r2++) { wline(g, side, 0, r2 * 10, 1, r2 * 10, U.shade(st.base, faceF * 0.88), 1, ox, oy); }
          for (var b2 = 1; b2 < 4; b2++) { wline(g, side, b2 / 4, 0, b2 / 4, H, U.shade(st.base, faceF * 0.88), 1, ox, oy); }
        } else if (!st.interior) {
          for (var r3 = 1; r3 < H / 7; r3++) { wline(g, side, 0, r3 * 7, 1, r3 * 7, U.shade(st.base, faceF * 0.9), 1, ox, oy); }
        } else {
          // papel de parede estampado (por estilo), rodapé e moldura no alto
          var pc = U.shade(st.base, faceF * 0.88), pl = U.shade(st.base, faceF * 1.08);
          var pr = new U.Rng(style * 13 + side);
          if (st.pattern === 'stripes') {
            for (var sI2 = 0; sI2 < 8; sI2++) { wquad(g, side, sI2 / 8 + 0.02, sI2 / 8 + 0.055, 6, H - 4, pc, ox, oy); }
          } else if (st.pattern === 'floral') {
            for (var fr = 0; fr < H / 10; fr++) { for (var fc = 0; fc < 5; fc++) { var fp = wp(side, (fc + (fr % 2) * 0.5 + 0.25) / 5, 10 + fr * 10); g.fillStyle = (fr + fc) % 3 ? pc : U.shade('#8a5a6a', faceF); g.fillRect(fp[0] + ox - 1, fp[1] + oy - 1, 2, 2); g.fillStyle = pl; g.fillRect(fp[0] + ox, fp[1] + oy - 2, 1, 1); } }
          } else if (st.pattern === 'diamond') {
            for (var dr = 0; dr < H / 12; dr++) { for (var dc = 0; dc < 4; dc++) { var u0 = (dc + (dr % 2) * 0.5) / 4, h0 = 8 + dr * 12; wline(g, side, u0, h0, u0 + 0.125, h0 + 6, pc, 1, ox, oy); wline(g, side, u0 + 0.125, h0 + 6, u0 + 0.25, h0, pc, 1, ox, oy); } }
          } else if (st.pattern === 'boards') {
            for (var bI = 1; bI < 6; bI++) { wline(g, side, bI / 6, 5, bI / 6, H, U.shade(st.base, faceF * 0.72), 1, ox, oy); }
            for (var gI2 = 0; gI2 < 10; gI2++) { var gu = pr.next(); wline(g, side, gu, pr.range(8, H * 0.5), gu, pr.range(H * 0.55, H - 4), U.shade(st.base, faceF * (pr.chance(0.5) ? 0.9 : 1.08)), 1, ox, oy); }
          }
          wquad(g, side, 0, 1, 0, 6, U.shade(st.trim, faceF), ox, oy);
          wline(g, side, 0, 6, 1, 6, U.shade(st.trim, faceF * 0.7), 1, ox, oy);
          wquad(g, side, 0, 1, H - 3, H, U.shade(st.trim, faceF * 1.05), ox, oy);
        }
      }
      // sujeira: manchas de água escorrendo, mofo na base, tinta descascada
      if (!cut) {
        var gr = new U.Rng(grime * 7919 + style * 31 + side * 7 + type);
        var nSt = st.interior ? (grime > 1 ? 1 : 0) : grime + 1;
        for (var sI = 0; sI < nSt; sI++) {
          var su = gr.range(0.05, 0.95), sh0 = gr.range(H * 0.5, H), sh1 = gr.range(H * 0.05, H * 0.4);
          var sg0 = wp(side, su, sh0), sg1 = wp(side, su, sh1);
          var sgr = g.createLinearGradient(sg0[0] + ox, sg0[1] + oy, sg1[0] + ox, sg1[1] + oy);
          sgr.addColorStop(0, 'rgba(40,34,24,0.16)'); sgr.addColorStop(1, 'rgba(40,34,24,0)');
          wquad(g, side, su - 0.05, su + 0.05 + gr.range(0, 0.06), sh1, sh0, sgr, ox, oy);
        }
        var mold = g.createLinearGradient(0, oy - 2, 0, oy - 30);
        mold.addColorStop(0, 'rgba(48,54,30,' + (st.interior ? 0.12 : 0.3) + ')'); mold.addColorStop(1, 'rgba(48,54,30,0)');
        wquad(g, side, 0, 1, 0, 30, mold, ox, oy);
        if (!st.interior && grime === 2) {
          for (var pI = 0; pI < 2; pI++) {
            var pu = gr.range(0.05, 0.9), ph = gr.range(5, H - 10), pw = gr.range(0.04, 0.1);
            wquad(g, side, pu, pu + pw, ph, ph + gr.range(3, 8), U.shade(st.base, faceF * (gr.chance(0.5) ? 1.06 : 0.88)), ox, oy);
          }
        }
      }
      // aberturas
      if (type === E.WINDOW && !cut) {
        var glass = state === 2 ? '#1c2228' : (state === 1 ? '#22303a' : '#7fa6bf');
        wquad(g, side, 0.18, 0.82, H * 0.34, H * 0.84, U.shade('#e8e4da', faceF), ox, oy);
        wquad(g, side, 0.23, 0.77, H * 0.38, H * 0.80, glass, ox, oy);
        if (state === 0) { wline(g, side, 0.3, H * 0.75, 0.45, H * 0.45, 'rgba(255,255,255,0.45)', 2, ox, oy); wline(g, side, 0.5, H * 0.59, 0.5, H * 0.59, 'rgba(0,0,0,0)', 1, ox, oy); wline(g, side, 0.23, H * 0.59, 0.77, H * 0.59, U.shade('#e8e4da', faceF), 2, ox, oy); }
        if (state === 1) { wquad(g, side, 0.23, 0.77, H * 0.6, H * 0.8, '#7fa6bf', ox, oy); wline(g, side, 0.23, H * 0.6, 0.77, H * 0.6, U.shade('#e8e4da', faceF), 2, ox, oy); }
        if (state === 2) {
          var shard = ['rgba(150,190,210,0.75)'];
          g.fillStyle = shard[0];
          var p1 = wp(side, 0.23, H * 0.80), p2 = wp(side, 0.4, H * 0.80), p3 = wp(side, 0.3, H * 0.62);
          poly(g, [[p1[0] + ox, p1[1] + oy], [p2[0] + ox, p2[1] + oy], [p3[0] + ox, p3[1] + oy]], shard[0]);
          var q1 = wp(side, 0.77, H * 0.38), q2 = wp(side, 0.6, H * 0.38), q3 = wp(side, 0.72, H * 0.55);
          poly(g, [[q1[0] + ox, q1[1] + oy], [q2[0] + ox, q2[1] + oy], [q3[0] + ox, q3[1] + oy]], shard[0]);
        }
        if (extra === 1) { wquad(g, side, 0.23, 0.77, H * 0.38, H * 0.80, 'rgba(160,60,60,0.85)', ox, oy); }
      }
      if ((type === E.DOOR || type === E.DOORWAY || type === E.GARAGE) && !cut) {
        // vão
        wquad(g, side, 0.14, 0.86, 0, H * 0.86, U.shade('#2a2420', 1), ox, oy);
        wline(g, side, 0.14, 0, 0.14, H * 0.86, trim, 2, ox, oy);
        wline(g, side, 0.86, 0, 0.86, H * 0.86, trim, 2, ox, oy);
        wline(g, side, 0.14, H * 0.86, 0.86, H * 0.86, trim, 2, ox, oy);
        if (type === E.DOOR || type === E.GARAGE) {
          var doorCol = type === E.GARAGE ? '#8f8f8a' : (style % 3 === 0 ? '#7a4e2c' : (style % 3 === 1 ? '#5c3a22' : '#e0dbd0'));
          if (state === 0) {
            wquad(g, side, 0.16, 0.84, 0, H * 0.84, U.shade(doorCol, faceF), ox, oy);
            wquad(g, side, 0.24, 0.76, H * 0.48, H * 0.76, U.shade(doorCol, faceF * 0.88), ox, oy);
            wquad(g, side, 0.24, 0.76, H * 0.1, H * 0.4, U.shade(doorCol, faceF * 0.88), ox, oy);
            var kn = wp(side, 0.74, H * 0.42); ellipseAt(g, kn[0] + ox, kn[1] + oy, 2, 2, '#d8c27a');
          } else if (state === 1) {
            // porta aberta: painel perpendicular saindo da dobradiça (u=0.16) para dentro (+y ou +x)
            var hx = wp(side, 0.16, 0);
            var dirv = side === 0 ? [-HW * 0.68, HH * 0.68] : [HW * 0.68, HH * 0.68];
            var h0 = [hx[0] + ox, hx[1] + oy];
            poly(g, [[h0[0], h0[1]], [h0[0] + dirv[0], h0[1] + dirv[1]], [h0[0] + dirv[0], h0[1] + dirv[1] - H * 0.84], [h0[0], h0[1] - H * 0.84]], U.shade(doorCol, side === 0 ? 1.0 : 0.82), 'rgba(0,0,0,0.3)');
          }
        }
      }
      // tábuas de barricada
      if (bar > 0 && !cut) {
        for (var p = 0; p < bar; p++) {
          var hh = H * (0.25 + p * 0.17);
          var a1 = wp(side, 0.05, hh - 4 + (p % 2) * 6), a2 = wp(side, 0.95, hh + 4 - (p % 2) * 6);
          g.strokeStyle = '#4a3420'; g.lineWidth = 7; g.beginPath(); g.moveTo(a1[0] + ox, a1[1] + oy); g.lineTo(a2[0] + ox, a2[1] + oy); g.stroke();
          g.strokeStyle = '#9c7446'; g.lineWidth = 5; g.beginPath(); g.moveTo(a1[0] + ox, a1[1] + oy); g.lineTo(a2[0] + ox, a2[1] + oy); g.stroke();
          var nl = wp(side, 0.12, hh - 3 + (p % 2) * 5); ellipseAt(g, nl[0] + ox, nl[1] + oy, 1, 1, '#ccc');
        }
      }
      // topo (espessura)
      var t0 = wp(side, 0, H), t1 = wp(side, 1, H);
      var off = side === 0 ? [-T2, T2 / 2] : [T2, T2 / 2];
      poly(g, [[t0[0] + ox, t0[1] + oy], [t1[0] + ox, t1[1] + oy], [t1[0] + ox + off[0], t1[1] + oy + off[1]], [t0[0] + ox + off[0], t0[1] + oy + off[1]]], U.shade(st.trim, 0.9));
      // contorno
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
      var a0 = wp(side, 0, 0), a3 = wp(side, 1, 0);
      g.beginPath(); g.moveTo(a0[0] + ox, a0[1] + oy); g.lineTo(t0[0] + ox, t0[1] + oy); g.lineTo(t1[0] + ox, t1[1] + oy); g.lineTo(a3[0] + ox, a3[1] + oy); g.stroke();
    } else if (type === E.FENCE) {
      var fh = cut ? C.CUT_WALL_H : 26;
      var wood = '#8a6a44';
      for (var q = 0; q <= 4; q++) { wline(g, side, q / 4, 0, q / 4, fh + 3, '#4a3826', 4, ox, oy); wline(g, side, q / 4, 0, q / 4, fh + 3, wood, 2, ox, oy); }
      if (!cut) {
        wline(g, side, 0, fh * 0.35, 1, fh * 0.35, '#4a3826', 4, ox, oy); wline(g, side, 0, fh * 0.35, 1, fh * 0.35, U.shade(wood, 1.1), 2, ox, oy);
        wline(g, side, 0, fh * 0.85, 1, fh * 0.85, '#4a3826', 4, ox, oy); wline(g, side, 0, fh * 0.85, 1, fh * 0.85, U.shade(wood, 1.1), 2, ox, oy);
      }
    } else if (type === E.FENCE_TALL) {
      var th = cut ? C.CUT_WALL_H : WH * 0.9;
      wquad(g, side, 0, 1, 0, th, 'rgba(150,155,150,0.18)', ox, oy);
      for (var m2 = 0; m2 <= 8; m2++) { wline(g, side, m2 / 8, 0, m2 / 8 + 0.06, th, 'rgba(180,185,180,0.55)', 1, ox, oy); wline(g, side, m2 / 8 + 0.06, 0, m2 / 8, th, 'rgba(180,185,180,0.55)', 1, ox, oy); }
      wline(g, side, 0, 0, 0, th + 6, '#6b6e6b', 3, ox, oy);
      wline(g, side, 0, th, 1, th, '#8a8d8a', 2, ox, oy);
      if (!cut) { for (var bw = 0; bw < 6; bw++) { var pt = wp(side, bw / 6 + 0.08, th + 4); ellipseAt(g, pt[0] + ox, pt[1] + oy, 2, 1.5, 'rgba(160,160,160,0.8)'); } }
    }
    return (wallArr[nk] = store(key, c, ox, oy));
  }
  S.wall = wallSprite;

  /* ---------- Objetos ---------- */
  var CAR_COLORS = ['#8c2b2b', '#2b4c8c', '#d8d4c8', '#2e2e30', '#5b7b4a', '#b8862f', '#6a6a70', '#7a3f6e', '#c9c2a4', '#3c6d73', '#a14a24', '#425066'];
  function objSprite(o, dir, extra) {
    var nk = (o * 256 + (dir & 255)) * 8 + ((extra || 0) & 7);
    var s0 = objArr[nk];
    if (s0) { return s0; }
    var key = 'o' + o + '_' + dir + '_' + (extra || 0);
    var info = C.OBJ_INFO[o];
    var maxH = Math.ceil((info.h || 1) * WH) + 40;
    var cw = TW + (o === O.CAR ? 128 : 64), chh = TH + maxH + 10;
    var c = mk(cw, chh), g = c.getContext('2d');
    var ax = cw / 2, ay = maxH + 4;
    g.translate(ax, ay);
    var rng = new U.Rng(o * 131 + dir * 17 + (extra || 0) * 7 + 3);
    var bw, bx;
    switch (o) {
      case O.TREE: drawTree(g, rng, dir); break;
      case O.TREE_PINE: drawPine(g, rng, dir); break;
      case O.BUSH: drawBush(g, rng); break;
      case O.TALL_GRASS: drawGrass(g, rng); break;
      case O.BED_HEAD:
      case O.BED_FOOT: drawBed(g, o === O.BED_HEAD, dir, rng); break;
      case O.FRIDGE: bw = againstWall(dir, 0.72, 0.12); box(g, bw[0], bw[1], bw[2], bw[3], 0, 72, '#e4e2dc'); furnitureDetail(g, o, bw, dir, rng); break;
      case O.STOVE: bw = againstWall(dir, 0.75, 0.1); box(g, bw[0], bw[1], bw[2], bw[3], 0, 30, '#e2e0da'); furnitureDetail(g, o, bw, dir, rng);
        for (var bi = 0; bi < 4; bi++) { var pp = ip(bw[0] + bw[2] * (0.28 + (bi % 2) * 0.44), bw[1] + bw[3] * (0.28 + Math.floor(bi / 2) * 0.44), 30); ellipseAt(g, pp[0], pp[1], 5, 2.6, '#2a2a2a'); }
        break;
      case O.COUNTER: bw = againstWall(dir, 0.8, 0.0); box(g, bw[0], bw[1], bw[2], bw[3], 0, 30, '#8a6a4a'); topRect(g, bw[0], bw[1], bw[2], bw[3], 30.5, '#cfc6b0'); furnitureDetail(g, o, bw, dir, rng); break;
      case O.SINK: bw = againstWall(dir, 0.8, 0.0); box(g, bw[0], bw[1], bw[2], bw[3], 0, 30, '#8a6a4a'); topRect(g, bw[0], bw[1], bw[2], bw[3], 30.5, '#cfc6b0'); furnitureDetail(g, o, bw, dir, rng);
        var sc = ip(bw[0] + bw[2] / 2, bw[1] + bw[3] / 2, 31); ellipseAt(g, sc[0], sc[1], 10, 5, '#9aa4a8'); ellipseAt(g, sc[0], sc[1] + 1, 7, 3.4, '#6e787c');
        var fc2 = ip(bw[0] + bw[2] / 2 + (dir === 1 ? -0.3 : 0), bw[1] + bw[3] / 2 + (dir === 2 ? -0.3 : 0), 31); g.strokeStyle = '#b8bcc0'; g.lineWidth = 2; g.beginPath(); g.moveTo(fc2[0], fc2[1]); g.lineTo(fc2[0], fc2[1] - 9); g.lineTo(fc2[0] + (dir === 2 ? -2 : 2), fc2[1] - 7); g.stroke(); break;
      case O.TABLE: drawTable(g, '#8a5f38', 25); break;
      case O.CHAIR: drawChair(g, dir, '#7a5432'); break;
      case O.SOFA: drawSofa(g, dir, ['#6b4a3a', '#3e5c76', '#6b6b45', '#8a4b4b'][(extra || rng.int(0, 3)) % 4]); break;
      case O.SHELF: bw = againstWall(dir, 0.35, 0.06); box(g, bw[0], bw[1], bw[2], bw[3], 0, 70, '#6e4b2c'); drawBooks(g, bw, dir, rng); break;
      case O.WARDROBE: bw = againstWall(dir, 0.55, 0.05); box(g, bw[0], bw[1], bw[2], bw[3], 0, 76, '#7a5634'); furnitureDetail(g, o, bw, dir, rng); break;
      case O.DRESSER: bw = againstWall(dir, 0.5, 0.08); box(g, bw[0], bw[1], bw[2], bw[3], 0, 32, '#80583a'); drawerLines(g, bw, dir, 32); furnitureDetail(g, o, bw, dir, rng); break;
      case O.NIGHTSTAND: bw = againstWall(dir, 0.5, 0.22); box(g, bw[0], bw[1], bw[2], bw[3], 0, 18, '#80583a'); drawerLines(g, bw, dir, 18); furnitureDetail(g, o, bw, dir, rng);
        var lp = ip(bw[0] + bw[2] * 0.5, bw[1] + bw[3] * 0.5, 18); g.fillStyle = '#6a6a5a'; g.fillRect(lp[0] - 1, lp[1] - 12, 2, 12); poly(g, [[lp[0] - 6, lp[1] - 12], [lp[0] + 6, lp[1] - 12], [lp[0] + 4, lp[1] - 20], [lp[0] - 4, lp[1] - 20]], '#d8cca0', 'rgba(0,0,0,0.3)'); break;
      case O.DESK: bw = againstWall(dir, 0.6, 0.05); box(g, bw[0], bw[1], bw[2], bw[3], 0, 25, '#6e5032'); furnitureDetail(g, o, bw, dir, rng); break;
      case O.TOILET: bw = againstWall(dir, 0.3, 0.3); box(g, bw[0], bw[1], bw[2], bw[3], 0, 26, '#eeeeea');
        var tc = ip(0.5, 0.5, 13); ellipseAt(g, tc[0], tc[1], 9, 5, '#f2f2ee'); ellipseAt(g, tc[0], tc[1], 6, 3, '#c9d2d6'); break;
      case O.BATHTUB: box(g, 0.06, 0.06, 0.88, 0.88, 0, 18, '#efefea'); topRect(g, 0.16, 0.16, 0.68, 0.68, 18.5, '#bfcbd0'); break;
      case O.TV: bw = againstWall(dir, 0.45, 0.15); box(g, bw[0], bw[1], bw[2], bw[3], 0, 14, '#4a3828'); box(g, bw[0] + 0.08, bw[1] + 0.06, bw[2] - 0.16, bw[3] - 0.12, 14, 24, '#3a3a3c'); furnitureDetail(g, o, [bw[0] + 0.08, bw[1] + 0.06, bw[2] - 0.16, bw[3] - 0.12], dir, rng); break;
      case O.CRATE: box(g, 0.14, 0.14, 0.72, 0.72, 0, 24, '#9c7a4c'); topRect(g, 0.14, 0.45, 0.72, 0.06, 24.5, '#7a5c36'); break;
      case O.DUMPSTER: box(g, 0.04, 0.12, 0.92, 0.76, 0, 34, '#3f6b4a'); break;
      case O.LAMPPOST: drawLamp(g); break;
      case O.MAILBOX: box(g, 0.46, 0.46, 0.08, 0.08, 0, 22, '#555'); box(g, 0.36, 0.38, 0.28, 0.24, 22, 12, '#2f4f8f'); break;
      case O.SHOP_SHELF: bw = (dir === 1 || dir === 3) ? [0.25, 0.04, 0.5, 0.92] : [0.04, 0.25, 0.92, 0.5]; drawRack(g, bw, rng); break;
      case O.CASH: bw = againstWall(dir, 0.8, 0.0); box(g, bw[0], bw[1], bw[2], bw[3], 0, 30, '#5a5a5e'); box(g, 0.32, 0.32, 0.36, 0.36, 30, 12, '#2c2c30'); break;
      case O.PUMP: box(g, 0.3, 0.3, 0.4, 0.4, 0, 50, '#c8c4bc'); box(g, 0.32, 0.32, 0.36, 0.36, 50, 8, '#b33a2c'); break;
      case O.CAR: drawCar(g, dir, rng); break;
      case O.LOG: drawLog(g, dir); break;
      case O.ROCK: drawRock(g, rng); break;
      case O.BARREL: drawBarrel(g, '#8a4b2c', 30); break;
      case O.RAIN_BARREL: drawBarrel(g, '#2f5d8a', 34); break;
      case O.WORKBENCH: drawTable(g, '#7a5a3a', 28); box(g, 0.2, 0.3, 0.2, 0.15, 28, 4, '#888'); break;
      case O.CAMPFIRE: drawCampfire(g); break;
      case O.CROP: drawCrop(g, extra || 0, rng); break;
      case O.MED_CABINET: bw = againstWall(dir, 0.3, 0.18); box(g, bw[0], bw[1], bw[2], bw[3], 0, 44, '#f0eeea');
        var mc = ip(bw[0] + bw[2] / 2, bw[1] + bw[3], 26); g.fillStyle = '#c0392b'; g.fillRect(mc[0] - 4, mc[1] - 1, 8, 3); g.fillRect(mc[0] - 1, mc[1] - 4, 3, 8); break;
      case O.LOCKER: bw = againstWall(dir, 0.45, 0.12); box(g, bw[0], bw[1], bw[2], bw[3], 0, 70, '#6f7a85'); furnitureDetail(g, o, bw, dir, rng); break;
      case O.GENERATOR: box(g, 0.15, 0.25, 0.7, 0.5, 0, 22, '#d1a52a'); box(g, 0.2, 0.3, 0.2, 0.2, 22, 6, '#333'); break;
      case O.FENCE_POST: box(g, 0.42, 0.42, 0.16, 0.16, 0, 30, '#6b5034'); break;
      case O.CORPSE_PILE: drawRock(g, rng); break;
      default: box(g, 0.2, 0.2, 0.6, 0.6, 0, 20, '#f0f');
    }
    return (objArr[nk] = store(key, c, ax, ay));
  }
  S.obj = objSprite;

  /* copa de folhas: aglomerados sombreados (luz do alto à esquerda) num canvas próprio */
  function foliage(cx, cy, rx, ry, n, greens, rng, leaf) {
    var pad = 14, w = rx * 2 + pad * 2, h = ry * 2 + pad * 2;
    var c = mk(w, h), g = c.getContext('2d');
    var ox = w / 2, oy = h / 2;
    var cl = [];
    for (var i = 0; i < n; i++) {
      var an = rng.next() * Math.PI * 2, rr = Math.sqrt(rng.next());
      cl.push([ox + Math.cos(an) * rr * (rx - 8), oy + Math.sin(an) * rr * (ry - 8), rng.range(leaf * 0.7, leaf * 1.15)]);
    }
    cl.sort(function (p1, p2) { return p1[1] - p2[1]; });
    for (i = 0; i < cl.length; i++) { ellipseAt(g, cl[i][0] + 1.5, cl[i][1] + 2.5, cl[i][2], cl[i][2] * 0.86, greens[0]); }
    for (i = 0; i < cl.length; i++) {
      var q = cl[i], lit = 1 - ((q[0] - ox) / rx * 0.5 + (q[1] - oy) / ry * 0.5 + 1) / 2; // 1 = canto iluminado
      var col = greens[1 + Math.min(2, Math.floor(lit * 3))];
      var gr = g.createRadialGradient(q[0] - q[2] * 0.35, q[1] - q[2] * 0.4, q[2] * 0.15, q[0], q[1], q[2]);
      gr.addColorStop(0, U.shade(col, 1.12)); gr.addColorStop(1, U.shade(col, 0.82));
      g.fillStyle = gr; g.beginPath(); g.ellipse(q[0], q[1], q[2] * 0.95, q[2] * 0.82, 0, 0, Math.PI * 2); g.fill();
      for (var k = 0; k < q[2] * 1.4; k++) { // folhas
        var la = rng.next() * Math.PI * 2, lr = rng.next() * q[2] * 0.85;
        g.fillStyle = rng.chance(0.55) ? 'rgba(220,240,170,0.16)' : 'rgba(10,30,10,0.2)';
        g.fillRect(q[0] + Math.cos(la) * lr, q[1] + Math.sin(la) * lr * 0.8, 2, 2);
      }
    }
    // sombra própria na parte de baixo da copa
    g.globalCompositeOperation = 'source-atop';
    var sg = g.createLinearGradient(0, oy - ry * 0.2, 0, oy + ry);
    sg.addColorStop(0, 'rgba(0,15,0,0)'); sg.addColorStop(1, 'rgba(0,15,0,0.35)');
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    return { c: c, x: cx - ox, y: cy - oy };
  }
  function groundShadow(g, x, y, rx, ry) {
    ellipseAt(g, x + rx * 0.3, y + 3, rx, ry, 'rgba(0,0,0,0.12)');
    ellipseAt(g, x + rx * 0.2, y + 2, rx * 0.65, ry * 0.65, 'rgba(0,0,0,0.14)');
  }
  function trunk(g, x, y, h, w0, w1, bark) {
    poly(g, [[x - w0 / 2 - 2, y + 1], [x - w1 / 2, y - h], [x + w1 / 2, y - h], [x + w0 / 2 + 2, y + 1]], bark);
    poly(g, [[x + 1, y + 1], [x + 1, y - h], [x + w1 / 2, y - h], [x + w0 / 2 + 2, y + 1]], U.shade(bark, 0.7));
    g.strokeStyle = U.shade(bark, 0.62); g.lineWidth = 1;
    for (var i = 0; i < 4; i++) { var bx = x - w0 / 2 + 1 + i * (w0 / 4); g.beginPath(); g.moveTo(bx, y - 2); g.lineTo(bx + (w1 - w0) * 0.25, y - h * (0.5 + (i % 2) * 0.3)); g.stroke(); }
  }
  /* detalhes na face da frente de um móvel encostado na parede (só quando a frente aparece: dir 2 = sul, dir 1 = leste) */
  function front(g, bw, dir) {
    if (dir !== 1 && dir !== 2) { return null; }
    function P(u, h) { return dir === 2 ? ip(bw[0] + bw[2] * u, bw[1] + bw[3] + 0.003, h) : ip(bw[0] + bw[2] + 0.003, bw[1] + bw[3] * u, h); }
    return {
      quad: function (u0, u1, h0, h1, fill, stroke) { poly(g, [P(u0, h0), P(u1, h0), P(u1, h1), P(u0, h1)], fill, stroke || 'rgba(0,0,0,0.35)', 1); },
      line: function (u0, h0, u1, h1, col, w) { var a = P(u0, h0), b = P(u1, h1); g.strokeStyle = col; g.lineWidth = w || 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); },
      knob: function (u, h, col, r) { var a = P(u, h); ellipseAt(g, a[0], a[1], r || 1.5, r || 1.5, col || '#c8c0a0'); }
    };
  }
  function furnitureDetail(g, o, bw, dir, rng) {
    var f = front(g, bw, dir);
    if (!f) { return; }
    var i;
    switch (o) {
      case O.FRIDGE: f.line(0.04, 52, 0.96, 52, 'rgba(0,0,0,0.35)', 1); f.quad(0.82, 0.88, 56, 68, '#9a9a96'); f.quad(0.82, 0.88, 28, 48, '#9a9a96');
        if (rng.chance(0.6)) { f.quad(0.2, 0.36, 36, 44, rng.pick(['#d84a3a', '#3a7ad8', '#e8c83a'])); f.quad(0.42, 0.58, 30, 40, '#f2f0e8'); } break;
      case O.STOVE: f.quad(0.12, 0.88, 4, 20, '#2e2e30'); f.quad(0.2, 0.8, 7, 17, 'rgba(120,130,135,0.6)'); f.line(0.25, 21.5, 0.75, 21.5, '#bbb', 1.5);
        for (i = 0; i < 4; i++) { f.knob(0.2 + i * 0.2, 26, '#3a3a3a', 1.6); } break;
      case O.COUNTER: case O.SINK: f.quad(0.03, 0.97, 27, 31, U.shade('#cfc6b0', 0.85)); f.line(0.5, 3, 0.5, 26, 'rgba(0,0,0,0.4)', 1);
        f.quad(0.06, 0.47, 4, 24, 'rgba(255,255,255,0.05)'); f.quad(0.53, 0.94, 4, 24, 'rgba(255,255,255,0.05)'); f.knob(0.43, 20, '#d8d0b0', 1.3); f.knob(0.57, 20, '#d8d0b0', 1.3); break;
      case O.WARDROBE: case O.LOCKER: f.line(0.5, 3, 0.5, o === O.LOCKER ? 68 : 74, 'rgba(0,0,0,0.45)', 1); f.knob(0.44, 38, '#d8c27a', 1.4); f.knob(0.56, 38, '#d8c27a', 1.4);
        if (o === O.LOCKER) { for (i = 0; i < 3; i++) { f.line(0.15, 60 - i * 3, 0.35, 60 - i * 3, 'rgba(0,0,0,0.35)', 1); f.line(0.65, 60 - i * 3, 0.85, 60 - i * 3, 'rgba(0,0,0,0.35)', 1); } } break;
      case O.DRESSER: case O.NIGHTSTAND: var hh = o === O.DRESSER ? 32 : 18, nd = o === O.DRESSER ? 3 : 2;
        for (i = 0; i < nd; i++) { f.knob(0.5, hh * (i + 0.5) / nd, '#d8c27a', 1.3); } break;
      case O.DESK: f.quad(0.6, 0.95, 4, 22, 'rgba(0,0,0,0.12)'); f.knob(0.78, 18, '#d8c27a', 1.2); f.knob(0.78, 10, '#d8c27a', 1.2); break;
      case O.TV: f.quad(0.14, 0.86, 16, 36, '#1a1c1e'); f.quad(0.18, 0.82, 18, 34, rng.chance(0.5) ? '#2e3a40' : '#384850'); f.line(0.25, 32, 0.45, 22, 'rgba(255,255,255,0.18)', 2); f.knob(0.9, 30, '#888', 1); break;
      case O.MED_CABINET: f.line(0.5, 4, 0.5, 42, 'rgba(0,0,0,0.3)', 1); break;
      case O.SHELF: break;
    }
  }
  function drawTree(g, rng, v) {
    var t = ip(0.5, 0.5, 0);
    var greens = [['#20361a', '#33572a', '#416b31', '#55823c'], ['#2a3a18', '#435d26', '#52702d', '#6b8a3a'], ['#1d3320', '#2f5032', '#3b623c', '#4f7a4a'], ['#33391a', '#56672a', '#6a7d33', '#83963f']][v % 4];
    var hgt = 58 + rng.int(0, 14), rx = 34 + rng.int(0, 8), ry = 30 + rng.int(0, 6);
    groundShadow(g, t[0], t[1], rx + 6, (rx + 6) * 0.45);
    trunk(g, t[0], t[1], hgt + 10, 9, 5, '#5a4130');
    g.strokeStyle = '#4a3424'; g.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var by = t[1] - hgt + 4 + i * 6, dir = i % 2 ? 1 : -1;
      g.lineWidth = 3 - i * 0.6; g.beginPath(); g.moveTo(t[0], by); g.lineTo(t[0] + dir * rng.range(10, 18), by - rng.range(12, 20)); g.stroke();
    }
    g.lineCap = 'butt';
    var fo = foliage(t[0], t[1] - hgt - ry * 0.55, rx, ry, 18 + rng.int(0, 6), greens, rng, 13);
    g.drawImage(fo.c, fo.x, fo.y);
  }
  function drawPine(g, rng, v) {
    var t = ip(0.5, 0.5, 0);
    groundShadow(g, t[0], t[1], 26, 11);
    trunk(g, t[0], t[1], 40, 7, 4, '#4f3826');
    var cols = [['#1e3a24', '#2b4d30', '#3a6340'], ['#223f26', '#30553a', '#40704a'], ['#1b3320', '#284a2c', '#36603a'], ['#243d22', '#335733', '#456d42']][v % 4];
    var tiers = 6;
    for (var i = 0; i < tiers; i++) {
      var y = t[1] - 26 - i * 22, w = 32 - i * 4.6, hh = 40;
      var pts = [[t[0], y - hh]];
      var teeth = 7;
      for (var k = 0; k <= teeth; k++) { var u = k / teeth; pts.push([t[0] + w * (u * 2 - 1) * (k === 0 || k === teeth ? 1 : 0.96), y + (k % 2 ? 4 : -1) + Math.sin(u * Math.PI) * 4]); }
      pts.push([t[0], y - hh]);
      var ordered = [pts[0]].concat(pts.slice(1, pts.length - 1).reverse());
      var gr = g.createLinearGradient(t[0] - w, 0, t[0] + w, 0);
      gr.addColorStop(0, cols[2]); gr.addColorStop(0.45, cols[1]); gr.addColorStop(1, cols[0]);
      g.beginPath(); g.moveTo(ordered[0][0], ordered[0][1]);
      for (k = 1; k < ordered.length; k++) { g.lineTo(ordered[k][0], ordered[k][1]); }
      g.closePath(); g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(0,20,0,0.35)'; g.lineWidth = 1; g.stroke();
      g.strokeStyle = 'rgba(190,230,170,0.14)';
      for (k = 0; k < 10; k++) { var nx = t[0] + rng.range(-w * 0.8, w * 0.2), ny = y - rng.range(0, hh * 0.7); g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx - 3, ny + 3); g.stroke(); }
    }
  }
  function drawBush(g, rng) {
    var t = ip(0.5, 0.5, 0);
    groundShadow(g, t[0], t[1], 17, 7);
    var fo = foliage(t[0], t[1] - 13, 18, 14, 9, ['#1f3618', '#36592a', '#447034', '#58853f'], rng, 8);
    g.drawImage(fo.c, fo.x, fo.y);
    if (rng.chance(0.4)) { for (var k = 0; k < 6; k++) { ellipseAt(g, t[0] + rng.range(-11, 11), t[1] - rng.range(6, 22), 1.5, 1.5, '#a8283a'); } }
  }
  function drawGrass(g, rng) {
    var t = ip(0.5, 0.5, 0);
    for (var i = 0; i < 22; i++) {
      var x = t[0] + rng.range(-22, 22), y = t[1] + rng.range(-8, 8);
      g.strokeStyle = ['#6b8a3e', '#5a7a34', '#7d9a48', '#4d6a2c'][i % 4]; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + rng.range(-4, 4), y - rng.range(8, 16)); g.stroke();
    }
  }
  function drawBed(g, head, dir, rng) {
    var col = ['#4a6a8a', '#8a4a5a', '#5a7a4a', '#8a7a4a'][dir % 4];
    box(g, 0.08, 0.08, 0.84, 0.84, 0, 10, '#6e4b2c');
    box(g, 0.1, 0.1, 0.8, 0.8, 10, 6, head ? '#e8e4dc' : col);
    if (!head) { box(g, 0.1, 0.1, 0.8, 0.8, 10, 7, col); }
    if (head) {
      var hb = againstWall(dir, 0.08, 0.06);
      box(g, hb[0], hb[1], hb[2], hb[3], 0, 34, '#5e3f24');
      var pw = againstWall(dir, 0.28, 0.18);
      var px = pw[0] + (dir === 1 ? 0.12 : (dir === 3 ? -0.12 : 0)), py = pw[1] + (dir === 2 ? 0.12 : (dir === 0 ? -0.12 : 0));
      box(g, px, py, pw[2], pw[3], 16, 5, '#f4f2ee');
      // começo do cobertor
      var bl = againstWall((dir + 2) % 4, 0.45, 0.1);
      box(g, bl[0], bl[1], bl[2], bl[3], 16, 2, col);
    }
  }
  function drawTable(g, color, h) {
    var legs = [[0.15, 0.15], [0.8, 0.15], [0.15, 0.8], [0.8, 0.8]];
    legs.forEach(function (l) { box(g, l[0], l[1], 0.05, 0.05, 0, h - 3, U.shade(color, 0.8), { outline: false }); });
    box(g, 0.1, 0.1, 0.8, 0.8, h - 3, 3, color);
  }
  function drawChair(g, dir, color) {
    var legs = [[0.3, 0.3], [0.65, 0.3], [0.3, 0.65], [0.65, 0.65]];
    legs.forEach(function (l) { box(g, l[0], l[1], 0.04, 0.04, 0, 13, U.shade(color, 0.8), { outline: false }); });
    box(g, 0.27, 0.27, 0.46, 0.46, 13, 2, color);
    var b = [[0.27, 0.69, 0.46, 0.04], [0.27, 0.27, 0.04, 0.46], [0.27, 0.27, 0.46, 0.04], [0.69, 0.27, 0.04, 0.46]][dir];
    box(g, b[0], b[1], b[2], b[3], 15, 16, color);
  }
  function drawSofa(g, dir, color) {
    box(g, 0.06, 0.06, 0.88, 0.88, 0, 12, U.shade(color, 0.85));
    var back = againstWall(dir, 0.24, 0.04);
    box(g, back[0], back[1], back[2], back[3], 12, 15, color);
    var horiz = dir === 0 || dir === 2;
    // braços nas pontas
    if (horiz) { box(g, 0.04, 0.06, 0.12, 0.88, 12, 8, U.shade(color, 0.95)); box(g, 0.84, 0.06, 0.12, 0.88, 12, 8, U.shade(color, 0.95)); } else { box(g, 0.06, 0.04, 0.88, 0.12, 12, 8, U.shade(color, 0.95)); box(g, 0.06, 0.84, 0.88, 0.12, 12, 8, U.shade(color, 0.95)); }
    // almofadas do assento
    for (var i = 0; i < 2; i++) {
      if (horiz) { box(g, 0.17 + i * 0.335, dir === 2 ? 0.3 : 0.08, 0.32, 0.6, 12, 4, U.shade(color, 1.08)); } else { box(g, dir === 1 ? 0.3 : 0.08, 0.17 + i * 0.335, 0.6, 0.32, 12, 4, U.shade(color, 1.08)); }
    }
  }
  function drawBooks(g, bw, dir, rng) {
    var cols = ['#8a2b2b', '#2b4a8a', '#3a6a3a', '#8a7a2b', '#5a2b6a', '#2b6a6a', '#c9b98a'];
    var faceX = dir === 1 || dir === 3;
    for (var shelfI = 0; shelfI < 4; shelfI++) {
      var h0 = 6 + shelfI * 16;
      for (var b = 0; b < 8; b++) {
        if (rng.chance(0.2)) { continue; }
        var u = 0.05 + b * 0.11;
        var p;
        if (!faceX) { p = ip(bw[0] + bw[2] * u, bw[1] + bw[3] + 0.001, h0); } else { p = ip(bw[0] + bw[2] + 0.001, bw[1] + bw[3] * u, h0); }
        g.fillStyle = rng.pick(cols); g.fillRect(p[0] - 2, p[1] - 12, 4, 12);
      }
    }
  }
  /* estante de metal aberta (como em depósitos e lojas): 4 colunas, 3 prateleiras com caixas, latas e potes */
  function drawRack(g, bw, rng) {
    var metal = '#3a3c40', posts = [[0, 0], [1, 0], [0, 1], [1, 1]];
    function post(px, py) { box(g, bw[0] + bw[2] * px - (px ? 0.04 : 0), bw[1] + bw[3] * py - (py ? 0.04 : 0), 0.04, 0.04, 0, 56, metal, { outline: false }); }
    post(0, 0); post(1, 0); post(0, 1);
    var levels = [4, 22, 40];
    levels.forEach(function (h, li) {
      box(g, bw[0], bw[1], bw[2], bw[3], h, 2, '#55585c');
      // coisas na prateleira
      var n = 3 + rng.int(0, 3);
      for (var i = 0; i < n; i++) {
        if (rng.chance(0.2)) { continue; }
        var long = bw[2] > bw[3];
        var u = (i + 0.15) / n, w = 0.7 / n;
        var x0 = long ? bw[0] + bw[2] * u : bw[0] + 0.06, y0 = long ? bw[1] + 0.06 : bw[1] + bw[3] * u;
        var kind = rng.next();
        if (kind < 0.45) { // caixa de papelão
          var bh = rng.range(8, 14);
          box(g, x0, y0, long ? bw[2] * w : bw[2] - 0.12, long ? bw[3] - 0.12 : bw[3] * w, h + 2, bh, rng.pick(['#b0905e', '#a4845a', '#c2a070', '#8e7048']));
        } else if (kind < 0.8) { // latas / potes
          for (var k = 0; k < 3; k++) {
            var cx = long ? x0 + bw[2] * w * (0.2 + k * 0.3) : x0 + (bw[2] - 0.12) * (0.2 + k * 0.3), cy = long ? y0 + (bw[3] - 0.12) * 0.5 : y0 + bw[3] * w * 0.5;
            var cp = ip(cx, cy, h + 2), ch2 = rng.range(5, 9), cc = rng.pick(['#c8ccd0', '#a83a2a', '#3a6aa8', '#e8e2d0', '#d8a83a', '#5a8a4a']);
            g.fillStyle = U.shade(cc, 0.8); g.fillRect(cp[0] - 2.5, cp[1] - ch2, 5, ch2);
            g.fillStyle = cc; g.fillRect(cp[0] - 2.5, cp[1] - ch2, 3, ch2);
            ellipseAt(g, cp[0], cp[1] - ch2, 2.5, 1.2, U.shade(cc, 1.15));
          }
        } else { // ferramentas / sacos
          box(g, x0, y0, long ? bw[2] * w : bw[2] - 0.14, long ? bw[3] - 0.14 : bw[3] * w, h + 2, 4, rng.pick(['#6a6a5a', '#8a3a2a', '#4a5a6a']));
        }
      }
    });
    post(1, 1);
  }
  function drawProducts(g, bw, rng) {
    var cols = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad', '#ecf0f1', '#d35400'];
    for (var sh = 0; sh < 3; sh++) {
      for (var i = 0; i < 6; i++) {
        if (rng.chance(0.25)) { continue; }
        var p = ip(bw[0] + bw[2] * (0.1 + i * 0.15), bw[1] + bw[3] + 0.001, 6 + sh * 15);
        g.fillStyle = rng.pick(cols); g.fillRect(p[0] - 2, p[1] - 8, 4, 8);
      }
    }
  }
  function doorLines(g, bw, dir, h) {
    var faceX = dir === 1 || dir === 3;
    var a, b;
    if (!faceX) { a = ip(bw[0] + bw[2] / 2, bw[1] + bw[3], 4); b = ip(bw[0] + bw[2] / 2, bw[1] + bw[3], h - 4); } else { a = ip(bw[0] + bw[2], bw[1] + bw[3] / 2, 4); b = ip(bw[0] + bw[2], bw[1] + bw[3] / 2, h - 4); }
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  function drawerLines(g, bw, dir, h) {
    var faceX = dir === 1 || dir === 3;
    for (var k = 1; k < 3; k++) {
      var a, b;
      if (!faceX) { a = ip(bw[0], bw[1] + bw[3], h * k / 3); b = ip(bw[0] + bw[2], bw[1] + bw[3], h * k / 3); } else { a = ip(bw[0] + bw[2], bw[1], h * k / 3); b = ip(bw[0] + bw[2], bw[1] + bw[3], h * k / 3); }
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
  }
  function drawLamp(g) {
    var t = ip(0.5, 0.5, 0);
    ellipseAt(g, t[0], t[1], 6, 3, 'rgba(0,0,0,0.3)');
    g.fillStyle = '#3e4246'; g.fillRect(t[0] - 2, t[1] - 196, 4, 198);
    g.fillRect(t[0] - 2, t[1] - 196, 22, 3);
    ellipseAt(g, t[0] + 20, t[1] - 192, 7, 3, '#5a5e62');
    ellipseAt(g, t[0] + 20, t[1] - 190, 5, 2, '#f3e3a0');
  }
  function drawBarrel(g, color, h) {
    var t = ip(0.5, 0.5, 0);
    ellipseAt(g, t[0], t[1], 13, 6.5, U.shade(color, 0.7));
    g.fillStyle = color; g.fillRect(t[0] - 13, t[1] - h, 26, h);
    g.fillStyle = U.shade(color, 0.8); g.fillRect(t[0] + 2, t[1] - h, 11, h);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(t[0] - 13, t[1] - h * 0.3, 26, 2); g.fillRect(t[0] - 13, t[1] - h * 0.75, 26, 2);
    ellipseAt(g, t[0], t[1] - h, 13, 6.5, U.shade(color, 1.15));
    ellipseAt(g, t[0], t[1] - h, 10, 5, U.shade(color, 0.6));
  }
  function drawLog(g, dir) {
    var a = ip(0.15, 0.5, 8), b = ip(0.85, 0.5, 8);
    if (dir % 2) { a = ip(0.5, 0.15, 8); b = ip(0.5, 0.85, 8); }
    g.strokeStyle = '#5a3e25'; g.lineWidth = 15; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.strokeStyle = '#6e4d2e'; g.lineWidth = 9; g.beginPath(); g.moveTo(a[0], a[1] - 2); g.lineTo(b[0], b[1] - 2); g.stroke();
    ellipseAt(g, b[0], b[1], 6, 7, '#b08a5a'); g.lineCap = 'butt';
  }
  function drawRock(g, rng) {
    var t = ip(0.5, 0.5, 0);
    ellipseAt(g, t[0], t[1] + 1, 18, 8, 'rgba(0,0,0,0.25)');
    for (var i = 0; i < 4; i++) { ellipseAt(g, t[0] + rng.range(-8, 8), t[1] - rng.range(3, 10), rng.range(8, 13), rng.range(6, 9), ['#7c7a76', '#8b8985', '#6e6c68', '#96948f'][i]); }
  }
  function drawCampfire(g) {
    var t = ip(0.5, 0.5, 0);
    for (var i = 0; i < 8; i++) { var a = i / 8 * Math.PI * 2; ellipseAt(g, t[0] + Math.cos(a) * 14, t[1] + Math.sin(a) * 7, 4, 3, '#77746e'); }
    g.strokeStyle = '#4a321d'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(t[0] - 9, t[1] + 3); g.lineTo(t[0] + 9, t[1] - 3); g.moveTo(t[0] - 9, t[1] - 3); g.lineTo(t[0] + 9, t[1] + 3); g.stroke();
  }
  function drawCrop(g, stage, rng) {
    var t = ip(0.5, 0.5, 0);
    var hgt = [3, 7, 12, 18, 22, 18][Math.min(5, stage)];
    var col = stage >= 5 ? '#8a7a3a' : (stage >= 4 ? '#5a8a3a' : '#6aa03e');
    for (var i = 0; i < 6; i++) {
      var x = t[0] + (i % 3 - 1) * 12 + rng.range(-2, 2), y = t[1] + (i < 3 ? -4 : 4);
      g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - hgt); g.stroke();
      ellipseAt(g, x - 3, y - hgt * 0.7, 3, 1.5, col); ellipseAt(g, x + 3, y - hgt * 0.5, 3, 1.5, col);
      if (stage === 4) { ellipseAt(g, x, y - hgt, 2.5, 2.5, '#d84a2a'); }
    }
  }
  /* carro: dir bit0 = orientação (0 = horizontal no eixo x), bit1 = parte (0 = traseira, 1 = frente), bits 2+ = cor */
  function drawCar(g, odir, rng) {
    var horiz = (odir & 1) === 0, front = (odir & 2) !== 0;
    var color = CAR_COLORS[(odir >> 2) % CAR_COLORS.length];
    // a carroceria inteira é desenhada a partir da parte "frente" (tile de maior x/y) cobrindo os 2 tiles
    if (!front) { return; }
    // coordenadas locais: u ao longo do carro (-0.92..0.92), v na largura (0.12..0.88); o capô fica em +u
    function P(u, v, h) { return horiz ? ip(u, v, h) : ip(v, u, h); }
    function q(a, b, c, d, fill, stroke) { poly(g, [a, b, c, d], fill, stroke, 1); }
    var u0 = -0.92, u1 = 0.92, v0 = 0.12, v1 = 0.88;
    var sh = function (k) { return U.shade(color, k); };
    var t0 = P(0, 0.5, 0);
    ellipseAt(g, t0[0], t0[1] + 2, 60, 26, 'rgba(0,0,0,0.22)'); ellipseAt(g, t0[0], t0[1] + 2, 44, 18, 'rgba(0,0,0,0.18)');
    // rodas (lado visível)
    [u0 + 0.33, u1 - 0.36].forEach(function (u, i) {
      var w = P(u, v1 + 0.005, 6);
      var flat = i === 0 && rng.chance(0.3);
      ellipseAt(g, w[0], w[1] + (flat ? 1.5 : 0), 7, flat ? 5 : 7, '#141414');
      ellipseAt(g, w[0], w[1] + (flat ? 1.5 : 0), 3, flat ? 2 : 3, '#6a6a68');
    });
    // parte de baixo (lataria)
    q(P(u0, v1, 4), P(u1, v1, 4), P(u1, v1, 15), P(u0, v1, 15), sh(0.72), 'rgba(0,0,0,0.4)');
    q(P(u1, v0, 4), P(u1, v1, 4), P(u1, v1, 15), P(u1, v0, 15), sh(0.88), 'rgba(0,0,0,0.4)');
    // para-choque e faróis
    q(P(u1 + 0.01, v0 + 0.02, 4), P(u1 + 0.01, v1 - 0.02, 4), P(u1 + 0.01, v1 - 0.02, 7), P(u1 + 0.01, v0 + 0.02, 7), '#3a3a3a');
    [v0 + 0.1, v1 - 0.18].forEach(function (v) { q(P(u1 + 0.01, v, 10), P(u1 + 0.01, v + 0.08, 10), P(u1 + 0.01, v + 0.08, 13), P(u1 + 0.01, v, 13), '#d8d2b0'); });
    // capô e porta-malas (topo)
    q(P(u0, v0, 15), P(u1, v0, 15), P(u1, v1, 15), P(u0, v1, 15), sh(1.02));
    q(P(u0 + 0.02, v0 + 0.03, 17), P(u1 - 0.02, v0 + 0.03, 17), P(u1 - 0.02, v1 - 0.03, 17), P(u0 + 0.02, v1 - 0.03, 17), sh(1.1), 'rgba(0,0,0,0.25)');
    q(P(u0 + 0.02, v1 - 0.03, 15), P(u1 - 0.02, v1 - 0.03, 15), P(u1 - 0.02, v1 - 0.03, 17), P(u0 + 0.02, v1 - 0.03, 17), sh(0.85));
    q(P(u1 - 0.02, v0 + 0.03, 15), P(u1 - 0.02, v1 - 0.03, 15), P(u1 - 0.02, v1 - 0.03, 17), P(u1 - 0.02, v0 + 0.03, 17), sh(0.95));
    // linha das portas
    var dl0 = P(-0.05, v1, 5), dl1 = P(-0.05, v1, 15);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(dl0[0], dl0[1]); g.lineTo(dl1[0], dl1[1]); g.stroke();
    // cabine com vidros inclinados
    var ua = -0.5, ub = 0.38, vb0 = v0 + 0.06, vb1 = v1 - 0.06, vt0 = v0 + 0.11, vt1 = v1 - 0.11, H0 = 17, H1 = 30, ra = 0.2, rb = 0.16;
    var glass = '#5d7584', broken = rng.chance(0.35);
    q(P(ua, vb0, H0), P(ua, vb1, H0), P(ua + ra, vt1, H1), P(ua + ra, vt0, H1), U.shade(glass, 0.7));
    q(P(ua + ra, vt0, H1), P(ub - rb, vt0, H1), P(ub - rb, vt1, H1), P(ua + ra, vt1, H1), sh(1.05), 'rgba(0,0,0,0.3)');
    q(P(ua, vb1, H0), P(ub, vb1, H0), P(ub - rb, vt1, H1), P(ua + ra, vt1, H1), U.shade(glass, 0.78), 'rgba(0,0,0,0.35)');
    var pm0 = P((ua + ub) / 2 - 0.02, vb1, H0), pm1 = P((ua + ub) / 2 - 0.02 - 0.0, vt1, H1);
    g.strokeStyle = sh(0.7); g.lineWidth = 2.5; g.beginPath(); g.moveTo(pm0[0], pm0[1]); g.lineTo(pm1[0], pm1[1]); g.stroke();
    q(P(ub, vb0, H0), P(ub, vb1, H0), P(ub - rb, vt1, H1), P(ub - rb, vt0, H1), U.shade(glass, 0.95), 'rgba(0,0,0,0.35)');
    // reflexo no para-brisa
    var r0 = P(ub - 0.04, vb0 + 0.15, H0 + 3), r1 = P(ub - rb + 0.03, vt0 + 0.3, H1 - 2);
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(r0[0], r0[1]); g.lineTo(r1[0], r1[1]); g.stroke();
    if (broken) { // para-brisa trincado
      var bc = P(ub - 0.07, (vb0 + vb1) / 2, (H0 + H1) / 2);
      g.strokeStyle = 'rgba(220,230,235,0.7)'; g.lineWidth = 0.8; g.beginPath();
      for (var k = 0; k < 7; k++) { var an = k / 7 * Math.PI * 2; g.moveTo(bc[0], bc[1]); g.lineTo(bc[0] + Math.cos(an) * rng.range(4, 9), bc[1] + Math.sin(an) * rng.range(3, 7)); }
      g.stroke();
    }
    // sujeira, ferrugem e folhas no capô
    for (var i = 0; i < 7; i++) {
      var dp = P(rng.range(u0 + 0.1, u1 - 0.1), rng.range(v0 + 0.08, v1 - 0.08), 17);
      g.fillStyle = rng.chance(0.5) ? 'rgba(90,60,30,0.3)' : 'rgba(60,50,40,0.22)';
      g.beginPath(); g.ellipse(dp[0], dp[1], rng.range(2, 5), rng.range(1, 2.5), 0, 0, Math.PI * 2); g.fill();
    }
    var rs = P(rng.range(u0 + 0.2, u1 - 0.2), v1, rng.range(6, 12));
    g.fillStyle = 'rgba(110,60,30,0.45)'; g.beginPath(); g.ellipse(rs[0], rs[1], rng.range(3, 6), 2, 0, 0, Math.PI * 2); g.fill();
  }

  /* ---------- Escada ---------- */
  S.stairs = function (part, dir) {
    var key = 'st' + part + '_' + dir;
    var s = S.cache[key];
    if (s) { return s; }
    var maxH = WH + 30;
    var c = mk(TW + 40, TH + maxH + 10), g = c.getContext('2d');
    var ax = (TW + 40) / 2, ay = maxH + 4;
    g.translate(ax, ay);
    // 4 degraus por tile, sobe para o norte (dir 0) ou oeste (dir 1)
    var steps = 4;
    for (var k = 0; k < steps; k++) {
      var idx = (2 - part) * steps + k; // 0 = mais baixo (base)
      var hTop = (WH / 12) * (12 - idx);
      var frac0 = k / steps, frac1 = (k + 1) / steps;
      // posição: degrau k ocupa a faixa do tile; dir 0: y de 1-frac1 a 1-frac0 (degraus mais altos ao norte)
      if (dir === 0) {
        var yA = 1 - frac1, yB = 1 - frac0;
        hTop = (WH / 12) * (part * 4 + k + 1);
        box(g, 0.1, yA, 0.8, yB - yA, 0, hTop, '#8a6a48', { southF: 0.7 });
      } else {
        var xA = 1 - frac1, xB = 1 - frac0;
        hTop = (WH / 12) * (part * 4 + k + 1);
        box(g, xA, 0.1, xB - xA, 0.8, 0, hTop, '#8a6a48', { eastF: 0.85 });
      }
    }
    return store(key, c, ax, ay);
  };

  /* item no chão (saquinho/pilha genérica) */
  S.groundItems = function (n) {
    var key = 'gi' + Math.min(n, 3);
    var s = S.cache[key];
    if (s) { return s; }
    var c = mk(TW, TH + 20), g = c.getContext('2d');
    g.translate(HW, 14);
    var t = ip(0.5, 0.5, 0);
    ellipseAt(g, t[0], t[1] + 1, 10, 4, 'rgba(0,0,0,0.3)');
    var cols = ['#c9a25a', '#7a8fa0', '#9a5a4a'];
    for (var i = 0; i < Math.min(n, 3); i++) { box(g, 0.38 + i * 0.06, 0.38 - i * 0.04, 0.2, 0.2, 0, 6 + i * 2, cols[i]); }
    return store(key, c, HW, 14);
  };

  /* ================= PERSONAGENS (desenho vetorial por quadro) ================= */
  /* look (montado por S.buildLook): { skin, hair, hairStyle, beard, female, zombie, seed, blood:[[lado,altura,tam]...], bag,
   *   shirt, sleeve ('long'|'short'|'none'), sleeveCol, jacket, jacketType, vest, pants, legs ('long'|'shorts'|'skirt'|'dress'),
   *   shoes, gloves, hat, hatType, scarf }
   * pose: { ang (radianos, mundo), phase (0..1 ciclo de passos), moving, run, crouch, attack (0..1), shove (0..1), weapon, aim,
   *   down, dead, crawl, lunge, reach }
   * lightF: multiplicador de cor (luz do lugar) */
  var OUT = 'rgba(14,11,9,0.4)';
  var TAU = Math.PI * 2;
  var SHT = {};
  /* cor sombreada com cache por cor e nível de luz quantizado (não cria strings por quadro) */
  function shq(hex, f) {
    var q = (f * 40 + 0.5) | 0;
    if (q < 0) { q = 0; } else if (q > 70) { q = 70; }
    var t = SHT[hex];
    if (!t) { t = SHT[hex] = []; }
    return t[q] || (t[q] = U.shade(S.gradeHex(hex), q / 40));
  }
  S.shadeQ = shq;
  function iso(dx, dy) { return [HW * (dx - dy), HH * (dx + dy)]; }
  function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  /* cápsula afunilada de a (raio ra) até b (raio rb): só monta o caminho */
  function capsule(g, a, b, ra, rb) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy);
    g.beginPath();
    if (L < 0.05) { g.arc(a[0], a[1], Math.max(ra, rb), 0, TAU); return; }
    var nx = -dy / L, ny = dx / L, an = Math.atan2(ny, nx);
    g.moveTo(a[0] + nx * ra, a[1] + ny * ra);
    g.lineTo(b[0] + nx * rb, b[1] + ny * rb);
    g.arc(b[0], b[1], rb, an, an - Math.PI, true);
    g.lineTo(a[0] - nx * ra, a[1] - ny * ra);
    g.arc(a[0], a[1], ra, an + Math.PI, an, true);
    g.closePath();
  }
  function limb(g, a, b, ra, rb, c) {
    capsule(g, a, b, ra, rb);
    g.fillStyle = c; g.fill();
    g.strokeStyle = OUT; g.lineWidth = 1; g.stroke();
    // volume: faixa clara do lado da luz (alto à esquerda) e escura do outro
    if (ra > 1.4) {
      capsule(g, [a[0] - ra * 0.35, a[1] - ra * 0.2], [b[0] - rb * 0.35, b[1] - rb * 0.2], ra * 0.45, rb * 0.45);
      g.fillStyle = 'rgba(255,250,235,0.13)'; g.fill();
      capsule(g, [a[0] + ra * 0.45, a[1] + ra * 0.2], [b[0] + rb * 0.45, b[1] + rb * 0.2], ra * 0.4, rb * 0.4);
      g.fillStyle = 'rgba(0,0,10,0.16)'; g.fill();
    }
  }
  function blob(g, x, y, rx, ry, c, outline) {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fillStyle = c; g.fill();
    if (outline) { g.strokeStyle = OUT; g.lineWidth = 1; g.stroke(); }
  }

  /* ---------- aparência a partir das roupas ---------- */
  var SLEEVE_OF = { tshirt: 'short', tanktop: 'none', dress: 'none' };
  var LEGS_OF = { shorts: 'shorts', skirt: 'skirt' };
  var UNDER = '#d9cfc2';
  /* base: { skin, hair, hairStyle, beard, female, zombie, seed, blood, bag }; items: [{ id, color }] (nulos são ignorados) */
  S.buildLook = function (base, items) {
    var l = {
      skin: base.skin, hair: base.hair, hairStyle: base.hairStyle || 'curto', beard: !!base.beard && !base.female,
      female: !!base.female, zombie: !!base.zombie, seed: base.seed || 0, blood: base.blood || null, bag: base.bag || null,
      shirt: null, sleeve: 'none', sleeveCol: null, jacket: null, jacketType: null, vest: null,
      pants: null, legs: 'long', shoes: null, gloves: null, hat: null, hatType: null, scarf: null
    };
    for (var i = 0; i < items.length; i++) {
      var o = items[i];
      if (!o) { continue; }
      var it = CP.D.ITEMS[o.id];
      if (!it || !it.cloth) { continue; }
      var c = o.color || '#666666', s = it.cloth.slot;
      if (s === 'shirt') {
        l.shirt = c; l.sleeve = SLEEVE_OF[o.id] || 'long';
        if (o.id === 'dress') { l.legs = 'dress'; l.pants = c; }
      } else if (s === 'jacket') { l.jacket = c; l.jacketType = o.id; } else if (s === 'vest') { l.vest = c; } else if (s === 'pants') {
        if (l.legs !== 'dress') { l.pants = c; l.legs = LEGS_OF[o.id] || 'long'; }
      } else if (s === 'shoes') { l.shoes = c; } else if (s === 'gloves') { l.gloves = c; } else if (s === 'hat') { l.hat = c; l.hatType = o.id; } else if (s === 'neck') { l.scarf = c; }
    }
    if (l.legs === 'dress' && !l.pants) { l.legs = 'long'; }
    l.sleeveCol = l.shirt;
    if (l.jacket) {
      if (l.jacketType === 'scrubs') { if (l.sleeve !== 'long') { l.sleeve = 'short'; l.sleeveCol = l.jacket; } } else { l.sleeve = 'long'; l.sleeveCol = l.jacket; }
    }
    if (!l.pants) { l.pants = UNDER; l.legs = 'shorts'; l.under = true; }
    return l;
  };

  /* ---------- pessoa em pé ---------- */
  S.drawHuman = function (g, sx, sy, look, pose, lightF, alpha) {
    var lf = lightF;
    function col(c) { return shq(c, lf); }
    function dk(c, k) { return shq(c, lf * k); }
    g.save();
    if (alpha !== undefined && alpha < 1) { g.globalAlpha = alpha; }
    var ang = pose.ang;
    var fx = Math.cos(ang), fy = Math.sin(ang);
    var rx = -fy, ry = fx; // direita (no mundo)
    // sombra de contato (difusa + núcleo)
    var sa = Math.min(1, lf + 0.25);
    g.fillStyle = 'rgba(0,0,0,' + (0.16 * sa).toFixed(2) + ')';
    g.beginPath(); g.ellipse(sx, sy, 15, 7.5, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,' + (0.22 * sa).toFixed(2) + ')';
    g.beginPath(); g.ellipse(sx, sy, 8.5, 4.2, 0, 0, TAU); g.fill();
    if (pose.down || pose.dead || pose.crawl) {
      drawLying(g, sx, sy, look, pose, lf, fx, fy, rx, ry);
      g.restore();
      return;
    }
    var Zb = !!look.zombie, F = !!look.female, seed = look.seed || 0;
    var skin = look.skin;
    var sleeve = look.sleeve || 'long', legsT = look.legs || 'long';
    var shirt = look.shirt || skin, outer = look.jacket || shirt;
    var sleeveCol = look.sleeveCol || outer;
    var H = (F ? 52 : 56) * (pose.crouch ? 0.8 : 1);
    var ph = pose.phase * TAU;
    var mv = pose.moving ? 1 : 0;
    var amp = pose.run ? 0.36 : (Zb ? 0.2 : 0.25);
    var limpSide = Zb ? ((seed & 1) ? 1 : -1) : 0;
    var swing = mv * Math.sin(ph) * amp;
    var bob = mv * Math.abs(Math.sin(ph)) * (pose.run ? 2.4 : 1.2);
    if (Zb && mv) { bob = Math.max(0, Math.sin(ph) * limpSide) * 2.4; }
    var lean = (pose.crouch ? 0.1 : 0) + (pose.run ? 0.08 : 0) + (Zb ? 0.11 : 0) + (pose.lunge ? 0.08 : 0);
    var swayX = Zb ? Math.sin(ph * 0.5 + seed) * 1.6 : 0;
    var legH = H * 0.49, hipH = H * 0.53, waistH = H * 0.63, chestH = H * 0.72, shH = H * 0.8;
    var headH = H * 0.905 - (Zb ? 2.5 : 0);
    function leanAt(h) { return h <= legH ? lean * 0.15 : lean * (0.15 + 0.85 * (h - legH) / (shH - legH)); }
    function P(fwd, side, h) {
      var a = fx * fwd + rx * side, b = fy * fwd + ry * side;
      var k = h >= legH ? 1 : h / legH;
      return [sx + HW * (a - b) + swayX * k, sy + HH * (a + b) - h - bob * k];
    }
    var bulk = look.jacket ? 0.012 : 0;
    var shW = (F ? 0.15 : 0.185) + bulk, chW = (F ? 0.135 : 0.165) + bulk, waW = (F ? 0.1 : 0.135) + bulk, hipW = (F ? 0.15 : 0.128) + bulk * 0.5;
    var legSp = F ? 0.068 : 0.072;
    var dHip = 0.092, dWa = 0.086, dCh = (F ? 0.118 : 0.102) + bulk, dSh = 0.08;
    var A1 = rx - ry, B1 = fx - fy, A2 = rx + ry, B2 = fx + fy;
    var frontNear = B2 > 0;          // peito virado para a câmera
    var nearSide = A2 > 0 ? 1 : -1;  // lado (direito=1) mais perto da câmera
    var shDrop = Zb ? ((seed >> 2) & 1 ? 1 : -1) : 0;
    /* contorno projetado do tronco numa altura: [cx, cy, hx, hy] */
    function ext(h, w, d) {
      var c = P(leanAt(h), 0, h);
      var a = A1 * w, b = B1 * d, n = Math.sqrt(a * a + b * b) || 0.0001;
      return [c[0], c[1], HW * n, HH * (A2 * w * a + B2 * d * b) / n];
    }
    /* tronco liso: níveis de baixo para cima; top = arredondamento dos ombros; bot = curva da barra; jag = barra rasgada */
    function shell(lv, top, bot, jag) {
      var n = lv.length, i, e = lv[0], a, b;
      g.beginPath();
      g.moveTo(e[0] - e[2], e[1] - e[3]);
      for (i = 1; i < n - 1; i++) {
        a = lv[i]; b = lv[i + 1];
        g.quadraticCurveTo(a[0] - a[2], a[1] - a[3], ((a[0] - a[2]) + (b[0] - b[2])) / 2, ((a[1] - a[3]) + (b[1] - b[3])) / 2);
      }
      e = lv[n - 1];
      g.lineTo(e[0] - e[2], e[1] - e[3]);
      g.bezierCurveTo(e[0] - e[2], e[1] - e[3] - top, e[0] + e[2], e[1] + e[3] - top, e[0] + e[2], e[1] + e[3]);
      for (i = n - 2; i > 0; i--) {
        a = lv[i]; b = lv[i - 1];
        g.quadraticCurveTo(a[0] + a[2], a[1] + a[3], ((a[0] + a[2]) + (b[0] + b[2])) / 2, ((a[1] + a[3]) + (b[1] + b[3])) / 2);
      }
      e = lv[0];
      g.lineTo(e[0] + e[2], e[1] + e[3]);
      if (jag) {
        var steps = 5;
        for (i = 1; i <= steps; i++) {
          var t = i / steps, x = e[0] + e[2] - 2 * e[2] * t, y = e[1] + e[3] - 2 * e[3] * t + Math.sin(t * Math.PI) * bot;
          g.lineTo(x, y + ((i + seed) % 2 ? 2.2 : -0.6));
        }
      } else {
        g.bezierCurveTo(e[0] + e[2], e[1] + e[3] + bot, e[0] - e[2], e[1] - e[3] + bot, e[0] - e[2], e[1] - e[3]);
      }
      g.closePath();
    }
    function shellFill(c, lv) {
      var top = lv[lv.length - 1], gr = g.createLinearGradient(top[0] - top[2] - 1, 0, top[0] + top[2] + 1, 0);
      gr.addColorStop(0, shq(c, lf * 1.12)); gr.addColorStop(0.45, col(c)); gr.addColorStop(1, shq(c, lf * 0.66));
      g.fillStyle = gr; g.fill();
      g.strokeStyle = OUT; g.lineWidth = 1; g.stroke();
    }
    function frontPt(h, d, side) { return P(leanAt(h) + (frontNear ? d : -d) * 0.95, side || 0, h); }

    /* ----- pernas ----- */
    function drawLeg(side, sgn) {
      var sw = swing * sgn, lift = mv * Math.max(0, Math.cos(ph) * sgn) * (pose.run ? 5 : 3);
      if (Zb && side === limpSide) { sw *= 0.45; lift *= 0.3; }
      var kneeF = (pose.crouch ? 0.15 : 0.04) + lift * 0.012;
      var hip = P(leanAt(legH), side * legSp, legH);
      var knee = P(sw * 0.2 + kneeF, side * legSp * 1.04, legH * 0.5 + lift * 0.4);
      var ankle = P(sw * 0.36, side * legSp * 1.08, lift + 2);
      var far = side !== nearSide;
      var kk = far ? 0.8 : 1;
      var bare = legsT === 'skirt' || legsT === 'dress' || legsT === 'shorts';
      var thighC = legsT === 'long' ? dk(look.pants, kk) : dk(skin, kk);
      var calfC = legsT === 'long' ? dk(look.pants, kk) : dk(skin, kk);
      limb(g, knee, ankle, F ? 2.3 : 2.5, F ? 1.6 : 1.8, calfC);
      limb(g, hip, knee, F ? 3.5 : 3.3, F ? 2.4 : 2.6, thighC);
      if (legsT === 'shorts') { limb(g, hip, lerp2(hip, knee, 0.7), (F ? 3.9 : 3.7), 3.1, dk(look.pants, kk)); }
      if (bare && Zb) { g.fillStyle = 'rgba(60,30,40,0.35)'; g.beginPath(); g.arc((knee[0] + ankle[0]) / 2, (knee[1] + ankle[1]) / 2, 1.2, 0, TAU); g.fill(); }
      var heel = P(sw * 0.36 - 0.035, side * legSp * 1.08, lift + 1.3), toe = P(sw * 0.36 + 0.095, side * legSp * 1.1, lift + 0.9);
      limb(g, heel, toe, F ? 1.6 : 1.9, F ? 1.5 : 1.9, look.shoes ? dk(look.shoes, kk) : dk(skin, kk * 0.92));
    }
    function legs() {
      var dL = HH * (A2 * -legSp) + HH * (B2 * swing * 0.36), dR = HH * (A2 * legSp) - HH * (B2 * swing * 0.36);
      if (dL < dR) { drawLeg(-1, 1); drawLeg(1, -1); } else { drawLeg(1, -1); drawLeg(-1, 1); }
    }

    /* ----- braços ----- */
    var armPos = {};
    function armJoints(side) {
      var wh = side === 1, sw = side === 1 ? swing : -swing;
      var L = leanAt(shH);
      var sh = P(L, side * shW * 0.9, shH - 2.4 - (side === shDrop ? 2 : 0));
      var hand, elbow;
      if (Zb && (pose.reach || pose.attack)) {
        var ext2 = pose.attack ? 0.12 * Math.sin(pose.attack * Math.PI) : 0;
        hand = P(L + 0.42 + ext2, side * 0.1, shH - 3 + Math.sin(ph + side) * 2);
        elbow = P(L + 0.22 + ext2 * 0.5, side * 0.15, shH - 3.5);
      } else if (Zb) {
        var dang = Math.sin(ph * 0.5 + side) * 0.03;
        hand = P(leanAt(hipH) + 0.14 + dang - sw * 0.1, side * (shW - 0.01), hipH + 1 - (side === shDrop ? 2 : 0));
        elbow = P(leanAt(waistH) + 0.07, side * (shW + 0.015), waistH + 1);
      } else if (pose.attack && wh) {
        var a = pose.attack;
        var t = a < 0.45 ? a / 0.45 : 1 - (a - 0.45) / 0.55 * 0.6;
        var fw = -0.15 + t * 0.55, hh = shH + 10 - t * 18;
        hand = P(fw + L, side * (0.18 - t * 0.12), hh);
        elbow = P((fw + L) * 0.5, side * 0.2, shH - 2);
      } else if (pose.shove) {
        var tt = Math.sin(pose.shove * Math.PI);
        hand = P(0.18 + tt * 0.3 + L, side * 0.12, shH - 6);
        elbow = P(0.1 + tt * 0.15 + L, side * 0.18, shH - 8);
      } else if (pose.aim && wh) {
        hand = P(0.38 + L, 0.04, shH - 4);
        elbow = P(0.18 + L, side * 0.16, shH - 6);
      } else if (pose.aim && pose.weapon && (pose.weapon === 'rifle' || pose.weapon === 'shotgun')) {
        hand = P(0.3 + L, -0.02, shH - 5);
        elbow = P(0.14 + L, side * 0.15, shH - 7);
      } else if (pose.run) {
        hand = P(-sw * 0.5 + L * 0.6 + 0.08, side * shW * 0.95, waistH + 1);
        elbow = P(-sw * 0.25 + L * 0.6 - 0.07, side * (shW + 0.03), waistH + 2);
      } else {
        hand = P(-sw * 0.3 + leanAt(hipH) + 0.02, side * (shW + 0.02), hipH - 1);
        elbow = P(-sw * 0.14 + leanAt(waistH) - 0.02, side * (shW + 0.03), waistH + 1);
      }
      armPos[side] = [sh, elbow, hand];
    }
    function drawArm(side) {
      var j = armPos[side], sh = j[0], el = j[1], hd = j[2];
      var far = side !== nearSide, kk = far ? 0.8 : 1;
      var sk = dk(skin, kk);
      var sc = sleeve === 'none' ? sk : dk(sleeveCol, kk);
      var fc = sleeve === 'long' ? sc : sk;
      limb(g, el, hd, 2.05, F ? 1.5 : 1.7, fc);
      limb(g, sh, el, F ? 2.3 : 2.6, 2.1, sleeve === 'short' ? sk : sc);
      if (sleeve === 'short') { limb(g, sh, lerp2(sh, el, 0.62), F ? 2.7 : 3, 2.5, sc); }
      if (sleeve === 'long' && Zb && ((seed >> (3 + side)) & 1)) { // manga rasgada
        var m = lerp2(el, hd, 0.5);
        blob(g, m[0], m[1], 1.4, 1.1, sk, false);
      }
      if (Zb && sleeve !== 'long') { var m2 = lerp2(el, hd, 0.4); g.fillStyle = 'rgba(70,35,50,0.4)'; g.beginPath(); g.arc(m2[0], m2[1], 1.3, 0, TAU); g.fill(); }
      blob(g, hd[0], hd[1], F ? 1.6 : 1.9, F ? 1.6 : 1.9, look.gloves ? dk(look.gloves, kk) : sk, true);
      if (side === 1 && pose.weapon && !Zb) { drawWeapon(g, hd, pose, fx, fy, lf); }
    }

    /* ----- quadril, saia, tronco ----- */
    function pelvis() {
      var pc = legsT === 'dress' ? look.pants : (legsT === 'skirt' ? look.pants : look.pants);
      var lv = [ext(legH - 2.5, hipW * 0.92, dHip), ext(hipH, hipW, dHip), ext(waistH - 1, waW, dWa)];
      shell(lv, 0, 2.5, false);
      shellFill(pc, lv);
    }
    function skirt() {
      var kneeH = legsT === 'skirt' ? H * 0.3 : H * 0.26, c = look.pants, top = waistH - 1;
      if (legsT !== 'skirt' && legsT !== 'dress') {
        if (look.jacketType !== 'coat') { return; }
        kneeH = H * 0.28; c = look.jacket; top = hipH + 1;
      }
      var lv = [ext(kneeH, hipW * 1.42, dHip * 1.5), ext(legH, hipW * 1.12, dHip * 1.1), ext(top, waW * 1.02, dWa)];
      shell(lv, 0, 2.5, Zb);
      shellFill(c, lv);
    }
    function torso() {
      var topW = sleeve === 'none' ? shW * 0.82 : shW * 0.97;
      var lv = [ext(hipH - 1, hipW * 0.99 + 0.004, dHip + 0.004), ext(waistH, waW, dWa), ext(chestH, chW, dCh), ext(shH, topW, dSh)];
      // pescoço por trás da gola
      var nk0 = P(leanAt(shH), 0, shH - 3), nk1 = P(leanAt(shH) + 0.035 + (Zb ? 0.05 : 0), (Zb ? (((seed >> 1) % 3) - 1) * 0.03 : 0), headH - 3.5);
      limb(g, nk0, nk1, F ? 1.6 : 1.9, F ? 1.5 : 1.8, dk(skin, 0.92));
      var bare = !look.shirt && !look.jacket;
      shell(lv, 3.2, 2.2, Zb && !bare);
      shellFill(outer, lv);
      var vis = Math.abs(B2) > 0.15;
      // sutiã em quem está sem camisa (feminino)
      if (bare && F && frontNear) {
        var b1 = frontPt(chestH, dCh, -chW * 0.55), b2 = frontPt(chestH, dCh, chW * 0.55);
        limb(g, b1, b2, 1.8, 1.8, col(UNDER));
      }
      // detalhes frontais
      if (vis && frontNear) {
        var neckF = frontPt(shH + 1.4, dSh * 0.55);
        if (look.jacket && look.jacketType !== 'scrubs' && look.jacketType !== 'hoodie') {
          // jaqueta aberta: camisa aparecendo
          var a = frontPt(shH - 2, dSh), b = frontPt(hipH + 1, dHip);
          capsule(g, a, b, 1.1, 0.9); g.fillStyle = dk(shirt, 0.85); g.fill();
          g.strokeStyle = dk(look.jacket, 0.6); g.lineWidth = 0.8; g.stroke();
          // gola
          var cl = frontPt(shH - 1, dSh, -0.07), cr = frontPt(shH - 1, dSh, 0.07);
          g.fillStyle = dk(look.jacket, 0.78);
          g.beginPath(); g.moveTo(cl[0], cl[1] - 1.5); g.lineTo(neckF[0], neckF[1] + 3); g.lineTo(cr[0], cr[1] - 1.5); g.closePath(); g.fill();
        } else if (look.jacketType === 'hoodie') {
          var z0 = frontPt(shH - 2, dSh), z1 = frontPt(hipH + 1, dHip);
          g.strokeStyle = dk(look.jacket, 0.62); g.lineWidth = 0.8; g.beginPath(); g.moveTo(z0[0], z0[1]); g.lineTo(z1[0], z1[1]); g.stroke();
          var pk = frontPt(waistH - 2, dWa);
          g.fillStyle = dk(look.jacket, 0.82); g.fillRect(pk[0] - 3, pk[1] - 1.5, 6, 3);
          // cordões
          g.strokeStyle = col('#e8e2d6'); g.beginPath(); g.moveTo(neckF[0] - 1, neckF[1]); g.lineTo(neckF[0] - 1, neckF[1] + 3); g.moveTo(neckF[0] + 1, neckF[1]); g.lineTo(neckF[0] + 1, neckF[1] + 3); g.stroke();
        } else if (!bare) {
          // decote da camiseta / camisa
          blob(g, neckF[0], neckF[1] + 0.3, 1.7, 1.0, dk(skin, 0.9), false);
          if (look.shirt && sleeve === 'long' && !look.jacket) {
            var bt0 = frontPt(shH - 3, dSh), bt1 = frontPt(hipH + 1, dHip);
            g.fillStyle = dk(shirt, 0.6);
            for (var k = 1; k < 4; k++) { var bp = lerp2(bt0, bt1, k / 4); g.fillRect(bp[0] - 0.5, bp[1] - 0.5, 1, 1); }
          }
        }
        if (F && !bare) { // volume do busto
          var u0 = frontPt(chestH - 2, dCh, -chW * 0.75), u1 = frontPt(chestH - 2, dCh, chW * 0.75), um = frontPt(chestH - 3.5, dCh, 0);
          g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(u0[0], u0[1]); g.quadraticCurveTo(um[0], um[1] + 3, u1[0], u1[1]); g.stroke();
        }
      }
      if (look.vest) {
        var lv2 = [ext(hipH + 2, hipW + 0.012, dHip + 0.012), ext(waistH, waW + 0.018, dWa + 0.015), ext(chestH, chW + 0.016, dCh + 0.014), ext(shH - 1.5, shW * 0.7, dSh + 0.012)];
        shell(lv2, 1.5, 1, false); shellFill(look.vest, lv2);
      }
      // cinto (quando a camisa não cobre o quadril)
      if ((legsT === 'long' || legsT === 'shorts') && !look.under && vis && !look.jacket && sleeve === 'none') {
        var e0 = ext(hipH - 0.5, hipW, dHip);
        g.strokeStyle = col('#2a1f16'); g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(e0[0] - e0[2], e0[1] - e0[3]); g.lineTo(e0[0] + e0[2], e0[1] + e0[3]); g.stroke();
      }
      // zumbi: rasgos com pele aparecendo
      if (Zb && !bare) {
        for (var r = 0; r < 2; r++) {
          var hs = ((seed >> (r * 3)) & 7) / 7, ss = (((seed >> (r * 3 + 9)) & 7) / 7 - 0.5) * 1.4;
          var hp = hipH + 3 + hs * (chestH - hipH - 3);
          var tp = frontPt(hp, dWa, ss * waW);
          blob(g, tp[0], tp[1], 1.8, 1.2, col(skin), false);
          g.strokeStyle = 'rgba(40,20,20,0.5)'; g.lineWidth = 0.7; g.stroke();
        }
      }
      // sangue (visto de frente ou de costas)
      var bl = look.blood;
      if (bl) {
        for (var i = 0; i < bl.length; i++) {
          var bh = hipH + bl[i][1] * (shH - hipH - 2), bsd = bl[i][0] * waW * 0.9;
          var bp2 = frontPt(bh, dWa, bsd);
          var rr = bl[i][2] * 0.9;
          // respingos pontilhados (não uma bola)
          for (var bd = 0; bd < 9; bd++) {
            var ba = (bd * 2.39 + i) % TAU, brr = rr * ((bd * 37 + i * 11) % 10) / 10;
            g.fillStyle = col(bd % 3 ? '#6a1010' : '#8a1a14');
            g.fillRect(bp2[0] + Math.cos(ba) * brr - 0.5, bp2[1] + Math.sin(ba) * brr * 0.8 - 0.5, bd < 3 ? 1.6 : 1, bd < 3 ? 1.6 : 1);
          }
          if (Zb) { g.fillStyle = col('#5e0f0f'); g.fillRect(bp2[0] - 0.4, bp2[1], 0.9, rr + 2.5); }
        }
      }
      if (look.scarf) {
        var sc0 = ext(shH, shW * 0.5, dSh * 1.2);
        blob(g, sc0[0], sc0[1] - 1.5, Math.max(2.4, sc0[2]), 2, col(look.scarf), true);
        if (frontNear) { var st = frontPt(shH - 6, dSh); limb(g, [sc0[0], sc0[1]], st, 1.3, 1.1, dk(look.scarf, 0.85)); }
      }
      if (look.jacketType === 'hoodie') { var hd = P(leanAt(shH) - 0.07, 0, shH + 0.5); blob(g, hd[0], hd[1], 3.6, 2.4, dk(look.jacket, 0.85), true); }
    }

    /* ----- cabeça ----- */
    var fsx = B1, fsy = B2 * 0.5;
    var fl = Math.sqrt(fsx * fsx + fsy * fsy) || 1; fsx /= fl; fsy /= fl;
    var hSide = Zb ? (((seed >> 1) % 3) - 1) * 0.04 : 0;
    var headF = leanAt(shH) + 0.035 + (Zb ? 0.07 : 0);
    var HC = P(headF, hSide, headH);
    var rX = F ? 3.8 : 4.1, rY = F ? 4.5 : 4.8;
    var hs = look.hairStyle || 'curto';
    var longHair = hs === 'longo' || hs === 'rabo' || (hs === 'médio' && F);
    function hairBack() {
      if (!longHair) { return; }
      var bx = HC[0] - fsx * 1.6, by = HC[1] - fsy * 1.6 - 1;
      var len = hs === 'longo' ? 10 : (hs === 'rabo' ? 8 : 5.5);
      if (hs === 'rabo') {
        limb(g, [bx - fsx * 2, by - 1], [bx - fsx * 3, by + len], 1.7, 1.1, col(look.hair));
      } else {
        limb(g, [bx, by], [bx - fsx * 1.2, by + len], rX * 0.92, rX * 0.7, col(look.hair));
      }
    }
    function head() {
      var x = HC[0], y = HC[1];
      var hair = look.hair, bald = hs === 'careca';
      // volume do cabelo fora do crânio
      if (!bald && hs !== 'raspado') {
        blob(g, x - fsx * 1.0, y - fsy * 1.0 - 1.1, rX + 0.8, rY + 0.4, col(hair), true);
      }
      var gr = g.createRadialGradient(x - 1.4, y - 1.8, 0.4, x, y, rY + 1);
      gr.addColorStop(0, shq(skin, lf * 1.12)); gr.addColorStop(0.55, col(skin)); gr.addColorStop(1, shq(skin, lf * 0.68));
      g.beginPath(); g.ellipse(x, y, rX, rY, 0, 0, TAU);
      g.fillStyle = gr; g.fill();
      g.save();
      g.beginPath(); g.ellipse(x, y, rX + 0.6, rY + 0.6, 0, 0, TAU); g.clip();
      if (Zb) { // manchas na pele
        g.fillStyle = 'rgba(70,40,60,0.32)';
        g.beginPath(); g.ellipse(x + ((seed % 5) - 2), y + ((seed >> 3) % 4) - 1, 1.8, 1.3, 0, 0, TAU); g.fill();
      }
      if (!bald) {
        var off = hs === 'raspado' ? 1.5 : (hs === 'curto' ? 2.0 : 1.5);
        if (hs === 'raspado') { g.globalAlpha *= 0.6; }
        g.fillStyle = col(hair);
        g.beginPath(); g.ellipse(x - fsx * off, y - fsy * off - 1.8, rX + 0.7, rY + (longHair ? 0.4 : 0), 0, 0, TAU); g.fill();
        if (Zb && ((seed >> 5) & 1)) { g.fillStyle = 'rgba(80,18,18,0.55)'; g.beginPath(); g.arc(x + 1.5, y - 3.2, 1.2, 0, TAU); g.fill(); } // ferida no couro
        if (hs === 'raspado') { g.globalAlpha /= 0.6; }
        g.strokeStyle = shq(hair, lf * 1.45); g.globalAlpha *= 0.35; g.lineWidth = 0.8;
        g.beginPath(); g.ellipse(x - 0.8, y - 2.8, rX - 1.6, rY - 2.6, 0, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
        g.globalAlpha /= 0.35;
      }
      g.restore();
      g.strokeStyle = OUT; g.lineWidth = 1;
      g.beginPath();
      if (bald || hs === 'raspado') { g.ellipse(x, y, rX, rY, 0, 0, TAU); } else { g.ellipse(x, y, rX, rY, 0, 0.1, Math.PI - 0.1); }
      g.stroke();
      // rosto (só se está virado para a câmera)
      if (fsy > -0.3) {
        var sxv = A1, syv = A2 * 0.5, sl = Math.sqrt(sxv * sxv + syv * syv) || 1; sxv /= sl; syv /= sl;
        var fcx = x + fsx * rX * 0.42, fcy = y + fsy * 1.3 + 0.4;
        var es = 1.55 * Math.max(0.25, Math.abs(fsy) + 0.1);
        var showL = !(fsx > 0.85), showR = !(fsx < -0.85);
        var e1x = fcx - sxv * es, e1y = fcy - syv * es, e2x = fcx + sxv * es, e2y = fcy + syv * es;
        if (Zb) {
          g.fillStyle = 'rgba(28,10,12,0.78)';
          if (showL) { g.beginPath(); g.ellipse(e1x, e1y, 1.3, 1.0, 0, 0, TAU); g.fill(); }
          if (showR) { g.beginPath(); g.ellipse(e2x, e2y, 1.3, 1.0, 0, 0, TAU); g.fill(); }
          g.fillStyle = shq('#d8d2a4', Math.max(0.6, lf));
          if (showL) { g.fillRect(e1x - 0.4, e1y - 0.4, 0.8, 0.8); }
          if (showR) { g.fillRect(e2x - 0.4, e2y - 0.4, 0.8, 0.8); }
          // boca aberta com sangue
          var mx = fcx + fsx * 0.4, my = fcy + 2.6;
          g.fillStyle = '#2a0607'; g.beginPath(); g.ellipse(mx, my, 1.3, 1.1 + (pose.attack ? 0.5 : 0), 0, 0, TAU); g.fill();
          g.fillStyle = col('#6a1010'); g.fillRect(mx - 0.5, my + 0.8, 1, 2.6); g.fillRect(mx + 0.6, my + 0.6, 0.7, 1.6);
        } else {
          g.fillStyle = shq(hair || '#2a2420', lf * 0.7);
          if (showL) { g.fillRect(e1x - 0.9, e1y - 1.6, 1.8, 0.6); }
          if (showR) { g.fillRect(e2x - 0.9, e2y - 1.6, 1.8, 0.6); }
          g.fillStyle = col('#16110d');
          if (showL) { g.fillRect(e1x - 0.55, e1y - 0.5, 1.1, 1.1); }
          if (showR) { g.fillRect(e2x - 0.55, e2y - 0.5, 1.1, 1.1); }
          g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(fcx + fsx * 0.6 - 0.4, fcy + 0.6, 0.9, 1.1);
          g.fillStyle = F ? col('#9c4f4a') : dk(skin, 0.62);
          g.fillRect(fcx + fsx * 0.4 - 0.9, fcy + 2.4, 1.8, F ? 0.8 : 0.6);
          if (look.beard) {
            g.fillStyle = col(hair);
            g.beginPath(); g.ellipse(fcx + fsx * 0.3, fcy + 2.7, 2.6, 1.8, 0, 0, Math.PI); g.fill();
            g.fillRect(fcx + fsx * 0.4 - 1.2, fcy + 1.6, 2.4, 0.7);
          }
        }
      }
      // chapéus
      if (look.hat) {
        var ht = look.hatType, hc = col(look.hat);
        if (ht === 'helmet') {
          blob(g, x, y - 0.8, rX + 1.6, rY + 1.1, hc, true);
          if (fsy > -0.2) { g.fillStyle = 'rgba(20,24,30,0.85)'; g.beginPath(); g.ellipse(x + fsx * 2.2, y + fsy * 1.4 + 0.3, 2.8, 1.8, 0, 0, TAU); g.fill(); }
          g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(x - 1, y - 2.5, rX - 0.5, rY - 1.5, 0, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
        } else {
          g.beginPath(); g.ellipse(x - fsx * 0.6, y - 1.9, rX + 0.7, rY * 0.82, 0, Math.PI, TAU); g.closePath();
          g.fillStyle = hc; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.stroke();
          if (ht === 'cap') { limb(g, [x + fsx * 1.8, y - 2.4 + fsy * 0.4], [x + fsx * 5.6, y - 2.4 + fsy * 1.3], 1.1, 1.4, dk(look.hat, 0.8)); } else { g.fillStyle = dk(look.hat, 0.8); g.fillRect(x - rX - 0.5, y - 2.6, rX * 2 + 1, 1.6); }
        }
      }
    }

    /* ----- ordem de desenho ----- */
    armJoints(-1); armJoints(1);
    var weaponFront = !Zb && (pose.attack || pose.aim) ? 1 : 0;
    var farSide = -nearSide;
    if (frontNear) { hairBack(); }
    if (look.bag && frontNear) { bag(); }
    if (!(weaponFront && farSide === 1)) { drawArm(farSide); }
    legs();
    pelvis();
    skirt();
    torso();
    if (look.bag && !frontNear) { bag(); }
    if (!frontNear) { hairBack(); }
    drawArm(nearSide);
    head();
    if (weaponFront && farSide === 1) { drawArm(1); }
    g.restore();

    function bag() {
      var L = leanAt(shH);
      var lv = [ext(hipH + 3, 0.12, 0.07), ext(shH - 2, 0.13, 0.08)];
      var off = iso(-fx * 0.13, -fy * 0.13);
      for (var i = 0; i < lv.length; i++) { lv[i][0] += off[0]; lv[i][1] += off[1]; }
      shell(lv, 2, 1.5, false); shellFill(look.bag, lv);
      if (!frontNear) { var fl2 = P(L - 0.2, 0, waistH); g.fillStyle = dk(look.bag, 0.7); g.fillRect(fl2[0] - 3, fl2[1] - 1, 6, 3); }
    }
  };
  function line(g, a, b, w, c) {
    g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  S.line = line;
  var WEAPON_LOOK = {
    blunt_long: { len: 0.55, r0: 1.1, r1: 2.1, c: '#9a7a50' }, blunt_short: { len: 0.32, r0: 1, r1: 1.4, c: '#6a6a6a', head: '#4a4a4a' },
    axe: { len: 0.5, r0: 1, r1: 1, c: '#7a5a3a', axe: '#a3a9ae' }, blade_long: { len: 0.6, r0: 0.9, r1: 0.4, c: '#cfd3d6', grip: '#2a2420' },
    blade_short: { len: 0.24, r0: 0.9, r1: 0.4, c: '#cfd3d6', grip: '#2a2420' }, spear: { len: 0.9, r0: 0.8, r1: 0.8, c: '#8a6a40', tip: '#bbbbbb' },
    pistol: { len: 0.16, r0: 1.5, r1: 1.3, c: '#26282a' }, rifle: { len: 0.62, r0: 1.7, r1: 1.1, c: '#26282a', stock: '#5a3f28' }, shotgun: { len: 0.6, r0: 1.8, r1: 1.4, c: '#26282a', stock: '#5a3f28' },
    tool: { len: 0.3, r0: 1, r1: 1, c: '#8a6a40', head: '#777777' }
  };
  function drawWeapon(g, hand, pose, fx, fy, lf) {
    var wl = WEAPON_LOOK[pose.weapon] || WEAPON_LOOK.tool;
    var dirx = fx, diry = fy;
    if (pose.attack) {
      var a = pose.attack, t = a < 0.45 ? a / 0.45 : 1;
      var an = Math.atan2(fy, fx) + (1 - t) * 1.6 - 0.5;
      dirx = Math.cos(an); diry = Math.sin(an);
    }
    var tipW = iso(dirx * wl.len, diry * wl.len);
    var up = pose.attack ? (pose.attack < 0.45 ? 14 : 2) : (pose.aim ? 3 : 10);
    var tip = [hand[0] + tipW[0], hand[1] + tipW[1] - up];
    if (!pose.attack && !pose.aim && (pose.weapon === 'blunt_long' || pose.weapon === 'axe' || pose.weapon === 'spear' || pose.weapon === 'blade_long')) {
      tip = [hand[0] + tipW[0] * 0.4, hand[1] + tipW[1] * 0.4 + 18]; // arma baixa, apontando para o chão
    }
    var dx = tip[0] - hand[0], dy = tip[1] - hand[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / L, uy = dy / L;
    if (wl.stock) { limb(g, [hand[0] - ux * 5, hand[1] - uy * 5 + 1], hand, 1.9, 1.5, shq(wl.stock, lf)); }
    if (wl.grip) {
      var gEnd = [hand[0] + ux * 3, hand[1] + uy * 3];
      limb(g, hand, tip, wl.r0, wl.r1, shq(wl.c, lf));
      limb(g, [hand[0] - ux * 1.5, hand[1] - uy * 1.5], gEnd, 1.2, 1.2, shq(wl.grip, lf));
    } else {
      limb(g, hand, tip, wl.r0, wl.r1, shq(wl.c, lf));
    }
    if (wl.axe) {
      var px = -uy, py = ux, b0 = [tip[0] - ux * 3.5, tip[1] - uy * 3.5];
      g.beginPath();
      g.moveTo(b0[0] - px * 0.8, b0[1] - py * 0.8); g.lineTo(tip[0] - px * 0.8, tip[1] - py * 0.8);
      g.lineTo(tip[0] + ux * 1 + px * 4.5, tip[1] + uy * 1 + py * 4.5); g.lineTo(b0[0] - ux * 1.2 + px * 4.5, b0[1] - uy * 1.2 + py * 4.5);
      g.closePath(); g.fillStyle = shq(wl.axe, lf); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.stroke();
    }
    if (wl.head) { blob(g, tip[0], tip[1], 2.2, 2.2, shq(wl.head, lf), true); }
    if (wl.tip) {
      g.beginPath(); g.moveTo(tip[0] + ux * 5, tip[1] + uy * 5); g.lineTo(tip[0] - uy * 1.6, tip[1] + ux * 1.6); g.lineTo(tip[0] + uy * 1.6, tip[1] - ux * 1.6); g.closePath();
      g.fillStyle = shq(wl.tip, lf); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.8; g.stroke();
    }
  }

  /* ---------- deitado (dormindo, caído, rastejando, morto) ---------- */
  function drawLying(g, sx, sy, look, pose, lf, fx, fy, rx, ry) {
    function col(c) { return shq(c, lf); }
    function Q(fwd, side, h) { var a = fx * fwd + rx * side, b = fy * fwd + ry * side; return [sx + HW * (a - b), sy + HH * (a + b) - 2.5 - (h || 0)]; }
    var F = !!look.female, Zb = !!look.zombie, sd = look.seed || 7;
    var crawl = !!pose.crawl, dead = !!pose.dead;
    var skin = look.skin, shirt = look.shirt || skin, outer = look.jacket || shirt;
    var sleeve = look.sleeve || 'long', legsT = look.legs || 'long';
    var sleeveCol = look.sleeveCol || outer;
    var shW = F ? 0.13 : 0.16, hipW = F ? 0.13 : 0.11;
    var ph = (pose.phase || 0) * TAU;
    if (dead) { // poça escura sob o corpo
      g.fillStyle = 'rgba(70,8,8,0.45)'; g.beginPath(); g.ellipse(sx + 2, sy + 1, 17, 8, 0, 0, TAU); g.fill();
    }
    // pernas
    var spread = dead ? 0.05 + ((sd >> 2) & 3) * 0.03 : 0.03;
    var drag = crawl ? Math.sin(ph) * 0.04 : 0;
    function legL(side) {
      var hip = Q(-0.1, side * hipW * 0.6, 2), knee = Q(-0.36 + (side > 0 ? drag : -drag), side * (0.07 + spread * 0.6), 1.5), foot = Q(-0.6 + (side > 0 ? drag : -drag), side * (0.08 + spread), 1.5);
      var c = legsT === 'long' ? col(look.pants) : col(skin);
      limb(g, knee, foot, 2.5, 1.8, c);
      limb(g, hip, knee, 3.3, 2.6, c);
      if (legsT === 'shorts') { limb(g, hip, lerp2(hip, knee, 0.7), 3.7, 3.1, col(look.pants)); }
      var toe = Q(-0.68 + (side > 0 ? drag : -drag), side * (0.09 + spread), dead ? 4 : 1.5);
      limb(g, foot, toe, 1.9, 1.8, look.shoes ? col(look.shoes) : col(skin));
    }
    legL(-1); legL(1);
    // tronco
    var hl = Q(-0.14, -hipW, 2), hr = Q(-0.14, hipW, 2), wl = Q(0.04, -(F ? 0.1 : 0.13), 3), wr = Q(0.04, F ? 0.1 : 0.13, 3), sl = Q(0.3, -shW, 3), sr = Q(0.3, shW, 3);
    if (legsT === 'skirt' || legsT === 'dress') {
      var kl = Q(-0.42, -hipW * 1.5, 1.5), kr = Q(-0.42, hipW * 1.5, 1.5);
      g.beginPath(); g.moveTo(wl[0], wl[1]); g.lineTo(wr[0], wr[1]); g.lineTo(kr[0], kr[1]); g.lineTo(kl[0], kl[1]); g.closePath();
      g.fillStyle = col(look.pants); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.stroke();
    } else {
      g.beginPath(); g.moveTo(hl[0], hl[1]); g.lineTo(hr[0], hr[1]); g.lineTo(wr[0], wr[1]); g.lineTo(wl[0], wl[1]); g.closePath();
      g.fillStyle = col(look.pants); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.stroke();
    }
    var tl = Q(-0.1, -hipW, 3), tr = Q(-0.1, hipW, 3);
    g.beginPath(); g.moveTo(tl[0], tl[1]); g.quadraticCurveTo(wl[0], wl[1], sl[0], sl[1]);
    var nk = Q(0.36, 0, 3);
    g.quadraticCurveTo(nk[0], nk[1], sr[0], sr[1]); g.quadraticCurveTo(wr[0], wr[1], tr[0], tr[1]); g.closePath();
    g.fillStyle = col(outer); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.beginPath(); g.moveTo(Q(0.05, 0, 3)[0], Q(0.05, 0, 3)[1]); g.lineTo(sr[0], sr[1]); g.lineTo(tr[0], tr[1]); g.closePath(); g.fill();
    if (look.blood) {
      g.fillStyle = col('#5e0f0f');
      for (var i = 0; i < look.blood.length; i++) { var bp = Q(look.blood[i][1] * 0.35 - 0.05, look.blood[i][0] * 0.1, 3); g.beginPath(); g.ellipse(bp[0], bp[1], look.blood[i][2] * 0.8, look.blood[i][2] * 0.6, 0, 0, TAU); g.fill(); }
    }
    // braços
    function armL(side) {
      var sh = side < 0 ? sl : sr;
      var el, hd;
      if (crawl) {
        var r = Math.sin(ph + (side > 0 ? 0 : Math.PI)) * 0.1;
        el = Q(0.42 + r * 0.5, side * 0.2, 3); hd = Q(0.6 + r, side * 0.14, 2);
      } else if (dead) {
        var k = ((sd >> (side > 0 ? 4 : 6)) & 3);
        el = Q(0.3 - k * 0.08 + 0.05, side * (0.3 + k * 0.03), 1.5); hd = Q(0.45 - k * 0.22, side * (0.4 + k * 0.02), 1);
      } else { // dormindo / caído
        el = Q(0.1, side * (shW + 0.06), 2); hd = Q(-0.08, side * (shW + 0.05), 2);
      }
      var sc = sleeve === 'none' ? col(skin) : col(sleeveCol);
      limb(g, el, hd, 2, 1.6, sleeve === 'long' ? sc : col(skin));
      limb(g, sh, el, 2.5, 2.1, sleeve === 'short' ? col(skin) : sc);
      if (sleeve === 'short') { limb(g, sh, lerp2(sh, el, 0.6), 2.9, 2.5, sc); }
      blob(g, hd[0], hd[1], 1.9, 1.9, look.gloves ? col(look.gloves) : col(skin), true);
    }
    armL(-1); armL(1);
    // cabeça
    var hh = crawl ? 5 : 2.5;
    var hc = Q(0.47, dead ? ((sd & 3) - 1.5) * 0.03 : 0, hh);
    var hs = look.hairStyle || 'curto';
    if (hs === 'longo' || hs === 'rabo' || (hs === 'médio' && F)) { var hb = Q(0.62, 0, 1); limb(g, hc, hb, 3.6, 3, col(look.hair)); }
    blob(g, hc[0], hc[1], F ? 4 : 4.3, F ? 3.9 : 4.2, col(skin), true);
    if (hs !== 'careca') {
      g.save(); g.beginPath(); g.ellipse(hc[0], hc[1], 4.8, 4.6, 0, 0, TAU); g.clip();
      var hf = iso(fx * 0.06, fy * 0.06);
      if (hs === 'raspado') { g.globalAlpha *= 0.55; }
      g.fillStyle = col(look.hair); g.beginPath(); g.ellipse(hc[0] + hf[0], hc[1] + hf[1] - 0.5, 4.4, 4.2, 0, 0, TAU); g.fill();
      g.restore();
    }
    if (look.hat) { var hf2 = iso(fx * 0.05, fy * 0.05); blob(g, hc[0] + hf2[0], hc[1] + hf2[1] - 0.8, 4.4, 3.6, col(look.hat), true); }
    if (Zb || dead) { g.fillStyle = 'rgba(30,8,8,0.7)'; var mf = iso(-fx * 0.04, -fy * 0.04); g.beginPath(); g.ellipse(hc[0] + mf[0], hc[1] + mf[1] + 1, 1.1, 0.8, 0, 0, TAU); g.fill(); }
  }

  CP.Spr = S;
})(window.CP = window.CP || {});
