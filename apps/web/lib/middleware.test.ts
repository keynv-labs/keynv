import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { middleware } from '../middleware';

function makeRequest(url: string): NextRequest {
  return new NextRequest(url);
}

describe('middleware', () => {
  it('preserves query parameters in the login next redirect', () => {
    const response = middleware(makeRequest('http://localhost/cli/authorize?code=ABCD-2345'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/login?next=%2Fcli%2Fauthorize%3Fcode%3DABCD-2345',
    );
  });
});
