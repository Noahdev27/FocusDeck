export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

export type TimerStatus = 'idle' | 'running' | 'paused';

export interface TimerSettings {
  /** Durées en minutes. */
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** Nombre de cycles Focus avant une pause longue. */
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  soundEnabled: boolean;
  /** Volume entre 0 et 1. */
  volume: number;
  notificationsEnabled: boolean;
  /** Mesure d'audience anonyme, sans cookie (RGPD-3). */
  analyticsEnabled: boolean;
}

/** État sérialisable du minuteur (persisté pour survivre à un rechargement). */
export interface TimerSnapshot {
  mode: TimerMode;
  status: TimerStatus;
  /** Temps restant lorsque le minuteur n'est pas en cours. */
  remainingMs: number;
  /** Timestamp de fin lorsque le minuteur tourne. */
  endsAt: number | null;
  /** Durée totale de la phase courante. */
  durationMs: number;
  /** Premier démarrage de la phase courante (pour l'historique). */
  startedAt: number | null;
  /** Cycles Focus terminés depuis la dernière pause longue. */
  cyclesInSet: number;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
}

export interface SessionRecord {
  id: string;
  mode: TimerMode;
  startedAt: number;
  endedAt: number;
  /** Temps réellement écoulé, en secondes. */
  durationSeconds: number;
  /** `false` si la phase a été passée ou réinitialisée avant la fin. */
  completed: boolean;
}

/** Journal d'activité d'une journée (clé `YYYY-MM-DD`, heure locale). */
export interface DayLog {
  date: string;
  sessions: SessionRecord[];
}

export interface DailyReport {
  date: string;
  generatedAt: number;
  completedCycles: number;
  focusSeconds: number;
  breakSeconds: number;
  interruptedSessions: number;
  completedTasks: Task[];
  pendingTasks: Task[];
  /** Ratio tâches terminées / tâches totales, entre 0 et 1. */
  completionRate: number;
}

export type ReportFormat = 'markdown' | 'pdf';
