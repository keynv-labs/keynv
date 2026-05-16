import { describe, expect, it } from 'vitest';
import { securityHeaders } from './security-headers';

function csp(env: string): string {
  const h = securityHeaders(env).find((x) => x.key === 'Content-Security-Policy');
  if (!h) throw new Error('no CSP header');
  return h.value;
}

describe('securityHeaders', () => {
  it('drops unsafe-eval from script-src in production', () => {
    expect(csp('production')).not.toContain("'unsafe-eval'");
  });

  it('keeps unsafe-eval available in development for React Refresh', () => {
    expect(csp('development')).toContain("'unsafe-eval'");
  });

  it('always sets the foundational CSP directives', () => {
    const value = csp('production');
    expect(value).toContain("default-src 'self'");
    expect(value).toContain("frame-ancestors 'none'");
    expect(value).toContain("base-uri 'self'");
    expect(value).toContain("form-action 'self'");
  });

  it('emits the framing + sniffing + permissions trio', () => {
    const headers = securityHeaders('production');
    const keys = headers.map((h) => h.key);
    expect(keys).toContain('X-Frame-Options');
    expect(keys).toContain('X-Content-Type-Options');
    expect(keys).toContain('Referrer-Policy');
    expect(keys).toContain('Permissions-Policy');
  });
});
