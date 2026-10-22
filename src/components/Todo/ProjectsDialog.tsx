import { Archive, ArchiveRestore, Pencil } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useFocus, type ProjectResult } from '../../context/FocusContext';
import type { Project } from '../../types';
import { DEFAULT_PROJECT_COLOR, PROJECT_CLIENT_MAX_LENGTH, PROJECT_COLORS, PROJECT_NAME_MAX_LENGTH } from '../../utils/constants';
import type { ProjectInput } from '../../utils/projects';
import { Button, IconButton } from '../ui/Button';
import { Modal } from '../ui/Modal';

/** Gestion des projets (EF-O03) : création, modification, archivage. */
export function ProjectsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { projects, tasks, addProject, updateProject, setProjectArchived } = useFocus();
  const [editingId, setEditingId] = useState<string | null>(null);
  const active = projects.filter((project) => project.archivedAt === null);
  const archived = projects.filter((project) => project.archivedAt !== null);
  const taskCount = (id: string) => tasks.filter((task) => task.projectId === id && !task.completed).length;

  return (
    <Modal open={open} onClose={onClose} title="Projets" description="Regroupez vos objectifs par client ou par projet.">
      <ProjectForm key={projects.length} submitLabel="Créer le projet" onSubmit={addProject} />

      <h3 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Actifs ({active.length})</h3>
      {active.length === 0 ? (
        <p className="text-sm text-zinc-400">Aucun projet pour l’instant.</p>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {active.map((project) =>
            editingId === project.id ? (
              <li key={project.id} className="py-3">
                <ProjectForm
                  initial={project}
                  submitLabel="Enregistrer"
                  onSubmit={(input) => {
                    const result = updateProject(project.id, input);
                    if (result.ok) setEditingId(null);
                    return result;
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <ProjectRow key={project.id} project={project} detail={`${taskCount(project.id)} à faire`}>
                <IconButton label={`Modifier « ${project.name} »`} onClick={() => setEditingId(project.id)}>
                  <Pencil className="size-4" />
                </IconButton>
                <IconButton label={`Archiver « ${project.name} »`} onClick={() => setProjectArchived(project.id, true)}>
                  <Archive className="size-4" />
                </IconButton>
              </ProjectRow>
            ),
          )}
        </ul>
      )}

      {archived.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Archivés ({archived.length})</h3>
          <ul className="divide-y divide-white/[0.06]">
            {archived.map((project) => (
              <ProjectRow key={project.id} project={project} detail="Archivé">
                <IconButton label={`Restaurer « ${project.name} »`} onClick={() => setProjectArchived(project.id, false)}>
                  <ArchiveRestore className="size-4" />
                </IconButton>
              </ProjectRow>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

function ProjectRow({ project, detail, children }: { project: Project; detail: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{project.name}</p>
        <p className="truncate text-xs text-zinc-400">
          {project.client ? `${project.client} · ` : ''}
          {detail}
        </p>
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </li>
  );
}

interface ProjectFormProps {
  initial?: Project;
  submitLabel: string;
  onSubmit: (input: ProjectInput) => ProjectResult;
  onCancel?: () => void;
}

function ProjectForm({ initial, submitLabel, onSubmit, onCancel }: ProjectFormProps) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [client, setClient] = useState(initial?.client ?? '');
  const [color, setColor] = useState(initial?.color ?? DEFAULT_PROJECT_COLOR);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = onSubmit({ name, client, color });
    setError(result.ok ? null : result.error);
  };

  const fieldClass =
    'h-10 w-full rounded-xl bg-black/30 px-3 text-sm text-white ring-1 ring-white/10 placeholder:text-zinc-400 focus:outline-none focus-visible:ring-violet-400/60';

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]" aria-label={initial ? `Modifier ${initial.name}` : 'Nouveau projet'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-400">
          Nom du projet
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={PROJECT_NAME_MAX_LENGTH}
            required
            aria-invalid={error !== null}
            aria-describedby={error ? `${id}-error` : undefined}
            placeholder="ex. Site Acme"
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-400">
          Client (facultatif)
          <input
            value={client}
            onChange={(event) => setClient(event.target.value)}
            maxLength={PROJECT_CLIENT_MAX_LENGTH}
            placeholder="ex. Acme SAS"
            className={fieldClass}
          />
        </label>
      </div>

      <fieldset className="mt-3">
        <legend className="mb-2 text-xs font-medium text-zinc-400">Couleur</legend>
        <div className="flex flex-wrap gap-2">
          {PROJECT_COLORS.map((option) => (
            <label key={option.value} className="relative cursor-pointer" title={option.label}>
              <input
                type="radio"
                name={`${id}-color`}
                value={option.value}
                checked={color === option.value}
                onChange={() => setColor(option.value)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="block size-7 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-ink-800 transition peer-checked:ring-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-violet-400"
                style={{ backgroundColor: option.value }}
              />
              <span className="sr-only">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p id={`${id}-error`} role="alert" className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button size="sm" type="submit" variant="primary">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
