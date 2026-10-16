import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { ListChecks, Sparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useFocus } from '../../context/FocusContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import type { Task } from '../../types';
import { MAX_TASKS } from '../../utils/constants';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { TaskInput } from './TaskInput';
import { TaskItem } from './TaskItem';

type Filter = 'all' | 'active' | 'done';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'active', label: 'À faire' },
  { id: 'done', label: 'Terminées' },
];

const EMPTY_MESSAGES: Record<Filter, string> = {
  all: 'Découpez votre journée en petites victoires. Ajoutez votre premier objectif !',
  active: 'Tout est fait. Prenez une vraie pause, vous l’avez méritée.',
  done: 'Aucun objectif terminé pour l’instant — le premier est le plus satisfaisant.',
};

export function TaskBoard() {
  const { tasks, addTask, toggleTask, renameTask, deleteTask, reorderTasks, clearCompletedTasks } = useFocus();
  const [filter, setFilter] = useState<Filter>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const shortcuts = useMemo(() => ({ KeyN: () => inputRef.current?.focus() }), []);
  useKeyboardShortcuts(shortcuts);

  const doneCount = tasks.filter((task) => task.completed).length;
  const progress = tasks.length === 0 ? 0 : doneCount / tasks.length;
  const visible = useMemo(
    () =>
      tasks.filter((task) => (filter === 'all' ? true : filter === 'done' ? task.completed : !task.completed)),
    [tasks, filter],
  );

  // Le réordonnancement n'a de sens que sur la liste complète.
  const onReorder = (next: Task[]) => {
    if (filter === 'all') reorderTasks(next);
  };

  return (
    <Card aria-labelledby="tasks-title" className="flex min-h-[28rem] flex-col">
      <CardHeader
        id="tasks-title"
        icon={<ListChecks className="size-[18px]" />}
        title="Micro-objectifs"
        subtitle={tasks.length === 0 ? 'Session du jour' : `${doneCount} sur ${tasks.length} terminés`}
        actions={
          doneCount > 0 && (
            <Button size="sm" variant="ghost" onClick={clearCompletedTasks}>
              Effacer terminés
            </Button>
          )
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

      <TaskInput ref={inputRef} onAdd={addTask} disabled={tasks.length >= MAX_TASKS} />

      <div role="tablist" aria-label="Filtrer les objectifs" className="mt-4 flex gap-1 text-xs">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              'relative rounded-lg px-2.5 py-1.5 font-medium transition-colors',
              filter === item.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            {filter === item.id && (
              <motion.span layoutId="task-filter" className="absolute inset-0 rounded-lg bg-white/[0.07]" />
            )}
            <span className="relative">{item.label}</span>
          </button>
        ))}
      </div>

      <div className="relative mt-3 flex-1">
        <Reorder.Group axis="y" values={visible} onReorder={onReorder} className="flex flex-col gap-2" layoutScroll>
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                reorderable={filter === 'all'}
                onToggle={toggleTask}
                onRename={renameTask}
                onDelete={deleteTask}
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
              <p className="max-w-xs text-sm text-zinc-500">{EMPTY_MESSAGES[filter]}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
