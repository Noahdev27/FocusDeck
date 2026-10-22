import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { CalendarClock, ChevronDown, FolderKanban, ListChecks, Sparkles } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocus } from '../../context/FocusContext';
import { useTimer } from '../../context/TimerContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import type { Task } from '../../types';
import { MAX_TASKS } from '../../utils/constants';
import { cn } from '../../utils/cn';
import { formatShortDate } from '../../utils/format';
import type { QuickEntry } from '../../utils/quickEntry';
import { indexProjects, matchesFilters, pomodoroProgress, taskSchedule, type ProjectFilter, type RemovedTask, type StatusFilter } from '../../utils/tasks';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { useToast } from '../ui/Toast';
import { ProjectsDialog } from './ProjectsDialog';
import { TaskInput } from './TaskInput';
import { TaskItem } from './TaskItem';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'active', label: 'À faire' },
  { id: 'done', label: 'Terminées' },
];

const EMPTY_MESSAGES: Record<StatusFilter, string> = {
  all: 'Découpez votre journée en petites victoires. Ajoutez votre premier objectif !',
  active: 'Tout est fait. Prenez une vraie pause, vous l’avez méritée.',
  done: 'Aucun objectif terminé pour l’instant — le premier est le plus satisfaisant.',
};

export function TaskBoard() {
  const focus = useFocus();
  const { today, settings, tasks, projects, pomodoroCounts, addTask, deleteTask, restoreTasks, clearCompletedTasks } = focus;
  const { postponeTask, unpostponeTask, reorderTasks } = focus;
  const timer = useTimer();
  const toast = useToast();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');
  const [projectsOpen, setProjectsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const shortcuts = useMemo(() => ({ KeyN: () => inputRef.current?.focus() }), []);
  useKeyboardShortcuts(shortcuts);

  const byId = useMemo(() => indexProjects(projects), [projects]);
  const activeProjects = useMemo(() => projects.filter((project) => project.archivedAt === null), [projects]);
  // Filtre sur un projet archivé entre-temps : retour à « tous ».
  const effectiveProjectFilter = projectFilter === 'all' || projectFilter === 'none' || activeProjects.some((p) => p.id === projectFilter) ? projectFilter : 'all';

  const schedules = useMemo(
    () => new Map(tasks.map((task) => [task.id, taskSchedule(task, today, settings.autoPostpone)])),
    [tasks, today, settings.autoPostpone],
  );
  const todayTasks = useMemo(() => tasks.filter((task) => schedules.get(task.id) !== 'later'), [tasks, schedules]);
  const laterTasks = useMemo(() => tasks.filter((task) => schedules.get(task.id) === 'later'), [tasks, schedules]);
  const visible = useMemo(
    () => todayTasks.filter((task) => matchesFilters(task, filter, effectiveProjectFilter)),
    [todayTasks, filter, effectiveProjectFilter],
  );

  const doneCount = todayTasks.filter((task) => task.completed).length;
  const progress = todayTasks.length === 0 ? 0 : doneCount / todayTasks.length;

  const offerUndo = useCallback(
    (message: string, removed: RemovedTask[], viaKeyboard: boolean) => {
      if (removed.length === 0) return;
      toast.show({ message, action: { label: 'Annuler', onAction: () => restoreTasks(removed) }, focusAction: viaKeyboard });
    },
    [restoreTasks, toast],
  );

  const onAdd = (entry: QuickEntry) =>
    addTask(entry.title, {
      // Sans `#projet`, un nouvel objectif rejoint le projet filtré.
      projectId: entry.projectId ?? (effectiveProjectFilter === 'all' || effectiveProjectFilter === 'none' ? null : effectiveProjectFilter),
      estimate: entry.estimate,
    });

  const onDelete = (id: string, viaKeyboard: boolean) => {
    const removed = deleteTask(id);
    offerUndo(`« ${removed[0]?.task.title ?? 'Objectif'} » supprimé.`, removed, viaKeyboard);
  };

  const onPostpone = (id: string, viaKeyboard: boolean) => {
    const task = tasks.find((item) => item.id === id);
    postponeTask(id);
    toast.show({
      message: `« ${task?.title ?? 'Objectif'} » reporté à demain.`,
      action: { label: 'Annuler', onAction: () => unpostponeTask(id) },
      focusAction: viaKeyboard,
    });
  };

  const onClearCompleted = () => {
    const removed = clearCompletedTasks();
    offerUndo(`${removed.length} objectif${removed.length > 1 ? 's' : ''} terminé${removed.length > 1 ? 's' : ''} effacé${removed.length > 1 ? 's' : ''}.`, removed, false);
  };

  return (
    <Card aria-labelledby="tasks-title" className="flex min-h-[28rem] flex-col">
      <CardHeader
        id="tasks-title"
        icon={<ListChecks className="size-[18px]" />}
        title="Micro-objectifs"
        subtitle={todayTasks.length === 0 ? 'Session du jour' : `${doneCount} sur ${todayTasks.length} terminés`}
        actions={
          <>
            {doneCount > 0 && (
              <Button size="sm" variant="ghost" onClick={onClearCompleted}>
                Effacer terminés
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={<FolderKanban className="size-3.5" />} onClick={() => setProjectsOpen(true)}>
              Projets
            </Button>
          </>
        }
      />

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>

      <TaskInput ref={inputRef} projects={projects} onAdd={onAdd} disabled={tasks.length >= MAX_TASKS} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Filtrer les objectifs" className="flex gap-1 text-xs">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                'relative rounded-lg px-2.5 py-1.5 font-medium transition-colors',
                filter === item.id ? 'text-white' : 'text-zinc-400 hover:text-zinc-300',
              )}
            >
              {filter === item.id && <motion.span layoutId="task-filter" className="absolute inset-0 rounded-lg bg-white/[0.07]" />}
              <span className="relative">{item.label}</span>
            </button>
          ))}
        </div>
        {activeProjects.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            Projet
            <select
              aria-label="Filtrer par projet"
              value={effectiveProjectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="h-8 max-w-40 rounded-lg bg-ink-800 px-2 text-xs text-zinc-100 ring-1 ring-white/10"
            >
              <option value="all">Tous</option>
              <option value="none">Sans projet</option>
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="relative mt-3 flex-1">
        <Reorder.Group axis="y" values={visible} onReorder={(next: Task[]) => reorderTasks(next)} className="flex flex-col gap-2" layoutScroll>
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                project={task.projectId === null ? undefined : byId.get(task.projectId)}
                projects={activeProjects}
                progress={pomodoroProgress(pomodoroCounts[task.id] ?? 0, task.estimate)}
                schedule={schedules.get(task.id) ?? 'today'}
                active={timer.taskId === task.id}
                onToggle={focus.toggleTask}
                onRename={focus.renameTask}
                onDelete={onDelete}
                onFocus={timer.focusOnTask}
                onUpdate={focus.updateTask}
                onPostpone={onPostpone}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>

        <AnimatePresence>
          {visible.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 px-6 py-12 text-center"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-white/[0.04] ring-1 ring-white/[0.06]">
                <Sparkles className="size-5 text-violet-300" />
              </span>
              <p className="max-w-xs text-sm text-zinc-400">
                {effectiveProjectFilter === 'all' ? EMPTY_MESSAGES[filter] : 'Aucun objectif ici pour ce projet.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <LaterTasks tasks={laterTasks} onBringBack={unpostponeTask} />
      <ProjectsDialog open={projectsOpen} onClose={() => setProjectsOpen(false)} />
    </Card>
  );
}

/** Objectifs reportés à un jour ultérieur (EF-O05), repliés sous la liste du jour. */
function LaterTasks({ tasks, onBringBack }: { tasks: Task[]; onBringBack: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) return null;
  return (
    <div className="mt-4 border-t border-white/[0.06] pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="later-tasks"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-xs font-medium text-zinc-400 hover:text-zinc-200"
      >
        <CalendarClock className="size-3.5" aria-hidden />
        Reportés ({tasks.length})
        <ChevronDown className={cn('ml-auto size-3.5 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <ul id="later-tasks" className="mt-2 flex flex-col gap-1">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate text-zinc-300">{task.title}</span>
              {task.plannedFor && <span className="shrink-0 text-xs text-zinc-400">{formatShortDate(task.plannedFor)}</span>}
              <Button size="sm" variant="ghost" onClick={() => onBringBack(task.id)} aria-label={`Remettre « ${task.title} » à aujourd’hui`}>
                Aujourd’hui
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
