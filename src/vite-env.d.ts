/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Exposé automatiquement par Vercel au build : production | preview | development. */
  readonly VITE_VERCEL_ENV?: string;
  readonly VITE_VERCEL_GIT_COMMIT_SHA?: string;
  /** DSN public Sentry (facultatif : sans lui, aucun suivi d'erreurs n'est chargé). */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
