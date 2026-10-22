import type { DayLog, SessionRecord } from '../types';
import { LOG_MAX_SIZE, LOG_RETENTION_DAYS } from './constants';
import { fromDateKey } from './format';

/**
 * Applique la rétention locale : jours plus anciens que la fenêtre (365 jours) retirés, puis,
 * si le journal dépasse `maxSize` caractères JSON, les jours les plus anciens sont purgés
 * jusqu'à repasser sous le plafond. Le jour `today` n'est jamais purgé.
 */
export function pruneLogs(
  logs: Record<string, DayLog>,
  today: string,
  retentionDays: number = LOG_RETENTION_DAYS,
  maxSize: number = LOG_MAX_SIZE,
): Record<string, DayLog> {
  const limit = fromDateKey(today).getTime() - retentionDays * 86_400_000;
  const kept = Object.entries(logs)
    .filter(([date]) => fromDateKey(date).getTime() >= limit)
    .sort(([a], [b]) => a.localeCompare(b));
  // Taille calculée jour par jour : une seule sérialisation par jour, pas une par purge.
  const sizes = kept.map(([date, log]) => date.length + JSON.stringify(log).length + 4);
  let total = sizes.reduce((sum, size) => sum + size, 2);
  let start = 0;
  while (total > maxSize && start < kept.length - 1 && kept[start]?.[0] !== today) {
    total -= sizes[start] ?? 0;
    start += 1;
  }
  return Object.fromEntries(kept.slice(start));
}

/**
 * Ajoute une session au journal du jour puis applique la rétention. Une session déjà
 * présente (même identifiant, ex. phase terminée sur deux appareils) n'est pas dupliquée.
 */
export function appendSession(logs: Record<string, DayLog>, date: string, session: SessionRecord): Record<string, DayLog> {
  if (Object.values(logs).some((log) => log.sessions.some((existing) => existing.id === session.id))) return logs;
  const current = logs[date] ?? { date, sessions: [] };
  return pruneLogs({ ...logs, [date]: { ...current, sessions: [...current.sessions, session] } }, date);
}

/** Retire le journal d'un jour. */
export function removeDay(logs: Record<string, DayLog>, date: string): Record<string, DayLog> {
  return Object.fromEntries(Object.entries(logs).filter(([key]) => key !== date));
}
