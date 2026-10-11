/* Folha de uniformes (D.OUTFITS) em humanos e zumbis, ampliada */
module.exports = async (page, shot) => {
  await page.evaluate(() => {
    const S = CP.Spr, D = CP.D;
    const cv = document.createElement('canvas'); cv.width = 1366; cv.height = 768;
    cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
    document.body.appendChild(cv);
    const g = cv.getContext('2d'); g.fillStyle = '#4a4744'; g.fillRect(0, 0, 1366, 768);
    const keys = ['police', 'ranger', 'chef', 'fastfood', 'roadworker', 'doctor', 'fire', 'worker', 'civil_f', 'civil_m'];
    const skins = ['#e3b48f', '#a26a43', '#f1d2b6', '#c98e64', '#7a4a2c'];
    keys.forEach((k, i) => {
      const spec = D.OUTFITS[k][0];
      const items = spec.map(s => { const p = s.split(':'), d = D.ITEMS[p[0]]; return { id: p[0], color: p[1] || (d && d.cloth && d.cloth.colors ? d.cloth.colors[0] : '#777') }; });
      const fem = k === 'civil_f' || i % 3 === 2;
      const human = S.buildLook({ skin: skins[i % 5], hair: '#3b2a1c', hairStyle: fem ? 'longo' : 'curto', female: fem }, items);
      const zomb = S.buildLook({ skin: CP.C.ZOMBIE_SKIN[i % 7], hair: '#6b4a2b', hairStyle: fem ? 'longo' : 'curto', female: fem, zombie: true, seed: 1000 + i * 37, blood: [[0.2, 0.5, 3], [-0.4, 0.8, 2.5]] }, items.map(o => ({ id: o.id, color: CP.U.mix(o.color, '#5a5a4a', 0.35) })));
      const x = 70 + i * 128;
      [[human, 260, { ang: 0.8, phase: 0.2, moving: true }], [human, 420, { ang: 2.3, phase: 0.6, moving: true }], [zomb, 600, { ang: 0.8, phase: 0.3, moving: true, reach: true }], [zomb, 750, { ang: 2.4, phase: 0.1, moving: true }]].forEach(([lk, y, pose]) => {
        g.save(); g.translate(x, y - 14); g.scale(2.2, 2.2); S.drawHuman(g, 0, 0, lk, pose, 1); g.restore();
      });
      g.fillStyle = '#fff'; g.font = '13px sans-serif'; g.fillText(k, x - 30, 30);
    });
  });
  await shot('uniformes');
};
