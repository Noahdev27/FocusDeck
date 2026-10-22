import { LEGACY_STORAGE_PREFIX, STORAGE_KEYS, STORAGE_PREFIX } from '../utils/constants';
import { sanitizeLogs, sanitizeProjects, sanitizeSettings, sanitizeTasks, sanitizeTimerSnapshot } from '../utils/validation';
import type { AppData, CollectionKey } from './repository';

export const SANITIZERS: { [K in CollectionKey]: (raw: unknown) => AppData[K] } = {
  settings: sanitizeSettings,
  tasks: sanitizeTasks,
  projects: sanitizeProjects,
  logs: sanitizeLogs,
  timer: sanitizeTimerSnapshot,
};

/** Présent une fois la migration vers le format courant effectuée sur ce navigateur. */
export const MIGRATION_MARKER = `${STORAGE_PREFIX}:migrated`;

export function parseStored(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    // JSON invalide (données corrompues) : le sanitizer retombera sur les valeurs par défaut.
    return undefined;
  }
}

const listKeys = (storage: Storage): string[] =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => key !== null);

/**
 * Migration du stockage local v1 (v0.1 à L2) → v2 (lot L4), exécutée une seule fois :
 * - chaque collection v1 est relue, validée puis réécrite au format v2 : les nouveaux champs
 *   (projet, estimation, jour prévu, tâche des sessions et du minuteur) prennent leur valeur
 *   neutre, rien n'est perdu ;
 * - les autres clés v1 (file et curseur de synchronisation) sont recopiées telles quelles,
 *   leur contenu étant revalidé à chaque lecture ;
 * - les clés v1 sont conservées : un retour arrière du déploiement retrouve ses données.
 *
 * Le marqueur évite de réimporter d'anciennes données après une suppression en v2
 * (ex. le minuteur, dont la suppression retire la clé).
 */
export function migrateStorage(storage: Storage): void {
  try {
    if (storage.getItem(MIGRATION_MARKER) !== null) return;
    const legacyPrefix = `${LEGACY_STORAGE_PREFIX}:`;
    const collections = new Map<string, CollectionKey>(
      (Object.keys(SANITIZERS) as CollectionKey[]).map((key) => [`${legacyPrefix}${key}`, key] as const),
    );
    for (const legacyKey of listKeys(storage)) {
      if (!legacyKey.startsWith(legacyPrefix)) continue;
      const raw = storage.getItem(legacyKey);
      if (raw === null) continue;
      const collection = collections.get(legacyKey);
      const target: string = collection ? STORAGE_KEYS[collection] : `${STORAGE_PREFIX}:${legacyKey.slice(legacyPrefix.length)}`;
      if (storage.getItem(target) !== null) continue;
      if (!collection) {
        storage.setItem(target, raw);
        continue;
      }
      const value = SANITIZERS[collection](parseStored(raw));
      if (value !== null) storage.setItem(target, JSON.stringify(value));
    }
    storage.setItem(MIGRATION_MARKER, '1');
  } catch (error) {
    // Stockage inaccessible ou plein : l'application démarre avec les valeurs par défaut et
    // retentera la migration au prochain chargement (le marqueur n'est pas posé).
    console.warn('[FocusDeck] Migration du stockage local impossible', error);
  }
}
