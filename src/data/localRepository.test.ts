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
  // Données réelles produites par la v0.1 (format focusdeck:v1).
  const V01_DATA: Record<string, string> = {
    'focusdeck:v1:settings':
      '{"focusMinutes":25,"shortBreakMinutes":5,"longBreakMinutes":15,"longBreakInterval":4,"volume":0.6,"autoStartBreaks":false,"autoStartFocus":false,"soundEnabled":true,"notificationsEnabled":false}',
    'focusdeck:v1:tasks':
      '[{"id":"6f1c2a9e-7d1b-4c2e-9b1a-3e5f7a9c1d2b","title":"Envoyer la facture","completed":false,"createdAt":1792166400000,"completedAt":null},{"id":"0a7e3c5b-2f4d-4a6e-8c1b-9d2e4f6a8b0c","title":"Écrire le brief client","completed":true,"createdAt":1792166300000,"completedAt":1792168200000}]',
    'focusdeck:v1:logs':
      '{"2026-10-16":{"date":"2026-10-16","sessions":[{"mode":"focus","startedAt":1792166500000,"endedAt":1792168000000,"durationSeconds":1500,"completed":true,"id":"c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e1f"}]}}',
    'focusdeck:v1:timer':
      '{"mode":"shortBreak","status":"idle","remainingMs":300000,"endsAt":null,"durationMs":300000,"startedAt":null,"cyclesInSet":1}',
  };

  // Réglages ajoutés depuis la v0.1 : ils prennent leur valeur par défaut, sans changement
  // de version du format (ajout compatible).
  const ADDED_SETTINGS = { analyticsEnabled: true };
  const expected = (key: string): unknown => {
    const parsed: unknown = JSON.parse(V01_DATA[key] ?? 'null');
    return key === STORAGE_KEYS.settings ? { ...(parsed as object), ...ADDED_SETTINGS } : parsed;
  };

  it('migration nulle : relit les données v0.1 sans perte et les réécrit à l’identique', async () => {
    const { storage, repository } = createHarness();
    for (const [key, raw] of Object.entries(V01_DATA)) storage.setItem(key, raw);

    for (const key of ['settings', 'tasks', 'logs', 'timer'] as const) {
      const value = repository.read(key);
      expect(value).toEqual(expected(STORAGE_KEYS[key]));
      await repository.write(key, value as never);
    }
    for (const key of Object.keys(V01_DATA)) {
      expect(JSON.parse(storage.getItem(key) ?? 'null')).toEqual(expected(key));
    }
  });

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
