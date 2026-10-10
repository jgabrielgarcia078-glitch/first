/* Corpo: necessidades, moodles, temperatura, partes do corpo, ferimentos, primeiros socorros, infecção, morte. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, D = CP.D;
  var N = C.NEEDS, ML = C.MOODLE_LEVELS;

  var B = {};

  B.create = function (p) {
    var parts = {};
    D.BODY_PARTS.forEach(function (bp) { parts[bp.id] = { wounds: [] }; });
    var weight = p.fx.weight || 80;
    return {
      health: 100, parts: parts, infection: null,
      stats: {
        hunger: 0.1, thirst: 0.1, fatigue: 0.15, endurance: 1, panic: 0, stress: 0, boredom: 0.05, unhappy: 0,
        sick: 0, drunk: 0, wet: 0, temp: 36.6, weight: weight, calories: 1000, stuffed: 0, cold: 0, smokeT: 0
      },
      meds: { pain: 0, beta: 0, antidep: 0, antibiotic: 0 },
      dmgLog: [], lastHurt: -999, sleepQuality: 1, fear: 0
    };
  };

  /* nível do moodle (0..4) */
  function lvl(v, th, inverted) {
    var n = 0;
    for (var i = 0; i < th.length; i++) { if (inverted ? v < th[i] : v >= th[i]) { n = i + 1; } }
    return n;
  }
  B.level = lvl;

  /* ---------- dor (soma dos ferimentos) ---------- */
  B.pain = function (p) {
    var b = p.body, total = 0;
    for (var k in b.parts) {
      b.parts[k].wounds.forEach(function (w) {
        var base = { scratch: 6, laceration: 14, deep: 25, bite: 22, fracture: 35, burn: 18, glass: 12, bullet: 30 }[w.type] || 5;
        total += base * Math.max(0.25, w.sev) * (w.bandage ? 0.75 : 1);
      });
    }
    if (b.infection && b.infection.p > 0.5) { total += 15; }
    if (b.meds.pain > 0) { total *= 0.35; }
    return Math.min(100, total);
  };
  B.bleeding = function (p) {
    var n = 0;
    for (var k in p.body.parts) { p.body.parts[k].wounds.forEach(function (w) { if (w.bleeding && !w.bandage) { n += w.type === 'deep' || w.type === 'bite' ? 2 : 1; } }); }
    return n;
  };

  /* ---------- multiplicadores para outros sistemas ---------- */
  B.carryLevel = function (p) {
    var cap = CP.Items.Inv.capacity(p);
    var w = CP.Items.Inv.carried(p);
    return lvl(w / cap, ML.heavy);
  };
  B.legInjury = function (p) {
    var f = 0;
    ['thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR'].forEach(function (id) {
      p.body.parts[id].wounds.forEach(function (w) {
        if (w.type === 'fracture') { f += w.splint ? 0.25 : 0.5; } else if (w.type === 'deep' || w.type === 'bite' || w.type === 'glass') { f += 0.1 * w.sev; }
      });
    });
    return Math.min(0.7, f);
  };
  B.speedMult = function (p) {
    if (!p.body) { return 1; }
    var s = p.body.stats, m = 1;
    var e = lvl(s.endurance, ML.endurance, true);
    m *= [1, 0.95, 0.85, 0.7, 0.55][e];
    var hv = B.carryLevel(p);
    m *= [1, 0.9, 0.78, 0.65, 0.5][hv];
    m *= 1 - B.legInjury(p);
    if (s.panic > 50 && p.fx.panicSpeed) { m *= 1 + p.fx.panicSpeed; }
    if (s.drunk > 0.5) { m *= 0.9; }
    var tired = lvl(s.fatigue, ML.fatigue);
    if (tired >= 3) { m *= 0.9; }
    return m;
  };
  B.canRun = function (p) {
    if (!p.body) { return true; }
    return p.body.stats.endurance > 0.08 && B.carryLevel(p) < 3 && B.legInjury(p) < 0.45;
  };
  /* multiplica a duração de ações (>1 = mais lento) */
  B.actionSpeedMult = function (p) {
    if (!p.body) { return 1; }
    var s = p.body.stats, m = 1;
    m *= 1 + lvl(s.unhappy, ML.unhappy) * 0.1;
    m *= 1 + lvl(B.pain(p), ML.pain) * 0.08;
    m *= 1 + Math.max(0, lvl(s.fatigue, ML.fatigue) - 1) * 0.08;
    m *= 1 + lvl(s.panic, ML.panic) * 0.05;
    if (s.drunk > 0.3) { m *= 1.15; }
    return m;
  };

  /* ---------- atualização ---------- */
  var nearZ = [];
  B.update = function (p, dt, gameDt) {
    if (!p.body || p.dead) { return; }
    var b = p.body, s = b.stats;
    var h = gameDt / 3600;
    var T = CP.Time;
    var sleeping = p.sleeping;
    var moving = p.moving, running = p.running;
    // fome / sede
    var hm = (p.fx.hungerMult || 1) * (running ? 1.4 : 1);
    s.hunger = U.clamp(s.hunger + (sleeping ? N.HUNGER_SLEEP_RATE : N.HUNGER_RATE) * hm * h, 0, 1);
    var tm = (p.fx.thirstMult || 1) * (running ? 1.5 : 1) * (s.temp > 37.3 ? 1.5 : 1);
    s.thirst = U.clamp(s.thirst + (sleeping ? N.THIRST_SLEEP_RATE : N.THIRST_RATE) * tm * h, 0, 1);
    s.stuffed = Math.max(0, s.stuffed - h * 0.25);
    // sono
    if (sleeping) {
      s.fatigue = Math.max(0, s.fatigue - N.FATIGUE_SLEEP_RECOVER * b.sleepQuality * (p.fx.sleepMult || 1) * h);
    } else {
      s.fatigue = Math.min(1, s.fatigue + N.FATIGUE_RATE * (p.fx.fatigueMult || 1) * (running ? 1.3 : 1) * h);
    }
    // fôlego (tempo real)
    if (running && moving) {
      s.endurance -= N.ENDURANCE_RUN * dt * (p.fx.enduranceMult || 1) * (1.25 - CP.Player.skillLevel(p, 'fitness') * 0.05);
    } else if (p.anim.attack <= 0 && p.anim.shove <= 0) {
      var regen = (moving ? N.ENDURANCE_REGEN_WALK : N.ENDURANCE_REGEN) * (0.7 + CP.Player.skillLevel(p, 'fitness') * 0.06);
      if (p.sitting || sleeping) { regen *= 1.8; }
      if (s.hunger > 0.45 || s.thirst > 0.7) { regen *= 0.6; }
      s.endurance += regen * dt * (s.endurance < 0.3 ? 0.7 : 1);
    }
    s.endurance = U.clamp(s.endurance, 0, 1);
    if (running && moving) { CP.Player.addXp(p, 'fitness', 0.02 * dt * 10); }
    // pânico (tempo real)
    var visibleZ = 0;
    if (!sleeping) {
      var list = CP.Zombies.near(p.x, p.y, 12, nearZ);
      for (var i = 0; i < list.length; i++) {
        var zb = list[i];
        if (zb.state === 'fakedead' || Math.abs(zb.z - p.z) > 0.5) { continue; }
        if (CP.Zombies.visibleToPlayer(zb)) { visibleZ += U.dist2(zb.x, zb.y, p.x, p.y) < 16 ? 2 : 1; }
      }
    }
    var days = CP.Time ? CP.Time.daysSurvived() : 0;
    var panicMult = (p.fx.panicMult === undefined ? 1 : p.fx.panicMult) * Math.max(0.25, 1 - days * 0.06);
    if (visibleZ > 0) { s.panic = Math.min(100, s.panic + visibleZ * 3.2 * panicMult * dt); }
    var outdoor = !W.isIndoor(Math.floor(p.x), Math.floor(p.y), W.levelOf(p.z));
    if (p.fx.agoraphobic && outdoor) { s.panic = Math.min(100, s.panic + 2 * dt); }
    if (p.fx.claustrophobic && !outdoor) { s.panic = Math.min(100, s.panic + 2 * dt); }
    if (b.meds.beta > 0) { s.panic = Math.min(s.panic, 25); }
    s.panic = Math.max(0, s.panic - N.PANIC_DECAY_PER_SEC * (visibleZ ? 0.2 : 1) * dt);
    // estresse, tédio, tristeza
    s.stress = U.clamp(s.stress + (s.panic > 30 ? 0.002 * dt : -N.STRESS_DECAY * h), 0, 1);
    if (p.fx.smoker) {
      s.smokeT += h;
      if (s.smokeT > 8) { s.stress = Math.min(1, s.stress + 0.04 * h); }
    }
    var idle = !moving && !p.action && !sleeping;
    if (idle && !outdoor) { s.boredom = Math.min(1, s.boredom + N.BOREDOM_RATE_IDLE_INDOOR * h); } else if (moving && outdoor) { s.boredom = Math.max(0, s.boredom - N.BOREDOM_DECAY_OUTDOOR * h); }
    if (s.boredom > 0.5) { s.unhappy = Math.min(1, s.unhappy + 0.02 * (s.boredom - 0.4) * h * 4); }
    if (s.stress > 0.5) { s.unhappy = Math.min(1, s.unhappy + 0.01 * h * 4); }
    if (b.meds.antidep > 0) { s.unhappy = Math.max(0, s.unhappy - 0.05 * h); }
    s.unhappy = Math.max(0, s.unhappy - 0.004 * h);
    s.drunk = Math.max(0, s.drunk - 0.08 * h);
    // remédios
    for (var mk in b.meds) { if (b.meds[mk] > 0) { b.meds[mk] = Math.max(0, b.meds[mk] - h); } }
    // calorias e peso
    var burn = N.CALORIES_PER_HOUR * (running ? 2.2 : (moving ? 1.3 : (sleeping ? 0.8 : 1))) * h;
    s.calories -= burn;
    if (s.calories < 0) { s.weight -= (-s.calories) * N.KG_PER_CALORIE * 0.5; s.calories = 0; }
    if (s.calories > 3500) { s.weight += (s.calories - 3500) * N.KG_PER_CALORIE * 0.5; s.calories = 3500; }
    // temperatura e chuva
    if (T) {
      var air = T.temperature(outdoor);
      var ins = B.insulation(p);
      var target = 36.6 + (air - 20) * 0.06 * (1 - Math.min(0.85, ins * 0.4)) + (running ? 0.6 : 0) + (ins > 1.6 && air > 24 ? (ins - 1.6) * 0.8 : 0) - s.wet * 1.2 * (p.fx.weather || 1);
      if (sleeping) { target -= 0.2; }
      target = U.clamp(target, 30, 41);
      s.temp += (target - s.temp) * Math.min(1, h * 0.8);
      if (outdoor && T.raining()) { s.wet = Math.min(1, s.wet + T.rainIntensity() * 0.6 * h * (p.worn.jacket ? 0.6 : 1)); } else { s.wet = Math.max(0, s.wet - (outdoor ? 0.15 : 0.3) * h); }
      // resfriado
      if (s.temp < 35.9 || (s.wet > 0.5 && air < 15)) { s.cold = Math.min(1, s.cold + 0.004 * h * (p.fx.sickMult || 1)); } else { s.cold = Math.max(0, s.cold - 0.01 * h); }
      if (s.cold > 0.3 && Math.random() < dt * 0.02 * s.cold) { CP.Zombies.noise(p.x, p.y, p.z, 9, 'sneeze'); if (CP.UI) { CP.UI.say(p, Math.random() < 0.5 ? 'Atchim!' : '*tosse*'); } }
    }
    // doença por comida
    if (s.sick > 0) {
      if (s.sick > 0.5) { B.hurt(p, 1.2 * h * s.sick, 'Intoxicação alimentar'); }
      s.sick = Math.max(0, s.sick - 0.04 * h);
      if (s.sick > 0.6 && Math.random() < dt * 0.01) { s.hunger = Math.min(1, s.hunger + 0.1); if (CP.UI) { CP.UI.say(p, '*vomita*'); } }
    }
    // cadáveres por perto deixam doente
    if (CP.Time && Math.random() < dt * 0.2) { B.corpseSickness(p, h * 5); }
    // ferimentos
    B.updateWounds(p, dt, h);
    // infecção zumbi
    if (b.infection) { B.updateInfection(p, h); }
    // vida
    if (s.hunger >= ML.hunger[3]) { B.hurt(p, N.STARVE_DMG * h, 'Morreu de fome'); }
    if (s.thirst >= ML.thirst[3]) { B.hurt(p, N.DEHYDRATE_DMG * h, 'Morreu de sede'); }
    if (s.temp < 33.5) { B.hurt(p, (33.5 - s.temp) * 1.5 * h, 'Morreu de hipotermia'); }
    if (s.temp > 40.5) { B.hurt(p, (s.temp - 40.5) * 2 * h, 'Morreu de hipertermia'); }
    if (s.hunger < 0.45 && s.thirst < 0.7 && !B.bleeding(p) && s.sick < 0.5 && !(b.infection && b.infection.p > 0.5)) {
      var heal = N.HEAL_PER_HOUR * (p.fx.healMult || 1) * (sleeping ? 2 : 1) * h;
      b.health = Math.min(B.maxHealth(p), b.health + heal);
    }
    if (b.health <= 0) { B.die(p, b.lastCause || 'Morreu dos ferimentos'); }
    // acorda?
    if (sleeping) {
      if (s.fatigue <= 0.02 && !p.forceSleep) { B.wake(p, 'Acordou descansado.'); } else if (s.hunger > 0.7 || s.thirst > 0.8) { B.wake(p, 'Acordou com fome/sede.'); } else if (B.pain(p) > 60) { B.wake(p, 'A dor te acordou.'); }
    }
  };

  /* teto de vida diminui com ferimentos graves */
  B.maxHealth = function (p) {
    var m = 100;
    for (var k in p.body.parts) { p.body.parts[k].wounds.forEach(function (w) { m -= ({ scratch: 2, laceration: 5, deep: 12, bite: 12, fracture: 10, burn: 8, glass: 4, bullet: 15 }[w.type] || 2) * Math.max(0.3, w.sev); }); }
    if (p.body.infection) { m -= p.body.infection.p * 70; }
    if (p.body.stats.sick > 0.4) { m -= p.body.stats.sick * 20; }
    return Math.max(5, m);
  };

  B.hurt = function (p, amount, cause) {
    var b = p.body;
    b.health -= amount;
    b.lastCause = cause;
    if (amount > 3) { b.lastHurt = CP.Game.state.time; }
    if (b.health <= 0) { B.die(p, cause); }
  };

  B.corpseSickness = function (p, h) {
    var n = 0;
    for (var k in CP.Game.activeChunks) {
      var ch = CP.Game.activeChunks[k];
      for (var i = 0; i < ch.corpses.length; i++) {
        var c = ch.corpses[i];
        if (U.dist2(c.x, c.y, p.x, p.y) < 25 && (CP.Game.state.time - c.t) > 3600 * 24 * 2) { n++; }
      }
    }
    if (n >= 5) { p.body.stats.sick = Math.min(1, p.body.stats.sick + 0.01 * n * h * (p.fx.sickMult || 1)); }
  };

  /* ---------- ferimentos ---------- */
  var HEAL_HOURS = { scratch: 30, laceration: 70, deep: 140, bite: 200, fracture: 400, burn: 120, glass: 60, bullet: 160 };
  B.addWound = function (p, partId, type, opts) {
    opts = opts || {};
    var part = p.body.parts[partId];
    var w = { type: type, sev: 1, bleeding: opts.bleeding !== undefined ? opts.bleeding : (type !== 'scratch' || Math.random() < 0.5) && type !== 'fracture' && type !== 'burn', bandage: null, disinfected: false, stitched: false, splint: false, infected: 0, zombie: !!opts.zombie, foreign: type === 'glass' || type === 'bullet' };
    part.wounds.push(w);
    var dmg = { scratch: 4, laceration: 8, deep: 12, bite: 14, fracture: 10, burn: 8, glass: 5, bullet: 18 }[type] || 4;
    B.hurt(p, dmg * (opts.dmgMult || 1), opts.cause || 'Morreu dos ferimentos');
    if (p.fx.hemophobic && w.bleeding) { p.body.stats.panic = Math.min(100, p.body.stats.panic + 30); p.body.stats.stress = Math.min(1, p.body.stats.stress + 0.1); }
    if (p.sleeping) { B.wake(p, 'Acordou com dor!'); }
    if (CP.Actions && p.action) { CP.Actions.cancel(p, 'ferido'); }
    p.bloodSpots = p.bloodSpots || [];
    if (p.bloodSpots.length < 6 && w.bleeding) { p.bloodSpots.push([U.randRange(-1, 1), U.randRange(0, 1), U.randRange(1.2, 2.8)]); }
    return w;
  };
  B.updateWounds = function (p, dt, h) {
    var b = p.body;
    var bleed = 0;
    var healMult = (p.fx.healMult || 1) * (b.stats.hunger > 0.45 ? 0.5 : 1) * (p.sleeping ? 1.5 : 1);
    for (var k in b.parts) {
      var ws = b.parts[k].wounds;
      for (var i = ws.length - 1; i >= 0; i--) {
        var w = ws[i];
        if (w.bleeding) {
          if (w.bandage) {
            w.bandage.dirty = Math.min(1, w.bandage.dirty + 0.25 * h);
            if (Math.random() < h * 0.6 * w.bandage.quality) { w.bleeding = false; }
          } else {
            bleed += (w.type === 'deep' || w.type === 'bite' ? 0.9 : (w.type === 'laceration' ? 0.5 : 0.18));
            if (w.type === 'scratch' && Math.random() < h * 0.5) { w.bleeding = false; }
          }
        }
        // cura
        var slow = (w.type === 'deep' && !w.stitched) ? 0.15 : 1;
        if (w.foreign) { slow = 0; }
        if (w.type === 'fracture' && !w.splint) { slow = 0.3; }
        w.sev -= (1 / HEAL_HOURS[w.type]) * healMult * slow * h * (w.bandage ? 1.3 : 1) * (w.infected > 0.3 ? 0.3 : 1);
        // infecção comum (sujeira)
        var exposed = !w.bandage || w.bandage.dirty > 0.7;
        if (w.type !== 'fracture' && exposed && !w.disinfected && w.infected <= 0 && Math.random() < h * 0.015 * (p.fx.sickMult || 1)) { w.infected = 0.05; }
        if (w.infected > 0) {
          if (b.meds.antibiotic > 0) { w.infected = Math.max(0, w.infected - 0.08 * h); } else { w.infected = Math.min(1, w.infected + 0.02 * h); }
          if (w.infected > 0.6) { B.hurt(p, 0.6 * h, 'Morreu de infecção no ferimento'); }
        }
        if (w.bandage && w.bandage.dirty >= 1 && w.disinfected) { w.disinfected = false; }
        if (w.sev <= 0) { ws.splice(i, 1); }
      }
    }
    if (bleed > 0) {
      B.hurt(p, bleed * dt * 0.12, 'Sangrou até a morte');
      if (CP.FX && Math.random() < dt * bleed * 0.8) { CP.FX.drip(p.x, p.y, p.z); }
    }
  };

  /* ---------- infecção zumbi ---------- */
  B.infect = function (p) {
    if (p.body.infection) { return; }
    var I = C.INFECTION;
    var dur = U.randRange(I.HOURS_MIN, I.HOURS_MAX) * (p.fx.sickMult ? (p.fx.sickMult < 1 ? 1.3 : 0.85) : 1);
    if (CP.Game.settings.mortality) { dur *= CP.Game.settings.mortality; }
    p.body.infection = { t0: CP.Game.state.time / 3600, dur: dur, p: 0 };
  };
  B.updateInfection = function (p, h) {
    var inf = p.body.infection;
    var now = CP.Game.state.time / 3600;
    inf.p = U.clamp((now - inf.t0) / inf.dur, 0, 1);
    if (inf.p > 0.6) { B.hurt(p, 6 * h * (inf.p - 0.5) * 2, 'Morreu da infecção e se transformou em zumbi'); }
    if (inf.p >= 1) { B.die(p, 'Morreu da infecção e se transformou em zumbi'); }
  };

  /* ---------- zumbi ataca ---------- */
  B.protection = function (p, partId) {
    var bite = 0, scratch = 0;
    var layers = [];
    for (var s in p.worn) {
      var it = p.worn[s];
      if (!it) { continue; }
      var d = D.ITEMS[it.id];
      if (!d.cloth || d.cloth.parts.indexOf(partId) < 0) { continue; }
      var f = Math.max(0.2, it.cond === undefined ? 1 : it.cond) * (it.holes ? 0.5 : 1);
      layers.push({ it: it, bite: d.cloth.bite * f, scratch: d.cloth.scratch * f });
    }
    layers.sort(function (a, b2) { return b2.scratch - a.scratch; });
    layers.forEach(function (l, i) {
      var k = i === 0 ? 1 : 0.35;
      bite += l.bite * k; scratch += l.scratch * k;
    });
    return { bite: Math.min(95, bite), scratch: Math.min(95, scratch), layers: layers };
  };
  B.zombieWound = function (p, partId, type, zb) {
    var prot = B.protection(p, partId);
    var def = type === 'bite' ? prot.bite : prot.scratch * (type === 'laceration' ? 0.8 : 1);
    if (Math.random() * 100 < def) {
      // a roupa segurou: estraga um pouco
      if (prot.layers.length) {
        var l = prot.layers[0].it;
        l.cond = Math.max(0, (l.cond === undefined ? 1 : l.cond) - U.randRange(0.03, 0.1));
        if (Math.random() < 0.2) { l.holes = (l.holes || 0) + 1; }
      }
      if (CP.UI) { CP.UI.toast('A roupa protegeu você (' + D.PART[partId].name.toLowerCase() + ').', 'info'); }
      p.body.stats.panic = Math.min(100, p.body.stats.panic + 8);
      return null;
    }
    // pele grossa/fina: chance de rebaixar o ferimento
    if (p.fx.woundMult && p.fx.woundMult < 1 && type === 'laceration' && Math.random() < 0.3) { type = 'scratch'; }
    if (p.fx.woundMult && p.fx.woundMult > 1 && type === 'scratch' && Math.random() < 0.25) { type = 'laceration'; }
    var w = B.addWound(p, partId, type, { zombie: true, cause: 'Foi atacado por zumbis' });
    if (CP.Game.settings.infection !== false && Math.random() < C.INFECTION[type === 'laceration' ? 'LACERATION' : type.toUpperCase()]) { B.infect(p); }
    p.body.stats.panic = Math.min(100, p.body.stats.panic + 25);
    if (CP.UI) { CP.UI.toast(D.WOUND_NAMES[type] + ' no(a) ' + D.PART[partId].name.toLowerCase() + '!', type === 'bite' ? 'danger' : 'warn'); }
    if (CP.FX) { CP.FX.blood(p.x, p.y, p.z, 1.5); }
    if (CP.UI && CP.UI.hurtFlash) { CP.UI.hurtFlash(); }
    return w;
  };

  B.addBloodOnClothes = function (p, amt, slot) {
    var it = slot ? p.worn[slot] : (p.worn.jacket || p.worn.shirt);
    if (it) { it.blood = Math.min(1, (it.blood || 0) + amt); }
  };

  /* isolamento total das roupas */
  B.insulation = function (p) {
    var ins = 0;
    for (var s in p.worn) {
      var it = p.worn[s];
      if (it && D.ITEMS[it.id].cloth) { ins += D.ITEMS[it.id].cloth.ins * (it.holes ? 0.7 : 1); }
    }
    return ins;
  };

  /* ---------- primeiros socorros ---------- */
  B.treatTime = function (p, base) { return base * (1.4 - CP.Player.skillLevel(p, 'firstAid') * 0.09) * (p.fx.hemophobic ? 1.5 : 1); };
  B.applyBandage = function (p, partId, item) {
    var d = D.ITEMS[item.id];
    var part = p.body.parts[partId];
    part.wounds.forEach(function (w) {
      if (w.type === 'fracture') { return; }
      w.bandage = { quality: d.med.quality + CP.Player.skillLevel(p, 'firstAid') * 0.03, dirty: d.med.sterile ? 0 : 0.2, sterile: !!d.med.sterile };
      if (d.med.sterile) { w.disinfected = true; }
    });
    CP.Player.addXp(p, 'firstAid', 3);
  };
  B.removeBandage = function (p, partId) { p.body.parts[partId].wounds.forEach(function (w) { w.bandage = null; }); };
  B.disinfect = function (p, partId) {
    p.body.parts[partId].wounds.forEach(function (w) { w.disinfected = true; w.infected = Math.max(0, w.infected - 0.3); });
    p.body.stats.unhappy = Math.min(1, p.body.stats.unhappy + 0.02);
    CP.Player.addXp(p, 'firstAid', 2);
  };
  B.stitch = function (p, partId) {
    var done = false;
    p.body.parts[partId].wounds.forEach(function (w) { if ((w.type === 'deep' || w.type === 'laceration') && !w.stitched) { w.stitched = true; w.bleeding = false; done = true; } });
    if (done) { B.hurt(p, 2, 'Morreu dos ferimentos'); CP.Player.addXp(p, 'firstAid', 6); }
    return done;
  };
  B.removeForeign = function (p, partId) {
    var done = false;
    p.body.parts[partId].wounds.forEach(function (w) {
      if (w.foreign) { w.foreign = false; w.type = w.type === 'glass' ? 'laceration' : 'deep'; w.bleeding = true; done = true; }
    });
    if (done) { CP.Player.addXp(p, 'firstAid', 5); }
    return done;
  };
  B.applySplint = function (p, partId) {
    var done = false;
    p.body.parts[partId].wounds.forEach(function (w) { if (w.type === 'fracture') { w.splint = true; done = true; } });
    if (done) { CP.Player.addXp(p, 'firstAid', 4); }
    return done;
  };
  B.takePill = function (p, type) {
    var m = p.body.meds;
    if (type === 'pain') { m.pain = 6; } else if (type === 'antibiotic') { m.antibiotic = 12; } else if (type === 'panic') { m.beta = 6; p.body.stats.panic = Math.min(p.body.stats.panic, 20); } else if (type === 'happy') { m.antidep = 24; } else if (type === 'sleep') { p.body.stats.fatigue = Math.min(1, p.body.stats.fatigue + 0.25); }
  };

  /* ---------- sono ---------- */
  B.sleep = function (p, quality) {
    if (p.body.stats.fatigue < 0.3) { if (CP.UI) { CP.UI.toast('Você não está com sono.'); } return false; }
    if (B.pain(p) > 50) { if (CP.UI) { CP.UI.toast('A dor não deixa você dormir.', 'warn'); } return false; }
    if (p.body.stats.panic > 30) { if (CP.UI) { CP.UI.toast('Você está nervoso demais para dormir.', 'warn'); } return false; }
    p.sleeping = true; p.sitting = false;
    p.body.sleepQuality = quality || 0.6;
    p.sleepStart = CP.Game.state.time;
    if (CP.UI) { CP.UI.toast('Dormindo... (qualquer tecla acorda)'); }
    U.emit('sleep:start');
    return true;
  };
  B.wake = function (p, msg) {
    if (!p.sleeping) { return; }
    p.sleeping = false;
    if (CP.UI) { CP.UI.toast(msg || 'Acordou.'); }
    U.emit('sleep:end');
  };

  /* ---------- morte ---------- */
  B.die = function (p, cause) {
    if (p.dead) { return; }
    p.dead = true;
    p.deathCause = cause || 'Morreu';
    p.sleeping = false;
    p.body.health = 0;
    var G = CP.Game;
    G.over = true;
    U.emit('player:dead', { cause: p.deathCause });
  };

  /* ---------- moodles para a interface ---------- */
  B.moodles = function (p) {
    var b = p.body, s = b.stats, out = [];
    function add(id, name, level, desc, good) { if (level > 0) { out.push({ id: id, name: name, level: level, desc: desc, good: !!good }); } }
    var names = {
      hunger: ['', 'Beliscando', 'Com fome', 'Faminto', 'Morrendo de fome'], thirst: ['', 'Com sede', 'Sedento', 'Desidratado', 'Morrendo de sede'],
      fatigue: ['', 'Sonolento', 'Cansado', 'Muito cansado', 'Exausto'], endurance: ['', 'Ofegante', 'Sem fôlego', 'Esgotado', 'Exausto fisicamente'],
      panic: ['', 'Assustado', 'Em pânico', 'Muito em pânico', 'Pânico extremo'], stress: ['', 'Ansioso', 'Estressado', 'Muito estressado', 'Nervos à flor da pele'],
      boredom: ['', 'Entediado', 'Muito entediado', 'Tédio mortal', 'Enlouquecendo de tédio'], unhappy: ['', 'Triste', 'Infeliz', 'Deprimido', 'Desesperado'],
      sick: ['', 'Enjoado', 'Nauseado', 'Doente', 'Muito doente'], pain: ['', 'Dor leve', 'Dor', 'Dor forte', 'Agonia'],
      hot: ['', 'Com calor', 'Superaquecido', 'Insolação', 'Hipertermia'], cold: ['', 'Com frio', 'Gelado', 'Congelando', 'Hipotermia'],
      wet: ['', 'Úmido', 'Molhado', 'Encharcado', 'Ensopado'], heavy: ['', 'Carga pesada', 'Muito pesado', 'Sobrecarregado', 'Esmagado pelo peso'],
      drunk: ['', 'Alegre', 'Tonto', 'Bêbado', 'Muito bêbado']
    };
    add('hunger', names.hunger[lvl(s.hunger, ML.hunger)], lvl(s.hunger, ML.hunger), 'Coma algo. Fome extrema tira vida.');
    add('thirst', names.thirst[lvl(s.thirst, ML.thirst)], lvl(s.thirst, ML.thirst), 'Beba água. Sede extrema tira vida.');
    add('fatigue', names.fatigue[lvl(s.fatigue, ML.fatigue)], lvl(s.fatigue, ML.fatigue), 'Durma numa cama. Cansaço reduz visão e combate.');
    add('endurance', names.endurance[lvl(s.endurance, ML.endurance, true)], lvl(s.endurance, ML.endurance, true), 'Descanse. Golpes e corrida ficam mais fracos.');
    add('panic', names.panic[lvl(s.panic, ML.panic)], lvl(s.panic, ML.panic), 'Pânico atrapalha a mira e a visão.');
    add('stress', names.stress[lvl(s.stress, ML.stress)], lvl(s.stress, ML.stress), 'Estresse leva à tristeza.');
    add('boredom', names.boredom[lvl(s.boredom, ML.boredom)], lvl(s.boredom, ML.boredom), 'Leia, saia de casa, faça algo diferente.');
    add('unhappy', names.unhappy[lvl(s.unhappy, ML.unhappy)], lvl(s.unhappy, ML.unhappy), 'Ações mais lentas. Leia, coma bem, tome antidepressivo.');
    var sk = Math.max(s.sick, b.infection ? b.infection.p : 0, s.cold * 0.6);
    add('sick', names.sick[lvl(sk, ML.sick)], lvl(sk, ML.sick), b.infection && b.infection.p > 0.2 ? 'Algo está muito errado...' : 'Descanse, beba água.');
    var pain = B.pain(p);
    add('pain', names.pain[lvl(pain, ML.pain)], lvl(pain, ML.pain), 'Trate os ferimentos; analgésicos ajudam.');
    var bl = B.bleeding(p);
    if (bl) { out.push({ id: 'bleeding', name: 'Sangrando', level: Math.min(4, bl), desc: 'Faça um curativo (H → Saúde)!' }); }
    add('hot', names.hot[lvl(s.temp, ML.hot)], lvl(s.temp, ML.hot), 'Tire roupas, beba água, fique na sombra.');
    add('cold', names.cold[lvl(s.temp, ML.cold, true)], lvl(s.temp, ML.cold, true), 'Vista roupas quentes, saia da chuva.');
    add('wet', names.wet[lvl(s.wet, ML.wet)], lvl(s.wet, ML.wet), 'Fique em lugar seco.');
    var hv = B.carryLevel(p);
    add('heavy', names.heavy[hv], hv, 'Carregue menos peso.');
    add('drunk', names.drunk[lvl(s.drunk, ML.drunk)], lvl(s.drunk, ML.drunk), 'Mira e ações piores.');
    if (s.stuffed > 0.3) { out.push({ id: 'stuffed', name: 'Empanturrado', level: 1, desc: 'Comeu demais.', good: true }); }
    if (s.endurance > 0.98 && s.hunger < 0.1 && s.thirst < 0.1 && s.unhappy < 0.05) { out.push({ id: 'fine', name: 'Bem disposto', level: 1, desc: 'Tudo em ordem.', good: true }); }
    return out;
  };

  CP.Body = B;
})(window.CP = window.CP || {});
