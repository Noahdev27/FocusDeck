import { describe, expect, it } from 'vitest';
import type { DayLog, Project, Task } from '../types';
import { buildDailyReport, buildReport, csvCell, escapeMarkdown, groupLabel, reportFilename, reportToCsv, reportToMarkdown } from './report';

const day = new Date(2026, 9, 16, 9, 0).getTime();
const at = (hours: number, minutes = 0) => day + (hours - 9) * 3_600_000 + minutes * 60_000;

const log: DayLog = {
  date: '2026-10-16',
  sessions: [
    { id: 'a', mode: 'focus', startedAt: at(9), endedAt: at(9, 25), durationSeconds: 1500, completed: true, taskId: null },
    { id: 'b', mode: 'shortBreak', startedAt: at(9, 25), endedAt: at(9, 30), durationSeconds: 300, completed: true, taskId: null },
    { id: 'c', mode: 'focus', startedAt: at(9, 30), endedAt: at(9, 40), durationSeconds: 600, completed: false, taskId: null },
  ],
};

const tasks: Task[] = [
  { id: '1', title: 'Écrire le brief *client*', completed: true, createdAt: at(9), completedAt: at(9, 20), projectId: null, estimate: null, plannedFor: null },
  { id: '2', title: 'Relire la maquette', completed: false, createdAt: at(9), completedAt: null, projectId: null, estimate: null, plannedFor: null },
  // Terminée la veille : ne doit pas apparaître dans le rapport du jour.
  { id: '3', title: 'Ancienne tâche', completed: true, createdAt: at(9) - 86_400_000, completedAt: at(9) - 86_400_000, projectId: null, estimate: null, plannedFor: null },
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

describe('rapport groupé par projet (lot L4)', () => {
  const projects: Project[] = [
    { id: 'p1', name: 'Site Acme', color: '#34d399', client: 'Acme', createdAt: 1, archivedAt: null },
    { id: 'p2', name: 'Blog', color: '#fb7185', client: null, createdAt: 2, archivedAt: null },
    { id: 'p3', name: 'Inactif', color: '#60a5fa', client: null, createdAt: 3, archivedAt: null },
  ];
  const base = { completed: false, createdAt: at(9), completedAt: null, estimate: null, plannedFor: null };
  const projectTasks: Task[] = [
    { ...base, id: 't1', title: 'Maquette', projectId: 'p1', completed: true, completedAt: at(10) },
    { ...base, id: 't2', title: 'Intégration', projectId: 'p1' },
    { ...base, id: 't3', title: 'Article', projectId: 'p2' },
    { ...base, id: 't4', title: 'Courses', projectId: null },
    { ...base, id: 't5', title: 'Projet supprimé', projectId: 'disparu' },
    { ...base, id: 't6', title: 'Plus tard', projectId: 'p1', plannedFor: '2026-10-17' },
  ];
  const projectLog: DayLog = {
    date: '2026-10-16',
    sessions: [
      { id: 'a', mode: 'focus', startedAt: at(9), endedAt: at(9, 25), durationSeconds: 1500, completed: true, taskId: 't1' },
      { id: 'b', mode: 'focus', startedAt: at(10), endedAt: at(10, 25), durationSeconds: 1500, completed: true, taskId: 't2' },
      { id: 'c', mode: 'shortBreak', startedAt: at(10, 25), endedAt: at(10, 30), durationSeconds: 300, completed: true, taskId: null },
      { id: 'd', mode: 'focus', startedAt: at(11), endedAt: at(11, 10), durationSeconds: 600, completed: false, taskId: null },
      { id: 'e', mode: 'focus', startedAt: at(12), endedAt: at(12, 25), durationSeconds: 1500, completed: true, taskId: 'tâche-supprimée' },
    ],
  };
  const report = buildDailyReport(projectLog, projectTasks, at(18), projects);

  it('répartit le temps de focus et les tâches par projet, « Sans projet » en dernier', () => {
    expect(report.projectGroups.map((g) => [g.name, g.focusSeconds, g.completedTasks.length, g.pendingTasks.length])).toEqual([
      ['Site Acme', 3000, 1, 1],
      ['Blog', 0, 0, 1],
      ['Sans projet', 2100, 0, 2],
    ]);
  });

  it('sort les tâches reportées du taux de complétion', () => {
    expect(report.postponedTasks.map((t) => t.id)).toEqual(['t6']);
    expect(report.pendingTasks.map((t) => t.id)).not.toContain('t6');
    expect(report.completionRate).toBe(1 / 5);
  });

  it('reste plat sans projet concerné', () => {
    expect(buildDailyReport(log, tasks, at(18), projects).projectGroups).toEqual([]);
    expect(buildDailyReport(projectLog, projectTasks, at(18)).projectGroups).toEqual([]);
  });

  it('Markdown : temps par projet, sous-titres par projet, reportées', () => {
    const markdown = reportToMarkdown(report);
    expect(markdown).toContain('## Temps par projet');
    expect(markdown).toContain('| Site Acme (Acme) | 50 min | 1 |');
    expect(markdown).toContain('| Sans projet | 35 min | 0 |');
    expect(markdown).toContain('### Site Acme\n\n- [x] Maquette');
    expect(markdown).toMatch(/## À reprendre \(4\)\n\n### Site Acme\n\n- \[ \] Intégration\n\n### Blog\n\n- \[ \] Article/);
    expect(markdown).toMatch(/## Reportées \(1\)\n\n- \[ \] Plus tard — prévue sam\. 17 oct\./);
    expect(groupLabel({ name: 'A', client: null })).toBe('A');
  });
});

describe('rapport de période (lot L3, EF-R02, EF-R04)', () => {
  const projects: Project[] = [{ id: 'p1', name: 'Site Acme', color: '#34d399', client: 'Acme', createdAt: 1, archivedAt: null }];
  const base = { completed: false, createdAt: at(9), completedAt: null, estimate: null, plannedFor: null };
  const periodTasks: Task[] = [
    { ...base, id: 't1', title: 'Maquette', projectId: 'p1', completed: true, completedAt: at(10) - 86_400_000 },
    { ...base, id: 't2', title: '=SOMME(A1:A9); "test"', projectId: null },
  ];
  const logs: Record<string, DayLog> = {
    '2026-10-15': {
      date: '2026-10-15',
      sessions: [{ id: 'x', mode: 'focus', startedAt: at(9) - 86_400_000, endedAt: at(9, 25) - 86_400_000, durationSeconds: 1500, completed: true, taskId: 't1' }],
    },
    '2026-10-16': {
      date: '2026-10-16',
      sessions: [
        { id: 'y', mode: 'focus', startedAt: at(11), endedAt: at(11, 12), durationSeconds: 750, completed: false, taskId: 't2' },
        { id: 'z', mode: 'shortBreak', startedAt: at(11, 12), endedAt: at(11, 17), durationSeconds: 300, completed: true, taskId: null },
      ],
    },
    '2026-10-01': { date: '2026-10-01', sessions: [{ id: 'hors', mode: 'focus', startedAt: 1, endedAt: 2, durationSeconds: 1500, completed: true, taskId: null }] },
  };
  const data = { logs, tasks: periodTasks, projects };
  const week = buildReport({ from: '2026-10-12', to: '2026-10-16' }, { projectId: 'all' }, data, at(18));

  it('agrège la période et liste ses sessions dans l’ordre', () => {
    expect(week).toMatchObject({ from: '2026-10-12', to: '2026-10-16', scope: null, focusSeconds: 2250, completedCycles: 1, breakSeconds: 300 });
    expect(week.sessions.map((s) => [s.session.id, s.taskTitle, s.projectName])).toEqual([
      ['x', 'Maquette', 'Site Acme'],
      ['y', '=SOMME(A1:A9); "test"', null],
      ['z', null, null],
    ]);
    expect(week.completedTasks.map((t) => t.id)).toEqual(['t1']);
  });

  it('filtre par projet (et « sans projet »)', () => {
    const acme = buildReport({ from: '2026-10-12', to: '2026-10-16' }, { projectId: 'p1' }, data, at(18));
    expect(acme).toMatchObject({ scope: 'Site Acme', focusSeconds: 1500, completedCycles: 1 });
    expect(acme.pendingTasks).toEqual([]);
    const none = buildReport({ from: '2026-10-12', to: '2026-10-16' }, { projectId: 'none' }, data, at(18));
    expect(none).toMatchObject({ scope: 'Sans projet', focusSeconds: 750, breakSeconds: 300 });
    expect(none.pendingTasks.map((t) => t.id)).toEqual(['t2']);
  });

  it('une période passée ne liste pas de tâches « à reprendre »', () => {
    const past = buildReport({ from: '2026-10-01', to: '2026-10-07' }, { projectId: 'all' }, data, at(18));
    expect(past).toMatchObject({ focusSeconds: 1500, pendingTasks: [], postponedTasks: [] });
    const markdown = reportToMarkdown(past);
    expect(markdown).toMatch(/^# Rapport FocusDeck — du jeudi 1 octobre 2026 au mercredi 7 octobre 2026/);
    expect(markdown).not.toContain('À reprendre');
    expect(markdown).toContain('_Aucune tâche complétée sur la période._');
    expect(reportFilename(past, 'csv')).toBe('focusdeck-rapport-2026-10-01_2026-10-07.csv');
  });

  it('Markdown de période : projet filtré, dates des tâches', () => {
    const markdown = reportToMarkdown(buildReport({ from: '2026-10-12', to: '2026-10-16' }, { projectId: 'p1' }, data, at(18)));
    expect(markdown).toContain('_Projet : Site Acme_');
    expect(markdown).toMatch(/- \[x\] Maquette — jeu\. 15 oct\. 10:00/);
    expect(markdown).toContain('_Généré le ven. 16 oct. à 18:00_');
  });

  it('CSV pour Excel FR : BOM, « ; », CRLF, minutes à virgule, formules neutralisées', () => {
    const csv = reportToCsv(week);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Date;Début;Fin;Mode;Durée (min);Tâche;Projet');
    expect(lines[1]).toBe('2026-10-15;09:00;09:25;Focus;25;Maquette;Site Acme');
    expect(lines[2]).toBe('2026-10-16;11:00;11:12;Focus;12,5;"\'=SOMME(A1:A9); ""test""";');
    expect(lines[3]).toBe('2026-10-16;11:12;11:17;Pause courte;5;;');
    expect(lines[4]).toBe('');
    expect(csvCell('+33 6 12')).toBe("'+33 6 12");
    expect(csvCell('ligne\nsuivante')).toBe('"ligne\nsuivante"');
    expect(reportToCsv({ sessions: [] })).toBe('﻿Date;Début;Fin;Mode;Durée (min);Tâche;Projet\r\n');
  });
});
