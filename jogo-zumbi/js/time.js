/* Tempo do mundo: relógio, calendário, estações, clima, luz, energia/água e eventos (helicóptero, sons, alarmes, rádio). */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, D = CP.D;
  var EV = C.EVENTS, WE = C.WEATHER, O = C.OBJ;

  var T = {};
  var WEATHERS = {
    clear: { name: 'Céu limpo', amb: 1, rain: 0, temp: 1 },
    cloudy: { name: 'Nublado', amb: 0.86, rain: 0, temp: -1 },
    rain: { name: 'Chuva', amb: 0.7, rain: 0.6, temp: -3 },
    storm: { name: 'Tempestade', amb: 0.55, rain: 1, temp: -4 },
    fog: { name: 'Neblina', amb: 0.78, rain: 0, temp: -2, fog: true, vis: 0.7 },
    snow: { name: 'Neve', amb: 0.8, rain: 0.4, temp: -6, snow: true },
    blizzard: { name: 'Nevasca', amb: 0.6, rain: 1, temp: -13, snow: true, blizzard: true, vis: 0.45 }
  };
  T.WEATHERS = WEATHERS;

  T.newWorldState = function (seed) {
    var rng = new U.Rng(seed ^ 0x77e);
    return {
      powerOffDay: rng.int(EV.POWER_OFF_MIN_DAY, EV.POWER_OFF_MAX_DAY),
      waterOffDay: rng.int(EV.WATER_OFF_MIN_DAY, EV.WATER_OFF_MAX_DAY),
      heliDay: rng.int(EV.HELI_MIN_DAY, EV.HELI_MAX_DAY), heliHour: rng.range(9, 16), heliDone: false,
      weather: { type: 'clear', until: rng.range(4, 12) },
      nextMeta: rng.range(6, 20),
      announced: {},
      alarms: [],
      heli: null,
      lastHourTick: 0,
      lastDayTick: 0,
      tvSeen: {}
    };
  };

  function G() { return CP.Game; }
  function ws() { return G().state.world; }
  T.hours = function () { return G().state.time / 3600; };
  T.date = function () { return new Date(G().state.startDate + G().state.time * 1000); };
  T.hourOfDay = function () { var d = T.date(); return d.getUTCHours() + d.getUTCMinutes() / 60; };
  T.day = function () { return Math.floor((G().state.time + C.START_HOUR * 3600) / 86400); };
  T.daysSurvived = function () { return G().state.time / 86400; };
  T.dayOfYear = function () { var d = T.date(); var s = Date.UTC(d.getUTCFullYear(), 0, 1); return Math.floor((d.getTime() - s) / 86400000); };
  T.season = function () {
    if (G().settings && G().settings.challenge === 'winter') { return 'Inverno'; }
    var m = T.date().getUTCMonth();
    if (m >= 5 && m <= 7) { return 'Verão'; }
    if (m >= 8 && m <= 10) { return 'Outono'; }
    if (m === 11 || m <= 1) { return 'Inverno'; }
    return 'Primavera';
  };
  T.clockText = function () {
    var d = T.date();
    return U.pad2(d.getUTCHours()) + ':' + U.pad2(d.getUTCMinutes());
  };
  T.dateText = function () {
    var d = T.date();
    return C.WEEKDAYS[d.getUTCDay()] + ', ' + d.getUTCDate() + ' de ' + C.MONTH_NAMES[d.getUTCMonth()] + ' de ' + d.getUTCFullYear();
  };

  /* ---------- energia / água ---------- */
  T.powerOn = function () { return T.daysSurvived() < ws().powerOffDay; };
  T.waterOn = function () { return T.daysSurvived() < ws().waterOffDay; };
  /* energia local (gerador ligado perto) */
  T.powerAt = function (x, y) {
    if (T.powerOn()) { return true; }
    var gens = ws().generators || [];
    for (var i = 0; i < gens.length; i++) {
      var g = gens[i];
      if (g.on && g.fuel > 0 && U.dist2(g.x, g.y, x, y) < 20 * 20) { return true; }
    }
    return false;
  };

  /* ---------- clima ---------- */
  T.weather = function () { return WEATHERS[ws().weather.type] || WEATHERS.clear; };
  T.raining = function () { return T.weather().rain > 0; };
  T.rainIntensity = function () { return T.weather().rain; };
  T.temperature = function (outdoor) {
    var doy = T.dayOfYear();
    // pico do verão ~ dia 200, inverno ~ dia 15
    var k = G().settings && G().settings.challenge === 'winter' ? 0 : (Math.cos((doy - 200) / 365 * Math.PI * 2) + 1) / 2;
    var base = U.lerp(WE.BASE_TEMP_WINTER, WE.BASE_TEMP_SUMMER, k);
    var h = T.hourOfDay();
    var swing = Math.cos((h - 15) / 24 * Math.PI * 2) * WE.DAILY_SWING;
    var t = base + swing + T.weather().temp + (ws().weather.tempOff || 0) + (G().settings && G().settings.challenge === 'winter' ? C.CHALLENGES.winter.temp : 0);
    if (outdoor) { return t; }
    if (T.powerOn()) { return 21; }
    return U.lerp(t, 17, 0.45);
  };
  function nextWeather(rng) {
    var season = T.season();
    var opts = season === 'Inverno' ? [['clear', 3], ['cloudy', 4], ['snow', 3], ['blizzard', 0.9], ['fog', 1.5], ['rain', 1]] : (season === 'Outono' ? [['clear', 3], ['cloudy', 4], ['rain', 3], ['storm', 1], ['fog', 2]] : [['clear', 6], ['cloudy', 3], ['rain', 2], ['storm', 0.8], ['fog', 1]]);
    return rng.weighted(opts);
  }

  /* ---------- luz ---------- */
  T.ambient = function () {
    var dl = CP.Vis.daylight(T.hourOfDay());
    return Math.max(0.2, dl * T.weather().amb);
  };
  /* nevasca e neblina encurtam a visão (sua e dos zumbis) */
  T.visionMult = function () { var p = G().player; if (!p || W.isIndoor(Math.floor(p.x), Math.floor(p.y), W.levelOf(p.z))) { return 1; } return T.weather().vis || 1; };
  T.isNight = function () { return T.ambient() < 0.45; };
  /* janela de cômodo aceso joga um pouco de luz quente para fora */
  function windowLight(out, x, y, z) {
    for (var side = 0; side < 2; side++) {
      if (W.edgeType(x, y, z, side) !== C.EDGE.WINDOW) { continue; }
      var ax = side === 0 ? x : x - 1, ay = side === 0 ? y - 1 : y;
      var inA = W.isIndoor(x, y, z), inB = W.isIndoor(ax, ay, z);
      if (inA === inB) { continue; }
      var st = W.edgeState(x, y, z, side);
      if (st && (st.curtain || st.bar >= 3)) { continue; }
      var rm = inA ? W.room(x, y, z) : W.room(ax, ay, z);
      if (!rm || !rm.lit || !T.powerAt(x, y)) { continue; }
      var outX = inA ? ax : x, outY = inA ? ay : y;
      out.push({ x: outX + 0.5, y: outY + 0.5, z: z, r: 2.6, i: 0.6, indoor: false });
    }
  }
  T.handFlame = function (p) {
    var hs = [p.hand1, p.hand2];
    for (var i = 0; i < 2; i++) { var it = hs[i]; if (it && it.on && D.ITEMS[it.id].flame && (it.burn === undefined || it.burn > 0)) { return it; } }
    return null;
  };
  T.lightSources = function (p) {
    var out = [];
    var lz = W.levelOf(p.z);
    var night = T.isNight();
    if (p.flashlightOn) {
      var fl = CP.Items.Inv.find(p, function (it) { return D.ITEMS[it.id].light && it.charge > 0; });
      if (fl) { out.push({ x: p.x, y: p.y, z: lz, r: 11, i: 0.95, cone: { ang: p.ang, half: 0.5 }, glow: 'flash' }); } else { p.flashlightOn = false; }
    }
    // vela, tocha ou lampião aceso na mão
    var fh = T.handFlame(p);
    if (fh) { var fd = D.ITEMS[fh.id].flame; out.push({ x: p.x, y: p.y, z: lz, r: fd.r * (0.94 + Math.random() * 0.06), i: fd.i, glow: 'fire' }); }
    // luz fraca ao redor do jogador (para não ficar totalmente preto)
    out.push({ x: p.x, y: p.y, z: lz, r: 3.2, i: 0.42 });
    var V = CP.Vis;
    if (night) {
      var pw = T.powerOn();
      for (var y = V.oy; y < V.oy + V.size; y++) {
        for (var x = V.ox; x < V.ox + V.size; x++) {
          if (pw) { windowLight(out, x, y, lz); }
          var o = W.obj(x, y, lz);
          if (!o) { continue; }
          if (o === O.LAMPPOST && T.powerAt(x, y)) { out.push({ x: x + 0.5, y: y + 0.5, z: lz, r: 7, i: 0.85, indoor: false, glow: 'lamp' }); }
          if (o === O.CAMPFIRE && !(W.odir(x, y, lz) & 4)) { out.push({ x: x + 0.5, y: y + 0.5, z: lz, r: 6, i: 0.85, glow: 'fire' }); }
        }
      }
    }
    if (CP.Vehicles) { CP.Vehicles.lightSources(out); }
    if (CP.Fire) { CP.Fire.lightSources(out, p, lz); }
    var heli = ws().heli;
    if (heli && night) { out.push({ x: heli.x, y: heli.y, z: 0, r: 6, i: 0.9, indoor: false }); }
    return out;
  };

  /* ---------- atualização ---------- */
  T.update = function (dt, gameDt) {
    var w = ws();
    var h = T.hours();
    var rng = U.rng;
    // clima
    if (h >= w.weather.until) {
      var type = nextWeather(rng);
      var prevType = w.weather.type;
      w.weather = { type: type, until: h + rng.range(WE.CHANGE_HOURS_MIN, WE.CHANGE_HOURS_MAX), tempOff: rng.range(-2, 2) };
      if (type === 'storm' && CP.UI) { CP.UI.toast('Uma tempestade está chegando.'); }
      if (type === 'blizzard' && CP.UI) { CP.UI.toast('Uma nevasca está começando. Procure abrigo.', 'warn'); }
      if ((prevType === 'storm' || prevType === 'blizzard') && type !== prevType) { T.fallenBranches(); }
    }
    if (T.weather().rain >= 1 && !T.weather().snow && Math.random() < dt * 0.02) { // trovão
      if (CP.Audio) { CP.Audio.thunder(); }
      if (CP.FX) { CP.FX.lightning(); }
      if (Math.random() < WE.LIGHTNING_TREE) { T.lightningStrike(); }
    }
    // a cada hora de jogo
    var hr = Math.floor(h);
    if (hr !== w.lastHourTick) { w.lastHourTick = hr; hourly(); }
    // a cada dia
    var day = Math.floor(T.daysSurvived());
    if (day !== w.lastDayTick) { w.lastDayTick = day; daily(day); }
    // corte de energia/água
    if (!w.announced.power && !T.powerOn()) { w.announced.power = true; if (CP.UI) { CP.UI.toast('A energia elétrica acabou.', 'warn'); } if (CP.Audio) { CP.Audio.powerDown(); } }
    if (!w.announced.water && !T.waterOn()) { w.announced.water = true; if (CP.UI) { CP.UI.toast('As torneiras secaram. A água encanada acabou.', 'warn'); } }
    // eventos meta (sons distantes)
    if (h >= w.nextMeta) { metaSound(); var per = 24 / EV.META_SOUND_PER_DAY / (T.isNight() ? 1.5 : 1); w.nextMeta = h + rng.range(per * 0.5, per * 1.5); }
    // helicóptero
    if (!w.heliDone && !w.heli && T.daysSurvived() >= w.heliDay + (w.heliHour - C.START_HOUR) / 24) { startHeli(); }
    if (w.heli) { updateHeli(dt); }
    // alarmes
    for (var i = w.alarms.length - 1; i >= 0; i--) {
      var a = w.alarms[i];
      a.t -= dt;
      a.pulse -= dt;
      if (a.pulse <= 0) { a.pulse = 1.2; CP.Zombies.noise(a.x, a.y, a.z, C.NOISE.ALARM, 'alarm'); if (CP.Audio) { CP.Audio.alarm(a.x, a.y); } }
      if (a.t <= 0) { w.alarms.splice(i, 1); }
    }
    // fogueiras e geradores consomem combustível
    (w.generators || []).forEach(function (g) { if (g.on) { g.fuel = Math.max(0, g.fuel - gameDt / 3600 * 0.6); if (Math.random() < dt * 0.3) { CP.Zombies.noise(g.x, g.y, g.z, 14, 'generator'); } } });
  };

  function hourly() {
    var p = G().player;
    // comida envelhece no inventário
    CP.Items.Inv.all(p).forEach(function (o) { CP.Items.touch(o.item, 1); });
    // lanterna gasta pilha
    if (p.flashlightOn) {
      var fl = CP.Items.Inv.find(p, function (it) { return D.ITEMS[it.id].light; });
      if (fl) { fl.item.charge = Math.max(0, fl.item.charge - 0.03); if (fl.item.charge <= 0 && CP.UI) { CP.UI.toast('A pilha da lanterna acabou.', 'warn'); } }
    }
    // chuva enche coletores
    if (T.raining()) {
      (ws().rainBarrels || []).forEach(function (rb) { rb.water = Math.min(C.OBJ_INFO[O.RAIN_BARREL].waterCap, (rb.water || 0) + T.rainIntensity() * 4); });
    }
    if (CP.Farm) { CP.Farm.hourly(); }
    // vela/tocha/lampião queimam; chuva apaga a tocha ao ar livre
    CP.Items.Inv.all(p).forEach(function (o) {
      var it = o.item, fd = D.ITEMS[it.id].flame;
      if (!fd || !it.on) { return; }
      it.burn = (it.burn === undefined ? fd.hours : it.burn) - 1;
      var outside = !W.isIndoor(Math.floor(p.x), Math.floor(p.y), W.levelOf(p.z));
      if (it.id === 'torch' && outside && T.rainIntensity() >= 0.6) { it.burn = Math.max(0, it.burn - 0.5); if (Math.random() < 0.5) { it.on = false; if (CP.UI) { CP.UI.toast('A chuva apagou a tocha.', 'warn'); } } }
      if (it.burn <= 0) { it.on = false; if (fd.refill) { if (CP.UI) { CP.UI.toast('O lampião ficou sem combustível.', 'warn'); } } else { CP.Items.Inv.detach(p, it); if (CP.UI) { CP.UI.toast(D.ITEMS[it.id].name + ' acabou.', 'warn'); } } }
    });
    if (CP.Surv) { CP.Surv.hourly(); }
  }
  function daily(day) {
    var p = G().player;
    p.daysSurvived = day;
    CP.Zombies.daily();
    if (CP.UI) { CP.UI.toast('Dia ' + (day + 1) + ' — ' + T.dateText(), 'info'); }
  }

  /* evento distante: só som e barulho (atrai zumbis para lá); nunca há alguém de verdade */
  function metaSound(forceId) {
    var p = G().player;
    if (!p || p.dead) { return; }
    var night = T.isNight(), day = T.daysSurvived();
    var list = C.META_EVENTS.filter(function (e) { return (!e.maxDay || day < e.maxDay) && (!forceId || e.id === forceId); });
    if (!list.length) { return; }
    var tot = 0, ws2 = list.map(function (e) { var wgt = e.w * (night && e.night ? e.night : 1); tot += wgt; return wgt; });
    var r = Math.random() * tot, ev = list[list.length - 1];
    for (var i = 0; i < list.length; i++) { r -= ws2[i]; if (r <= 0) { ev = list[i]; break; } }
    var a = Math.random() * Math.PI * 2, dist = U.randRange(ev.dist[0], ev.dist[1]);
    var x = p.x + Math.cos(a) * dist, y = p.y + Math.sin(a) * dist;
    if (ev.id === 'caralarm') {
      ws().alarms.push({ x: x, y: y, z: 0, t: 30, pulse: 0, kind: 'car' });
    } else {
      CP.Zombies.noise(x, y, 0, ev.noise, 'meta');
      if (CP.Audio) { CP.Audio.distant(ev.id, a, dist); }
    }
    if (CP.Music) { CP.Music.event(); }
    if (CP.UI) { CP.UI.toast(ev.msg); }
    ws().lastMeta = { id: ev.id, x: x, y: y };
  }
  T.metaEvent = metaSound;
  T.triggerAlarm = function (x, y, z, kind) {
    ws().alarms.push({ x: x, y: y, z: z, t: EV.ALARM_SECONDS, pulse: 0, kind: kind || 'house' });
    if (CP.UI) { CP.UI.toast(kind === 'car' ? 'O alarme do carro disparou!' : 'Um alarme disparou!', 'danger'); }
  };

  /* helicóptero: passa por cima do jogador; se ele estiver ao ar livre, segue-o */
  function startHeli() {
    var p = G().player;
    var a = Math.random() * Math.PI * 2;
    ws().heli = { x: p.x + Math.cos(a) * 70, y: p.y + Math.sin(a) * 70, t: 0, life: 200, phase: 'approach' };
    if (CP.UI) { CP.UI.toast('Um helicóptero se aproxima! Esconda-se dentro de uma construção.', 'danger'); }
  }
  function updateHeli(dt) {
    var hl = ws().heli, p = G().player;
    hl.t += dt;
    var outdoor = !W.isIndoor(Math.floor(p.x), Math.floor(p.y), W.levelOf(p.z));
    var tx = p.x, ty = p.y;
    if (!outdoor && hl.t > 30) { tx = hl.x + (hl.x - p.x); ty = hl.y + (hl.y - p.y); }
    var dx = tx - hl.x, dy = ty - hl.y, d = Math.sqrt(dx * dx + dy * dy);
    var sp = 5;
    if (d > 1) { hl.x += dx / d * Math.min(d, sp * dt); hl.y += dy / d * Math.min(d, sp * dt); }
    hl.noiseT = (hl.noiseT || 0) - dt;
    if (hl.noiseT <= 0) { hl.noiseT = 2.5; CP.Zombies.noise(hl.x, hl.y, 0, C.NOISE.HELICOPTER, 'heli'); }
    if (CP.Audio) { CP.Audio.heli(hl.x - p.x, hl.y - p.y); }
    if (hl.t > hl.life) { ws().heli = null; ws().heliDone = true; if (CP.Audio) { CP.Audio.heli(null); } if (CP.UI) { CP.UI.toast('O som do helicóptero some ao longe.'); } }
  }

  /* raio numa árvore por perto: pega fogo (mesmo com chuva, por um tempo) */
  T.lightningStrike = function () {
    var p = G().player, trees = [];
    for (var k in G().activeChunks) {
      var ch = G().activeChunks[k], L = ch.levels[0];
      for (var i = 0; i < L.obj.length; i++) {
        if (!L.obj[i] || !C.OBJ_INFO[L.obj[i]].tree) { continue; }
        var x = ch.cx * C.CHUNK + (i & (C.CHUNK - 1)), y = ch.cy * C.CHUNK + (i >> W.chunkShift), d = U.dist(x, y, p.x, p.y);
        if (d > 5 && d < 36) { trees.push({ x: x, y: y }); }
      }
    }
    var best = trees.length ? trees[U.randInt(0, trees.length - 1)] : null;
    if (!best || !CP.Fire) { return null; }
    CP.Fire.ignite(best.x, best.y, 0, true, 50);
    CP.Zombies.noise(best.x, best.y, 0, 40, 'thunder');
    if (CP.UI) { CP.UI.toast('Um raio caiu numa árvore aqui perto!', 'warn'); }
    return best;
  };
  /* depois da tempestade: galhos quebrados pelo chão em volta das árvores */
  T.fallenBranches = function () {
    var n = 0;
    for (var k in G().activeChunks) {
      var ch = G().activeChunks[k], L = ch.levels[0];
      for (var i = 0; i < L.obj.length; i++) {
        if (!L.obj[i] || !C.OBJ_INFO[L.obj[i]].tree || Math.random() > WE.BRANCH_CHANCE) { continue; }
        var x = ch.cx * C.CHUNK + (i & (C.CHUNK - 1)) + U.randInt(-1, 1), y = ch.cy * C.CHUNK + (i >> W.chunkShift) + U.randInt(-1, 1);
        var cc = W.chunkAt(x, y);
        if (!cc || W.obj(x, y, 0) || W.isIndoor(x, y, 0) || !W.tileWalkable(x, y, 0) || W.floor(x, y, 0) === C.FLOOR.WATER) { continue; }
        cc.levels[0].obj[W.idx(x, y)] = C.OBJ.BRANCHES; cc.levels[0].odir[W.idx(x, y)] = U.randInt(0, 3); cc.dirty = true; cc.saveDirty = true; n++;
      }
    }
    return n;
  };

  /* ---------- rádio / TV ---------- */
  var BROADCASTS = [
    [0, 'NOTÍCIAS: As autoridades pedem calma. O condado está sob quarentena por causa de um surto da "Febre Cinzenta". Fiquem em casa.'],
    [0.5, 'NOTÍCIAS: Hospitais lotados. Pessoas infectadas apresentam febre alta e comportamento extremamente violento. Não se aproximem.'],
    [1, 'NOTÍCIAS: O Exército ergueu cercas em volta do condado. Ninguém entra, ninguém sai. Barricadem portas e janelas.'],
    [1.5, 'NOTÍCIAS: Relatos de mortos que voltam a andar. O governo nega. Evitem qualquer contato com mordidas e arranhões.'],
    [2, 'SISTEMA DE EMERGÊNCIA: Racionem água e comida. Guardem água em recipientes enquanto as torneiras funcionam.'],
    [3, 'SISTEMA DE EMERGÊNCIA: A rede elétrica pode falhar a qualquer momento. Procurem lanternas, pilhas e geradores.'],
    [4, 'Rádio amador: "...alguém na escuta? Os mortos são atraídos por barulho. Não atirem a não ser que precisem..."'],
    [5, 'SISTEMA DE EMERGÊNCIA: Aviso de atividade aérea militar na região nos próximos dias. Permaneçam em ambientes fechados.'],
    [7, 'Rádio amador: "...vi um grupo de centenas deles andando juntos pela rodovia. Fiquem longe das estradas grandes..."'],
    [10, 'SISTEMA DE EMERGÊNCIA: ...esta é uma mensagem automática... permaneçam em suas casas... aguardem instruções...'],
    [14, '(estática)']
  ];
  T.broadcast = function () {
    var day = T.daysSurvived();
    var best = BROADCASTS[0][1];
    for (var i = 0; i < BROADCASTS.length; i++) { if (BROADCASTS[i][0] <= day) { best = BROADCASTS[i][1]; } }
    var w = ws();
    if (w.heliDay - day <= 1.2 && w.heliDay - day > 0) { best = 'SISTEMA DE EMERGÊNCIA: Atividade de helicópteros prevista para ' + (w.heliDay - day < 0.5 ? 'hoje' : 'amanhã') + '. Fiquem em ambientes fechados.'; }
    return best;
  };
  /* programas de TV (dão XP enquanto houver energia) */
  T.tvShow = function () {
    var shows = [
      { name: 'Vida no Campo', skill: 'farming', xp: 12 }, { name: 'Cozinha Prática', skill: 'cooking', xp: 12 },
      { name: 'Faça Você Mesmo', skill: 'carpentry', xp: 12 }, { name: 'Pesca Esportiva', skill: 'fishing', xp: 12 },
      { name: 'Primeiros Socorros na TV', skill: 'firstAid', xp: 12 }, { name: 'Sobrevivência na Mata', skill: 'foraging', xp: 12 }
    ];
    var d = Math.floor(T.daysSurvived());
    var hrs = Math.floor(T.hourOfDay() / 4);
    return shows[(d * 6 + hrs) % shows.length];
  };

  CP.Time = T;
})(window.CP = window.CP || {});
