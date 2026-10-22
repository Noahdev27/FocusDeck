import type { DayLog, Project, Task } from '../types';
import { MAX_TASKS } from './constants';
import { shiftDateKey } from './format';

/** Où une tâche apparaît aujourd'hui (EF-O05). */
export type TaskSchedule = 'today' | 'later' | 'overdue';

/**
 * - `later` : reportée à un jour futur, masquée de la liste du jour ;
 * - `overdue` : prévue un jour passé et non terminée, quand le report automatique est désactivé ;
 * - `today` : tout le reste (y compris les tâches sans date).
 */
export function taskSchedule(task: Task, today: string, autoPostpone: boolean): TaskSchedule {
  if (task.plannedFor === null || task.plannedFor === today) return 'today';
  if (task.plannedFor > today) return 'later';
  return task.completed || autoPostpone ? 'today' : 'overdue';
}

/** Report manuel au lendemain. */
export function postponeTask(task: Task, today: string): Task {
  return { ...task, plannedFor: shiftDateKey(today, 1) };
}

export interface RemovedTask {
  task: Task;
  /** Position d'origine, pour une restauration à l'identique (EF-O06). */
  index: number;
}

/** Retire des tâches en mémorisant leur position, pour pouvoir annuler. */
export function removeTasks(tasks: readonly Task[], ids: ReadonlySet<string>): { tasks: Task[]; removed: RemovedTask[] } {
  const removed: RemovedTask[] = [];
  const kept: Task[] = [];
  tasks.forEach((task, index) => {
    if (ids.has(task.id)) removed.push({ task, index });
    else kept.push(task);
  });
  return { tasks: kept, removed };
}

/** Annule une suppression : chaque tâche reprend sa position d'origine (ou la plus proche). */
export function restoreTasks(tasks: readonly Task[], removed: readonly RemovedTask[]): Task[] {
  const present = new Set(tasks.map((task) => task.id));
  const next = [...tasks];
  for (const { task, index } of [...removed].sort((a, b) => a.index - b.index)) {
    if (present.has(task.id) || next.length >= MAX_TASKS) continue;
    next.splice(Math.min(index, next.length), 0, task);
    present.add(task.id);
  }
  return next;
}

/**
 * Applique le réordonnancement d'une vue filtrée : les tâches visibles échangent leurs
 * places entre elles, les tâches masquées par le filtre ne bougent pas.
 */
export function applyReorder(tasks: readonly Task[], reordered: readonly Task[]): Task[] {
  const ids = new Set(reordered.map((task) => task.id));
  if (ids.size !== reordered.length || tasks.filter((task) => ids.has(task.id)).length !== ids.size) return [...tasks];
  let cursor = 0;
  return tasks.map((task) => (ids.has(task.id) ? (reordered[cursor++] ?? task) : task));
}

/**
 * Pomodoros réalisés par tâche (EF-O02) : cycles Focus terminés portant `taskId`. Le compteur
 * est dérivé du journal plutôt que stocké, ce qui le rend juste entre appareils (deux appareils
 * qui terminent la même phase produisent une seule session).
 */
export function countPomodoros(logs: Record<string, DayLog>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const log of Object.values(logs)) {
    for (const session of log.sessions) {
      if (session.mode === 'focus' && session.completed && session.taskId !== null) {
        counts[session.taskId] = (counts[session.taskId] ?? 0) + 1;
      }
    }
  }
  return counts;
}

export interface PomodoroProgress {
  done: number;
  estimate: number | null;
  /** Estimation dépassée : retour visuel sur la tâche. */
  over: boolean;
  /** Texte court affiché (`2/4`, `3`). */
  short: string;
  /** Texte complet pour les technologies d'assistance. */
  label: string;
}

export function pomodoroProgress(done: number, estimate: number | null): PomodoroProgress | null {
  if (done === 0 && estimate === null) return null;
  const doneLabel = `${done} pomodoro${done > 1 ? 's' : ''} réalisé${done > 1 ? 's' : ''}`;
  if (estimate === null) return { done, estimate, over: false, short: String(done), label: doneLabel };
  const over = done > estimate;
  return {
    done,
    estimate,
    over,
    short: `${done}/${estimate}`,
    label: `${doneLabel} sur ${estimate} estimé${estimate > 1 ? 's' : ''}${over ? ', estimation dépassée' : ''}`,
  };
}

export type StatusFilter = 'all' | 'active' | 'done';
/** `all`, `none` (sans projet) ou l'identifiant d'un projet. */
export type ProjectFilter = string;

export function matchesFilters(task: Task, status: StatusFilter, project: ProjectFilter): boolean {
  if (status === 'active' && task.completed) return false;
  if (status === 'done' && !task.completed) return false;
  if (project === 'all') return true;
  if (project === 'none') return task.projectId === null;
  return task.projectId === project;
}

/** Index des projets par identifiant (archivés compris : l'historique les référence). */
export function indexProjects(projects: readonly Project[]): Map<string, Project> {
  return new Map(projects.map((project) => [project.id, project]));
}
