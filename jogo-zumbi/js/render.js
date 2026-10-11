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
  var FULL = lcode(S.LIGHT_STEPS.length - 1, S.LIGHT_STEPS.length - 1, 0);
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
  /* interior de outra construção fora da sua visão: não é desenhado (preto, como no original) */
  function voidAt(x, y, z, view) {
    if (view.noCut || V.isVisible(x, y, z) || !W.isIndoor(x, y, z)) { return false; }
    return W.building(x, y, z) !== view.bld || z !== view.viewZ;
  }
  /* luz + névoa do tile (x, y, z) vista do andar viewZ */
  function tileCode(x, y, z, viewZ) {
    if (z > viewZ) { return S.lightIndex(V.brightness(x, y, z, viewZ)); }
    if (z < viewZ) { var lb = S.lightIndex(V.brightness(x, y, z, viewZ)); return lcode(lb, lb, 4); }
    var lv = V.lightAt(x, y, z);
    var n = (V.isVisible(x + 1, y, z) ? 1 : 0) + (V.isVisible(x - 1, y, z) ? 1 : 0) + (V.isVisible(x, y + 1, z) ? 1 : 0) + (V.isVisible(x, y - 1, z) ? 1 : 0);
    var q = V.isVisible(x, y, z) ? (n >= 4 ? 0 : 1) : (n >= 2 ? 2 : (n === 1 ? 3 : 4));
    var lv0 = S.lightIndex(lv);
    return lcode(lv0, lv0, q);
  }

  /* ---------- quadro ---------- */
  R.draw = function (view) {
    var sn = CP.Time && CP.Game && CP.Game.running ? CP.Time.season() : 'Verão';
    R.season = { 'Verão': 0, 'Outono': 1, 'Inverno': 2, 'Primavera': 3 }[sn] || 0;
    var Am = CP.Amb;
    var ero = R.ero = Am && CP.Game && CP.Game.running ? Am.erosion() : 0;
    var snow = R.snow = Am && CP.Game && CP.Game.running ? Am.snow() : 0;
    R.wind = Am && CP.Game && CP.Game.running ? Am.wind() : 0;
    var roofSnow = snow > 0.7 ? 2 : (snow > 0.3 ? 1 : 0);
    R.treeSeason = R.season === 2 && snow > 0.35 ? 4 : R.season;
    R.nightPower = !!(CP.Time && CP.Game && CP.Game.running && CP.Time.isNight() && CP.Time.powerOn());
    var t0 = performance.now();
    S.frame++;
    if (S.frame % 300 === 0) { S.sweep(); }
    var g = R.g;
    var z = R.zoom, dpr = R.dpr;
    var shx = R.shakeX || 0, shy = R.shakeY || 0;
    var camSX = wsx(R.camX + shx, R.camY + shy), camSY = wsy(R.camX + shx, R.camY + shy, R.camZ);
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
        if (voidAt(x, y, 0, view)) { continue; } // interior que você não está vendo: fica preto
        var lia = tileCode(x, y, 0, viewZ);
        var outd = !L0.room[i0];
        var sst = snow > 0.02 && outd ? snowStage(f, x, y, snow, i0) : 0;
        var fvv = fv(f, L0.fvar[i0], x, y);
        if (sst === 3) { drawSprite(g, S.snowTile(3, fvv & 3), lia, sx, sy); } else {
          var ov = outd ? erosionAt(f, x, y, ero) : -1;
          drawSprite(g, ov >= 0 || sst ? S.floorOv(f, fvv, ov, sst) : S.floor(f, fvv), lia, sx, sy);
          if (!sst) { var lk = litterAt(f, x, y); if (lk >= 0) { drawSprite(g, S.litter(lk, (x * 7 + y * 3) & 3), lia, sx, sy); } }
        }
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
          var vd = zz <= viewZ && voidAt(x, y, zz, view);
          if (zz > 0 && !vd) {
            var fz = L.floor[ii];
            if (fz === F.ROOF) {
              var rcd = roofCode(ch, zz, ii); drawSprite(g, S.roof(rcd, roofSnow), li, bx, by, fade); chimney(g, rcd, x, y, bx, by, li, fade);
              var sgn = signAt(ch, zz, ii);
              if (sgn) { drawSprite(g, sgn.spr, li, sgn.bx, sgn.by, fade); }
            } else if (fz) { drawSprite(g, S.floor(fz, fv(fz, L.fvar[ii], x, y)), li, bx, by, fade); }
          }
          // paredes
          var wwT = L.ww[ii], wnT = L.wn[ii];
          if (wwT) { drawEdge(g, x, y, zz, 1, wwT, L.wws[ii], bx, by, view, li, fade); }
          if (wnT) { drawEdge(g, x, y, zz, 0, wnT, L.wns[ii], bx, by, view, li, fade); }
          // objeto
          var o = L.obj[ii];
          if (o && !vd) { drawObject(g, x, y, zz, o, L.odir[ii], bx, by, li, view, ch); if (o === O.POWER_POLE) { poles.push(x, y, L.odir[ii], li); } }
          if (ch.fires[zz * AREA + ii] && !vd) { drawFlame(g, bx, by, x * 7 + y * 13, 1); }
          // itens no chão
          var its = ch.items[zz * AREA + ii];
          if (its && its.length && !vd) { drawSprite(g, S.groundItems(its.length), li, bx, by); }
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
    drawWires(g, poles, view);
    poles.length = 0;
    // sobreposições (efeitos, mira, textos)
    for (n = 0; n < R.overlays.length; n++) { R.overlays[n](g); }
    if (view.overlay) { view.overlay(g); }
    R.stats.tiles = tiles; R.stats.ents = ents.length;
    R.stats.ms = performance.now() - t0;
  };

  /* número pseudoaleatório 0..1 fixo por posição */
  function hash01(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }
  R.hash01 = hash01;
  /* neve num tile ao ar livre: 0 nada, 1 salpicada, 2 manchas, 3 coberto (manchas maiores que um tile) */
  function snowStage(f, x, y, snow, i) {
    if (f === F.WATER || f === F.ROOF) { return 0; }
    if (snow >= 0.9) { return 3; }
    // ruído suave por chunk (calculado uma vez): a neve fica em manchas grandes, não em xadrez
    var ch = W.chunkAt(x, y);
    var nz = ch._snowN;
    if (!nz) {
      nz = ch._snowN = new Float32Array(AREA);
      for (var k = 0; k < AREA; k++) { var wx = ch.cx * C.CHUNK + (k % C.CHUNK), wy = ch.cy * C.CHUNK + ((k / C.CHUNK) | 0); nz[k] = U.fbm(wx * 0.13, wy * 0.13, 515, 2) * 0.8 + hash01(wx, wy, 17) * 0.2; }
    }
    var v = snow * 1.8 + 0.25 - nz[i] * 1.7;
    return v > 0.6 ? 3 : (v > 0.38 ? 2 : (v > 0.15 ? 1 : 0));
  }
  /* mato avançando com o tempo: [densidade máxima, tipo (0 rachadura, 1 gramado alto, 2 capim)] por piso */
  var ERO = [];
  ERO[F.ASPHALT] = [0.4, 0]; ERO[F.ASPHALT_LINE] = [0.3, 0]; ERO[F.SIDEWALK] = [0.6, 0]; ERO[F.CONCRETE] = [0.5, 2]; ERO[F.GRAVEL] = [0.7, 2];
  ERO[F.DIRT] = [0.6, 2]; ERO[F.GRASS] = [1, 1]; ERO[F.DARKGRASS] = [0.9, 1]; ERO[F.DECK] = [0.35, 2]; ERO[F.SAND] = [0.25, 2];
  function erosionAt(f, x, y, e) {
    var E2 = ERO[f];
    if (!E2 || e <= 0) { return -1; }
    var dens = E2[0] * e, h = hash01(x, y, 5);
    if (h >= dens) { return -1; }
    var st = 1 + Math.min(2, Math.floor((1 - h / dens) * 3 * Math.min(1, e * 1.5)));
    var kind = E2[1];
    if (kind === 0 && f === F.SIDEWALK && hash01(x, y, 9) < 0.4) { kind = 2; }
    return kind * 4 + st;
  }
  R.erosionAt = erosionAt;
  R.snowStage = snowStage;

  /* letreiros de loja no alto da fachada (calculados uma vez por chunk a partir dos prédios) */
  var SIGN_TEXT = {
    grocery: ['MERCADO', 'SUPERMERCADO', 'MERCEARIA'], pharmacy: ['FARMÁCIA', 'DROGARIA'], hardware: ['FERRAGENS', 'MATERIAIS'],
    diner: ['LANCHONETE', 'DINER', 'CAFÉ & GRILL'], clothes: ['ROUPAS', 'MODAS', 'BOUTIQUE'], bar: ['BAR', 'TAVERNA', 'SALOON'],
    office: ['ESCRITÓRIO', 'CONTABILIDADE', 'IMOBILIÁRIA'], gunstore: ['ARMAS & CAÇA', 'ARMARIA'], bookstore: ['LIVRARIA', 'SEBO'],
    electronics: ['ELETRÔNICOS', 'TV & SOM'], police: ['DELEGACIA'], clinic: ['CLÍNICA', 'POSTO DE SAÚDE'], gas: ['POSTO', 'CONVENIÊNCIA'], warehouse: ['DEPÓSITO']
  };
  var OWNERS = ['DO JOE', 'DA MARTHA', 'DO HANK', 'DA DOT', 'DO OTIS', 'DO BUD'];
  R.signText = function (b) {
    var list = SIGN_TEXT[b.kind];
    if (!list) { return null; }
    var h = (b.x * 73856093 ^ b.y * 19349663) >>> 0;
    var text = list[h % list.length];
    if ((b.kind === 'grocery' || b.kind === 'diner' || b.kind === 'bar') && (h >>> 5) % 3 === 0) { text += ' ' + OWNERS[(h >>> 8) % OWNERS.length]; }
    return text;
  };
  function computeSigns(ch) {
    var m = new Map(), N = C.CHUNK;
    ch.buildings.forEach(function (b) {
      var text = R.signText(b);
      if (!text || !b.door || b.kind === 'barn') { return; }
      var h = (b.x * 73856093 ^ b.y * 19349663) >>> 0;
      var d = b.door, axis = d.side;
      var ix = d.x, iy = d.y;
      if (!(ix >= b.x && ix < b.x + b.w && iy >= b.y && iy < b.y + b.h)) { if (d.side === 0) { iy = d.y - 1; } else { ix = d.x - 1; } }
      var lo = axis === 0 ? b.x : b.y, hi = axis === 0 ? b.x + b.w : b.y + b.h;
      var len = Math.max(2, Math.min(4, hi - lo - 1));
      var cu = (axis === 0 ? d.x : d.y) + 1;
      var u0 = Math.min(Math.max(lo, Math.round(cu - len / 2)), hi - len);
      var z = b.floors || 1;
      var wx = axis === 0 ? u0 : d.x, wy = axis === 0 ? d.y : u0;
      var ex = axis === 0 ? u0 + len - 1 : ix, ey = axis === 0 ? iy : u0 + len - 1;
      if ((ex >> W.chunkShift) !== ch.cx || (ey >> W.chunkShift) !== ch.cy || z >= C.LEVELS) { return; }
      var spr = S.facadeSign(text, (h >>> 3) % S.SIGN_COLS, axis, len);
      m.set(z * AREA + W.idx(ex, ey), { spr: spr, bx: HW * (wx - wy), by: HH * (wx + wy) - z * WH, b: b, text: text });
    });
    return m;
  }
  function signAt(ch, z, i) {
    if (!ch._signs) { ch._signs = computeSigns(ch); }
    return ch._signs.size ? ch._signs.get(z * AREA + i) : null;
  }
  R.signAt = signAt;

  /* pichações nas fachadas (calculadas uma vez por chunk; só nas faces externas voltadas para a câmera) */
  var GRAFF_P = { survivor: 0.75, party: 0.6, goodbye: 0.55 };
  function graffEdgeOk(x, y, side, ch) {
    if ((x >> W.chunkShift) !== ch.cx || (y >> W.chunkShift) !== ch.cy) { return false; }
    if (side === 0) { return W.wn(x, y, 0) === E.WALL && !W.isIndoor(x, y, 0) && W.isIndoor(x, y - 1, 0); }
    return W.ww(x, y, 0) === E.WALL && !W.isIndoor(x, y, 0) && W.isIndoor(x - 1, y, 0);
  }
  function computeGraffiti(ch) {
    var m = new Map();
    if (!CP.Notes) { return m; }
    ch.buildings.forEach(function (b) {
      if (b.story === 'burnt' || b.kind === 'barn') { return; }
      var h = ((b.x * 2654435761) ^ (b.y * 40503) ^ 0x5bd1) >>> 0;
      var isStore = !!SIGN_TEXT[b.kind] && b.kind !== 'police' && b.kind !== 'clinic';
      var kind = GRAFF_P[b.story] ? b.story : (isStore ? 'store' : 'generic');
      var pr = GRAFF_P[b.story] || (isStore ? 0.4 : 0.2);
      if ((h % 1000) / 1000 >= pr) { return; }
      var text = CP.Notes.graffiti(h >>> 10, kind);
      var len = text.length <= 3 ? 1 : (text.length <= 9 ? 2 : 3);
      var sides = (h >>> 4) & 1 ? [0, 1] : [1, 0];
      for (var si = 0; si < 2; si++) {
        var side = sides[si], n = side === 0 ? b.w : b.h, starts = [], run = 0;
        for (var u = 0; u < n; u++) {
          var x = side === 0 ? b.x + u : b.x + b.w, y = side === 0 ? b.y + b.h : b.y + u;
          run = graffEdgeOk(x, y, side, ch) ? run + 1 : 0;
          if (run >= len) { starts.push(u - len + 1); }
        }
        if (!starts.length) { continue; }
        var u0 = starts[(h >>> 7) % starts.length];
        var spr = S.graffiti(text, side, len, (h >>> 12) % S.GRAFF_COLS);
        for (var t = 0; t < len; t++) {
          var tx = side === 0 ? b.x + u0 + t : b.x + b.w, ty = side === 0 ? b.y + b.h : b.y + u0 + t;
          m.set(W.idx(tx, ty) * 2 + side, { spr: spr[t], text: text });
        }
        return;
      }
    });
    return m;
  }
  function graffAt(x, y, side) {
    var ch = W.chunkAt(x, y);
    if (!ch) { return null; }
    if (!ch._graff) { ch._graff = computeGraffiti(ch); }
    return ch._graff.size ? ch._graff.get(W.idx(x, y) * 2 + side) : null;
  }
  R.graffitiAt = function (x, y, z, side) { if (z !== 0) { return null; } var gf = graffAt(x, y, side); return gf ? gf.text : null; };

  /* variação de textura por posição nos pisos "naturais" (a cor continua vindo de fvar) */
  var NATURAL = [];
  [F.GRASS, F.DARKGRASS, F.DIRT, F.ASPHALT, F.SIDEWALK, F.SAND, F.GRAVEL, F.CONCRETE, F.FIELD, F.WOOD, F.CARPET, F.TILE, F.LINOLEUM].forEach(function (f) { NATURAL[f] = 1; });
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

  /* fios entre postes de fiação vizinhos (10 tiles) — por cima de tudo, com barriga */
  var poles = [];
  function drawWires(g, list, view) {
    if (!list.length) { return; }
    g.save();
    for (var i = 0; i < list.length; i += 4) {
      var x = list[i], y = list[i + 1], dir = list[i + 2];
      var nx = dir === 1 ? x : x + 10, ny = dir === 1 ? y + 10 : y;
      if (W.obj(nx, ny, 0) !== O.POWER_POLE) { continue; }
      var dark = Math.min(1, (list[i + 3] & 15) / 8);
      g.strokeStyle = 'rgba(20,20,22,' + (0.35 + 0.4 * dark).toFixed(2) + ')'; g.lineWidth = 1;
      for (var k = -1; k <= 1; k++) {
        var ox = dir === 1 ? k * 0.3 : 0, oy = dir === 1 ? 0 : k * 0.3;
        var ax = HW * ((x + 0.5 + ox) - (y + 0.5 + oy)), ay = HH * ((x + 0.5 + ox) + (y + 0.5 + oy)) - 190;
        var bx = HW * ((nx + 0.5 + ox) - (ny + 0.5 + oy)), by = HH * ((nx + 0.5 + ox) + (ny + 0.5 + oy)) - 190;
        g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + 26, bx, by); g.stroke();
      }
    }
    g.restore();
  }
  /* chaminé de tijolo em alguns tiles da cumeeira */
  function chimney(g, code, x, y, bx, by, li, fade) {
    var kind = code & 3, p = ((code >>> 14) & 63) * 2;
    if (!(kind === 1 || kind === 2) || p < 20) { return; }
    var h = (x * 73856093 ^ y * 19349663) >>> 0;
    if (h % 13 !== 0) { return; }
    drawSprite(g, S.chimney(), li, bx, by - p + 6, fade);
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
      var bk = z > 0 ? W.building(ch.cx * N + lx, ch.cy * N + ly, z - 1) : null;
      var flatB = bk && bk.kind !== 'house' && bk.kind !== 'barn';
      if (small > C.ROOF_PITCH_MAX || small < 3 || flatB) {
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
    var curt = st ? (st.curtain ? 1 : (st.hasCurt ? 2 : 0)) : 0;
    var spr = S.wall(type, style, side, state, bar, cut, curt, (grime >>> 7) % 3);
    drawSprite(g, spr, c, bx, by, fade);
    if (cut) { return; }
    // janela acesa à noite: cômodo com luz e energia, sem cortina fechada nem tábuas
    if (type === E.WINDOW && R.nightPower && curt !== 1 && bar < 3 && state !== 2) {
      var inX = W.isIndoor(x, y, z) ? x : ax, inY = W.isIndoor(x, y, z) ? y : ay, rm = W.room(inX, inY, z);
      if (rm && rm.lit && CP.Time.powerAt(inX, inY) && W.building(inX, inY, z) !== view.bld) { drawSprite(g, S.windowGlow(side, curt), FULL, bx, by, fade); }
    }
    if (st && st.note && type === E.DOOR && state === 0) { drawSprite(g, S.doorNote(side), c, bx, by, fade); }
    // face externa voltada para a câmera: pichações, trepadeiras (erosão) e toldos de loja
    var outFace = !W.isIndoor(x, y, z) && W.isIndoor(ax, ay, z);
    if (!outFace) { return; }
    if (type === E.WALL && z === 0) { var gf = graffAt(x, y, side); if (gf) { drawSprite(g, gf.spr, c, bx, by, fade); } }
    if (type === E.WALL && R.ero > 0.15) {
      var vd = (R.ero - 0.15) * 0.45, vh = hash01(x, y, 31 + side);
      if (vh < vd) { drawSprite(g, S.vines(side, 1 + Math.min(2, Math.floor((1 - vh / vd) * 3 * Math.min(1, R.ero))), (x + y) & 3), c, bx, by, fade); }
    }
    if (z === 0 && (type === E.WINDOW || type === E.DOOR) && C.WALL_STYLES[style] && C.WALL_STYLES[style].store) {
      var ab = W.building(ax, ay, 0);
      var ah = ab ? ((ab.x * 7 + ab.y * 13) >>> 0) : 0;
      if (ah % 10 < 7) { drawSprite(g, S.awning(side, (ah >>> 2) % 6), c, bx, by, fade); }
    }
  }

  /* quanto cada planta/objeto leve balança com o vento */
  var SWAY = [];
  SWAY[O.TREE] = 0.05; SWAY[O.TREE_PINE] = 0.035; SWAY[O.BUSH] = 0.08; SWAY[O.TALL_GRASS] = 0.2; SWAY[O.FLOWERBED] = 0.12; SWAY[O.CROP] = 0.14; SWAY[O.CLOTHESLINE] = 0.05;
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
      spr = S.obj(o, dir, (o === O.TREE || o === O.TREE_PINE) ? R.treeSeason : 0);
    }
    var alpha;
    var info = OI[o];
    if (info.h > 0.8 && z === view.viewZ) {
      var dx = x + 0.5 - view.px, dy = y + 0.5 - view.py;
      var s = dx + dy;
      if (s > 0 && s < (info.tree ? 7 : 3) && Math.abs(dx - dy) < (info.tree ? 3.5 : 2)) { alpha = info.tree ? 0.38 : 0.55; }
    }
    // vento: escolhe uma das versões inclinadas (pré-desenhadas) mais perto da inclinação deste quadro
    var lean = SWAY[o] && R.wind > 0.03 && o !== O.CROP ? Math.max(-2, Math.min(2, Math.round(CP.Amb.sway(x, y, SWAY[o]) / SWAY[o] * 2))) : 0;
    if (lean) { spr = S.objLean(o, dir, (o === O.TREE || o === O.TREE_PINE) ? R.treeSeason : 0, lean, SWAY[o] * 0.5); }
    drawSprite(g, spr, li, bx, by, alpha);
    if (o === O.CAMPFIRE && !(dir & 4)) { drawFlame(g, bx, by, 0, 0); }
  }
  /* chamas: big = incêndio (várias línguas de fogo espalhadas no tile) */
  function drawFlame(g, bx, by, seed, big) {
    var t = performance.now() / 120;
    var tongues = big ? 4 : 1;
    for (var k = 0; k < tongues; k++) {
      var ox = big ? ((seed * (k + 3) * 7) % 30) - 15 : 0, oy = big ? ((seed * (k + 5) * 3) % 12) - 6 : 0, sc = big ? 1.2 + ((seed + k) % 3) * 0.35 : 1;
      var c = [bx + ox, by + HH + oy];
      for (var i = 0; i < 3; i++) {
        var hgt = (14 + Math.sin(t + i * 2 + k * 1.7) * 4) * sc;
        g.fillStyle = ['rgba(255,190,60,0.9)', 'rgba(255,120,30,0.85)', 'rgba(255,240,150,0.9)'][i];
        g.beginPath();
        g.moveTo(c[0] - (7 - i * 3) * sc, c[1]); g.quadraticCurveTo(c[0] + Math.sin(t + i + k) * 4 * sc, c[1] - hgt * 1.6, c[0] + (7 - i * 3) * sc, c[1]);
        g.fill();
      }
    }
  }

  CP.Render = R;
})(window.CP = window.CP || {});
