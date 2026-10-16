import { useAnimate } from 'framer-motion';
import { CornerDownLeft, Plus } from 'lucide-react';
import { forwardRef, useState, type FormEvent } from 'react';
import { TASK_TITLE_MAX_LENGTH } from '../../utils/constants';

interface TaskInputProps {
  onAdd: (title: string) => boolean;
  disabled?: boolean;
}

export const TaskInput = forwardRef<HTMLInputElement, TaskInputProps>(function TaskInput(
  { onAdd, disabled = false },
  ref,
) {
  const [title, setTitle] = useState('');
  const [scope, animate] = useAnimate<HTMLFormElement>();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onAdd(title)) setTitle('');
    else void animate(scope.current, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.35 });
  };

  return (
    <form
      ref={scope}
      onSubmit={onSubmit}
      className="group flex items-center gap-2 rounded-2xl bg-black/20 p-1.5 pl-4 ring-1 ring-white/[0.08] transition focus-within:ring-violet-400/50"
    >
      <Plus className="size-4 shrink-0 text-zinc-400 transition group-focus-within:text-violet-300" />
      <label htmlFor="new-task" className="sr-only">
        Nouvel objectif
      </label>
      <input
        ref={ref}
        id="new-task"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={TASK_TITLE_MAX_LENGTH}
        placeholder="Ajouter un micro-objectif…  (N)"
        autoComplete="off"
        disabled={disabled}
        className="h-9 min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-zinc-400 focus:outline-none"
      />
      <button
        type="submit"
        disabled={disabled || title.trim().length === 0}
        className="flex h-9 items-center gap-1.5 rounded-xl bg-white/[0.08] px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.14] disabled:opacity-30"
      >
        Ajouter <CornerDownLeft className="size-3.5" />
      </button>
    </form>
  );
});
