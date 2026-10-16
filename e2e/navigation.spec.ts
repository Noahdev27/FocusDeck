import { expect, expectNoA11yViolations, test } from './fixtures';

// EF-X07 : routes, liens profonds, historique, minuteur persistant entre pages.
test('navigation entre les pages sans interrompre le minuteur', async ({ page, problems }) => {
  void problems;
  await page.goto('/');
  await page.getByRole('button', { name: /Démarrer/ }).click();
  const nav = page.getByRole('navigation', { name: 'Navigation principale' }).first();

  await nav.getByRole('link', { name: 'Statistiques' }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByRole('heading', { name: 'Statistiques' })).toBeVisible();
  await expectNoA11yViolations(page);

  await nav.getByRole('link', { name: 'Réglages' }).click();
  await expect(page).toHaveURL(/\/reglages$/);
  await expect(page.getByRole('spinbutton', { name: 'Focus (min)' })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goBack();
  await expect(page).toHaveURL(/\/stats$/);
  await page.goBack();
  await expect(page.getByRole('button', { name: /Pause/ })).toBeVisible();
});

test('les liens profonds se chargent directement', async ({ page, problems }) => {
  void problems;
  for (const [path, heading] of [
    ['/rapports', 'Rapports'],
    ['/stats', 'Statistiques'],
    ['/inconnue', 'Page introuvable'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
});
