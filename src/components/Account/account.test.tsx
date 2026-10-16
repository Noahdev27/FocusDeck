import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { createMemoryRemote, createMemoryServer, type MemoryServer } from '../../data/sync/memoryRemote';
import { STORAGE_KEYS } from '../../utils/constants';

// --- Faux Supabase : authentification simulée, serveur de données en mémoire ---------
type AuthListener = (event: string, session: { user: { id: string; email: string } } | null) => void;
const auth = {
  session: null as { user: { id: string; email: string } } | null,
  listeners: new Set<AuthListener>(),
  signInWithOtp: vi.fn(async () => ({ error: null })),
  signInWithOAuth: vi.fn(async () => ({ error: null })),
};
const fakeClient = {
  auth: {
    getSession: async () => ({ data: { session: auth.session } }),
    onAuthStateChange: (listener: AuthListener) => {
      auth.listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => auth.listeners.delete(listener) } } };
    },
    signInWithOtp: auth.signInWithOtp,
    signInWithOAuth: auth.signInWithOAuth,
    signOut: vi.fn(async () => {
      auth.session = null;
      for (const listener of auth.listeners) listener('SIGNED_OUT', null);
      return { error: null };
    }),
  },
};
let server: MemoryServer;

vi.mock('../../auth/cloud', () => ({
  cloudConfig: () => ({ url: 'https://projet.supabase.co', publishableKey: 'sb_publishable_test_0123456789' }),
  loadSupabase: async () => fakeClient,
}));
vi.mock('../../data/supabase/supabaseRemote', () => ({
  createSupabaseRemote: () => createMemoryRemote(server),
}));

const USER = { id: '00000000-0000-4000-8000-0000000000aa', email: 'noe@exemple.fr' };

beforeEach(() => {
  window.localStorage.clear();
  server = createMemoryServer();
  auth.session = null;
  auth.listeners.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('Comptes (EF-C02 à C06)', () => {
  it('envoie un lien magique et signale une adresse invalide', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Se connecter/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Se connecter' });
    const input = within(dialog).getByLabelText('Adresse e-mail');

    fireEvent.change(input, { target: { value: 'pas-une-adresse' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Adresse e-mail invalide');

    fireEvent.change(input, { target: { value: '  Noe@Exemple.fr ' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(await within(dialog).findByText(/Lien envoyé à/)).toHaveTextContent('noe@exemple.fr');
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'noe@exemple.fr', options: { emailRedirectTo: window.location.origin } });
  });

  it('propose la connexion Google', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Se connecter/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continuer avec Google' }));
    await waitFor(() => expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: window.location.origin } }));
  });

  it('connecté : synchronise les objectifs, puis efface l’appareil à la déconnexion', async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.tasks,
      JSON.stringify([{ id: '20000000-0000-4000-8000-000000000001', title: 'Créée sans compte', completed: false, createdAt: 1, completedAt: null }]),
    );
    auth.session = { user: USER };
    render(<App />);

    const account = await screen.findByRole('button', { name: /Mon compte/ });
    // Fusion à la connexion : la tâche locale part sur le serveur.
    await waitFor(() => expect([...server.tasks.values()].map((t) => t.value.task.title)).toEqual(['Créée sans compte']));

    const input = screen.getByLabelText('Nouvel objectif');
    fireEvent.change(input, { target: { value: 'Ajoutée connectée' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    await waitFor(() => expect(server.tasks.size).toBe(2));

    fireEvent.click(account);
    const dialog = await screen.findByRole('dialog', { name: 'Mon compte' });
    expect(within(dialog).getByText('noe@exemple.fr')).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByText('Synchronisé')).toBeInTheDocument());

    fireEvent.click(within(dialog).getByRole('radio', { name: /Effacer les données de cet appareil/ }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /Se déconnecter/ }));
    });
    expect(fakeClient.auth.signOut).toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEYS.tasks)).toBeNull();
    expect(await screen.findByRole('button', { name: /Se connecter/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(0));
    // Rien n'est supprimé du compte.
    expect(server.tasks.size).toBe(2);
  });

  it('garde une copie locale si demandé', async () => {
    auth.session = { user: USER };
    render(<App />);
    // Attendre la bascule en mode connecté (l'arbre se remonte) avant de saisir.
    const account = await screen.findByRole('button', { name: /Mon compte/ });
    const input = screen.getByLabelText('Nouvel objectif');
    fireEvent.change(input, { target: { value: 'À garder' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    await waitFor(() => expect(server.tasks.size).toBe(1));

    fireEvent.click(account);
    const dialog = await screen.findByRole('dialog', { name: 'Mon compte' });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: /Se déconnecter/ }));
    });
    expect(await screen.findByRole('button', { name: /Se connecter/ })).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'À garder' })).toBeInTheDocument();
  });
});
