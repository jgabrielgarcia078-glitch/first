/* Arte procedural: tudo é desenhado por código em canvases escondidos e guardado em cache.
 * Cada sprite tem variações de iluminação (LIGHT_STEPS) geradas sob demanda. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U;
  var TW = C.TILE_W, TH = C.TILE_H, HW = TW / 2, HH = TH / 2, WH = C.WALL_H;
  var F = C.FLOOR, E = C.EDGE, O = C.OBJ;

  var LIGHT_STEPS = [0.10, 0.18, 0.27, 0.37, 0.48, 0.60, 0.73, 0.86, 1.0];
  var NIGHT_TINT = [10, 14, 32];

  var S = { LIGHT_STEPS: LIGHT_STEPS, cache: {}, count: 0 };

  function mk(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  S.mk = mk;

  /* Registro: key → { base: canvas, ax, ay, lv: [] } */
  function store(key, canvas, ax, ay) {
    var s = { base: canvas, ax: ax, ay: ay, lv: new Array(LIGHT_STEPS.length) };
    S.cache[key] = s; S.count++;
    return s;
  }
  /* versão escurecida da sprite (nível de luz li) */
  S.lit = function (s, li) {
    if (li >= LIGHT_STEPS.length - 1) { return s.base; }
    var c = s.lv[li];
    if (c) { return c; }
    c = mk(s.base.width, s.base.height);
    var g = c.getContext('2d');
    g.drawImage(s.base, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    var b = LIGHT_STEPS[li];
    g.fillStyle = 'rgba(' + NIGHT_TINT[0] + ',' + NIGHT_TINT[1] + ',' + NIGHT_TINT[2] + ',' + (1 - b).toFixed(3) + ')';
    g.fillRect(0, 0, c.width, c.height);
    s.lv[li] = c;
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
  FLOOR_COLORS[F.GRASS] = ['#5d7a3a', '#56723a', '#628040', '#5a7838'];
  FLOOR_COLORS[F.DARKGRASS] = ['#4a6530', '#46602e', '#4d6833', '#435c2b'];
  FLOOR_COLORS[F.DIRT] = ['#7b6449', '#806a4e', '#756046', '#7e6650'];
  FLOOR_COLORS[F.ASPHALT] = ['#3c3d40', '#3a3b3e', '#3e3f42', '#393a3c'];
  FLOOR_COLORS[F.ASPHALT_LINE] = ['#3c3d40', '#3c3d40', '#3c3d40', '#3c3d40'];
  FLOOR_COLORS[F.SIDEWALK] = ['#9a978f', '#97948c', '#9c9991', '#959289'];
  FLOOR_COLORS[F.WOOD] = ['#8c6339', '#875f37', '#90673c', '#855d35'];
  FLOOR_COLORS[F.TILE] = ['#cfd3cf', '#ccd0cc', '#d2d6d2', '#c9cdc9'];
  FLOOR_COLORS[F.CARPET] = ['#7a4f5d', '#5d6a85', '#6b7a55', '#8a7550'];
  FLOOR_COLORS[F.WATER] = ['#2f5f7a', '#2c5c77', '#32637e', '#2d5a74'];
  FLOOR_COLORS[F.SAND] = ['#c9b588', '#c5b184', '#cdb98c', '#c2ae81'];
  FLOOR_COLORS[F.FARM] = ['#5b4632', '#58432f', '#5e4934', '#56412e'];
  FLOOR_COLORS[F.FURROW] = ['#5b4632', '#58432f', '#5e4934', '#56412e'];
  FLOOR_COLORS[F.FIELD] = ['#7d8a3f', '#7a873d', '#808d42', '#77843b'];
  FLOOR_COLORS[F.ROOF] = ['#6e3b2e', '#4a4a50', '#5a4636', '#3d4a5a', '#6a6a62', '#5c5048', '#4f5a4a', '#705a40'];
  FLOOR_COLORS[F.CONCRETE] = ['#8a8984', '#878681', '#8d8c87', '#84837e'];
  FLOOR_COLORS[F.GRAVEL] = ['#86807a', '#827c76', '#8a847e', '#7e7872'];
  FLOOR_COLORS[F.LINOLEUM] = ['#b9b29a', '#b5ae96', '#bdb69e', '#b1aa92'];

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
    if (f === F.GRASS || f === F.DARKGRASS || f === F.FIELD) {
      for (i = 0; i < 70; i++) {
        x = rng.next() * TW; y = rng.next() * TH;
        g.fillStyle = rng.chance(0.5) ? U.shade(base, 1.18) : U.shade(base, 0.8);
        g.fillRect(x, y, 1, 2);
      }
      if (f === F.FIELD) { for (i = 0; i < 4; i++) { tline(0, i * 0.25 + 0.12, 1, i * 0.25 + 0.12, U.shade(base, 0.75), 1.5); } }
      if (rng.chance(0.25) && f !== F.FIELD) { for (i = 0; i < 3; i++) { g.fillStyle = ['#d8d36a', '#e8e8e0', '#c57ad1'][rng.int(0, 2)]; g.fillRect(rng.next() * TW, rng.next() * TH, 2, 2); } }
    } else if (f === F.DIRT || f === F.FARM || f === F.SAND || f === F.GRAVEL) {
      for (i = 0; i < 55; i++) {
        x = rng.next() * TW; y = rng.next() * TH;
        g.fillStyle = rng.chance(0.5) ? U.shade(base, 1.12) : U.shade(base, 0.85);
        g.fillRect(x, y, rng.chance(0.2) ? 2 : 1, 1);
      }
      if (f === F.FARM) { for (i = 0; i < 4; i++) { tline(0.12 + i * 0.25, 0, 0.12 + i * 0.25, 1, U.shade(base, 0.7), 2); } }
    } else if (f === F.ASPHALT || f === F.ASPHALT_LINE) {
      for (i = 0; i < 60; i++) {
        x = rng.next() * TW; y = rng.next() * TH;
        g.fillStyle = rng.chance(0.5) ? U.shade(base, 1.25) : U.shade(base, 0.8);
        g.fillRect(x, y, 1, 1);
      }
      if (f === F.ASPHALT_LINE && v === 1) { tline(0.05, 0.5, 0.95, 0.5, '#d8c25a', 2); }
      if (f === F.ASPHALT_LINE && v === 2) { tline(0.5, 0.05, 0.5, 0.95, '#d8c25a', 2); }
      if (rng.chance(0.15)) { tline(rng.next(), rng.next(), rng.next(), rng.next(), U.shade(base, 0.7), 1); }
    } else if (f === F.SIDEWALK || f === F.CONCRETE) {
      tline(0, 0.5, 1, 0.5, U.shade(base, 0.86), 1); tline(0.5, 0, 0.5, 1, U.shade(base, 0.86), 1);
      for (i = 0; i < 25; i++) { g.fillStyle = U.shade(base, rng.chance(0.5) ? 1.08 : 0.9); g.fillRect(rng.next() * TW, rng.next() * TH, 1, 1); }
    } else if (f === F.WOOD) {
      for (i = 0; i <= 5; i++) { tline(0, i / 5, 1, i / 5, U.shade(base, 0.78), 1); }
      for (i = 0; i < 5; i++) { var px = rng.next(); tline(px, i / 5, px, (i + 1) / 5, U.shade(base, 0.8), 1); }
    } else if (f === F.TILE || f === F.LINOLEUM) {
      var n = f === F.TILE ? 4 : 2;
      for (i = 0; i <= n; i++) { tline(0, i / n, 1, i / n, U.shade(base, 0.85), 1); tline(i / n, 0, i / n, 1, U.shade(base, 0.85), 1); }
      if (f === F.LINOLEUM) { for (i = 0; i < 2; i++) { for (var j = 0; j < 2; j++) { if ((i + j) % 2) { var a = ip(i / 2, j / 2, 0); poly(g, [[a[0] + HW, a[1]], [a[0] + HW + HW / 2, a[1] + HH / 2], [a[0] + HW, a[1] + HH], [a[0] + HW / 2, a[1] + HH / 2]], U.shade(base, 0.9)); } } } }
    } else if (f === F.CARPET) {
      for (i = 0; i < 90; i++) { g.fillStyle = U.shade(base, rng.chance(0.5) ? 1.1 : 0.9); g.fillRect(rng.next() * TW, rng.next() * TH, 1, 1); }
    } else if (f === F.WATER) {
      for (i = 0; i < 6; i++) { x = rng.next() * TW; y = rng.next() * TH; g.strokeStyle = 'rgba(200,230,255,0.25)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y); g.stroke(); }
    } else if (f === F.ROOF) {
      for (i = 0; i <= 8; i++) { tline(0, i / 8, 1, i / 8, U.shade(base, 0.8), 1); }
      for (i = 0; i < 8; i++) { for (var k = 0; k < 4; k++) { var ox = (k + (i % 2) * 0.5) / 4; tline(ox, i / 8, ox, (i + 1) / 8, U.shade(base, 0.85), 1); } }
    }
    g.restore();
    return (floorArr[nk] = store(key, c, HW + 1, 1));
  }
  S.floor = floorSprite;

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
  function wallSprite(type, style, side, state, bar, cut, extra) {
    var nk = (((((type * 16 + style) * 2 + side) * 4 + state) * 5 + bar) * 2 + (cut ? 1 : 0)) * 2 + (extra ? 1 : 0);
    var s0 = wallArr[nk];
    if (s0) { return s0; }
    var key = 'w' + type + '_' + style + '_' + side + '_' + state + '_' + bar + '_' + (cut ? 1 : 0) + '_' + (extra || 0);
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
      // face
      wquad(g, side, 0, 1, 0, H, baseCol, ox, oy);
      if (!cut) {
        if (st.brick) {
          for (var r = 0; r < H / 6; r++) {
            wline(g, side, 0, r * 6, 1, r * 6, U.shade(st.base, faceF * 0.8), 1, ox, oy);
            for (var b = 0; b < 4; b++) { var u = (b + (r % 2) * 0.5) / 4; if (u < 1) { wline(g, side, u, r * 6, u, r * 6 + 6, U.shade(st.base, faceF * 0.8), 1, ox, oy); } }
          }
        } else if (st.tiles) {
          for (var r2 = 0; r2 < H / 10; r2++) { wline(g, side, 0, r2 * 10, 1, r2 * 10, U.shade(st.base, faceF * 0.88), 1, ox, oy); }
          for (var b2 = 1; b2 < 4; b2++) { wline(g, side, b2 / 4, 0, b2 / 4, H, U.shade(st.base, faceF * 0.88), 1, ox, oy); }
        } else if (!st.interior) {
          for (var r3 = 1; r3 < H / 7; r3++) { wline(g, side, 0, r3 * 7, 1, r3 * 7, U.shade(st.base, faceF * 0.9), 1, ox, oy); }
        } else {
          // rodapé
          wquad(g, side, 0, 1, 0, 5, U.shade(st.trim, faceF), ox, oy);
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
    var cw = TW + 64, chh = TH + maxH + 10;
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
      case O.FRIDGE: bw = againstWall(dir, 0.72, 0.12); box(g, bw[0], bw[1], bw[2], bw[3], 0, 72, '#e4e2dc'); break;
      case O.STOVE: bw = againstWall(dir, 0.75, 0.1); box(g, bw[0], bw[1], bw[2], bw[3], 0, 30, '#e2e0da');
        for (var bi = 0; bi < 4; bi++) { var pp = ip(bw[0] + bw[2] * (0.28 + (bi % 2) * 0.44), bw[1] + bw[3] * (0.28 + Math.floor(bi / 2) * 0.44), 30); ellipseAt(g, pp[0], pp[1], 5, 2.6, '#2a2a2a'); }
        break;
      case O.COUNTER: bw = againstWall(dir, 0.8, 0.0); box(g, bw[0], bw[1], bw[2], bw[3], 0, 30, '#8a6a4a'); topRect(g, bw[0], bw[1], bw[2], bw[3], 30.5, '#cfc6b0'); break;
      case O.SINK: bw = againstWall(dir, 0.8, 0.0); box(g, bw[0], bw[1], bw[2], bw[3], 0, 30, '#8a6a4a'); topRect(g, bw[0], bw[1], bw[2], bw[3], 30.5, '#cfc6b0');
        var sc = ip(bw[0] + bw[2] / 2, bw[1] + bw[3] / 2, 31); ellipseAt(g, sc[0], sc[1], 10, 5, '#9aa4a8'); ellipseAt(g, sc[0], sc[1] + 1, 7, 3.4, '#6e787c'); break;
      case O.TABLE: drawTable(g, '#8a5f38', 25); break;
      case O.CHAIR: drawChair(g, dir, '#7a5432'); break;
      case O.SOFA: drawSofa(g, dir, ['#6b4a3a', '#3e5c76', '#6b6b45', '#8a4b4b'][(extra || rng.int(0, 3)) % 4]); break;
      case O.SHELF: bw = againstWall(dir, 0.35, 0.06); box(g, bw[0], bw[1], bw[2], bw[3], 0, 70, '#6e4b2c'); drawBooks(g, bw, dir, rng); break;
      case O.WARDROBE: bw = againstWall(dir, 0.55, 0.05); box(g, bw[0], bw[1], bw[2], bw[3], 0, 76, '#7a5634'); doorLines(g, bw, dir, 76); break;
      case O.DRESSER: bw = againstWall(dir, 0.5, 0.08); box(g, bw[0], bw[1], bw[2], bw[3], 0, 32, '#80583a'); drawerLines(g, bw, dir, 32); break;
      case O.NIGHTSTAND: bw = againstWall(dir, 0.5, 0.22); box(g, bw[0], bw[1], bw[2], bw[3], 0, 18, '#80583a'); break;
      case O.DESK: bw = againstWall(dir, 0.6, 0.05); box(g, bw[0], bw[1], bw[2], bw[3], 0, 25, '#6e5032'); break;
      case O.TOILET: bw = againstWall(dir, 0.3, 0.3); box(g, bw[0], bw[1], bw[2], bw[3], 0, 26, '#eeeeea');
        var tc = ip(0.5, 0.5, 13); ellipseAt(g, tc[0], tc[1], 9, 5, '#f2f2ee'); ellipseAt(g, tc[0], tc[1], 6, 3, '#c9d2d6'); break;
      case O.BATHTUB: box(g, 0.06, 0.06, 0.88, 0.88, 0, 18, '#efefea'); topRect(g, 0.16, 0.16, 0.68, 0.68, 18.5, '#bfcbd0'); break;
      case O.TV: bw = againstWall(dir, 0.45, 0.15); box(g, bw[0], bw[1], bw[2], bw[3], 0, 14, '#4a3828'); box(g, bw[0] + 0.08, bw[1] + 0.06, bw[2] - 0.16, bw[3] - 0.12, 14, 24, '#232326'); break;
      case O.CRATE: box(g, 0.14, 0.14, 0.72, 0.72, 0, 24, '#9c7a4c'); topRect(g, 0.14, 0.45, 0.72, 0.06, 24.5, '#7a5c36'); break;
      case O.DUMPSTER: box(g, 0.04, 0.12, 0.92, 0.76, 0, 34, '#3f6b4a'); break;
      case O.LAMPPOST: drawLamp(g); break;
      case O.MAILBOX: box(g, 0.46, 0.46, 0.08, 0.08, 0, 22, '#555'); box(g, 0.36, 0.38, 0.28, 0.24, 22, 12, '#2f4f8f'); break;
      case O.SHOP_SHELF: bw = (dir === 1 || dir === 3) ? [0.25, 0.02, 0.5, 0.96] : [0.02, 0.25, 0.96, 0.5]; box(g, bw[0], bw[1], bw[2], bw[3], 0, 48, '#9ea3a6'); drawProducts(g, bw, rng); break;
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
      case O.LOCKER: bw = againstWall(dir, 0.45, 0.12); box(g, bw[0], bw[1], bw[2], bw[3], 0, 70, '#6f7a85'); doorLines(g, bw, dir, 70); break;
      case O.GENERATOR: box(g, 0.15, 0.25, 0.7, 0.5, 0, 22, '#d1a52a'); box(g, 0.2, 0.3, 0.2, 0.2, 22, 6, '#333'); break;
      case O.FENCE_POST: box(g, 0.42, 0.42, 0.16, 0.16, 0, 30, '#6b5034'); break;
      case O.CORPSE_PILE: drawRock(g, rng); break;
      default: box(g, 0.2, 0.2, 0.6, 0.6, 0, 20, '#f0f');
    }
    return (objArr[nk] = store(key, c, ax, ay));
  }
  S.obj = objSprite;

  function drawTree(g, rng, v) {
    var t = ip(0.5, 0.5, 0);
    ellipseAt(g, t[0], t[1] + 2, 20, 9, 'rgba(0,0,0,0.25)');
    g.fillStyle = '#5a3e25'; g.fillRect(t[0] - 3, t[1] - 70, 7, 72);
    g.fillStyle = '#4a321d'; g.fillRect(t[0] + 1, t[1] - 70, 3, 72);
    var greens = [['#3f6a2c', '#4d7d34', '#5b8f3e', '#355c25'], ['#4a6b2a', '#5a7f33', '#6b923c', '#3d5a22'], ['#3b5e33', '#48723d', '#568647', '#30502a'], ['#5a6e2a', '#6c8233', '#7d963c', '#4a5c22']][v % 4];
    var blobs = [];
    for (var i = 0; i < 14; i++) { blobs.push([t[0] + rng.range(-26, 26), t[1] - 80 - rng.range(-30, 50), rng.range(14, 24)]); }
    blobs.sort(function (a, b) { return a[1] - b[1]; });
    blobs.forEach(function (b) { ellipseAt(g, b[0] + 2, b[1] + 3, b[2], b[2] * 0.85, greens[3]); });
    blobs.forEach(function (b, i) { ellipseAt(g, b[0], b[1], b[2] * 0.95, b[2] * 0.8, greens[i % 3]); });
    blobs.forEach(function (b) { ellipseAt(g, b[0] - b[2] * 0.3, b[1] - b[2] * 0.3, b[2] * 0.4, b[2] * 0.3, 'rgba(200,230,150,0.15)'); });
  }
  function drawPine(g, rng, v) {
    var t = ip(0.5, 0.5, 0);
    ellipseAt(g, t[0], t[1] + 2, 18, 8, 'rgba(0,0,0,0.25)');
    g.fillStyle = '#4a321d'; g.fillRect(t[0] - 3, t[1] - 40, 6, 42);
    var cols = ['#2b4a2e', '#33573a', '#264229', '#3a6040'];
    for (var i = 0; i < 6; i++) {
      var y = t[1] - 30 - i * 26, w = 34 - i * 5;
      poly(g, [[t[0] - w, y], [t[0] + w, y], [t[0], y - 46]], cols[(i + v) % 4]);
      poly(g, [[t[0], y], [t[0] + w, y], [t[0], y - 46]], 'rgba(0,0,0,0.15)');
    }
  }
  function drawBush(g, rng) {
    var t = ip(0.5, 0.5, 0);
    ellipseAt(g, t[0], t[1] + 2, 16, 7, 'rgba(0,0,0,0.22)');
    for (var i = 0; i < 7; i++) { ellipseAt(g, t[0] + rng.range(-12, 12), t[1] - rng.range(6, 24), rng.range(8, 12), rng.range(7, 10), ['#3e6a2e', '#4a7a36', '#56873e', '#33582a'][i % 4]); }
    if (rng.chance(0.4)) { for (var k = 0; k < 5; k++) { ellipseAt(g, t[0] + rng.range(-10, 10), t[1] - rng.range(8, 22), 1.6, 1.6, '#b02a3a'); } }
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
    box(g, 0.06, 0.06, 0.88, 0.88, 0, 12, U.shade(color, 0.9));
    var back = againstWall(dir, 0.22, 0.06);
    box(g, back[0], back[1], back[2], back[3], 12, 16, color);
    box(g, 0.08, 0.08, 0.84, 0.84, 12, 3, U.shade(color, 1.05));
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
    var x0 = horiz ? -0.92 : 0.12, y0 = horiz ? 0.12 : -0.92, w = horiz ? 1.84 : 0.76, d = horiz ? 0.76 : 1.84;
    box(g, x0, y0, w, d, 4, 16, color);
    // cabine
    var cx0 = horiz ? x0 + 0.45 : x0 + 0.06, cy0 = horiz ? y0 + 0.06 : y0 + 0.45, cw = horiz ? 0.85 : 0.64, cd = horiz ? 0.64 : 0.85;
    box(g, cx0, cy0, cw, cd, 20, 13, U.shade(color, 0.95));
    // vidros
    var gl = '#6f8fa3';
    poly(g, [ip(cx0 + cw, cy0, 21), ip(cx0 + cw, cy0 + cd, 21), ip(cx0 + cw, cy0 + cd, 32), ip(cx0 + cw, cy0, 32)], U.shade(gl, 0.9));
    poly(g, [ip(cx0, cy0 + cd, 21), ip(cx0 + cw, cy0 + cd, 21), ip(cx0 + cw, cy0 + cd, 32), ip(cx0, cy0 + cd, 32)], U.shade(gl, 0.75));
    // rodas
    var wheels = horiz ? [[x0 + 0.3, y0 + d], [x0 + w - 0.35, y0 + d]] : [[x0 + w, y0 + 0.3], [x0 + w, y0 + d - 0.35]];
    wheels.forEach(function (wpnt) { var p = ip(wpnt[0], wpnt[1], 5); ellipseAt(g, p[0], p[1], 6, 6, '#1a1a1a'); ellipseAt(g, p[0], p[1], 2.5, 2.5, '#777'); });
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
  /* look: { skin, hair, hairStyle, shirt, pants, shoes, jacket, female, zombie, blood:[...], beard }
   * pose: { ang (radianos, mundo), phase (0..1 ciclo de passos), moving, run, crouch, attack (0..1), shove (0..1), weapon, down, dead, crawl, aim, lunge }
   * lightF: 0..1 multiplicador de cor */
  var bodyPts = [];
  function iso(dx, dy) { return [HW * (dx - dy), HH * (dx + dy)]; }
  S.drawHuman = function (g, sx, sy, look, pose, lightF, alpha) {
    var lf = lightF;
    function col(c) { return U.shade(c, lf); }
    g.save();
    if (alpha !== undefined && alpha < 1) { g.globalAlpha = alpha; }
    var ang = pose.ang;
    var fx = Math.cos(ang), fy = Math.sin(ang);
    var rx = -fy, ry = fx; // direita (no mundo)
    // sombra
    g.fillStyle = 'rgba(0,0,0,' + (0.28 * Math.min(1, lf + 0.2)).toFixed(2) + ')';
    g.beginPath(); g.ellipse(sx, sy, 13, 6.5, 0, 0, Math.PI * 2); g.fill();
    if (pose.down || pose.dead || pose.crawl) {
      drawLying(g, sx, sy, look, pose, col, fx, fy, rx, ry);
      g.restore();
      return;
    }
    var Hh = pose.crouch ? 40 : 52;
    var zombie = look.zombie;
    var phase = pose.phase * Math.PI * 2;
    var swing = pose.moving ? Math.sin(phase) * (pose.run ? 0.34 : 0.22) : 0;
    var bob = pose.moving ? Math.abs(Math.sin(phase)) * (pose.run ? 2.5 : 1.5) : 0;
    var sway = zombie ? Math.sin(phase * 0.5) * 2 : 0;
    function P(fwd, side, h) { // ponto do corpo: frente/direita em unidades de tile, h em px
      var w = iso(fx * fwd + rx * side, fy * fwd + ry * side);
      return [sx + w[0] + sway * 0.5, sy + w[1] - h - bob];
    }
    var hipH = Hh * 0.48, shH = Hh * 0.8, headH = Hh * 0.93;
    var lean = pose.crouch ? 0.08 : (pose.run ? 0.07 : 0) + (zombie ? 0.05 : 0);
    var parts = [];
    // pernas
    var legSpread = 0.08;
    var kneeBend = pose.crouch ? 0.12 : 0;
    function leg(side, s) {
      var hip = P(0, side * legSpread, hipH);
      var foot = P(s * 0.35, side * legSpread * 1.1, 0);
      var knee = P(s * 0.17 + kneeBend, side * legSpread, hipH * 0.5);
      parts.push({ depth: depthOf(side * legSpread, s * 0.2), draw: function () {
        line(g, hip, knee, 6.5, col(look.pants)); line(g, knee, foot, 5.5, col(look.pants));
        line(g, [foot[0], foot[1] - 1], [foot[0] + iso(fx * 0.07, fy * 0.07)[0], foot[1] + iso(fx * 0.07, fy * 0.07)[1] - 1], 5, col(look.shoes));
      } });
    }
    function depthOf(side, fwd) { var w = iso(fx * fwd + rx * side, fy * fwd + ry * side); return w[1]; }
    leg(-1, swing); leg(1, -swing);
    // tronco
    var torsoCol = look.jacket || look.shirt;
    parts.push({ depth: 0, draw: function () {
      var hl = P(lean * 0.3, -0.11, hipH), hr = P(lean * 0.3, 0.11, hipH);
      var sl = P(lean, -0.17, shH), sr = P(lean, 0.17, shH);
      g.beginPath(); g.moveTo(hl[0], hl[1]); g.lineTo(hr[0], hr[1]); g.lineTo(sr[0], sr[1]); g.lineTo(sl[0], sl[1]); g.closePath();
      g.fillStyle = col(torsoCol); g.fill();
      g.strokeStyle = col(U.shade(torsoCol, 0.6)); g.lineWidth = 1; g.stroke();
      // linha do cinto
      line(g, hl, hr, 2.5, col(U.shade(look.pants, 0.7)));
      if (look.jacket && look.shirt) { var nm = P(lean + 0.02, 0, shH - 1), nb = P(lean * 0.6 + 0.02, 0, hipH + 8); line(g, nm, nb, 3, col(look.shirt)); }
      // sangue
      if (look.blood) {
        for (var b = 0; b < look.blood.length; b++) {
          var bp = P(lean * 0.6 + 0.05, look.blood[b][0] * 0.14, hipH + look.blood[b][1] * (shH - hipH));
          g.fillStyle = U.shade('#6e1414', lf); g.beginPath(); g.ellipse(bp[0], bp[1], look.blood[b][2], look.blood[b][2] * 0.8, 0, 0, Math.PI * 2); g.fill();
        }
      }
    } });
    // braços
    function arm(side, s) {
      var sh = P(lean, side * 0.17, shH - 2);
      var hand, elbow;
      var weaponHand = side === 1;
      if (zombie && !pose.attack) {
        hand = P(0.42 + lean, side * 0.12, shH - 4 + Math.sin(phase + side) * 2);
        elbow = P(0.22 + lean, side * 0.16, shH - 4);
      } else if (pose.attack && weaponHand) {
        // golpe: braço vai de trás/alto para frente/baixo
        var a = pose.attack;
        var t = a < 0.45 ? a / 0.45 : 1 - (a - 0.45) / 0.55 * 0.6;
        var fwd = -0.15 + t * 0.55, hh = shH + 10 - t * 18;
        hand = P(fwd + lean, side * (0.18 - t * 0.12), hh);
        elbow = P((fwd + lean) * 0.5, side * 0.2, shH - 2);
      } else if (pose.shove) {
        var tt = Math.sin(pose.shove * Math.PI);
        hand = P(0.18 + tt * 0.3 + lean, side * 0.12, shH - 6);
        elbow = P(0.1 + tt * 0.15 + lean, side * 0.18, shH - 8);
      } else if (pose.aim && weaponHand) {
        hand = P(0.38 + lean, 0.04, shH - 4);
        elbow = P(0.18 + lean, side * 0.16, shH - 6);
      } else {
        hand = P(-s * 0.28 + lean * 0.5, side * 0.2, hipH + 2);
        elbow = P(-s * 0.12 + lean * 0.5, side * 0.2, (shH + hipH) / 2 + 2);
      }
      parts.push({ depth: depthOf(side * 0.17, 0) + (weaponHand ? 0.1 : 0), draw: function () {
        line(g, sh, elbow, 5, col(torsoCol));
        line(g, elbow, hand, 4.5, look.jacket ? col(look.jacket) : col(look.skin));
        g.fillStyle = col(look.skin); g.beginPath(); g.arc(hand[0], hand[1], 2.6, 0, Math.PI * 2); g.fill();
        if (weaponHand && pose.weapon && !zombie) { drawWeapon(g, hand, pose, fx, fy, col); }
      } });
    }
    arm(-1, -swing); arm(1, swing);
    // cabeça
    parts.push({ depth: 0.5, draw: function () {
      var hc = P(lean + 0.03 + (zombie ? 0.05 : 0), 0, headH + (pose.crouch ? 0 : 0));
      var r = 6.2;
      var facingCam = (fx + fy) > -0.2; // olhando "para baixo" na tela
      g.fillStyle = col(look.skin); g.beginPath(); g.arc(hc[0], hc[1], r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = col(U.shade(look.skin, 0.6)); g.lineWidth = 1; g.stroke();
      if (look.hairStyle !== 'careca') {
        var back = iso(-fx * 0.06, -fy * 0.06);
        g.fillStyle = col(look.hair);
        g.beginPath();
        if (facingCam) {
          g.arc(hc[0] + back[0], hc[1] + back[1] - 2, r * 0.98, Math.PI * 1.05, Math.PI * 1.95);
          g.closePath(); g.fill();
        } else {
          g.arc(hc[0] + back[0] * 0.5, hc[1] + back[1] * 0.5 - 0.5, r, 0, Math.PI * 2); g.fill();
        }
        if (look.hairStyle === 'longo' || look.hairStyle === 'rabo') {
          var bk = iso(-fx * 0.12, -fy * 0.12);
          line(g, [hc[0] + bk[0], hc[1] + bk[1]], [hc[0] + bk[0], hc[1] + bk[1] + (look.hairStyle === 'longo' ? 12 : 9)], look.hairStyle === 'longo' ? 8 : 4, col(look.hair));
        }
      }
      if (facingCam) {
        var e = iso(fx * 0.1, fy * 0.1);
        var eR = iso(rx * 0.05, ry * 0.05);
        var eyeCol = zombie ? '#e8e0c0' : '#1a1a1a';
        g.fillStyle = col(eyeCol);
        g.fillRect(hc[0] + e[0] + eR[0] - 1, hc[1] + e[1] + eR[1], 2, zombie ? 1.5 : 2);
        g.fillRect(hc[0] + e[0] - eR[0] - 1, hc[1] + e[1] - eR[1], 2, zombie ? 1.5 : 2);
        if (zombie) { g.fillStyle = col('#3a1010'); g.fillRect(hc[0] + e[0] - 2, hc[1] + e[1] + 3, 4, 2); }
        if (look.beard) { g.fillStyle = col(look.hair); g.beginPath(); g.arc(hc[0] + e[0] * 0.6, hc[1] + e[1] * 0.6 + 3, 3.6, 0, Math.PI); g.fill(); }
      }
      if (look.hat) { var hh2 = [hc[0], hc[1] - 4]; g.fillStyle = col(look.hat); g.beginPath(); g.ellipse(hh2[0], hh2[1], 7.5, 3.5, 0, 0, Math.PI * 2); g.fill(); g.fillRect(hh2[0] - 5, hh2[1] - 5, 10, 5); }
    } });
    parts.sort(function (a, b) { return a.depth - b.depth; });
    for (var i = 0; i < parts.length; i++) { parts[i].draw(); }
    g.restore();
  };
  function line(g, a, b, w, c) {
    g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  S.line = line;
  var WEAPON_LOOK = {
    blunt_long: { len: 0.55, w: 4, c: '#9a7a50' }, blunt_short: { len: 0.32, w: 3, c: '#7a7a7a', head: '#555' },
    axe: { len: 0.5, w: 3.5, c: '#7a5a3a', head: '#9aa0a6' }, blade_long: { len: 0.6, w: 2.5, c: '#c8ccd0' },
    blade_short: { len: 0.22, w: 2.5, c: '#c8ccd0' }, spear: { len: 0.9, w: 3, c: '#8a6a40', head: '#bbb' },
    pistol: { len: 0.16, w: 4, c: '#2a2a2a' }, rifle: { len: 0.62, w: 4, c: '#3a2f25' }, shotgun: { len: 0.6, w: 4.5, c: '#2a2a2a' },
    tool: { len: 0.3, w: 3, c: '#8a6a40', head: '#777' }
  };
  function drawWeapon(g, hand, pose, fx, fy, col) {
    var wl = WEAPON_LOOK[pose.weapon] || WEAPON_LOOK.tool;
    var dirx = fx, diry = fy;
    if (pose.attack) {
      var a = pose.attack, t = a < 0.45 ? a / 0.45 : 1;
      var ang = Math.atan2(fy, fx) + (1 - t) * 1.6 - 0.5;
      dirx = Math.cos(ang); diry = Math.sin(ang);
    }
    var tipW = iso(dirx * wl.len, diry * wl.len);
    var up = pose.attack ? (pose.attack < 0.45 ? 14 : 2) : (pose.aim ? 0 : 10);
    var tip = [hand[0] + tipW[0], hand[1] + tipW[1] - up];
    if (!pose.attack && !pose.aim && (pose.weapon === 'blunt_long' || pose.weapon === 'axe' || pose.weapon === 'spear' || pose.weapon === 'blade_long')) {
      tip = [hand[0] + tipW[0] * 0.4, hand[1] + tipW[1] * 0.4 + 18]; // arma baixa, apontando para o chão
    }
    line(g, hand, tip, wl.w, col(wl.c));
    if (wl.head) { g.fillStyle = col(wl.head); g.beginPath(); g.arc(tip[0], tip[1], wl.w + 1, 0, Math.PI * 2); g.fill(); }
  }
  function drawLying(g, sx, sy, look, pose, col, fx, fy, rx, ry) {
    // corpo deitado ao longo de "ang": cabeça na frente
    function Q(fwd, side) { var w = iso(fx * fwd + rx * side, fy * fwd + ry * side); return [sx + w[0], sy + w[1] - 3]; }
    var crawl = pose.crawl;
    var head = Q(0.48, 0), neck = Q(0.32, 0), hip = Q(-0.12, 0);
    var torsoCol = look.jacket || look.shirt;
    if (!crawl) {
      line(g, hip, Q(-0.55, -0.1), 6, col(look.pants)); line(g, hip, Q(-0.55, 0.12), 6, col(look.pants));
    } else {
      line(g, hip, Q(-0.25, -0.08), 6, col(look.pants)); line(g, hip, Q(-0.25, 0.08), 6, col(look.pants));
    }
    var reach = crawl ? Math.sin((pose.phase || 0) * Math.PI * 2) * 0.12 : 0;
    line(g, Q(0.28, -0.12), Q(0.55 + reach, -0.2), 4.5, col(look.skin));
    line(g, Q(0.28, 0.12), Q(0.55 - reach, 0.2), 4.5, col(look.skin));
    line(g, neck, hip, 13, col(torsoCol));
    if (look.blood) { g.fillStyle = col('#6e1414'); var bp = Q(0.1, 0.03); g.beginPath(); g.ellipse(bp[0], bp[1], 4, 3, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = col(look.skin); g.beginPath(); g.arc(head[0], head[1], 6, 0, Math.PI * 2); g.fill();
    if (look.hairStyle !== 'careca') { g.fillStyle = col(look.hair); g.beginPath(); g.arc(head[0], head[1] - 1, 5, Math.PI, Math.PI * 2); g.fill(); }
    if (pose.dead) {
      g.fillStyle = 'rgba(90,10,10,0.55)'; g.beginPath(); g.ellipse(sx, sy + 2, 16, 7, 0, 0, Math.PI * 2); g.fill();
    }
  }

  CP.Spr = S;
})(window.CP = window.CP || {});
