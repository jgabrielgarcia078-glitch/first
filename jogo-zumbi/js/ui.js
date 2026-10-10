/* Interface: menu, criação de personagem, HUD, painéis (inventário, saúde, habilidades, artesanato, mapa, ajuda),
 * menu de contexto, avisos, pausa, morte. Todos os eventos via addEventListener com delegação (data-a). */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, D = CP.D;
  var esc = U.escapeHtml;

  var UI = {
    screen: 'menu', open: {}, ctxOpen: false, lastCtxClose: 0, refs: [], hurtT: 0,
    hudT: 0, panelT: 0, sigs: {}, creation: null, prefs: { volume: 0.7, showFps: false, zoomIndex: C.ZOOM_DEFAULT_INDEX },
    autosaveT: 0, menuT: 0, deathShown: false, craftTab: 'recipes', mapMode: 'region', hasSave: false
  };
  var root, $ = {};
  var MOODLE_ICONS = { hunger: '🍖', thirst: '💧', fatigue: '😴', endurance: '💨', panic: '😱', stress: '😣', boredom: '😑', unhappy: '😞', sick: '🤢', pain: '🤕', bleeding: '🩸', hot: '🥵', cold: '🥶', wet: '🌧️', heavy: '🎒', drunk: '🥴', stuffed: '😋', fine: '🙂' };

  function h(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) { for (var k in attrs) { e.setAttribute(k, attrs[k]); } }
    if (html !== undefined) { e.innerHTML = html; }
    return e;
  }
  function G() { return CP.Game; }
  function P() { return CP.Game.player; }

  /* ================= INICIALIZAÇÃO ================= */
  UI.init = function () {
    root = document.getElementById('ui');
    root.innerHTML = '';
    ['hud-top', 'moodles', 'hud-left', 'hud-bottom', 'hud-right', 'toasts', 'action-label', 'fps', 'build-hint', 'panels', 'screens', 'ctxwrap'].forEach(function (id) {
      var e = h('div', { id: id });
      root.appendChild(e);
      $[id] = e;
    });
    root.addEventListener('click', onClick);
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); var t = e.target.closest('[data-ref]'); if (t) { itemMenu(+t.getAttribute('data-ref'), e.clientX, e.clientY); } });
    root.addEventListener('dblclick', onDblClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onInput);
    root.addEventListener('mousedown', startDrag);
    document.addEventListener('mousedown', function (e) {
      if (UI.ctxOpen && !e.target.closest('.ctx')) { closeCtx(); }
    }, true);
    document.addEventListener('keydown', function () { if (CP.Audio) { CP.Audio.resume(); } });
    document.addEventListener('mousedown', function () { if (CP.Audio) { CP.Audio.resume(); } });
    CP.U.on('skill:up', function (d) { UI.toast('⬆ ' + D.SKILL[d.skill].name + ' subiu para o nível ' + d.level + '!', 'good'); if (UI.open.skills) { renderSkills(); } });
    CP.U.on('player:dead', function () { setTimeout(showDeath, 1800); });
    CP.U.on('sleep:end', function () { if (CP.Save) { CP.Save.save(); } });
    CP.Save.loadSettings().then(function (pr) {
      if (pr) { Object.assign(UI.prefs, pr); }
      CP.Audio.setVolume(UI.prefs.volume);
      CP.Render.setZoomIndex(UI.prefs.zoomIndex);
    });
    UI.showMenu();
  };

  /* ================= MENU PRINCIPAL ================= */
  UI.showMenu = function () {
    UI.screen = 'menu';
    clearHud();
    // mundo de fundo
    var seed = (Math.random() * 1e9) >>> 0;
    W.init(seed);
    var t = W.macro.towns[0];
    UI.menuCam = { x: t.x * C.CHUNK + 4, y: t.y * C.CHUNK + 4, a: Math.random() * Math.PI * 2 };
    W.ensureAround(UI.menuCam.x, UI.menuCam.y, 2);
    $.screens.innerHTML = '<div class="screen"><div class="menu-box">' +
      '<h1>' + esc(C.GAME_NAME) + '</h1><div class="sub">Este é o fim do mundo. Como você vai morrer?</div>' +
      '<button class="primary" data-a="menu-new">Novo jogo</button>' +
      '<button data-a="menu-continue" id="btn-continue" disabled>Continuar</button>' +
      '<button data-a="help">Como jogar</button>' +
      '<div class="ver">v' + C.VERSION + ' · sobrevivência zumbi isométrica · tudo desenhado por código</div></div></div>';
    CP.Save.hasSave().then(function (r) {
      UI.hasSave = !!r;
      var b = document.getElementById('btn-continue');
      if (b && r) { b.disabled = false; b.textContent = 'Continuar — ' + r.meta.name + ' (dia ' + (Math.floor(r.meta.days) + 1) + ')'; }
    });
  };
  function drawMenuBackground(dt) {
    var mc = UI.menuCam;
    if (!mc) { return; }
    mc.a += dt * 0.03;
    mc.x += Math.cos(mc.a) * dt * 1.2; mc.y += Math.sin(mc.a) * dt * 1.2;
    W.ensureAround(Math.floor(mc.x), Math.floor(mc.y), 1);
    var R = CP.Render;
    R.camX = mc.x; R.camY = mc.y; R.camZ = 0;
    CP.Vis.compute(mc.x, mc.y, 0, 0, { cone: 360, radius: 30, markSeen: false });
    CP.Vis.computeLight(1, [], true);
    R.draw({ viewZ: 0, maxZ: 2, px: mc.x, py: mc.y, bld: null, ents: [], noCut: true });
  }

  /* ================= CRIAÇÃO DE PERSONAGEM ================= */
  var PRESETS = {
    builder: { name: 'Construtor (fácil)', popMult: 0.5, lootMult: 1.6, zombieSpeed: 'shambler', infection: true, toughness: 0.85 },
    survivor: { name: 'Sobrevivente (normal)', popMult: 1, lootMult: 1, zombieSpeed: 'shambler', infection: true, toughness: 1 },
    apocalypse: { name: 'Apocalipse (difícil)', popMult: 1.4, lootMult: 0.7, zombieSpeed: 'shambler', infection: true, toughness: 1.1 },
    sprinters: { name: 'Corredores (insano)', popMult: 1, lootMult: 0.8, zombieSpeed: 'sprinters', infection: true, toughness: 1 }
  };
  function newCreation() {
    var seed = (Math.random() * 1e9) >>> 0;
    W.init(seed);
    var female = Math.random() < 0.5;
    return {
      name: female ? U.pick(['Ana', 'Júlia', 'Carla', 'Marta', 'Paula', 'Rita', 'Sofia']) + ' ' + U.pick(['Souza', 'Lima', 'Costa', 'Rocha', 'Alves']) : U.pick(['João', 'Pedro', 'Carlos', 'Lucas', 'Rafael', 'Bruno', 'Marcos']) + ' ' + U.pick(['Souza', 'Lima', 'Costa', 'Rocha', 'Alves']),
      female: female, occupation: 'unemployed', traits: [], sel: null,
      look: { skin: U.pick(C.SKIN_TONES), hair: U.pick(C.HAIR_COLORS.slice(0, 6)), hairStyle: female ? 'longo' : 'curto', beard: false },
      seed: seed, town: 0, preset: 'survivor', settings: Object.assign({}, PRESETS.survivor), dayMinutes: C.REAL_MINUTES_PER_DAY
    };
  }
  UI.showCreate = function () {
    UI.screen = 'create';
    UI.creation = UI.creation || newCreation();
    renderCreate();
  };
  function renderCreate() {
    var cr = UI.creation;
    var v = CP.Player.validate(cr);
    var occHtml = D.OCCUPATIONS.map(function (o) {
      return '<div class="list-item' + (cr.occupation === o.id ? ' sel' : '') + '" data-a="occ" data-id="' + o.id + '"><span>' + esc(o.name) + '</span><span class="pts ' + (o.pts >= 0 ? 'pos' : 'neg') + '">' + (o.pts > 0 ? '+' : '') + o.pts + '</span></div>';
    }).join('');
    var occ = D.OCC[cr.occupation];
    var occDesc = esc(occ.desc) + '<br>' + Object.keys(occ.skills).map(function (s) { return D.SKILL[s].name + ' +' + occ.skills[s]; }).join(', ');
    function traitList(positive) {
      return D.TRAITS.filter(function (t) { return !t.hidden && (positive ? t.cost > 0 : t.cost < 0); }).map(function (t) {
        var chosen = cr.traits.indexOf(t.id) >= 0;
        var blocked = !chosen && cr.traits.some(function (o) { var tt = D.TRAIT[o]; return (t.excl && t.excl.indexOf(o) >= 0) || (tt.excl && tt.excl.indexOf(t.id) >= 0); });
        if ((occ.traits || []).indexOf(t.id) >= 0) { blocked = true; }
        return '<div class="list-item' + (chosen ? ' sel' : '') + (blocked ? ' off' : '') + '" data-a="trait" data-id="' + t.id + '" title="' + esc(t.desc) + '"><span>' + esc(t.name) + '</span><span class="pts ' + (t.cost > 0 ? 'neg' : 'pos') + '">' + (t.cost > 0 ? '−' : '+') + Math.abs(t.cost) + '</span></div>';
      }).join('');
    }
    var sel = cr.sel ? D.TRAIT[cr.sel] : null;
    var towns = W.macro.towns.map(function (t, i) { return '<option value="' + i + '"' + (i === +cr.town ? ' selected' : '') + '>' + esc(t.name) + (i === 0 ? ' (maior)' : '') + '</option>'; }).join('');
    var presets = Object.keys(PRESETS).map(function (k) { return '<option value="' + k + '"' + (k === cr.preset ? ' selected' : '') + '>' + PRESETS[k].name + '</option>'; }).join('');
    function sw(list, key, cur) { return '<div class="swatches">' + list.map(function (c) { return '<div class="swatch' + (c === cur ? ' sel' : '') + '" style="background:' + c + '" data-a="look" data-k="' + key + '" data-v="' + c + '"></div>'; }).join('') + '</div>'; }
    var styles = C.HAIR_STYLES.map(function (s) { return '<option' + (s === cr.look.hairStyle ? ' selected' : '') + '>' + s + '</option>'; }).join('');
    $.screens.innerHTML = '<div class="screen solid"><div class="create">' +
      '<div class="title"><h2>Novo sobrevivente</h2><div><button data-a="create-back">Voltar</button> <button class="primary" data-a="create-start"' + (v.ok ? '' : ' disabled') + '>Começar ▶</button></div></div>' +
      '<div class="col"><h3>Ocupação</h3>' + occHtml + '<div class="desc">' + occDesc + '</div></div>' +
      '<div class="col"><div class="points-box">Pontos: <span class="' + (v.points >= 0 ? 'good' : 'danger') + '">' + v.points + '</span></div>' +
      '<div class="errors">' + v.errors.map(esc).join(' · ') + '</div>' +
      '<div class="desc">' + (sel ? '<b>' + esc(sel.name) + ':</b> ' + esc(sel.desc) : 'Clique num traço para escolher. Traços bons custam pontos; ruins dão pontos. O saldo precisa ficar ≥ 0.') + '</div>' +
      '<div class="traits-grid"><div><h3>Traços positivos</h3>' + traitList(true) + '</div><div><h3>Traços negativos</h3>' + traitList(false) + '</div></div></div>' +
      '<div class="col"><canvas id="preview" width="160" height="200"></canvas>' +
      '<div class="row"><label>Nome</label><input data-a="name" value="' + esc(cr.name) + '" maxlength="28" style="flex:1"></div>' +
      '<div class="row"><label>Sexo</label><button class="small' + (!cr.female ? ' primary' : '') + '" data-a="sex" data-v="m">Masculino</button><button class="small' + (cr.female ? ' primary' : '') + '" data-a="sex" data-v="f">Feminino</button></div>' +
      '<div class="row"><label>Pele</label>' + sw(C.SKIN_TONES, 'skin', cr.look.skin) + '</div>' +
      '<div class="row"><label>Cabelo</label>' + sw(C.HAIR_COLORS, 'hair', cr.look.hair) + '</div>' +
      '<div class="row"><label>Penteado</label><select data-a="hairstyle">' + styles + '</select>' + (cr.female ? '' : ' <label style="min-width:auto"><input type="checkbox" data-a="beard"' + (cr.look.beard ? ' checked' : '') + '> barba</label>') + '</div>' +
      '<h3>Mundo</h3>' +
      '<div class="row"><label>Cidade</label><select data-a="town">' + towns + '</select></div>' +
      '<div class="row"><label>Semente</label><input data-a="seed" value="' + cr.seed + '" style="width:110px"><button class="small" data-a="reseed">🎲</button></div>' +
      '<div class="row"><label>Dificuldade</label><select data-a="preset">' + presets + '</select></div>' +
      '<div class="row"><label>Zumbis</label><select data-a="zspeed">' +
      [['shambler', 'Lentos (arrastados)'], ['mixed', 'Mistos'], ['fast', 'Rápidos'], ['sprinters', 'Corredores']].map(function (o) { return '<option value="' + o[0] + '"' + (cr.settings.zombieSpeed === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="row"><label>População</label><input type="range" min="0.2" max="2" step="0.1" value="' + cr.settings.popMult + '" data-a="pop"><span>' + cr.settings.popMult.toFixed(1) + '×</span></div>' +
      '<div class="row"><label>Saque</label><input type="range" min="0.3" max="2.5" step="0.1" value="' + cr.settings.lootMult + '" data-a="loot"><span>' + cr.settings.lootMult.toFixed(1) + '×</span></div>' +
      '<div class="row"><label>Infecção</label><label style="min-width:auto"><input type="checkbox" data-a="infection"' + (cr.settings.infection ? ' checked' : '') + '> mordidas transformam</label></div>' +
      '<div class="row"><label>Duração do dia</label><select data-a="daylen">' + [30, 60, 90, 120].map(function (m) { return '<option value="' + m + '"' + (m === cr.dayMinutes ? ' selected' : '') + '>' + m + ' min reais</option>'; }).join('') + '</select></div>' +
      '</div></div></div>';
    drawPreview();
  }
  function drawPreview() {
    var cv = document.getElementById('preview');
    if (!cv) { return; }
    var g = cv.getContext('2d');
    g.clearRect(0, 0, cv.width, cv.height);
    var cr = UI.creation;
    var occOut = D.OCC_OUTFIT[cr.occupation] || (cr.female ? 'civil_f' : 'civil_m');
    var outfit = D.OUTFITS[occOut][0];
    var look = { skin: cr.look.skin, hair: cr.look.hair, hairStyle: cr.look.hairStyle, beard: cr.look.beard && !cr.female, shirt: '#3d5a80', pants: '#2f4f7f', shoes: '#e0e0e0', jacket: null };
    outfit.forEach(function (id) {
      var d = D.ITEMS[id]; if (!d || !d.cloth) { return; }
      var c = d.cloth.colors ? d.cloth.colors[0] : '#777';
      if (d.cloth.slot === 'shirt') { look.shirt = c; if (id === 'dress') { look.pants = c; } } else if (d.cloth.slot === 'jacket') { look.jacket = c; } else if (d.cloth.slot === 'pants') { look.pants = c; } else if (d.cloth.slot === 'shoes') { look.shoes = c; }
    });
    g.save(); g.scale(2.4, 2.4);
    var t = performance.now() / 1000;
    CP.Spr.drawHuman(g, 33, 72, look, { ang: Math.PI * 0.25 + Math.sin(t * 0.6) * 0.6, phase: (t * 0.8) % 1, moving: true }, 1);
    g.restore();
  }

  /* ================= INÍCIO / CARREGAMENTO ================= */
  function startGame() {
    var cr = UI.creation;
    var v = CP.Player.validate(cr);
    if (!v.ok) { return; }
    CP.Save.deleteSave().then(function () {
      G().newGame({ seed: cr.seed, townIndex: +cr.town, settings: Object.assign({}, cr.settings, { dayMinutes: cr.dayMinutes }), character: { name: cr.name, female: cr.female, occupation: cr.occupation, traits: cr.traits.slice(), look: cr.look } });
      enterGame();
      UI.toast('Você acorda em ' + W.macro.towns[+cr.town].name + '. Encontre comida, água e uma arma. Boa sorte.', 'info');
      UI.toast('Dica: F1 mostra os controles.', 'info');
      UI.creation = null;
      CP.Save.save();
    });
  }
  function continueGame() {
    $.screens.innerHTML = '<div class="screen solid"><div class="menu-box"><h2>Carregando...</h2></div></div>';
    CP.Save.load().then(function () { enterGame(); UI.toast('Jogo carregado.', 'good'); }).catch(function (e) { UI.showMenu(); UI.toast('Não foi possível carregar: ' + e.message, 'danger'); });
  }
  function enterGame() {
    UI.screen = 'game';
    UI.deathShown = false;
    $.screens.innerHTML = '';
    buildHud();
    UI.autosaveT = C.AUTOSAVE_SECONDS;
    if (!P().hotbar) { P().hotbar = ['', '', '', '', '']; }
  }

  /* ================= HUD ================= */
  function clearHud() {
    ['hud-top', 'moodles', 'hud-left', 'hud-bottom', 'hud-right', 'action-label', 'fps', 'build-hint', 'panels'].forEach(function (id) { $[id].innerHTML = ''; });
    UI.open = {};
    closeCtx();
  }
  function buildHud() {
    clearHud();
    $['hud-right'].innerHTML = [['inv', 'Inventário (I)'], ['health', 'Saúde (H)'], ['skills', 'Personagem (K)'], ['craft', 'Artesanato (B)'], ['map', 'Mapa (M)'], ['help', 'Ajuda (F1)'], ['pause', '☰']].map(function (b) { return '<button class="pe" data-a="toggle" data-p="' + b[0] + '">' + b[1] + '</button>'; }).join('');
    UI.hudT = 0;
  }
  function updateHud() {
    var p = P(), T = CP.Time;
    if (!p || !p.body) { return; }
    var wt = T.weather();
    var temp = Math.round(T.temperature(true));
    $['hud-top'].innerHTML = '<div class="hud-box"><div class="clock">' + T.clockText() + '</div><div class="clock-sub">Dia ' + (Math.floor(T.daysSurvived()) + 1) + ' · ' + esc(T.dateText()) + '</div><div class="clock-sub">' + wt.name + ' · ' + temp + '°C · ' + T.season() + (T.powerOn() ? '' : ' · <span class="warn">sem energia</span>') + '</div>' +
      '<div class="speed pe">' + C.GAME_SPEEDS.map(function (s, i) { return '<button class="pe' + (G().speedIndex === i ? ' on' : '') + '" data-a="speed" data-i="' + i + '">' + (i === 0 ? '▶' : '▶'.repeat(Math.min(3, i + 1))) + '</button>'; }).join('') + (p.sleeping ? ' <span class="warn">dormindo...</span>' : '') + '</div></div>';
    var ms = CP.Body.moodles(p);
    $.moodles.innerHTML = ms.map(function (m) {
      return '<div class="moodle pe" title="' + esc(m.name + ' — ' + m.desc) + '"><span class="lbl">' + esc(m.name) + '</span><div class="ic ' + (m.good ? 'good' : 'l' + m.level) + '">' + (MOODLE_ICONS[m.id] || '❔') + '</div></div>';
    }).join('');
    var b = p.body;
    var maxH = CP.Body.maxHealth(p);
    var cap = CP.Items.Inv.capacity(p), car = CP.Items.Inv.carried(p);
    $['hud-left'].innerHTML = '<div class="hud-box">' +
      '<div style="display:flex;justify-content:space-between;font-size:12px"><span>❤ Vida</span><span>' + Math.round(b.health) + '%</span></div><div class="statbar"><i style="width:' + Math.max(0, b.health) + '%;background:' + (b.health > 60 ? '#7ec46a' : (b.health > 30 ? '#e0a64a' : '#d9534f')) + '"></i></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12px"><span>💨 Fôlego</span><span>' + Math.round(b.stats.endurance * 100) + '%</span></div><div class="statbar"><i style="width:' + (b.stats.endurance * 100) + '%;background:#6aa8d8"></i></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12px"><span>🎒 Peso</span><span>' + U.round1(car) + ' / ' + U.round1(cap) + ' kg</span></div><div class="statbar"><i style="width:' + Math.min(100, car / cap * 100) + '%;background:' + (car > cap ? '#d9534f' : '#c9a24a') + '"></i></div>' +
      '<div style="font-size:12px" class="muted">' + (p.sneaking ? '🐾 Agachado · ' : '') + (p.running ? '🏃 Correndo · ' : '') + (p.flashlightOn ? '🔦 · ' : '') + 'Mortos: ' + G().state.kills + (maxH < 99 ? ' · vida máx. ' + Math.round(maxH) + '%' : '') + '</div></div>';
    // mãos e atalhos
    var hb = p.hotbar || ['', '', '', '', ''];
    function slot(it, k, cls) {
      if (!it) { return '<div class="slot pe ' + (cls || '') + '"><span class="k">' + k + '</span></div>'; }
      var d = D.ITEMS[it.id];
      var bar = '';
      if (d.weapon && it.cond !== undefined) { bar = '<div class="bar"><i style="width:' + Math.max(0, it.cond / d.weapon.cond * 100) + '%;background:' + (it.cond <= 0 ? '#d9534f' : '#7ec46a') + '"></i></div>'; }
      if (d.light) { bar = '<div class="bar"><i style="width:' + (it.charge * 100) + '%;background:#e0d06a"></i></div>'; }
      var am = d.gun ? '<span class="am">' + (it.ammo || 0) + '/' + d.gun.mag + '</span>' : '';
      return '<div class="slot pe ' + (cls || '') + '" title="' + esc(CP.Items.name(it)) + '"><span class="k">' + k + '</span>' + d.icon + bar + am + '</div>';
    }
    var hotHtml = hb.map(function (id, i) {
      if (!id) { return '<div class="slot pe" data-a="hot" data-i="' + i + '"><span class="k">' + (i + 1) + '</span></div>'; }
      var f = CP.Items.Inv.findId(p, id);
      var d = D.ITEMS[id];
      return '<div class="slot pe" data-a="hot" data-i="' + i + '" title="' + esc(d.name) + (f ? '' : ' (não está com você)') + '" style="' + (f ? '' : 'opacity:0.4') + '"><span class="k">' + (i + 1) + '</span>' + d.icon + '</div>';
    }).join('');
    $['hud-bottom'].innerHTML = slot(p.hand1, 'mão', 'hand') + slot(p.hand2, '2ª', 'hand') + '<div style="width:10px"></div>' + hotHtml;
    // ação em andamento
    var al = $['action-label'];
    if (p.action && p.action.time > 0.4) { al.style.display = 'block'; al.textContent = p.action.opts.name + ' — ' + Math.round(p.action.t / p.action.time * 100) + '%' + (p.queue.length ? ' (+' + p.queue.length + ')' : ''); } else if (p.reloadT > 0) { al.style.display = 'block'; al.textContent = 'Recarregando...'; } else { al.style.display = 'none'; }
    $.fps.textContent = UI.prefs.showFps ? (G().fps + ' FPS · ' + CP.Render.stats.ms.toFixed(1) + ' ms · ' + G().zombies.length + ' zumbis ativos') : '';
    var bh = $['build-hint'];
    if (CP.Build.mode) { bh.style.display = 'block'; bh.textContent = 'Construindo: ' + CP.Build.mode.def.name + ' — clique para colocar · R gira · Esc cancela'; } else { bh.style.display = 'none'; }
  }

  /* ================= AVISOS ================= */
  UI.toast = function (text, kind) {
    if (!$.toasts) { return; }
    var e = h('div', { class: 'toast ' + (kind || '') }, esc(text));
    $.toasts.appendChild(e);
    while ($.toasts.children.length > 5) { $.toasts.removeChild($.toasts.firstChild); }
    setTimeout(function () { e.style.opacity = '0'; }, kind === 'danger' ? 6000 : 4200);
    setTimeout(function () { if (e.parentNode) { e.parentNode.removeChild(e); } }, kind === 'danger' ? 6500 : 4700);
  };
  UI.say = function (p, text) { p.say = text; p.sayT = 2.2; };
  UI.hurtFlash = function () { UI.hurtT = 0.8; };
  UI.fatal = function (err) {
    var e = h('div', { class: 'fatal' }, 'Erro inesperado — o jogo foi pausado.\n\n' + esc(err && err.stack ? err.stack : String(err)) + '\n\nRecarregue a página (o último salvamento automático será usado).');
    root.appendChild(e);
  };

  /* ================= PAINÉIS ================= */
  var PANELS = {
    inv: { title: 'Inventário', render: renderInv },
    health: { title: 'Saúde', render: renderHealth },
    skills: { title: 'Personagem', render: renderSkills },
    craft: { title: 'Artesanato e construção', render: renderCraft },
    map: { title: 'Mapa', render: renderMap },
    help: { title: 'Como jogar', render: renderHelp },
    pause: { title: 'Pausa', render: renderPause }
  };
  UI.toggle = function (name, force) {
    var on = force !== undefined ? force : !UI.open[name];
    var id = 'p-' + name;
    var ex = document.getElementById(id);
    if (!on) { if (ex) { ex.parentNode.removeChild(ex); } UI.open[name] = false; if (name === 'pause') { G().paused = false; } return; }
    if (name === 'pause') { G().paused = true; }
    if (!ex) {
      ex = h('div', { class: 'panel', id: id }, '<div class="head"><b>' + PANELS[name].title + '</b><button class="x small" data-a="close" data-p="' + name + '">✕</button></div><div class="body"></div>');
      $.panels.appendChild(ex);
      if (name === 'pause') { ex.style.left = '50%'; ex.style.top = '50%'; ex.style.transform = 'translate(-50%,-50%)'; ex.style.width = '360px'; }
    }
    UI.open[name] = true;
    UI.sigs[name] = '';
    PANELS[name].render();
  };
  function body(name) { var e = document.getElementById('p-' + name); return e ? e.querySelector('.body') : null; }
  UI.openHealth = function () { UI.toggle('health', true); };
  UI.openCrafting = function () { UI.toggle('craft', true); };
  UI.openLoot = function (x, y, z) { UI.lootFocus = { x: x, y: y, z: z }; UI.toggle('inv', true); renderInv(); };
  UI.equip = function (it, hand) { CP.Use.equip(P(), it, hand); };

  /* arrastar painéis pelo cabeçalho */
  var drag = null;
  function startDrag(e) {
    var hd = e.target.closest('.panel .head');
    if (!hd || e.target.closest('button')) { return; }
    var pn = hd.parentNode;
    var r = pn.getBoundingClientRect();
    pn.style.transform = 'none'; pn.style.left = r.left + 'px'; pn.style.top = r.top + 'px';
    drag = { el: pn, dx: e.clientX - r.left, dy: e.clientY - r.top };
    function mv(ev) { if (drag) { drag.el.style.left = (ev.clientX - drag.dx) + 'px'; drag.el.style.top = Math.max(0, ev.clientY - drag.dy) + 'px'; } }
    function up() { drag = null; document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); }
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  }

  /* ---------- inventário + arredores ---------- */
  function nearbySources(p) {
    var out = [];
    var z = W.levelOf(p.z);
    var px = Math.floor(p.x), py = Math.floor(p.y);
    var seen = {};
    var focus = UI.lootFocus;
    var tiles = [];
    for (var dy = -1; dy <= 1; dy++) { for (var dx = -1; dx <= 1; dx++) { tiles.push([px + dx, py + dy]); } }
    if (focus && focus.z === z && U.dist(p.x, p.y, focus.x + 0.5, focus.y + 0.5) < 2.2) { tiles.unshift([focus.x, focus.y]); }
    tiles.forEach(function (t) {
      var x = t[0], y = t[1], k = x + ',' + y;
      if (seen[k]) { return; }
      seen[k] = 1;
      if (U.dist(p.x, p.y, x + 0.5, y + 0.5) > 2.0) { return; }
      // parede entre o jogador e o tile? (recipientes do outro lado de uma parede não)
      if ((x !== px || y !== py) && !W.lineOfSight(p.x, p.y, x + 0.5, y + 0.5, z, 4) && !(W.obj(x, y, z) && C.OBJ_INFO[W.obj(x, y, z)].solid)) { return; }
      var o = W.obj(x, y, z);
      if (o && C.OBJ_INFO[o].cap) {
        if (o === C.OBJ.CAR && !(W.odir(x, y, z) & 2)) { /* só a parte da frente do carro tem porta-malas */ } else {
          var cont = W.container(x, y, z);
          out.push({ name: C.OBJ_INFO[o].name, items: cont.items, cap: C.OBJ_INFO[o].cap, fridge: o === C.OBJ.FRIDGE, x: x, y: y });
        }
      }
      var ch = W.chunkAt(x, y);
      if (ch) {
        ch.corpses.forEach(function (c) { if (Math.floor(c.x) === x && Math.floor(c.y) === y && W.levelOf(c.z) === z) { out.push({ name: 'Corpo', items: c.items, cap: 30 }); } });
      }
      var fi = W.floorItems(x, y, z, true);
      if (fi.length || (x === px && y === py)) { out.push({ name: x === px && y === py ? 'Chão (aqui)' : 'Chão', items: fi, cap: 999, floor: true }); }
    });
    // comida da geladeira envelhece mais devagar (com energia)
    out.forEach(function (s) { s.items.forEach(function (it) { CP.Items.touch(it, s.fridge && CP.Time.powerAt(s.x, s.y) ? 0.2 : 1); }); });
    return out;
  }
  function itemRow(it, ref, extra) {
    var d = D.ITEMS[it.id];
    var w = CP.Items.weight(it);
    return '<div class="item" data-ref="' + ref + '" data-a="item" title="Clique: opções · Duplo clique: transferir"><span class="ico">' + d.icon + '</span><span class="nm">' + esc(CP.Items.name(it)) + '</span>' + (extra || '') + '<span class="wt">' + U.round1(w) + '</span></div>';
  }
  function renderInv() {
    var b = body('inv');
    if (!b) { return; }
    var p = P();
    UI.refs = [];
    function ref(o) { UI.refs.push(o); return UI.refs.length - 1; }
    var left = '';
    var conts = CP.Items.Inv.containers(p);
    conts.forEach(function (c) {
      var w = CP.Items.Inv.containerWeight(c.items);
      left += '<div class="sect"><div class="sect-h"><span>' + esc(c.name) + '</span><span>' + U.round1(w) + ' / ' + U.round1(c.cap) + ' kg</span></div><div class="capbar"><i style="width:' + Math.min(100, w / c.cap * 100) + '%"></i></div>';
      if (!c.items.length) { left += '<div class="muted" style="font-size:12px;padding:2px 6px">vazio</div>'; }
      sortItems(c.items).forEach(function (it) { left += itemRow(it, ref({ item: it, list: c.items, where: 'player', cont: c })); });
      left += '</div>';
    });
    // mãos e roupas
    var eq = '';
    ['hand1', 'hand2'].forEach(function (hnd) { var it = p[hnd]; if (it) { eq += itemRow(it, ref({ item: it, list: null, where: 'player', hand: hnd }), '<span class="tag">' + (hnd === 'hand1' ? 'mão' : '2ª mão') + '</span>'); } });
    for (var s in p.worn) { var it2 = p.worn[s]; if (it2) { eq += itemRow(it2, ref({ item: it2, list: null, where: 'player', worn: s }), '<span class="tag worn">vestido</span>'); } }
    left += '<div class="sect"><div class="sect-h"><span>Equipado e vestido</span></div>' + (eq || '<div class="muted">nada</div>') + '</div>';
    // arredores
    var right = '';
    var srcs = nearbySources(p);
    UI.lootSources = srcs;
    srcs.forEach(function (sct, si) {
      var w = CP.Items.Inv.containerWeight(sct.items);
      right += '<div class="sect"><div class="sect-h"><span>' + esc(sct.name) + (sct.fridge ? (CP.Time.powerAt(sct.x, sct.y) ? ' ❄' : ' (desligada)') : '') + '</span><span>' + (sct.floor ? '' : U.round1(w) + ' / ' + sct.cap + ' kg ') + (sct.items.length ? '<button class="small" data-a="takeall" data-s="' + si + '">Pegar tudo</button>' : '') + '</span></div>';
      if (!sct.items.length) { right += '<div class="muted" style="font-size:12px;padding:2px 6px">vazio</div>'; }
      sortItems(sct.items).forEach(function (it) { right += itemRow(it, ref({ item: it, list: sct.items, where: 'loot', src: sct })); });
      right += '</div>';
    });
    if (!srcs.length) { right = '<div class="muted">Nada por perto. Chegue perto de móveis, corpos ou itens no chão.</div>'; }
    b.innerHTML = '<div class="cols"><div><div class="sect-h" style="color:#fff"><span>VOCÊ</span></div>' + left + '</div><div><div class="sect-h" style="color:#fff"><span>ARREDORES</span></div>' + right + '</div></div>';
    UI.sigs.inv = invSig();
  }
  function sortItems(list) {
    var order = { weapon: 0, firearm: 0, ammo: 1, food: 2, drink: 3, medical: 4, tool: 5, bag: 6, clothing: 7, book: 8, material: 9, seed: 10, electronics: 5, throwable: 1, misc: 11, junk: 12 };
    return list.slice().sort(function (a, b) {
      var da = D.ITEMS[a.id], db = D.ITEMS[b.id];
      return (order[da.cat] || 9) - (order[db.cat] || 9) || da.name.localeCompare(db.name);
    });
  }
  function invSig() {
    var p = P();
    var s = '';
    CP.Items.Inv.all(p).forEach(function (o) { s += o.item.id + (o.item.n || '') + (o.item.uses || '') + (o.item.ammo || '') + (o.item.cond || '') + (o.item.portion || '') + '|'; });
    for (var k in p.worn) { s += p.worn[k] ? p.worn[k].id : '-'; }
    s += '#' + Math.floor(p.x) + ',' + Math.floor(p.y) + ',' + W.levelOf(p.z) + '#';
    (UI.lootSources || []).forEach(function (src) { s += src.items.length + ':' + src.items.map(function (i) { return i.id + (i.n || ''); }).join(',') + ';'; });
    return s;
  }
  /* transferências levam tempo (como no PZ) */
  function transferTime(p, it) { return (0.25 + Math.min(3, CP.Items.weight(it) * 0.12)) * (p.fx.invSpeed || 1); }
  function moveToPlayer(r, dest) {
    var p = P();
    var it = r.item;
    var target = dest || p.inv;
    var cap = dest ? null : CP.Items.Inv.capacity(p) * 2.5;
    if (cap && CP.Items.Inv.containerWeight(p.inv) + CP.Items.weight(it) > Math.max(cap, C.CARRY_HARD_MAX)) { UI.toast('Você não consegue carregar mais nada.', 'warn'); return; }
    CP.Actions.start(p, { name: 'Pegando ' + D.ITEMS[it.id].name, time: transferTime(p, it), onDone: function () {
      if (r.list.indexOf(it) < 0) { return; }
      CP.Items.Inv.removeFrom(r.list, it);
      if (D.ITEMS[it.id].food && r.src && r.src.fridge) { CP.Items.touch(it, 0.2); }
      CP.Items.Inv.addTo(target, it);
      if (UI.open.inv) { renderInv(); }
    } });
  }
  function moveToList(r, list, cap, name) {
    var p = P();
    var it = r.item;
    if (cap && CP.Items.Inv.containerWeight(list) + CP.Items.weight(it) > cap) { UI.toast(name + ' está cheio.', 'warn'); return; }
    CP.Actions.start(p, { name: 'Guardando', time: transferTime(p, it), onDone: function () {
      CP.Items.Inv.detach(p, it);
      if (r.list) { CP.Items.Inv.removeFrom(r.list, it); }
      CP.Items.Inv.addTo(list, it);
      if (it === p.hand1 || it === p.hand2) { p.hand1 = p.hand1 === it ? null : p.hand1; p.hand2 = p.hand2 === it ? null : p.hand2; }
      if (UI.open.inv) { renderInv(); }
    } });
  }
  function itemMenu(refIdx, mx, my) {
    var r = UI.refs[refIdx];
    if (!r) { return; }
    var p = P();
    var it = r.item;
    var opts = [];
    if (r.where === 'loot') {
      opts.push({ label: 'Pegar', fn: function () { moveToPlayer(r); } });
      var bag = p.worn.back;
      if (bag) { opts.push({ label: 'Pegar para ' + D.ITEMS[bag.id].name.toLowerCase(), fn: function () { moveToPlayer(r, bag.items); } }); }
      var d = D.ITEMS[it.id];
      if (d.food && !d.food.canned && !d.food.needsCooking) { opts.push({ label: 'Comer daqui', fn: function () { r.list.splice(r.list.indexOf(it), 1); CP.Items.Inv.give(p, it); CP.Use.eat(p, it, 1); } }); }
      if (d.cloth) { opts.push({ label: 'Vestir', fn: function () { r.list.splice(r.list.indexOf(it), 1); CP.Use.wearItem(p, it); } }); }
      if (d.weapon || d.gun) { opts.push({ label: 'Equipar', fn: function () { r.list.splice(r.list.indexOf(it), 1); CP.Use.equip(p, it, 'hand1'); renderInv(); } }); }
    } else {
      opts = CP.Use.itemOptions(p, it, 'player');
      // guardar em recipientes
      (UI.lootSources || []).forEach(function (s) {
        if (s.name.indexOf('Chão') === 0) { return; }
        opts.push({ label: 'Guardar em: ' + s.name.toLowerCase(), fn: function () { moveToList(r, s.items, s.cap, s.name); } });
      });
      CP.Items.Inv.containers(p).forEach(function (c) {
        if (c.items === r.list || c.owner === it) { return; }
        opts.push({ label: 'Mover para ' + c.name.toLowerCase(), fn: function () { moveToList(r, c.items, c.main ? null : c.cap, c.name); } });
      });
      opts.push({ label: 'Atalho...', sub: true });
      for (var i = 0; i < 5; i++) { (function (k) { opts.push({ label: '   pôr no atalho ' + (k + 1), fn: function () { p.hotbar[k] = it.id; updateHud(); } }); })(i); }
    }
    showCtx(opts, mx, my, D.ITEMS[it.id].name + describeItem(it));
  }
  function describeItem(it) {
    var d = D.ITEMS[it.id];
    var bits = [];
    if (d.weapon && !d.gun) { bits.push('dano ' + d.weapon.dmin + '–' + d.weapon.dmax + ', ' + CP.Items.condText(it)); }
    if (d.cloth) { bits.push('mordida ' + d.cloth.bite + ' / arranhão ' + d.cloth.scratch); }
    if (d.bag) { bits.push('cap. ' + d.bag.cap + ' kg, −' + Math.round(d.bag.wr * 100) + '% peso'); }
    if (d.food && P().fx.nutrition) { bits.push(d.food.cal + ' kcal'); }
    return bits.length ? ' · ' + bits.join(' · ') : '';
  }

  /* ---------- saúde ---------- */
  function renderHealth() {
    var b = body('health');
    if (!b) { return; }
    var p = P(), bd = p.body;
    var Inv = CP.Items.Inv;
    var hasBandage = !!Inv.find(p, function (it) { var d = D.ITEMS[it.id]; return d.med && d.med.type === 'bandage'; });
    var hasDis = !!Inv.find(p, function (it) { var d = D.ITEMS[it.id]; return d.med && d.med.type === 'disinfect'; }) || !!Inv.findId(p, 'whiskey');
    var hasNeedle = !!Inv.findId(p, 'suture_needle') || (!!Inv.findTag(p, 'needle') && !!Inv.findTag(p, 'thread'));
    var hasTw = !!Inv.findId(p, 'tweezers'), hasSplint = !!Inv.findId(p, 'splint');
    var html = '<div class="row"><b style="font-size:18px">Vida: ' + Math.round(bd.health) + '%</b><span class="muted">(máx. ' + Math.round(CP.Body.maxHealth(p)) + '%)</span></div>';
    var s = bd.stats;
    html += '<div class="muted" style="font-size:12px">Temperatura ' + s.temp.toFixed(1) + '°C · Peso ' + s.weight.toFixed(1) + ' kg' + (p.fx.nutrition ? ' · Calorias ' + Math.round(s.calories) : '') + ' · Dor ' + Math.round(CP.Body.pain(p)) + '</div>';
    if (bd.infection && bd.infection.p > 0.35) { html += '<div class="danger" style="margin:6px 0">Você está com febre alta e se sentindo cada vez pior...</div>'; }
    var any = false;
    D.BODY_PARTS.forEach(function (bp) {
      var part = bd.parts[bp.id];
      if (!part.wounds.length) { return; }
      any = true;
      html += '<div class="part"><b>' + bp.name + '</b>';
      part.wounds.forEach(function (w) {
        var st = [];
        if (w.bleeding && !w.bandage) { st.push('<span class="danger">sangrando</span>'); }
        if (w.bandage) { st.push(w.bandage.dirty > 0.7 ? '<span class="warn">curativo sujo</span>' : 'com curativo'); }
        if (w.disinfected) { st.push('desinfetado'); }
        if (w.stitched) { st.push('costurado'); }
        if (w.splint) { st.push('com tala'); }
        if (w.foreign) { st.push('<span class="warn">objeto alojado</span>'); }
        if (w.infected > 0.2) { st.push('<span class="danger">infeccionado</span>'); }
        html += '<div class="wd">• ' + D.WOUND_NAMES[w.type] + ' — ' + Math.round(Math.max(0, w.sev) * 100) + '% ' + (st.length ? '(' + st.join(', ') + ')' : '') + '</div>';
      });
      var hasBand = part.wounds.some(function (w) { return w.bandage; });
      html += '<div class="btns">' +
        (hasBand ? '<button class="small" data-a="treat" data-part="' + bp.id + '" data-k="unbandage">Tirar curativo</button>' : '') +
        '<button class="small" data-a="treat" data-part="' + bp.id + '" data-k="bandage"' + (hasBandage ? '' : ' disabled title="Sem bandagem/pano"') + '>Fazer curativo</button>' +
        '<button class="small" data-a="treat" data-part="' + bp.id + '" data-k="disinfect"' + (hasDis ? '' : ' disabled title="Sem desinfetante"') + '>Desinfetar</button>' +
        (part.wounds.some(function (w) { return (w.type === 'deep' || w.type === 'laceration') && !w.stitched; }) ? '<button class="small" data-a="treat" data-part="' + bp.id + '" data-k="stitch"' + (hasNeedle ? '' : ' disabled title="Sem agulha"') + '>Costurar</button>' : '') +
        (part.wounds.some(function (w) { return w.foreign; }) ? '<button class="small" data-a="treat" data-part="' + bp.id + '" data-k="tweezers"' + (hasTw ? '' : ' disabled title="Sem pinça"') + '>Remover objeto</button>' : '') +
        (part.wounds.some(function (w) { return w.type === 'fracture' && !w.splint; }) ? '<button class="small" data-a="treat" data-part="' + bp.id + '" data-k="splint"' + (hasSplint ? '' : ' disabled title="Sem tala"') + '>Pôr tala</button>' : '') +
        '</div></div>';
    });
    if (!any) { html += '<div class="good" style="margin-top:8px">Nenhum ferimento.</div>'; }
    html += '<h3>Proteção das roupas</h3><div class="muted" style="font-size:12px">' + ['head', 'neck', 'torso', 'farmR', 'handR', 'thighL', 'shinL', 'footL'].map(function (id) { var pr = CP.Body.protection(p, id); return D.PART[id].name + ': ' + Math.round(pr.bite) + '/' + Math.round(pr.scratch); }).join(' · ') + ' <i>(mordida/arranhão)</i></div>';
    b.innerHTML = html;
    UI.sigs.health = healthSig();
  }
  function healthSig() {
    var p = P(), s = Math.round(p.body.health) + '|';
    for (var k in p.body.parts) { p.body.parts[k].wounds.forEach(function (w) { s += k + w.type + Math.round(w.sev * 20) + (w.bandage ? 'b' + Math.round(w.bandage.dirty * 4) : '') + (w.bleeding ? 's' : '') + (w.stitched ? 'c' : '') + (w.disinfected ? 'd' : ''); }); }
    return s + CP.Items.Inv.all(p).length;
  }

  /* ---------- habilidades / personagem ---------- */
  function renderSkills() {
    var b = body('skills');
    if (!b) { return; }
    var p = P();
    var html = '<div><b>' + esc(p.name) + '</b> — ' + esc(D.OCC[p.occupation].name) + '</div>';
    var tr = p.traits.map(function (t) { return D.TRAIT[t] ? D.TRAIT[t].name : t; });
    html += '<div class="muted" style="font-size:12px;margin:4px 0">Traços: ' + (tr.length ? tr.map(esc).join(', ') : 'nenhum') + '</div>';
    html += '<div class="muted" style="font-size:12px">Dias sobrevividos: ' + Math.floor(CP.Time.daysSurvived()) + ' · Zumbis mortos: ' + p.kills + ' · Livros lidos: ' + Object.keys(p.readBooks).length + ' · Receitas: ' + p.knownRecipes.length + '</div>';
    var cat = '';
    D.SKILLS.forEach(function (s) {
      if (s.cat !== cat) { cat = s.cat; html += '<h3>' + cat + '</h3>'; }
      var lv = p.skills[s.id];
      var need = C.SKILL_XP[lv] || 1;
      var mult = CP.Player.xpMult(p, s.id);
      var pips = '';
      for (var i = 0; i < 10; i++) { pips += '<i class="' + (i < lv ? 'on' : '') + '"></i>'; }
      html += '<div class="skill"><span>' + s.name + '</span><div><div class="pips">' + pips + '</div><div class="xpbar"><i style="width:' + (lv >= 10 ? 100 : Math.min(100, p.xp[s.id] / need * 100)) + '%"></i></div></div><span class="muted" style="font-size:11px">' + (mult > 1.01 ? '×' + mult.toFixed(1) : (mult < 0.99 ? '×' + mult.toFixed(1) : '')) + '</span></div>';
    });
    b.innerHTML = html;
  }

  /* ---------- artesanato / construção ---------- */
  function renderCraft() {
    var b = body('craft');
    if (!b) { return; }
    var p = P();
    var html = '<div class="tabs">' + [['recipes', 'Receitas'], ['build', 'Construção'], ['water', 'Água e cozinha']].map(function (t) { return '<button class="small' + (UI.craftTab === t[0] ? ' on' : '') + '" data-a="ctab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (UI.craftTab === 'recipes') {
      D.RECIPES.forEach(function (r) {
        if (r.learned && p.knownRecipes.indexOf(r.id) < 0) { return; }
        var st = CP.Use.recipeStatus(p, r);
        html += '<div class="recipe"><div><b>' + esc(r.name) + '</b>' + (st.ok ? '' : '<div class="miss">' + st.missing.map(esc).join(' · ') + '</div>') + '</div><button class="small' + (st.ok ? ' primary' : '') + '" data-a="craft" data-id="' + r.id + '"' + (st.ok ? '' : ' disabled') + '>Fazer</button></div>';
      });
      var hidden = D.RECIPES.filter(function (r) { return r.learned && p.knownRecipes.indexOf(r.id) < 0; }).length;
      if (hidden) { html += '<div class="muted" style="font-size:12px">+' + hidden + ' receita(s) desconhecida(s) — leia revistas para aprender.</div>'; }
    } else if (UI.craftTab === 'build') {
      html += '<div class="muted" style="font-size:12px;margin-bottom:6px">Escolha o que construir e clique no mundo. Barricadas: clique direito numa porta/janela.</div>';
      D.BUILDS.forEach(function (bd) {
        if (bd.recipe && p.knownRecipes.indexOf(bd.recipe) < 0) { return; }
        var st = CP.Build.status(p, bd);
        html += '<div class="recipe"><div><b>' + esc(bd.name) + '</b> <span class="muted" style="font-size:11px">' + bd.mats.map(function (m) { return m.n + '× ' + D.ITEMS[m.item].name; }).join(', ') + (bd.tool ? ' · ' + bd.tool : '') + (bd.skill ? ' · Carpintaria ' + bd.skill : '') + '</span>' + (st.ok ? '' : '<div class="miss">' + st.missing.map(esc).join(' · ') + '</div>') + '</div><button class="small' + (st.ok ? ' primary' : '') + '" data-a="build" data-id="' + bd.id + '"' + (st.ok ? '' : ' disabled') + '>Construir</button></div>';
      });
    } else {
      var heat = CP.Use.nearHeat(p);
      html += '<div class="recipe"><div><b>Ferver água</b><div class="muted" style="font-size:12px">Panela com água + fogão com energia ou fogueira. Enche até 3 garrafas com água limpa.</div>' + (heat ? '' : '<div class="miss">Sem fonte de calor por perto</div>') + '</div><button class="small" data-a="boil"' + (heat && CP.Items.Inv.findId(p, 'pot_water') ? '' : ' disabled') + '>Ferver</button></div>';
      html += '<div class="muted" style="font-size:12px">Comida crua (bife, frango, peixe, ovo, batata, pizza) pode ser cozida pelo menu do item quando você estiver perto de calor.</div>';
    }
    b.innerHTML = html;
  }

  /* ---------- mapa ---------- */
  var MAP_COLORS = { 0: '#3a3530', 1: '#2f4a28', 2: '#4f6a34', 3: '#6a6a3a', 4: '#5a5a5e', 5: '#6a6a70', 6: '#2c5470' };
  function renderMap() {
    var b = body('map');
    if (!b) { return; }
    b.innerHTML = '<div class="tabs"><button class="small' + (UI.mapMode === 'region' ? ' on' : '') + '" data-a="mapmode" data-m="region">Região</button><button class="small' + (UI.mapMode === 'local' ? ' on' : '') + '" data-a="mapmode" data-m="local">Local</button></div><canvas id="mapc" width="576" height="576"></canvas><div class="muted" style="font-size:12px;margin-top:6px">' + (P().mapRevealed ? 'Mapa da região completo.' : 'Só aparecem os lugares que você já viu. Leia um mapa (posto de gasolina) para ver tudo.') + '</div>';
    drawMap();
  }
  function drawMap() {
    var cv = document.getElementById('mapc');
    if (!cv) { return; }
    var g = cv.getContext('2d'), p = P(), m = W.macro;
    g.fillStyle = '#0c0d0f'; g.fillRect(0, 0, cv.width, cv.height);
    var x, y;
    if (UI.mapMode === 'region') {
      var s = cv.width / m.n;
      for (y = 0; y < m.n; y++) {
        for (x = 0; x < m.n; x++) {
          var ch = W.chunkByIndex(x, y);
          var known = p.mapRevealed || (ch && ch.seen);
          if (!known) { continue; }
          var t = m.type[y * m.n + x];
          g.fillStyle = MAP_COLORS[t] || '#444';
          g.fillRect(x * s, y * s, s + 0.5, s + 0.5);
          g.fillStyle = '#26272a';
          if (m.roadN[y * m.n + x]) { g.fillRect(x * s, y * s, s, s * 0.16); }
          if (m.roadW[y * m.n + x]) { g.fillRect(x * s, y * s, s * 0.16, s); }
        }
      }
      g.font = '11px system-ui'; g.fillStyle = '#e8e4da'; g.textAlign = 'center';
      m.towns.forEach(function (t) { var ch = W.chunkByIndex(t.x, t.y); if (p.mapRevealed || (ch && ch.seen)) { g.fillText(t.name, t.x * s + s / 2, t.y * s - 4); } });
      g.fillStyle = '#ff4040';
      g.beginPath(); g.arc(p.x / C.CHUNK * s, p.y / C.CHUNK * s, 4, 0, Math.PI * 2); g.fill();
    } else {
      var R = 96, sc = cv.width / (R * 2);
      var ox = Math.floor(p.x) - R, oy = Math.floor(p.y) - R;
      var colors = ['#000', '#4a6a34', '#6a5a44', '#36373b', '#8a8984', '#7a5a38', '#b8bcb8', '#6a5060', '#2c5470', '#b8a878', '#4a3a2a', '#5a3a30', '#7a7974', '#7a746e', '#a8a28a', '#3e5a2a', '#4a3a2a', '#36373b', '#6a7a3a'];
      for (y = 0; y < R * 2; y++) {
        for (x = 0; x < R * 2; x++) {
          var wx = ox + x, wy = oy + y;
          var cc = W.chunkAt(wx, wy);
          if (!cc || !cc.seen || !cc.seen[W.idx(wx, wy)]) { continue; }
          var f = cc.levels[0].floor[W.idx(wx, wy)];
          var o = cc.levels[0].obj[W.idx(wx, wy)];
          g.fillStyle = W.isIndoor(wx, wy, 0) ? '#8a7a6a' : (o && C.OBJ_INFO[o].tree ? '#2a4020' : colors[f] || '#555');
          g.fillRect(x * sc, y * sc, sc + 0.4, sc + 0.4);
          var l = cc.levels[0], ii = W.idx(wx, wy);
          if (l.wn[ii] === C.EDGE.WALL || l.wn[ii] === C.EDGE.WINDOW) { g.fillStyle = '#ddd'; g.fillRect(x * sc, y * sc, sc, 1); }
          if (l.ww[ii] === C.EDGE.WALL || l.ww[ii] === C.EDGE.WINDOW) { g.fillStyle = '#ddd'; g.fillRect(x * sc, y * sc, 1, sc); }
        }
      }
      g.fillStyle = '#ff4040'; g.beginPath(); g.arc(R * sc, R * sc, 4, 0, Math.PI * 2); g.fill();
    }
  }

  /* ---------- ajuda ---------- */
  function renderHelp() {
    var b = body('help');
    b.innerHTML = '<div class="keys">' + [
      ['W A S D / setas', 'Andar (relativo à tela)'], ['Shift', 'Correr (gasta fôlego)'], ['C', 'Agachar / andar furtivo'],
      ['Clique esquerdo', 'Atacar com a arma na mão (sem arma: empurrar)'], ['Segurar botão direito', 'Mirar (armas de fogo / arremessos) — clique esquerdo dispara'],
      ['Clique direito rápido', 'Menu de contexto (portas, janelas, móveis, chão...)'], ['Espaço', 'Empurrar zumbi / pisar em zumbi caído'], ['E', 'Interagir com o que está à frente'],
      ['R', 'Recarregar arma (no modo construção: girar)'], ['F', 'Lanterna'], ['Q', 'Gritar (atrai zumbis!)'], ['Z', 'Sentar / levantar'],
      ['I ou Tab', 'Inventário e saque'], ['H', 'Saúde (curativos)'], ['K', 'Personagem e habilidades'], ['B', 'Artesanato e construção'], ['M', 'Mapa'],
      ['1 a 5', 'Atalhos (equipar item)'], ['[ e ]', 'Velocidade do tempo (só sem zumbis por perto)'], ['Roda do mouse / + −', 'Zoom'], ['Esc', 'Fechar janela / pausa']
    ].map(function (k) { return '<b>' + k[0] + '</b><span>' + k[1] + '</span>'; }).join('') + '</div>' +
      '<h3>Dicas</h3><div style="font-size:13px;line-height:1.5">• Zumbis ouvem barulho e veem você. Ande agachado, evite correr perto deles.<br>• Uma mordida quase sempre é fatal (infecção). Arranhões e cortes têm chance menor. Roupas grossas protegem.<br>• Empurre (Espaço) e pise em zumbis caídos para economizar arma e fôlego.<br>• Barrique janelas e portas (martelo + tábuas + pregos). Desmonte móveis para conseguir tábuas.<br>• A energia e a água acabam em algumas semanas: encha garrafas e panelas antes.<br>• Quando o helicóptero passar, fique dentro de uma construção.<br>• Durma em camas (clique direito) e leia livros para multiplicar o XP.<br>• O jogo salva sozinho a cada minuto. Morreu, acabou: começa um novo sobrevivente.</div>';
  }
  function renderPause() {
    var b = body('pause');
    b.innerHTML = '<button class="primary" style="width:100%;margin:4px 0" data-a="close" data-p="pause">Continuar</button>' +
      '<button style="width:100%;margin:4px 0" data-a="save">Salvar agora</button>' +
      '<button style="width:100%;margin:4px 0" data-a="toggle" data-p="help">Controles</button>' +
      '<h3>Configurações</h3>' +
      '<div class="row"><label>Volume</label><input type="range" min="0" max="1" step="0.05" value="' + UI.prefs.volume + '" data-a="volume"></div>' +
      '<div class="row"><label>Mostrar FPS</label><input type="checkbox" data-a="fps"' + (UI.prefs.showFps ? ' checked' : '') + '></div>' +
      '<button class="danger" style="width:100%;margin-top:10px" data-a="quit">Salvar e sair para o menu</button>';
  }

  /* ---------- morte ---------- */
  function showDeath() {
    if (UI.deathShown) { return; }
    UI.deathShown = true;
    var p = P();
    CP.Save.deleteSave();
    var days = CP.Time.daysSurvived();
    $.screens.innerHTML = '<div class="screen"><div class="death"><h1>Assim você morreu</h1><div class="cause">' + esc(p.deathCause) + '</div>' +
      '<div class="stats"><span>Sobrevivente</span><b>' + esc(p.name) + '</b><span>Ocupação</span><b>' + esc(D.OCC[p.occupation].name) + '</b>' +
      '<span>Sobreviveu</span><b>' + plural(Math.floor(days), 'dia', 'dias') + ' e ' + plural(Math.floor((days % 1) * 24), 'hora', 'horas') + '</b><span>Zumbis mortos</span><b>' + p.kills + '</b>' +
      '<span>Habilidade mais alta</span><b>' + bestSkill(p) + '</b></div>' +
      '<button class="primary" data-a="menu-new">Novo sobrevivente</button> <button data-a="to-menu">Menu</button></div></div>';
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function bestSkill(p) {
    var best = null;
    D.SKILLS.forEach(function (s) { if (s.passive) { return; } if (!best || p.skills[s.id] > p.skills[best.id]) { best = s; } });
    return best ? best.name + ' ' + p.skills[best.id] : '—';
  }

  /* ================= MENU DE CONTEXTO ================= */
  function showCtx(opts, x, y, title) {
    closeCtx();
    var box = h('div', { class: 'ctx' });
    var html = title ? '<div class="ctx-title">' + esc(title) + '</div>' : '';
    if (!opts.length) { html += '<div class="dis">Nada a fazer aqui</div>'; }
    UI.ctxOpts = opts;
    opts.forEach(function (o, i) {
      if (o.sub) { html += '<div class="ctx-title">' + esc(o.label) + '</div>'; return; }
      html += '<div class="' + (o.disabled ? 'dis' : '') + '" data-a="ctx" data-i="' + i + '"><span>' + esc(o.label) + '</span>' + (o.disabled && o.hint ? '<span class="hint">' + esc(o.hint) + '</span>' : (o.key ? '<span class="hint">' + o.key + '</span>' : '')) + '</div>';
    });
    box.innerHTML = html;
    $.ctxwrap.appendChild(box);
    var r = box.getBoundingClientRect();
    box.style.left = Math.min(x, window.innerWidth - r.width - 6) + 'px';
    box.style.top = Math.min(y, window.innerHeight - r.height - 6) + 'px';
    UI.ctxOpen = true;
  }
  function closeCtx() {
    if ($.ctxwrap) { $.ctxwrap.innerHTML = ''; }
    if (UI.ctxOpen) { UI.lastCtxClose = performance.now(); }
    UI.ctxOpen = false;
  }
  UI.showCtx = showCtx;

  /* ================= EVENTOS DOM ================= */
  function onClick(e) {
    var t = e.target.closest('[data-a]');
    if (!t) { return; }
    var a = t.getAttribute('data-a');
    var cr = UI.creation;
    switch (a) {
      case 'menu-new': UI.creation = null; UI.toggle('pause', false); UI.showCreate(); break;
      case 'menu-continue': continueGame(); break;
      case 'to-menu': UI.showMenu(); G().running = false; break;
      case 'help': UI.toggle('help', true); break;
      case 'create-back': UI.creation = null; UI.showMenu(); break;
      case 'create-start': startGame(); break;
      case 'occ': cr.occupation = t.getAttribute('data-id'); cr.traits = cr.traits.filter(function (x) { return (D.OCC[cr.occupation].traits || []).indexOf(x) < 0; }); renderCreate(); break;
      case 'trait':
        var id = t.getAttribute('data-id');
        cr.sel = id;
        if (t.classList.contains('off')) { renderCreate(); break; }
        var i = cr.traits.indexOf(id);
        if (i >= 0) { cr.traits.splice(i, 1); } else { cr.traits.push(id); }
        renderCreate(); break;
      case 'sex': cr.female = t.getAttribute('data-v') === 'f'; if (cr.female) { cr.look.beard = false; } renderCreate(); break;
      case 'look': cr.look[t.getAttribute('data-k')] = t.getAttribute('data-v'); renderCreate(); break;
      case 'reseed': cr.seed = (Math.random() * 1e9) >>> 0; W.init(cr.seed); cr.town = 0; renderCreate(); break;
      case 'toggle': UI.toggle(t.getAttribute('data-p')); break;
      case 'close': UI.toggle(t.getAttribute('data-p'), false); break;
      case 'speed': G().speedIndex = +t.getAttribute('data-i'); clampSpeed(); updateHud(); break;
      case 'hot': hotbar(+t.getAttribute('data-i')); break;
      case 'item': itemMenu(+t.getAttribute('data-ref'), e.clientX, e.clientY); break;
      case 'takeall':
        var src = UI.lootSources[+t.getAttribute('data-s')];
        if (src) { src.items.slice().forEach(function (it) { moveToPlayer({ item: it, list: src.items, src: src }); }); }
        break;
      case 'ctx':
        var o = UI.ctxOpts[+t.getAttribute('data-i')];
        closeCtx();
        if (o && !o.disabled && o.fn) { o.fn(); setTimeout(refreshOpen, 50); }
        break;
      case 'treat': CP.Use.treat(P(), t.getAttribute('data-part'), t.getAttribute('data-k')); break;
      case 'ctab': UI.craftTab = t.getAttribute('data-t'); renderCraft(); break;
      case 'craft': CP.Use.craft(P(), D.RECIPE[t.getAttribute('data-id')]); setTimeout(renderCraft, 100); break;
      case 'build': CP.Build.start(D.BUILD[t.getAttribute('data-id')]); UI.toggle('craft', false); break;
      case 'boil': CP.Use.boil(P()); break;
      case 'mapmode': UI.mapMode = t.getAttribute('data-m'); renderMap(); break;
      case 'save': CP.Save.save().then(function (ok) { if (ok) { UI.toast('Jogo salvo.', 'good'); } }); break;
      case 'quit': CP.Save.save().then(function () { UI.toggle('pause', false); G().running = false; UI.showMenu(); }); break;
    }
  }
  function onDblClick(e) {
    var t = e.target.closest('[data-ref]');
    if (!t) { return; }
    var r = UI.refs[+t.getAttribute('data-ref')];
    if (!r) { return; }
    closeCtx();
    if (r.where === 'loot') { moveToPlayer(r); } else if (UI.lootSources && UI.lootSources.length) {
      var dest = UI.lootSources.filter(function (s) { return s.name.indexOf('Chão') !== 0; })[0] || UI.lootSources[0];
      moveToList(r, dest.items, dest.floor ? null : dest.cap, dest.name);
    }
  }
  function onInput(e) {
    var t = e.target;
    var a = t.getAttribute('data-a');
    var cr = UI.creation;
    if (!a) { return; }
    switch (a) {
      case 'name': cr.name = t.value; break;
      case 'hairstyle': cr.look.hairStyle = t.value; drawPreview(); break;
      case 'beard': cr.look.beard = t.checked; break;
      case 'town': cr.town = +t.value; break;
      case 'seed': if (e.type === 'change') { cr.seed = (Number(t.value) >>> 0) || 1; W.init(cr.seed); cr.town = 0; setTimeout(renderCreate, 0); } break;
      case 'preset': if (e.type === 'change') { cr.preset = t.value; cr.settings = Object.assign({}, PRESETS[t.value]); setTimeout(renderCreate, 0); } break;
      case 'zspeed': cr.settings.zombieSpeed = t.value; break;
      case 'pop': cr.settings.popMult = +t.value; t.nextSibling.textContent = (+t.value).toFixed(1) + '×'; break;
      case 'loot': cr.settings.lootMult = +t.value; t.nextSibling.textContent = (+t.value).toFixed(1) + '×'; break;
      case 'infection': cr.settings.infection = t.checked; break;
      case 'daylen': cr.dayMinutes = +t.value; break;
      case 'volume': UI.prefs.volume = +t.value; CP.Audio.setVolume(UI.prefs.volume); CP.Save.saveSettings(UI.prefs); break;
      case 'fps': UI.prefs.showFps = t.checked; CP.Save.saveSettings(UI.prefs); break;
    }
  }
  function refreshOpen() {
    if (UI.open.inv) { renderInv(); }
    if (UI.open.health) { renderHealth(); }
    if (UI.open.craft) { renderCraft(); }
  }

  /* ================= ENTRADA DO JOGO ================= */
  function hotbar(i) {
    var p = P();
    var id = p.hotbar && p.hotbar[i];
    if (!id) { UI.toast('Atalho ' + (i + 1) + ' vazio. No inventário, clique num item → "pôr no atalho".'); return; }
    if (p.hand1 && p.hand1.id === id) { CP.Use.unequip(p, p.hand1); return; }
    var f = CP.Items.Inv.findId(p, id);
    if (!f) { UI.toast('Você não tem ' + D.ITEMS[id].name.toLowerCase() + '.', 'warn'); return; }
    CP.Use.equip(p, f.item, 'hand1');
  }
  function clampSpeed() {
    var p = P();
    if (G().speedIndex > 0) {
      var danger = CP.Zombies.near(p.x, p.y, 14, []).some(function (z) { return z.state === 'chase' || z.state === 'attack'; });
      if (danger) { G().speedIndex = 0; UI.toast('Não dá para acelerar o tempo com zumbis atrás de você.', 'warn'); }
    }
  }
  UI.handleInput = function () {
    var In = CP.Input, p = P();
    if (!p) { return; }
    var keys = In.consumePressed();
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i].code;
      if (p.sleeping && !p.dead) { CP.Body.wake(p, 'Você acordou.'); continue; }
      if (p.dead) { continue; }
      switch (k) {
        case 'Escape':
          if (UI.ctxOpen) { closeCtx(); } else if (CP.Build.mode) { CP.Build.cancel(); } else {
            var openList = Object.keys(UI.open).filter(function (n) { return UI.open[n]; });
            if (openList.length) { UI.toggle(openList[openList.length - 1], false); } else { UI.toggle('pause', true); }
          }
          break;
        case 'KeyE': if (!G().paused) { CP.Actions.interact(p); } break;
        case 'Space': CP.Combat.spaceAction(p); break;
        case 'KeyC': p.sneaking = !p.sneaking; break;
        case 'KeyF': CP.Use.toggleFlashlight(p); break;
        case 'KeyQ': UI.say(p, U.pick(['Ei!', 'Aqui!', 'Venham!', 'Socorro!'])); CP.Zombies.noise(p.x, p.y, p.z, C.NOISE.SHOUT, 'shout'); break;
        case 'KeyR': if (CP.Build.mode) { CP.Build.mode.side = 1 - CP.Build.mode.side; } else { CP.Combat.reload(p); } break;
        case 'KeyZ': p.sitting = !p.sitting; if (p.sitting) { UI.toast('Sentado (descansa mais rápido).'); } break;
        case 'Tab': case 'KeyI': UI.lootFocus = null; UI.toggle('inv'); break;
        case 'KeyH': UI.toggle('health'); break;
        case 'KeyK': UI.toggle('skills'); break;
        case 'KeyB': UI.toggle('craft'); break;
        case 'KeyM': UI.toggle('map'); break;
        case 'F1': UI.toggle('help'); break;
        case 'BracketRight': G().speedIndex = Math.min(C.GAME_SPEEDS.length - 1, G().speedIndex + 1); clampSpeed(); break;
        case 'BracketLeft': G().speedIndex = Math.max(0, G().speedIndex - 1); break;
        case 'Equal': case 'NumpadAdd': CP.Render.setZoomIndex(CP.Render.zoomIndex + 1); UI.prefs.zoomIndex = CP.Render.zoomIndex; break;
        case 'Minus': case 'NumpadSubtract': CP.Render.setZoomIndex(CP.Render.zoomIndex - 1); UI.prefs.zoomIndex = CP.Render.zoomIndex; break;
        case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': hotbar(+k.slice(5) - 1); break;
        case 'F9': G().viewDebug = !G().viewDebug; break;
      }
    }
    var wheel = In.consumeWheel();
    if (wheel) { CP.Render.setZoomIndex(CP.Render.zoomIndex - wheel); UI.prefs.zoomIndex = CP.Render.zoomIndex; }
    var clicks = In.consumeClicks();
    for (var c = 0; c < clicks.length; c++) {
      var ck = clicks[c];
      if (p.dead) { continue; }
      var wpt = CP.Render.toWorld(ck.x, ck.y, W.levelOf(p.z));
      if (ck.button === 2) {
        if (CP.Build.mode) { CP.Build.cancel(); continue; }
        showCtx(CP.Actions.contextOptions(p, wpt.x, wpt.y), ck.x, ck.y);
      } else if (ck.button === 0) {
        if (CP.Build.mode) { CP.Build.place(p, wpt.x, wpt.y); continue; }
        if (p.hand1 && D.ITEMS[p.hand1.id].throwable && p.aiming) { CP.Use.throwItem(p, p.hand1, wpt.x, wpt.y); continue; }
      }
    }
    // guarda o clique esquerdo para não atacar ao fechar menus ou construir
    p.uiClickGuard = UI.ctxOpen || !!CP.Build.mode || (performance.now() - UI.lastCtxClose < 250) || !!(p.hand1 && D.ITEMS[p.hand1.id].throwable);
    if (p.sayT > 0) { p.sayT -= 1 / 60; }
  };

  /* ================= QUADRO ================= */
  UI.frame = function (dt) {
    UI.hurtT = Math.max(0, UI.hurtT - dt);
    if (UI.screen === 'menu' || UI.screen === 'create') {
      drawMenuBackground(dt);
      if (UI.screen === 'create') { UI.menuT += dt; if (UI.menuT > 0.05) { UI.menuT = 0; drawPreview(); } }
      return;
    }
    if (UI.screen !== 'game' || !P()) { return; }
    UI.hudT -= dt;
    if (UI.hudT <= 0) { UI.hudT = 0.2; updateHud(); }
    UI.panelT -= dt;
    if (UI.panelT <= 0) {
      UI.panelT = 0.35;
      if (UI.open.inv && !UI.ctxOpen) { nearbySources(P()); var sg = invSig(); if (sg !== UI.sigs.inv) { renderInv(); } }
      if (UI.open.health && !UI.ctxOpen && healthSig() !== UI.sigs.health) { renderHealth(); }
      if (UI.open.map) { drawMap(); }
    }
    // som ambiente
    var p = P();
    if (CP.Audio && CP.Time) { CP.Audio.ambient(CP.Time.rainIntensity(), !W.isIndoor(Math.floor(p.x), Math.floor(p.y), W.levelOf(p.z))); }
    // autosave
    if (!p.dead && !G().paused) {
      UI.autosaveT -= dt;
      if (UI.autosaveT <= 0) { UI.autosaveT = C.AUTOSAVE_SECONDS; CP.Save.save(); }
    }
    // tempo acelerado volta ao normal se aparecer perigo
    if (G().speedIndex > 0 && Math.random() < 0.1) { clampSpeed(); }
  };

  /* fantasma da construção (desenhado pelo jogo em coordenadas de mundo) */
  UI.drawBuildGhost = function (g) {
    var m = CP.Build.mode;
    if (!m) { return; }
    var p = P();
    var w = CP.Render.toWorld(CP.Input.mouse.x, CP.Input.mouse.y, W.levelOf(p.z));
    var t = CP.Build.target(w.x, w.y);
    var err = CP.Build.valid(p, t);
    var HW = C.TILE_W / 2, HH = C.TILE_H / 2;
    var z = W.levelOf(p.z) * C.WALL_H;
    g.fillStyle = err ? 'rgba(220,60,60,0.35)' : 'rgba(110,220,110,0.35)';
    g.strokeStyle = err ? 'rgba(255,90,90,0.9)' : 'rgba(140,255,140,0.9)';
    function P2(x, y) { return [HW * (x - y), HH * (x + y) - z]; }
    g.beginPath();
    if (t.kind === 'edge') {
      var a = P2(t.x, t.y), b = t.side === 0 ? P2(t.x + 1, t.y) : P2(t.x, t.y + 1);
      g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(b[0], b[1] - 60); g.lineTo(a[0], a[1] - 60); g.closePath();
    } else {
      var c1 = P2(t.x, t.y), c2 = P2(t.x + 1, t.y), c3 = P2(t.x + 1, t.y + 1), c4 = P2(t.x, t.y + 1);
      g.moveTo(c1[0], c1[1]); g.lineTo(c2[0], c2[1]); g.lineTo(c3[0], c3[1]); g.lineTo(c4[0], c4[1]); g.closePath();
    }
    g.fill(); g.stroke();
  };

  CP.UI = UI;
})(window.CP = window.CP || {});
