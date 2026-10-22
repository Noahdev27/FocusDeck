import { STORAGE_KEYS } from '../utils/constants';
import { migrateStorage, parseStored, SANITIZERS } from './migrations';
import type { AppData, CollectionKey, FocusRepository, RepositoryChange } from './repository';

const KEYS = Object.keys(SANITIZERS) as CollectionKey[];

/**
 * Persistance dans `localStorage` (mode sans compte) : clés `focusdeck:v2:*`, JSON,
 * validation à chaque lecture. Les données d'une version antérieure sont migrées à la
 * création (`migrateStorage`). Les autres onglets sont suivis via l'événement `storage`.
 */
export function createLocalRepository(
  storage: Storage = window.localStorage,
  events: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
): FocusRepository {
  migrateStorage(storage);

  const read = <K extends CollectionKey>(key: K): AppData[K] => {
    let raw: string | null = null;
    try {
      raw = storage.getItem(STORAGE_KEYS[key]);
    } catch {
      // Stockage inaccessible (mode privé strict, quotas…).
    }
    return SANITIZERS[key](parseStored(raw));
  };

  return {
    mode: 'local',
    read,

    async write(key, value) {
      if (value === null) storage.removeItem(STORAGE_KEYS[key]);
      else storage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
    },

    async listDays(from, to) {
      return Object.values(read('logs'))
        .filter((log) => log.date >= from && log.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date));
    },

    subscribe(listener) {
      const onStorage = (event: StorageEvent) => {
        if (event.storageArea !== storage) return;
        const key = KEYS.find((candidate) => STORAGE_KEYS[candidate] === event.key);
        if (!key) return;
        listener({ key, value: read(key) } as RepositoryChange);
      };
      events.addEventListener('storage', onStorage);
      return () => events.removeEventListener('storage', onStorage);
    },
  };
}
