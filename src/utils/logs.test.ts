import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../types';
import { appendSession, pruneLogs, removeDay } from './logs';

const session = (id: string): SessionRecord => ({ id, mode: 'focus', startedAt: 1, endedAt: 2, durationSeconds: 60, completed: true, taskId: null });

describe('logs', () => {
  it('ajoute une session au jour courant', () => {
    const logs = appendSession(appendSession({}, '2026-10-16', session('a')), '2026-10-16', session('b'));
    expect(logs['2026-10-16']?.sessions.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('élague les jours hors rétention (365 jours depuis le lot L3)', () => {
    const logs = {
      '2025-10-15': { date: '2025-10-15', sessions: [] },
      '2025-10-16': { date: '2025-10-16', sessions: [] },
      '2026-09-01': { date: '2026-09-01', sessions: [] },
      '2026-10-10': { date: '2026-10-10', sessions: [] },
    };
    expect(Object.keys(pruneLogs(logs, '2026-10-16', 30))).toEqual(['2026-10-10']);
    // Un historique de 30 jours (format v0.1 à L4) est conservé tel quel : rien à migrer.
    expect(Object.keys(appendSession(logs, '2026-10-16', session('c')))).toEqual(['2025-10-16', '2026-09-01', '2026-10-10', '2026-10-16']);
  });

  it('plafonne la taille : purge les jours les plus anciens, jamais aujourd’hui', () => {
    const day = (date: string, count: number) => ({ date, sessions: Array.from({ length: count }, (_, i) => session(`${date}-${i}`)) });
    const logs = { '2026-10-01': day('2026-10-01', 20), '2026-10-05': day('2026-10-05', 20), '2026-10-16': day('2026-10-16', 20) };
    const oneDay = JSON.stringify(logs['2026-10-16']).length;
    expect(Object.keys(pruneLogs(logs, '2026-10-16', 365, oneDay * 2 + 100))).toEqual(['2026-10-05', '2026-10-16']);
    expect(Object.keys(pruneLogs(logs, '2026-10-16', 365, 10))).toEqual(['2026-10-16']);
    expect(Object.keys(pruneLogs(logs, '2026-10-16'))).toHaveLength(3);
    // Le résultat respecte bien le plafond demandé.
    expect(JSON.stringify(pruneLogs(logs, '2026-10-16', 365, oneDay * 2 + 100)).length).toBeLessThanOrEqual(oneDay * 2 + 100);
  });

  it('retire un jour', () => {
    expect(removeDay({ '2026-10-16': { date: '2026-10-16', sessions: [] } }, '2026-10-16')).toEqual({});
  });
});
