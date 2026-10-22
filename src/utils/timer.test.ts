import { describe, expect, it } from 'vitest';
import type { TimerSettings } from '../types';
import { DEFAULT_SETTINGS } from './constants';
import {
  assignTask,
  completePhase,
  createIdleSnapshot,
  focusOnTask,
  getNextMode,
  getRemainingMs,
  MIN_RECORDED_PARTIAL_MS,
  sessionIdFor,
  pauseTimer,
  skipPhase,
  startTimer,
  switchMode,
} from './timer';

const settings: TimerSettings = { ...DEFAULT_SETTINGS, focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 };
const T0 = 1_700_000_000_000;

describe('getNextMode', () => {
  it('alterne focus et pause courte, avec une pause longue tous les N cycles', () => {
    expect(getNextMode('focus', 1, 4)).toBe('shortBreak');
    expect(getNextMode('focus', 3, 4)).toBe('shortBreak');
    expect(getNextMode('focus', 4, 4)).toBe('longBreak');
    expect(getNextMode('shortBreak', 2, 4)).toBe('focus');
    expect(getNextMode('longBreak', 0, 4)).toBe('focus');
  });
});

describe('start / pause', () => {
  it('calcule le temps restant à partir de endsAt et le conserve en pause', () => {
    const running = startTimer(createIdleSnapshot('focus', settings), T0);
    expect(running.status).toBe('running');
    expect(running.startedAt).toBe(T0);
    expect(getRemainingMs(running, T0 + 60_000)).toBe(24 * 60_000);

    const paused = pauseTimer(running, T0 + 60_000);
    expect(paused.status).toBe('paused');
    expect(paused.remainingMs).toBe(24 * 60_000);
    // Le temps ne s'écoule plus en pause.
    expect(getRemainingMs(paused, T0 + 10 * 60_000)).toBe(24 * 60_000);

    const resumed = startTimer(paused, T0 + 120_000);
    expect(resumed.endsAt).toBe(T0 + 120_000 + 24 * 60_000);
    // Le début de phase d'origine est conservé.
    expect(resumed.startedAt).toBe(T0);
  });

  it('ne descend jamais sous zéro', () => {
    const running = startTimer(createIdleSnapshot('shortBreak', settings), T0);
    expect(getRemainingMs(running, T0 + 999 * 60_000)).toBe(0);
  });
});

describe('completePhase', () => {
  it('comptabilise un cycle focus et enchaîne sur une pause courte', () => {
    const running = startTimer(createIdleSnapshot('focus', settings), T0);
    const { next, record } = completePhase(running, settings, T0 + 25 * 60_000);
    expect(record).toMatchObject({ mode: 'focus', completed: true, durationSeconds: 25 * 60, startedAt: T0 });
    expect(next.mode).toBe('shortBreak');
    expect(next.cyclesInSet).toBe(1);
    expect(next.status).toBe('idle');
  });

  it('déclenche une pause longue au 4e cycle puis remet le compteur à zéro', () => {
    const fourth = startTimer(createIdleSnapshot('focus', settings, 3), T0);
    const afterFocus = completePhase(fourth, settings, T0 + 25 * 60_000).next;
    expect(afterFocus.mode).toBe('longBreak');
    expect(afterFocus.cyclesInSet).toBe(4);

    const afterLong = completePhase(startTimer(afterFocus, T0), settings, T0 + 15 * 60_000).next;
    expect(afterLong.mode).toBe('focus');
    expect(afterLong.cyclesInSet).toBe(0);
  });

  it('démarre automatiquement la phase suivante si demandé', () => {
    const auto = { ...settings, autoStartBreaks: true };
    const running = startTimer(createIdleSnapshot('focus', auto), T0);
    const end = T0 + 25 * 60_000;
    const { next } = completePhase(running, auto, end + 200);
    expect(next.status).toBe('running');
    // Enchaînement précis depuis la fin réelle de la phase.
    expect(next.endsAt).toBe(end + 5 * 60_000);
  });

  it("repart de maintenant si la fin date d'il y a longtemps (onglet rouvert)", () => {
    const auto = { ...settings, autoStartBreaks: true };
    const running = startTimer(createIdleSnapshot('focus', auto), T0);
    const later = T0 + 3 * 3_600_000;
    const { next, record } = completePhase(running, auto, later);
    expect(next.endsAt).toBe(later + 5 * 60_000);
    expect(record?.endedAt).toBe(T0 + 25 * 60_000);
  });
});

describe('skipPhase / switchMode', () => {
  it("n'incrémente pas les cycles et historise la session interrompue", () => {
    const running = startTimer(createIdleSnapshot('focus', settings, 2), T0);
    const { next, record } = skipPhase(running, settings, T0 + 10 * 60_000);
    expect(next.mode).toBe('shortBreak');
    expect(next.cyclesInSet).toBe(2);
    expect(record).toMatchObject({ mode: 'focus', completed: false, durationSeconds: 600 });
  });

  it('ignore les interruptions trop courtes', () => {
    const running = startTimer(createIdleSnapshot('focus', settings), T0);
    expect(switchMode(running, 'focus', settings, T0 + MIN_RECORDED_PARTIAL_MS - 1).record).toBeNull();
    expect(switchMode(createIdleSnapshot('focus', settings), 'longBreak', settings, T0).record).toBeNull();
  });

  it('passer une pause longue réinitialise la série', () => {
    const { next } = skipPhase(createIdleSnapshot('longBreak', settings, 4), settings, T0);
    expect(next).toMatchObject({ mode: 'focus', cyclesInSet: 0 });
  });
});

describe('sessionIdFor', () => {
  it('est déterministe pour une même phase', () => {
    expect(sessionIdFor('focus', 1792160000000)).toBe('focus:1792160000000');
    expect(sessionIdFor('focus', 1)).not.toBe(sessionIdFor('shortBreak', 1));
  });
});

describe('tâche active (EF-T03)', () => {
  it('la session Focus porte la tâche ; la tâche est conservée d’une phase à l’autre', () => {
    const { next: started, record: none } = focusOnTask(createIdleSnapshot('focus', settings), 't1', settings, T0);
    expect(none).toBeNull();
    expect(started).toMatchObject({ mode: 'focus', status: 'running', taskId: 't1' });

    const { next: pause, record } = completePhase(started, settings, T0 + 25 * 60_000);
    expect(record).toMatchObject({ mode: 'focus', completed: true, taskId: 't1' });
    expect(pause).toMatchObject({ mode: 'shortBreak', taskId: 't1' });

    // Une pause n'est jamais attribuée à une tâche.
    const { record: breakRecord } = completePhase(startTimer(pause, T0), settings, T0 + 5 * 60_000);
    expect(breakRecord).toMatchObject({ mode: 'shortBreak', taskId: null });
  });

  it('depuis une pause : historise la pause interrompue puis démarre un Focus sur la tâche', () => {
    const inBreak = startTimer(createIdleSnapshot('shortBreak', settings), T0);
    const { next, record } = focusOnTask(inBreak, 't2', settings, T0 + 60_000);
    expect(record).toMatchObject({ mode: 'shortBreak', completed: false, taskId: null });
    expect(next).toMatchObject({ mode: 'focus', status: 'running', taskId: 't2', endsAt: T0 + 60_000 + 25 * 60_000 });
  });

  it('un Focus déjà en cours continue, attribué à la nouvelle tâche', () => {
    const running = startTimer(createIdleSnapshot('focus', settings, 0, 't1'), T0);
    const { next } = focusOnTask(running, 't2', settings, T0 + 60_000);
    expect(next).toMatchObject({ status: 'running', endsAt: running.endsAt, taskId: 't2' });
  });

  it('assignTask détache la tâche sans toucher au décompte', () => {
    const running = startTimer(createIdleSnapshot('focus', settings, 0, 't1'), T0);
    expect(assignTask(running, null)).toEqual({ ...running, taskId: null });
    expect(assignTask(running, 't1')).toBe(running);
    expect(skipPhase(running, settings, T0 + 60_000).next.taskId).toBe('t1');
    expect(switchMode(running, 'longBreak', settings, T0).next.taskId).toBe('t1');
  });
});
