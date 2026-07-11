import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { middleware } from '../middleware';

function makeRequest(url: string): NextRequest {
  return new NextRequest(url);
}

describe('middleware', () => {
  // The middleware is intentionally passive: it never redirects, to avoid
  // redirect loops under Next.js standalone output. Auth gating for
  // protected routes is enforced in the server components/layouts — e.g.
  // app/cli/authorize/page.tsx redirects to /login?next=… when there is no
  // session (preserving the ?code= param). These tests lock in the
  // middleware's pass-through contract so the redirect loop can't silently
  // return.
  it('passes public paths through without redirecting', () => {
    for (const path of ['/', '/login', '/register', '/docs/getting-started']) {
      const response = middleware(makeRequest(`http://localhost${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    }
  });

  it('passes protected paths through (page-level gate handles auth)', () => {
    const response = middleware(makeRequest('http://localhost/cli/authorize?code=ABCD-2345'));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  function withHosted(value: string | undefined, fn: () => void): void {
    const prev = process.env.KEYNV_HOSTED;
    if (value === undefined) delete process.env.KEYNV_HOSTED;
    else process.env.KEYNV_HOSTED = value;
    try {
      fn();
    } finally {
      if (prev === undefined) delete process.env.KEYNV_HOSTED;
      else process.env.KEYNV_HOSTED = prev;
    }
  }

  it('404s hosted-only marketing routes on self-host', () => {
    withHosted(undefined, () => {
      for (const path of ['/changelog', '/changelog/rss.xml', '/llms.txt']) {
        expect(middleware(makeRequest(`http://localhost${path}`)).status).toBe(404);
      }
    });
  });

  it('serves marketing routes when KEYNV_HOSTED is enabled', () => {
    withHosted('true', () => {
      expect(middleware(makeRequest('http://localhost/changelog')).status).toBe(200);
    });
  });
});
