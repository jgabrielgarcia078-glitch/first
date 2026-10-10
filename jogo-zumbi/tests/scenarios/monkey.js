/* "Teste do macaco": entradas aleatórias por vários minutos, procurando erros. */
module.exports = async (page, shot, log) => {
  const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'KeyC', 'KeyE', 'Space', 'KeyF', 'KeyI', 'KeyH', 'KeyK', 'KeyB', 'KeyM', 'KeyZ', 'KeyR', 'Digit1', 'Escape', 'BracketRight', 'BracketLeft', 'KeyG', 'KeyQ'];
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const seconds = Number(process.env.SECS || 180);
  const t0 = Date.now();
  // dá itens variados para exercitar menus
  await page.evaluate(() => { const p = CP.Game.player; ['bat', 'pistol', 'ammo9', 'bandage', 'beans', 'canopener', 'hammer', 'plank', 'nails', 'sheet', 'novel', 'molotov', 'flashlight', 'apple', 'disinfectant', 'hiking_bag', 'jacket', 'water_bottle'].forEach(id => CP.Items.Inv.give(p, CP.Items.make(id, id === 'ammo9' ? { n: 30 } : (id === 'nails' ? { n: 20 } : null)))); });
  let n = 0;
  while ((Date.now() - t0) / 1000 < seconds) {
    const r = rnd();
    if (r < 0.45) {
      const k = keys[Math.floor(rnd() * 4)];
      await page.keyboard.down(k); await page.waitForTimeout(200 + rnd() * 900); await page.keyboard.up(k);
    } else if (r < 0.65) {
      await page.keyboard.press(keys[Math.floor(rnd() * keys.length)]);
    } else if (r < 0.8) {
      await page.mouse.click(200 + rnd() * 900, 150 + rnd() * 450, { button: rnd() < 0.5 ? 'left' : 'right' });
      await page.waitForTimeout(120);
      // às vezes clica numa opção do menu de contexto
      const opts = await page.$$('.ctx div[data-a="ctx"]:not(.dis)');
      if (opts.length && rnd() < 0.6) { await opts[Math.floor(rnd() * opts.length)].click().catch(() => {}); }
    } else if (r < 0.9) {
      const items = await page.$$('.item');
      if (items.length) { await items[Math.floor(rnd() * items.length)].click().catch(() => {}); await page.waitForTimeout(100); const o = await page.$$('.ctx div[data-a="ctx"]:not(.dis)'); if (o.length) await o[Math.floor(rnd() * o.length)].click().catch(() => {}); }
    } else {
      await page.mouse.move(200 + rnd() * 900, 150 + rnd() * 450);
      await page.mouse.down({ button: 'right' }); await page.waitForTimeout(300); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); await page.mouse.up({ button: 'right' });
    }
    n++;
    if (n % 60 === 0) {
      const st = await page.evaluate(() => ({ t: CP.Time.clockText(), dead: CP.Game.player.dead, hp: Math.round(CP.Game.player.body.health), kills: CP.Game.state.kills, zs: CP.Game.zombies.length, fps: CP.Game.fps, screen: CP.UI.screen }));
      log(n, JSON.stringify(st));
      if (st.dead || st.screen !== 'game') {
        await shot('morte-' + n);
        // recomeça para continuar testando
        await page.click('[data-a="menu-new"]').catch(() => {});
        await page.waitForTimeout(300);
        await page.click('[data-a="create-start"]').catch(() => {});
        await page.waitForTimeout(1000);
      }
    }
  }
  await shot('fim');
};
