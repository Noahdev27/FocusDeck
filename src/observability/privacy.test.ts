import { describe, expect, it } from 'vitest';
import { filterBreadcrumb, redactEmails, scrubEvent, stripUrl } from './privacy';

describe('privacy', () => {
  it('masque les e-mails', () => {
    expect(redactEmails('Échec pour noe@example.fr et a.b+c@d.io')).toBe('Échec pour [email] et [email]');
  });

  it('réduit les URLs au chemin', () => {
    expect(stripUrl('https://focusdeck.app/rapports?client=Acme#top')).toBe('https://focusdeck.app/rapports');
    expect(stripUrl('/stats?x=1')).toBe('/stats');
  });

  it('supprime les fils d’Ariane qui peuvent contenir du texte saisi', () => {
    expect(filterBreadcrumb({ category: 'ui.click', message: 'button[aria-label="Appeler Marie"]' })).toBeNull();
    expect(filterBreadcrumb({ category: 'console', message: 'Tâche : Devis Acme' })).toBeNull();
    expect(filterBreadcrumb({ message: 'sans catégorie' })).toBeNull();
    expect(
      filterBreadcrumb({ category: 'navigation', message: 'x', data: { from: '/?q=secret', to: '/stats', extra: 'drop' } }),
    ).toEqual({ category: 'navigation', data: { from: '/', to: '/stats' } });
    expect(filterBreadcrumb({ category: 'fetch', data: { url: 'https://api.test/v1?token=abc', method: 'GET', status_code: 500 } })).toEqual({
      category: 'fetch',
      data: { url: 'https://api.test/v1', method: 'GET', status_code: 500 },
    });
  });

  it('nettoie un événement complet', () => {
    const event = scrubEvent({
      message: 'Erreur pour noe@example.fr',
      user: { email: 'noe@example.fr', ip_address: '1.2.3.4' },
      extra: { task: 'Appeler Marie' },
      request: { url: 'https://focusdeck.app/?ref=mail', headers: { cookie: 'x' }, cookies: { a: 'b' } },
      exception: { values: [{ value: 'Contact noe@example.fr' }, {}] },
      breadcrumbs: [{ category: 'ui.click', message: 'Appeler Marie' }, { category: 'navigation', data: { to: '/stats' } }],
    });
    expect(event).toEqual({
      message: 'Erreur pour [email]',
      request: { url: 'https://focusdeck.app/' },
      exception: { values: [{ value: 'Contact [email]' }, {}] },
      breadcrumbs: [{ category: 'navigation', data: { to: '/stats' } }],
    });
    expect(scrubEvent({ request: { headers: {} } })).toEqual({ request: {} });
  });
});
