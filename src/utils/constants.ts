import type { TimerMode, TimerSettings } from '../types';

/** Format v2 (lot L4) : projets, tâche active, estimations. Migration : `data/migrations.ts`. */
export const STORAGE_PREFIX = 'focusdeck:v2';
export const LEGACY_STORAGE_PREFIX = 'focusdeck:v1';

export const STORAGE_KEYS = {
  settings: `${STORAGE_PREFIX}:settings`,
  tasks: `${STORAGE_PREFIX}:tasks`,
  projects: `${STORAGE_PREFIX}:projects`,
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
  autoPostpone: true,
  dailyGoal: 8,
};

/** Bornes de validation des réglages (inclusives). */
export const SETTINGS_LIMITS = {
  focusMinutes: { min: 1, max: 180 },
  shortBreakMinutes: { min: 1, max: 60 },
  longBreakMinutes: { min: 1, max: 90 },
  longBreakInterval: { min: 2, max: 12 },
  volume: { min: 0, max: 1 },
  dailyGoal: { min: 1, max: 24 },
} as const;

export const TASK_TITLE_MAX_LENGTH = 140;
export const MAX_TASKS = 200;
/** Estimation d'une tâche en pomodoros (EF-O02). */
export const ESTIMATE_LIMITS = { min: 1, max: 8 } as const;

export const PROJECT_NAME_MAX_LENGTH = 60;
export const PROJECT_CLIENT_MAX_LENGTH = 80;
export const MAX_PROJECTS = 100;

/**
 * Palette des projets : teintes 300/400 de Tailwind, toutes au-dessus de 7:1 de contraste
 * sur le fond sombre, distinguées aussi par leur nom (jamais par la seule couleur).
 */
export const PROJECT_COLORS = [
  { value: '#fb7185', label: 'Rose' },
  { value: '#fb923c', label: 'Orange' },
  { value: '#fbbf24', label: 'Ambre' },
  { value: '#a3e635', label: 'Citron vert' },
  { value: '#34d399', label: 'Émeraude' },
  { value: '#22d3ee', label: 'Cyan' },
  { value: '#60a5fa', label: 'Bleu' },
  { value: '#a78bfa', label: 'Violet' },
  { value: '#f0abfc', label: 'Fuchsia' },
  { value: '#d4d4d8', label: 'Gris' },
] as const;

export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[7].value;
/** Nombre de jours d'historique conservés dans le stockage local (lot L3 : 30 → 365). */
export const LOG_RETENTION_DAYS = 365;
/**
 * Plafond de taille du journal local (caractères JSON, ≈ octets) : au-delà, les jours les plus
 * anciens sont purgés pour laisser de la place au reste du stockage (quota ≈ 5 Mo).
 */
export const LOG_MAX_SIZE = 2_000_000;

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
