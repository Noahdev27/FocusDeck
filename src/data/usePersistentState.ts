import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData, CollectionKey } from './repository';
import { useRepository } from './RepositoryContext';

type SetValue<T> = (value: T | ((previous: T) => T)) => void;

/**
 * État React adossé à une collection du repository :
 * - valeur initiale lue de façon synchrone (pas d'écran de chargement) ;
 * - chaque changement local est écrit de manière asynchrone (UI optimiste) ;
 * - les changements venus d'ailleurs (autre onglet, serveur) remplacent l'état
 *   sans être réécrits.
 */
export function usePersistentState<K extends CollectionKey>(key: K): [AppData[K], SetValue<AppData[K]>] {
  const repository = useRepository();
  const [value, setValue] = useState<AppData[K]>(() => repository.read(key));
  // Valeur reçue d'ailleurs : ne pas la renvoyer au repository.
  const skipNextWrite = useRef(true);

  useEffect(() => {
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    repository.write(key, value).catch((error: unknown) => {
      console.warn(`[FocusDeck] Impossible d'enregistrer « ${key} »`, error);
    });
  }, [repository, key, value]);

  useEffect(
    () =>
      repository.subscribe((change) => {
        if (change.key !== key) return;
        skipNextWrite.current = true;
        setValue(change.value as AppData[K]);
      }),
    [repository, key],
  );

  const update = useCallback<SetValue<AppData[K]>>((next) => {
    setValue((previous) =>
      typeof next === 'function' ? (next as (prev: AppData[K]) => AppData[K])(previous) : next,
    );
  }, []);

  return [value, update];
}
