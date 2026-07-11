import { reference } from '@keynv/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../client/http.js';
import { resolveProjectId } from './project.js';
import { SecretGetCommand, SecretRotationsCommand, SecretSetRotationCommand } from './secret.js';

const requestMock = vi.hoisted(() => vi.fn());

vi.mock('../client/http.js', () => ({
  ApiClient: vi.fn(function ApiClientMock() {
    return {
      ensureHydrated: vi.fn().mockResolvedValue(undefined),
      isLoggedIn: true,
      request: requestMock,
    };
  }),
  isClientError: vi.fn().mockReturnValue(false),
}));

function attachContext<T extends object>(
  command: T,
): { stdout: ReturnType<typeof vi.fn>; stderr: ReturnType<typeof vi.fn> } {
  const stdout = vi.fn();
  const stderr = vi.fn();
  Object.assign(command, { context: { stdout: { write: stdout }, stderr: { write: stderr } } });
  return { stdout, stderr };
}

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

    const parsed = reference.parseAlias('@testproject.dev.api_key');
    expect(parsed).not.toBeNull();
    expect(parsed!.project).toBe('testproject');
    expect(parsed!.environment).toBe('dev');
    expect(parsed!.key).toBe('api_key');

    const id = await resolveProjectId(client, parsed!.project);
    expect(id).toBe('p_abc');
  });

  it('rejects invalid alias format', () => {
    expect(reference.parseAlias('invalid')).toBeNull();
    expect(reference.parseAlias('@testproject')).toBeNull();
    expect(reference.parseAlias('@testproject.dev')).toBeNull();
  });

  it('parses valid alias formats', () => {
    const parsed = reference.parseAlias('@billing.prod.db_password');
    expect(parsed).toMatchObject({
      project: 'billing',
      environment: 'prod',
      key: 'db_password',
    });
  });

  function mockGet(): void {
    requestMock
      .mockReset()
      .mockResolvedValueOnce({ projects: [{ id: 'p_abc', name: 'billing' }] })
      .mockResolvedValueOnce({ alias: '@billing.dev.api_key', version: 2, value: 'sk-secret-123' });
  }

  function newGet(overrides: Partial<SecretGetCommand>): SecretGetCommand {
    const cmd = new SecretGetCommand();
    // Set every flag explicitly — a directly-constructed clipanion command
    // hasn't been through the parser, so option defaults aren't applied.
    Object.assign(cmd, { alias: '@billing.dev.api_key', json: false, copy: false, reveal: false });
    Object.assign(cmd, overrides);
    return cmd;
  }

  it('--reveal prints the raw value to stdout', async () => {
    mockGet();
    const cmd = newGet({ reveal: true });
    const { stdout } = attachContext(cmd);
    expect(await cmd.execute()).toBe(0);
    expect(stdout).toHaveBeenCalledWith('sk-secret-123\n');
  });

  it('refuses to print to a non-interactive stdout by default (no leak)', async () => {
    mockGet();
    const cmd = newGet({});
    const { stdout, stderr } = attachContext(cmd);
    expect(await cmd.execute()).toBe(1);
    expect(stdout).not.toHaveBeenCalledWith('sk-secret-123\n');
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('refusing to print'));
  });

  it('--json outputs the structured value', async () => {
    mockGet();
    const cmd = newGet({ json: true });
    const { stdout } = attachContext(cmd);
    expect(await cmd.execute()).toBe(0);
    expect(stdout).toHaveBeenCalledWith(
      `${JSON.stringify({ alias: '@billing.dev.api_key', version: 2, value: 'sk-secret-123' })}\n`,
    );
  });
});

describe('SecretCreateCommand', () => {
  it('parses --stdin input', () => {
    const stdin = Buffer.from('my-secret-value\n');
    const value = stdin.toString('utf8').replace(/\n$/, '');
    expect(value).toBe('my-secret-value');
  });
});

describe('SecretSetRotationCommand', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('sets rotation interval for a secret', async () => {
    requestMock
      .mockResolvedValueOnce({ projects: [{ id: 'p_abc', name: 'billing' }] })
      .mockResolvedValueOnce({
        alias: '@billing.dev.db_password',
        interval_days: 90,
        next_rotation_at: '2026-08-16T12:00:00.000Z',
      });

    const cmd = new SecretSetRotationCommand();
    cmd.alias = '@billing.dev.db_password';
    cmd.interval = '90';
    const { stdout } = attachContext(cmd);

    const result = await cmd.execute();
    expect(result).toBe(0);
    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(requestMock).toHaveBeenLastCalledWith(
      '/v1/projects/p_abc/secrets/dev/db_password/rotation',
      { method: 'PATCH', body: { interval_days: 90 } },
    );
    const out = stdout.mock.calls.map((c: string[]) => c[0]).join('');
    expect(out).toContain('rotation policy for @billing.dev.db_password');
  });

  it('rejects invalid interval', async () => {
    const cmd = new SecretSetRotationCommand();
    cmd.alias = '@billing.dev.db_password';
    cmd.interval = '0';
    const { stderr } = attachContext(cmd);

    const result = await cmd.execute();
    expect(result).toBe(1);
    expect(requestMock).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      'keynv: --interval must be an integer between 1 and 365.\n',
    );
  });
});

describe('SecretRotationsCommand', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('lists secrets due for rotation', async () => {
    requestMock
      .mockResolvedValueOnce({ projects: [{ id: 'p_abc', name: 'billing' }] })
      .mockResolvedValueOnce({
        secrets: [
          {
            alias: '@billing.dev.db_password',
            version: 3,
            rotation_interval_days: 90,
            rotated_at: '2026-05-01T12:00:00.000Z',
            next_rotation_at: '2026-07-30T12:00:00.000Z',
            status: 'upcoming',
          },
        ],
      });

    const cmd = new SecretRotationsCommand();
    cmd.project = 'billing';
    const { stdout } = attachContext(cmd);

    const result = await cmd.execute();
    expect(result).toBe(0);
    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(stdout).toHaveBeenCalledWith(
      '@billing.dev.db_password  v3  next=2026-07-30T12:00:00.000Z  status=upcoming\n',
    );
  });

  it('outputs json when --json flag is set', async () => {
    const payload = {
      secrets: [
        {
          alias: '@billing.dev.API_KEY',
          version: 1,
          rotation_interval_days: 30,
          rotated_at: null,
          next_rotation_at: '2026-06-17T12:00:00.000Z',
          status: 'due',
        },
      ],
    };
    requestMock
      .mockResolvedValueOnce({ projects: [{ id: 'p_abc', name: 'billing' }] })
      .mockResolvedValueOnce(payload);

    const cmd = new SecretRotationsCommand();
    cmd.project = 'billing';
    cmd.json = true;
    const { stdout } = attachContext(cmd);

    const result = await cmd.execute();
    expect(result).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${JSON.stringify(payload, null, 2)}\n`);
  });

  it('prints empty message when no secrets are due', async () => {
    requestMock
      .mockResolvedValueOnce({ projects: [{ id: 'p_abc', name: 'billing' }] })
      .mockResolvedValueOnce({ secrets: [] });

    const cmd = new SecretRotationsCommand();
    cmd.project = 'billing';
    const { stdout } = attachContext(cmd);

    const result = await cmd.execute();
    expect(result).toBe(0);
    expect(stdout).toHaveBeenCalledWith('no secrets due for rotation\n');
  });
});
