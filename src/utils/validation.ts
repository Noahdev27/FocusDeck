import type { DayLog, SessionRecord, Task, TimerMode, TimerSettings, TimerSnapshot } from '../types';
import {
  DEFAULT_SETTINGS,
  MAX_TASKS,
  SETTINGS_LIMITS,
  TASK_TITLE_MAX_LENGTH,
  TIMER_MODES,
} from './constants';

/**
 * Le stockage local est une source non fiable (modifiable via DevTools,
 * corrompu par une ancienne version, etc.). Chaque lecture passe donc par
 * un « sanitizer » qui valide la forme et borne les valeurs, plutôt que
 * de faire confiance à un simple `JSON.parse` typé.
 */

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const isTimerMode = (value: unknown): value is TimerMode =>
  typeof value === 'string' && (TIMER_MODES as readonly string[]).includes(value);

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readBoundedNumber(
  source: UnknownRecord,
  key: keyof typeof SETTINGS_LIMITS,
  fallback: number,
  integer = true,
): number {
  const raw = source[key];
  if (!isFiniteNumber(raw)) return fallback;
  const { min, max } = SETTINGS_LIMITS[key];
  return clamp(integer ? Math.round(raw) : raw, min, max);
}

function readBoolean(source: UnknownRecord, key: string, fallback: boolean): boolean {
  const raw = source[key];
  return typeof raw === 'boolean' ? raw : fallback;
}

export function sanitizeSettings(input: unknown): TimerSettings {
  if (!isRecord(input)) return { ...DEFAULT_SETTINGS };
  const d = DEFAULT_SETTINGS;
  return {
    focusMinutes: readBoundedNumber(input, 'focusMinutes', d.focusMinutes),
    shortBreakMinutes: readBoundedNumber(input, 'shortBreakMinutes', d.shortBreakMinutes),
    longBreakMinutes: readBoundedNumber(input, 'longBreakMinutes', d.longBreakMinutes),
    longBreakInterval: readBoundedNumber(input, 'longBreakInterval', d.longBreakInterval),
    volume: readBoundedNumber(input, 'volume', d.volume, false),
    autoStartBreaks: readBoolean(input, 'autoStartBreaks', d.autoStartBreaks),
    autoStartFocus: readBoolean(input, 'autoStartFocus', d.autoStartFocus),
    soundEnabled: readBoolean(input, 'soundEnabled', d.soundEnabled),
    notificationsEnabled: readBoolean(input, 'notificationsEnabled', d.notificationsEnabled),
  };
}

/** Nettoie un titre saisi par l'utilisateur : espaces normalisés, longueur bornée. */
export function normalizeTaskTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().slice(0, TASK_TITLE_MAX_LENGTH);
}

function sanitizeTask(input: unknown): Task | null {
  if (!isRecord(input)) return null;
  const { id, title, completed, createdAt, completedAt } = input;
  if (typeof id !== 'string' || id.length === 0 || typeof title !== 'string') return null;
  const cleanTitle = normalizeTaskTitle(title);
  if (cleanTitle.length === 0 || !isFiniteNumber(createdAt)) return null;
  const isDone = completed === true;
  return {
    id,
    title: cleanTitle,
    completed: isDone,
    createdAt,
    completedAt: isDone && isFiniteNumber(completedAt) ? completedAt : null,
  };
}

export function sanitizeTasks(input: unknown): Task[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const tasks: Task[] = [];
  for (const item of input) {
    const task = sanitizeTask(item);
    if (task && !seen.has(task.id)) {
      seen.add(task.id);
      tasks.push(task);
    }
    if (tasks.length >= MAX_TASKS) break;
  }
  return tasks;
}

function sanitizeSession(input: unknown): SessionRecord | null {
  if (!isRecord(input)) return null;
  const { id, mode, startedAt, endedAt, durationSeconds, completed } = input;
  if (
    typeof id !== 'string' ||
    !isTimerMode(mode) ||
    !isFiniteNumber(startedAt) ||
    !isFiniteNumber(endedAt) ||
    !isFiniteNumber(durationSeconds) ||
    durationSeconds < 0
  ) {
    return null;
  }
  return { id, mode, startedAt, endedAt, durationSeconds: Math.round(durationSeconds), completed: completed === true };
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeLogs(input: unknown): Record<string, DayLog> {
  if (!isRecord(input)) return {};
  const logs: Record<string, DayLog> = {};
  for (const [date, value] of Object.entries(input)) {
    if (!DATE_KEY_PATTERN.test(date) || !isRecord(value) || !Array.isArray(value.sessions)) continue;
    const sessions = value.sessions
      .map(sanitizeSession)
      .filter((session): session is SessionRecord => session !== null);
    logs[date] = { date, sessions };
  }
  return logs;
}

export function sanitizeTimerSnapshot(input: unknown): TimerSnapshot | null {
  if (!isRecord(input)) return null;
  const { mode, status, remainingMs, endsAt, durationMs, startedAt, cyclesInSet } = input;
  if (!isTimerMode(mode) || !isFiniteNumber(durationMs) || durationMs <= 0) return null;
  if (status !== 'idle' && status !== 'running' && status !== 'paused') return null;
  if (!isFiniteNumber(remainingMs) || !isFiniteNumber(cyclesInSet)) return null;
  if (status === 'running' && !isFiniteNumber(endsAt)) return null;
  return {
    mode,
    status,
    durationMs,
    remainingMs: clamp(remainingMs, 0, durationMs),
    endsAt: status === 'running' && isFiniteNumber(endsAt) ? endsAt : null,
    startedAt: status !== 'idle' && isFiniteNumber(startedAt) ? startedAt : null,
    cyclesInSet: Math.max(0, Math.round(cyclesInSet)),
  };
}
