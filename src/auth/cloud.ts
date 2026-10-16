import type { SupabaseClient } from '@supabase/supabase-js';

export interface CloudConfig {
  url: string;
  publishableKey: string;
}

/**
 * Configuration Supabase. Sans elle, FocusDeck fonctionne en mode local pur (EF-C01) :
 * aucun bouton de connexion, aucune requête réseau, `supabase-js` jamais chargé.
 */
export function cloudConfig(): CloudConfig | null {
  const url: unknown = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey: unknown = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof url !== 'string' || !/^https:\/\/[^/]+$/.test(url)) return null;
  if (typeof publishableKey !== 'string' || publishableKey.length < 20) return null;
  return { url, publishableKey };
}

let client: Promise<SupabaseClient> | null = null;

/** Charge `supabase-js` à la demande (chunk séparé, hors bundle initial — PERF-1). */
export function loadSupabase(config: CloudConfig): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    }),
  );
  return client;
}
