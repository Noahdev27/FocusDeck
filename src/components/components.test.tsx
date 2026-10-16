import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { STORAGE_KEYS } from '../utils/constants';

vi.mock('../utils/pdf', () => ({ exportReportPdf: vi.fn(async () => undefined) }));
vi.mock('../utils/download', () => ({ downloadText: vi.fn() }));
vi.mock('../utils/sound', () => ({ playChime: vi.fn(), unlockAudio: vi.fn() }));

const readSettings = () => JSON.parse(window.localStorage.getItem(STORAGE_KEYS.settings) ?? '{}') as Record<string, unknown>;

/** Attend la fin d'une animation de sortie Framer Motion. */
const gone = (query: () => HTMLElement | null) => waitFor(() => expect(query()).not.toBeInTheDocument());

const addTask = (title: string) => {
  const input = screen.getByLabelText('Nouvel objectif');
  fireEvent.change(input, { target: { value: title } });
  fireEvent.submit(input.closest('form') as HTMLFormElement);
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Réglages', () => {
  it('modifie les durées, les automatismes et le son', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Réglages du minuteur' }));
    const dialog = await screen.findByRole('dialog', { name: 'Réglages du minuteur' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Augmenter Focus' }));
    expect(readSettings().focusMinutes).toBe(26);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Diminuer Pause courte' }));
    expect(readSettings().shortBreakMinutes).toBe(4);

    const longBreak = within(dialog).getByRole('spinbutton', { name: 'Pause longue (min)' });
    fireEvent.change(longBreak, { target: { value: '500' } });
    fireEvent.blur(longBreak);
    expect(readSettings().longBreakMinutes).toBe(90);

    fireEvent.click(within(dialog).getByRole('switch', { name: 'Démarrer les pauses automatiquement' }));
    expect(readSettings().autoStartBreaks).toBe(true);

    fireEvent.change(within(dialog).getByLabelText('Volume'), { target: { value: '0.2' } });
    expect(readSettings().volume).toBe(0.2);
    const { playChime } = await import('../utils/sound');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tester' }));
    expect(playChime).toHaveBeenCalledWith('focus', 0.2);

    // Le minuteur inactif adopte la nouvelle durée.
    expect(screen.getByRole('timer')).toHaveTextContent('26:00');

    fireEvent.click(within(dialog).getByRole('button', { name: /Valeurs par défaut/ }));
    expect(readSettings().focusMinutes).toBe(25);

    fireEvent.keyDown(document, { key: 'Escape' });
    await gone(() => screen.queryByRole('dialog'));
  });
});

describe('Micro-objectifs', () => {
  it('renomme, filtre, supprime et efface les terminés', async () => {
    render(<App />);
    addTask('Préparer le devis');
    addTask('Appeler le client');

    fireEvent.click(screen.getAllByRole('button', { name: 'Renommer' })[0] as HTMLElement);
    const editor = screen.getByLabelText("Modifier l'objectif");
    fireEvent.change(editor, { target: { value: 'Appeler Marie' } });
    fireEvent.keyDown(editor, { key: 'Enter' });
    expect(screen.getByRole('checkbox', { name: 'Appeler Marie' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Préparer le devis' }));
    fireEvent.click(screen.getByRole('tab', { name: 'À faire' }));
    await gone(() => screen.queryByRole('checkbox', { name: 'Préparer le devis' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Terminées' }));
    expect(await screen.findByRole('checkbox', { name: 'Préparer le devis' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Toutes' }));

    fireEvent.click(screen.getByRole('button', { name: 'Effacer terminés' }));
    await gone(() => screen.queryByRole('checkbox', { name: 'Préparer le devis' }));

    fireEvent.click(screen.getByRole('button', { name: /^Supprimer$/ }));
    await gone(() => screen.queryByRole('checkbox'));
    expect(screen.getByText(/Découpez votre journée/)).toBeInTheDocument();
  });

  it('annule un renommage avec Échap et refuse un titre vide', () => {
    render(<App />);
    addTask('Tâche initiale');
    addTask('   ');
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Renommer' }));
    const editor = screen.getByLabelText("Modifier l'objectif");
    fireEvent.change(editor, { target: { value: 'Autre chose' } });
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(screen.getByRole('checkbox', { name: 'Tâche initiale' })).toBeInTheDocument();
  });
});

describe('Rapport', () => {
  it('affiche l’aperçu et la source, copie et exporte', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<App />);
    addTask('Livrer la maquette');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Livrer la maquette' }));

    fireEvent.click(screen.getByRole('button', { name: /Générer le rapport/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Rapport de fin de journée' });
    expect(within(dialog).getByRole('heading', { level: 1 })).toHaveTextContent('Rapport FocusDeck');
    expect(within(dialog).getByText(/Livrer la maquette/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Source Markdown' }));
    expect(await within(dialog).findByText(/\| Cycles Pomodoro terminés \| 0 \|/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Copier' }));
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('# Rapport FocusDeck'));
    expect(within(dialog).getByRole('button', { name: 'Copié' })).toBeInTheDocument();

    const { downloadText } = await import('../utils/download');
    fireEvent.click(within(dialog).getByRole('button', { name: /Télécharger \.md/ }));
    expect(downloadText).toHaveBeenCalledWith(expect.any(String), expect.stringMatching(/\.md$/), 'text/markdown');

    const { exportReportPdf } = await import('../utils/pdf');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'PDF' }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /Télécharger \.pdf/ }));
    });
    expect(exportReportPdf).toHaveBeenCalledOnce();
  });

  it('signale un échec d’export PDF et de copie', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('refusé'))) } });
    const { exportReportPdf } = await import('../utils/pdf');
    vi.mocked(exportReportPdf).mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Générer le rapport/ }));
    const dialog = await screen.findByRole('dialog');

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Copier' }));
    });
    expect(within(dialog).getByRole('button', { name: 'Échec' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('radio', { name: 'PDF' }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /Télécharger \.pdf/ }));
    });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('La génération du PDF a échoué');
  });
});

describe('Raccourcis clavier', () => {
  it('pilote le minuteur au clavier', async () => {
    render(<App />);
    const press = (code: string) => fireEvent.keyDown(window, { code });

    press('Space');
    expect(screen.getByRole('button', { name: /Pause/ })).toBeInTheDocument();
    press('Space');
    expect(screen.getByRole('button', { name: /Reprendre/ })).toBeInTheDocument();
    press('KeyR');
    expect(screen.getByRole('button', { name: /Démarrer/ })).toBeInTheDocument();

    press('Digit2');
    expect(screen.getByRole('tab', { name: /Pause courte/ })).toHaveAttribute('aria-selected', 'true');
    press('Digit3');
    expect(screen.getByRole('tab', { name: /Pause longue/ })).toHaveAttribute('aria-selected', 'true');
    press('KeyS');
    expect(screen.getByRole('tab', { name: /Focus/ })).toHaveAttribute('aria-selected', 'true');

    press('KeyN');
    expect(screen.getByLabelText('Nouvel objectif')).toHaveFocus();
    // Pendant la saisie, les raccourcis sont ignorés.
    fireEvent.keyDown(screen.getByLabelText('Nouvel objectif'), { code: 'Digit2' });
    expect(screen.getByRole('tab', { name: /Focus/ })).toHaveAttribute('aria-selected', 'true');

    (document.activeElement as HTMLElement).blur();
    press('Comma');
    expect(await screen.findByRole('dialog', { name: 'Réglages du minuteur' })).toBeInTheDocument();
    // Les raccourcis globaux sont désactivés quand une modale est ouverte.
    press('Digit2');
    expect(screen.getByRole('tab', { name: /Focus/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('ouvre l’aide des raccourcis', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Raccourcis clavier' }));
    const dialog = await screen.findByRole('dialog', { name: 'Raccourcis clavier' });
    expect(within(dialog).getByText('Démarrer / mettre en pause')).toBeInTheDocument();
  });
});
