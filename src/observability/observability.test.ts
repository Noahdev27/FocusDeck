import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = { init: vi.fn(), captureException: vi.fn() };
const analytics = { inject: vi.fn(), track: vi.fn() };
const speed = { injectSpeedInsights: vi.fn() };
vi.mock('@sentry/react', () => sentry);
vi.mock('@vercel/analytics', () => analytics);
vi.mock('@vercel/speed-insights', () => speed);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

describe('suivi des erreurs', () => {
  it('ne charge rien sans DSN', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');
    const { initErrorTracking, reportError } = await import('./errorTracking');
    await initErrorTracking();
    reportError(new Error('x'));
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('initialise Sentry sans collecte de données personnelles et vide la file', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://cle@o1.ingest.de.sentry.io/1');
    vi.stubEnv('VITE_VERCEL_ENV', 'preview');
    const { initErrorTracking, reportError } = await import('./errorTracking');
    const early = new Error('avant chargement');
    reportError(early);
    await initErrorTracking();

    const options = sentry.init.mock.calls[0]?.[0] as {
      environment: string;
      dataCollection: { userInfo: boolean };
      beforeSend: (event: object) => object;
      beforeBreadcrumb: (breadcrumb: object) => object | null;
    };
    expect(options.environment).toBe('preview');
    expect(options.dataCollection.userInfo).toBe(false);
    expect(options.beforeSend({ user: { email: 'a@b.fr' }, message: 'ok' })).toEqual({ message: 'ok' });
    expect(options.beforeBreadcrumb({ category: 'ui.click', message: 'Tâche' })).toBeNull();
    expect(sentry.captureException).toHaveBeenCalledWith(early);

    const later = new Error('après');
    reportError(later);
    expect(sentry.captureException).toHaveBeenLastCalledWith(later);
  });
});

describe('mesure d’audience', () => {
  it('reste inactive hors déploiement Vercel', async () => {
    vi.stubEnv('VITE_VERCEL_ENV', '');
    const { initAnalytics, trackEvent } = await import('./analytics');
    await initAnalytics();
    trackEvent({ name: 'report_exported', properties: { format: 'pdf' } });
    expect(analytics.inject).not.toHaveBeenCalled();
    expect(analytics.track).not.toHaveBeenCalled();
  });

  it('envoie les événements et respecte la désactivation', async () => {
    vi.stubEnv('VITE_VERCEL_ENV', 'production');
    const { initAnalytics, setAnalyticsEnabled, trackEvent } = await import('./analytics');
    await initAnalytics();
    expect(speed.injectSpeedInsights).toHaveBeenCalledOnce();
    const { mode, beforeSend } = analytics.inject.mock.calls[0]?.[0] as {
      mode: string;
      beforeSend: (event: { type: string; url: string }) => object | null;
    };
    expect(mode).toBe('production');
    expect(beforeSend({ type: 'pageview', url: 'https://f.app/stats?x=1#y' })).toEqual({ type: 'pageview', url: 'https://f.app/stats' });

    trackEvent({ name: 'cycle_completed', properties: { mode: 'focus' } });
    expect(analytics.track).toHaveBeenCalledWith('cycle_completed', { mode: 'focus' });

    setAnalyticsEnabled(false);
    trackEvent({ name: 'cycle_completed', properties: { mode: 'focus' } });
    expect(analytics.track).toHaveBeenCalledOnce();
    expect(beforeSend({ type: 'pageview', url: '/' })).toBeNull();
    const speedBeforeSend = (speed.injectSpeedInsights.mock.calls[0]?.[0] as { beforeSend: (e: object) => object | null }).beforeSend;
    expect(speedBeforeSend({})).toBeNull();
  });
});
