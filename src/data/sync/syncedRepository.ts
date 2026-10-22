import { STORAGE_PREFIX } from '../../utils/constants';
import { toDateKey } from '../../utils/format';
import type { AppData, FocusRepository, RepositoryChange } from '../repository';
import { mergeRemote, localOnlyEntries } from './merge';
import { acknowledge, diffLogs, diffProjects, diffSettings, diffTasks, diffTimer, enqueue, sanitizeOutbox } from './outbox';
import type { RemoteStore, SyncStatus } from './types';

const SYNC_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 60_000;

export interface SyncedRepository extends FocusRepository {
  /** Envoie la file puis récupère les changements serveur. */
  syncNow(): Promise<void>;
  getStatus(): SyncStatus;
  subscribeStatus(listener: (status: SyncStatus) => void): () => void;
  /** Démarre la synchronisation automatique (réseau retrouvé, intervalle, Realtime). */
  start(): void;
  dispose(): void;
}

/** Clé de la file ou du curseur de synchronisation d'un utilisateur. */
export function syncStorageKey(userId: string, name: 'outbox' | 'cursor'): string {
  return `${STORAGE_PREFIX}:sync:${userId}:${name}`;
}

export interface SyncedRepositoryOptions {
  /** Cache local (hors ligne d'abord) : toutes les lectures passent par lui. */
  local: FocusRepository;
  remote: RemoteStore;
  /** Stockage de la file d'attente et du curseur (par utilisateur). */
  storage: Storage;
  userId: string;
  isOnline?: () => boolean;
  now?: () => number;
  /** Planificateur injectable (tests). */
  setTimer?: (task: () => void, delay: number) => () => void;
}

/**
 * Persistance synchronisée (cahier des charges §6.4) :
 * - écriture locale immédiate, différentiel mis en file persistée ;
 * - envoi au retour du réseau, toutes les 30 s et sur notification Realtime ;
 * - en cas d'échec, nouvel essai avec délai exponentiel (plafonné à 60 s) ;
 * - lecture incrémentale par curseur, fusion « modification locale en attente d'abord ».
 */
export function createSyncedRepository(options: SyncedRepositoryOptions): SyncedRepository {
  const { local, remote, storage, userId } = options;
  const isOnline = options.isOnline ?? (() => navigator.onLine);
  const now = options.now ?? Date.now;
  const setTimer =
    options.setTimer ??
    ((task: () => void, delay: number) => {
      const id = window.setTimeout(task, delay);
      return () => window.clearTimeout(id);
    });

  const outboxKey = syncStorageKey(userId, 'outbox');
  const cursorKey = syncStorageKey(userId, 'cursor');

  const readJson = (key: string): unknown => {
    try {
      const raw = storage.getItem(key);
      return raw === null ? undefined : (JSON.parse(raw) as unknown);
    } catch {
      return undefined;
    }
  };

  let outbox = sanitizeOutbox(readJson(outboxKey));
  let cursor = typeof readJson(cursorKey) === 'string' ? (readJson(cursorKey) as string) : null;
  let status: SyncStatus = { state: outbox.length > 0 ? 'pending' : 'synced', pending: outbox.length, lastSyncedAt: null };
  let failures = 0;
  let running: Promise<void> | null = null;
  let rerun = false;
  const listeners = new Set<(change: RepositoryChange) => void>();
  const statusListeners = new Set<(status: SyncStatus) => void>();
  const cleanups: (() => void)[] = [];
  let cancelRetry: (() => void) | null = null;
  let cancelTick: (() => void) | null = null;

  const setStatus = (patch: Partial<SyncStatus>) => {
    status = { ...status, ...patch, pending: outbox.length };
    for (const listener of statusListeners) listener(status);
  };

  const saveOutbox = () => storage.setItem(outboxKey, JSON.stringify(outbox));
  const readAll = (): AppData => ({
    settings: local.read('settings'),
    tasks: local.read('tasks'),
    projects: local.read('projects'),
    logs: local.read('logs'),
    timer: local.read('timer'),
  });

  const applyPull = async (pull: Awaited<ReturnType<RemoteStore['pull']>>, bootstrap: boolean) => {
    const current = readAll();
    if (bootstrap) {
      outbox = enqueue(outbox, localOnlyEntries(current, pull));
      saveOutbox();
    }
    const { data, changed } = mergeRemote(current, pull, outbox, toDateKey(now()));
    for (const key of changed) {
      await local.write(key, data[key] as never);
      const change = { key, value: data[key] } as RepositoryChange;
      for (const listener of listeners) listener(change);
    }
    cursor = pull.cursor;
    storage.setItem(cursorKey, JSON.stringify(cursor));
  };

  const runSync = async () => {
    if (!isOnline()) {
      setStatus({ state: 'offline' });
      return;
    }
    setStatus({ state: 'syncing' });
    try {
      const bootstrap = cursor === null;
      if (bootstrap) await applyPull(await remote.pull(null), true);
      const batch = [...outbox];
      if (batch.length > 0) {
        await remote.push(batch);
        outbox = acknowledge(outbox, batch);
        saveOutbox();
      }
      await applyPull(await remote.pull(cursor), false);
      failures = 0;
      setStatus({ state: outbox.length > 0 ? 'pending' : 'synced', lastSyncedAt: now() });
    } catch (error) {
      failures += 1;
      setStatus({ state: isOnline() ? 'error' : 'offline' });
      const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (failures - 1));
      cancelRetry?.();
      cancelRetry = setTimer(() => void syncNow(), delay);
      console.warn('[FocusDeck] Synchronisation en échec, nouvel essai dans', delay, 'ms', error);
    }
  };

  const diff = <K extends keyof AppData>(key: K, previous: AppData[K], next: AppData[K]) => {
    switch (key) {
      case 'settings':
        return diffSettings(previous as AppData['settings'], next as AppData['settings']);
      case 'tasks':
        return diffTasks(previous as AppData['tasks'], next as AppData['tasks']);
      case 'projects':
        return diffProjects(previous as AppData['projects'], next as AppData['projects']);
      case 'logs':
        return diffLogs(previous as AppData['logs'], next as AppData['logs'], toDateKey(now()));
      default:
        return diffTimer(previous as AppData['timer'], next as AppData['timer']);
    }
  };

  // Une seule synchronisation à la fois ; une demande pendant l'exécution en relance une.
  // - Le travail démarre après un tour de microtâche : `running` est donc assigné avant
  //   tout appel susceptible de rappeler `syncNow` de façon synchrone (réentrance).
  // - `running` est libéré dans le même enchaînement que la sortie de boucle : aucune
  //   demande ne peut tomber entre les deux (elle serait perdue jusqu'au prochain intervalle).
  const syncNow = (): Promise<void> => {
    if (running) {
      rerun = true;
      return running;
    }
    running = (async () => {
      await Promise.resolve();
      try {
        do {
          rerun = false;
          await runSync();
        } while (rerun);
      } finally {
        running = null;
      }
    })();
    return running;
  };

  return {
    mode: 'synced',
    read: (key) => local.read(key),

    async write(key, value) {
      const previous = local.read(key);
      await local.write(key, value);
      const entries = diff(key, previous, value);
      if (entries.length === 0) return;
      outbox = enqueue(outbox, entries);
      saveOutbox();
      setStatus({ state: isOnline() ? 'pending' : 'offline' });
      void syncNow();
    },

    listDays: (from, to) => local.listDays(from, to),

    subscribe(listener) {
      listeners.add(listener);
      const unsubscribeLocal = local.subscribe(listener);
      return () => {
        listeners.delete(listener);
        unsubscribeLocal();
      };
    },

    syncNow,
    getStatus: () => status,
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },

    start() {
      const onOnline = () => void syncNow();
      const onOffline = () => setStatus({ state: 'offline' });
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      cleanups.push(() => window.removeEventListener('online', onOnline));
      cleanups.push(() => window.removeEventListener('offline', onOffline));
      const tick = () => {
        void syncNow();
        cancelTick = setTimer(tick, SYNC_INTERVAL_MS);
      };
      cleanups.push(() => cancelTick?.());
      cleanups.push(remote.subscribe(() => void syncNow()));
      tick();
    },

    /** Arrête la synchronisation automatique (les abonnés retirent eux-mêmes leurs écouteurs). */
    dispose() {
      cancelRetry?.();
      for (const cleanup of cleanups.splice(0)) cleanup();
    },
  };
}

