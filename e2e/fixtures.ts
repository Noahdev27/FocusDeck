import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

interface VercelConfig {
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

/** En-têtes de production lus dans vercel.json (`vite preview` ne les applique pas). */
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as VercelConfig;
const productionHeaders = Object.fromEntries(
  (vercel.headers.find((rule) => rule.source === '/(.*)')?.headers ?? [])
    .filter(({ key }) => key !== 'Strict-Transport-Security')
    .map(({ key, value }) => [key.toLowerCase(), value.replace('; upgrade-insecure-requests', '')]),
);

interface Fixtures {
  /** Erreurs console, exceptions et violations CSP relevées pendant le test. */
  problems: string[];
}

export const test = base.extend<Fixtures>({
  problems: async ({ page }, provide) => {
    const problems: string[] = [];
    await page.route('**/*', async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), ...productionHeaders } });
    });
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`exception: ${error.message}`));
    await page.exposeFunction('__reportCsp', (detail: string) => problems.push(`CSP: ${detail}`));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        (window as unknown as { __reportCsp: (d: string) => void }).__reportCsp(
          `${event.violatedDirective} ${event.blockedURI}`,
        );
      });
    });
    await provide(problems);
    expect(problems, 'aucune erreur console ni violation CSP').toEqual([]);
  },
});

export { expect };

export async function addTasks(page: Page, titles: string[]): Promise<void> {
  const input = page.getByLabel('Nouvel objectif');
  for (const title of titles) {
    await input.fill(title);
    await input.press('Enter');
  }
}

/** Vérifie l'absence de violation d'accessibilité sérieuse ou critique (A11Y-5). */
export async function expectNoA11yViolations(page: Page, include?: string): Promise<void> {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  if (include) builder.include(include);
  const { violations } = await builder.analyze();
  const blocking = violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`);
  expect(blocking).toEqual([]);
}
