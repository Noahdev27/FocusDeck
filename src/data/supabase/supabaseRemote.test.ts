import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import { CURSOR_SAFETY_MARGIN_MS, createSupabaseRemote, type SessionRow, type TaskRow } from './supabaseRemote';

type Result = { data?: unknown; error: { message: string } | null };

/** Faux client supabase-js : enregistre les appels et renvoie des données préparées. */
function fakeClient(tables: Record<string, unknown>, failOn?: string) {
  const writes: unknown[][] = [];
  const reads: { table: string; since?: unknown }[] = [];
  const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) };
  const respond = (table: string, data: unknown): Promise<Result> =>
    Promise.resolve(failOn === table ? { data: null, error: { message: 'refusé' } } : { data, error: null });
  const from = (table: string) => {
    const read = { table } as { table: string; since?: unknown };
    const query = {
      select: () => query,
      gt: (_column: string, value: unknown) => {
        read.since = value;
        reads.push(read);
        return query;
      },
      order: () => respond(table, tables[table] ?? []),
      maybeSingle: () => respond(table, tables[table] ?? null),
      upsert: (rows: unknown, options?: unknown) => {
        writes.push([table, 'upsert', rows, options]);
        return respond(table, null);
      },
      update: (patch: unknown) => ({
        in: (_column: string, ids: unknown) => {
          writes.push([table, 'update', patch, ids]);
          return respond(table, null);
        },
      }),
    };
    return query;
  };
  const client = { from, channel: vi.fn(() => channel), removeChannel: vi.fn() } as unknown as SupabaseClient;
  return { client, writes, reads, channel };
}

const taskRow = (patch: Partial<TaskRow> = {}): TaskRow => ({
  id: '10000000-0000-4000-8000-000000000001',
  project_id: null,
  title: 'Devis Acme',
  completed: false,
  completed_at: null,
  position: 0,
  estimate: null,
  planned_for: null,
  created_at: '2026-10-16T08:00:00.000Z',
  updated_at: '2026-10-16T09:00:00.000Z',
  deleted_at: null,
  ...patch,
});

const sessionRow: SessionRow = {
  id: 'focus:1792144800000',
  task_id: null,
  mode: 'focus',
  started_at: '2026-10-16T08:00:00.000Z',
  ended_at: '2026-10-16T08:25:00.000Z',
  duration_seconds: 1500,
  completed: true,
  day: '2026-10-16',
  updated_at: '2026-10-16T09:30:00.000Z',
  deleted_at: null,
};

describe('createSupabaseRemote', () => {
  it('convertit les lignes en données de l’application et calcule le curseur', async () => {
    const { client, reads } = fakeClient({
      settings: { data: { focusMinutes: 50 }, updated_at: '2026-10-16T07:00:00.000Z' },
      tasks: [taskRow(), taskRow({ id: '10000000-0000-4000-8000-000000000002', title: '', updated_at: '2026-10-16T10:00:00.000Z' })],
      sessions: [sessionRow, { ...sessionRow, id: 'x', mode: 'sieste' }],
    });
    const pull = await createSupabaseRemote(client, 'u1').pull(null);

    expect(pull.settings).toEqual({ ...DEFAULT_SETTINGS, focusMinutes: 50 });
    expect(pull.timer).toBeUndefined();
    // Les lignes invalides (titre vide, mode inconnu) sont écartées par les sanitizers.
    expect(pull.tasks).toEqual([
      {
        task: { id: taskRow().id, title: 'Devis Acme', completed: false, createdAt: Date.parse('2026-10-16T08:00:00.000Z'), completedAt: null, projectId: null, estimate: null, plannedFor: null },
        position: 0,
        deleted: false,
      },
    ]);
    expect(pull.sessions.map((s) => s.session.id)).toEqual(['focus:1792144800000']);
    expect(pull.cursor).toBe('2026-10-16T10:00:00.000Z');
    expect(reads.every((read) => read.since === '1970-01-01T00:00:00.000Z')).toBe(true);
  });

  it('relit avec une marge de sécurité et conserve le curseur sans nouveauté', async () => {
    const { client, reads } = fakeClient({});
    const cursor = '2026-10-16T10:00:00.000Z';
    const pull = await createSupabaseRemote(client, 'u1').pull(cursor);
    expect(pull.cursor).toBe(cursor);
    expect(reads[0]?.since).toBe(new Date(Date.parse(cursor) - CURSOR_SAFETY_MARGIN_MS).toISOString());
  });

  it('marque les suppressions logiques', async () => {
    const { client } = fakeClient({ tasks: [taskRow({ deleted_at: '2026-10-16T11:00:00.000Z' })], sessions: [{ ...sessionRow, deleted_at: '2026-10-16T11:00:00.000Z' }] });
    const pull = await createSupabaseRemote(client, 'u1').pull(null);
    expect(pull.tasks[0]?.deleted).toBe(true);
    expect(pull.sessions[0]?.deleted).toBe(true);
  });

  it('regroupe les envois par table, sessions sans doublon', async () => {
    const { client, writes } = fakeClient({});
    await createSupabaseRemote(client, 'u1').push([
      { type: 'settings', settings: DEFAULT_SETTINGS },
      { type: 'task', task: { id: 't1', title: 'A', completed: true, createdAt: 0, completedAt: 1000, projectId: null, estimate: null, plannedFor: null }, position: 2 },
      { type: 'task-delete', id: 't2' },
      { type: 'session', date: '2026-10-16', session: { id: 's1', mode: 'focus', startedAt: 0, endedAt: 1000, durationSeconds: 1, completed: true, taskId: null } },
      { type: 'session-delete', id: 's2' },
      { type: 'timer', snapshot: null },
    ]);
    expect(writes.map(([table, op]) => `${String(table)}:${String(op)}`)).toEqual([
      'settings:upsert',
      'timer_states:upsert',
      'tasks:upsert',
      'tasks:update',
      'sessions:upsert',
      'sessions:update',
    ]);
    expect(writes[2]?.[2]).toEqual([
      {
        id: 't1',
        user_id: 'u1',
        project_id: null,
        title: 'A',
        completed: true,
        completed_at: '1970-01-01T00:00:01.000Z',
        position: 2,
        estimate: null,
        planned_for: null,
        created_at: '1970-01-01T00:00:00.000Z',
        deleted_at: null,
      },
    ]);
    expect(writes[4]?.[3]).toEqual({ onConflict: 'id', ignoreDuplicates: true });
    expect(writes[3]?.[3]).toEqual(['t2']);
  });

  it('lot L4 : projets, champs des tâches et tâche des sessions, envoyés avant les tâches', async () => {
    const PROJECT = '20000000-0000-4000-8000-000000000001';
    const TASK = '10000000-0000-4000-8000-000000000001';
    const { client, writes } = fakeClient({
      projects: [
        { id: PROJECT, name: 'Site Acme', color: '#34d399', client: 'Acme', created_at: '2026-10-16T07:00:00.000Z', archived_at: null, updated_at: '2026-10-16T11:00:00.000Z' },
        { id: 'x', name: '', color: '#34d399', client: null, created_at: '2026-10-16T07:00:00.000Z', archived_at: null, updated_at: '2026-10-16T07:00:00.000Z' },
      ],
      tasks: [taskRow({ project_id: PROJECT, estimate: 3, planned_for: '2026-10-17' })],
      sessions: [{ ...sessionRow, task_id: TASK }],
    });
    const remote = createSupabaseRemote(client, 'u1');
    const pull = await remote.pull(null);
    expect(pull.projects).toEqual([
      { id: PROJECT, name: 'Site Acme', color: '#34d399', client: 'Acme', createdAt: Date.parse('2026-10-16T07:00:00.000Z'), archivedAt: null },
    ]);
    expect(pull.tasks[0]?.task).toMatchObject({ projectId: PROJECT, estimate: 3, plannedFor: '2026-10-17' });
    expect(pull.sessions[0]?.session.taskId).toBe(TASK);
    expect(pull.cursor).toBe('2026-10-16T11:00:00.000Z');

    const project = pull.projects[0];
    const task = pull.tasks[0]?.task;
    if (!project || !task) throw new Error('données attendues');
    await remote.push([
      { type: 'task', task: { ...task, projectId: 'local-1' }, position: 0 },
      { type: 'project', project: { ...project, archivedAt: 0 } },
      { type: 'session', date: '2026-10-16', session: { id: 's', mode: 'focus', startedAt: 0, endedAt: 1, durationSeconds: 1, completed: true, taskId: TASK } },
    ]);
    expect(writes.map(([table, op]) => `${String(table)}:${String(op)}`)).toEqual(['projects:upsert', 'tasks:upsert', 'sessions:upsert']);
    expect(writes[0]?.[2]).toEqual([
      { id: PROJECT, user_id: 'u1', name: 'Site Acme', color: '#34d399', client: 'Acme', created_at: '2026-10-16T07:00:00.000Z', archived_at: '1970-01-01T00:00:00.000Z' },
    ]);
    // Identifiant local non UUID : la référence est omise plutôt que de bloquer l'envoi.
    expect(writes[1]?.[2]).toEqual([expect.objectContaining({ project_id: null, estimate: 3, planned_for: '2026-10-17' })]);
    expect(writes[2]?.[2]).toEqual([expect.objectContaining({ task_id: TASK })]);
  });

  it('signale les erreurs du serveur', async () => {
    const { client } = fakeClient({}, 'tasks');
    const remote = createSupabaseRemote(client, 'u1');
    await expect(remote.pull(null)).rejects.toThrow('lecture des tâches');
    await expect(remote.push([{ type: 'task-delete', id: 'x' }])).rejects.toThrow('suppression de tâches');
  });

  it('s’abonne aux changements de l’utilisateur et se désabonne', () => {
    const { client, channel } = fakeClient({});
    const onChange = vi.fn();
    const unsubscribe = createSupabaseRemote(client, 'u1').subscribe(onChange);
    expect(channel.on).toHaveBeenCalledTimes(5);
    expect(channel.on).toHaveBeenCalledWith('postgres_changes', expect.objectContaining({ table: 'tasks', filter: 'user_id=eq.u1' }), onChange);
    unsubscribe();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});
