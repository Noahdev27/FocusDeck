import { deploymentEnvironment } from './env';

/** Événements produit mesurés (aucune donnée personnelle dans les propriétés). */
export type AnalyticsEvent =
  | { name: 'cycle_completed'; properties: { mode: 'focus' | 'shortBreak' | 'longBreak' } }
  | { name: 'report_exported'; properties: { format: 'markdown' | 'pdf' } }
  | { name: 'signed_up'; properties: Record<string, never> }
  | { name: 'upgraded_to_pro'; properties: { period: 'monthly' | 'yearly' } };

type AnalyticsModule = typeof import('@vercel/analytics');

let enabled = true;
let analytics: AnalyticsModule | null = null;

/** Préférence utilisateur (réglage « Mesure d'audience anonyme »). */
export function setAnalyticsEnabled(value: boolean): void {
  enabled = value;
}

/**
 * Vercel Analytics et Speed Insights : sans cookie, chargés uniquement sur un
 * déploiement Vercel. Le script est servi par le même domaine (`/_vercel/…`),
 * la CSP `'self'` suffit.
 */
export async function initAnalytics(): Promise<void> {
  const environment = deploymentEnvironment();
  if (!environment || analytics) return;
  const [module, speed] = await Promise.all([import('@vercel/analytics'), import('@vercel/speed-insights')]);
  module.inject({
    mode: environment === 'production' ? 'production' : 'development',
    // Chaque envoi respecte la préférence courante ; les URLs sont réduites au chemin.
    beforeSend: (event) => (enabled ? { ...event, url: event.url.split(/[?#]/)[0] ?? event.url } : null),
  });
  speed.injectSpeedInsights({ beforeSend: (event) => (enabled ? event : null) });
  analytics = module;
}

export function trackEvent(event: AnalyticsEvent): void {
  if (!enabled || !analytics) return;
  analytics.track(event.name, event.properties);
}
