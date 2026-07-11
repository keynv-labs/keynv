import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'pnpm --filter @keynv/web dev --port 3000',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          cwd: fileURLToPath(new URL('../../', import.meta.url)),
          // The e2e suite exercises the full hosted surface (marketing
          // landing, changelog). Self-host (KEYNV_HOSTED unset) redirects
          // the root to /login and 404s those routes — covered separately.
          env: { KEYNV_HOSTED: 'true' },
        },
      }),
});
