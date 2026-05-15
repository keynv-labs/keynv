import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../client/http.js';
import { InitCommand } from './init.js';
import { isProjectId, resolveProjectId } from './project.js';

vi.mock('../client/http.js', () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    ensureHydrated: vi.fn().mockResolvedValue(undefined),
    isLoggedIn: true,
    request: vi.fn().mockResolvedValue({}),
  })),
}));

describe('InitCommand non-interactive mode', () => {
  describe('isProjectId', () => {
    it('returns true for p_ prefix', () => {
      expect(isProjectId('p_go6rqgwz0wlokdsl55ikn')).toBe(true);
    });

    it('returns true for long hex string', () => {
      expect(isProjectId('aabbccddeeff001122334455')).toBe(true);
    });

    it('returns false for project name', () => {
      expect(isProjectId('myproject')).toBe(false);
      expect(isProjectId('my-project')).toBe(false);
    });
  });

  describe('resolveProjectId', () => {
    it('returns ID as-is when it starts with p_', async () => {
      const request = vi.fn();
      const mockClient = { request } as unknown as ApiClient;
      const result = await resolveProjectId(mockClient, 'p_go6rqgwz0wlokdsl55ikn');
      expect(result).toBe('p_go6rqgwz0wlokdsl55ikn');
      expect(request).not.toHaveBeenCalled();
    });

    it('looks up project by name when not an ID', async () => {
      const request = vi.fn().mockResolvedValue({
        projects: [{ id: 'p_abc123', name: 'myproject' }],
      });
      const mockClient = { request } as unknown as ApiClient;
      const result = await resolveProjectId(mockClient, 'myproject');
      expect(result).toBe('p_abc123');
      expect(request).toHaveBeenCalledWith('/v1/projects');
    });

    it('throws when project name not found', async () => {
      const request = vi.fn().mockResolvedValue({
        projects: [{ id: 'p_abc123', name: 'otherproject' }],
      });
      const mockClient = { request } as unknown as ApiClient;
      await expect(resolveProjectId(mockClient, 'nonexistent')).rejects.toThrow(
        'project not found: nonexistent',
      );
    });
  });

  describe('InitCommand examples', () => {
    it('includes non-interactive example in usage', () => {
      const usage = InitCommand.usage;
      expect(usage.examples).toContainEqual([
        'Non-interactive (CI/CD)',
        '$0 init --env-file .env --project myproject --env dev',
      ]);
    });
  });

  it('writes .keynv.env for --env-file migrations', async () => {
    const cwd = process.cwd();
    const dir = mkdtempSync(join(tmpdir(), 'keynv-init-'));
    try {
      process.chdir(dir);
      writeFileSync('.env', 'API_TOKEN=secret-value\n');

      const request = vi.fn().mockImplementation((path: string) => {
        if (path === '/v1/projects') {
          return Promise.resolve({ projects: [{ id: 'p_test', name: 'billing' }] });
        }
        return Promise.resolve({});
      });
      const command = new InitCommand();
      command.envFile = '.env';
      command.project = 'billing';
      command.env = 'dev';
      command.noScripts = true;
      command.secret = [];
      command.dryRun = false;
      command.yes = false;
      Object.assign(command, {
        context: {
          stdout: { write: vi.fn() },
          stderr: { write: vi.fn() },
        },
      });

      const result = await command.runNonInteractive({ request } as unknown as ApiClient);

      expect(result).toBe(0);
      expect(readFileSync('.keynv.env', 'utf8')).toContain('API_TOKEN=@billing.dev.API_TOKEN');
    } finally {
      process.chdir(cwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
