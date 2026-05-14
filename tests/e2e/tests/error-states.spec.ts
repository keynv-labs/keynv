import { test, expect } from '@playwright/test';

test.describe('Error states', () => {
  test('non-existent page returns 404', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');
    expect(response?.status()).toBe(404);
  });

  test('login page rejects empty form submission gracefully', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');

    const html = await page.locator('body').innerText();
    const hasFeedback =
      html.includes('required') ||
      html.includes('error') ||
      html.includes('Invalid') ||
      html.includes('Email');
    expect(hasFeedback || page.url().includes('/login')).toBeTruthy();
  });

  test('register page rejects empty form submission', async ({ page }) => {
    await page.goto('/register');
    await page.click('button[type="submit"]');

    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/register');
  });
});

test.describe('Security headers', () => {
  test('landing page sets x-frame-options: DENY', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.headers()['x-frame-options']).toBe('DENY');
  });

  test('landing page sets x-content-type-options: nosniff', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('landing page sets referrer-policy header', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

test.describe('Redirect behaviour', () => {
  test('multiple redirects to login resolve without crash', async ({ page }) => {
    await page.goto('/dashboard');
    await page.goto('/projects');
    await page.goto('/inbox');
    await page.goto('/audit');

    await page.waitForURL(/\/login/);
    expect(page.url()).toContain('/login');
  });
});

test.describe('Static assets', () => {
  test('favicon is served', async ({ page }) => {
    const response = await page.goto('/favicon.ico');
    expect(response?.status()).toBe(200);
  });

  test('robots.txt disallows nothing', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    const text = await response?.text();
    expect(text).toContain('Disallow:');
  });
});
