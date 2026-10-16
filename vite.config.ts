/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// Source maps : générées uniquement quand elles peuvent être envoyées à Sentry,
// puis supprimées du build — jamais publiées (OBS-1).
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default defineConfig({
  build: { sourcemap: uploadSourceMaps ? 'hidden' : false },
  plugins: [
    react(),
    tailwindcss(),
    uploadSourceMaps &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
        telemetry: false,
      }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/types/**',
        // Outils de test partagés (suite de contrat, stockage en mémoire).
        'src/data/repositoryContract.ts',
        'src/data/memoryStorage.ts',
      ],
      reporter: ['text-summary', 'text', 'html'],
      // Seuils QUAL-2 du cahier des charges.
      thresholds: {
        statements: 70,
        lines: 70,
        functions: 65,
        branches: 60,
        'src/utils/**': { statements: 90, lines: 90, functions: 90, branches: 80 },
      },
    },
  },
});
