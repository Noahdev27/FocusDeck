/**
 * Filtrage des données envoyées aux services de suivi (OBS-1, RGPD).
 *
 * Principe : liste blanche. Les titres de tâches, noms de projets ou e-mails
 * peuvent apparaître dans le DOM (libellés ARIA, textes de boutons) : on ne
 * conserve donc que les informations techniques nécessaires au diagnostic.
 */

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Remplace les adresses e-mail par un marqueur. */
export function redactEmails(text: string): string {
  return text.replace(EMAIL_PATTERN, '[email]');
}

/** Ne garde que le chemin d'une URL (ni requête, ni fragment, ni identifiants). */
export function stripUrl(url: string): string {
  try {
    const parsed = new URL(url, 'https://focusdeck.invalid');
    return parsed.origin === 'https://focusdeck.invalid' ? parsed.pathname : `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '[url]';
  }
}

/** Catégories de fil d'Ariane sans contenu saisi par l'utilisateur. */
const SAFE_BREADCRUMB_CATEGORIES = new Set(['navigation', 'fetch', 'xhr']);

export interface BreadcrumbLike {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
}

/**
 * Les clics (`ui.click`) et la console peuvent contenir des titres de tâches :
 * on les supprime. Les navigations et requêtes sont gardées, URLs réduites au chemin.
 */
export function filterBreadcrumb<T extends BreadcrumbLike>(breadcrumb: T): T | null {
  if (!breadcrumb.category || !SAFE_BREADCRUMB_CATEGORIES.has(breadcrumb.category)) return null;
  const data: Record<string, unknown> = {};
  for (const key of ['from', 'to', 'url', 'method', 'status_code'] as const) {
    const value = breadcrumb.data?.[key];
    if (value === undefined) continue;
    data[key] = typeof value === 'string' && key !== 'method' ? stripUrl(value) : value;
  }
  const { message: _message, ...rest } = breadcrumb;
  void _message;
  return { ...rest, data } as T;
}

export interface EventLike {
  message?: string;
  user?: unknown;
  request?: { url?: string; headers?: unknown; cookies?: unknown; data?: unknown; query_string?: unknown };
  extra?: unknown;
  breadcrumbs?: BreadcrumbLike[];
  exception?: { values?: { value?: string }[] };
}

/** Nettoie un événement d'erreur avant envoi. */
export function scrubEvent<T extends EventLike>(event: T): T {
  const scrubbed: T = { ...event };
  delete scrubbed.user;
  delete scrubbed.extra;
  if (scrubbed.message) scrubbed.message = redactEmails(scrubbed.message);
  if (scrubbed.request) {
    scrubbed.request = scrubbed.request.url ? { url: stripUrl(scrubbed.request.url) } : {};
  }
  if (scrubbed.exception?.values) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map((value) =>
        value.value ? { ...value, value: redactEmails(value.value) } : value,
      ),
    };
  }
  if (scrubbed.breadcrumbs) {
    scrubbed.breadcrumbs = scrubbed.breadcrumbs
      .map((breadcrumb) => filterBreadcrumb(breadcrumb))
      .filter((breadcrumb): breadcrumb is BreadcrumbLike => breadcrumb !== null);
  }
  return scrubbed;
}
