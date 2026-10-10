/* Renderizador isométrico: pisos, paredes (com recorte), objetos, entidades, ordenados por diagonal. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, S = CP.Spr, V = CP.Vis;
  var HW = C.TILE_W / 2, HH = C.TILE_H / 2, WH = C.WALL_H;
  var E = C.EDGE, O = C.OBJ, F = C.FLOOR, OI = C.OBJ_INFO;
  var AREA = C.CHUNK * C.CHUNK;

  var R = {
    canvas: null, g: null, w: 1, h: 1, dpr: 1,
    zoomIndex: C.ZOOM_DEFAULT_INDEX, zoom: C.ZOOM_LEVELS[C.ZOOM_DEFAULT_INDEX],
    camX: 0, camY: 0, camZ: 0,
    stats: { tiles: 0, ents: 0, ms: 0 },
    buckets: [new Map(), new Map(), new Map()],
    overlays: [],       // funções extras desenhadas em coordenadas de mundo (efeitos)
    cutRadiusOut: 3.5,
    hover: { x: 0, y: 0 }
  };

  R.init = function (canvas) {
    R.canvas = canvas;
    R.g = canvas.getContext('2d', { alpha: false });
    R.resize();
  };
  R.resize = function () {
    if (!R.canvas) { return; }
    R.dpr = R.hiDpi ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    R.w = window.innerWidth; R.h = window.innerHeight;
    R.canvas.width = Math.round(R.w * R.dpr); R.canvas.height = Math.round(R.h * R.dpr);
    R.canvas.style.width = R.w + 'px'; R.canvas.style.height = R.h + 'px';
  };
  R.setZoomIndex = function (i) {
    R.zoomIndex = U.clamp(i, 0, C.ZOOM_LEVELS.length - 1);
    R.zoom = C.ZOOM_LEVELS[R.zoomIndex];
  };

  /* coordenadas de "tela do mundo" (antes da câmera) */
  function wsx(x, y) { return HW * (x - y); }
  function wsy(x, y, z) { return HH * (x + y) - z * WH; }
  R.toScreen = function (x, y, z) {
    var cx = wsx(R.camX, R.camY), cy = wsy(R.camX, R.camY, R.camZ);
    return { x: (wsx(x, y) - cx) * R.zoom + R.w / 2, y: (wsy(x, y, z) - cy) * R.zoom + R.h / 2 };
  };
  R.toWorld = function (sx, sy, z) {
    var cx = wsx(R.camX, R.camY), cy = wsy(R.camX, R.camY, R.camZ);
    var X = (sx - R.w / 2) / R.zoom + cx;
    var Y = (sy - R.h / 2) / R.zoom + cy + z * WH;
    var a = X / HW, d = Y / HH;
    return { x: (a + d) / 2, y: (d - a) / 2 };
  };

  /* código de luz de um tile: bits 0-3 = nível de luz visível, 4-7 = nível de luz "de memória" (fora da visão),
   * 8-10 = quanto do tile está fora da visão (0 = visível, 4 = todo); entre 1 e 3 mistura as duas versões (borda suave) */
  function lcode(liV, liF, q) { return liV | (liF << 4) | (q << 8); }
  function drawSprite(g, spr, c, sx, sy, alpha) {
    var a = alpha !== undefined ? alpha : 1;
    var q = c >> 8, X = sx - spr.ax, Y = sy - spr.ay;
    if (q < 4) {
      if (a < 1) { g.globalAlpha = a; }
      g.drawImage(S.lit(spr, c & 15), X, Y);
    }
    if (q > 0) {
      g.globalAlpha = q >= 4 ? a : a * q / 4;
      g.drawImage(S.litFog(spr, (c >> 4) & 15), X, Y);
    }
    g.globalAlpha = 1;
  }
  /* luz + névoa do tile (x, y, z) vista do andar viewZ */
  function tileCode(x, y, z, viewZ) {
    if (z > viewZ) { return S.lightIndex(V.brightness(x, y, z, viewZ)); }
    if (z < viewZ) { var lb = S.lightIndex(V.brightness(x, y, z, viewZ)); return lcode(lb, lb, 4); }
    var lv = V.lightAt(x, y, z);
    var n = (V.isVisible(x + 1, y, z) ? 1 : 0) + (V.isVisible(x - 1, y, z) ? 1 : 0) + (V.isVisible(x, y + 1, z) ? 1 : 0) + (V.isVisible(x, y - 1, z) ? 1 : 0);
    var q = V.isVisible(x, y, z) ? (n >= 4 ? 0 : 1) : (n >= 2 ? 2 : (n === 1 ? 3 : 4));
    return lcode(S.lightIndex(lv), S.lightIndex(lv * C.FOG_DIM), q);
  }

  /* ---------- quadro ---------- */
  R.draw = function (view) {
    var t0 = performance.now();
    var g = R.g;
    var z = R.zoom, dpr = R.dpr;
    var camSX = wsx(R.camX, R.camY), camSY = wsy(R.camX, R.camY, R.camZ);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#07080a';
    g.fillRect(0, 0, R.canvas.width, R.canvas.height);
    g.imageSmoothingEnabled = false;
    var tx = Math.round(dpr * (R.w / 2 - camSX * z)), ty = Math.round(dpr * (R.h / 2 - camSY * z));
    g.setTransform(dpr * z, 0, 0, dpr * z, tx, ty);

    var viewZ = view.viewZ, maxZ = view.maxZ;
    var px = view.px, py = view.py;
    var hw = R.w / (2 * z), hh = R.h / (2 * z);
    var aMin = Math.floor((camSX - hw) / HW) - 3, aMax = Math.ceil((camSX + hw) / HW) + 3;
    var dMin = Math.floor((camSY - hh) / HH) - 2, dMax = Math.ceil((camSY + hh + (maxZ + 1) * WH) / HH) + 14;

    // baldes de entidades por tile/nível
    var bk = R.buckets;
    bk[0].clear(); bk[1].clear(); bk[2].clear();
    var ents = view.ents, n;
    for (n = 0; n < ents.length; n++) {
      var e = ents[n];
      var lv = W.levelOf(e.z);
      if (lv > maxZ) { continue; }
      var key = (Math.floor(e.x) & 0xffff) | ((Math.floor(e.y) & 0xffff) << 16);
      var arr = bk[lv].get(key);
      if (!arr) { arr = []; bk[lv].set(key, arr); }
      arr.push(e);
    }
    var tiles = 0;
    var d, x, y, x0, x1, zz;
    // passo A: pisos do térreo + manchas
    for (d = dMin; d <= dMax; d++) {
      x0 = Math.ceil((d + aMin) / 2); x1 = Math.floor((d + aMax) / 2);
      for (x = x0; x <= x1; x++) {
        y = d - x;
        var L0 = W.lvl(x, y, 0);
        if (!L0) { continue; }
        var i0 = W.idx(x, y);
        var f = L0.floor[i0];
        if (!f) { continue; }
        var sx = HW * (x - y), sy = HH * (x + y);
        if (sy > camSY + hh + 40 || sy < camSY - hh - 80) { continue; }
        var lia = tileCode(x, y, 0, viewZ);
        drawSprite(g, S.floor(f, fv(f, L0.fvar[i0], x, y)), lia, sx, sy);
        var lk = litterAt(f, x, y);
        if (lk >= 0) { drawSprite(g, S.litter(lk, (x * 7 + y * 3) & 3), lia, sx, sy); }
        tiles++;
      }
    }
    if (view.decals) { view.decals(g, aMin, aMax, dMin, dMax); }
    // passo B: por diagonal, todos os níveis
    for (d = dMin; d <= dMax; d++) {
      x0 = Math.ceil((d + aMin) / 2); x1 = Math.floor((d + aMax) / 2);
      for (x = x0; x <= x1; x++) {
        y = d - x;
        var ch = W.chunkAt(x, y);
        if (!ch) { continue; }
        var ii = W.idx(x, y);
        for (zz = 0; zz <= maxZ; zz++) {
          var L = ch.levels[zz];
          var bx = HW * (x - y), by = HH * (x + y) - zz * WH;
          if (by > camSY + hh + WH + 40 || by < camSY - hh - 260) { continue; }
          var br = V.brightness(x, y, zz, viewZ);
          var li = tileCode(x, y, zz, viewZ);
          var fade = zz > viewZ ? fadeAlpha(x, y, view) : 1;
          if (zz > 0) {
            var fz = L.floor[ii];
            if (fz === F.ROOF) { drawSprite(g, S.roof(roofCode(ch, zz, ii)), li, bx, by, fade); } else if (fz) { drawSprite(g, S.floor(fz, fv(fz, L.fvar[ii], x, y)), li, bx, by, fade); }
          }
          // paredes
          var wwT = L.ww[ii], wnT = L.wn[ii];
          if (wwT) { drawEdge(g, x, y, zz, 1, wwT, L.wws[ii], bx, by, view, li, fade); }
          if (wnT) { drawEdge(g, x, y, zz, 0, wnT, L.wns[ii], bx, by, view, li, fade); }
          // objeto
          var o = L.obj[ii];
          if (o) { drawObject(g, x, y, zz, o, L.odir[ii], bx, by, li, view, ch); }
          // itens no chão
          var its = ch.items[zz * AREA + ii];
          if (its && its.length) { drawSprite(g, S.groundItems(its.length), li, bx, by); }
          // entidades
          var list = bk[zz].size ? bk[zz].get((x & 0xffff) | ((y & 0xffff) << 16)) : null;
          if (list) {
            if (list.length > 1) { list.sort(function (a, b2) { return (a.x + a.y) - (b2.x + b2.y); }); }
            for (n = 0; n < list.length; n++) {
              var en = list[n];
              var esx = HW * (en.x - en.y), esy = HH * (en.x + en.y) - en.z * WH;
              en.draw(g, esx, esy, en.bright !== undefined ? en.bright : br);
            }
          }
        }
      }
    }
    // sobreposições (efeitos, mira, textos)
    for (n = 0; n < R.overlays.length; n++) { R.overlays[n](g); }
    if (view.overlay) { view.overlay(g); }
    R.stats.tiles = tiles; R.stats.ents = ents.length;
    R.stats.ms = performance.now() - t0;
  };

  /* variação de textura por posição nos pisos "naturais" (a cor continua vindo de fvar) */
  var NATURAL = [];
  [F.GRASS, F.DARKGRASS, F.DIRT, F.ASPHALT, F.SIDEWALK, F.SAND, F.GRAVEL, F.CONCRETE, F.FIELD].forEach(function (f) { NATURAL[f] = 1; });
  function fv(f, v, x, y) {
    if (!NATURAL[f]) { return v; }
    var h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return (v & 3) | (((h >>> 16) & 7) << 2);
  }

  /* lixo/abandono no chão: escolhido pela posição (determinístico), por tipo de piso */
  var LITTER = [];
  LITTER[F.ASPHALT] = { p: 0.13, k: [4, 4, 4, 2, 2, 0, 0, 1, 10, 6, 5, 7, 11] };
  LITTER[F.SIDEWALK] = { p: 0.16, k: [5, 5, 5, 2, 2, 0, 0, 1, 9, 4, 7, 8] };
  LITTER[F.CONCRETE] = { p: 0.14, k: [5, 5, 4, 4, 0, 1, 11, 8, 7] };
  LITTER[F.GRASS] = { p: 0.05, k: [2, 2, 0, 3, 1, 9, 7] };
  LITTER[F.DARKGRASS] = { p: 0.04, k: [2, 2, 2, 0, 3] };
  LITTER[F.DIRT] = { p: 0.05, k: [2, 11, 1, 9] };
  LITTER[F.WOOD] = { p: 0.07, k: [0, 0, 0, 8, 11, 7, 6, 1] };
  LITTER[F.TILE] = { p: 0.07, k: [0, 0, 7, 6, 11, 1] };
  LITTER[F.LINOLEUM] = { p: 0.07, k: [0, 0, 7, 6, 11, 1, 8] };
  LITTER[F.CARPET] = { p: 0.06, k: [0, 0, 8, 7, 1, 9] };
  function litterAt(f, x, y) {
    var L = LITTER[f];
    if (!L) { return -1; }
    var h = (x * 2654435761 ^ y * 2246822519) >>> 0;
    h = ((h ^ (h >>> 15)) * 2246822507) >>> 0;
    if ((h % 1000) / 1000 >= L.p) { return -1; }
    return L.k[(h >>> 12) % L.k.length];
  }

  /* ---------- telhados (formato calculado uma vez por chunk e nível) ---------- */
  function roofCode(ch, z, i) {
    var rc = ch._roof || (ch._roof = []);
    return (rc[z] || (rc[z] = computeRoof(ch, z)))[i];
  }
  function qh(h) { return Math.min(63, Math.round(h / 2)); }
  function computeRoof(ch, z) {
    var N = C.CHUNK, out = new Int32Array(AREA);
    var L = ch.levels[z], fl = L.floor, Lb = z > 0 ? ch.levels[z - 1] : null, RF = F.ROOF;
    for (var i = 0; i < AREA; i++) {
      if (fl[i] !== RF) { continue; }
      var lx = i % N, ly = (i / N) | 0;
      var dN = 0, dS = 0, dW = 0, dE = 0;
      while (ly - dN - 1 >= 0 && fl[i - (dN + 1) * N] === RF) { dN++; }
      while (ly + dS + 1 < N && fl[i + (dS + 1) * N] === RF) { dS++; }
      while (lx - dW - 1 >= 0 && fl[i - dW - 1] === RF) { dW++; }
      while (lx + dE + 1 < N && fl[i + dE + 1] === RF) { dE++; }
      var wid = dW + dE + 1, dep = dN + dS + 1, col = L.fvar[i] & 7;
      var small = Math.min(wid, dep);
      if (small > C.ROOF_PITCH_MAX || small < 3) {
        out[i] = 3 | (col << 20) | (((dN === 0 ? 1 : 0) | (dE === 0 ? 2 : 0) | (dS === 0 ? 4 : 0) | (dW === 0 ? 8 : 0)) << 28);
        continue;
      }
      var alongX = wid >= dep;
      var d0 = alongX ? dN : dW, d1 = alongX ? dS : dE, half = (d0 + d1 + 1) / 2;
      var s = Math.min(C.ROOF_SLOPE, C.ROOF_MAX_H / half);
      var a = s * Math.min(d0, d1 + 1), b = s * Math.min(d0 + 1, d1), p = d0 === d1 ? s * (d0 + 0.5) : 0;
      var gable = alongX ? dE === 0 : dS === 0, style = 0;
      if (gable && Lb) {
        if (alongX && lx + 1 < N) { style = Lb.wws[i + 1]; } else if (!alongX && ly + 1 < N) { style = Lb.wns[i + N]; }
      }
      var eav = alongX ? ((d0 === 0 ? 1 : 0) | (d1 === 0 ? 4 : 0)) : ((d0 === 0 ? 8 : 0) | (d1 === 0 ? 2 : 0));
      out[i] = (alongX ? 1 : 2) | (qh(a) << 2) | (qh(b) << 8) | (qh(p) << 14) | (col << 20) | ((gable ? 1 : 0) << 23) | ((style & 15) << 24) | (eav << 28);
    }
    return out;
  }

  /* telhados/andares de cima ficam transparentes perto do jogador (quando ele está do lado de fora) */
  function fadeAlpha(x, y, view) {
    var dx = x + 0.5 - view.px, dy = y + 0.5 - view.py;
    var s = dx + dy, a = dx - dy;
    if (s > -1.5 && s < 16 && a > -5 && a < 5) {
      var k = Math.max(Math.abs(a) / 5, s > 12 ? (s - 12) / 4 : 0);
      return 0.22 + 0.78 * k * k;
    }
    return 1;
  }

  function shouldCut(x, y, z, side, view) {
    if (z !== view.viewZ || view.noCut) { return false; }
    var px = view.px, py = view.py;
    var cx = side === 0 ? x + 0.5 : x, cy = side === 0 ? y : y + 0.5;
    var front = side === 0 ? (y > py + 0.05) : (x > px + 0.05);
    if (!front) { return false; }
    var dx = cx - px, dy = cy - py;
    var dist2 = dx * dx + dy * dy;
    if (view.bld) {
      if (dist2 > 400) { return false; }
      var b1 = W.building(x, y, z);
      var ax = side === 0 ? x : x - 1, ay = side === 0 ? y - 1 : y;
      var b2 = W.building(ax, ay, z);
      if (b1 === view.bld || b2 === view.bld) { return true; }
      // paredes de outras construções muito perto também
      return dist2 < 9;
    }
    // ao ar livre: paredes "na frente na tela" perto do jogador
    var s = dx + dy;
    return s > 0 && s < 14 && Math.abs(dx - dy) < (s < 4 ? 3.2 : 2.4);
  }

  function drawEdge(g, x, y, z, side, type, style, bx, by, view, lc, fade) {
    var cut = shouldCut(x, y, z, side, view);
    var st = W.edgeState(x, y, z, side);
    var state = 0, bar = 0;
    if (st) {
      bar = st.bar || 0;
      if (type === E.DOOR || type === E.GARAGE) { state = st.broken ? 2 : (st.open ? 1 : 0); }
      if (type === E.WINDOW) { state = st.glass === false || st.broken ? 2 : (st.open ? 1 : 0); }
    }
    // brilho: o maior dos dois lados da parede
    var ax = side === 0 ? x : x - 1, ay = side === 0 ? y - 1 : y;
    var lc2 = tileCode(ax, ay, z, view.viewZ);
    var c = lcode(Math.max(lc & 15, lc2 & 15), Math.max((lc >> 4) & 15, (lc2 >> 4) & 15), Math.min(lc >> 8, lc2 >> 8));
    var grime = ((x * 73856093) ^ (y * 19349663) ^ (side * 83492791)) >>> 0;
    var spr = S.wall(type, style, side, state, bar, cut, st && st.curtain ? 1 : 0, (grime >>> 7) % 3);
    drawSprite(g, spr, c, bx, by, fade);
  }

  function drawObject(g, x, y, z, o, dir, bx, by, li, view, ch) {
    var spr;
    if (o === O.STAIRS) {
      spr = S.stairs((dir >> 2) & 3, dir & 3);
      drawSprite(g, spr, li, bx, by);
      return;
    }
    if (o === O.CROP) {
      var crop = ch.crops[W.key(x, y, z)];
      spr = S.obj(o, 0, crop ? crop.stage : 0);
    } else if (o === O.CAR) {
      if (!(dir & 2)) { return; }
      spr = S.obj(o, dir, 0);
    } else {
      spr = S.obj(o, dir, 0);
    }
    var alpha;
    var info = OI[o];
    if (info.h > 0.8 && z === view.viewZ) {
      var dx = x + 0.5 - view.px, dy = y + 0.5 - view.py;
      var s = dx + dy;
      if (s > 0 && s < (info.tree ? 7 : 3) && Math.abs(dx - dy) < (info.tree ? 3.5 : 2)) { alpha = info.tree ? 0.38 : 0.55; }
    }
    drawSprite(g, spr, li, bx, by, alpha);
    if (o === O.CAMPFIRE || ch.fires[W.key(x, y, z)]) { drawFlame(g, bx, by); }
  }
  function drawFlame(g, bx, by) {
    var t = performance.now() / 120;
    var c = [bx, by + HH];
    for (var i = 0; i < 3; i++) {
      var hgt = 14 + Math.sin(t + i * 2) * 4;
      g.fillStyle = ['rgba(255,190,60,0.9)', 'rgba(255,120,30,0.85)', 'rgba(255,240,150,0.9)'][i];
      g.beginPath();
      g.moveTo(c[0] - 7 + i * 3, c[1]); g.quadraticCurveTo(c[0] + Math.sin(t + i) * 4, c[1] - hgt * 1.6, c[0] + 7 - i * 3, c[1]);
      g.fill();
    }
  }

  CP.Render = R;
})(window.CP = window.CP || {});
