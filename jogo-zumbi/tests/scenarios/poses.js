/* Folha de poses do jogador: golpes por tipo de arma (balanço, por cima, estocada), arma nas costas,
 * sentado na cadeira e no chão, lendo, comendo e dormindo coberto. */
module.exports = async (page, shot, log) => {
  await page.evaluate(() => {
    const p = CP.Game.player; CP.Game.paused = true;
    CP.Items.Inv.give(p, CP.Items.make('axe'));
    const look = CP.Player.lookFor(p);
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 920; cv.id = 'sheet';
    cv.style.cssText = 'position:fixed;left:0;top:0;z-index:999;background:#5f7a4a';
    document.body.appendChild(cv);
    const g = cv.getContext('2d'); g.scale(2, 2);
    g.font = '7px sans-serif'; g.fillStyle = '#fff';
    const rows = [
      [['taco: balanço', { weapon: 'blunt_short', attack: 0.3 }], ['taco', { weapon: 'blunt_short', attack: 0.6 }], ['machado: sobe', { weapon: 'axe', attack: 0.35 }], ['machado: desce', { weapon: 'axe', attack: 0.75 }], ['lança: puxa', { weapon: 'spear', attack: 0.3 }], ['lança: estoca', { weapon: 'spear', attack: 0.75 }], ['faca: estoca', { weapon: 'blade_short', attack: 0.75 }]],
      [['magro', { lk: { fat: -2 } }], ['gordo', { lk: { fat: 3 } }], ['barba por fazer', { lk: { stubble: 0.8 } }], ['barba e cabelo', { lk: { beard: true, hairStyle: 'longo' } }], ['curativos', { lk: { bandages: { farmR: '#ece8de', thighL: '#ece8de', head: '#ece8de' } } }], ['mancando', { moving: true, phase: 0.25, limp: -1 }], ['cicatriz', { lk: { faceScar: true }, ang: 0.9 }]],
      [['arma nas costas', { back: 1, ang: -2.4 }], ['de frente', { back: 1 }], ['cadeira', { sit: 1 }], ['chão', { sit: 2 }], ['lendo', { sit: 1, read: 1 }], ['comendo', { sip: 0.5 }], ['dormindo', { down: true, cover: '#5f6f8c', ang: 0.6 }]]
    ];
    rows.forEach((row, r) => row.forEach((c, i) => {
      const x = 45 + i * 80, y = 130 + r * 150, o = c[1];
      const lk = Object.assign({}, look, { backWeapon: null }, o.back ? { backWeapon: 'axe' } : {}, o.lk || {});
      const pose = Object.assign({ ang: o.ang !== undefined ? o.ang : 0.7, phase: 0, moving: false, t: 1 }, o);
      CP.Spr.drawHuman(g, x, y, lk, pose, 1);
      g.fillStyle = '#fff'; g.fillText(c[0], x - 25, y + 22);
    }));
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: process.argv[3] + '/poses.png', clip: { x: 0, y: 0, width: 1200, height: 920 } });
  log('ok');
};
