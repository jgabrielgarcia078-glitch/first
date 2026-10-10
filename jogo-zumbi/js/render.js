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
    R.dpr = Math.min(window.devicePixelRatio || 1, 2);
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

  function drawSprite(g, spr, li, sx, sy, alpha) {
    var img = S.lit(spr, li);
    if (alpha !== undefined && alpha < 1) { g.globalAlpha = alpha; g.drawImage(img, sx - spr.ax, sy - spr.ay); g.globalAlpha = 1; } else { g.drawImage(img, sx - spr.ax, sy - spr.ay); }
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
        var b = V.brightness(x, y, 0, viewZ);
        drawSprite(g, S.floor(f, L0.fvar[i0]), S.lightIndex(b), sx, sy);
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
          var li = S.lightIndex(br);
          var fade = zz > viewZ ? fadeAlpha(x, y, view) : 1;
          if (zz > 0) {
            var fz = L.floor[ii];
            if (fz) { drawSprite(g, S.floor(fz, L.fvar[ii]), li, bx, by, fade); }
          }
          // paredes
          var wwT = L.ww[ii], wnT = L.wn[ii];
          if (wwT) { drawEdge(g, x, y, zz, 1, wwT, L.wws[ii], bx, by, view, br, fade); }
          if (wnT) { drawEdge(g, x, y, zz, 0, wnT, L.wns[ii], bx, by, view, br, fade); }
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

  /* telhados/andares de cima ficam transparentes perto do jogador (quando ele está do lado de fora) */
  function fadeAlpha(x, y, view) {
    var dx = x + 0.5 - view.px, dy = y + 0.5 - view.py;
    var s = dx + dy, a = dx - dy;
    if (s > -1.5 && s < 13 && a > -5 && a < 5) {
      var k = Math.max(Math.abs(a) / 5, s > 9 ? (s - 9) / 4 : 0);
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
    return s > 0 && s < 7 && Math.abs(dx - dy) < 3.2;
  }

  function drawEdge(g, x, y, z, side, type, style, bx, by, view, br, fade) {
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
    var b2 = V.brightness(ax, ay, z, view.viewZ);
    var b = Math.max(br, b2);
    var spr = S.wall(type, style, side, state, bar, cut, st && st.curtain ? 1 : 0);
    drawSprite(g, spr, S.lightIndex(b), bx, by, fade);
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
