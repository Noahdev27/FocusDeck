import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { DayLog, Project, SessionRecord, Task, TimerSettings } from '../types';
import { usePersistentState } from '../data';
import { useToday } from '../hooks/useToday';
import { MAX_TASKS } from '../utils/constants';
import { createId } from '../utils/id';
import { appendSession, removeDay } from '../utils/logs';
import { buildProject, editProject, validateProjectInput, type ProjectInput } from '../utils/projects';
import { applyReorder, countPomodoros, postponeTask as postpone, removeTasks, restoreTasks as restore, type RemovedTask } from '../utils/tasks';
import { normalizeTaskTitle, sanitizeEstimate, sanitizeSettings } from '../utils/validation';

export interface NewTaskOptions {
  projectId?: string | null;
  estimate?: number | null;
}

export type ProjectResult = { ok: true; project: Project } | { ok: false; error: string };

export interface FocusContextValue {
  today: string;
  settings: TimerSettings;
  updateSettings: (patch: Partial<TimerSettings>) => void;
  resetSettings: () => void;

  tasks: Task[];
  addTask: (title: string, options?: NewTaskOptions) => boolean;
  toggleTask: (id: string) => void;
  renameTask: (id: string, title: string) => void;
  /** Projet et estimation (EF-O02, EF-O03). */
  updateTask: (id: string, patch: Partial<Pick<Task, 'projectId' | 'estimate'>>) => void;
  /** Report au lendemain (EF-O05) et retour dans la liste du jour. */
  postponeTask: (id: string) => void;
  unpostponeTask: (id: string) => void;
  /** Retourne les tâches retirées, à passer à `restoreTasks` pour annuler (EF-O06). */
  deleteTask: (id: string) => RemovedTask[];
  clearCompletedTasks: () => RemovedTask[];
  restoreTasks: (removed: readonly RemovedTask[]) => void;
  /** Nouvel ordre des tâches d'une vue (filtrée ou non). */
  reorderTasks: (tasks: Task[]) => void;
  /** Pomodoros réalisés par tâche, dérivés du journal. */
  pomodoroCounts: Record<string, number>;

  projects: Project[];
  addProject: (input: ProjectInput) => ProjectResult;
  updateProject: (id: string, input: ProjectInput) => ProjectResult;
  setProjectArchived: (id: string, archived: boolean) => void;

  todayLog: DayLog;
  /** `id` facultatif : fourni par le minuteur pour dédoublonner entre appareils. */
  recordSession: (session: Omit<SessionRecord, 'id'> & { id?: string }) => void;
  clearTodayLog: () => void;
}

const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({ children }: { children: ReactNode }) {
  const today = useToday();
  const [settings, setSettings] = usePersistentState('settings');
  const [tasks, setTasks] = usePersistentState('tasks');
  const [projects, setProjects] = usePersistentState('projects');
  const [logs, setLogs] = usePersistentState('logs');

  const updateSettings = useCallback(
    (patch: Partial<TimerSettings>) => setSettings((previous) => sanitizeSettings({ ...previous, ...patch })),
    [setSettings],
  );
  const resetSettings = useCallback(() => setSettings(sanitizeSettings(undefined)), [setSettings]);

  const mapTask = useCallback(
    (id: string, change: (task: Task) => Task) => setTasks((previous) => previous.map((task) => (task.id === id ? change(task) : task))),
    [setTasks],
  );

  const addTask = useCallback(
    (title: string, options: NewTaskOptions = {}): boolean => {
      const clean = normalizeTaskTitle(title);
      if (clean.length === 0 || tasks.length >= MAX_TASKS) return false;
      const task: Task = {
        id: createId(),
        title: clean,
        completed: false,
        createdAt: Date.now(),
        completedAt: null,
        projectId: options.projectId ?? null,
        estimate: sanitizeEstimate(options.estimate),
        plannedFor: null,
      };
      setTasks((previous) => [task, ...previous].slice(0, MAX_TASKS));
      return true;
    },
    [setTasks, tasks.length],
  );

  const toggleTask = useCallback(
    (id: string) =>
      mapTask(id, (task) => ({ ...task, completed: !task.completed, completedAt: task.completed ? null : Date.now() })),
    [mapTask],
  );

  const renameTask = useCallback(
    (id: string, title: string) => {
      const clean = normalizeTaskTitle(title);
      if (clean.length === 0) return;
      mapTask(id, (task) => ({ ...task, title: clean }));
    },
    [mapTask],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Pick<Task, 'projectId' | 'estimate'>>) =>
      mapTask(id, (task) => ({
        ...task,
        ...(patch.projectId !== undefined && { projectId: patch.projectId }),
        ...(patch.estimate !== undefined && { estimate: sanitizeEstimate(patch.estimate) }),
      })),
    [mapTask],
  );

  const postponeTask = useCallback((id: string) => mapTask(id, (task) => postpone(task, today)), [mapTask, today]);
  const unpostponeTask = useCallback((id: string) => mapTask(id, (task) => ({ ...task, plannedFor: null })), [mapTask]);

  // La liste retirée est calculée sur l'état rendu (un updater peut s'exécuter plus tard).
  const deleteTask = useCallback(
    (id: string): RemovedTask[] => {
      const { removed } = removeTasks(tasks, new Set([id]));
      setTasks((previous) => removeTasks(previous, new Set([id])).tasks);
      return removed;
    },
    [setTasks, tasks],
  );

  const clearCompletedTasks = useCallback((): RemovedTask[] => {
    const ids = new Set(tasks.filter((task) => task.completed).map((task) => task.id));
    const { removed } = removeTasks(tasks, ids);
    setTasks((previous) => removeTasks(previous, ids).tasks);
    return removed;
  }, [setTasks, tasks]);

  const restoreTasks = useCallback(
    (removed: readonly RemovedTask[]) => setTasks((previous) => restore(previous, removed)),
    [setTasks],
  );

  const reorderTasks = useCallback((next: Task[]) => setTasks((previous) => applyReorder(previous, next)), [setTasks]);

  const addProject = useCallback(
    (input: ProjectInput): ProjectResult => {
      const error = validateProjectInput(input, projects);
      const project = error === null ? buildProject(input, createId(), Date.now()) : null;
      if (!project) return { ok: false, error: error ?? 'Projet invalide.' };
      setProjects((previous) => [...previous, project]);
      return { ok: true, project };
    },
    [projects, setProjects],
  );

  const updateProject = useCallback(
    (id: string, input: ProjectInput): ProjectResult => {
      const current = projects.find((project) => project.id === id);
      const error = current ? validateProjectInput(input, projects, id) : 'Projet introuvable.';
      if (!current || error !== null) return { ok: false, error: error ?? 'Projet introuvable.' };
      const project = editProject(current, input);
      setProjects((previous) => previous.map((item) => (item.id === id ? project : item)));
      return { ok: true, project };
    },
    [projects, setProjects],
  );

  const setProjectArchived = useCallback(
    (id: string, archived: boolean) =>
      setProjects((previous) =>
        previous.map((project) => (project.id === id ? editProject(project, { archivedAt: archived ? Date.now() : null }) : project)),
      ),
    [setProjects],
  );

  const recordSession = useCallback(
    (session: Omit<SessionRecord, 'id'> & { id?: string }) => {
      if (session.durationSeconds <= 0) return;
      const record: SessionRecord = { ...session, id: session.id ?? createId() };
      setLogs((previous) => appendSession(previous, today, record));
    },
    [setLogs, today],
  );

  const clearTodayLog = useCallback(() => setLogs((previous) => removeDay(previous, today)), [setLogs, today]);

  const todayLog = useMemo<DayLog>(() => logs[today] ?? { date: today, sessions: [] }, [logs, today]);
  const pomodoroCounts = useMemo(() => countPomodoros(logs), [logs]);

  const value = useMemo<FocusContextValue>(
    () => ({
      today,
      settings,
      updateSettings,
      resetSettings,
      tasks,
      addTask,
      toggleTask,
      renameTask,
      updateTask,
      postponeTask,
      unpostponeTask,
      deleteTask,
      clearCompletedTasks,
      restoreTasks,
      reorderTasks,
      pomodoroCounts,
      projects,
      addProject,
      updateProject,
      setProjectArchived,
      todayLog,
      recordSession,
      clearTodayLog,
    }),
    [
      today,
      settings,
      updateSettings,
      resetSettings,
      tasks,
      addTask,
      toggleTask,
      renameTask,
      updateTask,
      postponeTask,
      unpostponeTask,
      deleteTask,
      clearCompletedTasks,
      restoreTasks,
      reorderTasks,
      pomodoroCounts,
      projects,
      addProject,
      updateProject,
      setProjectArchived,
      todayLog,
      recordSession,
      clearTodayLog,
    ],
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocus(): FocusContextValue {
  const context = useContext(FocusContext);
  if (!context) throw new Error('useFocus doit être utilisé dans un <FocusProvider>.');
  return context;
}
