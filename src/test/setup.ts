import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { beforeEach } from 'vitest';

// Les pages chargées à la demande (statistiques, rapports) se rendent plus lentement quand toute
// la suite tourne en parallèle sous instrumentation de couverture : 1 s par défaut ne suffit pas.
configure({ asyncUtilTimeout: 4000 });

// Chaque test démarre sur le tableau de bord (le routeur lit window.location).
beforeEach(() => {
  // Les tests de base de données (supabase/tests) tournent sous Node, sans `window`.
  if (typeof window !== 'undefined') window.history.replaceState(null, '', '/');
});
