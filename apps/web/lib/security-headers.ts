/**
 * Centralised security headers for the web app. next.config.ts calls
 * this so the values are testable in isolation.
 *
 * History: previously script-src included both `'unsafe-eval'` and
 * `'unsafe-inline'`, which gutted CSP's XSS mitigation. We drop
 * `'unsafe-eval'` outright (no shipped path needs it) and keep
 * `'unsafe-inline'` only because Next.js 15 + React 19 still inline
 * a small bootstrap script for hydration. Replacing the latter
 * requires a per-request nonce middleware and is tracked as a
 * follow-up (see AUDIT-FINDINGS-2 §M2 — partial fix).
 */
export interface SecurityHeader {
  key: string;
  value: string;
}

export function securityHeaders(
  env: string = process.env.NODE_ENV ?? 'development',
): SecurityHeader[] {
  const isProd = env === 'production';

  // Dev needs unsafe-eval for React Refresh / Fast Refresh; prod does
  // not. Inline scripts are required in both for Next's hydration
  // bootstrap until we add a nonce layer.
  const scriptSrc = isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-eval' 'unsafe-inline'";

  return [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    // HSTS is only meaningful over HTTPS. Operators running an
    // HTTP-only internal deployment can override or strip this header
    // upstream.
    ...(isProd
      ? [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ]
      : []),
    {
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    },
  ];
}
