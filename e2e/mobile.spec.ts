import { addTasks, expect, expectNoA11yViolations, test } from './fixtures';

// Parcours critique 5 : largeur 390 px.
test('mobile : pas de défilement horizontal, actions atteignables', async ({ page, problems }) => {
  void problems;
  await page.goto('/');
  await addTasks(page, ['Une tâche au titre volontairement très long pour vérifier la troncature sur mobile']);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);

  for (const name of [/Démarrer/, /Phase suivante/, /Rapport/, /Réglages du minuteur/]) {
    await expect(page.getByRole('button', { name }).first()).toBeVisible();
  }
  await expectNoA11yViolations(page);
});
