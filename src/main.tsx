import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { initAnalytics, initErrorTracking } from './observability';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable.');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Services tiers chargés après l'affichage, quand le navigateur est inactif (PERF-3).
const whenIdle = (task: () => void) => {
  // requestIdleCallback est absent de Safari : repli sur un délai.
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(task, { timeout: 3000 });
  else setTimeout(task, 1500);
};
whenIdle(() => {
  void initErrorTracking();
  void initAnalytics();
});
