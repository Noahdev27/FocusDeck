import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { DayLog, SessionRecord, Task, TimerSettings } from '../types';
import { usePersistentState } from '../data';
import { useToday } from '../hooks/useToday';
import { MAX_TASKS } from '../utils/constants';
import { createId } from '../utils/id';
import { appendSession, removeDay } from '../utils/logs';
import { normalizeTaskTitle, sanitizeSettings, sanitizeTasks } from '../utils/validation';

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

export function FocusProvider({ children }: { children: ReactNode }) {
  const today = useToday();
  const [settings, setSettings] = usePersistentState('settings');
  const [tasks, setTasks] = usePersistentState('tasks');
  const [logs, setLogs] = usePersistentState('logs');

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
      setLogs((previous) => appendSession(previous, today, record));
    },
    [setLogs, today],
  );

  const clearTodayLog = useCallback(
    () =>
      setLogs((previous) => removeDay(previous, today)),
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
