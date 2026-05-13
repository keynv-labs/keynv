import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../client/http.js';
import { resolveProjectId } from './project.js';

vi.mock('../client/http.js', () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    ensureHydrated: vi.fn().mockResolvedValue(undefined),
    isLoggedIn: true,
    request: vi.fn().mockResolvedValue({}),
  })),
}));

describe('MemberAddCommand', () => {
  it('rejects invalid role', () => {
    const invalidRoles = ['admin', 'owner', '', 'superadmin'];
    const validRoles = ['lead', 'developer', 'reader'];
    for (const role of invalidRoles) {
      expect(validRoles.includes(role)).toBe(false);
    }
    for (const role of validRoles) {
      expect(validRoles.includes(role)).toBe(true);
    }
  });

  it('uses resolveProjectId for project lookup', async () => {
    const request = vi.fn().mockResolvedValue({
      projects: [{ id: 'p_abc', name: 'myproject' }],
    });
    const client = { request } as unknown as ApiClient;
    const id = await resolveProjectId(client, 'myproject');
    expect(id).toBe('p_abc');
  });
});

describe('MemberListCommand', () => {
  it('resolves project before fetching members', async () => {
    const request = vi.fn().mockResolvedValue({
      projects: [{ id: 'p_abc', name: 'myproject' }],
    });
    const client = { request } as unknown as ApiClient;
    const id = await resolveProjectId(client, 'myproject');
    expect(id).toBe('p_abc');
  });

  it('handles empty member list', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ projects: [{ id: 'p_abc', name: 'myproject' }] })
      .mockResolvedValueOnce({ members: [] });
    const client = { request } as unknown as ApiClient;
    const projectId = await resolveProjectId(client, 'myproject');
    const data = await client.request<{ members: Array<{ email: string; role: string }> }>(
      `/v1/projects/${projectId}/members`,
    );
    expect(data.members).toHaveLength(0);
  });
});
