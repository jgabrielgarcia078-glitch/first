/* Utilidades: RNG com semente, hash, ruído, matemática, fila de prioridade, eventos. */
(function (CP) {
  'use strict';

  var U = {};

  /* ---------- Hash / RNG determinístico ---------- */
  U.hash2 = function (a, b, seed) {
    var h = (seed | 0) ^ 0x9e3779b9;
    h = Math.imul(h ^ (a | 0), 0x85ebca6b);
    h = (h << 13) | (h >>> 19);
    h = Math.imul(h ^ (b | 0), 0xc2b2ae35);
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    h = Math.imul(h, 0x846ca68b);
    h ^= h >>> 16;
    return h >>> 0;
  };
  U.hashStr = function (s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  /* mulberry32 */
  function Rng(seed) { this.s = (seed >>> 0) || 1; }
  Rng.prototype.next = function () {
    var t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
  Rng.prototype.range = function (a, b) { return a + this.next() * (b - a); };
  Rng.prototype.chance = function (p) { return this.next() < p; };
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  Rng.prototype.weighted = function (list) { // [{w:..}, ...] ou [[item, w], ...]
    var total = 0, i;
    for (i = 0; i < list.length; i++) { total += Array.isArray(list[i]) ? list[i][1] : list[i].w; }
    var r = this.next() * total;
    for (i = 0; i < list.length; i++) {
      var w = Array.isArray(list[i]) ? list[i][1] : list[i].w;
      if (r < w) { return Array.isArray(list[i]) ? list[i][0] : list[i]; }
      r -= w;
    }
    return Array.isArray(list[list.length - 1]) ? list[list.length - 1][0] : list[list.length - 1];
  };
  Rng.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  U.Rng = Rng;

  /* RNG global (não determinístico entre partidas, mas salvo no estado para reprodutibilidade de testes) */
  U.rng = new Rng((Date.now() ^ 0x5bd1e995) >>> 0);
  U.rand = function () { return U.rng.next(); };
  U.randRange = function (a, b) { return a + U.rng.next() * (b - a); };
  U.randInt = function (a, b) { return U.rng.int(a, b); };
  U.chance = function (p) { return U.rng.next() < p; };
  U.pick = function (arr) { return U.rng.pick(arr); };

  /* ---------- Ruído de valor 2D (suave) ---------- */
  function smooth(t) { return t * t * (3 - 2 * t); }
  U.valueNoise = function (x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var a = U.hash2(xi, yi, seed) / 4294967296;
    var b = U.hash2(xi + 1, yi, seed) / 4294967296;
    var c = U.hash2(xi, yi + 1, seed) / 4294967296;
    var d = U.hash2(xi + 1, yi + 1, seed) / 4294967296;
    var u = smooth(xf), v = smooth(yf);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  };
  U.fbm = function (x, y, seed, octaves) {
    var sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (var i = 0; i < (octaves || 4); i++) {
      sum += amp * U.valueNoise(x * freq, y * freq, seed + i * 1013);
      norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  };

  /* ---------- Matemática ---------- */
  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.dist = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); };
  U.dist2 = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  U.angleDiff = function (a, b) {
    var d = b - a;
    while (d > Math.PI) { d -= Math.PI * 2; }
    while (d < -Math.PI) { d += Math.PI * 2; }
    return d;
  };
  U.approachAngle = function (cur, target, maxStep) {
    var d = U.angleDiff(cur, target);
    if (Math.abs(d) <= maxStep) { return target; }
    return cur + (d > 0 ? maxStep : -maxStep);
  };
  U.round1 = function (v) { return Math.round(v * 10) / 10; };

  /* ---------- Cores ---------- */
  var colorCache = {};
  U.hexToRgb = function (hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  /* multiplica brilho (f<1 escurece, >1 clareia) */
  U.shade = function (hex, f) {
    var key = hex + '|' + f.toFixed(2);
    var c = colorCache[key];
    if (c) { return c; }
    var rgb = U.hexToRgb(hex);
    var r, g, b;
    if (f <= 1) { r = rgb[0] * f; g = rgb[1] * f; b = rgb[2] * f; } else {
      var t = f - 1;
      r = rgb[0] + (255 - rgb[0]) * t; g = rgb[1] + (255 - rgb[1]) * t; b = rgb[2] + (255 - rgb[2]) * t;
    }
    c = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
    colorCache[key] = c;
    return c;
  };
  U.mix = function (hexA, hexB, t) {
    var a = U.hexToRgb(hexA), b = U.hexToRgb(hexB);
    var r = Math.round(a[0] + (b[0] - a[0]) * t), g = Math.round(a[1] + (b[1] - a[1]) * t), bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  };

  /* ---------- Fila de prioridade (heap mínimo) ---------- */
  function Heap() { this.items = []; this.prio = []; }
  Heap.prototype.push = function (item, p) {
    var it = this.items, pr = this.prio;
    it.push(item); pr.push(p);
    var i = it.length - 1;
    while (i > 0) {
      var parent = (i - 1) >> 1;
      if (pr[parent] <= pr[i]) { break; }
      var t = it[i]; it[i] = it[parent]; it[parent] = t;
      var tp = pr[i]; pr[i] = pr[parent]; pr[parent] = tp;
      i = parent;
    }
  };
  Heap.prototype.pop = function () {
    var it = this.items, pr = this.prio;
    var top = it[0];
    var lastI = it.pop(), lastP = pr.pop();
    if (it.length > 0) {
      it[0] = lastI; pr[0] = lastP;
      var i = 0, n = it.length;
      for (;;) {
        var l = i * 2 + 1, r = l + 1, m = i;
        if (l < n && pr[l] < pr[m]) { m = l; }
        if (r < n && pr[r] < pr[m]) { m = r; }
        if (m === i) { break; }
        var t = it[i]; it[i] = it[m]; it[m] = t;
        var tp = pr[i]; pr[i] = pr[m]; pr[m] = tp;
        i = m;
      }
    }
    return top;
  };
  Heap.prototype.size = function () { return this.items.length; };
  U.Heap = Heap;

  /* ---------- Barramento de eventos simples ---------- */
  var listeners = {};
  U.on = function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); };
  U.emit = function (name, data) {
    var l = listeners[name];
    if (!l) { return; }
    for (var i = 0; i < l.length; i++) { l[i](data); }
  };

  /* ---------- Texto ---------- */
  U.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  U.fmtKg = function (kg) { return (Math.round(kg * 100) / 100).toString().replace('.', ',') + ' kg'; };
  U.escapeHtml = function (s) {
    return String(s).replace(/[&<>"']/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]; });
  };
  U.uid = (function () { var n = 0; return function () { n++; return Date.now().toString(36) + n.toString(36) + Math.floor(Math.random() * 1e6).toString(36); }; })();

  CP.U = U;
})(window.CP = window.CP || {});
