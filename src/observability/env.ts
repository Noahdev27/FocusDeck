/**
 * Environnement de déploiement exposé par Vercel au build (`VITE_VERCEL_ENV` :
 * `production` | `preview` | `development`). Absent en local et en CI : aucun
 * service tiers n'est alors chargé (tests déterministes, pas de requête externe).
 */
export function deploymentEnvironment(): string | null {
  const value: unknown = import.meta.env.VITE_VERCEL_ENV;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function sentryDsn(): string | null {
  const value: unknown = import.meta.env.VITE_SENTRY_DSN;
  return typeof value === 'string' && value.startsWith('https://') ? value : null;
}
