import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvAddCommand, EnvListCommand, parseEnvironmentTier } from './env.js';

const requestMock = vi.hoisted(() => vi.fn());

vi.mock('../client/http.js', () => ({
  ApiClient: vi.fn().mockImplementation(function MockApiClient() {
    return {
      ensureHydrated: vi.fn().mockResolvedValue(undefined),
      isLoggedIn: true,
      request: requestMock,
    };
  }),
  isClientError: vi.fn().mockReturnValue(false),
}));

interface CommandHarness<T> {
  command: T;
  stdout: ReturnType<typeof vi.fn>;
  stderr: ReturnType<typeof vi.fn>;
}

function attachContext<T extends object>(command: T): CommandHarness<T> {
  const stdout = vi.fn();
  const stderr = vi.fn();
  Object.assign(command, {
    context: {
      stdout: { write: stdout },
      stderr: { write: stderr },
    },
  });
  return { command, stdout, stderr };
}

describe('env commands', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('validates supported environment tiers', () => {
    expect(parseEnvironmentTier('production')).toBe('production');
    expect(parseEnvironmentTier('non-production')).toBe('non-production');
    expect(parseEnvironmentTier('staging')).toBeNull();
  });

  it('lists environments for a resolved project', async () => {
    requestMock
      .mockResolvedValueOnce({ projects: [{ id: 'p_abc', name: 'billing' }] })
      .mockResolvedValueOnce({
        id: 'p_abc',
        name: 'billing',
        environments: [
          { id: 'env_dev', name: 'dev', tier: 'non-production', require_approval: false },
          { id: 'env_prod', name: 'prod', tier: 'production', require_approval: true },
        ],
      });

    const { command, stdout } = attachContext(new EnvListCommand());
    command.project = 'billing';
    command.json = false;

    await expect(command.execute()).resolves.toBe(0);
    expect(requestMock).toHaveBeenCalledWith('/v1/projects');
    expect(requestMock).toHaveBeenCalledWith('/v1/projects/p_abc');
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('prod'));
  });

  it('adds an environment with the expected request body', async () => {
    requestMock
      .mockResolvedValueOnce({
        version: '0.2.0',
        capabilities: { features: { environment_management: true } },
      })
      .mockResolvedValueOnce({ projects: [{ id: 'p_abc', name: 'billing' }] })
      .mockResolvedValueOnce({
        id: 'env_staging',
        name: 'staging',
        tier: 'production',
        require_approval: true,
      });

    const { command, stdout } = attachContext(new EnvAddCommand());
    command.project = 'billing';
    command.name = 'staging';
    command.tier = 'production';
    command.approval = true;

    await expect(command.execute()).resolves.toBe(0);
    expect(requestMock).toHaveBeenCalledWith('/v1/health', { authed: false });
    expect(requestMock).toHaveBeenCalledWith('/v1/projects/p_abc/environments', {
      method: 'POST',
      body: {
        name: 'staging',
        tier: 'production',
        require_approval: true,
      },
    });
    expect(stdout).toHaveBeenCalledWith('created env staging (tier=production, approval=true)\n');
  });

  it('requires the environment management capability before adding an environment', async () => {
    requestMock.mockResolvedValueOnce({
      version: '0.1.0-rc.1',
      capabilities: { features: {} },
    });

    const { command, stderr } = attachContext(new EnvAddCommand());
    command.project = 'billing';
    command.name = 'staging';
    command.tier = 'non-production';
    command.approval = false;

    await expect(command.execute()).resolves.toBe(1);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining('does not advertise environment_management'),
    );
  });

  it('rejects invalid tier values before calling the API', async () => {
    const { command, stderr } = attachContext(new EnvAddCommand());
    command.project = 'billing';
    command.name = 'staging';
    command.tier = 'invalid';
    command.approval = false;

    await expect(command.execute()).resolves.toBe(1);
    expect(requestMock).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      'keynv: --tier must be one of production, non-production\n',
    );
  });
});
