import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS } from '../utils/constants';
import { cloudConfig, loadSupabase } from './cloud';

export interface AuthUser {
  id: string;
  email: string | null;
}

export type AuthState =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: AuthUser };

export interface AuthContextValue {
  state: AuthState;
  client: SupabaseClient | null;
  signInWithEmail: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** EF-C06 : garder une copie locale ou effacer les données de cet appareil. */
  signOut: (options: { keepLocalCopy: boolean }) => Promise<void>;
}

const DISABLED: AuthContextValue = {
  state: { status: 'disabled' },
  client: null,
  signInWithEmail: async () => undefined,
  signInWithGoogle: async () => undefined,
  signOut: async () => undefined,
};

const AuthContext = createContext<AuthContextValue>(DISABLED);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toAuthUser = (user: User): AuthUser => ({ id: user.id, email: user.email ?? null });

/** Efface toutes les données FocusDeck de ce navigateur (cache local et file de synchronisation). */
export function clearDeviceData(userId: string, storage: Storage = window.localStorage): void {
  for (const key of Object.values(STORAGE_KEYS)) storage.removeItem(key);
  const prefix = `focusdeck:v1:sync:${userId}:`;
  for (const key of Object.keys(storage)) if (key.startsWith(prefix)) storage.removeItem(key);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [config] = useState(cloudConfig);
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [state, setState] = useState<AuthState>(config ? { status: 'loading' } : { status: 'disabled' });

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void loadSupabase(config).then(async (supabase) => {
      if (cancelled) return;
      setClient(supabase);
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setState(data.session ? { status: 'signed-in', user: toAuthUser(data.session.user) } : { status: 'signed-out' });
      const subscription = supabase.auth.onAuthStateChange((_event, session) => {
        setState(session ? { status: 'signed-in', user: toAuthUser(session.user) } : { status: 'signed-out' });
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [config]);

  const signInWithEmail = useCallback(
    async (email: string) => {
      const clean = email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(clean)) throw new Error('Adresse e-mail invalide.');
      if (!client) throw new Error('Connexion indisponible pour le moment.');
      const { error } = await client.auth.signInWithOtp({ email: clean, options: { emailRedirectTo: window.location.origin } });
      if (error) throw new Error(error.message);
    },
    [client],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!client) throw new Error('Connexion indisponible pour le moment.');
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) throw new Error(error.message);
  }, [client]);

  const signOut = useCallback(
    async ({ keepLocalCopy }: { keepLocalCopy: boolean }) => {
      if (!client) return;
      if (!keepLocalCopy && state.status === 'signed-in') clearDeviceData(state.user.id);
      const { error } = await client.auth.signOut();
      if (error) throw new Error(error.message);
    },
    [client, state],
  );

  const value = useMemo<AuthContextValue>(
    () => (config ? { state, client, signInWithEmail, signInWithGoogle, signOut } : DISABLED),
    [config, state, client, signInWithEmail, signInWithGoogle, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
