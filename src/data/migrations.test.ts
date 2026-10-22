import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../utils/constants';
import { createLocalRepository } from './localRepository';
import { MemoryStorage } from './memoryStorage';
import { MIGRATION_MARKER, migrateStorage } from './migrations';

// Données réelles produites par la v0.1 (format focusdeck:v1), copiées d'un navigateur.
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

const V2_FIELDS = { projectId: null, estimate: null, plannedFor: null };

const seed = (data: Record<string, string> = V01_DATA) => {
  const storage = new MemoryStorage();
  for (const [key, raw] of Object.entries(data)) storage.setItem(key, raw);
  return storage;
};

describe('Migration du stockage local v1 → v2', () => {
  it('un utilisateur v0.1 retrouve toutes ses données, complétées des champs v2', () => {
    const storage = seed();
    const repository = createLocalRepository(storage, new EventTarget());

    expect(repository.read('settings')).toEqual({ ...DEFAULT_SETTINGS, ...JSON.parse(V01_DATA['focusdeck:v1:settings'] ?? '{}') });
    expect(repository.read('tasks')).toEqual(
      (JSON.parse(V01_DATA['focusdeck:v1:tasks'] ?? '[]') as object[]).map((task) => ({ ...task, ...V2_FIELDS })),
    );
    expect(repository.read('logs')['2026-10-16']?.sessions).toEqual([
      {
        id: 'c3d5e7f9-1a2b-4c6d-8e0f-2a4b6c8d0e1f',
        mode: 'focus',
        startedAt: 1792166500000,
        endedAt: 1792168000000,
        durationSeconds: 1500,
        completed: true,
        taskId: null,
      },
    ]);
    expect(repository.read('timer')).toEqual({ ...JSON.parse(V01_DATA['focusdeck:v1:timer'] ?? '{}'), taskId: null });
    expect(repository.read('projects')).toEqual([]);
  });

  it('écrit le format v2, conserve les clés v1 (retour arrière) et pose le marqueur', () => {
    const storage = seed();
    migrateStorage(storage);
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.tasks) ?? '[]')).toEqual([
      expect.objectContaining({ title: 'Envoyer la facture', ...V2_FIELDS }),
      expect.objectContaining({ title: 'Écrire le brief client', completed: true, ...V2_FIELDS }),
    ]);
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.timer) ?? 'null')).toMatchObject({ mode: 'shortBreak', taskId: null });
    expect(storage.getItem(STORAGE_KEYS.projects)).toBeNull();
    for (const [key, raw] of Object.entries(V01_DATA)) expect(storage.getItem(key)).toBe(raw);
    expect(storage.getItem(MIGRATION_MARKER)).toBe('1');
  });

  it('ne réimporte pas d’anciennes données après une suppression en v2', async () => {
    const storage = seed();
    const repository = createLocalRepository(storage, new EventTarget());
    await repository.write('timer', null);
    await repository.write('tasks', []);
    const reopened = createLocalRepository(storage, new EventTarget());
    expect(reopened.read('timer')).toBeNull();
    expect(reopened.read('tasks')).toEqual([]);
  });

  it('recopie la file de synchronisation et n’écrase jamais une donnée v2', () => {
    const storage = seed({
      ...V01_DATA,
      'focusdeck:v1:sync:u1:outbox': '[{"type":"task-delete","id":"x"}]',
      'focusdeck:v1:sync:u1:cursor': '"2026-10-16T10:00:00.000Z"',
      [STORAGE_KEYS.tasks]: '[]',
      'autre:application': 'intacte',
    });
    migrateStorage(storage);
    expect(storage.getItem('focusdeck:v2:sync:u1:outbox')).toBe('[{"type":"task-delete","id":"x"}]');
    expect(storage.getItem('focusdeck:v2:sync:u1:cursor')).toBe('"2026-10-16T10:00:00.000Z"');
    expect(storage.getItem(STORAGE_KEYS.tasks)).toBe('[]');
    expect(storage.getItem('focusdeck:v2:application')).toBeNull();
  });

  it('première visite : rien à migrer, seul le marqueur est posé', () => {
    const storage = new MemoryStorage();
    migrateStorage(storage);
    expect(storage.length).toBe(1);
    expect(storage.getItem(MIGRATION_MARKER)).toBe('1');
  });

  it('stockage plein : l’application démarre et retentera au prochain chargement', () => {
    const storage = seed();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => createLocalRepository(storage, new EventTarget())).not.toThrow();
    expect(storage.getItem(MIGRATION_MARKER)).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
