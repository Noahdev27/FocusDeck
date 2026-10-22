import { useEffect, useRef, useState } from 'react';
import type { HeatCell, PeriodTotals } from '../../domain/stats';
import { formatDuration, formatShortDate, fromDateKey } from '../../utils/format';
import { HEAT_COLORS } from './chartTheme';
import { DataTable } from './DataTable';

const WEEKDAYS = ['lun.', '', 'mer.', '', 'ven.', '', ''];
const monthName = (date: string) => new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(fromDateKey(date));
const monthLong = (date: string) => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(fromDateKey(date));

/**
 * Carte de chaleur annuelle (EF-R03) : une colonne par semaine, intensité séquentielle à une
 * teinte. Le détail d'un jour s'affiche au survol ; le tableau des mois porte les valeurs.
 */
export function YearHeatmap({ columns, months }: { columns: HeatCell[][]; months: PeriodTotals[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HeatCell | null>(null);
  const activeDays = columns.flat().filter((cell) => !cell.future && cell.focusSeconds > 0).length;

  // Sur un écran étroit, la semaine en cours (à droite) doit être visible d'emblée.
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, []);

  return (
    <figure>
      <div
        ref={scrollRef}
        tabIndex={0}
        role="group"
        aria-label={`Carte de chaleur des 12 derniers mois : ${activeDays} jour${activeDays > 1 ? 's' : ''} avec du focus. Détail par mois dans le tableau de données.`}
        className="overflow-x-auto rounded-xl pb-2"
      >
        <div aria-hidden className="inline-grid grid-cols-[2rem_auto] gap-x-1">
          <span />
          <div className="flex gap-[3px]">
            {columns.map((column, index) => {
              const first = column[0];
              const newMonth = first && (index === 0 || fromDateKey(first.date).getDate() <= 7);
              return (
                <span key={first?.date ?? index} className="relative h-4 w-[11px]">
                  {newMonth && first && <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] text-zinc-400">{monthName(first.date)}</span>}
                </span>
              );
            })}
          </div>
          <div className="flex flex-col gap-[3px]">
            {WEEKDAYS.map((label, index) => (
              <span key={index} className="h-[11px] text-[10px] leading-[11px] text-zinc-400">
                {label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]" onMouseLeave={() => setHovered(null)}>
            {columns.map((column, index) => (
              <div key={column[0]?.date ?? index} className="flex flex-col gap-[3px]">
                {column.map((cell) => (
                  <span
                    key={cell.date}
                    onMouseEnter={() => setHovered(cell.future ? null : cell)}
                    className="size-[11px] rounded-[2px]"
                    style={{ backgroundColor: cell.future ? 'transparent' : HEAT_COLORS[cell.level] }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
        <span className="min-h-4">
          {hovered
            ? `${formatShortDate(hovered.date)} : ${formatDuration(hovered.focusSeconds)} · ${hovered.cycles} cycle${hovered.cycles > 1 ? 's' : ''}`
            : 'Survolez un jour pour le détail.'}
        </span>
        <span className="flex items-center gap-1">
          Moins
          {HEAT_COLORS.map((color) => (
            <span key={color} className="size-[11px] rounded-[2px]" style={{ backgroundColor: color }} />
          ))}
          Plus
        </span>
      </div>
      <DataTable
        caption="Temps de focus par mois sur 12 mois"
        headers={['Mois', 'Focus', 'Cycles']}
        rows={[...months].reverse().map((month) => [monthLong(month.from), formatDuration(month.focusSeconds), month.cycles])}
      />
    </figure>
  );
}
