import type { Project } from '../types';
import { MAX_PROJECTS, PROJECT_CLIENT_MAX_LENGTH, PROJECT_NAME_MAX_LENGTH } from './constants';
import { slugify } from './quickEntry';
import { normalizeLabel, sanitizeProjects } from './validation';

export interface ProjectInput {
  name: string;
  color: string;
  client: string;
}

/**
 * Valide la saisie d'un projet. Deux projets actifs ne peuvent pas porter le même nom (à la
 * casse et aux accents près) : la saisie rapide `#projet` doit rester sans ambiguïté.
 */
export function validateProjectInput(input: ProjectInput, projects: readonly Project[], editingId: string | null = null): string | null {
  const name = normalizeLabel(input.name, PROJECT_NAME_MAX_LENGTH);
  if (name.length === 0) return 'Donnez un nom au projet.';
  const slug = slugify(name);
  if (slug.length === 0) return 'Le nom doit contenir au moins une lettre ou un chiffre.';
  if (projects.some((project) => project.id !== editingId && project.archivedAt === null && slugify(project.name) === slug)) {
    return 'Un projet actif porte déjà ce nom.';
  }
  if (editingId === null && projects.length >= MAX_PROJECTS) return `Limite de ${MAX_PROJECTS} projets atteinte.`;
  return null;
}

/** Construit un projet validé (couleur hors palette → couleur par défaut). */
export function buildProject(input: ProjectInput, id: string, now: number): Project | null {
  const [project] = sanitizeProjects([
    { id, name: input.name, color: input.color, client: normalizeLabel(input.client, PROJECT_CLIENT_MAX_LENGTH), createdAt: now, archivedAt: null },
  ]);
  return project ?? null;
}

/** Applique une modification en revalidant le résultat (le projet d'origine en cas d'échec). */
export function editProject(project: Project, patch: Partial<ProjectInput> & { archivedAt?: number | null }): Project {
  const [next] = sanitizeProjects([{ ...project, ...patch }]);
  return next ?? project;
}
