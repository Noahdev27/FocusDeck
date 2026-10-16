import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

// Chaque test démarre sur le tableau de bord (le routeur lit window.location).
beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
