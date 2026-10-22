import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { expect, expectNoA11yViolations, test } from './fixtures';

/**
 * Historique injecté dans le navigateur (fuseau Europe/Paris) : 5 jours consécutifs jusqu'à
 * aujourd'hui, un cycle de 25 min par jour, le dernier rattaché à une tâche du projet « Site Acme ».
 */
async function seedHistory(page: Page) {
  await page.addInitScript(() => {
    if (localStorage.getItem('focusdeck:v2:migrated')) return;
    const key = (date: Date) => date.toLocaleDateString('sv-SE');
    const logs: Record<string, unknown> = {};
    for (let offset = 4; offset >= 0; offset -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - offset);
      day.setHours(9, 0, 0, 0);
      const date = key(day);
      const startedAt = day.getTime();
      logs[date] = {
        date,
        sessions: [
          { id: `focus:${startedAt}`, mode: 'focus', startedAt, endedAt: startedAt + 1_500_000, durationSeconds: 1500, completed: true, taskId: offset === 0 ? 't1' : null },
        ],
      };
    }
    localStorage.setItem('focusdeck:v2:logs', JSON.stringify(logs));
    localStorage.setItem('focusdeck:v2:projects', JSON.stringify([{ id: 'p1', name: 'Site Acme', color: '#34d399', client: 'Acme', createdAt: 1, archivedAt: null }]));
    localStorage.setItem(
      'focusdeck:v2:tasks',
      JSON.stringify([{ id: 't1', title: 'Maquette; v2', completed: false, createdAt: 1, completedAt: null, projectId: 'p1' }]),
    );
    localStorage.setItem('focusdeck:v2:settings', JSON.stringify({ dailyGoal: 4, soundEnabled: false }));
    localStorage.setItem('focusdeck:v2:migrated', '1');
  });
}

test('statistiques : série, totaux, objectif et carte de chaleur', async ({ page, problems }) => {
  void problems;
  await seedHistory(page);
  await page.goto('/stats');
  const kpis = page.getByRole('region', { name: 'Indicateurs' });
  await expect(kpis).toContainText('2 h 05 min'); // 5 × 25 min sur 7 jours
  await expect(kpis).toContainText('5 j');
  await expect(kpis).toContainText('Record : 5 jours');
  await expect(page.getByRole('meter', { name: 'Objectif quotidien de cycles' })).toHaveAttribute('aria-valuetext', '1 cycle sur 4');
  await expect(page.getByRole('region', { name: 'Répartition par projet' })).toContainText('Site Acme');
  await expect(page.getByRole('group', { name: /Carte de chaleur des 12 derniers mois : 5 jours/ })).toBeVisible();

  // Le graphique se parcourt au clavier.
  const chart = page.getByRole('group', { name: /Temps de focus par jour sur 7 jours/ });
  await chart.focus();
  await page.keyboard.press('End');
  await expect(page.getByText(/25 min de focus, 1 cycle/)).toBeAttached();
  await expectNoA11yViolations(page);

  await page.getByRole('radio', { name: '30 jours' }).click();
  await expect(kpis).toContainText('Focus sur 30 jours');
  await page.getByText('Voir les données').first().click();
  await expect(page.getByRole('table', { name: 'Temps de focus par jour sur 30 jours' }).locator('tbody tr')).toHaveCount(30);
  await expectNoA11yViolations(page);
});

test('rapports : plage libre, filtre projet et export CSV pour Excel', async ({ page, problems }) => {
  void problems;
  await seedHistory(page);
  await page.goto('/rapports');
  const today = await page.evaluate(() => new Date().toLocaleDateString('sv-SE'));
  const weekAgo = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() - 6);
    return date.toLocaleDateString('sv-SE');
  });

  await page.getByRole('radio', { name: 'Plage libre' }).click();
  await page.getByLabel('Du', { exact: true }).fill(weekAgo);
  await page.getByLabel('Au', { exact: true }).fill(today);
  const summary = page.getByRole('region', { name: 'Résumé de la période' });
  await expect(summary).toContainText('2 h 05 min');
  await expectNoA11yViolations(page);

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV des sessions' }).click()]);
  expect(download.suggestedFilename()).toBe(`focusdeck-rapport-${weekAgo}_${today}.csv`);
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  const lines = csv.slice(1).split('\r\n');
  expect(lines[0]).toBe('Date;Début;Fin;Mode;Durée (min);Tâche;Projet');
  expect(lines.filter((line) => line.includes(';Focus;25;'))).toHaveLength(5);
  expect(lines).toContain(`${today};09:00;09:25;Focus;25;"Maquette; v2";Site Acme`);

  // Filtre projet : seule la session de la tâche « Site Acme » reste.
  await page.getByRole('combobox', { name: 'Projet' }).selectOption('p1');
  await expect(summary).toContainText('25 min');
  await expect(page.getByText('Projet : Site Acme')).toBeVisible();
});
