import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import * as stats from '../domain/stats';
import { loadReportsPage, loadStatsPage } from '../routes';
import { STORAGE_KEYS } from '../utils/constants';
import { shiftDateKey, toDateKey } from '../utils/format';

vi.mock('../utils/download', () => ({ downloadText: vi.fn() }));
vi.mock('../utils/pdf', () => ({ exportReportPdf: vi.fn(async () => undefined) }));
vi.mock('../utils/sound', () => ({ playChime: vi.fn(), unlockAudio: vi.fn() }));
vi.mock('../domain/stats', async (importOriginal) => {
  const original = await importOriginal<typeof import('../domain/stats')>();
  return { ...original, buildStats: vi.fn(original.buildStats) };
});

beforeAll(async () => {
  await Promise.all([loadStatsPage(), loadReportsPage()]);
});

const today = () => toDateKey(Date.now());
const at = (date: string, hour: number) => {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hour).getTime();
};

/** Trois jours consécutifs d'activité, dont aujourd'hui, et un projet. */
function seedHistory() {
  const t = today();
  const days = [shiftDateKey(t, -2), shiftDateKey(t, -1), t];
  const logs = Object.fromEntries(
    days.map((date, index) => [
      date,
      {
        date,
        sessions: [
          { id: `focus:${date}`, mode: 'focus', startedAt: at(date, 9), endedAt: at(date, 9) + 1_500_000, durationSeconds: 1500, completed: true, taskId: index === 2 ? 't1' : null },
        ],
      },
    ]),
  );
  window.localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
  window.localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify([{ id: 'p1', name: 'Site Acme', color: '#34d399', client: null, createdAt: 1, archivedAt: null }]));
  window.localStorage.setItem(
    STORAGE_KEYS.tasks,
    JSON.stringify([{ id: 't1', title: 'Maquette', completed: false, createdAt: 1, completedAt: null, projectId: 'p1' }]),
  );
  window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ dailyGoal: 2, soundEnabled: false }));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Page Statistiques (EF-R03, EF-T07)', () => {
  it('affiche totaux, série, objectif, répartition et tableaux de données', async () => {
    seedHistory();
    window.history.replaceState(null, '', '/stats');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Statistiques' })).toBeInTheDocument();

    const kpis = screen.getByRole('region', { name: 'Indicateurs' });
    expect(within(kpis).getByText('Focus sur 7 jours').parentElement?.parentElement).toHaveTextContent('1 h 15 min');
    expect(within(kpis).getByText('Série en cours').parentElement?.parentElement).toHaveTextContent('3 j');

    const meter = screen.getAllByRole('meter', { name: 'Objectif quotidien de cycles' })[0] as HTMLElement;
    expect(meter).toHaveAttribute('aria-valuetext', '1 cycle sur 2');
    fireEvent.click(screen.getByRole('button', { name: 'Diminuer l’objectif quotidien' }));
    expect(meter).toHaveAttribute('aria-valuetext', '1 cycle sur 1, objectif atteint');
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.settings) ?? '{}')).toMatchObject({ dailyGoal: 1 });

    const projects = screen.getByRole('region', { name: 'Répartition par projet' });
    expect(projects).toHaveTextContent('Site Acme');
    expect(projects).toHaveTextContent('Sans projet');

    // Navigation clavier dans le graphique en barres.
    const chart = screen.getByRole('group', { name: /Temps de focus par jour sur 7 jours/ });
    fireEvent.keyDown(chart, { key: 'End' });
    expect(document.getElementById(chart.getAttribute('aria-describedby') ?? '')).toHaveTextContent('25 min de focus, 1 cycle');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    fireEvent.keyDown(chart, { key: 'Home' });
    expect(document.getElementById(chart.getAttribute('aria-describedby') ?? '')).toHaveTextContent('0 s de focus, 0 cycle');

    fireEvent.click(screen.getByRole('radio', { name: '30 jours' }));
    expect(within(kpis).getByText('Focus sur 30 jours')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Temps de focus par jour sur 30 jours' }).querySelectorAll('tbody tr')).toHaveLength(30);
    expect(screen.getByRole('table', { name: 'Temps de focus par mois sur 12 mois' })).toBeInTheDocument();
  });

  it('ne recalcule pas les statistiques à chaque tic du minuteur (PERF-4)', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    seedHistory();
    window.history.replaceState(null, '', '/stats');
    render(<App />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByRole('heading', { name: 'Statistiques' })).toBeInTheDocument();
    const calls = vi.mocked(stats.buildStats).mock.calls.length;
    expect(calls).toBeGreaterThan(0);

    fireEvent.keyDown(window, { code: 'Space' }); // démarre le minuteur
    act(() => {
      vi.advanceTimersByTime(10_000); // ≈ 40 tics
    });
    expect(document.title).toMatch(/^▶ 24:5\d/);
    expect(vi.mocked(stats.buildStats).mock.calls.length).toBe(calls);
  });
});

describe('Page Rapports (EF-R02, EF-R04)', () => {
  it('rapport de la semaine, filtre projet, navigation et exports', async () => {
    seedHistory();
    window.history.replaceState(null, '', '/rapports');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Rapports', level: 1 })).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Résumé de la période' });

    // Semaine en cours par défaut : le total dépend du jour de la semaine ; on passe au mois puis à une plage libre.
    fireEvent.click(screen.getByRole('radio', { name: 'Plage libre' }));
    fireEvent.change(screen.getByLabelText('Du'), { target: { value: shiftDateKey(today(), -6) } });
    fireEvent.change(screen.getByLabelText('Au'), { target: { value: today() } });
    expect(within(summary).getByText('Temps de focus').parentElement?.parentElement).toHaveTextContent('1 h 15 min');
    expect(within(summary).getByText('Sessions').parentElement?.parentElement).toHaveTextContent('3');

    fireEvent.change(screen.getByRole('combobox', { name: 'Projet' }), { target: { value: 'p1' } });
    expect(within(summary).getByText('Temps de focus').parentElement?.parentElement).toHaveTextContent('25 min');
    expect(screen.getByText('Projet : Site Acme')).toBeInTheDocument();

    const { downloadText } = await import('../utils/download');
    fireEvent.click(screen.getByRole('button', { name: 'CSV des sessions' }));
    const [csv, filename, mime] = vi.mocked(downloadText).mock.calls[0] ?? [];
    expect(filename).toBe(`focusdeck-rapport-${shiftDateKey(today(), -6)}_${today()}.csv`);
    expect(mime).toBe('text/csv');
    expect(csv?.split('\r\n')).toHaveLength(3); // en-tête + 1 session + fin de ligne
    expect(csv).toContain(';Maquette;Site Acme');

    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }));
    expect(vi.mocked(downloadText).mock.calls[1]?.[1]).toMatch(/\.md$/);
    const { exportReportPdf } = await import('../utils/pdf');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    });
    expect(exportReportPdf).toHaveBeenCalledWith(expect.objectContaining({ scope: 'Site Acme', focusSeconds: 1500 }));

    // Jour, puis navigation vers la veille.
    fireEvent.click(screen.getByRole('radio', { name: 'Jour' }));
    expect(screen.getByRole('button', { name: 'Période suivante' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Période précédente' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Projet' }), { target: { value: 'all' } });
    expect(within(summary).getByText('Cycles terminés').parentElement?.parentElement).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'Aujourd’hui' }));
    expect(screen.getByRole('button', { name: 'Période suivante' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Mois' }));
    expect(screen.getByRole('button', { name: 'Période précédente' }).nextElementSibling?.textContent).toMatch(/^[a-zéû]+ \d{4}$/);
  });

  it('copie le rapport et signale un échec d’export PDF', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { exportReportPdf } = await import('../utils/pdf');
    vi.mocked(exportReportPdf).mockRejectedValueOnce(new Error('boom'));
    window.history.replaceState(null, '', '/rapports');
    render(<App />);
    await screen.findByRole('heading', { name: 'Rapports', level: 1 });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copier' }));
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('# Rapport FocusDeck'));
    expect(screen.getByRole('button', { name: 'Copié' })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'PDF' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('La génération du PDF a échoué');
  });
});
