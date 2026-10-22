import type { Project } from '../types';
import { ESTIMATE_LIMITS } from './constants';
import { normalizeTaskTitle } from './validation';

export type QuickToken =
  | { kind: 'project'; raw: string; project: Project }
  | { kind: 'estimate'; raw: string; value: number };

export interface QuickEntry {
  /** Titre sans les jetons reconnus. */
  title: string;
  projectId: string | null;
  estimate: number | null;
  /** Jetons reconnus, pour l'aperçu pendant la saisie. */
  tokens: QuickToken[];
}

/** Forme comparable d'un nom : minuscules, sans accents, espaces ni ponctuation. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function findProject(query: string, projects: readonly Project[]): Project | null {
  const slug = slugify(query);
  if (slug.length === 0) return null;
  const active = projects.filter((project) => project.archivedAt === null);
  const exact = active.find((project) => slugify(project.name) === slug);
  if (exact) return exact;
  // Préfixe non ambigu : `#acme` trouve « Acme Corp » s'il est le seul à commencer ainsi.
  const prefixed = active.filter((project) => slugify(project.name).startsWith(slug));
  return prefixed.length === 1 ? (prefixed[0] ?? null) : null;
}

const PROJECT_TOKEN = /^#([\p{L}\p{N}_-]+)$/u;
const ESTIMATE_TOKEN = /^~(\d{1,2})$/;

/**
 * Saisie rapide (EF-O07) : `#projet` associe un projet existant, `~3` fixe l'estimation.
 * Seul le premier jeton de chaque sorte est retenu ; un jeton non reconnu (projet inconnu,
 * estimation hors bornes) reste dans le titre, tel que saisi.
 */
export function parseQuickEntry(input: string, projects: readonly Project[]): QuickEntry {
  const tokens: QuickToken[] = [];
  let project: Project | null = null;
  let estimate: number | null = null;
  const words: string[] = [];

  for (const word of input.split(/\s+/).filter(Boolean)) {
    const projectMatch: RegExpExecArray | null = project === null ? PROJECT_TOKEN.exec(word) : null;
    if (projectMatch?.[1]) {
      const found = findProject(projectMatch[1], projects);
      if (found) {
        project = found;
        tokens.push({ kind: 'project', raw: word, project: found });
        continue;
      }
    }
    const estimateMatch: RegExpExecArray | null = estimate === null ? ESTIMATE_TOKEN.exec(word) : null;
    if (estimateMatch?.[1]) {
      const value: number = Number(estimateMatch[1]);
      if (value >= ESTIMATE_LIMITS.min && value <= ESTIMATE_LIMITS.max) {
        estimate = value;
        tokens.push({ kind: 'estimate', raw: word, value });
        continue;
      }
    }
    words.push(word);
  }

  return { title: normalizeTaskTitle(words.join(' ')), projectId: project?.id ?? null, estimate, tokens };
}
