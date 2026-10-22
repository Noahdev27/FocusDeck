import { describe, expect, it } from 'vitest';
import type { DayLog, Task } from '../types';
import {
  applyReorder,
  countPomodoros,
  matchesFilters,
  pomodoroProgress,
  postponeTask,
  removeTasks,
  restoreTasks,
  taskSchedule,
} from './tasks';

const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id,
  title: id,
  completed: false,
  createdAt: 1,
  completedAt: null,
  projectId: null,
  estimate: null,
  plannedFor: null,
  ...patch,
});

describe('taskSchedule (EF-O05)', () => {
  const today = '2026-10-21';
  it('classe les tâches selon leur jour prévu', () => {
    expect(taskSchedule(task('a'), today, true)).toBe('today');
    expect(taskSchedule(task('a', { plannedFor: today }), today, false)).toBe('today');
    expect(taskSchedule(task('a', { plannedFor: '2026-10-22' }), today, true)).toBe('later');
  });

  it('une tâche prévue un jour passé revient seule, ou reste « en retard » sans report automatique', () => {
    const late = task('a', { plannedFor: '2026-10-20' });
    expect(taskSchedule(late, today, true)).toBe('today');
    expect(taskSchedule(late, today, false)).toBe('overdue');
    expect(taskSchedule({ ...late, completed: true }, today, false)).toBe('today');
  });

  it('reporte au lendemain, y compris en fin de mois', () => {
    expect(postponeTask(task('a'), '2026-10-31').plannedFor).toBe('2026-11-01');
  });
});

describe('suppression et annulation (EF-O06)', () => {
  it('restaure chaque tâche à sa position d’origine', () => {
    const tasks = [task('a'), task('b'), task('c'), task('d')];
    const { tasks: kept, removed } = removeTasks(tasks, new Set(['b', 'd']));
    expect(kept.map((t) => t.id)).toEqual(['a', 'c']);
    expect(removed.map((r) => r.index)).toEqual([1, 3]);
    expect(restoreTasks(kept, removed).map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('n’ajoute pas de doublon et tolère une liste modifiée entre-temps', () => {
    const { removed } = removeTasks([task('a'), task('b')], new Set(['b']));
    expect(restoreTasks([task('b')], removed).map((t) => t.id)).toEqual(['b']);
    expect(restoreTasks([], removed).map((t) => t.id)).toEqual(['b']);
  });
});

describe('applyReorder', () => {
  it('réordonne une vue filtrée sans déplacer les tâches masquées', () => {
    const tasks = [task('a'), task('x'), task('b'), task('y'), task('c')];
    const reordered = [task('c'), task('a'), task('b')];
    expect(applyReorder(tasks, reordered).map((t) => t.id)).toEqual(['c', 'x', 'a', 'y', 'b']);
  });

  it('ignore un ordre incohérent (tâche inconnue ou doublon)', () => {
    const tasks = [task('a'), task('b')];
    expect(applyReorder(tasks, [task('b'), task('z')]).map((t) => t.id)).toEqual(['a', 'b']);
    expect(applyReorder(tasks, [task('a'), task('a')]).map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('pomodoros par tâche (EF-O02)', () => {
  const session = (id: string, patch: object) => ({ id, mode: 'focus' as const, startedAt: 1, endedAt: 2, durationSeconds: 1500, completed: true, taskId: null, ...patch });
  const logs: Record<string, DayLog> = {
    '2026-10-20': { date: '2026-10-20', sessions: [session('1', { taskId: 't1' })] },
    '2026-10-21': {
      date: '2026-10-21',
      sessions: [
        session('2', { taskId: 't1' }),
        session('3', { taskId: 't1', completed: false }),
        session('4', { taskId: 't2' }),
        session('5', { mode: 'shortBreak' }),
        session('6', {}),
      ],
    },
  };

  it('compte les cycles Focus terminés, tous jours confondus', () => {
    expect(countPomodoros(logs)).toEqual({ t1: 2, t2: 1 });
  });

  it('décrit la progression et le dépassement d’estimation', () => {
    expect(pomodoroProgress(0, null)).toBeNull();
    expect(pomodoroProgress(2, null)).toMatchObject({ short: '2', over: false, label: '2 pomodoros réalisés' });
    expect(pomodoroProgress(1, 4)).toMatchObject({ short: '1/4', over: false, label: '1 pomodoro réalisé sur 4 estimés' });
    expect(pomodoroProgress(3, 2)).toMatchObject({ short: '3/2', over: true, label: '3 pomodoros réalisés sur 2 estimés, estimation dépassée' });
  });
});

describe('matchesFilters', () => {
  it('combine statut et projet', () => {
    const inProject = task('a', { projectId: 'p1' });
    const done = task('b', { completed: true });
    expect(matchesFilters(inProject, 'all', 'p1')).toBe(true);
    expect(matchesFilters(inProject, 'all', 'none')).toBe(false);
    expect(matchesFilters(done, 'all', 'none')).toBe(true);
    expect(matchesFilters(done, 'active', 'all')).toBe(false);
    expect(matchesFilters(inProject, 'done', 'all')).toBe(false);
    expect(matchesFilters(inProject, 'all', 'p2')).toBe(false);
  });
});
