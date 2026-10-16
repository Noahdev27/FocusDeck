import { addTasks, expect, test } from './fixtures';

// Parcours critiques 1 et 2 (cahier des charges §8).
test('première visite : objectifs, cycle Focus complet, passage en pause', async ({ page, problems }) => {
  void problems;
  await page.clock.install();
  await page.goto('/');
  await addTasks(page, ['Écrire le brief', 'Relire la maquette', 'Envoyer la facture']);
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  await page.getByRole('checkbox', { name: 'Écrire le brief' }).click();

  await page.getByRole('button', { name: /Démarrer/ }).click();
  await page.clock.fastForward('25:01');
  await page.clock.runFor(1000);

  await expect(page.getByRole('tab', { name: /Pause courte/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('status')).toContainText('Cycle Focus terminé');
  await expect(page.getByRole('timer')).toHaveText('05:00');

  const logs = await page.evaluate(() => localStorage.getItem('focusdeck:v1:logs') ?? '{}');
  const sessions = Object.values(JSON.parse(logs) as Record<string, { sessions: { mode: string; completed: boolean }[] }>)[0]?.sessions;
  expect(sessions).toEqual([expect.objectContaining({ mode: 'focus', completed: true })]);
});

test('un rechargement en plein cycle reprend le décompte', async ({ page, problems }) => {
  void problems;
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: /Démarrer/ }).click();
  await page.clock.fastForward('10:00');
  await page.reload();
  // L'horloge continue de s'écouler après le rechargement : on tolère quelques secondes.
  await expect(page.getByRole('timer')).toHaveText(/^(15:00|14:5\d)$/);
  await expect(page.getByRole('button', { name: /Pause/ })).toBeVisible();
});
