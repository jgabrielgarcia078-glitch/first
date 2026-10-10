/* Jogador: criação a partir da ficha, habilidades/XP, movimento, desenho. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, D = CP.D;

  var P = {};

  /* ---------- criação ---------- */
  P.defaultCharacter = function () {
    return {
      name: 'Sobrevivente', female: false, occupation: 'unemployed', traits: [],
      look: { skin: C.SKIN_TONES[1], hair: C.HAIR_COLORS[1], hairStyle: 'curto', beard: false }
    };
  };
  /* valida pontos: retorna { ok, points, errors[] } */
  P.validate = function (ch) {
    var occ = D.OCC[ch.occupation];
    var pts = C.START_POINTS + (occ ? occ.pts : 0);
    var errors = [];
    var seen = {};
    (ch.traits || []).forEach(function (tid) {
      var t = D.TRAIT[tid];
      if (!t || t.hidden) { errors.push('Traço inválido: ' + tid); return; }
      if (seen[tid]) { errors.push('Traço repetido: ' + t.name); }
      seen[tid] = true;
      pts -= t.cost;
    });
    (ch.traits || []).forEach(function (tid) {
      var t = D.TRAIT[tid];
      if (!t || !t.excl) { return; }
      t.excl.forEach(function (x) { if (seen[x] && tid < x) { errors.push(t.name + ' não combina com ' + D.TRAIT[x].name); } });
    });
    if (pts < 0) { errors.push('Pontos insuficientes (faltam ' + (-pts) + ')'); }
    return { ok: errors.length === 0, points: pts, errors: errors };
  };

  P.create = function (ch, x, y, z) {
    ch = ch || P.defaultCharacter();
    var occ = D.OCC[ch.occupation] || D.OCC.unemployed;
    var traits = (ch.traits || []).slice();
    (occ.traits || []).forEach(function (t) { if (traits.indexOf(t) < 0) { traits.push(t); } });
    var p = {
      kind: 'player', name: ch.name || 'Sobrevivente', female: !!ch.female,
      x: x, y: y, z: z, ang: Math.PI * 0.25, vx: 0, vy: 0,
      occupation: occ.id, traits: traits,
      skills: {}, xp: {}, boost: {},
      fx: {},
      inv: [], hand1: null, hand2: null,
      worn: { hat: null, neck: null, shirt: null, jacket: null, vest: null, pants: null, shoes: null, gloves: null, back: null },
      look: Object.assign({ skin: C.SKIN_TONES[1], hair: C.HAIR_COLORS[1], hairStyle: 'curto', beard: false }, ch.look || {}),
      anim: { phase: 0, attack: 0, shove: 0 },
      moving: false, running: false, sneaking: false, aiming: false,
      action: null, queue: [],
      attackCd: 0, shoveCd: 0,
      knownRecipes: [], readBooks: {},
      stepAcc: 0, kills: 0, daysSurvived: 0,
      flashlightOn: false,
      sleeping: false, sitting: false,
      dead: false, deathCause: '',
      log: []
    };
    p.draw = P.draw;
    // efeitos dos traços
    traits.forEach(function (tid) {
      var t = D.TRAIT[tid];
      if (!t || !t.fx) { return; }
      for (var k in t.fx) {
        var v = t.fx[k];
        if (typeof v === 'number' && p.fx[k] !== undefined && k !== 'weight') { p.fx[k] *= v; } else { p.fx[k] = v; }
      }
    });
    // habilidades: Força e Condicionamento começam em 5
    D.SKILLS.forEach(function (s) { p.skills[s.id] = (s.id === 'strength' || s.id === 'fitness') ? 5 : 0; p.xp[s.id] = 0; p.boost[s.id] = 0; });
    function addSkill(map) {
      for (var sk in map) {
        p.skills[sk] = U.clamp(p.skills[sk] + map[sk], 0, 10);
        if (map[sk] > 0 && sk !== 'strength' && sk !== 'fitness') { p.boost[sk] = Math.min(3, p.boost[sk] + map[sk]); }
      }
    }
    addSkill(occ.skills || {});
    traits.forEach(function (tid) { var t = D.TRAIT[tid]; if (t && t.skills) { addSkill(t.skills); } });
    // roupas iniciais
    var rng = new U.Rng((Date.now() ^ 0x1234) >>> 0);
    var outfitKey = D.OCC_OUTFIT[occ.id] || (p.female ? 'civil_f' : 'civil_m');
    var outfit = rng.pick(D.OUTFITS[outfitKey]);
    outfit.forEach(function (id) { var it = CP.Items.make(id, null, rng); P.wear(p, it); });
    if (!p.worn.shoes) { P.wear(p, CP.Items.make('sneakers', null, rng)); }
    // itens iniciais
    CP.Items.Inv.give(p, CP.Items.make('water_bottle', null, rng));
    CP.Items.Inv.give(p, CP.Items.make('crackers', null, rng));
    if (rng.chance(0.5)) { CP.Items.Inv.give(p, CP.Items.make('candy', null, rng)); }
    if (traits.indexOf('smoker') >= 0) { CP.Items.Inv.give(p, CP.Items.make('cigarettes', null, rng)); CP.Items.Inv.give(p, CP.Items.make('lighter', null, rng)); }
    p.body = CP.Body ? CP.Body.create(p) : null;
    return p;
  };

  /* veste uma roupa no slot dela (devolve a peça trocada) */
  P.wear = function (p, it) {
    var d = CP.Items.def(it);
    var slot = d.cloth ? d.cloth.slot : (d.bag && d.bag.slot === 'back' ? 'back' : null);
    if (!slot) { return null; }
    var old = p.worn[slot];
    p.worn[slot] = it;
    return old;
  };

  /* ---------- habilidades ---------- */
  P.skillLevel = function (p, id) { return p.skills[id] || 0; };
  P.xpMult = function (p, id) {
    var m = C.SKILL_BOOST_MULT[p.boost[id] || 0] || 1;
    if (id !== 'strength' && id !== 'fitness') { m *= (p.fx.xpMult || 1); }
    if (p.fx.combatXp && ['axe', 'longBlunt', 'shortBlunt', 'longBlade', 'shortBlade', 'spear', 'aiming'].indexOf(id) >= 0) { m *= p.fx.combatXp; }
    // livro lido para a faixa atual
    var lv = p.skills[id] || 0;
    var vol = Math.floor(lv / 2) + 1;
    if (p.readBooks[id + '_' + vol]) { m *= C.BOOK_MULT[vol - 1]; }
    return m;
  };
  P.addXp = function (p, id, amount) {
    if (!p.skills.hasOwnProperty(id)) { return; }
    var lv = p.skills[id];
    if (lv >= 10) { return; }
    p.xp[id] += amount * P.xpMult(p, id);
    var need = C.SKILL_XP[lv];
    while (lv < 10 && p.xp[id] >= need) {
      p.xp[id] -= need;
      lv++;
      p.skills[id] = lv;
      U.emit('skill:up', { skill: id, level: lv });
      need = C.SKILL_XP[lv] || Infinity;
    }
  };

  /* ---------- velocidade ---------- */
  P.speed = function (p) {
    var s;
    if (p.aiming) { s = C.SPEED_AIM + P.skillLevel(p, 'nimble') * 0.08; } else if (p.sneaking) { s = C.SPEED_SNEAK + P.skillLevel(p, 'sneaking') * 0.04; } else if (p.running) { s = C.SPEED_RUN + P.skillLevel(p, 'sprinting') * 0.09; } else { s = C.SPEED_WALK; }
    s *= p.fx.speedMult || 1;
    if (CP.Body) { s *= CP.Body.speedMult(p); }
    var st = W.stairAt(Math.floor(p.x), Math.floor(p.y));
    if (st) { s *= C.SPEED_STAIRS_FACTOR; }
    var o = W.obj(Math.floor(p.x), Math.floor(p.y), W.levelOf(p.z));
    if (o && C.OBJ_INFO[o].slow) { s *= C.OBJ_INFO[o].slow; }
    return s;
  };

  /* ---------- atualização ---------- */
  var SCREEN_DIRS = { KeyW: [-1, -1], KeyS: [1, 1], KeyA: [-1, 1], KeyD: [1, -1], ArrowUp: [-1, -1], ArrowDown: [1, 1], ArrowLeft: [-1, 1], ArrowRight: [1, -1] };
  P.update = function (p, dt, gameDt) {
    if (p.dead) { return; }
    if (p.vehicle && CP.Vehicles) {
      CP.Vehicles.drive(p, dt);
      if (CP.Actions) { CP.Actions.update(p, dt, gameDt); }
      return;
    }
    var In = CP.Input;
    var mx = 0, my = 0;
    var canControl = !In.blockGame && !p.sleeping;
    if (canControl) {
      for (var k in SCREEN_DIRS) { if (In.isDown(k)) { mx += SCREEN_DIRS[k][0]; my += SCREEN_DIRS[k][1]; } }
    }
    var len = Math.sqrt(mx * mx + my * my);
    p.aiming = canControl && In.aiming();
    p.running = canControl && len > 0 && (In.isDown('ShiftLeft') || In.isDown('ShiftRight')) && !p.aiming && (!CP.Body || CP.Body.canRun(p));
    if (p.running && p.sneaking) { p.sneaking = false; }
    // olhar para o mouse ao mirar/atacar
    var mouseW = P.mouseWorld(p);
    var toMouse = Math.atan2(mouseW.y - p.y, mouseW.x - p.x);
    if (p.anim.attack > 0 && p.aimLock !== null && p.aimLock !== undefined) { p.ang = p.aimLock; } else if (p.aiming || p.anim.attack > 0 || p.anim.shove > 0) { p.ang = U.approachAngle(p.ang, toMouse, dt * 14); }
    p.moving = false;
    if (len > 0) {
      // movimento cancela ações com tempo
      if (p.action && p.action.cancelOnMove !== false && CP.Actions) { CP.Actions.cancel(p, 'moveu'); }
      if (p.sitting) { p.sitting = false; }
      mx /= len; my /= len;
      var sp = P.speed(p) * (p.anim.attack > 0 ? 0.35 : 1);
      var dx = mx * sp * dt, dy = my * sp * dt;
      var ox = p.x, oy = p.y;
      W.moveCircle(p, dx, dy, C.PLAYER_RADIUS);
      if (CP.Zombies) { CP.Zombies.pushApart(p, C.PLAYER_RADIUS); }
      var moved = Math.sqrt((p.x - ox) * (p.x - ox) + (p.y - oy) * (p.y - oy));
      if (moved > 0.001) {
        p.moving = true;
        p.anim.phase = (p.anim.phase + moved * (p.running ? 0.55 : 0.75)) % 1;
        if (!p.aiming && p.anim.attack <= 0 && p.anim.shove <= 0) { p.ang = U.approachAngle(p.ang, Math.atan2(my, mx), dt * (p.running ? 9 : 11)); }
        // ruído de passos
        p.stepAcc += moved;
        if (p.stepAcc > 0.7) {
          p.stepAcc = 0;
          var r = p.running ? C.NOISE.STEP_RUN : (p.sneaking ? C.NOISE.STEP_SNEAK : C.NOISE.STEP_WALK);
          r *= (p.fx.noiseMult || 1) * (1 - P.skillLevel(p, 'lightfooted') * 0.05);
          if (CP.Zombies) { CP.Zombies.noise(p.x, p.y, p.z, r, 'step'); }
          if (CP.Audio && !p.sneaking) { CP.Audio.step(p.running); }
          // XP de movimento
          if (p.running) { P.addXp(p, 'sprinting', 0.6); P.addXp(p, 'fitness', 0.15); }
          if (p.sneaking) { P.addXp(p, 'sneaking', 0.5); P.addXp(p, 'lightfooted', 0.25); }
          if (p.aiming) { P.addXp(p, 'nimble', 0.4); }
          if (!p.running && !p.sneaking) { P.addXp(p, 'lightfooted', 0.05); }
        }
      }
    }
    if (CP.Combat) { CP.Combat.playerUpdate(p, dt); }
    if (CP.Actions) { CP.Actions.update(p, dt, gameDt); }
  };

  /* ponto do mundo sob o mouse, considerando que se mira na altura do peito (não nos pés) */
  P.mouseWorld = function (p) {
    var In = CP.Input, R = CP.Render;
    return R.toWorld(In.mouse.x, In.mouse.y + 30 * R.zoom, p.z);
  };

  /* ---------- aparência ---------- */
  P.lookFor = function (p) {
    var w = p.worn;
    var l = p.look;
    var bag = null;
    if (w.back) { var bid = w.back.id; bag = bid === 'military_bag' ? '#4a5a3a' : (bid === 'schoolbag' ? '#8a2f2f' : '#5a4a3a'); }
    return CP.Spr.buildLook({ skin: l.skin, hair: l.hair, hairStyle: l.hairStyle, beard: l.beard, female: p.female, blood: p.bloodSpots || null, bag: bag, seed: 0 },
      [w.hat, w.neck, w.shirt, w.jacket, w.vest, w.pants, w.shoes, w.gloves]);
  };
  P.draw = function (g, sx, sy, bright) {
    var p = this;
    var look = P.lookFor(p);
    var wl = p.hand1 ? D.weaponLook(p.hand1.id) : null;
    var pose = {
      ang: p.ang, phase: p.anim.phase, moving: p.moving, run: p.running, crouch: p.sneaking,
      attack: p.anim.attack, shove: p.anim.shove, weapon: wl, aim: p.aiming,
      down: p.sleeping || p.dead, dead: p.dead
    };
    var b = Math.max(0.35, bright);
    CP.Spr.drawHuman(g, sx, sy, look, pose, b);
    if (p.action && CP.Actions) { CP.Actions.drawProgress(g, sx, sy, p); }
  };

  CP.Player = P;
})(window.CP = window.CP || {});
