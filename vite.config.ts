/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/types/**'],
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
