import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

  it('runAutoScan recursively writes per-app .keynv.env files and backs up the originals', async () => {
    const cwd = process.cwd();
    const dir = mkdtempSync(join(tmpdir(), 'keynv-autoscan-'));
    try {
      process.chdir(dir);
      // Project root marker.
      writeFileSync('package.json', JSON.stringify({ name: 'glmcore' }));
      // Per-app .env files.
      mkdirSync(join('apps', 'api'), { recursive: true });
      mkdirSync(join('apps', 'web'), { recursive: true });
      writeFileSync(
        join('apps', 'api', '.env'),
        'DATABASE_URL=postgres://api-db/main\nJWT_SECRET=api-jwt-secret\n',
      );
      writeFileSync(
        join('apps', 'web', '.env'),
        'NEXT_PUBLIC_API_URL=https://api.example.com\nNEXTAUTH_SECRET=web-auth-secret\n',
      );
      // Should be ignored.
      mkdirSync(join('node_modules', 'some-pkg'), { recursive: true });
      writeFileSync(join('node_modules', 'some-pkg', '.env'), 'IGNORED=yes\n');

      const request = vi.fn().mockImplementation((path: string, init?: { method?: string }) => {
        if (path === '/v1/health') {
          return Promise.resolve({
            version: '0.2.0',
            capabilities: { features: { batch_secret_create: true } },
          });
        }
        if (path === '/v1/projects' && (!init || init.method === undefined)) {
          // GET list: pretend project doesn't exist yet so we hit the create path.
          return Promise.resolve({ projects: [] });
        }
        if (path === '/v1/projects' && init?.method === 'POST') {
          return Promise.resolve({ id: 'p_test', name: 'glmcore' });
        }
        if (path === '/v1/projects/p_test/secrets/batch') {
          return Promise.resolve({ created: [] });
        }
        return Promise.resolve({});
      });

      const command = new InitCommand();
      // Clipanion Option fields require explicit values in test (no CLI parser runs).
      command.yes = true;
      command.noScripts = true;
      command.dryRun = false;
      command.envFile = undefined;
      command.project = undefined;
      command.env = undefined;
      command.secret = undefined;
      Object.assign(command, {
        context: {
          stdout: { write: vi.fn() },
          stderr: { write: vi.fn() },
        },
      });

      const result = await command.runAutoScan({ request } as unknown as ApiClient);
      expect(result).toBe(0);

      // Each app should have its own .keynv.env.
      // Secrets become alias references; literals pass through unchanged so
      // the app keeps working without the original .env on disk.
      const apiKeynv = readFileSync(join('apps', 'api', '.keynv.env'), 'utf8');
      expect(apiKeynv).toContain('DATABASE_URL=@glmcore.dev.DATABASE_URL');
      expect(apiKeynv).toContain('JWT_SECRET=@glmcore.dev.JWT_SECRET');

      const webKeynv = readFileSync(join('apps', 'web', '.keynv.env'), 'utf8');
      expect(webKeynv).toContain('NEXT_PUBLIC_API_URL=https://api.example.com');
      expect(webKeynv).toContain('NEXTAUTH_SECRET=@glmcore.dev.NEXTAUTH_SECRET');

      // Originals renamed to .env.backup, not deleted.
      expect(existsSync(join('apps', 'api', '.env'))).toBe(false);
      expect(existsSync(join('apps', 'web', '.env'))).toBe(false);
      expect(existsSync(join('apps', 'api', '.env.backup'))).toBe(true);
      expect(existsSync(join('apps', 'web', '.env.backup'))).toBe(true);
      expect(readFileSync(join('apps', 'api', '.env.backup'), 'utf8')).toContain(
        'DATABASE_URL=postgres://api-db/main',
      );

      // node_modules ignored.
      expect(existsSync(join('node_modules', 'some-pkg', '.env'))).toBe(true);
      expect(existsSync(join('node_modules', 'some-pkg', '.env.backup'))).toBe(false);
    } finally {
      process.chdir(cwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('routes ambiguous entries to the vault in --yes mode (fail-safe, no plaintext leak)', async () => {
    const cwd = process.cwd();
    const dir = mkdtempSync(join(tmpdir(), 'keynv-autoscan-amb-'));
    try {
      process.chdir(dir);
      writeFileSync('package.json', JSON.stringify({ name: 'glmcore' }));
      // RELEASE_CHANNEL=stable has no secret-suffix, no value pattern, and is
      // short/low-entropy → classifyEntry returns 'ambiguous'. With no human
      // gate (--yes) it must be treated as a secret, not written as plaintext.
      writeFileSync('.env', 'RELEASE_CHANNEL=stable\n');

      const request = vi.fn().mockImplementation((path: string, init?: { method?: string }) => {
        if (path === '/v1/health') {
          return Promise.resolve({
            version: '0.2.0',
            capabilities: { features: { batch_secret_create: true } },
          });
        }
        if (path === '/v1/projects' && (!init || init.method === undefined)) {
          return Promise.resolve({ projects: [] });
        }
        if (path === '/v1/projects' && init?.method === 'POST') {
          return Promise.resolve({ id: 'p_test', name: 'glmcore' });
        }
        if (path === '/v1/projects/p_test/secrets/batch') {
          return Promise.resolve({ created: [] });
        }
        return Promise.resolve({});
      });

      const command = new InitCommand();
      command.yes = true;
      command.noScripts = true;
      command.dryRun = false;
      command.envFile = undefined;
      command.project = undefined;
      command.env = undefined;
      command.secret = undefined;
      Object.assign(command, {
        context: { stdout: { write: vi.fn() }, stderr: { write: vi.fn() } },
      });

      const result = await command.runAutoScan({ request } as unknown as ApiClient);
      expect(result).toBe(0);

      const keynvEnv = readFileSync('.keynv.env', 'utf8');
      // Fail-safe: became an alias reference, NOT committable plaintext.
      expect(keynvEnv).toContain('RELEASE_CHANNEL=@glmcore.dev.RELEASE_CHANNEL');
      expect(keynvEnv).not.toContain('RELEASE_CHANNEL=stable');
    } finally {
      process.chdir(cwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes .keynv.env for --env-file migrations', async () => {
    const cwd = process.cwd();
    const dir = mkdtempSync(join(tmpdir(), 'keynv-init-'));
    try {
      process.chdir(dir);
      writeFileSync('.env', 'API_TOKEN=secret-value\n');

      const request = vi.fn().mockImplementation((path: string) => {
        if (path === '/v1/health') {
          return Promise.resolve({
            version: '0.2.0',
            capabilities: { features: { batch_secret_create: true } },
          });
        }
        if (path === '/v1/projects') {
          return Promise.resolve({ projects: [{ id: 'p_test', name: 'billing' }] });
        }
        if (path === '/v1/projects/p_test/secrets/batch') {
          return Promise.resolve({ created: [] });
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

  it('does not write .keynv.env when batch upload fails', async () => {
    const cwd = process.cwd();
    const dir = mkdtempSync(join(tmpdir(), 'keynv-init-batch-fail-'));
    try {
      process.chdir(dir);
      writeFileSync('.env', 'API_TOKEN=secret-value\n');

      const request = vi.fn().mockImplementation((path: string) => {
        if (path === '/v1/health') {
          return Promise.resolve({
            version: '0.2.0',
            capabilities: { features: { batch_secret_create: true } },
          });
        }
        if (path === '/v1/projects') {
          return Promise.resolve({ projects: [{ id: 'p_test', name: 'billing' }] });
        }
        if (path === '/v1/projects/p_test') {
          return Promise.resolve({ environments: [{ name: 'dev' }] });
        }
        if (path === '/v1/projects/p_test/secrets/batch') {
          return Promise.reject(
            Object.assign(new Error('Batch contains invalid or duplicate secrets.'), {
              details: [
                {
                  index: 0,
                  code: 'secret.already_exists',
                  env: 'dev',
                  key: 'API_TOKEN',
                },
              ],
            }),
          );
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
      const stderrWrite = vi.fn();
      Object.assign(command, {
        context: {
          stdout: { write: vi.fn() },
          stderr: { write: stderrWrite },
        },
      });

      const result = await command.runNonInteractive({ request } as unknown as ApiClient);

      expect(result).toBe(1);
      expect(existsSync('.keynv.env')).toBe(false);
      expect(stderrWrite).toHaveBeenCalledWith(
        '  failed: [0] dev/API_TOKEN: secret.already_exists\n',
      );
    } finally {
      process.chdir(cwd);
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
