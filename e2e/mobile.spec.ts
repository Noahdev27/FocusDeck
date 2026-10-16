import { addTasks, expect, expectNoA11yViolations, test } from './fixtures';

// Parcours critique 5 : largeur 390 px.
test('mobile : pas de défilement horizontal, actions atteignables', async ({ page, problems }) => {
  void problems;
  await page.goto('/');
  await addTasks(page, ['Une tâche au titre volontairement très long pour vérifier la troncature sur mobile']);
  // Le message « liste vide » disparaît en fondu : attendre sa sortie avant les contrôles.
  await expect(page.getByText(/Découpez votre journée/)).toBeHidden();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);

  for (const name of [/Démarrer/, /Phase suivante/, /Rapport/, /Réglages du minuteur/]) {
    await expect(page.getByRole('button', { name }).first()).toBeVisible();
  }
  await expectNoA11yViolations(page);

  // Barre de navigation basse : visible, fonctionnelle, sans masquer le contenu.
  const bottomNav = page.getByRole('navigation', { name: 'Navigation principale' }).last();
  await expect(bottomNav).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const footer = await page.locator('footer').boundingBox();
  const bar = await bottomNav.boundingBox();
  expect(footer && bar && footer.y + footer.height <= bar.y + 1).toBe(true);

  await bottomNav.getByRole('link', { name: 'Stats' }).click();
  await expect(page.getByRole('heading', { name: 'Statistiques' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expectNoA11yViolations(page);
});
