import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// Chaque test démarre sur le tableau de bord (le routeur lit window.location).
beforeEach(() => {
  // Les tests de base de données (supabase/tests) tournent sous Node, sans `window`.
  if (typeof window !== 'undefined') window.history.replaceState(null, '', '/');
});
