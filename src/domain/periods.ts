import { formatLongDate, formatShortDate, fromDateKey, shiftDateKey } from '../utils/format';
import { endOfMonth, MAX_RANGE_DAYS, startOfMonth, startOfWeek } from './stats';

/** Type de période d'un rapport (EF-R02). */
export type PeriodKind = 'day' | 'week' | 'month' | 'custom';

export interface Period {
  kind: PeriodKind;
  from: string;
  to: string;
}

/** Période d'un type donné contenant le jour `anchor`. */
export function periodFor(kind: Exclude<PeriodKind, 'custom'>, anchor: string): Period {
  if (kind === 'day') return { kind, from: anchor, to: anchor };
  if (kind === 'week') {
    const from = startOfWeek(anchor);
    return { kind, from, to: shiftDateKey(from, 6) };
  }
  return { kind, from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

/** Période précédente (`-1`) ou suivante (`+1`) de même type ; une plage libre glisse de sa durée. */
export function shiftPeriod(period: Period, direction: -1 | 1): Period {
  if (period.kind === 'day' || period.kind === 'week') {
    return periodFor(period.kind, shiftDateKey(period.from, direction * (period.kind === 'day' ? 1 : 7)));
  }
  if (period.kind === 'month') {
    const start = fromDateKey(period.from);
    const anchor = new Date(start.getFullYear(), start.getMonth() + direction, 1);
    return periodFor('month', `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-01`);
  }
  const length = Math.round((fromDateKey(period.to).getTime() - fromDateKey(period.from).getTime()) / 86_400_000) + 1;
  return { kind: 'custom', from: shiftDateKey(period.from, direction * length), to: shiftDateKey(period.to, direction * length) };
}

/**
 * Plage libre saisie par l'utilisateur : bornes inversées remises dans l'ordre, durée
 * plafonnée à `MAX_RANGE_DAYS` (à partir du début).
 */
export function customPeriod(a: string, b: string): Period {
  const [from, to] = a <= b ? [a, b] : [b, a];
  const max = shiftDateKey(from, MAX_RANGE_DAYS - 1);
  return { kind: 'custom', from, to: to > max ? max : to };
}

/** Libellé court affiché par le sélecteur de période. */
export function periodLabel(period: Period): string {
  if (period.kind === 'day') return formatLongDate(period.from);
  if (period.kind === 'month') {
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(fromDateKey(period.from));
  }
  return `${formatShortDate(period.from)} – ${formatShortDate(period.to)}`;
}
