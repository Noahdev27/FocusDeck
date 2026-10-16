import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, MAX_TASKS, TASK_TITLE_MAX_LENGTH } from './constants';
import { normalizeTaskTitle, sanitizeLogs, sanitizeSettings, sanitizeTasks, sanitizeTimerSnapshot } from './validation';

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
      { id: 'a', title: '  Écrire   le brief ', completed: false, createdAt: 1, completedAt: null },
      { id: 'a', title: 'Doublon', completed: false, createdAt: 2, completedAt: null },
      { id: 'b', title: '   ', completed: false, createdAt: 3 },
      { title: 'Sans id', createdAt: 4 },
      { id: 'c', title: 'Fait', completed: true, createdAt: 5, completedAt: 'hier' },
      42,
    ]);
    expect(tasks).toEqual([
      { id: 'a', title: 'Écrire le brief', completed: false, createdAt: 1, completedAt: null },
      { id: 'c', title: 'Fait', completed: true, createdAt: 5, completedAt: null },
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
          { id: 's1', mode: 'focus', startedAt: 1, endedAt: 2, durationSeconds: 1500, completed: true },
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
    });
  });
});
