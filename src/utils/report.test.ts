import { describe, expect, it } from 'vitest';
import type { DayLog, Task } from '../types';
import { buildDailyReport, escapeMarkdown, reportFilename, reportToMarkdown } from './report';

const day = new Date(2026, 9, 16, 9, 0).getTime();
const at = (hours: number, minutes = 0) => day + (hours - 9) * 3_600_000 + minutes * 60_000;

const log: DayLog = {
  date: '2026-10-16',
  sessions: [
    { id: 'a', mode: 'focus', startedAt: at(9), endedAt: at(9, 25), durationSeconds: 1500, completed: true },
    { id: 'b', mode: 'shortBreak', startedAt: at(9, 25), endedAt: at(9, 30), durationSeconds: 300, completed: true },
    { id: 'c', mode: 'focus', startedAt: at(9, 30), endedAt: at(9, 40), durationSeconds: 600, completed: false },
  ],
};

const tasks: Task[] = [
  { id: '1', title: 'Écrire le brief *client*', completed: true, createdAt: at(9), completedAt: at(9, 20) },
  { id: '2', title: 'Relire la maquette', completed: false, createdAt: at(9), completedAt: null },
  // Terminée la veille : ne doit pas apparaître dans le rapport du jour.
  { id: '3', title: 'Ancienne tâche', completed: true, createdAt: at(9) - 86_400_000, completedAt: at(9) - 86_400_000 },
];

describe('buildDailyReport', () => {
  const report = buildDailyReport(log, tasks, at(18));

  it('agrège cycles, temps de focus et de pause', () => {
    expect(report.completedCycles).toBe(1);
    expect(report.focusSeconds).toBe(2100);
    expect(report.breakSeconds).toBe(300);
    expect(report.interruptedSessions).toBe(1);
  });

  it('ne retient que les tâches terminées le jour même', () => {
    expect(report.completedTasks.map((task) => task.id)).toEqual(['1']);
    expect(report.pendingTasks.map((task) => task.id)).toEqual(['2']);
    expect(report.completionRate).toBe(0.5);
  });

  it('gère une journée vide', () => {
    const empty = buildDailyReport({ date: '2026-10-16', sessions: [] }, []);
    expect(empty).toMatchObject({ completedCycles: 0, focusSeconds: 0, completionRate: 0 });
  });
});

describe('reportToMarkdown', () => {
  const markdown = reportToMarkdown(buildDailyReport(log, tasks, at(18)));

  it('produit un document structuré', () => {
    expect(markdown).toMatch(/^# Rapport FocusDeck — vendredi 16 octobre 2026/);
    expect(markdown).toContain('| Cycles Pomodoro terminés | 1 |');
    expect(markdown).toContain('| Temps de focus total | 35 min |');
    expect(markdown).toContain('## Tâches complétées (1)');
    expect(markdown).toContain('- [ ] Relire la maquette');
  });

  it('échappe le Markdown présent dans les titres de tâches', () => {
    expect(markdown).toContain('- [x] Écrire le brief \\*client\\*');
    expect(escapeMarkdown('a|b_c')).toBe('a\\|b\\_c');
  });

  it('nomme les fichiers par date', () => {
    expect(reportFilename(buildDailyReport(log, []), 'pdf')).toBe('focusdeck-rapport-2026-10-16.pdf');
  });
});
