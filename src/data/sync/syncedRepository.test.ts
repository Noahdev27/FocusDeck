import { describe, expect, it, vi } from 'vitest';
import type { SessionRecord, Task } from '../../types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../../utils/constants';
import { toDateKey } from '../../utils/format';
import { createLocalRepository } from '../localRepository';
import { MemoryStorage } from '../memoryStorage';
import { describeRepositoryContract } from '../repositoryContract';
import { createMemoryRemote, createMemoryServer, type MemoryServer } from './memoryRemote';
import { createSyncedRepository, syncStorageKey } from './syncedRepository';

const USER = 'user-1';
const NOW = new Date(2026, 9, 16, 10, 0).getTime();
const TODAY = toDateKey(NOW);

const task = (id: string, title = id): Task => ({ id, title, completed: false, createdAt: 1, completedAt: null, projectId: null, estimate: null, plannedFor: null });
const session = (id: string): SessionRecord => ({ id, mode: 'focus', startedAt: NOW - 1_500_000, endedAt: NOW, durationSeconds: 1500, completed: true, taskId: null });

/** Un « appareil » : stockage local propre + accès au serveur partagé. */
function device(server: MemoryServer, storage = new MemoryStorage()) {
  const remote = createMemoryRemote(server);
  let online = true;
  const timers: { task: () => void; delay: number }[] = [];
  const repository = createSyncedRepository({
    local: createLocalRepository(storage, new EventTarget()),
    remote,
    storage,
    userId: USER,
    isOnline: () => online,
    now: () => NOW,
    setTimer: (fn, delay) => {
      const entry = { task: fn, delay };
      timers.push(entry);
      return () => {
        const index = timers.indexOf(entry);
        if (index >= 0) timers.splice(index, 1);
      };
    },
  });
  return {
    repository,
    remote,
    storage,
    timers,
    goOffline: () => {
      online = false;
      remote.setReachable(false);
    },
    goOnline: () => {
      online = true;
      remote.setReachable(true);
    },
  };
}

/** Laisse les écritures asynchrones (et leur synchronisation automatique) se terminer. */
const settle = async (...repositories: { syncNow: () => Promise<void> }[]) => {
  for (const repository of repositories) await repository.syncNow();
};

describeRepositoryContract('SyncedRepository', () => {
  const server = createMemoryServer();
  const self = device(server);
  const other = device(server);
  return {
    repository: self.repository,
    remoteWrite: async (key, value) => {
      await other.repository.write(key, value);
      await settle(other.repository, self.repository);
    },
    writeRaw: (key, raw) => self.storage.setItem(STORAGE_KEYS[key], raw),
  };
});

describe('SyncedRepository — synchronisation', () => {
  it('parcours 6 : hors ligne, puis retour du réseau, données visibles sur un 2ᵉ appareil', async () => {
    const server = createMemoryServer();
    const laptop = device(server);
    const phone = device(server);

    laptop.goOffline();
    await laptop.repository.write('tasks', [task('a', 'Écrire'), task('b', 'Relire')]);
    await laptop.repository.write('tasks', [{ ...task('a', 'Écrire'), completed: true, completedAt: NOW }, task('b', 'Relire')]);
    await settle(laptop.repository);
    expect(laptop.repository.getStatus()).toMatchObject({ state: 'offline', pending: 2 });
    expect(laptop.repository.read('tasks')).toHaveLength(2); // l'UI reste utilisable

    laptop.goOnline();
    await settle(laptop.repository, phone.repository);
    expect(laptop.repository.getStatus()).toMatchObject({ state: 'synced', pending: 0 });
    expect(phone.repository.read('tasks')).toEqual([{ ...task('a', 'Écrire'), completed: true, completedAt: NOW }, task('b', 'Relire')]);
  });

  it('conserve la file d’attente après un redémarrage hors ligne', async () => {
    const server = createMemoryServer();
    const storage = new MemoryStorage();
    const first = device(server, storage);
    first.goOffline();
    await first.repository.write('tasks', [task('persistée')]);
    first.repository.dispose();

    const restarted = device(server, storage);
    expect(restarted.repository.getStatus().pending).toBe(1);
    await settle(restarted.repository);
    expect([...server.tasks.keys()]).toEqual(['persistée']);
  });

  it('EF-C03 : fusionne les données locales à la première connexion, sans doublon à la reconnexion', async () => {
    const server = createMemoryServer();
    // Un autre appareil a déjà des données dans le compte.
    const other = device(server);
    await other.repository.write('tasks', [task('cloud')]);
    await other.repository.write('settings', { ...DEFAULT_SETTINGS, focusMinutes: 50 });
    await settle(other.repository);

    // Cet appareil était utilisé sans compte.
    const storage = new MemoryStorage();
    const anonymous = createLocalRepository(storage, new EventTarget());
    await anonymous.write('tasks', [task('locale')]);
    await anonymous.write('settings', { ...DEFAULT_SETTINGS, focusMinutes: 15 });
    await anonymous.write('logs', { [TODAY]: { date: TODAY, sessions: [session('s1')] } });

    const signedIn = device(server, storage);
    await settle(signedIn.repository);
    expect(signedIn.repository.read('tasks').map((t) => t.id).sort()).toEqual(['cloud', 'locale']);
    // Les réglages du compte priment sur ceux de l'appareil.
    expect(signedIn.repository.read('settings').focusMinutes).toBe(50);
    expect([...server.tasks.keys()].sort()).toEqual(['cloud', 'locale']);
    expect([...server.sessions.keys()]).toEqual(['s1']);

    // Reconnexion depuis le même appareil (curseur oublié) : aucun doublon.
    storage.removeItem(syncStorageKey(USER, 'cursor'));
    const again = device(server, storage);
    await settle(again.repository);
    expect(again.repository.read('tasks')).toHaveLength(2);
    expect(server.tasks.size).toBe(2);
  });

  it('une modification locale en attente l’emporte sur une version serveur reçue entre-temps', async () => {
    const server = createMemoryServer();
    const a = device(server);
    const b = device(server);
    await a.repository.write('tasks', [task('t', 'Version initiale')]);
    await settle(a.repository, b.repository);

    b.goOffline();
    await b.repository.write('tasks', [task('t', 'Version de B (hors ligne)')]);
    await a.repository.write('tasks', [task('t', 'Version de A')]);
    await settle(a.repository);

    b.goOnline();
    await settle(b.repository, a.repository);
    // B a écrit en dernier côté serveur : « dernier écrit gagne », sans perte silencieuse.
    expect(b.repository.read('tasks')[0]?.title).toBe('Version de B (hors ligne)');
    expect(a.repository.read('tasks')[0]?.title).toBe('Version de B (hors ligne)');
  });

  it('propage les suppressions de tâches et de sessions', async () => {
    const server = createMemoryServer();
    const a = device(server);
    const b = device(server);
    await a.repository.write('tasks', [task('x'), task('y')]);
    await a.repository.write('logs', { [TODAY]: { date: TODAY, sessions: [session('s1')] } });
    await settle(a.repository, b.repository);
    expect(b.repository.read('tasks')).toHaveLength(2);

    await a.repository.write('tasks', [task('y')]);
    await a.repository.write('logs', {});
    await settle(a.repository, b.repository);
    expect(b.repository.read('tasks').map((t) => t.id)).toEqual(['y']);
    expect(b.repository.read('logs')[TODAY]?.sessions ?? []).toEqual([]);
  });

  it('EF-T04 : une phase terminée sur deux appareils n’est enregistrée qu’une fois', async () => {
    const server = createMemoryServer();
    const a = device(server);
    const b = device(server);
    const same = session('focus:1792160000000');
    await a.repository.write('logs', { [TODAY]: { date: TODAY, sessions: [same] } });
    await b.repository.write('logs', { [TODAY]: { date: TODAY, sessions: [same] } });
    await settle(a.repository, b.repository, a.repository);
    expect(server.sessions.size).toBe(1);
    expect(a.repository.read('logs')[TODAY]?.sessions).toHaveLength(1);
    expect(b.repository.read('logs')[TODAY]?.sessions).toHaveLength(1);
  });

  it('partage l’état du minuteur entre appareils', async () => {
    const server = createMemoryServer();
    const a = device(server);
    const b = device(server);
    const snapshot = { mode: 'focus' as const, status: 'running' as const, remainingMs: 0, endsAt: NOW + 60_000, durationMs: 1_500_000, startedAt: NOW, cyclesInSet: 0, taskId: null };
    await a.repository.write('timer', snapshot);
    await settle(a.repository, b.repository);
    expect(b.repository.read('timer')).toEqual(snapshot);
  });

  it('réessaie avec un délai exponentiel quand le serveur est injoignable', async () => {
    const server = createMemoryServer();
    const a = device(server);
    a.remote.setReachable(false); // navigateur « en ligne » mais serveur en panne
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const delays = () => a.timers.map((t) => t.delay);
    await a.repository.write('tasks', [task('t')]); // synchronisation automatique → 1ᵉʳ échec
    await vi.waitFor(() => expect(delays()).toEqual([1000]));
    expect(a.repository.getStatus().state).toBe('error');

    a.timers.splice(0)[0]?.task(); // nouvel essai → 2ᵉ échec
    await vi.waitFor(() => expect(delays()).toEqual([2000]));
    a.timers.splice(0)[0]?.task(); // 3ᵉ échec
    await vi.waitFor(() => expect(delays()).toEqual([4000]));

    a.remote.setReachable(true);
    a.timers.splice(0)[0]?.task();
    await vi.waitFor(() => expect(a.repository.getStatus().state).toBe('synced'));
    expect(a.repository.getStatus()).toMatchObject({ state: 'synced', pending: 0 });
    expect(server.tasks.has('t')).toBe(true);
  });

  it('notifie les changements de statut et respecte le désabonnement', async () => {
    const server = createMemoryServer();
    const a = device(server);
    const states: string[] = [];
    const unsubscribe = a.repository.subscribeStatus((status) => states.push(status.state));
    await a.repository.write('settings', { ...DEFAULT_SETTINGS, volume: 0.3 });
    await settle(a.repository);
    unsubscribe();
    await a.repository.write('settings', { ...DEFAULT_SETTINGS, volume: 0.4 });
    await settle(a.repository);
    expect(states).toContain('syncing');
    expect(states.at(-1)).toBe('synced');
    expect(states.filter((s) => s === 'synced').length).toBeGreaterThan(0);
  });

  it('se synchronise automatiquement : démarrage, notification serveur et retour du réseau', async () => {
    const server = createMemoryServer();
    const a = device(server);
    const b = device(server);
    b.repository.start();
    await a.repository.write('tasks', [task('auto')]);
    await settle(a.repository);
    // Notification « Realtime » reçue par B → synchronisation automatique.
    await vi.waitFor(() => expect(b.repository.read('tasks').map((t) => t.id)).toEqual(['auto']));

    b.goOffline();
    window.dispatchEvent(new Event('offline'));
    expect(b.repository.getStatus().state).toBe('offline');
    b.goOnline();
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(b.repository.getStatus().state).toBe('synced'));
    b.repository.dispose();
  });
});

describe('SyncedRepository — lot L4', () => {
  it('synchronise projets, champs des tâches et tâche des sessions entre appareils', async () => {
    const server = createMemoryServer();
    const laptop = device(server);
    const phone = device(server);
    const project = { id: 'p1', name: 'Site Acme', color: '#34d399', client: 'Acme', createdAt: 1, archivedAt: null };
    const planned = { ...task('t1', 'Maquette'), projectId: 'p1', estimate: 3, plannedFor: '2026-10-17' };

    await laptop.repository.write('projects', [project]);
    await laptop.repository.write('tasks', [planned]);
    await laptop.repository.write('logs', { [TODAY]: { date: TODAY, sessions: [{ ...session('focus:1'), taskId: 't1' }] } });
    await settle(laptop.repository, phone.repository);

    expect(phone.repository.read('projects')).toEqual([project]);
    expect(phone.repository.read('tasks')).toEqual([planned]);
    expect(phone.repository.read('logs')[TODAY]?.sessions[0]?.taskId).toBe('t1');

    // Archivage sur le téléphone → visible sur l'ordinateur.
    await phone.repository.write('projects', [{ ...project, archivedAt: 9 }]);
    await settle(phone.repository, laptop.repository);
    expect(laptop.repository.read('projects')[0]?.archivedAt).toBe(9);
  });

  it('EF-C03 : les projets créés sans compte sont envoyés à la première connexion', async () => {
    const server = createMemoryServer();
    const storage = new MemoryStorage();
    await createLocalRepository(storage, new EventTarget()).write('projects', [
      { id: 'local', name: 'Perso', color: '#fb7185', client: null, createdAt: 1, archivedAt: null },
    ]);
    const signedIn = device(server, storage);
    await settle(signedIn.repository);
    expect([...server.projects.keys()]).toEqual(['local']);
  });
});

describe('SyncedRepository — réentrance', () => {
  it('un rappel synchrone pendant l’envoi ne relance pas une synchronisation imbriquée', async () => {
    const server = createMemoryServer();
    const storage = new MemoryStorage();
    const base = createMemoryRemote(server);
    let depth = 0;
    let maxDepth = 0;
    let onPush: () => void = () => undefined;
    // Serveur qui rappelle immédiatement (de façon synchrone) pendant l'envoi.
    const remote = {
      ...base,
      push: async (entries: Parameters<typeof base.push>[0]) => {
        depth += 1;
        maxDepth = Math.max(maxDepth, depth);
        if (depth < 5) onPush(); // borne de sécurité si la réentrance revenait
        depth -= 1;
        return base.push(entries);
      },
    };
    const repository = createSyncedRepository({
      local: createLocalRepository(storage, new EventTarget()),
      remote,
      storage,
      userId: USER,
      isOnline: () => true,
      now: () => NOW,
      setTimer: () => () => undefined,
    });
    await repository.syncNow(); // synchronisation initiale : le curseur est posé
    onPush = () => void repository.syncNow();
    await repository.write('tasks', [task('a')]); // l'envoi est désormais le premier appel réseau
    await vi.waitFor(() => expect(repository.getStatus().state).toBe('synced'));
    expect(maxDepth).toBe(1);
    expect(server.tasks.has('a')).toBe(true);
  });
});
