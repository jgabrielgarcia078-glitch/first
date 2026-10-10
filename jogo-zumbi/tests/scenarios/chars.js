/* Folha de personagens: homem, mulher, roupas variadas e zumbis em 8 direções e poses (ampliado) */
module.exports = async function (page, shot) {
  const draw = () => page.evaluate(() => {
    const S = CP.Spr;
    const old = document.querySelector('canvas[style*="99999"]');
    if (old) { old.remove(); }
    const cv = document.createElement('canvas');
    cv.width = 1366; cv.height = 768;
    cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#3a3f36';
    document.body.appendChild(cv);
    const g = cv.getContext('2d');
    g.fillStyle = '#4a4f42'; g.fillRect(0, 0, cv.width, cv.height);
    const looks = [
      S.buildLook({ skin: '#e3b48f', hair: '#3b2a1c', hairStyle: 'curto', beard: true }, [{ id: 'tshirt', color: '#3d5a80' }, { id: 'jeans', color: '#2f4f7f' }, { id: 'sneakers', color: '#e0e0e0' }]),
      S.buildLook({ skin: '#f1d2b6', hair: '#a77a45', hairStyle: 'longo', female: true }, [{ id: 'tshirt', color: '#bc4749' }, { id: 'jeans', color: '#3a5a8a' }, { id: 'sneakers', color: '#2b2d42' }]),
      S.buildLook({ skin: '#a26a43', hair: '#1d1612', hairStyle: 'rabo', female: true, bag: '#5a4a3a' }, [{ id: 'dress', color: '#2a9d8f' }, { id: 'shoes', color: '#1e1a18' }]),
      S.buildLook({ skin: '#c98e64', hair: '#1d1612', hairStyle: 'raspado' }, [{ id: 'shirt', color: '#f2e8cf' }, { id: 'jacket', color: '#3a2a1a' }, { id: 'pants', color: '#2b2d42' }, { id: 'boots', color: '#3a2418' }, { id: 'cap', color: '#bc4749' }]),
      S.buildLook({ skin: '#8f9b7f', hair: '#6b4a2b', hairStyle: 'médio', zombie: true, seed: 12345, blood: [[0.2, 0.5, 3], [-0.5, 0.2, 2]] }, [{ id: 'hoodie', color: '#4a5a6a' }, { id: 'jeans', color: '#3a4a5a' }, { id: 'sneakers', color: '#a0a0a0' }]),
      S.buildLook({ skin: '#a0a593', hair: '#d8b878', hairStyle: 'longo', female: true, zombie: true, seed: 999, blood: [[0, 0.7, 4]] }, [{ id: 'shirt', color: '#8a8070' }, { id: 'skirt', color: '#6a4a5a' }, { id: 'shoes', color: '#2a2a2a' }]),
      S.buildLook({ skin: '#7f8c75', hair: '#9a9a9a', hairStyle: 'careca', zombie: true, seed: 4242 }, [{ id: 'police_jacket', color: '#2a3344' }, { id: 'shirt', color: '#8a9aa8' }, { id: 'police_pants', color: '#2a3344' }, { id: 'shoes', color: '#1e1a18' }])
    ];
    const t = 0.3;
    for (let r = 0; r < looks.length; r++) {
      for (let c = 0; c < 8; c++) {
        const x = 40 + c * 80, y = 90 + r * 96;
        g.save(); g.translate(x, y); g.scale(1.45, 1.45);
        const pose = { ang: c * Math.PI / 4, phase: t + c * 0.1, moving: c % 2 === 0, reach: r === 4 && c < 4 };
        S.drawHuman(g, 0, 0, looks[r], pose, 1);
        g.restore();
      }
      // poses extras
      const x0 = 720;
      const poses = [
        { ang: 0.6, phase: 0, attack: 0.3, weapon: 'axe' }, { ang: 0.8, phase: 0.2, aim: true, weapon: 'shotgun' }, { ang: 0.8, phase: 0.4, moving: true, run: true },
        { ang: 0.8, crouch: true, phase: 0 }, { ang: 0.6, dead: true, phase: 0 }, { ang: 2.2, crawl: true, phase: 0.3 }, { ang: 1.2, down: true, phase: 0 }
      ];
      poses.forEach((p, i) => { g.save(); g.translate(x0 + i * 88, 90 + r * 96); g.scale(1.45, 1.45); S.drawHuman(g, 0, 0, looks[r], p, i === 6 ? 0.55 : 1); g.restore(); });
    }
  });
  await draw();
  await shot('folha');
  const regions = [[0, 0], [0, 384], [683, 0], [683, 384]];
  for (const [zx, zy] of regions) {
    await draw();
    await page.evaluate(([zx, zy]) => { const c = document.querySelector('canvas[style*="99999"]'); const g = c.getContext('2d'); const d = g.getImageData(zx, zy, 683, 384); const c2 = document.createElement('canvas'); c2.width = 683; c2.height = 384; c2.getContext('2d').putImageData(d, 0, 0); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 1366, 768); g.drawImage(c2, 0, 0, 1366, 768); }, [zx, zy]);
    await shot('zoom-' + zx + '-' + zy);
  }
};
