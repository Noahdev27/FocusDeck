import type { DayLog, Project, SessionRecord, Task } from '../types';
import { fromDateKey, shiftDateKey, toDateKey } from '../utils/format';
import { indexProjects } from '../utils/tasks';

/**
 * Statistiques de l'historique (lot L3, EF-R03, EF-T07). Fonctions pures, sans React ;
 * toutes les dates sont des clés de jour locales `YYYY-MM-DD`, ce qui rend les calculs
 * insensibles aux changements d'heure (un jour = une clé, jamais 86 400 000 ms).
 */

export interface DayTotals {
  date: string;
  focusSeconds: number;
  breakSeconds: number;
  /** Cycles Focus menés à leur terme. */
  cycles: number;
  sessions: number;
}

export interface PeriodTotals {
  /** Premier jour de la période (lundi pour une semaine, 1er pour un mois). */
  key: string;
  from: string;
  to: string;
  focusSeconds: number;
  cycles: number;
}

export type Granularity = 'day' | 'week' | 'month';

/** Garde-fou d'une plage libre (≈ 10 ans) : aucune boucle démesurée sur une saisie aberrante. */
export const MAX_RANGE_DAYS = 3_660;

/** Jours de `from` à `to` inclus (vide si `from > to`). */
export function dateRange(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < MAX_RANGE_DAYS; day = shiftDateKey(day, 1)) days.push(day);
  return days;
}

export function totalsOf(date: string, sessions: readonly SessionRecord[]): DayTotals {
  const totals: DayTotals = { date, focusSeconds: 0, breakSeconds: 0, cycles: 0, sessions: sessions.length };
  for (const session of sessions) {
    if (session.mode === 'focus') {
      totals.focusSeconds += session.durationSeconds;
      if (session.completed) totals.cycles += 1;
    } else {
      totals.breakSeconds += session.durationSeconds;
    }
  }
  return totals;
}

/** Totaux de chaque jour de la plage, jours sans activité compris (à zéro). */
export function dailyTotals(logs: Record<string, DayLog>, from: string, to: string): DayTotals[] {
  return dateRange(from, to).map((date) => totalsOf(date, logs[date]?.sessions ?? []));
}

/** Lundi de la semaine d'un jour (semaine ISO, usage français). */
export function startOfWeek(date: string): string {
  const day = fromDateKey(date).getDay(); // 0 = dimanche
  return shiftDateKey(date, -((day + 6) % 7));
}

export const startOfMonth = (date: string): string => `${date.slice(0, 7)}-01`;

export function endOfMonth(date: string): string {
  const start = fromDateKey(startOfMonth(date));
  return toDateKey(new Date(start.getFullYear(), start.getMonth() + 1, 0));
}

/** Regroupe des totaux journaliers par jour, semaine (lundi → dimanche) ou mois civil. */
export function aggregate(days: readonly DayTotals[], granularity: Granularity): PeriodTotals[] {
  const periods = new Map<string, PeriodTotals>();
  for (const day of days) {
    const key = granularity === 'day' ? day.date : granularity === 'week' ? startOfWeek(day.date) : startOfMonth(day.date);
    const period = periods.get(key) ?? {
      key,
      from: key,
      to: granularity === 'day' ? key : granularity === 'week' ? shiftDateKey(key, 6) : endOfMonth(key),
      focusSeconds: 0,
      cycles: 0,
    };
    period.focusSeconds += day.focusSeconds;
    period.cycles += day.cycles;
    periods.set(key, period);
  }
  return [...periods.values()];
}

export interface Summary {
  focusSeconds: number;
  cycles: number;
  /** Jours avec au moins une minute de focus. */
  activeDays: number;
  /** Moyenne de focus par jour de la plage (jours vides compris). */
  averageFocusSeconds: number;
  /** Jour au plus long temps de focus (le plus récent en cas d'égalité) ; `null` si aucun. */
  bestDay: DayTotals | null;
}

export function summarize(days: readonly DayTotals[]): Summary {
  let focusSeconds = 0;
  let cycles = 0;
  let activeDays = 0;
  let bestDay: DayTotals | null = null;
  for (const day of days) {
    focusSeconds += day.focusSeconds;
    cycles += day.cycles;
    if (day.focusSeconds > 0) activeDays += 1;
    if (day.focusSeconds > 0 && (!bestDay || day.focusSeconds >= bestDay.focusSeconds)) bestDay = day;
  }
  return { focusSeconds, cycles, activeDays, averageFocusSeconds: days.length === 0 ? 0 : focusSeconds / days.length, bestDay };
}

export interface Streaks {
  /** Jours consécutifs avec au moins un cycle terminé, jusqu'à aujourd'hui (ou hier si rien encore aujourd'hui). */
  current: number;
  longest: number;
}

/** Séries de jours consécutifs avec au moins un cycle Focus terminé. */
export function streaks(logs: Record<string, DayLog>, today: string): Streaks {
  const active = new Set(
    Object.values(logs)
      .filter((log) => log.date <= today && log.sessions.some((s) => s.mode === 'focus' && s.completed))
      .map((log) => log.date),
  );
  let longest = 0;
  for (const date of active) {
    if (active.has(shiftDateKey(date, -1))) continue; // pas un début de série
    let length = 1;
    while (active.has(shiftDateKey(date, length))) length += 1;
    longest = Math.max(longest, length);
  }
  // La série en cours reste valable tant que la journée n'est pas finie.
  let cursor = active.has(today) ? today : shiftDateKey(today, -1);
  let current = 0;
  while (active.has(cursor)) {
    current += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return { current, longest };
}

export interface ProjectShare {
  projectId: string | null;
  name: string;
  color: string | null;
  focusSeconds: number;
}

/**
 * Temps de focus par projet (via la tâche de chaque session). Session sans tâche, tâche
 * disparue ou projet inconnu → « Sans projet ». Trié du plus long au plus court.
 */
export function focusByProject(
  sessions: readonly SessionRecord[],
  tasks: readonly Task[],
  projects: readonly Project[],
  noProjectLabel = 'Sans projet',
): ProjectShare[] {
  const byId = indexProjects(projects);
  const taskProject = new Map(tasks.map((task) => [task.id, task.projectId !== null && byId.has(task.projectId) ? task.projectId : null]));
  const totals = new Map<string | null, number>();
  for (const session of sessions) {
    if (session.mode !== 'focus') continue;
    const key = session.taskId === null ? null : (taskProject.get(session.taskId) ?? null);
    totals.set(key, (totals.get(key) ?? 0) + session.durationSeconds);
  }
  return [...totals.entries()]
    .filter(([, seconds]) => seconds > 0)
    .map(([projectId, focusSeconds]) => {
      const project = projectId === null ? undefined : byId.get(projectId);
      return { projectId, name: project?.name ?? noProjectLabel, color: project?.color ?? null, focusSeconds };
    })
    .sort((a, b) => b.focusSeconds - a.focusSeconds || a.name.localeCompare(b.name));
}

export interface HeatCell {
  date: string;
  focusSeconds: number;
  cycles: number;
  /** Intensité 0 (rien) à 4 (proche du maximum de l'année). */
  level: 0 | 1 | 2 | 3 | 4;
  /** Jour à venir dans la semaine courante (non dessiné). */
  future: boolean;
}

/**
 * Carte de chaleur : `weeks` colonnes (lundi → dimanche) se terminant par la semaine
 * d'aujourd'hui. Les niveaux sont relatifs au meilleur jour de la fenêtre (quartiles du max).
 */
export function heatmap(logs: Record<string, DayLog>, today: string, weeks = 53): HeatCell[][] {
  const start = shiftDateKey(startOfWeek(today), -7 * (weeks - 1));
  const days = dailyTotals(logs, start, shiftDateKey(startOfWeek(today), 6));
  const max = Math.max(0, ...days.filter((day) => day.date <= today).map((day) => day.focusSeconds));
  const level = (seconds: number): HeatCell['level'] => {
    if (seconds <= 0 || max === 0) return 0;
    return Math.min(4, Math.max(1, Math.ceil((seconds / max) * 4))) as HeatCell['level'];
  };
  const columns: HeatCell[][] = [];
  days.forEach((day, index) => {
    const cell: HeatCell = { date: day.date, focusSeconds: day.focusSeconds, cycles: day.cycles, level: level(day.focusSeconds), future: day.date > today };
    if (index % 7 === 0) columns.push([]);
    columns[columns.length - 1]?.push(cell);
  });
  return columns;
}

export interface GoalProgress {
  done: number;
  goal: number;
  /** Entre 0 et 1 (plafonné). */
  ratio: number;
  reached: boolean;
}

/** Objectif quotidien de cycles (EF-T07). */
export function goalProgress(done: number, goal: number): GoalProgress {
  const safeGoal = Math.max(1, goal);
  return { done, goal: safeGoal, ratio: Math.min(1, done / safeGoal), reached: done >= safeGoal };
}

export interface StatsSnapshot {
  range: DayTotals[];
  summary: Summary;
  streaks: Streaks;
  projects: ProjectShare[];
  heatmap: HeatCell[][];
  today: DayTotals;
}

/** Tout ce qu'affiche la page Statistiques, calculé en une passe (à mémoïser par l'appelant). */
export function buildStats(
  logs: Record<string, DayLog>,
  tasks: readonly Task[],
  projects: readonly Project[],
  today: string,
  rangeDays: number,
): StatsSnapshot {
  const from = shiftDateKey(today, -(rangeDays - 1));
  const range = dailyTotals(logs, from, today);
  const sessions = range.flatMap((day) => logs[day.date]?.sessions ?? []);
  return {
    range,
    summary: summarize(range),
    streaks: streaks(logs, today),
    projects: focusByProject(sessions, tasks, projects),
    heatmap: heatmap(logs, today),
    today: totalsOf(today, logs[today]?.sessions ?? []),
  };
}

/**
 * Graduations d'un axe de durée : 0, un pas « rond » (15 min, 30 min, 1 h, 2 h…) et son double,
 * le dernier couvrant le maximum. Toujours au moins 0 / 15 min / 30 min.
 */
export function durationTicks(maxSeconds: number): number[] {
  const steps = [15, 30, 60, 120, 180, 240, 360, 480, 720].map((minutes) => minutes * 60);
  const step = steps.find((candidate) => candidate * 2 >= maxSeconds) ?? Math.ceil(maxSeconds / 2 / 3600) * 3600;
  return [0, step, step * 2];
}
