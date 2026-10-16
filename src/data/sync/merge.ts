import type { DayLog } from '../../types';
import { deepEqual } from '../../utils/equal';
import { appendSession, pruneLogs } from '../../utils/logs';
import { sanitizeLogs, sanitizeSettings, sanitizeTasks, sanitizeTimerSnapshot } from '../../utils/validation';
import type { AppData, CollectionKey } from '../repository';
import { entryKey } from './outbox';
import type { OutboxEntry, RemotePull } from './types';

export interface MergeResult {
  data: AppData;
  /** Collections modifiées par la fusion (à écrire localement et à notifier). */
  changed: CollectionKey[];
}

/**
 * Applique des changements serveur au cache local.
 *
 * Règle de conflit (§6.4) : une modification locale encore en file d'attente l'emporte
 * jusqu'à son envoi ; ensuite, le serveur arbitre (« dernier écrit gagne »). Toutes les
 * données reçues sont revalidées par les sanitizers, comme toute source externe.
 */
export function mergeRemote(local: AppData, pull: RemotePull, outbox: readonly OutboxEntry[], today: string): MergeResult {
  const pending = new Set(outbox.map(entryKey));
  const changed = new Set<CollectionKey>();
  let { settings, tasks, logs, timer } = local;

  if (pull.settings !== undefined && !pending.has('settings')) {
    const next = sanitizeSettings(pull.settings);
    if (!deepEqual(next, settings)) {
      settings = next;
      changed.add('settings');
    }
  }

  if (pull.timer !== undefined && !pending.has('timer')) {
    const next = sanitizeTimerSnapshot(pull.timer);
    if (!deepEqual(next, timer)) {
      timer = next;
      changed.add('timer');
    }
  }

  if (pull.tasks.length > 0) {
    const next = [...tasks];
    for (const { task, position, deleted } of [...pull.tasks].sort((a, b) => a.position - b.position)) {
      if (pending.has(`task:${task.id}`)) continue;
      const index = next.findIndex((candidate) => candidate.id === task.id);
      if (deleted) {
        if (index >= 0) next.splice(index, 1);
      } else if (index >= 0) {
        next[index] = task;
      } else {
        next.splice(Math.min(Math.max(0, Math.round(position)), next.length), 0, task);
      }
    }
    const clean = sanitizeTasks(next);
    if (!deepEqual(clean, tasks)) {
      tasks = clean;
      changed.add('tasks');
    }
  }

  if (pull.sessions.length > 0) {
    let next: Record<string, DayLog> = logs;
    for (const { date, session, deleted } of pull.sessions) {
      if (pending.has(`session:${session.id}`)) continue;
      if (deleted) {
        next = Object.fromEntries(
          Object.entries(next).map(([day, log]) => [day, { ...log, sessions: log.sessions.filter((s) => s.id !== session.id) }]),
        );
      } else {
        next = appendSession(next, date, session);
      }
    }
    const clean = pruneLogs(sanitizeLogs(next), today);
    if (!deepEqual(clean, logs)) {
      logs = clean;
      changed.add('logs');
    }
  }

  return { data: { settings, tasks, logs, timer }, changed: [...changed] };
}

/**
 * Première connexion sur cet appareil (EF-C03) : ce qui n'existe que localement est mis
 * en file pour être envoyé. Les identifiants étant des UUID générés côté client, une
 * reconnexion ne crée aucun doublon (upsert).
 */
export function localOnlyEntries(local: AppData, remote: RemotePull): OutboxEntry[] {
  const remoteTasks = new Set(remote.tasks.map(({ task }) => task.id));
  const remoteSessions = new Set(remote.sessions.map(({ session }) => session.id));
  const entries: OutboxEntry[] = [];
  if (remote.settings === undefined) entries.push({ type: 'settings', settings: local.settings });
  if (remote.timer === undefined && local.timer !== null) entries.push({ type: 'timer', snapshot: local.timer });
  local.tasks.forEach((task, position) => {
    if (!remoteTasks.has(task.id)) entries.push({ type: 'task', task, position });
  });
  for (const log of Object.values(local.logs)) {
    for (const session of log.sessions) {
      if (!remoteSessions.has(session.id)) entries.push({ type: 'session', date: log.date, session });
    }
  }
  return entries;
}
