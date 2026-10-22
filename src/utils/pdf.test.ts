import { describe, expect, it } from 'vitest';
import type { Report, Task } from '../types';
import { buildReportPdf } from './pdf';

const task = (id: string, title: string, completed: boolean): Task => ({
  id,
  title,
  completed,
  createdAt: 0,
  completedAt: completed ? new Date(2026, 9, 16, 10, 30).getTime() : null,
  projectId: null,
  estimate: null,
  plannedFor: null,
});

const baseReport: Report = {
  from: '2026-10-16',
  to: '2026-10-16',
  scope: null,
  generatedAt: new Date(2026, 9, 16, 18, 0).getTime(),
  completedCycles: 3,
  focusSeconds: 4500,
  breakSeconds: 900,
  interruptedSessions: 1,
  completedTasks: [task('a', 'Écrire le brief client', true)],
  pendingTasks: [task('b', 'Relire la maquette', false)],
  completionRate: 0.5,
  postponedTasks: [],
  projectGroups: [],
  sessions: [],
};

/** Texte brut du PDF (flux non compressés par défaut dans jsPDF). */
const pdfText = (doc: Awaited<ReturnType<typeof buildReportPdf>>) => doc.output();

describe('buildReportPdf', () => {
  it('contient le titre, les statistiques et les tâches', async () => {
    const doc = await buildReportPdf(baseReport);
    const text = pdfText(doc);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(text).toContain('Rapport FocusDeck');
    expect(text).toContain('1 h 15 min');
    expect(text).toContain('Relire la maquette');
    expect(text).toContain('50 %');
  });

  it('affiche des libellés de remplacement pour une journée vide', async () => {
    const doc = await buildReportPdf({ ...baseReport, completedTasks: [], pendingTasks: [], completionRate: 0 });
    const text = pdfText(doc);
    expect(text).toContain('Rien en attente');
  });

  it('groupe par projet : temps par projet, sous-titres, reportées', async () => {
    const completed = task('a', 'Écrire le brief client', true);
    const pending = task('b', 'Relire la maquette', false);
    const doc = await buildReportPdf({
      ...baseReport,
      postponedTasks: [{ ...task('c', 'Facturer Acme', false), plannedFor: '2026-10-17' }],
      projectGroups: [
        { projectId: 'p1', name: 'Site Acme', color: '#34d399', client: 'Acme', focusSeconds: 3000, completedTasks: [completed], pendingTasks: [] },
        { projectId: null, name: 'Sans projet', color: null, client: null, focusSeconds: 1500, completedTasks: [], pendingTasks: [pending] },
      ],
    });
    const text = pdfText(doc);
    expect(text).toContain('Temps par projet');
    expect(text).toContain('Site Acme \\(Acme\\)');
    expect(text).toContain('50 min');
    expect(text).toContain('SANS PROJET');
    expect(text).toContain('Reportées \\(1\\)');
    expect(text).toContain('Facturer Acme');
  });

  it('ajoute des pages quand la liste est longue', async () => {
    const pendingTasks = Array.from({ length: 80 }, (_, i) => task(`p${i}`, `Tâche numéro ${i}`, false));
    const doc = await buildReportPdf({ ...baseReport, pendingTasks });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
