/* Rádio: estações por frequência que vão saindo do ar com os dias (cada mundo sorteia quando), o sistema de emergência
 * que se despede, walkie-talkie e rádio amador (falar no rádio; sobreviventes às vezes respondem e dão dicas que viram
 * anotação no mapa). Rádio ligado faz barulho (volume baixo/alto) e gasta pilha. Também o despertador (acorda e faz barulho). */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, D = CP.D;
  var R = { replyQ: [] };
  function G() { return CP.Game; }
  function msg(t, k) { if (CP.UI) { CP.UI.toast(t, k); } }
  function ws() { return G().state.world; }

  /* estações: banda (o que cada aparelho pega), faixa de dias em que sai do ar e as falas */
  var ST = [
    { id: 'fm88', f: '88.5 FM', name: 'Rádio Condado FM', band: 'fm', off: [4, 7], lines: [
      'Locutor: "...repetindo: a quarentena continua. Evitem sair à noite e mantenham as portas trancadas."',
      'Locutor: "...recebemos ligações de ouvintes sobre ataques no centro. Se puderem, fiquem longe da Rua Principal."',
      'Locutor: "...a prefeitura pede que os moradores juntem água limpa enquanto as torneiras funcionam."',
      'Locutor: "...não temos mais notícias da equipe de reportagem. Vamos continuar no ar enquanto der."',
      'Locutor (cansado): "...o gerador da rádio está no fim. Se alguém estiver ouvindo... boa sorte."'] },
    { id: 'fm93', f: '93.1 FM', name: 'Clássicos 93', band: 'fm', off: [2, 4], lines: [
      '(uma música country antiga, chiando um pouco)', '(uma balada de violão, alguém assobiando junto)',
      'Locutora: "...e agora mais uma para quem está aguentando firme aí em casa."', '(rock dos anos 70, o volume oscila)'] },
    { id: 'ebs', f: '101.7 FM', name: 'Sistema de Emergência', band: 'fm', off: [12, 18], ebs: true },
    { id: 'am1150', f: '1150 AM', name: 'Rádio da Igreja', band: 'am', off: [6, 10], lines: [
      'Pastor: "...não percam a fé. O salão da igreja está aberto para quem precisar de abrigo."',
      'Pastor: "...vamos rezar pelos que se foram. E pelos que ainda estão lá fora."',
      'Pastor (voz rouca): "...as portas da igreja estão fechadas. Eles estão aqui fora. Que Deus nos ajude."'] },
    { id: 'mil', f: '152.3 VHF', name: 'Frequência militar', band: 'vhf', off: [5, 9], lines: [
      'Voz: "...Setor 4 perdido. Recuar para o ponto de coleta. Câmbio."',
      'Voz: "...negativo, não há transporte para civis. Repito, negativo. Câmbio."',
      'Voz: "...helicóptero em patrulha sobre o condado. Não pousar. Câmbio, desligo."'] },
    { id: 'ham', f: '146.52 VHF', name: 'Canal dos sobreviventes', band: 'vhf', off: [40, 80], ham: true, lines: [
      'Rádio amador: "...alguém na escuta? Aqui é o Walt, na fazenda ao norte. Estamos bem por enquanto."',
      'Rádio amador: "...os mortos seguem barulho de motor de longe. Andem a pé quando der."',
      'Rádio amador: "...vi gente abrindo porta destrancada. Nem todos são burros. Tranquem tudo."',
      'Rádio amador: "...quem estiver na escuta: fervam a água. Água parada adoece."',
      'Rádio amador: "...a noite é quando eles mais andam. Luz acesa chama atenção."'] }
  ];
  R.STATIONS = ST;
  var BY = {}; ST.forEach(function (s) { BY[s.id] = s; });
  var EBS = [
    [0, 'SISTEMA DE EMERGÊNCIA: O condado está em quarentena. Permaneçam em casa e aguardem instruções.'],
    [2, 'SISTEMA DE EMERGÊNCIA: Racionem água e comida. Encham recipientes enquanto as torneiras funcionam.'],
    [3, 'SISTEMA DE EMERGÊNCIA: A rede elétrica pode falhar. Procurem lanternas, pilhas e geradores.'],
    [5, 'SISTEMA DE EMERGÊNCIA: Atividade aérea militar na região. Permaneçam em ambientes fechados.'],
    [8, 'SISTEMA DE EMERGÊNCIA: ...esta é uma mensagem automática... permaneçam em suas casas... aguardem instruções...']
  ];
  var REPLIES = [
    { t: '"...te escuto! Tem uma base militar no mato, longe das cidades. Pode ter comida e armas lá. Marquei pra você."', where: 'military' },
    { t: '"...na escuta. O hospital da cidade ainda tem remédio, mas está cheio deles. Vá de dia."', where: 'hospital' },
    { t: '"...ouvi você. O shopping está fechado com tábuas, mas tem roupa e pilha lá dentro."', where: 'mall' },
    { t: '"...na escuta, amigo. Não temos espaço para mais ninguém aqui. Desculpe. Boa sorte."' },
    { t: '"...quem é você? ...não confio em voz no rádio. Fique longe da nossa casa."' }
  ];

  /* dia (sorteado por mundo) em que cada estação sai do ar */
  R.offDay = function (id) {
    var w = ws(), s = BY[id];
    w.radioOff = w.radioOff || {};
    if (w.radioOff[id] === undefined) { var rng = new U.Rng(U.hashStr(id) ^ (W.seed || 1)); w.radioOff[id] = Math.round(rng.range(s.off[0], s.off[1]) * 10) / 10; }
    return w.radioOff[id];
  };
  R.onAir = function (id) { return CP.Time.daysSurvived() < R.offDay(id); };
  /* fala atual da estação (muda a cada ~20 min de jogo) */
  R.lineOf = function (id) {
    var s = BY[id], day = CP.Time.daysSurvived();
    if (!R.onAir(id)) { return '(só chiado — a estação saiu do ar)'; }
    if (s.ebs) {
      var off = R.offDay(id);
      if (off - day < 0.5) { return 'SISTEMA DE EMERGÊNCIA: Esta é a última transmissão deste sistema. Não há mais ajuda a caminho. Boa sorte a todos.'; }
      var best = EBS[0][1];
      EBS.forEach(function (e) { if (e[0] <= day) { best = e[1]; } });
      var w = ws();
      if (w.heliDay - day <= 1.2 && w.heliDay - day > 0) { best = 'SISTEMA DE EMERGÊNCIA: Atividade de helicópteros prevista para ' + (w.heliDay - day < 0.5 ? 'hoje' : 'amanhã') + '. Fiquem em ambientes fechados.'; }
      return best;
    }
    var k = Math.floor(CP.Time.hours() * 3) % s.lines.length, last = s.lines.length - 1;
    if (R.offDay(id) - day < 0.6) { return s.lines[last]; } // a despedida
    return s.lines[Math.min(k, last - (s.id === 'fm88' ? 1 : 0))];
  };
  function bandsOf(it) { var d = D.ITEMS[it.id].radio; return d ? d.bands : []; }
  R.stationsFor = function (it) { var b = bandsOf(it); return ST.filter(function (s) { return b.indexOf(s.band) >= 0; }); };
  R.radiosOf = function (p) { return CP.Items.Inv.all(p).map(function (o) { return o.item; }).filter(function (it) { return D.ITEMS[it.id].radio; }); };

  R.itemOptions = function (p, it, out) {
    var d = D.ITEMS[it.id].radio, list = R.stationsFor(it);
    if (it.charge === undefined) { it.charge = 1; }
    if (!it.freq || !BY[it.freq] || list.indexOf(BY[it.freq]) < 0) { it.freq = list[0].id; }
    var cur = BY[it.freq];
    out.push({ label: (it.on ? 'Desligar o rádio' : 'Ligar o rádio') + ' (' + cur.f + ')', disabled: !it.on && it.charge <= 0, hint: 'Sem pilha', fn: function () { it.on = !it.on; it.talkT = 0; if (it.on) { R.hear(p, it); } } });
    list.forEach(function (s) { if (s !== cur) { out.push({ label: 'Sintonizar ' + s.f + ' — ' + s.name, fn: function () { it.freq = s.id; if (it.on) { R.hear(p, it); } } }); } });
    out.push({ label: it.loud ? 'Volume baixo (menos barulho)' : 'Volume alto', fn: function () { it.loud = !it.loud; } });
    if (d.tx) { out.push({ label: 'Falar no rádio (' + cur.f + ')', disabled: it.charge <= 0, hint: 'Sem pilha', fn: function () { R.transmit(p, it); } }); }
    out.push({ label: 'Pilha: ' + Math.round(it.charge * 100) + '%', disabled: true });
    if (it.charge < 0.9 && CP.Items.Inv.findId(p, 'battery')) { out.push({ label: 'Trocar pilhas', fn: function () { CP.Items.Inv.consume(p, 'battery', 1); it.charge = 1; msg('Pilhas trocadas.'); } }); }
  };
  /* mostra a fala atual (balão) */
  R.hear = function (p, it) {
    var line = R.lineOf(it.freq);
    if (CP.UI) { CP.UI.say(p, '📻 ' + line); p.sayT = 6; }
    if (CP.Audio && CP.Audio.radioHum) { CP.Audio.radioHum(p.x, p.y); }
    return line;
  };
  R.transmit = function (p, it) {
    CP.Actions.start(p, { name: 'Falando no rádio', time: 2.5, onDone: function () {
      CP.Zombies.noise(p.x, p.y, p.z, C.RADIO.TALK_NOISE, 'voice');
      it.charge = Math.max(0, it.charge - C.RADIO.TX_DRAIN);
      if (CP.UI) { CP.UI.say(p, '"Alguém na escuta? Câmbio."'); }
      var s = BY[it.freq];
      if (s.ham && R.onAir(s.id) && Math.random() < C.RADIO.REPLY_CHANCE) { R.replyQ.push({ t: U.randRange(4, 10), it: it }); }
    } });
  };
  /* resposta de sobrevivente: algumas marcam um lugar no mapa */
  R.reply = function (p) {
    var used = (ws().radioReplies = ws().radioReplies || []);
    var opts = REPLIES.filter(function (r, i) { return used.indexOf(i) < 0 || !r.where; });
    var r = U.pick(opts), i = REPLIES.indexOf(r);
    if (r.where) { used.push(i); }
    var spot = r.where ? R.placeOf(r.where, p) : null;
    if (spot) {
      p.mapNotes = p.mapNotes || [];
      p.mapNotes.push({ x: spot.x, y: spot.y, s: 2, t: { military: 'Base militar (rádio)', hospital: 'Hospital (rádio)', mall: 'Shopping (rádio)' }[r.where] });
    }
    if (CP.UI) { CP.UI.say(p, '📻 ' + r.t); p.sayT = 7; CP.UI.toast('Alguém respondeu no rádio' + (spot ? ' — o lugar foi marcado no mapa.' : '.')); }
    return { text: r.t, spot: spot };
  };
  /* lugar especial mais perto (centro do chunk do mapa macro) */
  R.placeOf = function (kind, p) {
    var m = W.macro, N = m.n || Math.round(Math.sqrt(m.feature.length)), cs = 1 << W.chunkShift;
    var code = { military: 10, hospital: 6, mall: 9 }[kind], best = null, bd = 1e9;
    for (var k = 0; k < m.feature.length; k++) {
      if (m.feature[k] !== code) { continue; }
      var x = (k % N) * cs + cs / 2, y = ((k / N) | 0) * cs + cs / 2, d = U.dist(x, y, p.x, p.y);
      if (d < bd) { bd = d; best = { x: x, y: y }; }
    }
    return best;
  };

  /* ---------- despertador ---------- */
  R.alarmOptions = function (p, it, out) {
    var h = it.alarmAt;
    out.push({ label: h === undefined || h === null ? 'Programar despertador (' + C.RADIO.ALARM_DEFAULT + 'h)' : 'Despertador às ' + h + 'h — adiantar 1 hora', fn: function () { it.alarmAt = h === undefined || h === null ? C.RADIO.ALARM_DEFAULT : (h + 1) % 24; it.alarmDay = -1; msg('Despertador programado para ' + it.alarmAt + 'h.'); } });
    if (h !== undefined && h !== null) { out.push({ label: 'Desligar o despertador', fn: function () { it.alarmAt = null; } }); }
  };
  function checkAlarms(p) {
    var hr = Math.floor(CP.Time.hourOfDay()), day = Math.floor(CP.Time.daysSurvived() + 0.0001);
    CP.Items.Inv.all(p).forEach(function (o) {
      var it = o.item;
      if (it.id !== 'alarm_clock' || it.alarmAt === null || it.alarmAt === undefined || hr !== it.alarmAt || it.alarmDay === day) { return; }
      it.alarmDay = day;
      CP.Zombies.noise(p.x, p.y, p.z, C.RADIO.ALARM_NOISE, 'alarm');
      if (CP.Audio && CP.Audio.alarm) { CP.Audio.alarm(p.x, p.y); }
      if (p.sleeping) { CP.Body.wake(p, 'Trrrim! O despertador tocou.'); } else if (CP.UI) { CP.UI.say(p, 'Trrrim!'); }
    });
  }

  /* ---------- por quadro ---------- */
  R.update = function (dt, gameDt) {
    var p = G().player;
    if (!p || p.dead) { return; }
    var h = gameDt / 3600;
    R.radiosOf(p).forEach(function (it) {
      if (!it.on) { return; }
      it.charge = Math.max(0, (it.charge === undefined ? 1 : it.charge) - C.RADIO.DRAIN_H * h * (it.loud ? 1.3 : 1));
      if (it.charge <= 0) { it.on = false; msg('O rádio ficou sem pilha.', 'warn'); return; }
      it.talkT = (it.talkT || 0) - dt;
      if (it.talkT <= 0) {
        it.talkT = C.RADIO.TALK_EVERY;
        CP.Zombies.noise(p.x, p.y, p.z, it.loud ? C.RADIO.NOISE_HIGH : C.RADIO.NOISE_LOW, 'radio');
        if (!p.sleeping && (!p.sayT || p.sayT <= 0)) { R.hear(p, it); }
      }
    });
    for (var i = R.replyQ.length - 1; i >= 0; i--) {
      var q = R.replyQ[i]; q.t -= dt;
      if (q.t <= 0) { R.replyQ.splice(i, 1); if (R.radiosOf(p).indexOf(q.it) >= 0) { R.reply(p); } }
    }
    R.alarmT = (R.alarmT || 0) - gameDt;
    if (R.alarmT <= 0) { R.alarmT = 60; checkAlarms(p); }
  };
  R.reset = function () { R.replyQ.length = 0; R.alarmT = 0; };

  CP.Radio = R;
})(window.CP = window.CP || {});
