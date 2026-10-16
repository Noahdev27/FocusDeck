import { describe, expect, it } from 'vitest';
import { auditSecurityHeaders } from '../../scripts/security-headers.mjs';
import vercelJson from '../../vercel.json?raw';

interface VercelConfig {
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

const config = JSON.parse(vercelJson) as VercelConfig;
const globalHeaders = Object.fromEntries(
  (config.headers.find((rule) => rule.source === '/(.*)')?.headers ?? []).map(({ key, value }) => [key, value]),
);

describe('En-têtes de sécurité (SEC-3)', () => {
  it('vercel.json satisfait les critères de la note A', () => {
    expect(auditSecurityHeaders(globalHeaders)).toEqual([]);
  });

  it('autorise uniquement les domaines tiers attendus', () => {
    const csp = globalHeaders['Content-Security-Policy'] ?? '';
    const external = [...new Set(csp.match(/https:\/\/[^\s;]+/g) ?? [])].sort();
    // Toute nouvelle entrée doit être justifiée (voir CLAUDE.md, section Hébergement).
    expect(external).toEqual(['https://*.ingest.de.sentry.io', 'https://*.ingest.sentry.io']);
  });

  it('détecte les configurations dangereuses', () => {
    const problems = auditSecurityHeaders({
      'Content-Security-Policy': "default-src *; script-src 'self' 'unsafe-inline'",
      'Strict-Transport-Security': 'max-age=300',
      'Referrer-Policy': 'unsafe-url',
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        "CSP : script-src autorise 'unsafe-inline'",
        "CSP : frame-ancestors doit valoir 'none'",
        'HSTS absent ou max-age < 1 an',
        'X-Content-Type-Options doit valoir nosniff',
        'Referrer-Policy absente ou trop permissive',
        'Permissions-Policy absente',
      ]),
    );
  });
});
