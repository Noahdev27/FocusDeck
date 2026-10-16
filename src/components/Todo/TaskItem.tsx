import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import type { Task } from '../../types';
import { TASK_TITLE_MAX_LENGTH } from '../../utils/constants';
import { cn } from '../../utils/cn';
import { formatTime } from '../../utils/format';

interface TaskItemProps {
  task: Task;
  reorderable: boolean;
  onToggle: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

const itemMotion = {
  layout: true,
  initial: { opacity: 0, y: -10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, x: 40, transition: { duration: 0.2 } },
  transition: { type: 'spring', stiffness: 500, damping: 40 },
} as const;

export function TaskItem({ task, reorderable, onToggle, onRename, onDelete }: TaskItemProps) {
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
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

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      {...itemMotion}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 30px -10px rgba(0,0,0,0.6)' }}
      className="group relative flex items-center gap-3 rounded-2xl bg-white/[0.03] px-2 py-2.5 ring-1 ring-white/[0.05] transition-colors hover:bg-white/[0.05]"
    >
      {reorderable ? (
        <button
          type="button"
          aria-label="Déplacer"
          onPointerDown={(event) => controls.start(event)}
          className="cursor-grab touch-none rounded-md p-0.5 text-zinc-400 opacity-60 transition hover:text-zinc-300 active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100"
        >
          <GripVertical className="size-4" />
        </button>
      ) : (
        <span className="w-5" />
      )}

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
              animate={{ color: task.completed ? 'rgb(113 113 122)' : 'rgb(244 244 245)' }}
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
        {task.completed && task.completedAt !== null && !editing && (
          <p className="text-[11px] text-zinc-400">Terminé à {formatTime(task.completedAt)}</p>
        )}
      </div>

      <div className="flex items-center opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button
          type="button"
          aria-label="Renommer"
          onClick={() => setEditing(true)}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Supprimer"
          onClick={() => onDelete(task.id)}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-300"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </Reorder.Item>
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
