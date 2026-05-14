import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: 'pnpm --filter @keynv/web dev --port 3000',
          url: 'http://localhost:3000',
          reuseExistingServer: true,
          cwd: new URL('../../', import.meta.url).pathname,
        },
      }),
});
