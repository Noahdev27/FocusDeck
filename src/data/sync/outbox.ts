import type { DayLog, SessionRecord, Task, TimerSettings, TimerSnapshot } from '../../types';
import { LOG_RETENTION_DAYS } from '../../utils/constants';
import { deepEqual } from '../../utils/equal';
import { fromDateKey } from '../../utils/format';
import { sanitizeLogs, sanitizeSettings, sanitizeTasks, sanitizeTimerSnapshot } from '../../utils/validation';
import type { OutboxEntry } from './types';

/** Clé de regroupement : seule la dernière modification d'un même objet est envoyée. */
export function entryKey(entry: OutboxEntry): string {
  switch (entry.type) {
    case 'settings':
    case 'timer':
      return entry.type;
    case 'task':
      return `task:${entry.task.id}`;
    case 'task-delete':
      return `task:${entry.id}`;
    case 'session':
      return `session:${entry.session.id}`;
    case 'session-delete':
      return `session:${entry.id}`;
  }
}

/** Ajoute des entrées à la file en remplaçant les versions précédentes du même objet. */
export function enqueue(outbox: readonly OutboxEntry[], entries: readonly OutboxEntry[]): OutboxEntry[] {
  const merged = new Map(outbox.map((entry) => [entryKey(entry), entry]));
  for (const entry of entries) {
    const key = entryKey(entry);
    merged.delete(key); // la version la plus récente passe en fin de file
    merged.set(key, entry);
  }
  return [...merged.values()];
}

/** Retire de la file les entrées envoyées, sauf si elles ont été modifiées entre-temps. */
export function acknowledge(outbox: readonly OutboxEntry[], sent: readonly OutboxEntry[]): OutboxEntry[] {
  const sentSet = new Set(sent);
  return outbox.filter((entry) => !sentSet.has(entry));
}

const same = deepEqual;

export function diffSettings(previous: TimerSettings, next: TimerSettings): OutboxEntry[] {
  return same(previous, next) ? [] : [{ type: 'settings', settings: next }];
}

export function diffTimer(previous: TimerSnapshot | null, next: TimerSnapshot | null): OutboxEntry[] {
  return same(previous, next) ? [] : [{ type: 'timer', snapshot: next }];
}

/** Tâches ajoutées, modifiées ou déplacées → upsert ; tâches retirées → suppression. */
export function diffTasks(previous: readonly Task[], next: readonly Task[]): OutboxEntry[] {
  const before = new Map(previous.map((task, index) => [task.id, { task, index }]));
  const entries: OutboxEntry[] = [];
  next.forEach((task, position) => {
    const old = before.get(task.id);
    if (!old || old.index !== position || !same(old.task, task)) entries.push({ type: 'task', task, position });
    before.delete(task.id);
  });
  for (const id of before.keys()) entries.push({ type: 'task-delete', id });
  return entries;
}

/**
 * Sessions ajoutées → upsert ; sessions retirées → suppression, sauf pour les jours sortis
 * de la fenêtre de rétention locale : l'élagage du cache ne doit pas effacer l'historique
 * conservé sur le serveur.
 */
export function diffLogs(
  previous: Record<string, DayLog>,
  next: Record<string, DayLog>,
  today: string,
  retentionDays: number = LOG_RETENTION_DAYS,
): OutboxEntry[] {
  const index = (logs: Record<string, DayLog>) => {
    const map = new Map<string, { date: string; session: SessionRecord }>();
    for (const log of Object.values(logs)) for (const session of log.sessions) map.set(session.id, { date: log.date, session });
    return map;
  };
  const before = index(previous);
  const after = index(next);
  const limit = fromDateKey(today).getTime() - retentionDays * 86_400_000;
  const entries: OutboxEntry[] = [];
  for (const [id, item] of after) {
    const old = before.get(id);
    if (!old || !same(old.session, item.session)) entries.push({ type: 'session', date: item.date, session: item.session });
  }
  for (const [id, item] of before) {
    if (!after.has(id) && fromDateKey(item.date).getTime() >= limit) entries.push({ type: 'session-delete', id });
  }
  return entries;
}

/** Relit une file persistée (donnée externe) en écartant toute entrée invalide. */
export function sanitizeOutbox(input: unknown): OutboxEntry[] {
  if (!Array.isArray(input)) return [];
  const entries: OutboxEntry[] = [];
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) continue;
    const entry = raw as Record<string, unknown>;
    switch (entry.type) {
      case 'settings':
        entries.push({ type: 'settings', settings: sanitizeSettings(entry.settings) });
        break;
      case 'timer':
        entries.push({ type: 'timer', snapshot: sanitizeTimerSnapshot(entry.snapshot) });
        break;
      case 'task': {
        const [task] = sanitizeTasks([entry.task]);
        if (task && typeof entry.position === 'number') entries.push({ type: 'task', task, position: entry.position });
        break;
      }
      case 'session': {
        if (typeof entry.date !== 'string') break;
        const session = sanitizeLogs({ [entry.date]: { sessions: [entry.session] } })[entry.date]?.sessions[0];
        if (session) entries.push({ type: 'session', date: entry.date, session });
        break;
      }
      case 'task-delete':
      case 'session-delete':
        if (typeof entry.id === 'string') entries.push({ type: entry.type, id: entry.id });
        break;
    }
  }
  return entries;
}
