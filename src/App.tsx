import { MotionConfig } from 'framer-motion';
import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { RepositoryProvider } from './data';
import { FocusProvider } from './context/FocusContext';
import { TimerProvider } from './context/TimerContext';
import { AppShell } from './components/Layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import { loadReportsPage, loadSettingsPage, loadStatsPage } from './routes';

const StatsPage = lazy(loadStatsPage);
const ReportsPage = lazy(loadReportsPage);
const SettingsPage = lazy(loadSettingsPage);
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <RepositoryProvider>
        <FocusProvider>
          {/* Le minuteur vit au-dessus du routeur : il continue de tourner d'une page à l'autre. */}
          <TimerProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="stats" element={<StatsPage />} />
                  <Route path="rapports" element={<ReportsPage />} />
                  <Route path="reglages" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </TimerProvider>
        </FocusProvider>
      </RepositoryProvider>
    </MotionConfig>
  );
}
