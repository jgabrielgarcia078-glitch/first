/* Combate: golpes com arma, empurrão, pisão, tiros, ataques de zumbis no jogador. */
(function (CP) {
  'use strict';

  var C = CP.C, U = CP.U, W = CP.W, D = CP.D;
  var CB = C.COMBAT, ZC = C.ZOMBIE;

  var K = {};
  var near = [];

  function weaponOf(p) {
    var it = p.hand1;
    if (!it) { return null; }
    var d = D.ITEMS[it.id];
    if (d.asWeapon) { return { item: it, def: D.ITEMS[d.asWeapon], w: D.ITEMS[d.asWeapon].weapon }; }
    if (!d.weapon) { return null; }
    if (it.cond !== undefined && it.cond <= 0) { return null; }
    return { item: it, def: d, w: d.weapon };
  }
  K.weaponOf = weaponOf;

  /* ---------- entrada do jogador ---------- */
  K.playerUpdate = function (p, dt) {
    var In = CP.Input;
    if (p.attackCd > 0) { p.attackCd -= dt; }
    if (p.shoveCd > 0) { p.shoveCd -= dt; }
    // animação do golpe em andamento
    if (p.anim.attack > 0) {
      var prev = p.anim.attack;
      p.anim.attack += dt / p.attackDur;
      if (prev < 0.45 && p.anim.attack >= 0.45) { resolveSwing(p); }
      if (p.anim.attack >= 1) { p.anim.attack = 0; }
    }
    if (p.anim.shove > 0) {
      var pv = p.anim.shove;
      p.anim.shove += dt / 0.4;
      if (pv < 0.4 && p.anim.shove >= 0.4) { resolveShove(p); }
      if (p.anim.shove >= 1) { p.anim.shove = 0; }
    }
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) { finishReload(p); }
    }
    if (In.blockGame || p.sleeping || p.dead) { return; }
    var wantAttack = In.mouse.left && !p.uiClickGuard;
    if (wantAttack && p.anim.attack <= 0 && p.anim.shove <= 0 && p.attackCd <= 0 && !p.action) {
      var wp = weaponOf(p);
      if (wp && wp.def.gun) {
        if (p.aiming) { shoot(p, wp); } else { startSwing(p, wp); }
      } else if (wp) { startSwing(p, wp); } else { startShove(p); }
    }
  };
  /* barra de espaço: pisão se houver zumbi caído na frente; senão empurrão */
  K.spaceAction = function (p) {
    if (p.anim.attack > 0 || p.anim.shove > 0 || p.shoveCd > 0 || p.dead) { return; }
    var down = findDownedInFront(p);
    if (down) { stomp(p, down); return; }
    startShove(p);
  };

  function endurance(p) { return p.body ? p.body.stats.endurance : 1; }
  function useEndurance(p, amt) {
    if (!p.body) { return; }
    var mult = (p.fx.enduranceMult || 1) * (1.2 - CP.Player.skillLevel(p, 'fitness') * 0.04);
    p.body.stats.endurance = Math.max(0, p.body.stats.endurance - amt * mult);
  }

  function startSwing(p, wp) {
    var w = wp.w;
    var skill = CP.Player.skillLevel(p, w.skill);
    var dur = w.cd * (1.1 - skill * 0.03);
    if (endurance(p) < 0.25) { dur *= 1.3; }
    if (p.fx.axeSpeed && w.skill === 'axe') { dur /= p.fx.axeSpeed; }
    if (CP.Body) { dur *= CP.Body.actionSpeedMult(p); }
    p.attackDur = dur;
    p.anim.attack = 0.001;
    p.attackCd = dur;
    p.swingWeapon = wp;
    if (CP.Audio) { CP.Audio.swing(w.type); }
    CP.Zombies.noise(p.x, p.y, p.z, C.NOISE.SWING, 'swing');
  }

  function inArc(p, zb, range, arcDeg) {
    if (Math.abs(zb.z - p.z) > 0.45) { return false; }
    var dx = zb.x - p.x, dy = zb.y - p.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d > range + ZC.RADIUS) { return false; }
    if (d > 0.35 && Math.abs(U.angleDiff(p.ang, Math.atan2(dy, dx))) > arcDeg * Math.PI / 360) { return false; }
    return W.lineOfSight(p.x, p.y, zb.x, zb.y, W.levelOf(p.z), 4);
  }

  function resolveSwing(p) {
    var wp = p.swingWeapon;
    if (!wp) { return; }
    var w = wp.w;
    var list = CP.Zombies.near(p.x, p.y, w.range + 1, near).filter(function (zb) { return zb.state !== 'dead' && inArc(p, zb, w.range, w.arc); });
    list.sort(function (a, b) { return U.dist2(a.x, a.y, p.x, p.y) - U.dist2(b.x, b.y, p.x, p.y); });
    var skill = CP.Player.skillLevel(p, w.skill);
    var str = CP.Player.skillLevel(p, 'strength');
    useEndurance(p, w.end * (1 + (wp.def.w || 1) * 0.08));
    if (!list.length) { return; }
    var hits = Math.min(list.length, w.hits);
    for (var i = 0; i < hits; i++) {
      var zb = list[i];
      var dmg = U.randRange(w.dmin, w.dmax) * (0.7 + skill * 0.06);
      if (w.type.indexOf('blunt') === 0 || w.type === 'axe') { dmg *= 0.85 + str * 0.03; }
      if (endurance(p) < 0.3) { dmg *= CB.LOW_ENDURANCE_DMG_MULT; }
      if (i > 0) { dmg *= 0.6; }
      var crit = Math.random() < w.crit + skill * 0.015 + (CP.Zombies.isDown(zb) ? 0.2 : 0);
      if (crit) { dmg *= CB.CRIT_MULT; }
      // golpe por trás do zumbi
      var behind = Math.abs(U.angleDiff(zb.ang, Math.atan2(zb.y - p.y, zb.x - p.x))) < 0.8;
      if (behind && !zb.seesPlayer) { dmg *= 1.5; }
      var knock = w.knock * (0.8 + str * 0.04);
      var knockdown = crit && w.knock >= 0.5 && Math.random() < 0.5 + str * 0.03;
      var killed = CP.Zombies.damage(zb, dmg, p.ang, { stagger: Math.random() < 0.55 + knock * 0.2, knockdown: knockdown, knock: knock, cause: 'weapon' });
      CP.Player.addXp(p, w.skill, killed ? 3 : 1.5);
      if (killed) { CP.Player.addXp(p, 'strength', 0.3); }
      if (CP.Audio) { CP.Audio.hit(w.type, killed); }
      CP.Zombies.noise(zb.x, zb.y, zb.z, C.NOISE.HIT, 'hit');
      if (crit && CP.FX) { CP.FX.floatText(zb.x, zb.y, zb.z, killed ? '' : 'Crítico!', '#ffcc66'); }
      // desgaste da arma
      if (wp.item.cond !== undefined && wp.def.weapon) {
        var lower = w.lower * (1 + CP.Player.skillLevel(p, 'maintenance') * 0.12);
        if (Math.random() < 1 / lower) {
          wp.item.cond--;
          CP.Player.addXp(p, 'maintenance', 1);
          if (wp.item.cond <= 0) {
            if (CP.UI) { CP.UI.toast(wp.def.name + ' quebrou!', 'warn'); }
            if (CP.Audio) { CP.Audio.breakItem(); }
          }
        } else { CP.Player.addXp(p, 'maintenance', 0.15); }
      }
      // sangue respinga no jogador
      if (Math.random() < 0.25) { CP.Body && CP.Body.addBloodOnClothes(p, 0.05); }
    }
  }

  function startShove(p) {
    if (p.shoveCd > 0) { return; }
    p.anim.shove = 0.001;
    p.shoveCd = CB.SHOVE_COOLDOWN;
    if (CP.Audio) { CP.Audio.swing('shove'); }
  }
  function resolveShove(p) {
    useEndurance(p, CB.SHOVE_ENDURANCE);
    var list = CP.Zombies.near(p.x, p.y, CB.SHOVE_RANGE + 1, near).filter(function (zb) { return zb.state !== 'dead' && !CP.Zombies.isDown(zb) && inArc(p, zb, CB.SHOVE_RANGE, CB.SHOVE_ARC_DEG); });
    var str = CP.Player.skillLevel(p, 'strength');
    list.forEach(function (zb) {
      var kd = CB.SHOVE_KNOCKDOWN_BASE + str * 0.035 + (zb.state === 'stagger' ? 0.25 : 0) + (zb.seesPlayer ? 0 : 0.2);
      if (endurance(p) < 0.25) { kd *= 0.5; }
      var knockdown = Math.random() < kd;
      CP.Zombies.damage(zb, CB.FIST_DMG_MIN * 0.5, p.ang, { stagger: true, knockdown: knockdown, knock: 0.7 + str * 0.05 });
      CP.Player.addXp(p, 'strength', 0.2);
    });
    if (list.length) { CP.Zombies.noise(p.x, p.y, p.z, C.NOISE.SHOVE, 'shove'); if (CP.Audio) { CP.Audio.hit('shove', false); } }
  }

  function findDownedInFront(p) {
    var list = CP.Zombies.near(p.x, p.y, CB.STOMP_RANGE + 0.6, near);
    var best = null, bd = 99;
    for (var i = 0; i < list.length; i++) {
      var zb = list[i];
      if (!CP.Zombies.isDown(zb) || zb.state === 'dead' || Math.abs(zb.z - p.z) > 0.45) { continue; }
      var d = U.dist(zb.x, zb.y, p.x, p.y);
      var a = Math.abs(U.angleDiff(p.ang, Math.atan2(zb.y - p.y, zb.x - p.x)));
      if (d < CB.STOMP_RANGE + 0.35 && (a < 1.4 || d < 0.5) && d < bd) { bd = d; best = zb; }
    }
    return best;
  }
  function stomp(p, zb) {
    p.anim.shove = 0.45; // reaproveita a animação
    p.shoveCd = CB.STOMP_COOLDOWN;
    var str = CP.Player.skillLevel(p, 'strength');
    useEndurance(p, CB.SHOVE_ENDURANCE * 1.2);
    var dmg = U.randRange(CB.STOMP_DMG_MIN, CB.STOMP_DMG_MAX) * (0.75 + str * 0.05);
    if (zb.state === 'fakedead') { zb.state = 'down'; zb.downT = 1.5; }
    if (zb.state === 'down') { zb.downT = Math.max(zb.downT, 1.2); }
    var killed = CP.Zombies.damage(zb, dmg, p.ang, { cause: 'stomp' });
    if (CP.Audio) { CP.Audio.hit('stomp', killed); }
    CP.Player.addXp(p, 'strength', 0.4);
    CP.Zombies.noise(p.x, p.y, p.z, C.NOISE.HIT, 'stomp');
    if (Math.random() < 0.35 && CP.Body) { CP.Body.addBloodOnClothes(p, 0.08, 'shoes'); }
  }

  /* ---------- armas de fogo ---------- */
  function shoot(p, wp) {
    var it = wp.item, g = wp.def.gun;
    if ((it.ammo || 0) <= 0) {
      if (CP.Audio) { CP.Audio.click(); }
      p.attackCd = 0.4;
      if (CP.UI) { CP.UI.toast('Sem munição — R para recarregar', 'warn'); }
      return;
    }
    it.ammo--;
    p.attackCd = g.cd;
    p.anim.attack = 0;
    var aim = CP.Player.skillLevel(p, 'aiming');
    var panic = p.body ? p.body.stats.panic : 0;
    var pellets = g.pellets || 1;
    var spread = (g.spread || 0.12) * (1.4 - aim * 0.08) * (1 + panic / 120);
    var In = CP.Input;
    var mw = CP.Render.toWorld(In.mouse.x, In.mouse.y, p.z);
    var baseAng = Math.atan2(mw.y - p.y, mw.x - p.x);
    p.ang = baseAng;
    var lv = W.levelOf(p.z);
    for (var k = 0; k < pellets; k++) {
      var a = baseAng + U.randRange(-spread, spread);
      // primeiro zumbi atingido ao longo do raio
      var list = CP.Zombies.near(p.x, p.y, g.range + 1, near);
      var best = null, bd = 1e9;
      for (var i = 0; i < list.length; i++) {
        var zb = list[i];
        if (zb.state === 'dead' || Math.abs(zb.z - p.z) > 0.45) { continue; }
        var dx = zb.x - p.x, dy = zb.y - p.y;
        var along = dx * Math.cos(a) + dy * Math.sin(a);
        if (along < 0 || along > g.range) { continue; }
        var perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
        if (perp > ZC.RADIUS + 0.12) { continue; }
        if (along < bd && W.lineOfSight(p.x, p.y, zb.x, zb.y, lv, 40)) { bd = along; best = zb; }
      }
      var endX = p.x + Math.cos(a) * (best ? bd : g.range), endY = p.y + Math.sin(a) * (best ? bd : g.range);
      if (CP.FX) { CP.FX.tracer(p.x, p.y, p.z, endX, endY); }
      if (best) {
        var hitChance = g.acc + aim * 0.03 - (bd / g.range) * 0.3 - panic / 300;
        if (Math.random() < hitChance) {
          var dmg = U.randRange(g.dmin, g.dmax) * (0.8 + aim * 0.04);
          var crit = Math.random() < 0.1 + aim * 0.02;
          if (crit) { dmg *= 2; }
          var killed = CP.Zombies.damage(best, dmg, a, { stagger: true, knockdown: crit || g.pellets, knock: 0.5, cause: 'gun' });
          CP.Player.addXp(p, 'aiming', killed ? 4 : 2);
        } else { CP.Player.addXp(p, 'aiming', 0.5); }
      }
    }
    if (CP.Audio) { CP.Audio.gunshot(p.x, p.y, true, wp.def.id); }
    if (CP.FX) { CP.FX.muzzle(p.x, p.y, p.z, baseAng); }
    CP.Zombies.noise(p.x, p.y, p.z, g.noise, 'gunshot');
    if (p.body) { p.body.stats.panic = Math.max(0, p.body.stats.panic - 2); }
  }
  /* recarregar (R): pega munição do inventário */
  K.reload = function (p) {
    var wp = weaponOf(p);
    if (!wp || !wp.def.gun) { return false; }
    var g = wp.def.gun;
    if ((wp.item.ammo || 0) >= g.mag) { if (CP.UI) { CP.UI.toast('Arma já carregada.'); } return false; }
    if (CP.Items.Inv.count(p, g.ammo) <= 0) { if (CP.UI) { CP.UI.toast('Sem munição (' + D.ITEMS[g.ammo].name + ').', 'warn'); } return false; }
    p.reloadT = g.reload * (1.2 - CP.Player.skillLevel(p, 'reloading') * 0.06);
    p.reloadItem = wp.item;
    if (CP.Audio) { CP.Audio.reload(); }
    return true;
  };
  function finishReload(p) {
    var it = p.reloadItem;
    p.reloadItem = null;
    if (!it || p.hand1 !== it) { return; }
    var g = D.ITEMS[it.id].gun;
    var need = g.mag - (it.ammo || 0);
    var have = CP.Items.Inv.count(p, g.ammo);
    var n = Math.min(need, have);
    CP.Items.Inv.consume(p, g.ammo, n);
    it.ammo = (it.ammo || 0) + n;
    CP.Player.addXp(p, 'reloading', 1 + n * 0.3);
  }

  /* ---------- zumbi acerta o jogador ---------- */
  K.zombieHits = function (zb, p) {
    if (p.dead) { return; }
    // ser agarrado por vários = arrastado ao chão
    var attackers = CP.Zombies.near(p.x, p.y, 1.3, near).filter(function (o) { return o.state === 'attack' || (o.state === 'chase' && U.dist2(o.x, o.y, p.x, p.y) < 1.1); }).length;
    if (attackers >= ZC.DRAG_DOWN_COUNT && Math.random() < ZC.DRAG_DOWN_CHANCE * (attackers - ZC.DRAG_DOWN_COUNT + 1)) {
      if (CP.Body) { CP.Body.die(p, 'Foi arrastado e devorado por uma horda'); }
      return;
    }
    // chance de errar: jogador se afastando ou ágil
    var miss = 0.12 + (p.moving ? 0.12 : 0) + CP.Player.skillLevel(p, 'nimble') * 0.01;
    if (Math.random() < miss) { if (CP.Audio) { CP.Audio.swing('miss'); } return; }
    var behind = Math.abs(U.angleDiff(p.ang, Math.atan2(zb.y - p.y, zb.x - p.x))) > 2.0;
    var part = pickPart(zb, p);
    var wBite = ZC.BITE_W + (behind ? ZC.BITE_BEHIND_BONUS : 0) + (attackers > 1 ? 0.06 : 0);
    var r = Math.random() * (ZC.SCRATCH_W + ZC.LACER_W + wBite);
    var type = r < ZC.SCRATCH_W ? 'scratch' : (r < ZC.SCRATCH_W + ZC.LACER_W ? 'laceration' : 'bite');
    if (CP.Body) { CP.Body.zombieWound(p, part, type, zb); }
    if (CP.Audio) { CP.Audio.hurt(type); }
  };
  function pickPart(zb, p) {
    var parts = D.BODY_PARTS;
    var tot = 0, i;
    var crawl = zb.crawler || CP.Zombies.isDown(zb);
    for (i = 0; i < parts.length; i++) { tot += crawl ? (parts[i].id.indexOf('foot') === 0 || parts[i].id.indexOf('shin') === 0 ? 20 : 0.5) : parts[i].w; }
    var r = Math.random() * tot;
    for (i = 0; i < parts.length; i++) {
      var w = crawl ? (parts[i].id.indexOf('foot') === 0 || parts[i].id.indexOf('shin') === 0 ? 20 : 0.5) : parts[i].w;
      if (r < w) { return parts[i].id; }
      r -= w;
    }
    return 'torso';
  }

  CP.Combat = K;
})(window.CP = window.CP || {});
