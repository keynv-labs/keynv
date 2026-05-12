import { describe, expect, it, vi } from 'vitest';
import { InitCommand } from '../commands/init.js';
import { resolveProjectId, isProjectId } from '../commands/project.js';

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
      const mockClient = {
        request: vi.fn(),
      };
      const result = await resolveProjectId(mockClient as any, 'p_go6rqgwz0wlokdsl55ikn');
      expect(result).toBe('p_go6rqgwz0wlokdsl55ikn');
      expect(mockClient.request).not.toHaveBeenCalled();
    });

    it('looks up project by name when not an ID', async () => {
      const mockClient = {
        request: vi.fn().mockResolvedValue({
          projects: [{ id: 'p_abc123', name: 'myproject' }],
        }),
      };
      const result = await resolveProjectId(mockClient as any, 'myproject');
      expect(result).toBe('p_abc123');
      expect(mockClient.request).toHaveBeenCalledWith('/v1/projects');
    });

    it('throws when project name not found', async () => {
      const mockClient = {
        request: vi.fn().mockResolvedValue({
          projects: [{ id: 'p_abc123', name: 'otherproject' }],
        }),
      };
      await expect(resolveProjectId(mockClient as any, 'nonexistent')).rejects.toThrow(
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
});
