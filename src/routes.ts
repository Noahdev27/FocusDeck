import { BarChart3, FileText, LayoutDashboard, Settings2, type LucideIcon } from 'lucide-react';

export interface NavRoute {
  path: string;
  label: string;
  /** Libellé court pour la barre de navigation mobile. */
  shortLabel: string;
  icon: LucideIcon;
  /** Précharge le chunk de la page (survol / focus d'un lien). */
  preload?: () => Promise<unknown>;
}

// Les pages secondaires sont chargées à la demande (chunks séparés, budget PERF-1).
export const loadStatsPage = () => import('./pages/StatsPage');
export const loadReportsPage = () => import('./pages/ReportsPage');
export const loadSettingsPage = () => import('./pages/SettingsPage');

export const NAV_ROUTES: readonly NavRoute[] = [
  { path: '/', label: 'Tableau de bord', shortLabel: 'Accueil', icon: LayoutDashboard },
  { path: '/stats', label: 'Statistiques', shortLabel: 'Stats', icon: BarChart3, preload: loadStatsPage },
  { path: '/rapports', label: 'Rapports', shortLabel: 'Rapports', icon: FileText, preload: loadReportsPage },
  { path: '/reglages', label: 'Réglages', shortLabel: 'Réglages', icon: Settings2, preload: loadSettingsPage },
];
