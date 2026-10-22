import { CheckCircle2 } from 'lucide-react';
import { goalProgress } from '../../domain/stats';
import { cn } from '../../utils/cn';

/** Jauge de l'objectif quotidien de cycles (EF-T07). */
export function GoalGauge({ done, goal, compact = false }: { done: number; goal: number; compact?: boolean }) {
  const progress = goalProgress(done, goal);
  return (
    <div className={cn('flex flex-col', compact ? 'gap-1.5' : 'gap-2.5')}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={cn('font-semibold text-white', compact ? 'text-sm' : 'text-3xl')}>
          {done}
          <span className={cn('font-normal text-zinc-400', compact ? 'text-xs' : 'text-base')}> / {progress.goal} cycles</span>
        </p>
        {progress.reached && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-300">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Objectif atteint
          </span>
        )}
      </div>
      <div
        role="meter"
        aria-label="Objectif quotidien de cycles"
        aria-valuemin={0}
        aria-valuemax={progress.goal}
        aria-valuenow={Math.min(done, progress.goal)}
        aria-valuetext={`${done} cycle${done > 1 ? 's' : ''} sur ${progress.goal}${progress.reached ? ', objectif atteint' : ''}`}
        className={cn('overflow-hidden rounded-full bg-violet-400/15', compact ? 'h-1.5' : 'h-2.5')}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', progress.reached ? 'bg-emerald-400' : 'bg-violet-400')}
          style={{ width: `${progress.ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
