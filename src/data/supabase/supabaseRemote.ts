import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionRecord, Task, TimerMode } from '../../types';
import { sanitizeLogs, sanitizeSettings, sanitizeTasks, sanitizeTimerSnapshot } from '../../utils/validation';
import type { OutboxEntry, RemotePull, RemoteSession, RemoteStore, RemoteTask } from '../sync/types';

/**
 * Marge appliquée au curseur : deux transactions peuvent être validées dans le désordre
 * par rapport à leur horodatage. On relit donc les dernières secondes (la fusion est
 * idempotente : relire une ligne déjà connue ne change rien).
 */
export const CURSOR_SAFETY_MARGIN_MS = 5_000;
const EPOCH = '1970-01-01T00:00:00.000Z';

export interface TaskRow {
  id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SessionRow {
  id: string;
  mode: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  completed: boolean;
  day: string;
  updated_at: string;
  deleted_at: string | null;
}

const ms = (iso: string | null): number | null => (iso === null ? null : new Date(iso).getTime());
const iso = (timestamp: number) => new Date(timestamp).toISOString();

export function rowToTask(row: TaskRow): RemoteTask | null {
  const [task] = sanitizeTasks([
    { id: row.id, title: row.title, completed: row.completed, createdAt: ms(row.created_at), completedAt: ms(row.completed_at) },
  ]);
  return task ? { task, position: row.position, deleted: row.deleted_at !== null } : null;
}

export function taskToRow(task: Task, position: number, userId: string) {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    completed: task.completed,
    completed_at: task.completedAt === null ? null : iso(task.completedAt),
    position,
    created_at: iso(task.createdAt),
    deleted_at: null,
  };
}

export function rowToSession(row: SessionRow): RemoteSession | null {
  const session = sanitizeLogs({
    [row.day]: {
      sessions: [
        {
          id: row.id,
          mode: row.mode as TimerMode,
          startedAt: ms(row.started_at),
          endedAt: ms(row.ended_at),
          durationSeconds: row.duration_seconds,
          completed: row.completed,
        },
      ],
    },
  })[row.day]?.sessions[0];
  return session ? { date: row.day, session, deleted: row.deleted_at !== null } : null;
}

export function sessionToRow(session: SessionRecord, date: string, userId: string) {
  return {
    id: session.id,
    user_id: userId,
    mode: session.mode,
    started_at: iso(session.startedAt),
    ended_at: iso(session.endedAt),
    duration_seconds: session.durationSeconds,
    completed: session.completed,
    day: date,
  };
}

const latest = (values: (string | undefined)[], fallback: string | null): string | null =>
  values.reduce<string | null>((max, value) => (value && (!max || value > max) ? value : max), fallback);

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`Supabase (${context}) : ${error.message}`);
}

/** Accès au projet Supabase de l'utilisateur connecté (protégé par RLS côté serveur). */
export function createSupabaseRemote(client: SupabaseClient, userId: string): RemoteStore {
  return {
    async pull(cursor) {
      const since = cursor === null ? EPOCH : iso(new Date(cursor).getTime() - CURSOR_SAFETY_MARGIN_MS);
      const [settings, timer, tasks, sessions] = await Promise.all([
        client.from('settings').select('data, updated_at').gt('updated_at', since).maybeSingle(),
        client.from('timer_states').select('snapshot, updated_at').gt('updated_at', since).maybeSingle(),
        client.from('tasks').select('id, title, completed, completed_at, position, created_at, updated_at, deleted_at').gt('updated_at', since).order('updated_at'),
        client
          .from('sessions')
          .select('id, mode, started_at, ended_at, duration_seconds, completed, day, updated_at, deleted_at')
          .gt('updated_at', since)
          .order('updated_at'),
      ]);
      fail('lecture des réglages', settings.error);
      fail('lecture du minuteur', timer.error);
      fail('lecture des tâches', tasks.error);
      fail('lecture des sessions', sessions.error);

      const taskRows = (tasks.data ?? []) as TaskRow[];
      const sessionRows = (sessions.data ?? []) as SessionRow[];
      const settingsRow = settings.data as { data: unknown; updated_at: string } | null;
      const timerRow = timer.data as { snapshot: unknown; updated_at: string } | null;

      const result: RemotePull = {
        tasks: taskRows.map(rowToTask).filter((item): item is RemoteTask => item !== null),
        sessions: sessionRows.map(rowToSession).filter((item): item is RemoteSession => item !== null),
        cursor: latest(
          [settingsRow?.updated_at, timerRow?.updated_at, ...taskRows.map((r) => r.updated_at), ...sessionRows.map((r) => r.updated_at)],
          cursor ?? EPOCH,
        ),
      };
      if (settingsRow) result.settings = sanitizeSettings(settingsRow.data);
      if (timerRow) result.timer = sanitizeTimerSnapshot(timerRow.snapshot);
      return result;
    },

    async push(entries: OutboxEntry[]) {
      const now = new Date().toISOString();
      const settings = entries.filter((e) => e.type === 'settings').at(-1);
      const timer = entries.filter((e) => e.type === 'timer').at(-1);
      const tasks = entries.flatMap((e) => (e.type === 'task' ? [taskToRow(e.task, e.position, userId)] : []));
      const deletedTasks = entries.flatMap((e) => (e.type === 'task-delete' ? [e.id] : []));
      const sessions = entries.flatMap((e) => (e.type === 'session' ? [sessionToRow(e.session, e.date, userId)] : []));
      const deletedSessions = entries.flatMap((e) => (e.type === 'session-delete' ? [e.id] : []));

      if (settings) fail('réglages', (await client.from('settings').upsert({ user_id: userId, data: settings.settings })).error);
      if (timer) fail('minuteur', (await client.from('timer_states').upsert({ user_id: userId, snapshot: timer.snapshot })).error);
      if (tasks.length > 0) fail('tâches', (await client.from('tasks').upsert(tasks, { onConflict: 'id' })).error);
      if (deletedTasks.length > 0) {
        fail('suppression de tâches', (await client.from('tasks').update({ deleted_at: now }).in('id', deletedTasks)).error);
      }
      // Même phase terminée sur deux appareils : la seconde écriture est ignorée.
      if (sessions.length > 0) {
        fail('sessions', (await client.from('sessions').upsert(sessions, { onConflict: 'id', ignoreDuplicates: true })).error);
      }
      if (deletedSessions.length > 0) {
        fail('suppression de sessions', (await client.from('sessions').update({ deleted_at: now }).in('id', deletedSessions)).error);
      }
    },

    subscribe(onChange) {
      const channel = client.channel(`focusdeck:${userId}`);
      for (const table of ['settings', 'tasks', 'sessions', 'timer_states']) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` }, onChange);
      }
      channel.subscribe();
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
