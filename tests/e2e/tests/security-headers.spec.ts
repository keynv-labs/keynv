import { expect, test } from '@playwright/test';

test.describe('Security headers', () => {
  test('public pages emit the foundational security headers', async ({ request }) => {
    const res = await request.get('/login');
    expect(res.status()).toBeLessThan(500);
    const headers = res.headers();

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');

    const csp = headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  test('production builds drop unsafe-eval from script-src', async ({ request }) => {
    // Skip in dev where unsafe-eval is intentionally allowed for
    // React Refresh; the unit suite in apps/web/lib/security-headers
    // covers production directly. The e2e runner is `next dev` by
    // default, so we conditionally assert.
    const res = await request.get('/login');
    const csp = res.headers()['content-security-policy'] ?? '';
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      expect(csp).not.toContain("'unsafe-eval'");
    }
  });
});
