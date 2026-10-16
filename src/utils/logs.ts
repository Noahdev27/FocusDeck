import type { DayLog, SessionRecord } from '../types';
import { LOG_RETENTION_DAYS } from './constants';
import { fromDateKey } from './format';

/** Supprime les journaux plus anciens que la fenêtre de rétention. */
export function pruneLogs(
  logs: Record<string, DayLog>,
  today: string,
  retentionDays: number = LOG_RETENTION_DAYS,
): Record<string, DayLog> {
  const limit = fromDateKey(today).getTime() - retentionDays * 86_400_000;
  return Object.fromEntries(Object.entries(logs).filter(([date]) => fromDateKey(date).getTime() >= limit));
}

/** Ajoute une session au journal du jour puis applique la rétention. */
export function appendSession(logs: Record<string, DayLog>, date: string, session: SessionRecord): Record<string, DayLog> {
  const current = logs[date] ?? { date, sessions: [] };
  return pruneLogs({ ...logs, [date]: { ...current, sessions: [...current.sessions, session] } }, date);
}

/** Retire le journal d'un jour. */
export function removeDay(logs: Record<string, DayLog>, date: string): Record<string, DayLog> {
  return Object.fromEntries(Object.entries(logs).filter(([key]) => key !== date));
}
