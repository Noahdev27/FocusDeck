import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../types';
import { appendSession, pruneLogs, removeDay } from './logs';

const session = (id: string): SessionRecord => ({ id, mode: 'focus', startedAt: 1, endedAt: 2, durationSeconds: 60, completed: true, taskId: null });

describe('logs', () => {
  it('ajoute une session au jour courant', () => {
    const logs = appendSession(appendSession({}, '2026-10-16', session('a')), '2026-10-16', session('b'));
    expect(logs['2026-10-16']?.sessions.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('élague les jours hors rétention', () => {
    const logs = {
      '2026-09-01': { date: '2026-09-01', sessions: [] },
      '2026-10-10': { date: '2026-10-10', sessions: [] },
    };
    expect(Object.keys(pruneLogs(logs, '2026-10-16', 30))).toEqual(['2026-10-10']);
    expect(Object.keys(appendSession(logs, '2026-10-16', session('c')))).toEqual(['2026-10-10', '2026-10-16']);
  });

  it('retire un jour', () => {
    expect(removeDay({ '2026-10-16': { date: '2026-10-16', sessions: [] } }, '2026-10-16')).toEqual({});
  });
});
