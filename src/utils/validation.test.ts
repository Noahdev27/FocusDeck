import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_SETTINGS,
  MAX_PROJECTS,
  MAX_TASKS,
  PROJECT_CLIENT_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
} from './constants';
import {
  normalizeTaskTitle,
  sanitizeEstimate,
  sanitizeLogs,
  sanitizeProjects,
  sanitizeSettings,
  sanitizeTasks,
  sanitizeTimerSnapshot,
} from './validation';

describe('sanitizeSettings', () => {
  it('retourne les valeurs par défaut pour une donnée invalide', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('corrompu')).toEqual(DEFAULT_SETTINGS);
  });

  it('borne et arrondit les valeurs numériques', () => {
    const result = sanitizeSettings({ focusMinutes: 9999, shortBreakMinutes: -3, longBreakInterval: 3.6, volume: 4 });
    expect(result.focusMinutes).toBe(180);
    expect(result.shortBreakMinutes).toBe(1);
    expect(result.longBreakInterval).toBe(4);
    expect(result.volume).toBe(1);
  });

  it('ignore les types inattendus', () => {
    expect(sanitizeSettings({ soundEnabled: 'yes', focusMinutes: '50' })).toMatchObject({
      soundEnabled: DEFAULT_SETTINGS.soundEnabled,
      focusMinutes: DEFAULT_SETTINGS.focusMinutes,
    });
  });
});

describe('sanitizeTasks', () => {
  it('filtre les entrées invalides et les doublons', () => {
    const tasks = sanitizeTasks([
      { id: 'a', title: '  Écrire   le brief ', completed: false, createdAt: 1, completedAt: null, projectId: null, estimate: null, plannedFor: null },
      { id: 'a', title: 'Doublon', completed: false, createdAt: 2, completedAt: null, projectId: null, estimate: null, plannedFor: null },
      { id: 'b', title: '   ', completed: false, createdAt: 3 },
      { title: 'Sans id', createdAt: 4 },
      { id: 'c', title: 'Fait', completed: true, createdAt: 5, completedAt: 'hier', projectId: null, estimate: null, plannedFor: null },
      42,
    ]);
    expect(tasks).toEqual([
      { id: 'a', title: 'Écrire le brief', completed: false, createdAt: 1, completedAt: null, projectId: null, estimate: null, plannedFor: null },
      { id: 'c', title: 'Fait', completed: true, createdAt: 5, completedAt: null, projectId: null, estimate: null, plannedFor: null },
    ]);
  });

  it('limite le nombre de tâches et la longueur des titres', () => {
    const many = Array.from({ length: MAX_TASKS + 20 }, (_, i) => ({ id: `t${i}`, title: 'x', createdAt: i }));
    expect(sanitizeTasks(many)).toHaveLength(MAX_TASKS);
    expect(normalizeTaskTitle('a'.repeat(500))).toHaveLength(TASK_TITLE_MAX_LENGTH);
  });
});

describe('sanitizeLogs', () => {
  it('conserve uniquement les jours et sessions valides', () => {
    const logs = sanitizeLogs({
      '2026-10-16': {
        sessions: [
          { id: 's1', mode: 'focus', startedAt: 1, endedAt: 2, durationSeconds: 1500, completed: true, taskId: null },
          { id: 's2', mode: 'nap', startedAt: 1, endedAt: 2, durationSeconds: 10 },
          { id: 's3', mode: 'focus', startedAt: 1, endedAt: 2, durationSeconds: -5 },
        ],
      },
      'pas-une-date': { sessions: [] },
    });
    expect(Object.keys(logs)).toEqual(['2026-10-16']);
    expect(logs['2026-10-16']?.sessions.map((s) => s.id)).toEqual(['s1']);
  });
});

describe('sanitizeTimerSnapshot', () => {
  it('rejette un état incohérent', () => {
    expect(sanitizeTimerSnapshot({ mode: 'focus', status: 'running', durationMs: 1000, remainingMs: 10, cyclesInSet: 0 })).toBeNull();
    expect(sanitizeTimerSnapshot({ mode: 'sleep', status: 'idle', durationMs: 1000, remainingMs: 10, cyclesInSet: 0 })).toBeNull();
  });

  it('borne le temps restant', () => {
    const snapshot = sanitizeTimerSnapshot({
      mode: 'focus',
      status: 'paused',
      durationMs: 1000,
      remainingMs: 5000,
      endsAt: 123,
      startedAt: 50,
      cyclesInSet: 2,
    });
    expect(snapshot).toEqual({
      mode: 'focus',
      status: 'paused',
      durationMs: 1000,
      remainingMs: 1000,
      endsAt: null,
      startedAt: 50,
      cyclesInSet: 2,
      taskId: null,
    });
  });

  it('conserve la tâche active (v2)', () => {
    const base = { mode: 'focus', status: 'idle', durationMs: 1000, remainingMs: 1000, cyclesInSet: 0 };
    expect(sanitizeTimerSnapshot({ ...base, taskId: 't1' })?.taskId).toBe('t1');
    expect(sanitizeTimerSnapshot({ ...base, taskId: 42 })?.taskId).toBeNull();
    expect(sanitizeTimerSnapshot({ ...base, taskId: '' })?.taskId).toBeNull();
  });
});

describe('champs v2 des tâches et sessions', () => {
  it('valide projet, estimation et jour prévu', () => {
    const [task] = sanitizeTasks([
      { id: 't', title: 'T', createdAt: 1, projectId: 'p1', estimate: 3.4, plannedFor: '2026-10-21' },
    ]);
    expect(task).toMatchObject({ projectId: 'p1', estimate: 3, plannedFor: '2026-10-21' });
    const [invalid] = sanitizeTasks([{ id: 't', title: 'T', createdAt: 1, projectId: 7, estimate: 9, plannedFor: 'demain' }]);
    expect(invalid).toMatchObject({ projectId: null, estimate: null, plannedFor: null });
    expect(sanitizeEstimate(0)).toBeNull();
    expect(sanitizeEstimate('2')).toBeNull();
    expect(sanitizeEstimate(8)).toBe(8);
  });

  it('ne garde la tâche d’une session que pour un cycle Focus', () => {
    const logs = sanitizeLogs({
      '2026-10-16': {
        sessions: [
          { id: 'f', mode: 'focus', startedAt: 1, endedAt: 2, durationSeconds: 60, completed: true, taskId: 't1' },
          { id: 'p', mode: 'shortBreak', startedAt: 2, endedAt: 3, durationSeconds: 60, completed: true, taskId: 't1' },
        ],
      },
    });
    expect(logs['2026-10-16']?.sessions.map((s) => s.taskId)).toEqual(['t1', null]);
  });
});

describe('sanitizeProjects', () => {
  it('valide, dédoublonne et trie par date de création', () => {
    const projects = sanitizeProjects([
      { id: 'b', name: '  Site   Acme ', color: '#34D399', client: '  ', createdAt: 2, archivedAt: null },
      { id: 'a', name: 'Blog', color: 'red', client: 'Moi', createdAt: 1, archivedAt: 10 },
      { id: 'a', name: 'Doublon', color: '#34d399', createdAt: 3 },
      { id: 'c', name: '   ', color: '#34d399', createdAt: 4 },
      { name: 'Sans id', createdAt: 5 },
      'corrompu',
    ]);
    expect(projects).toEqual([
      { id: 'a', name: 'Blog', color: DEFAULT_PROJECT_COLOR, client: 'Moi', createdAt: 1, archivedAt: 10 },
      { id: 'b', name: 'Site Acme', color: '#34d399', client: null, createdAt: 2, archivedAt: null },
    ]);
    expect(sanitizeProjects('pas une liste')).toEqual([]);
  });

  it('borne le nombre de projets et la longueur des textes', () => {
    const many = Array.from({ length: MAX_PROJECTS + 5 }, (_, i) => ({ id: `p${i}`, name: 'x'.repeat(100), client: 'y'.repeat(200), createdAt: i }));
    const projects = sanitizeProjects(many);
    expect(projects).toHaveLength(MAX_PROJECTS);
    expect(projects[0]?.name).toHaveLength(PROJECT_NAME_MAX_LENGTH);
    expect(projects[0]?.client).toHaveLength(PROJECT_CLIENT_MAX_LENGTH);
  });
});
