import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DayLog, Project, SessionRecord, Task } from '../types';
import { buildDailyReport, buildReport } from '../utils/report';
import {
  aggregate,
  buildStats,
  dailyTotals,
  dateRange,
  durationTicks,
  endOfMonth,
  focusByProject,
  goalProgress,
  heatmap,
  MAX_RANGE_DAYS,
  startOfMonth,
  startOfWeek,
  streaks,
  summarize,
} from './stats';

// Les calculs portent sur des jours locaux : on se place en Europe/Paris pour couvrir les
// passages à l'heure d'été (29 mars 2026) et d'hiver (25 octobre 2026).
// (Node applique un changement de `TZ` à chaud ; `process` n'est pas typé côté application.)
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const previousTz = env.TZ;
beforeAll(() => {
  env.TZ = 'Europe/Paris';
});
afterAll(() => {
  env.TZ = previousTz;
});

it('s’exécute bien dans un fuseau à changement d’heure', () => {
  // 29 mars 2026 à Paris : journée de 23 h.
  expect(new Date(2026, 2, 30).getTime() - new Date(2026, 2, 29).getTime()).toBe(23 * 3_600_000);
});

let seq = 0;
const focus = (minutes: number, patch: Partial<SessionRecord> = {}): SessionRecord => ({
  id: `s${(seq += 1)}`,
  mode: 'focus',
  startedAt: seq * 1000,
  endedAt: seq * 1000 + minutes * 60_000,
  durationSeconds: minutes * 60,
  completed: true,
  taskId: null,
  ...patch,
});
const pause = (minutes: number): SessionRecord => ({ ...focus(minutes), mode: 'shortBreak' });
const logsOf = (days: Record<string, SessionRecord[]>): Record<string, DayLog> =>
  Object.fromEntries(Object.entries(days).map(([date, sessions]) => [date, { date, sessions }]));

describe('plages et calendrier', () => {
  it('énumère les jours, y compris lors des changements d’heure', () => {
    expect(dateRange('2026-03-28', '2026-03-30')).toEqual(['2026-03-28', '2026-03-29', '2026-03-30']);
    expect(dateRange('2026-10-24', '2026-10-26')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
    expect(dateRange('2026-02-27', '2026-03-01')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01']);
    expect(dateRange('2026-10-02', '2026-10-01')).toEqual([]);
    expect(dateRange('2000-01-01', '2099-12-31')).toHaveLength(MAX_RANGE_DAYS);
  });

  it('semaine du lundi au dimanche, mois civil', () => {
    expect(startOfWeek('2026-10-22')).toBe('2026-10-19'); // jeudi → lundi
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19'); // dimanche (changement d'heure)
    expect(startOfWeek('2026-10-26')).toBe('2026-10-26');
    expect(startOfWeek('2026-03-01')).toBe('2026-02-23');
    expect(startOfMonth('2026-10-22')).toBe('2026-10-01');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(endOfMonth('2026-12-31')).toBe('2026-12-31');
  });
});

describe('agrégation', () => {
  const logs = logsOf({
    '2026-10-24': [focus(25), pause(5), focus(10, { completed: false })],
    '2026-10-25': [focus(50)],
    '2026-10-27': [focus(25)],
    '2026-11-02': [focus(25)],
  });

  it('totalise chaque jour, jours vides compris', () => {
    const days = dailyTotals(logs, '2026-10-24', '2026-10-27');
    expect(days.map((d) => [d.date, d.focusSeconds / 60, d.cycles, d.breakSeconds / 60])).toEqual([
      ['2026-10-24', 35, 1, 5],
      ['2026-10-25', 50, 1, 0],
      ['2026-10-26', 0, 0, 0],
      ['2026-10-27', 25, 1, 0],
    ]);
  });

  it('regroupe par semaine et par mois', () => {
    const days = dailyTotals(logs, '2026-10-20', '2026-11-03');
    expect(aggregate(days, 'week').map((w) => [w.from, w.to, w.focusSeconds / 60, w.cycles])).toEqual([
      ['2026-10-19', '2026-10-25', 85, 2],
      ['2026-10-26', '2026-11-01', 25, 1],
      ['2026-11-02', '2026-11-08', 25, 1],
    ]);
    expect(aggregate(days, 'month').map((m) => [m.from, m.to, m.focusSeconds / 60])).toEqual([
      ['2026-10-01', '2026-10-31', 110],
      ['2026-11-01', '2026-11-30', 25],
    ]);
    expect(aggregate(days, 'day')).toHaveLength(15);
  });

  it('résume : total, moyenne sur la plage, meilleur jour', () => {
    const summary = summarize(dailyTotals(logs, '2026-10-24', '2026-10-27'));
    expect(summary).toMatchObject({ focusSeconds: 110 * 60, cycles: 3, activeDays: 3, averageFocusSeconds: (110 * 60) / 4 });
    expect(summary.bestDay?.date).toBe('2026-10-25');
    expect(summarize([])).toEqual({ focusSeconds: 0, cycles: 0, activeDays: 0, averageFocusSeconds: 0, bestDay: null });
    expect(summarize(dailyTotals({}, '2026-10-01', '2026-10-07')).bestDay).toBeNull();
  });
});

describe('séries de jours consécutifs', () => {
  it('compte à travers le changement d’heure et tolère une journée pas encore commencée', () => {
    const logs = logsOf({
      '2026-10-23': [focus(25)],
      '2026-10-24': [focus(25)],
      '2026-10-25': [focus(25)], // passage à l'heure d'hiver (journée de 25 h)
      '2026-10-26': [focus(25)],
    });
    expect(streaks(logs, '2026-10-26')).toEqual({ current: 4, longest: 4 });
    // Aujourd'hui sans cycle : la série d'hier tient encore.
    expect(streaks(logs, '2026-10-27')).toEqual({ current: 4, longest: 4 });
    // Un jour manqué la casse.
    expect(streaks(logs, '2026-10-28')).toEqual({ current: 0, longest: 4 });
  });

  it('ignore les jours sans cycle terminé et retient la plus longue série', () => {
    const logs = logsOf({
      '2026-03-27': [focus(25)],
      '2026-03-28': [focus(25)],
      '2026-03-29': [focus(25)], // heure d'été (journée de 23 h)
      '2026-03-30': [focus(25)],
      '2026-04-02': [focus(10, { completed: false }), pause(5)],
      '2026-04-03': [focus(25)],
    });
    expect(streaks(logs, '2026-04-03')).toEqual({ current: 1, longest: 4 });
    expect(streaks({}, '2026-04-03')).toEqual({ current: 0, longest: 0 });
    // Les jours futurs (horloge d'un autre appareil) ne comptent pas.
    expect(streaks(logsOf({ '2026-04-05': [focus(25)] }), '2026-04-03')).toEqual({ current: 0, longest: 0 });
  });
});

describe('projets, carte de chaleur, objectif', () => {
  const projects: Project[] = [{ id: 'p1', name: 'Site Acme', color: '#34d399', client: null, createdAt: 1, archivedAt: null }];
  const task = (id: string, projectId: string | null): Task => ({
    id,
    title: id,
    completed: false,
    createdAt: 1,
    completedAt: null,
    projectId,
    estimate: null,
    plannedFor: null,
  });

  it('répartit le focus par projet, « Sans projet » pour le reste', () => {
    const tasks = [task('t1', 'p1'), task('t2', null), task('t3', 'archivé-supprimé')];
    const shares = focusByProject(
      [focus(25, { taskId: 't1' }), focus(25, { taskId: 't1' }), focus(10, { taskId: 't2' }), focus(5, { taskId: 't3' }), focus(5, { taskId: 'disparue' }), pause(5)],
      tasks,
      projects,
    );
    expect(shares).toEqual([
      { projectId: 'p1', name: 'Site Acme', color: '#34d399', focusSeconds: 3000 },
      { projectId: null, name: 'Sans projet', color: null, focusSeconds: 1200 },
    ]);
    expect(focusByProject([], tasks, projects)).toEqual([]);
  });

  it('carte de chaleur : 53 semaines du lundi au dimanche, niveaux relatifs au meilleur jour', () => {
    const logs = logsOf({ '2026-10-20': [focus(100)], '2026-10-21': [focus(25)], '2026-10-22': [focus(60)], '2025-11-01': [focus(10)] });
    const columns = heatmap(logs, '2026-10-22');
    expect(columns).toHaveLength(53);
    expect(columns.every((column) => column.length === 7)).toBe(true);
    const last = columns[52] ?? [];
    expect(last[0]?.date).toBe('2026-10-19');
    expect(last.map((cell) => cell.level)).toEqual([0, 4, 1, 3, 0, 0, 0]);
    expect(last.slice(4).every((cell) => cell.future)).toBe(true);
    expect(columns[0]?.[0]?.date).toBe('2025-10-20');
    expect(heatmap({}, '2026-10-22').flat().every((cell) => cell.level === 0)).toBe(true);
  });

  it('objectif quotidien plafonné, jamais divisé par zéro', () => {
    expect(goalProgress(3, 8)).toEqual({ done: 3, goal: 8, ratio: 3 / 8, reached: false });
    expect(goalProgress(10, 8)).toMatchObject({ ratio: 1, reached: true });
    expect(goalProgress(0, 0)).toMatchObject({ goal: 1, ratio: 0, reached: false });
  });
});

describe('concordance des totaux (critère d’acceptation L3)', () => {
  const projects: Project[] = [{ id: 'p1', name: 'Site Acme', color: '#34d399', client: null, createdAt: 1, archivedAt: null }];
  const tasks: Task[] = [
    { id: 't1', title: 'Maquette', completed: true, createdAt: 1, completedAt: new Date(2026, 9, 21, 11).getTime(), projectId: 'p1', estimate: 2, plannedFor: null },
  ];
  const logs = logsOf({
    '2026-10-15': [focus(25, { taskId: 't1' })],
    '2026-10-20': [focus(25, { taskId: 't1' }), pause(5), focus(15, { completed: false })],
    '2026-10-21': [focus(50, { taskId: 't1' }), focus(25)],
    '2026-10-22': [focus(25)],
  });
  const today = '2026-10-22';
  const now = new Date(2026, 9, 22, 18).getTime();

  it('/stats, /rapports et le rapport du jour donnent les mêmes chiffres', () => {
    const stats = buildStats(logs, tasks, projects, today, 7);
    const week = buildReport({ from: '2026-10-16', to: today }, { projectId: 'all' }, { logs, tasks, projects }, now);
    expect(week.focusSeconds).toBe(stats.summary.focusSeconds);
    expect(week.completedCycles).toBe(stats.summary.cycles);
    const statsByProject = Object.fromEntries(stats.projects.map((share) => [share.name, share.focusSeconds]));
    expect(Object.fromEntries(week.projectGroups.map((group) => [group.name, group.focusSeconds]))).toEqual(statsByProject);

    for (const day of stats.range) {
      const daily = buildDailyReport(logs[day.date] ?? { date: day.date, sessions: [] }, tasks, now, projects);
      const period = buildReport({ from: day.date, to: day.date }, { projectId: 'all' }, { logs, tasks, projects }, now);
      expect([daily.focusSeconds, daily.completedCycles]).toEqual([day.focusSeconds, day.cycles]);
      expect([period.focusSeconds, period.completedCycles]).toEqual([day.focusSeconds, day.cycles]);
    }
    expect(stats.today).toMatchObject({ date: today, focusSeconds: 25 * 60, cycles: 1 });
    // Le filtre projet isole exactement la part du projet.
    const acme = buildReport({ from: '2026-10-16', to: today }, { projectId: 'p1' }, { logs, tasks, projects }, now);
    expect(acme.focusSeconds).toBe(statsByProject['Site Acme']);
  });
});

describe('graduations', () => {
  it('choisit un pas rond couvrant le maximum', () => {
    expect(durationTicks(0)).toEqual([0, 900, 1800]);
    expect(durationTicks(1800)).toEqual([0, 900, 1800]);
    expect(durationTicks(1801)).toEqual([0, 1800, 3600]);
    expect(durationTicks(5 * 3600)).toEqual([0, 3 * 3600, 6 * 3600]);
    expect(durationTicks(30 * 3600)).toEqual([0, 15 * 3600, 30 * 3600]);
  });
});
