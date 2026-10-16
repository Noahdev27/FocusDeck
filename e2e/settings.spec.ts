import { expect, expectNoA11yViolations, test } from './fixtures';

// Parcours critique 4 + accessibilité des pages et modales.
test('changer la durée Focus s’applique à la phase inactive', async ({ page, problems }) => {
  void problems;
  await page.goto('/');
  await page.getByRole('button', { name: 'Réglages du minuteur' }).click();
  const dialog = page.getByRole('dialog', { name: 'Réglages du minuteur' });
  const focus = dialog.getByRole('spinbutton', { name: 'Focus (min)' });
  await focus.fill('30');
  await focus.press('Enter');
  await expectNoA11yViolations(page, '[role="dialog"]');
  await dialog.getByRole('button', { name: 'Terminé' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('timer')).toHaveText('30:00');

  await page.reload();
  await expect(page.getByRole('timer')).toHaveText('30:00');
});

test('tableau de bord et aide des raccourcis accessibles', async ({ page, problems }) => {
  void problems;
  await page.goto('/');
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Raccourcis clavier' }).click();
  await expect(page.getByRole('dialog', { name: 'Raccourcis clavier' })).toBeVisible();
  await expectNoA11yViolations(page, '[role="dialog"]');
});
