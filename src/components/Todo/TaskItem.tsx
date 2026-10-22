import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import { CalendarClock, ChevronDown, GripVertical, Pencil, Play, Trash2 } from 'lucide-react';
import { useId, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Project, Task } from '../../types';
import { ESTIMATE_LIMITS, TASK_TITLE_MAX_LENGTH } from '../../utils/constants';
import { cn } from '../../utils/cn';
import { formatShortDate, formatTime } from '../../utils/format';
import type { PomodoroProgress, TaskSchedule } from '../../utils/tasks';
import { Button } from '../ui/Button';
import { PomodoroCount } from './PomodoroCount';

export interface TaskItemHandlers {
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  /** `viaKeyboard` : le bouton activé disparaît, le focus doit être replacé. */
  onDelete: (id: string, viaKeyboard: boolean) => void;
  onFocus: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<Task, 'projectId' | 'estimate'>>) => void;
  onPostpone: (id: string, viaKeyboard: boolean) => void;
}

interface TaskItemProps extends TaskItemHandlers {
  task: Task;
  /** Projet de la tâche (archivé compris). */
  project: Project | undefined;
  /** Projets proposés dans le sélecteur (actifs). */
  projects: readonly Project[];
  progress: PomodoroProgress | null;
  schedule: TaskSchedule;
  /** Tâche associée au minuteur. */
  active: boolean;
}

const itemMotion = {
  layout: true,
  initial: { opacity: 0, y: -10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, x: 40, transition: { duration: 0.2 } },
  transition: { type: 'spring', stiffness: 500, damping: 40 },
} as const;

const ESTIMATES = Array.from({ length: ESTIMATE_LIMITS.max - ESTIMATE_LIMITS.min + 1 }, (_, i) => ESTIMATE_LIMITS.min + i);

/** Un clic produit par le clavier (Entrée, Espace) a un `detail` nul. */
const fromKeyboard = (event: MouseEvent) => event.detail === 0;

const actionClass = 'rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200';

export function TaskItem({ task, project, projects, progress, schedule, active, ...handlers }: TaskItemProps) {
  const { onToggle, onRename, onDelete, onFocus, onUpdate, onPostpone } = handlers;
  const controls = useDragControls();
  const panelId = useId();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const commit = () => {
    if (draft.trim() && draft.trim() !== task.title) onRename(task.id, draft);
    else setDraft(task.title);
    setEditing(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') {
      setDraft(task.title);
      setEditing(false);
    }
  };

  // Un projet archivé reste affiché (et sélectionné) sur les tâches qui le portent.
  const options = project && !projects.includes(project) ? [...projects, project] : projects;

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      {...itemMotion}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.6)' }}
      className={cn(
        'group relative rounded-2xl bg-white/[0.03] px-2 py-2.5 ring-1 transition-colors hover:bg-white/[0.05]',
        active ? 'ring-rose-400/40' : 'ring-white/[0.05]',
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Déplacer"
          onPointerDown={(event) => controls.start(event)}
          className="cursor-grab touch-none rounded-md p-0.5 text-zinc-400 opacity-60 transition hover:text-zinc-300 active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100"
        >
          <GripVertical className="size-4" />
        </button>

        <Checkbox checked={task.completed} onToggle={() => onToggle(task.id)} label={task.title} />

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              maxLength={TASK_TITLE_MAX_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={onKeyDown}
              aria-label="Modifier l'objectif"
              className="w-full rounded-lg bg-black/30 px-2 py-1 text-sm text-white ring-1 ring-violet-400/50 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => setEditing(true)}
              onClick={() => onToggle(task.id)}
              className="relative block w-full truncate text-left text-sm"
            >
              <motion.span
                animate={{ color: task.completed ? 'rgb(161 161 170)' : 'rgb(244 244 245)' }}
                className="relative"
              >
                {task.title}
                <motion.span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-px w-full origin-left bg-zinc-500"
                  initial={false}
                  animate={{ scaleX: task.completed ? 1 : 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </motion.span>
            </button>
          )}
          {!editing && <TaskMeta task={task} project={project} progress={progress} schedule={schedule} active={active} />}
        </div>

        <div className="flex items-center opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {!task.completed && (
            <button type="button" aria-label={`Lancer un focus sur « ${task.title} »`} title="Lancer un focus" onClick={() => onFocus(task.id)} className={cn(actionClass, 'hover:text-rose-300')}>
              <Play className="size-3.5" />
            </button>
          )}
          <button type="button" aria-label="Renommer" onClick={() => setEditing(true)} className={actionClass}>
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Supprimer"
            onClick={(event) => onDelete(task.id, fromKeyboard(event))}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-300"
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Options de « ${task.title} »`}
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((value) => !value)}
            className={actionClass}
          >
            <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-end gap-3 pb-1 pl-8 pr-1 pt-3 sm:pl-11">
              <label className="flex min-w-0 flex-col gap-1 text-xs text-zinc-400">
                Projet
                <select
                  value={task.projectId ?? ''}
                  onChange={(event) => onUpdate(task.id, { projectId: event.target.value || null })}
                  className="h-8 max-w-44 rounded-lg bg-ink-800 px-2 text-sm text-zinc-100 ring-1 ring-white/10"
                >
                  <option value="">Sans projet</option>
                  {options.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.archivedAt === null ? item.name : `${item.name} (archivé)`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Estimation
                <select
                  value={task.estimate ?? ''}
                  onChange={(event) => onUpdate(task.id, { estimate: event.target.value ? Number(event.target.value) : null })}
                  className="h-8 rounded-lg bg-ink-800 px-2 text-sm text-zinc-100 ring-1 ring-white/10"
                >
                  <option value="">Aucune</option>
                  {ESTIMATES.map((value) => (
                    <option key={value} value={value}>
                      {value} pomodoro{value > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </label>
              {!task.completed && (
                <Button size="sm" icon={<CalendarClock className="size-3.5" />} onClick={(event) => onPostpone(task.id, fromKeyboard(event))}>
                  Reporter à demain
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

function TaskMeta({
  task,
  project,
  progress,
  schedule,
  active,
}: Pick<TaskItemProps, 'task' | 'project' | 'progress' | 'schedule' | 'active'>) {
  const completedAt = task.completed ? task.completedAt : null;
  if (!project && !progress && schedule !== 'overdue' && !active && completedAt === null) return null;
  return (
    <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-zinc-400">
      {active && <span className="font-medium text-rose-300">En cours</span>}
      {project && (
        <span className="flex min-w-0 items-center gap-1">
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
          <span className="truncate">{project.name}</span>
        </span>
      )}
      {progress && <PomodoroCount progress={progress} />}
      {schedule === 'overdue' && task.plannedFor && (
        <span className="text-amber-300">En retard · prévue {formatShortDate(task.plannedFor)}</span>
      )}
      {completedAt !== null && <span>Terminé à {formatTime(completedAt)}</span>}
    </p>
  );
}

const BURST = Array.from({ length: 8 }, (_, index) => (index / 8) * Math.PI * 2);

function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="relative grid size-6 shrink-0 place-items-center"
    >
      <motion.span
        className={cn('absolute inset-0 rounded-lg border-2', checked ? 'border-transparent' : 'border-zinc-600')}
        animate={{
          background: checked ? 'linear-gradient(135deg, #34d399, #22d3ee)' : 'rgba(0,0,0,0)',
          scale: checked ? [1, 0.85, 1.08, 1] : 1,
        }}
        transition={{ duration: 0.35 }}
      />
      <svg viewBox="0 0 24 24" className="relative size-4" aria-hidden>
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          fill="none"
          stroke="white"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.25, delay: checked ? 0.08 : 0 }}
        />
      </svg>
      <AnimatePresence initial={false}>
        {checked &&
          BURST.map((angle) => (
            <motion.span
              key={angle}
              aria-hidden
              className="pointer-events-none absolute size-1.5 rounded-full bg-emerald-300"
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: Math.cos(angle) * 18, y: Math.sin(angle) * 18, opacity: 0, scale: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          ))}
      </AnimatePresence>
    </button>
  );
}
