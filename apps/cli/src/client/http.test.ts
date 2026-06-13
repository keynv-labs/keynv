import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from './http.js';
import type { Credentials } from './store.js';

const credentials: Credentials = {
  auth_kind: 'session',
  server_url: 'https://api.keynv.test',
  user_id: 'u_test',
  email: 'user@example.test',
  org_id: 'org_test',
  org_role: 'owner',
  access_token: 'expired-access-token',
  refresh_token: 'expired-refresh-token',
  access_expires_at: '2020-01-01T00:00:00.000Z',
};

describe('ApiClient auth refresh handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an actionable session expired error when refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: 'auth.token_expired', message: 'Invalid or expired access token.' },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: 'auth.token_expired', message: 'Invalid or expired refresh token.' },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient(credentials);

    await expect(client.request('/v1/whoami')).rejects.toMatchObject({
      status: 401,
      code: 'auth.session_expired',
      message: 'Session expired. Run `keynv` to reconnect.',
    });
    expect(client.isLoggedIn).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('ApiClient request URL building', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves a base path on the server URL (reverse-proxy mount)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient({ ...credentials, server_url: 'https://host.test/keynv' });
    await client.request('/v1/projects');

    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe('https://host.test/keynv/v1/projects');
  });

  it('builds a root URL correctly when the base has no path', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient({ ...credentials, server_url: 'https://host.test' });
    await client.request('/v1/projects', { query: { page: 2 } });

    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe('https://host.test/v1/projects?page=2');
  });
});
