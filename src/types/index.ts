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
  /**
   * Un objectif prévu un jour passé et non terminé revient silencieusement dans la liste
   * du jour (EF-O05). Désactivé : il reste marqué « en retard ».
   */
  autoPostpone: boolean;
  /** Objectif quotidien de cycles Focus (EF-T07). */
  dailyGoal: number;
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
  /** Tâche active associée aux cycles Focus (EF-T03), conservée d'une phase à l'autre. */
  taskId: string | null;
}

export interface Project {
  id: string;
  name: string;
  /** Couleur de la palette accessible (`PROJECT_COLORS`). */
  color: string;
  client: string | null;
  createdAt: number;
  /** Projet archivé : masqué des sélecteurs, conservé pour l'historique. */
  archivedAt: number | null;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
  /** Projet (EF-O03) : une tâche appartient à 0 ou 1 projet. */
  projectId: string | null;
  /** Estimation en pomodoros, de 1 à 8 (EF-O02). */
  estimate: number | null;
  /** Jour prévu (`YYYY-MM-DD`) ; `null` = aujourd'hui. Un jour futur = tâche reportée (EF-O05). */
  plannedFor: string | null;
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
  /** Tâche travaillée pendant ce cycle Focus (EF-T03) ; toujours `null` pour une pause. */
  taskId: string | null;
}

/** Journal d'activité d'une journée (clé `YYYY-MM-DD`, heure locale). */
export interface DayLog {
  date: string;
  sessions: SessionRecord[];
}

/** Activité d'un projet sur la période du rapport (`projectId` null = sans projet). */
export interface ProjectReportGroup {
  projectId: string | null;
  name: string;
  color: string | null;
  client: string | null;
  focusSeconds: number;
  completedTasks: Task[];
  pendingTasks: Task[];
}

/** Session d'un rapport, avec sa tâche et son projet résolus (export CSV, EF-R04). */
export interface ReportSession {
  date: string;
  session: SessionRecord;
  taskTitle: string | null;
  projectName: string | null;
}

/** Rapport d'une période (lot L3, EF-R02) ; le rapport du jour est le cas `from === to`. */
export interface Report {
  from: string;
  to: string;
  /** Nom du projet filtré (« Sans projet » compris) ; `null` = tous les projets. */
  scope: string | null;
  generatedAt: number;
  completedCycles: number;
  focusSeconds: number;
  breakSeconds: number;
  interruptedSessions: number;
  completedTasks: Task[];
  pendingTasks: Task[];
  /** Ratio tâches terminées / tâches totales, entre 0 et 1. */
  completionRate: number;
  /** Tâches reportées à un jour ultérieur (exclues du taux de complétion). */
  postponedTasks: Task[];
  /** Regroupement par projet ; vide quand aucun projet n'est concerné. */
  projectGroups: ProjectReportGroup[];
  /** Sessions de la période (après filtre), dans l'ordre chronologique. */
  sessions: ReportSession[];
}

/** Rapport d'une journée (historique : `buildDailyReport`). */
export type DailyReport = Report;

export type ReportFormat = 'markdown' | 'pdf';
