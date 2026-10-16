import { deploymentEnvironment, sentryDsn } from './env';
import { filterBreadcrumb, scrubEvent } from './privacy';

type SentryModule = typeof import('@sentry/react');

let sentry: SentryModule | null = null;
const pending: unknown[] = [];

/**
 * Charge Sentry à la demande (chunk séparé, hors bundle initial) si un DSN est
 * configuré. Les erreurs signalées avant la fin du chargement sont mises en file.
 */
export async function initErrorTracking(): Promise<void> {
  const dsn = sentryDsn();
  if (!dsn || sentry) return;
  const module = await import('@sentry/react');
  module.init({
    dsn,
    environment: deploymentEnvironment() ?? 'development',
    release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined,
    // Aucune collecte automatique de données personnelles (OBS-1).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    // Pas de traces ni de rejeu de session : uniquement les erreurs.
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => filterBreadcrumb(breadcrumb),
  });
  sentry = module;
  for (const error of pending.splice(0)) module.captureException(error);
}

/** Signale une erreur (rendu React, export PDF…) sans jamais lever d'exception. */
export function reportError(error: unknown): void {
  if (sentry) sentry.captureException(error);
  else if (sentryDsn()) pending.push(error);
}
