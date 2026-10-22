import { Timer } from 'lucide-react';
import type { PomodoroProgress } from '../../utils/tasks';
import { cn } from '../../utils/cn';

/** Compteur « réalisés / estimés » ; ambre quand l'estimation est dépassée (EF-O02). */
export function PomodoroCount({ progress }: { progress: PomodoroProgress }) {
  return (
    <span
      role="img"
      aria-label={progress.label}
      title={progress.label}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 font-mono tabular-nums',
        progress.over ? 'rounded-md bg-amber-400/10 px-1 text-amber-300' : 'text-zinc-400',
      )}
    >
      <Timer className="size-3" aria-hidden />
      {progress.short}
    </span>
  );
}
