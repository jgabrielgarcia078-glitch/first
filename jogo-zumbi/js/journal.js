/* Diário do sobrevivente: mortes por tipo de arma, lugares visitados, linha do tempo de acontecimentos e a lista de
 * todos os sobreviventes que já passaram por este mundo (com causa da morte). Tecla J abre o painel. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, D = CP.D;
  var J = { scanT: 0 };
  function G() { return CP.Game; }
  /* nome do tipo de arma para a contagem de mortes */
  var WEAPON_KIND = { blunt_long: 'Arma de impacto longa', blunt_short: 'Arma de impacto curta', axe: 'Machado', spear: 'Lança', blade_short: 'Faca', blade_long: 'Lâmina longa' };
  var CAUSE_KIND = { gun: 'Arma de fogo', car: 'Atropelado', stealth: 'Por trás, em silêncio', fire: 'Fogo', stomp: 'Pisão', shove: 'Empurrão' };
  /* lugares que contam como "visitados" (tipo da construção) */
  var PLACE_NAMES = { school: 'Escola', cityhall: 'Prefeitura', hospital: 'Hospital', mall: 'Shopping', military: 'Base militar', police: 'Delegacia', clinic: 'Clínica', warehouse: 'Depósito', grocery: 'Mercado', pharmacy: 'Farmácia', hardware: 'Loja de ferragens', gas: 'Posto de gasolina', bar: 'Bar', diner: 'Lanchonete', church: 'Igreja', electronics: 'Loja de eletrônicos', clothes: 'Loja de roupas', gunstore: 'Loja de armas', office: 'Escritório', bookstore: 'Livraria', farm: 'Fazenda', barn: 'Celeiro', house: 'Casa' };
  J.PLACE_NAMES = PLACE_NAMES;

  function jr(p) {
    if (!p.journal) { p.journal = { kills: {}, places: {}, towns: {}, events: [] }; }
    return p.journal;
  }
  J.of = jr;
  /* acontecimento na linha do tempo (dia e hora do jogo) */
  J.event = function (text, p) {
    p = p || G().player;
    if (!p) { return; }
    var j = jr(p), T = CP.Time;
    j.events.push({ d: Math.floor(T.daysSurvived()) + 1, h: Math.floor(T.hourOfDay()), t: String(text) });
    if (j.events.length > C.JOURNAL.MAX_EVENTS) { j.events.splice(0, j.events.length - C.JOURNAL.MAX_EVENTS); }
  };
  J.killKind = function (p, cause) {
    if (CAUSE_KIND[cause]) { return CAUSE_KIND[cause]; }
    var wl = p.hand1 ? D.weaponLook(p.hand1.id) : null;
    return wl && WEAPON_KIND[wl] ? WEAPON_KIND[wl] : (wl ? 'Outra arma' : 'Mãos nuas');
  };
  J.onKill = function (cause) {
    var p = G().player;
    if (!p || p.dead) { return; }
    var j = jr(p), k = J.killKind(p, cause);
    j.kills[k] = (j.kills[k] || 0) + 1;
    if (p.kills === 1) { J.event('Matou o primeiro zumbi (' + k.toLowerCase() + ').'); }
    if (p.kills > 0 && p.kills % 50 === 0) { J.event(p.kills + ' zumbis mortos.'); }
  };
  /* lugar onde o jogador está agora: construção (por tipo) e cidade */
  J.scan = function (p) {
    var j = jr(p), z = W.levelOf(p.z), x = Math.floor(p.x), y = Math.floor(p.y);
    if (W.isIndoor(x, y, z)) {
      var b = W.building(x, y, z), kind = b && b.kind;
      if (kind && PLACE_NAMES[kind] && !j.places[kind]) {
        j.places[kind] = Math.floor(CP.Time.daysSurvived()) + 1;
        if (kind !== 'house') { J.event('Entrou pela primeira vez: ' + PLACE_NAMES[kind] + '.'); }
      }
    }
    var m = W.macro, sh = W.chunkShift, N = m.n || Math.round(Math.sqrt(m.feature.length)), cx = x >> sh, cy = y >> sh;
    var tid = m.townId ? m.townId[cy * N + cx] : 0;
    if (tid && m.towns[tid - 1] && !j.towns[tid]) { j.towns[tid] = Math.floor(CP.Time.daysSurvived()) + 1; J.event('Chegou em ' + m.towns[tid - 1].name + '.'); }
    var day = Math.floor(CP.Time.daysSurvived());
    if (day > 0 && day % 7 === 0 && j.lastWeek !== day) { j.lastWeek = day; J.event('Sobreviveu ' + (day / 7 === 1 ? 'uma semana' : (day / 7) + ' semanas') + '.'); }
  };
  J.update = function (dt) {
    var p = G().player;
    if (!p || p.dead) { return; }
    J.scanT -= dt;
    if (J.scanT <= 0) { J.scanT = C.JOURNAL.SCAN_S; J.scan(p); }
  };
  /* registro de quem já viveu (e morreu) neste mundo */
  J.recordDeath = function (p) {
    var st = G().state;
    st.survivorsLog = st.survivorsLog || [];
    var start = p.startT || 0;
    st.survivorsLog.push({ name: p.name, occ: p.occupation, kills: p.kills, days: Math.round((st.time - start) / 86400 * 10) / 10, cause: p.deathCause, endDay: Math.floor(st.time / 86400) + 1 });
    J.event('Morreu: ' + p.deathCause + '.', p);
  };
  J.survivors = function () {
    var st = G().state, list = (st.survivorsLog || []).slice(), p = G().player;
    if (p && !p.dead) { list.push({ name: p.name, occ: p.occupation, kills: p.kills, days: Math.round((st.time - (p.startT || 0)) / 86400 * 10) / 10, alive: true }); }
    return list;
  };
  J.reset = function () { J.scanT = 0; };

  U.on('zombie:killed', function (e) { J.onKill(e && e.cause); });
  CP.Journal = J;
})(window.CP = window.CP || {});
