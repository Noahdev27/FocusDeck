import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { STORAGE_KEYS } from '../../utils/constants';
import { shiftDateKey, toDateKey } from '../../utils/format';

vi.mock('../../utils/sound', () => ({ playChime: vi.fn(), unlockAudio: vi.fn() }));

type StoredTask = { title: string; projectId: string | null; estimate: number | null; plannedFor: string | null };
const stored = <T,>(key: string): T => JSON.parse(window.localStorage.getItem(key) ?? 'null') as T;
const gone = (query: () => HTMLElement | null) => waitFor(() => expect(query()).not.toBeInTheDocument());

const type = (value: string) => fireEvent.change(screen.getByLabelText('Nouvel objectif'), { target: { value } });
const submit = () => fireEvent.submit(screen.getByLabelText('Nouvel objectif').closest('form') as HTMLFormElement);
const addTask = (title: string) => {
  type(title);
  submit();
};

const PROJECT = { id: 'p1', name: 'Site Acme', color: '#34d399', client: 'Acme', createdAt: 1, archivedAt: null };
const seedProject = () => window.localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify([PROJECT]));

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Projets (EF-O03)', () => {
  it('crée, valide, modifie, archive et restaure un projet', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Projets' }));
    const dialog = await screen.findByRole('dialog', { name: 'Projets' });
    expect(within(dialog).getByText('Aucun projet pour l’instant.')).toBeInTheDocument();

    const form = within(dialog).getByRole('form', { name: 'Nouveau projet' });
    fireEvent.change(within(form).getByLabelText('Nom du projet'), { target: { value: '  Site Acme ' } });
    fireEvent.change(within(form).getByLabelText('Client (facultatif)'), { target: { value: 'Acme' } });
    fireEvent.click(within(form).getByRole('radio', { name: 'Émeraude' }));
    fireEvent.submit(form);
    expect(stored<unknown[]>(STORAGE_KEYS.projects)).toEqual([
      expect.objectContaining({ name: 'Site Acme', client: 'Acme', color: '#34d399', archivedAt: null }),
    ]);

    // Doublon (casse et accents ignorés) refusé avec un message.
    const again = within(dialog).getByRole('form', { name: 'Nouveau projet' });
    fireEvent.change(within(again).getByLabelText('Nom du projet'), { target: { value: 'site acmé' } });
    fireEvent.submit(again);
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Un projet actif porte déjà ce nom.');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Modifier « Site Acme »' }));
    const edit = within(dialog).getByRole('form', { name: 'Modifier Site Acme' });
    fireEvent.change(within(edit).getByLabelText('Nom du projet'), { target: { value: 'Site Acme v2' } });
    fireEvent.click(within(edit).getByRole('button', { name: 'Enregistrer' }));
    expect(within(dialog).getByText('Site Acme v2')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Archiver « Site Acme v2 »' }));
    expect(within(dialog).getByText('Archivés (1)')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restaurer « Site Acme v2 »' }));
    expect(within(dialog).getByText('Actifs (1)')).toBeInTheDocument();
  });

  it('associe un projet et une estimation à une tâche, puis filtre par projet', async () => {
    seedProject();
    render(<App />);
    addTask('Courses');
    addTask('Maquette');

    fireEvent.click(screen.getByRole('button', { name: 'Options de « Maquette »' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Projet' }), { target: { value: 'p1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Estimation' }), { target: { value: '2' } });
    expect(stored<StoredTask[]>(STORAGE_KEYS.tasks)[0]).toMatchObject({ title: 'Maquette', projectId: 'p1', estimate: 2 });
    expect(screen.getByRole('img', { name: '0 pomodoro réalisé sur 2 estimés' })).toBeInTheDocument();

    const filterSelect = screen.getByRole('combobox', { name: 'Filtrer par projet' });
    fireEvent.change(filterSelect, { target: { value: 'p1' } });
    await gone(() => screen.queryByRole('checkbox', { name: 'Courses' }));
    // Un objectif ajouté sous un filtre de projet rejoint ce projet.
    addTask('Intégration');
    expect(stored<StoredTask[]>(STORAGE_KEYS.tasks)[0]).toMatchObject({ title: 'Intégration', projectId: 'p1' });

    fireEvent.change(filterSelect, { target: { value: 'none' } });
    expect(await screen.findByRole('checkbox', { name: 'Courses' })).toBeInTheDocument();
    await gone(() => screen.queryByRole('checkbox', { name: 'Maquette' }));
  });
});

describe('Saisie rapide (EF-O07)', () => {
  it('affiche les jetons reconnus et crée la tâche classée et estimée', () => {
    seedProject();
    render(<App />);
    type('Maquette accueil #site ~3');
    const input = screen.getByLabelText('Nouvel objectif');
    const preview = document.getElementById(input.getAttribute('aria-describedby') ?? '') as HTMLElement;
    expect(preview).toHaveTextContent('Projet : Site Acme');
    expect(preview).toHaveTextContent('Estimation : 3 pomodoros');
    submit();
    expect(stored<StoredTask[]>(STORAGE_KEYS.tasks)).toEqual([
      expect.objectContaining({ title: 'Maquette accueil', projectId: 'p1', estimate: 3 }),
    ]);
    expect(screen.getByRole('checkbox', { name: 'Maquette accueil' })).toBeInTheDocument();
  });
});

describe('Tâche active (EF-T03, EF-O02)', () => {
  it('lance un focus sur une tâche, enregistre la session et compte les pomodoros', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ focusMinutes: 1, shortBreakMinutes: 1, soundEnabled: false }));
    render(<App />);
    addTask('Rédiger ~1');

    fireEvent.click(screen.getByRole('button', { name: 'Lancer un focus sur « Rédiger »' }));
    expect(screen.getByRole('button', { name: /Pause/ })).toBeInTheDocument();
    expect(screen.getByText('Tâche en cours')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    const [log] = Object.values(stored<Record<string, { sessions: { mode: string; taskId: string | null }[] }>>(STORAGE_KEYS.logs));
    const [task] = stored<{ id: string }[]>(STORAGE_KEYS.tasks);
    expect(log?.sessions).toEqual([expect.objectContaining({ mode: 'focus', taskId: task?.id })]);
    expect(screen.getAllByRole('img', { name: '1 pomodoro réalisé sur 1 estimé' })).not.toHaveLength(0);

    // Depuis la pause : nouveau focus sur la même tâche → estimation dépassée.
    fireEvent.click(screen.getByRole('button', { name: 'Lancer un focus sur « Rédiger »' }));
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getAllByRole('img', { name: '2 pomodoros réalisés sur 1 estimé, estimation dépassée' })).not.toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Détacher la tâche du minuteur' }));
    expect(screen.queryByText('Tâche en cours')).not.toBeInTheDocument();
  });
});

describe('Annulation et report (EF-O05, EF-O06)', () => {
  it('annule une suppression depuis le toast, qui disparaît après 5 s', async () => {
    render(<App />);
    addTask('Première');
    addTask('Seconde');
    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer' })[1] as HTMLElement);
    await gone(() => screen.queryByRole('checkbox', { name: 'Première' }));

    const notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('« Première » supprimé.')).toBeInTheDocument();
    fireEvent.click(within(notifications).getByRole('button', { name: 'Annuler' }));
    expect(await screen.findByRole('checkbox', { name: 'Première' })).toBeInTheDocument();
    expect(stored<StoredTask[]>(STORAGE_KEYS.tasks).map((t) => t.title)).toEqual(['Seconde', 'Première']);

    // Suppression au clavier : le focus passe sur « Annuler » (le bouton activé a disparu).
    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer' })[0] as HTMLElement, { detail: 0 });
    const undo = await within(notifications).findByRole('button', { name: 'Annuler' });
    await waitFor(() => expect(undo).toHaveFocus());
    fireEvent.keyDown(undo, { key: 'Escape' });
    await gone(() => within(notifications).queryByText('« Seconde » supprimé.'));
  });

  it('ferme le toast automatiquement, sauf pendant le survol', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    render(<App />);
    addTask('Éphémère');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Éphémère' }));
    fireEvent.click(screen.getByRole('button', { name: 'Effacer terminés' }));
    const notifications = screen.getByRole('region', { name: 'Notifications' });
    const message = within(notifications).getByText('1 objectif terminé effacé.');

    fireEvent.mouseEnter(message.parentElement as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(within(notifications).getByText('1 objectif terminé effacé.')).toBeInTheDocument();
    fireEvent.mouseLeave(message.parentElement as HTMLElement);
    act(() => {
      vi.advanceTimersByTime(5_100);
    });
    vi.useRealTimers(); // animation de sortie
    await gone(() => within(notifications).queryByRole('button', { name: 'Annuler' }));
  });

  it('reporte au lendemain, puis remet à aujourd’hui', async () => {
    render(<App />);
    addTask('Facturer');
    fireEvent.click(screen.getByRole('button', { name: 'Options de « Facturer »' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reporter à demain' }));
    await gone(() => screen.queryByRole('checkbox', { name: 'Facturer' }));
    expect(stored<StoredTask[]>(STORAGE_KEYS.tasks)[0]?.plannedFor).toBe(shiftDateKey(toDateKey(Date.now()), 1));

    fireEvent.click(screen.getByRole('button', { name: 'Reportés (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remettre « Facturer » à aujourd’hui' }));
    expect(await screen.findByRole('checkbox', { name: 'Facturer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reportés/ })).not.toBeInTheDocument();
  });

  it('sans report automatique, un objectif prévu hier est signalé en retard', () => {
    const yesterday = shiftDateKey(toDateKey(Date.now()), -1);
    window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ autoPostpone: false }));
    window.localStorage.setItem(
      STORAGE_KEYS.tasks,
      JSON.stringify([{ id: 't', title: 'Relancer le client', completed: false, createdAt: 1, completedAt: null, plannedFor: yesterday }]),
    );
    render(<App />);
    expect(screen.getByText(/En retard · prévue/)).toBeInTheDocument();
  });
});

describe('Mode concentration (EF-T06)', () => {
  it('s’ouvre avec F, pilote le minuteur avec Espace et se ferme avec Échap', async () => {
    render(<App />);
    fireEvent.keyDown(window, { code: 'KeyF', key: 'f' });
    const view = await screen.findByRole('dialog', { name: 'Mode concentration' });
    expect(within(view).getByRole('button', { name: /Démarrer/ })).toHaveFocus();

    // Espace hors d'un bouton : le minuteur démarre.
    fireEvent.keyDown(document.body, { code: 'Space', key: ' ' });
    expect(within(view).getByRole('button', { name: /Pause/ })).toBeInTheDocument();
    fireEvent.keyDown(document.body, { code: 'Escape', key: 'Escape' });
    await gone(() => screen.queryByRole('dialog', { name: 'Mode concentration' }));

    fireEvent.click(screen.getByRole('button', { name: 'Mode concentration (F)' }));
    const again = await screen.findByRole('dialog', { name: 'Mode concentration' });
    fireEvent.click(within(again).getByRole('button', { name: /Quitter/ }));
    await gone(() => screen.queryByRole('dialog', { name: 'Mode concentration' }));
  });
});
