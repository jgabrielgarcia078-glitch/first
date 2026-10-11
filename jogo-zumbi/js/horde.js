/* Grandes hordas: de tempos em tempos um grupo enorme de zumbis atravessa a região. Enquanto está longe é só um
 * ponto que anda (barato); dá para ouvir o coro de gemidos chegando. Quando chega perto do jogador, vira zumbis de
 * verdade andando juntos na mesma direção; se passar longe, se espalha nos quarteirões onde termina. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W;
  var H = {};

  function G() { return CP.Game; }
  function ws() { return G().state.world; }

  H.start = function () {
    var g = G(), p = g.player, w = ws(), HC = C.HORDE;
    var day = g.state.time / 86400;
    var mult = (g.settings && g.settings.popMult) || 1;
    var n = Math.round(Math.min(HC.MAX, HC.BASE + day * HC.PER_DAY) * Math.min(2, mult));
    if (n <= 0) { return null; }
    var a = U.randRange(0, Math.PI * 2), side = U.randRange(-HC.PASS_OFFSET, HC.PASS_OFFSET);
    var lim = C.WORLD_CHUNKS * C.CHUNK - C.CHUNK * 2;
    function cl(v) { return U.clamp(v, C.CHUNK * 2, lim); }
    w.horde = {
      x: cl(p.x + Math.cos(a) * HC.START_DIST - Math.sin(a) * side), y: cl(p.y + Math.sin(a) * HC.START_DIST + Math.cos(a) * side),
      tx: cl(p.x - Math.cos(a) * HC.START_DIST - Math.sin(a) * side), ty: cl(p.y - Math.sin(a) * HC.START_DIST + Math.cos(a) * side),
      n: n, soundT: 2, warned: false, day: day
    };
    return w.horde;
  };

  H.update = function (dt, gameDt) {
    var g = G(), w = ws(), p = g.player, HC = C.HORDE;
    if (!p || p.dead) { return; }
    var day = g.state.time / 86400;
    if (w.nextHorde === undefined) { w.nextHorde = U.randRange(HC.FIRST_MIN, HC.FIRST_MAX); }
    if (!w.horde && day >= w.nextHorde) { w.nextHorde = day + U.randRange(HC.GAP_MIN, HC.GAP_MAX); H.start(); }
    var h = w.horde;
    if (!h) { return; }
    var dx = h.tx - h.x, dy = h.ty - h.y, d = Math.sqrt(dx * dx + dy * dy);
    // anda no tempo do jogo (dormindo, a horda anda 60× mais rápido também)
    var mv = gameDt !== undefined ? gameDt / g.gameSecondsPerReal() : dt;
    if (d > 1) { var st = Math.min(d, HC.SPEED * mv); h.x += dx / d * st; h.y += dy / d * st; }
    var dp = U.dist(h.x, h.y, p.x, p.y);
    h.soundT -= dt;
    if (h.soundT <= 0 && dp < HC.HEAR_DIST) {
      h.soundT = U.randRange(13, 22) * (dp < 50 ? 0.6 : 1);
      var k = U.clamp(1 - dp / HC.HEAR_DIST, 0, 1);
      if (CP.Audio && CP.Audio.hordeMoan) { CP.Audio.hordeMoan(Math.atan2(h.y - p.y, h.x - p.x), dp, k); }
      if (!h.warned) {
        h.warned = true;
        if (CP.UI) { CP.UI.toast('Um gemido coletivo vem de longe... são muitos. Uma horda está passando pela região.', 'danger'); }
        if (CP.Music) { CP.Music.event(); }
      }
    }
    if (dp < C.ZOMBIE.ACTIVE_IN - 6) { H.materialize(h); w.horde = null; return; }
    if (d <= 1) { H.dissolve(h); w.horde = null; }
  };

  /* vira zumbis de verdade em volta do centro, todos andando para o destino */
  H.materialize = function (h) {
    var g = G(), r = Math.sqrt(h.n) * 0.6, made = 0;
    for (var i = 0, tries = 0; made < h.n && tries < h.n * 6; tries++) {
      var a = U.randRange(0, Math.PI * 2), rr = Math.sqrt(U.rand()) * r;
      var x = h.x + Math.cos(a) * rr, y = h.y + Math.sin(a) * rr, tx = Math.floor(x), ty = Math.floor(y);
      if (!W.chunkAt(tx, ty) || !W.tileWalkable(tx, ty, 0) || W.isIndoor(tx, ty, 0)) { continue; }
      var zd = CP.Zombies.makeData(U.rng, x, y, 0, null, null);
      zd.fakeDead = false; zd.horde = true;
      var zb = CP.Zombies.fromData(zd);
      zb.state = 'wander'; zb.target = { x: h.tx + U.randRange(-6, 6), y: h.ty + U.randRange(-6, 6), z: 0 }; zb.memT = C.HORDE.MEMORY_S;
      zb.ang = Math.atan2(h.ty - h.y, h.tx - h.x);
      g.zombies.push(zb);
      made++; i++;
    }
    if (CP.UI && made) { CP.UI.toast('A horda chegou! Saia do caminho ou se esconda.', 'danger'); }
    if (CP.Music) { CP.Music.event(); }
    return made;
  };
  /* passou longe: os zumbis ficam espalhados nos quarteirões onde a horda terminou */
  H.dissolve = function (h) {
    var put = 0;
    for (var i = 0; i < h.n; i++) {
      var x = h.tx + U.randRange(-12, 12), y = h.ty + U.randRange(-12, 12), tx = Math.floor(x), ty = Math.floor(y);
      var ch = W.chunkAt(tx, ty);
      if (!ch || !W.tileWalkable(tx, ty, 0) || W.isIndoor(tx, ty, 0)) { continue; }
      ch.zombies.push(CP.Zombies.makeData(U.rng, x, y, 0, null, null)); ch.saveDirty = true; put++;
    }
    return put;
  };

  CP.Horde = H;
})(window.CP = window.CP || {});
