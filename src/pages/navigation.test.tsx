import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../App';
import { STORAGE_KEYS } from '../utils/constants';

const desktopNav = () => screen.getAllByRole('navigation', { name: 'Navigation principale' })[0] as HTMLElement;

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('Navigation', () => {
  it('passe d’une page à l’autre en gardant le minuteur actif', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Démarrer/ }));

    fireEvent.click(within(desktopNav()).getByRole('link', { name: /Statistiques/ }));
    expect(await screen.findByRole('heading', { name: 'Statistiques' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/stats');
    expect(within(desktopNav()).getByRole('link', { name: /Statistiques/ })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(within(desktopNav()).getByRole('link', { name: /Rapports/ }));
    expect(await screen.findByRole('heading', { name: 'Rapports' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Retour au tableau de bord/ }));
    expect(await screen.findByRole('button', { name: /Pause/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('la page Réglages modifie les mêmes réglages que la boîte de dialogue', async () => {
    window.history.replaceState(null, '', '/reglages');
    render(<App />);
    const page = await screen.findByRole('region', { name: 'Réglages' });
    fireEvent.click(within(page).getByRole('button', { name: 'Augmenter Focus' }));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.settings) ?? '{}')).toMatchObject({ focusMinutes: 26 });
    fireEvent.click(within(page).getByRole('button', { name: /Valeurs par défaut/ }));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.settings) ?? '{}')).toMatchObject({ focusMinutes: 25 });
  });

  it('affiche une page introuvable pour une adresse inconnue', async () => {
    window.history.replaceState(null, '', '/nimporte-quoi');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument();
  });
});
