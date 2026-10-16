import { readFile } from 'node:fs/promises';
import { addTasks, expect, expectNoA11yViolations, test } from './fixtures';

// Parcours critique 3 + accessibilité de la boîte de dialogue.
test('rapport : aperçu, export Markdown et PDF', async ({ page, problems }) => {
  void problems;
  await page.goto('/');
  await addTasks(page, ['Livrer la maquette']);
  await page.getByRole('checkbox', { name: 'Livrer la maquette' }).click();

  await page.getByRole('button', { name: /Générer le rapport/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Rapport de fin de journée' });
  await expect(dialog.getByRole('heading', { level: 1 })).toContainText('Rapport FocusDeck');
  await expectNoA11yViolations(page, '[role="dialog"]');

  const [markdown] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /Télécharger \.md/ }).click()]);
  expect(markdown.suggestedFilename()).toMatch(/^focusdeck-rapport-\d{4}-\d{2}-\d{2}\.md$/);
  const content = await readFile(await markdown.path(), 'utf8');
  expect(content).toContain('- [x] Livrer la maquette');

  await dialog.getByRole('radio', { name: 'PDF' }).click();
  const [pdf] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /Télécharger \.pdf/ }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  const bytes = await readFile(await pdf.path());
  expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  expect(bytes.length).toBeGreaterThan(2000);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
