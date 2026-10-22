import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import { parseQuickEntry, slugify } from './quickEntry';

const project = (id: string, name: string, archivedAt: number | null = null): Project => ({
  id,
  name,
  color: '#34d399',
  client: null,
  createdAt: 1,
  archivedAt,
});

const projects = [project('p1', 'Site Acme'), project('p2', 'Blog perso'), project('p3', 'Ancien', 5), project('p4', 'Site Beta')];

describe('parseQuickEntry (EF-O07)', () => {
  it('reconnaît #projet et ~estimation, n’importe où dans le titre', () => {
    expect(parseQuickEntry('Maquette accueil #siteacme ~3', projects)).toEqual({
      title: 'Maquette accueil',
      projectId: 'p1',
      estimate: 3,
      tokens: [
        { kind: 'project', raw: '#siteacme', project: projects[0] },
        { kind: 'estimate', raw: '~3', value: 3 },
      ],
    });
    expect(parseQuickEntry('~2 #Blog Relire l’article', projects)).toMatchObject({ title: 'Relire l’article', projectId: 'p2', estimate: 2 });
  });

  it('accepte un préfixe non ambigu, ignore accents et casse', () => {
    expect(parseQuickEntry('Article #BLÔG', projects).projectId).toBe('p2');
    // « #site » correspond à deux projets : il reste dans le titre.
    expect(parseQuickEntry('Refonte #site', projects)).toMatchObject({ title: 'Refonte #site', projectId: null, tokens: [] });
  });

  it('laisse dans le titre les jetons inconnus, archivés ou hors bornes', () => {
    expect(parseQuickEntry('Tâche #inconnu ~9 ~0 #ancien', projects)).toMatchObject({
      title: 'Tâche #inconnu ~9 ~0 #ancien',
      projectId: null,
      estimate: null,
    });
  });

  it('ne retient que le premier jeton de chaque sorte', () => {
    expect(parseQuickEntry('A #blog #siteacme ~1 ~2', projects)).toMatchObject({ title: 'A #siteacme ~2', projectId: 'p2', estimate: 1 });
  });

  it('peut produire un titre vide (refusé à l’ajout)', () => {
    expect(parseQuickEntry('  #blog ~4 ', projects)).toMatchObject({ title: '', projectId: 'p2', estimate: 4 });
  });

  it('slugify normalise accents, espaces et ponctuation', () => {
    expect(slugify('Été — Client Café !')).toBe('eteclientcafe');
  });
});
