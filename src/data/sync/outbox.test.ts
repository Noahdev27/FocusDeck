import { describe, expect, it } from 'vitest';
import type { Project, SessionRecord, Task } from '../../types';
import { DEFAULT_SETTINGS } from '../../utils/constants';
import { acknowledge, diffLogs, diffProjects, diffTasks, enqueue, entryKey, sanitizeOutbox } from './outbox';
import type { OutboxEntry } from './types';

const task = (id: string, title = id): Task => ({ id, title, completed: false, createdAt: 1, completedAt: null, projectId: null, estimate: null, plannedFor: null });
const session = (id: string): SessionRecord => ({ id, mode: 'focus', startedAt: 1, endedAt: 2, durationSeconds: 60, completed: true, taskId: null });

describe('outbox', () => {
  it('ne garde que la dernière modification d’un même objet', () => {
    const queue = enqueue(
      [{ type: 'task', task: task('a', 'v1'), position: 0 }, { type: 'settings', settings: DEFAULT_SETTINGS }],
      [{ type: 'task', task: task('a', 'v2'), position: 0 }, { type: 'task-delete', id: 'b' }],
    );
    expect(queue.map((e) => e.type)).toEqual(['settings', 'task', 'task-delete']);
    expect((queue[1] as Extract<OutboxEntry, { type: 'task' }>).task.title).toBe('v2');
  });

  it('n’acquitte pas une entrée remplacée pendant l’envoi', () => {
    const sent = enqueue([], [{ type: 'task', task: task('a', 'v1'), position: 0 }]);
    const during = enqueue(sent, [{ type: 'task', task: task('a', 'v2'), position: 0 }]);
    expect(acknowledge(during, sent)).toHaveLength(1);
    expect(acknowledge(sent, sent)).toEqual([]);
  });

  it('calcule le différentiel des tâches (ajout, modification, déplacement, suppression)', () => {
    const before = [task('a'), task('b'), task('c')];
    const after = [task('b'), { ...task('a'), completed: true }, task('d')];
    expect(diffTasks(before, after)).toEqual([
      { type: 'task', task: task('b'), position: 0 },
      { type: 'task', task: { ...task('a'), completed: true }, position: 1 },
      { type: 'task', task: task('d'), position: 2 },
      { type: 'task-delete', id: 'c' },
    ]);
    expect(diffTasks(before, before)).toEqual([]);
  });

  it('ne propage pas l’élagage de l’historique local (âge ou taille) vers le serveur', () => {
    const old = { '2025-08-01': { date: '2025-08-01', sessions: [session('vieux')] } };
    const recent = { '2026-10-10': { date: '2026-10-10', sessions: [session('récent')] } };
    const today = { '2026-10-16': { date: '2026-10-16', sessions: [session('jour')] } };
    expect(diffLogs({ ...old, ...recent, ...today }, today, '2026-10-16')).toEqual([]);
    // « Effacer l'historique du jour » : seule suppression propagée.
    expect(diffLogs({ ...recent, ...today }, recent, '2026-10-16')).toEqual([{ type: 'session-delete', id: 'jour' }]);
  });

  it('relit une file persistée en écartant les entrées invalides', () => {
    const entries = sanitizeOutbox([
      { type: 'task', task: { id: 'a', title: '  ok ', createdAt: 1 }, position: 0 },
      { type: 'task', task: { title: 'sans id' }, position: 0 },
      { type: 'session', date: '2026-10-16', session: session('s') },
      { type: 'session', date: '2026-10-16', session: { id: 'x', mode: 'sieste' } },
      { type: 'task-delete', id: 'b' },
      { type: 'inconnu' },
      { type: 'settings', settings: { focusMinutes: 9999 } },
      { type: 'timer', snapshot: null },
      'n’importe quoi',
    ]);
    expect(entries.map((e) => e.type)).toEqual(['task', 'session', 'task-delete', 'settings', 'timer']);
    expect(sanitizeOutbox('corrompu')).toEqual([]);
  });

  it('projets : ajout et modification envoyés, jamais de suppression (archivage)', () => {
    const project = (id: string, name = id): Project => ({ id, name, color: '#34d399', client: null, createdAt: 1, archivedAt: null });
    const before = [project('a'), project('b')];
    const after = [project('a'), { ...project('b'), archivedAt: 5 }, project('c')];
    const entries = diffProjects(before, after);
    expect(entries.map(entryKey)).toEqual(['project:b', 'project:c']);
    expect(diffProjects(after, [project('a')])).toEqual([]);
    expect(sanitizeOutbox([...entries, { type: 'project', project: { id: 'x' } }])).toEqual(entries);
  });
});
