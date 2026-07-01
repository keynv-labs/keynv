import { expect, test } from '@playwright/test';

test.describe('CSRF guard', () => {
  test('register form rejects submission when the CSRF token is removed', async ({ page }) => {
    await page.goto('/register');

    const csrf = page.locator('input[name="csrf_token"]');
    await expect(csrf).toHaveCount(1);

    await page.fill('input[type="email"]', 'csrf-test@example.test');
    await page.fill('input[name="org_name"]', 'csrf-test-org');
    // Password and confirmation use the same component pattern.
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill('csrf-password-12345');
    if ((await passwords.count()) > 1) {
      await passwords.nth(1).fill('csrf-password-12345');
    }

    // Strip the CSRF token before submitting; simulates a cross-site
    // submission that forged the form action.
    await page.evaluate(() => {
      const el = document.querySelector('input[name="csrf_token"]');
      el?.remove();
    });

    await page.click('button[type="submit"]');

    // Action must keep the user on /register (or bounce them to it) and
    // surface the "Security check failed" message. Web-first assertions
    // poll the live DOM instead of reading it once, so we wait for the
    // rejection page to render rather than racing it — the e2e web server
    // is `next dev`, which compiles the route on first hit, so the POST
    // response can arrive a beat after the click. Generous timeout absorbs
    // that cold-compile delay.
    await expect(page.locator('body')).toContainText(/Security check failed/i, {
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/\/register/);
  });

  test('login form renders the CSRF token', async ({ page }) => {
    await page.goto('/login');
    const csrf = page.locator('input[name="csrf_token"]');
    await expect(csrf).toHaveCount(1);
    const value = await csrf.inputValue();
    // Token format is base64url.base64url — a dot separator with
    // non-empty parts on either side.
    expect(value).toMatch(/^[\w-]+=*\.[\w-]+=*$/);
  });
});
