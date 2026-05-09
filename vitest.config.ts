import { defineConfig } from 'vitest/config';

/**
 * Root vitest config that every workspace inherits unless it
 * provides its own. The chief job here is to exclude any compiled
 * `dist/**` so a `pnpm -r build` followed by `pnpm test` doesn't
 * pick up duplicate (and broken — paths-relative-to-source) test
 * files from build output.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**', '**/.next/**'],
  },
});
