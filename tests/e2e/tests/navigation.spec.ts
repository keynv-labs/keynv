import { test, expect } from '@playwright/test';

test.describe('Public page navigation', () => {
  test('landing page loads and shows content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(100);
  });

  test('docs index lists documentation pages', async ({ page }) => {
    await page.goto('/docs');
    await page.waitForLoadState('networkidle');
    const links = page.locator('a[href^="/docs/"]');
    expect(await links.count()).toBeGreaterThan(0);
  });

  test('changelog page renders entries', async ({ page }) => {
    await page.goto('/changelog');
    await page.waitForLoadState('networkidle');
    const text = await page.locator('body').innerText();
    expect(text.length).toBeGreaterThan(50);
  });

  test('docs sub-page renders content', async ({ page }) => {
    const slugs = ['getting-started', 'quickstart', 'architecture', 'api-spec'];

    for (const slug of slugs) {
      await page.goto(`/docs/${slug}`);
      await page.waitForLoadState('networkidle');
      const text = await page.locator('body').innerText();
      expect(text.length).toBeGreaterThan(50);
    }
  });

  test('robots.txt is served', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    expect(response?.status()).toBe(200);
    const text = await response?.text();
    expect(text?.toLowerCase()).toContain('user-agent');
  });

  test('sitemap.xml is served', async ({ page }) => {
    const response = await page.goto('/sitemap.xml');
    expect(response?.status()).toBe(200);
    const text = await response?.text();
    expect(text).toContain('xml');
  });
});

test.describe('Page metadata', () => {
  test('landing page sets correct title', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title.toLowerCase()).toContain('keynv');
  });

  test('login page has a title', async ({ page }) => {
    await page.goto('/login');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
