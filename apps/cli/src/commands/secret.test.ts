import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../client/http.js';
import { resolveProjectId } from './project.js';
import { parseAlias } from '@keynv/core';

vi.mock('../client/http.js', () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    ensureHydrated: vi.fn().mockResolvedValue(undefined),
    isLoggedIn: true,
    request: vi.fn().mockResolvedValue({}),
  })),
}));

describe('SecretListCommand', () => {
  it('uses resolveProjectId for name lookup', async () => {
    const request = vi.fn().mockResolvedValue({
      projects: [{ id: 'p_abc', name: 'testproject' }],
    });
    const client = { request } as unknown as ApiClient;
    const id = await resolveProjectId(client, 'testproject');
    expect(id).toBe('p_abc');
    expect(request).toHaveBeenCalledWith('/v1/projects');
  });
});

describe('SecretGetCommand', () => {
  it('parses alias and resolves project', async () => {
    const request = vi.fn().mockResolvedValue({
      projects: [{ id: 'p_abc', name: 'testproject' }],
    });
    const client = { request } as unknown as ApiClient;

    const parsed = parseAlias('@testproject.dev.api_key');
    expect(parsed).not.toBeNull();
    expect(parsed!.project).toBe('testproject');
    expect(parsed!.environment).toBe('dev');
    expect(parsed!.key).toBe('api_key');

    const id = await resolveProjectId(client, parsed!.project);
    expect(id).toBe('p_abc');
  });

  it('rejects invalid alias format', () => {
    expect(parseAlias('invalid')).toBeNull();
    expect(parseAlias('@testproject')).toBeNull();
    expect(parseAlias('@testproject.dev')).toBeNull();
  });

  it('parses valid alias formats', () => {
    const parsed = parseAlias('@billing.prod.db_password');
    expect(parsed).toMatchObject({
      project: 'billing',
      environment: 'prod',
      key: 'db_password',
    });
  });
});

describe('SecretCreateCommand', () => {
  it('parses --stdin input', () => {
    const stdin = Buffer.from('my-secret-value\n');
    const value = stdin.toString('utf8').replace(/\n$/, '');
    expect(value).toBe('my-secret-value');
  });
});
