import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Web-specific vitest config. The root config looks for `src/**` but
 * the Next.js app layout puts modules at `app/`, `lib/`, `components/`,
 * so we widen the include pattern here.
 */
export default defineConfig({
  oxc: false,
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['{app,lib,components}/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
