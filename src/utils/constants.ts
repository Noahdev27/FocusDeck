import type { TimerMode, TimerSettings } from '../types';

export const STORAGE_PREFIX = 'focusdeck:v1';

export const STORAGE_KEYS = {
  settings: `${STORAGE_PREFIX}:settings`,
  tasks: `${STORAGE_PREFIX}:tasks`,
  logs: `${STORAGE_PREFIX}:logs`,
  timer: `${STORAGE_PREFIX}:timer`,
} as const;

export const DEFAULT_SETTINGS: TimerSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundEnabled: true,
  volume: 0.6,
  notificationsEnabled: false,
  analyticsEnabled: true,
};

/** Bornes de validation des réglages (inclusives). */
export const SETTINGS_LIMITS = {
  focusMinutes: { min: 1, max: 180 },
  shortBreakMinutes: { min: 1, max: 60 },
  longBreakMinutes: { min: 1, max: 90 },
  longBreakInterval: { min: 2, max: 12 },
  volume: { min: 0, max: 1 },
} as const;

export const TASK_TITLE_MAX_LENGTH = 140;
export const MAX_TASKS = 200;
/** Nombre de jours d'historique conservés dans le stockage local. */
export const LOG_RETENTION_DAYS = 30;

export interface ModeMeta {
  label: string;
  shortLabel: string;
  /** Couleurs utilisées par l'anneau et les accents (valeurs CSS). */
  from: string;
  to: string;
  glow: string;
}

export const MODE_META: Record<TimerMode, ModeMeta> = {
  focus: {
    label: 'Focus',
    shortLabel: 'Focus',
    from: '#fb7185',
    to: '#a855f7',
    glow: 'rgba(244, 63, 94, 0.35)',
  },
  shortBreak: {
    label: 'Pause courte',
    shortLabel: 'Courte',
    from: '#34d399',
    to: '#22d3ee',
    glow: 'rgba(16, 185, 129, 0.32)',
  },
  longBreak: {
    label: 'Pause longue',
    shortLabel: 'Longue',
    from: '#60a5fa',
    to: '#818cf8',
    glow: 'rgba(59, 130, 246, 0.32)',
  },
};

export const TIMER_MODES: readonly TimerMode[] = ['focus', 'shortBreak', 'longBreak'];
