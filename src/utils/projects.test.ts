import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import { DEFAULT_PROJECT_COLOR, MAX_PROJECTS } from './constants';
import { buildProject, editProject, validateProjectInput } from './projects';

const existing: Project[] = [
  { id: 'p1', name: 'Site Acme', color: '#34d399', client: null, createdAt: 1, archivedAt: null },
  { id: 'p2', name: 'Archivé', color: '#34d399', client: null, createdAt: 2, archivedAt: 3 },
];

describe('projets (EF-O03)', () => {
  it('refuse un nom vide ou déjà pris par un projet actif', () => {
    expect(validateProjectInput({ name: '   ', color: '', client: '' }, existing)).toMatch(/nom/);
    expect(validateProjectInput({ name: '!!!', color: '', client: '' }, existing)).toMatch(/lettre/);
    expect(validateProjectInput({ name: 'site acmé', color: '', client: '' }, existing)).toMatch(/déjà/);
    expect(validateProjectInput({ name: 'Archivé', color: '', client: '' }, existing)).toBeNull();
    expect(validateProjectInput({ name: 'Site Acme', color: '', client: '' }, existing, 'p1')).toBeNull();
  });

  it('borne le nombre de projets', () => {
    const many = Array.from({ length: MAX_PROJECTS }, (_, i) => ({ ...existing[0], id: `p${i}`, name: `P${i}` }) as Project);
    expect(validateProjectInput({ name: 'Nouveau', color: '', client: '' }, many)).toMatch(/Limite/);
  });

  it('construit et modifie un projet validé', () => {
    const project = buildProject({ name: '  Blog ', color: '#FB7185', client: '  ' }, 'id', 10);
    expect(project).toEqual({ id: 'id', name: 'Blog', color: '#fb7185', client: null, createdAt: 10, archivedAt: null });
    if (!project) throw new Error('projet attendu');
    expect(editProject(project, { color: 'violet', client: 'Moi' })).toMatchObject({ color: DEFAULT_PROJECT_COLOR, client: 'Moi' });
    expect(editProject(project, { name: '' })).toBe(project);
    expect(editProject(project, { archivedAt: 20 }).archivedAt).toBe(20);
  });
});
