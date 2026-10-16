import type { DayLog, Task, TimerSettings, TimerSnapshot } from '../types';

/** Ensemble des données persistées de l'application. */
export interface AppData {
  settings: TimerSettings;
  tasks: Task[];
  /** Journal des sessions par jour (`YYYY-MM-DD`). */
  logs: Record<string, DayLog>;
  /** `null` : aucun minuteur enregistré (première visite). */
  timer: TimerSnapshot | null;
}

export type CollectionKey = keyof AppData;

/** Changement reçu d'une autre source (autre onglet, serveur…). */
export type RepositoryChange = { [K in CollectionKey]: { key: K; value: AppData[K] } }[CollectionKey];

/**
 * Point d'accès unique à la persistance (cahier des charges §6.2).
 *
 * Écart assumé avec l'esquisse du cahier des charges : on écrit des collections
 * entières plutôt que des opérations unitaires (`upsertTasks`, `appendSession`…).
 * L'état React reste ainsi la seule source de vérité côté UI, et une
 * implémentation distante (`SyncedRepository`, lot L2) calculera elle-même le
 * différentiel par rapport à son cache pour n'envoyer que les changements.
 */
export interface FocusRepository {
  readonly mode: 'local' | 'synced';
  /**
   * Lecture synchrone depuis le cache local : l'application démarre sans écran
   * de chargement et fonctionne hors ligne. Les valeurs sont toujours validées.
   */
  read<K extends CollectionKey>(key: K): AppData[K];
  /** Écriture asynchrone ; l'UI a déjà été mise à jour (optimiste). */
  write<K extends CollectionKey>(key: K, value: AppData[K]): Promise<void>;
  /** Journaux des jours compris entre `from` et `to` inclus, triés par date. */
  listDays(from: string, to: string): Promise<DayLog[]>;
  /** Notifie les changements venus d'ailleurs. Retourne la fonction de désabonnement. */
  subscribe(listener: (change: RepositoryChange) => void): () => void;
}
