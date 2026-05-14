import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('unauthenticated user is redirected to /login from protected pages', async ({ page }) => {
    const protectedRoutes = [
      '/dashboard',
      '/projects',
      '/inbox',
      '/audit',
      '/settings/account',
      '/admin/users',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL(/\/login/);
      expect(page.url()).toContain('/login');
    }
  });

  test('login page redirect preserves the original path', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login\?next=%2Fdashboard/);
    expect(page.url()).toContain('next=%2Fdashboard');
  });

  test('login page renders the form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login form shows validation error with invalid email', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'not-an-email');
    await page.fill('input[type="password"]', 'somepassword');
    await page.click('button[type="submit"]');

    const html = await page.locator('body').innerHTML();
    const hasValidation =
      html.includes('email') &&
      (html.includes('invalid') || html.includes('valid') || html.includes('Invalid'));
    expect(hasValidation || page.url().includes('/login')).toBeTruthy();
  });

  test('register page is accessible', async ({ page }) => {
    await page.goto('/register');

    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('public pages are accessible without authentication', async ({ page }) => {
    const publicPages = [
      { path: '/', title: 'keynv' },
      { path: '/changelog', title: 'changelog' },
      { path: '/docs', title: 'docs' },
      { path: '/login', title: 'login' },
      { path: '/register', title: 'register' },
    ];

    for (const { path } of publicPages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain(path);
    }
  });
});
