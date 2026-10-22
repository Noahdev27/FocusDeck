import type { Project, SessionRecord, Task, TimerSettings, TimerSnapshot } from '../../types';

/** Modification locale en attente d'envoi au serveur. */
export type OutboxEntry =
  | { type: 'settings'; settings: TimerSettings }
  | { type: 'timer'; snapshot: TimerSnapshot | null }
  | { type: 'project'; project: Project }
  | { type: 'task'; task: Task; position: number }
  | { type: 'task-delete'; id: string }
  | { type: 'session'; date: string; session: SessionRecord }
  | { type: 'session-delete'; id: string };

export interface RemoteTask {
  task: Task;
  position: number;
  deleted: boolean;
}

export interface RemoteSession {
  date: string;
  session: SessionRecord;
  deleted: boolean;
}

/** Changements serveur depuis un curseur (`null` = tout l'historique). */
export interface RemotePull {
  /** Présent seulement s'il a changé depuis le curseur. */
  settings?: TimerSettings;
  timer?: TimerSnapshot | null;
  /** Projets modifiés (jamais supprimés : on les archive). */
  projects: Project[];
  tasks: RemoteTask[];
  sessions: RemoteSession[];
  /** Curseur à réutiliser pour la prochaine lecture incrémentale. */
  cursor: string | null;
}

/** Accès au serveur (Supabase en production, implémentation mémoire en test). */
export interface RemoteStore {
  pull(cursor: string | null): Promise<RemotePull>;
  push(entries: OutboxEntry[]): Promise<void>;
  /** Prévient d'un changement côté serveur (Realtime). */
  subscribe(onChange: () => void): () => void;
}

export type SyncState = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

export interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSyncedAt: number | null;
}
