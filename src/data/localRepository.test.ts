import { describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../utils/constants';
import { createLocalRepository } from './localRepository';
import { MemoryStorage } from './memoryStorage';
import { describeRepositoryContract } from './repositoryContract';

/** Deux « onglets » partageant le même stockage et le même bus d'événements. */
function createHarness() {
  const storage = new MemoryStorage();
  const events = new EventTarget();
  const repository = createLocalRepository(storage, events);
  const otherTab = createLocalRepository(storage, new EventTarget());
  const dispatch = (key: string) =>
    events.dispatchEvent(Object.assign(new Event('storage'), { key, storageArea: storage }));
  return { storage, events, repository, otherTab, dispatch };
}

describeRepositoryContract('LocalRepository', () => {
  const { storage, repository, otherTab, dispatch } = createHarness();
  return {
    repository,
    remoteWrite: async (key, value) => {
      await otherTab.write(key, value);
      dispatch(STORAGE_KEYS[key]);
    },
    writeRaw: (key, raw) => storage.setItem(STORAGE_KEYS[key], raw),
  };
});

describe('LocalRepository — spécificités', () => {
  it('ignore les événements d’un autre stockage ou d’une clé inconnue', () => {
    const { repository, events } = createHarness();
    const listener = vi.fn();
    repository.subscribe(listener);
    events.dispatchEvent(Object.assign(new Event('storage'), { key: STORAGE_KEYS.tasks, storageArea: new MemoryStorage() }));
    events.dispatchEvent(Object.assign(new Event('storage'), { key: 'autre:cle', storageArea: undefined }));
    expect(listener).not.toHaveBeenCalled();
  });

  it('survit à un stockage inaccessible en lecture', () => {
    const storage = new MemoryStorage();
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    const repository = createLocalRepository(storage, new EventTarget());
    expect(repository.read('tasks')).toEqual([]);
  });

  it('rejette l’écriture quand le quota est dépassé', async () => {
    const storage = new MemoryStorage();
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const repository = createLocalRepository(storage, new EventTarget());
    await expect(repository.write('tasks', [])).rejects.toThrow();
  });
});
