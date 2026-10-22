import { Target, X } from 'lucide-react';
import { useFocus } from '../../context/FocusContext';
import { useTimer } from '../../context/TimerContext';
import { cn } from '../../utils/cn';
import { pomodoroProgress } from '../../utils/tasks';
import { PomodoroCount } from '../Todo/PomodoroCount';

/** Tâche associée aux cycles Focus, affichée sous le cadran (EF-T03). */
export function ActiveTask({ className }: { className?: string }) {
  const { tasks, projects, pomodoroCounts } = useFocus();
  const { taskId, setActiveTask } = useTimer();
  const task = taskId === null ? undefined : tasks.find((item) => item.id === taskId);
  if (!task) return null;
  const project = task.projectId === null ? undefined : projects.find((item) => item.id === task.projectId);
  const progress = pomodoroProgress(pomodoroCounts[task.id] ?? 0, task.estimate);

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-white/[0.04] py-2 pl-3 pr-1.5 ring-1 ring-white/[0.08]',
        className,
      )}
    >
      <Target className="size-4 shrink-0 text-rose-300" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Tâche en cours</p>
        <p className={cn('truncate text-sm', task.completed ? 'text-zinc-400 line-through' : 'text-zinc-100')}>{task.title}</p>
        {(project || progress) && (
          <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
            {project && (
              <span className="flex min-w-0 items-center gap-1.5">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                <span className="truncate">{project.name}</span>
              </span>
            )}
            {progress && <PomodoroCount progress={progress} />}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setActiveTask(null)}
        aria-label="Détacher la tâche du minuteur"
        title="Détacher la tâche"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
