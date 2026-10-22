import { useAnimate } from 'framer-motion';
import { CornerDownLeft, Plus, Timer } from 'lucide-react';
import { forwardRef, useId, useMemo, useState, type FormEvent } from 'react';
import type { Project } from '../../types';
import { TASK_TITLE_MAX_LENGTH } from '../../utils/constants';
import { parseQuickEntry, type QuickEntry } from '../../utils/quickEntry';

interface TaskInputProps {
  projects: readonly Project[];
  onAdd: (entry: QuickEntry) => boolean;
  disabled?: boolean;
}

/** Saisie d'un objectif, avec interprétation de `#projet` et `~3` (EF-O07). */
export const TaskInput = forwardRef<HTMLInputElement, TaskInputProps>(function TaskInput(
  { projects, onAdd, disabled = false },
  ref,
) {
  const [title, setTitle] = useState('');
  const [scope, animate] = useAnimate<HTMLFormElement>();
  const previewId = useId();
  const entry = useMemo(() => parseQuickEntry(title, projects), [title, projects]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onAdd(entry)) setTitle('');
    else void animate(scope.current, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.35 });
  };

  return (
    <div>
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
          aria-describedby={previewId}
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
      <QuickEntryPreview id={previewId} entry={entry} hasProjects={projects.some((project) => project.archivedAt === null)} />
    </div>
  );
});

function QuickEntryPreview({ id, entry, hasProjects }: { id: string; entry: QuickEntry; hasProjects: boolean }) {
  return (
    <p id={id} aria-live="polite" className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5 px-1 text-xs text-zinc-400">
      {entry.tokens.length === 0 ? (
        <span>
          Astuce : {hasProjects ? <kbd className="font-mono text-zinc-300">#projet</kbd> : null}
          {hasProjects ? ' et ' : null}
          <kbd className="font-mono text-zinc-300">~3</kbd> {hasProjects ? 'classent et estiment' : 'estime'} l’objectif.
        </span>
      ) : (
        <>
          <span className="sr-only">Reconnu :</span>
          {entry.tokens.map((token) =>
            token.kind === 'project' ? (
              <span key="project" className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-zinc-200 ring-1 ring-white/10">
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: token.project.color }} />
                Projet : {token.project.name}
              </span>
            ) : (
              <span key="estimate" className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-zinc-200 ring-1 ring-white/10">
                <Timer className="size-3" aria-hidden />
                Estimation : {token.value} pomodoro{token.value > 1 ? 's' : ''}
              </span>
            ),
          )}
        </>
      )}
    </p>
  );
}
