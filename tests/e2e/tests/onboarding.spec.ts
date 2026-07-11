import { expect, test } from '@playwright/test';

test.describe('TUI-first onboarding copy', () => {
  test('landing page communicates the vault + safe-alias value prop', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const body = page.locator('body');
    await expect(body).toContainText('vault');
    await expect(body).toContainText('Safe Aliases');
  });

  test('quickstart keeps users on keynv TUI instead of legacy commands', async ({ page }) => {
    await page.goto('/docs/quickstart');
    await page.waitForLoadState('networkidle');

    const text = await page.locator('body').innerText();
    expect(text).toContain('npm install -g @keynv/cli');
    expect(text).toContain('Set up this project');
    expect(text).toContain('keynv secret create @billing.dev.api_key');
    expect(text).not.toContain('keynv login --server');
    expect(text).not.toContain('keynv init');
    expect(text).not.toContain('keynv secret set');
  });
});
