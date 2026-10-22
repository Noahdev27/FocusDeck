import { readFile } from 'node:fs/promises';
import type { BrowserContextOptions, TestInfo } from '@playwright/test';
import { addTasks, expect, expectNoA11yViolations, openCheckedPage, test } from './fixtures';

/** Options du projet courant pour un contexte ouvert à la main. */
const contextOptions = (testInfo: TestInfo, storageState: BrowserContextOptions['storageState']): BrowserContextOptions => {
  const { baseURL, locale, timezoneId, viewport } = testInfo.project.use;
  return { baseURL, locale, timezoneId, viewport, storageState };
};

// Lot L4 : créer un projet, lancer un focus sur une tâche, terminer le cycle,
// vérifier le compteur et le rapport groupé par projet.
test('projet, focus sur une tâche, compteur de pomodoros et rapport groupé', async ({ page, problems, browser }, testInfo) => {
  void problems;
  await page.goto('/');

  // 1. Projet (sans horloge simulée : les animations de la modale doivent se terminer).
  await page.getByRole('button', { name: 'Projets' }).click();
  const dialog = page.getByRole('dialog', { name: 'Projets' });
  const form = dialog.getByRole('form', { name: 'Nouveau projet' });
  await form.getByLabel('Nom du projet').fill('Site Acme');
  await form.getByLabel('Client (facultatif)').fill('Acme');
  await form.getByTitle('Émeraude').click();
  await expect(form.getByRole('radio', { name: 'Émeraude' })).toBeChecked();
  await page.keyboard.press('ArrowRight'); // radios natifs : flèches pour changer de couleur
  await expect(form.getByRole('radio', { name: 'Cyan' })).toBeChecked();
  await page.keyboard.press('ArrowLeft');
  await form.getByRole('button', { name: 'Créer le projet' }).click();
  await expect(dialog.getByText('Actifs (1)')).toBeVisible();
  await expectNoA11yViolations(page, '[role="dialog"]');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // 2. Saisie rapide : projet et estimation reconnus pendant la saisie.
  const input = page.getByLabel('Nouvel objectif');
  await input.fill('Maquette accueil #site ~1');
  await expect(page.getByText('Projet : Site Acme')).toBeVisible();
  await expect(page.getByText('Estimation : 1 pomodoro')).toBeVisible();
  await input.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'Maquette accueil' })).toBeVisible();
  await expect(page.getByRole('img', { name: '0 pomodoro réalisé sur 1 estimé' })).toBeVisible();
  const afterSetup = await page.context().storageState();

  // 3. Focus sur la tâche jusqu'à la fin du cycle (horloge simulée, nouveau contexte).
  const timed = await openCheckedPage(browser, contextOptions(testInfo, afterSetup));
  await timed.page.clock.install();
  await timed.page.goto('/');
  await timed.page.getByRole('button', { name: 'Lancer un focus sur « Maquette accueil »' }).click();
  await expect(timed.page.getByText('Tâche en cours')).toBeVisible();
  await timed.page.clock.fastForward('25:01');
  await timed.page.clock.runFor(1000);
  await expect(timed.page.getByRole('tab', { name: /Pause courte/ })).toHaveAttribute('aria-selected', 'true');
  await expect(timed.page.getByRole('img', { name: '1 pomodoro réalisé sur 1 estimé' }).first()).toBeVisible();
  const afterCycle = await timed.page.context().storageState();
  await timed.close();

  // 4. Rapport groupé par projet.
  const report = await openCheckedPage(browser, contextOptions(testInfo, afterCycle));
  await report.page.goto('/');
  await expect(report.page.getByRole('region', { name: 'Temps par projet' })).toContainText('Site Acme (Acme)');
  await report.page.getByRole('button', { name: /Générer le rapport/ }).click();
  const reportDialog = report.page.getByRole('dialog', { name: 'Rapport de fin de journée' });
  await expect(reportDialog.getByRole('heading', { name: 'Temps par projet' })).toBeVisible();
  await expect(reportDialog.getByRole('heading', { name: 'Site Acme', level: 3 })).toBeVisible();
  const [download] = await Promise.all([
    report.page.waitForEvent('download'),
    reportDialog.getByRole('button', { name: /Télécharger \.md/ }).click(),
  ]);
  const markdown = await readFile(await download.path(), 'utf8');
  expect(markdown).toContain('| Site Acme (Acme) | 25 min | 0 |');
  expect(markdown).toContain('### Site Acme\n\n- [ ] Maquette accueil');
  await report.close();
});

test('suppression annulable au clavier et mode concentration', async ({ page, problems }) => {
  void problems;
  await page.goto('/');
  await addTasks(page, ['À garder', 'À supprimer']);

  // EF-O06 : le toast reçoit le focus quand la suppression vient du clavier.
  await page.getByRole('checkbox', { name: 'À supprimer' }).focus();
  await page.keyboard.press('Tab'); // titre
  await page.keyboard.press('Tab'); // lancer un focus
  await page.keyboard.press('Tab'); // renommer
  await page.keyboard.press('Tab'); // supprimer
  await page.keyboard.press('Enter');
  const notifications = page.getByRole('region', { name: 'Notifications' });
  await expect(notifications).toContainText('« À supprimer » supprimé.');
  await expect(notifications.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await expectNoA11yViolations(page);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('checkbox', { name: 'À supprimer' })).toBeVisible();

  // EF-T06 : F ouvre le mode concentration, Espace pilote le minuteur, Échap ferme.
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('f');
  const view = page.getByRole('dialog', { name: 'Mode concentration' });
  await expect(view).toBeVisible();
  await expect(view.getByRole('timer')).toHaveText('25:00');
  await expectNoA11yViolations(page, '[role="dialog"]');
  await page.keyboard.press('Space');
  await expect(view.getByRole('button', { name: /Pause/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(view).toBeHidden();
  await expect(page.getByRole('button', { name: /Pause/ })).toBeVisible();
});

test('un utilisateur v0.1 retrouve ses tâches et son historique après la migration v2', async ({ page, problems }) => {
  void problems;
  const today = await page.evaluate(() => new Date().toLocaleDateString('sv-SE'));
  const now = Date.now();
  await page.addInitScript(
    ({ day, at }) => {
      if (localStorage.getItem('focusdeck:v2:migrated')) return;
      localStorage.setItem(
        'focusdeck:v1:tasks',
        JSON.stringify([
          { id: '6f1c2a9e-7d1b-4c2e-9b1a-3e5f7a9c1d2b', title: 'Envoyer la facture', completed: false, createdAt: at - 7_200_000, completedAt: null },
          { id: '0a7e3c5b-2f4d-4a6e-8c1b-9d2e4f6a8b0c', title: 'Écrire le brief client', completed: true, createdAt: at - 7_300_000, completedAt: at - 3_600_000 },
        ]),
      );
      localStorage.setItem(
        'focusdeck:v1:logs',
        JSON.stringify({ [day]: { date: day, sessions: [{ id: 'focus:1', mode: 'focus', startedAt: at - 3_000_000, endedAt: at - 1_500_000, durationSeconds: 1500, completed: true }] } }),
      );
      localStorage.setItem('focusdeck:v1:settings', '{"focusMinutes":40,"soundEnabled":false}');
    },
    { day: today, at: now },
  );
  await page.goto('/');
  await expect(page.getByRole('checkbox', { name: 'Envoyer la facture' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Écrire le brief client' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('timer')).toHaveText('40:00');
  await expect(page.getByText('Cycles terminés').locator('..')).toContainText('1');

  // Le format v2 est écrit ; la copie v1 reste disponible pour un retour arrière.
  const storage = await page.evaluate(() => ({ v2: localStorage.getItem('focusdeck:v2:tasks'), v1: localStorage.getItem('focusdeck:v1:tasks') }));
  expect(JSON.parse(storage.v2 ?? '[]')).toHaveLength(2);
  expect(storage.v1).not.toBeNull();
  await page.reload();
  await expect(page.getByRole('checkbox')).toHaveCount(2);
});
