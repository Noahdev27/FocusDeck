import { useId, useState, type KeyboardEvent } from 'react';
import { durationTicks, type DayTotals } from '../../domain/stats';
import { cn } from '../../utils/cn';
import { formatDuration, formatShortDate, fromDateKey } from '../../utils/format';
import { BAR_COLOR, GRID_COLOR } from './chartTheme';
import { DataTable } from './DataTable';

/** Graduation compacte : « 2 h », « 1 h 30 », « 45 min ». */
const tickLabel = (seconds: number) => {
  if (seconds === 0) return '0';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`;
};

const describe = (day: DayTotals) =>
  `${formatShortDate(day.date)} : ${formatDuration(day.focusSeconds)} de focus, ${day.cycles} cycle${day.cycles > 1 ? 's' : ''}`;

/**
 * Temps de focus par jour (EF-R03) : une série, barres fines arrondies côté valeur, graduations
 * rondes. Survol ou flèches du clavier : détail du jour ; tableau de données en repli.
 */
export function FocusBarChart({ days }: { days: DayTotals[] }) {
  const [active, setActive] = useState<number | null>(null);
  const liveId = useId();
  const ticks = durationTicks(Math.max(0, ...days.map((day) => day.focusSeconds)));
  const top = ticks[ticks.length - 1] ?? 1;
  const current = active === null ? undefined : days[active];
  // Étiquettes de l'axe : chaque jour sur 7 jours, un lundi sur deux sur 30 jours.
  const labelled = (index: number) =>
    days.length <= 7 || index === days.length - 1 || (fromDateKey(days[index]?.date ?? '').getDay() === 1 && index < days.length - 3);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = days.length - 1;
    const moves: Record<string, number> = { ArrowLeft: (active ?? last + 1) - 1, ArrowRight: (active ?? -1) + 1, Home: 0, End: last };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(Math.min(last, Math.max(0, next)));
  };

  return (
    <figure>
      <div
        tabIndex={0}
        role="group"
        aria-label={`Temps de focus par jour sur ${days.length} jours. Flèches gauche et droite pour parcourir les jours.`}
        aria-describedby={liveId}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onMouseLeave={() => setActive(null)}
        className="relative mt-10 grid grid-cols-[3.25rem_minmax(0,1fr)] rounded-xl outline-offset-4"
      >
        {/* Axe vertical et quadrillage */}
        <div aria-hidden className="relative h-44">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-2 translate-y-1/2 whitespace-nowrap font-mono text-[11px] tabular-nums text-zinc-400"
              style={{ bottom: `${(tick / top) * 100}%` }}
            >
              {tickLabel(tick)}
            </span>
          ))}
        </div>
        <div className="relative h-44">
          {ticks.map((tick) => (
            <span key={tick} aria-hidden className="absolute inset-x-0 h-px" style={{ bottom: `${(tick / top) * 100}%`, backgroundColor: GRID_COLOR }} />
          ))}
          <div className="absolute inset-0 flex items-end">
            {days.map((day, index) => (
              <div
                key={day.date}
                aria-hidden
                onMouseEnter={() => setActive(index)}
                className="flex h-full flex-1 items-end justify-center px-px"
              >
                <span
                  className={cn('block w-full max-w-6 rounded-t-[4px] transition-opacity', active !== null && active !== index && 'opacity-60')}
                  style={{ height: `${(day.focusSeconds / top) * 100}%`, backgroundColor: BAR_COLOR }}
                />
              </div>
            ))}
          </div>
          {current && active !== null && (
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-lg bg-ink-700 px-2.5 py-1.5 text-xs shadow-xl ring-1 ring-white/10',
                // Ancrée du côté de la barre pour ne jamais déborder du graphique (mobile 390 px).
                active < days.length / 3 ? 'translate-x-0' : active >= (days.length * 2) / 3 ? '-translate-x-full' : '-translate-x-1/2',
              )}
              style={{
                left: `${(active < days.length / 3 ? active : active >= (days.length * 2) / 3 ? active + 1 : active + 0.5) / days.length * 100}%`,
              }}
            >
              <span className="font-semibold text-white">{formatDuration(current.focusSeconds)}</span>
              <span className="text-zinc-400">
                {' '}
                · {current.cycles} cycle{current.cycles > 1 ? 's' : ''} · {formatShortDate(current.date)}
              </span>
            </div>
          )}
        </div>
        <span />
        <div aria-hidden className="mt-2 flex">
          {days.map((day, index) => (
            <span key={day.date} className="flex-1 overflow-visible whitespace-nowrap text-center text-[11px] text-zinc-400">
              {labelled(index) ? (days.length <= 7 ? formatShortDate(day.date).split(' ')[0] : fromDateKey(day.date).getDate()) : ''}
            </span>
          ))}
        </div>
        <p id={liveId} aria-live="polite" className="sr-only">
          {current ? describe(current) : ''}
        </p>
      </div>
      <DataTable
        caption={`Temps de focus par jour sur ${days.length} jours`}
        headers={['Jour', 'Focus', 'Cycles']}
        rows={[...days].reverse().map((day) => [formatShortDate(day.date), formatDuration(day.focusSeconds), day.cycles])}
      />
    </figure>
  );
}
