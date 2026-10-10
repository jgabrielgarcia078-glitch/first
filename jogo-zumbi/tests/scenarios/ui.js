/* Interface: moodles, painel de saúde com ferimentos e inventário (screenshots) */
module.exports = async (page, shot) => {
  await page.evaluate(() => {
    const p = CP.Game.player, B = CP.Body;
    B.addWound(p, 'farmL', 'laceration', {});
    B.addWound(p, 'thighR', 'scratch', {});
    p.body.stats.hunger = 0.5; p.body.stats.thirst = 0.3; p.body.stats.fatigue = 0.65;
    CP.UI.toggle('health', true);
  });
  await page.waitForTimeout(700);
  await shot('saude');
  await page.evaluate(() => { CP.UI.toggle('health', false); CP.UI.toggle('inv', true); });
  await page.waitForTimeout(500);
  await shot('inventario');
  await page.evaluate(() => { CP.UI.toggle('inv', false); CP.UI.toggle('skills', true); });
  await page.waitForTimeout(400);
  await shot('personagem');
};
