import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { createLocalRepository } from './localRepository';
import type { FocusRepository } from './repository';
import { createSupabaseRemote } from './supabase/supabaseRemote';
import { createSyncedRepository, type SyncedRepository } from './sync/syncedRepository';
import type { SyncStatus } from './sync/types';

interface RepositoryEntry {
  /** Change à chaque bascule local ↔ compte : les contextes se remontent et relisent le cache. */
  key: string;
  repository: FocusRepository;
  synced: SyncedRepository | null;
}

const RepositoryContext = createContext<RepositoryEntry | null>(null);

/**
 * Injecte la persistance : locale sans compte (EF-C01), synchronisée une fois connecté
 * (EF-C02 à C05). Le cache local reste la source des lectures dans les deux cas.
 */
export function RepositoryProvider({ repository, children }: { repository?: FocusRepository; children: ReactNode }) {
  const { state, client } = useAuth();
  const userId = state.status === 'signed-in' ? state.user.id : null;
  const [local] = useState(() => repository ?? createLocalRepository());

  // Création pure (lecture de la file persistée) ; le démarrage passe par l'effet ci-dessous.
  const synced = useMemo(
    () =>
      !repository && userId && client
        ? createSyncedRepository({ local, remote: createSupabaseRemote(client, userId), storage: window.localStorage, userId })
        : null,
    [repository, userId, client, local],
  );

  useEffect(() => {
    if (!synced) return;
    synced.start();
    return () => synced.dispose();
  }, [synced]);

  const entry = useMemo<RepositoryEntry>(
    () => (synced && userId ? { key: `user:${userId}`, repository: synced, synced } : { key: 'local', repository: local, synced: null }),
    [synced, userId, local],
  );

  return (
    <RepositoryContext.Provider value={entry} key={entry.key}>
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepository(): FocusRepository {
  const entry = useContext(RepositoryContext);
  if (!entry) throw new Error('useRepository doit être utilisé dans un <RepositoryProvider>.');
  return entry.repository;
}

const noopSubscribe = () => () => undefined;
const noStatus = () => null;

/** Statut de synchronisation (`null` en mode local). */
export function useSyncStatus(): { status: SyncStatus | null; syncNow: (() => Promise<void>) | null } {
  const synced = useContext(RepositoryContext)?.synced ?? null;
  const status = useSyncExternalStore(
    synced ? (listener) => synced.subscribeStatus(listener) : noopSubscribe,
    synced ? () => synced.getStatus() : noStatus,
  );
  return { status, syncNow: synced ? () => synced.syncNow() : null };
}
