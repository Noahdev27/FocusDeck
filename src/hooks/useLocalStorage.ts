import { useCallback, useEffect, useRef, useState } from 'react';

type SetValue<T> = (value: T | ((previous: T) => T)) => void;

function readStorage<T>(key: string, sanitize: (raw: unknown) => T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return sanitize(raw === null ? undefined : (JSON.parse(raw) as unknown));
  } catch {
    // JSON invalide ou stockage inaccessible (mode privé, quotas…).
    return sanitize(undefined);
  }
}

/**
 * État React persisté dans `localStorage`.
 *
 * - Les données lues sont toujours validées via `sanitize` (jamais de cast aveugle).
 * - Les écritures échouées (quota, mode privé) n'interrompent pas l'application.
 * - Synchronisation automatique entre onglets via l'événement `storage`.
 */
export function useLocalStorage<T>(key: string, sanitize: (raw: unknown) => T): [T, SetValue<T>] {
  const sanitizeRef = useRef(sanitize);
  useEffect(() => {
    sanitizeRef.current = sanitize;
  }, [sanitize]);

  const [value, setValue] = useState<T>(() => readStorage(key, sanitize));
  // Évite de réécrire une valeur qui vient d'être reçue d'un autre onglet.
  const skipNextWrite = useRef(false);

  useEffect(() => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`[FocusDeck] Impossible d'enregistrer « ${key} »`, error);
    }
  }, [key, value]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== key) return;
      skipNextWrite.current = true;
      setValue(readStorage(key, sanitizeRef.current));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const update = useCallback<SetValue<T>>((next) => {
    setValue((previous) => (typeof next === 'function' ? (next as (prev: T) => T)(previous) : next));
  }, []);

  return [value, update];
}
