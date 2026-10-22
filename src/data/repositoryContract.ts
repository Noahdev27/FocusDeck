import { describe, expect, it } from 'vitest';
import type { DayLog, Task } from '../types';
import { DEFAULT_SETTINGS } from '../utils/constants';
import type { AppData, CollectionKey, FocusRepository, RepositoryChange } from './repository';

export interface ContractHarness {
  repository: FocusRepository;
  /** Simule une écriture faite ailleurs (autre onglet, autre appareil). */
  remoteWrite: <K extends CollectionKey>(key: K, value: AppData[K]) => Promise<void>;
  /** Injecte une donnée brute non validée (corruption, ancienne version). */
  writeRaw: (key: CollectionKey, raw: string) => void;
}

const task = (id: string, title: string): Task => ({ id, title, completed: false, createdAt: 1, completedAt: null, projectId: null, estimate: null, plannedFor: null });
const day = (date: string): DayLog => ({
  date,
  sessions: [{ id: `s-${date}`, mode: 'focus', startedAt: 1, endedAt: 2, durationSeconds: 1500, completed: true, taskId: null }],
});

/**
 * Suite de tests que toute implémentation de `FocusRepository` doit passer
 * (locale aujourd'hui, synchronisée au lot L2).
 */
export function describeRepositoryContract(name: string, setup: () => ContractHarness): void {
  describe(`FocusRepository — ${name}`, () => {
    it('renvoie des valeurs par défaut sûres quand rien n’est enregistré', () => {
      const { repository } = setup();
      expect(repository.read('settings')).toEqual(DEFAULT_SETTINGS);
      expect(repository.read('tasks')).toEqual([]);
      expect(repository.read('projects')).toEqual([]);
      expect(repository.read('logs')).toEqual({});
      expect(repository.read('timer')).toBeNull();
    });

    it('relit à l’identique ce qui a été écrit', async () => {
      const { repository } = setup();
      const data: AppData = {
        settings: { ...DEFAULT_SETTINGS, focusMinutes: 50, autoStartBreaks: true },
        tasks: [{ ...task('a', 'Écrire'), projectId: 'p1', estimate: 3, plannedFor: '2026-10-17' }, task('b', 'Relire')],
        projects: [{ id: 'p1', name: 'Site Acme', color: '#34d399', client: 'Acme', createdAt: 5, archivedAt: null }],
        logs: { '2026-10-16': day('2026-10-16') },
        timer: {
          mode: 'shortBreak',
          status: 'paused',
          remainingMs: 120_000,
          endsAt: null,
          durationMs: 300_000,
          startedAt: 10,
          cyclesInSet: 2,
          taskId: null,
        },
      };
      for (const key of Object.keys(data) as CollectionKey[]) {
        await repository.write(key, data[key] as never);
        expect(repository.read(key)).toEqual(data[key]);
      }
      await repository.write('timer', null);
      expect(repository.read('timer')).toBeNull();
    });

    it('valide les données corrompues au lieu de les renvoyer telles quelles', () => {
      const { repository, writeRaw } = setup();
      writeRaw('settings', '{"focusMinutes": 9999, "soundEnabled": "oui"}');
      writeRaw('tasks', '[{"id":"x","title":"  ok  ","createdAt":1}, {"title":"sans id"}]');
      writeRaw('logs', 'pas du json');
      expect(repository.read('settings')).toMatchObject({ focusMinutes: 180, soundEnabled: true });
      expect(repository.read('tasks')).toEqual([{ id: 'x', title: 'ok', completed: false, createdAt: 1, completedAt: null, projectId: null, estimate: null, plannedFor: null }]);
      expect(repository.read('logs')).toEqual({});
    });

    it('liste les jours d’une période, triés', async () => {
      const { repository } = setup();
      await repository.write('logs', {
        '2026-10-16': day('2026-10-16'),
        '2026-10-01': day('2026-10-01'),
        '2026-09-30': day('2026-09-30'),
      });
      const days = await repository.listDays('2026-10-01', '2026-10-31');
      expect(days.map((d) => d.date)).toEqual(['2026-10-01', '2026-10-16']);
    });

    it('notifie les changements venus d’ailleurs, jusqu’au désabonnement', async () => {
      const { repository, remoteWrite } = setup();
      const changes: RepositoryChange[] = [];
      const unsubscribe = repository.subscribe((change) => changes.push(change));

      await remoteWrite('tasks', [task('r', 'Depuis un autre onglet')]);
      expect(changes).toEqual([{ key: 'tasks', value: [task('r', 'Depuis un autre onglet')] }]);

      unsubscribe();
      await remoteWrite('tasks', []);
      expect(changes).toHaveLength(1);
    });
  });
}
