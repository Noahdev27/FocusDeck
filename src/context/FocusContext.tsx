import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { DayLog, SessionRecord, Task, TimerSettings } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useToday } from '../hooks/useToday';
import { LOG_RETENTION_DAYS, MAX_TASKS, STORAGE_KEYS } from '../utils/constants';
import { fromDateKey } from '../utils/format';
import { createId } from '../utils/id';
import { normalizeTaskTitle, sanitizeLogs, sanitizeSettings, sanitizeTasks } from '../utils/validation';

export interface FocusContextValue {
  today: string;
  settings: TimerSettings;
  updateSettings: (patch: Partial<TimerSettings>) => void;
  resetSettings: () => void;

  tasks: Task[];
  addTask: (title: string) => boolean;
  toggleTask: (id: string) => void;
  renameTask: (id: string, title: string) => void;
  deleteTask: (id: string) => void;
  reorderTasks: (tasks: Task[]) => void;
  clearCompletedTasks: () => void;

  todayLog: DayLog;
  recordSession: (session: Omit<SessionRecord, 'id'>) => void;
  clearTodayLog: () => void;
}

const FocusContext = createContext<FocusContextValue | null>(null);

/** Supprime les journaux plus anciens que la fenêtre de rétention. */
function pruneLogs(logs: Record<string, DayLog>, today: string): Record<string, DayLog> {
  const limit = fromDateKey(today).getTime() - LOG_RETENTION_DAYS * 86_400_000;
  return Object.fromEntries(Object.entries(logs).filter(([date]) => fromDateKey(date).getTime() >= limit));
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const today = useToday();
  const [settings, setSettings] = useLocalStorage(STORAGE_KEYS.settings, sanitizeSettings);
  const [tasks, setTasks] = useLocalStorage(STORAGE_KEYS.tasks, sanitizeTasks);
  const [logs, setLogs] = useLocalStorage(STORAGE_KEYS.logs, sanitizeLogs);

  const updateSettings = useCallback(
    (patch: Partial<TimerSettings>) => setSettings((previous) => sanitizeSettings({ ...previous, ...patch })),
    [setSettings],
  );
  const resetSettings = useCallback(() => setSettings(sanitizeSettings(undefined)), [setSettings]);

  const addTask = useCallback(
    (title: string): boolean => {
      const clean = normalizeTaskTitle(title);
      if (clean.length === 0 || tasks.length >= MAX_TASKS) return false;
      const task: Task = { id: createId(), title: clean, completed: false, createdAt: Date.now(), completedAt: null };
      setTasks((previous) => [task, ...previous].slice(0, MAX_TASKS));
      return true;
    },
    [setTasks, tasks.length],
  );

  const toggleTask = useCallback(
    (id: string) =>
      setTasks((previous) =>
        previous.map((task) =>
          task.id === id
            ? { ...task, completed: !task.completed, completedAt: task.completed ? null : Date.now() }
            : task,
        ),
      ),
    [setTasks],
  );

  const renameTask = useCallback(
    (id: string, title: string) => {
      const clean = normalizeTaskTitle(title);
      if (clean.length === 0) return;
      setTasks((previous) => previous.map((task) => (task.id === id ? { ...task, title: clean } : task)));
    },
    [setTasks],
  );

  const deleteTask = useCallback(
    (id: string) => setTasks((previous) => previous.filter((task) => task.id !== id)),
    [setTasks],
  );

  const reorderTasks = useCallback((next: Task[]) => setTasks(sanitizeTasks(next)), [setTasks]);

  const clearCompletedTasks = useCallback(
    () => setTasks((previous) => previous.filter((task) => !task.completed)),
    [setTasks],
  );

  const recordSession = useCallback(
    (session: Omit<SessionRecord, 'id'>) => {
      if (session.durationSeconds <= 0) return;
      const record: SessionRecord = { ...session, id: createId() };
      setLogs((previous) => {
        const current = previous[today] ?? { date: today, sessions: [] };
        return pruneLogs({ ...previous, [today]: { ...current, sessions: [...current.sessions, record] } }, today);
      });
    },
    [setLogs, today],
  );

  const clearTodayLog = useCallback(
    () =>
      setLogs((previous) => Object.fromEntries(Object.entries(previous).filter(([date]) => date !== today))),
    [setLogs, today],
  );

  const todayLog = useMemo<DayLog>(() => logs[today] ?? { date: today, sessions: [] }, [logs, today]);

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
      deleteTask,
      reorderTasks,
      clearCompletedTasks,
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
      deleteTask,
      reorderTasks,
      clearCompletedTasks,
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
