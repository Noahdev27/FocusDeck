import type { Project, SessionRecord, Task, TimerSettings, TimerSnapshot } from '../../types';
import type { OutboxEntry, RemotePull, RemoteStore } from './types';

interface Versioned<T> {
  value: T;
  version: number;
}

/** Serveur en mémoire partagé par plusieurs « appareils » (tests et démonstration). */
export interface MemoryServer {
  clock: number;
  settings: Versioned<TimerSettings> | null;
  timer: Versioned<TimerSnapshot | null> | null;
  projects: Map<string, Versioned<Project>>;
  tasks: Map<string, Versioned<{ task: Task; position: number; deleted: boolean }>>;
  sessions: Map<string, Versioned<{ date: string; session: SessionRecord; deleted: boolean }>>;
  listeners: Set<() => void>;
}

export function createMemoryServer(): MemoryServer {
  return { clock: 0, settings: null, timer: null, projects: new Map(), tasks: new Map(), sessions: new Map(), listeners: new Set() };
}

export interface MemoryRemote extends RemoteStore {
  /** Simule une coupure réseau : les appels échouent. */
  setReachable(reachable: boolean): void;
  pushes: number;
}

export function createMemoryRemote(server: MemoryServer): MemoryRemote {
  let reachable = true;
  const ensureReachable = () => {
    if (!reachable) throw new TypeError('Failed to fetch');
  };

  const remote: MemoryRemote = {
    pushes: 0,
    setReachable(value) {
      reachable = value;
    },

    async pull(cursor) {
      ensureReachable();
      const since = cursor === null ? -1 : Number(cursor);
      const result: RemotePull = { projects: [], tasks: [], sessions: [], cursor: String(server.clock) };
      if (server.settings && server.settings.version > since) result.settings = server.settings.value;
      if (server.timer && server.timer.version > since) result.timer = server.timer.value;
      for (const { value, version } of server.projects.values()) if (version > since) result.projects.push(value);
      for (const { value, version } of server.tasks.values()) if (version > since) result.tasks.push(value);
      for (const { value, version } of server.sessions.values()) if (version > since) result.sessions.push(value);
      return structuredClone(result);
    },

    async push(entries: OutboxEntry[]) {
      ensureReachable();
      remote.pushes += 1;
      for (const entry of structuredClone(entries)) {
        const version = ++server.clock;
        switch (entry.type) {
          case 'settings':
            server.settings = { value: entry.settings, version };
            break;
          case 'timer':
            server.timer = { value: entry.snapshot, version };
            break;
          case 'project':
            server.projects.set(entry.project.id, { value: entry.project, version });
            break;
          case 'task':
            server.tasks.set(entry.task.id, { value: { task: entry.task, position: entry.position, deleted: false }, version });
            break;
          case 'task-delete': {
            const existing = server.tasks.get(entry.id);
            if (existing) server.tasks.set(entry.id, { value: { ...existing.value, deleted: true }, version });
            break;
          }
          case 'session':
            // Identifiant déterministe : une même phase n'est enregistrée qu'une fois.
            if (!server.sessions.has(entry.session.id)) {
              server.sessions.set(entry.session.id, { value: { date: entry.date, session: entry.session, deleted: false }, version });
            }
            break;
          case 'session-delete': {
            const existing = server.sessions.get(entry.id);
            if (existing) server.sessions.set(entry.id, { value: { ...existing.value, deleted: true }, version });
            break;
          }
        }
      }
      // Comme un vrai serveur temps réel, la notification arrive après la réponse.
      queueMicrotask(() => {
        for (const listener of server.listeners) listener();
      });
    },

    subscribe(onChange) {
      server.listeners.add(onChange);
      return () => server.listeners.delete(onChange);
    },
  };
  return remote;
}
