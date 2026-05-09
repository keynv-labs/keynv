import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aider } from './aider.js';
import { claudeCode } from './claude-code.js';
import { cursor } from './cursor.js';
import { REGISTRY, findIntegration } from './index.js';

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'keynv-int-'));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

describe('registry', () => {
  it('exposes the five Phase 2 integrations', () => {
    expect(REGISTRY.map((i) => i.name).sort()).toEqual(
      ['aider', 'claude-code', 'codex', 'cursor', 'opencode'].sort(),
    );
  });

  it('findIntegration looks up by name', () => {
    expect(findIntegration('claude-code')?.displayName).toBe('Claude Code');
    expect(findIntegration('does-not-exist')).toBeNull();
  });
});

describe('claude-code', () => {
  it('writes settings.local.json with permission denies and PostToolUse hook', async () => {
    const report = await claudeCode.install({ cwd });
    expect(report.applied).toBe(true);
    const settingsPath = join(cwd, '.claude', 'settings.local.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as {
      permissions?: { deny?: string[] };
      hooks?: Record<string, Array<{ matcher?: string; hooks?: Array<{ command: string }> }>>;
    };
    const denies = settings.permissions?.deny ?? [];
    expect(denies.length).toBeGreaterThan(0);
    expect(denies).toContain('Read(.env)');
    expect(denies).toContain('Read(*.pem)');
    const post = settings.hooks?.PostToolUse ?? [];
    const bashHook = post.find((p) => p.matcher === 'Bash');
    expect(bashHook?.hooks?.[0]?.command).toBe('keynv redact-stream');
  });

  it('is idempotent across re-installs', async () => {
    await claudeCode.install({ cwd });
    const first = readFileSync(join(cwd, '.claude/settings.local.json'), 'utf8');
    await claudeCode.install({ cwd });
    const second = readFileSync(join(cwd, '.claude/settings.local.json'), 'utf8');
    expect(second).toBe(first);
  });

  it('uninstall removes denies + hook it added', async () => {
    await claudeCode.install({ cwd });
    const after = await claudeCode.uninstall({ cwd });
    expect(after.applied).toBe(true);
    const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.local.json'), 'utf8')) as {
      permissions?: { deny?: string[] };
      hooks?: Record<string, unknown>;
    };
    expect(settings.permissions?.deny ?? []).toEqual([]);
    expect(settings.hooks?.PostToolUse).toBeUndefined();
  });

  it('uninstall preserves user-authored deny entries', async () => {
    // Pretend the user already had unrelated denies.
    const userSettings = {
      permissions: { deny: ['Read(secret-from-user.txt)'] },
      hooks: {
        PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'echo hi' }] }],
      },
    };
    const fs = await import('node:fs');
    fs.mkdirSync(join(cwd, '.claude'), { recursive: true });
    fs.writeFileSync(
      join(cwd, '.claude/settings.local.json'),
      `${JSON.stringify(userSettings, null, 2)}\n`,
    );
    await claudeCode.install({ cwd });
    await claudeCode.uninstall({ cwd });
    const settings = JSON.parse(readFileSync(join(cwd, '.claude/settings.local.json'), 'utf8')) as {
      permissions?: { deny?: string[] };
      hooks?: { PostToolUse?: Array<{ matcher?: string }> };
    };
    expect(settings.permissions?.deny).toContain('Read(secret-from-user.txt)');
    expect(settings.hooks?.PostToolUse).toEqual([
      { matcher: 'Edit', hooks: [{ type: 'command', command: 'echo hi' }] },
    ]);
  });

  it('dry-run does not modify the filesystem', async () => {
    const report = await claudeCode.install({ cwd, dryRun: true });
    expect(report.applied).toBe(false);
    const fs = await import('node:fs');
    expect(fs.existsSync(join(cwd, '.claude/settings.local.json'))).toBe(false);
  });
});

describe('cursor / aider — keynv-marked block', () => {
  it('cursor install writes deny patterns inside markers', async () => {
    await cursor.install({ cwd });
    const text = readFileSync(join(cwd, '.cursorignore'), 'utf8');
    expect(text).toContain('# >>> keynv >>>');
    expect(text).toContain('.env');
    expect(text).toContain('# <<< keynv <<<');
  });

  it('cursor uninstall removes only the keynv block', async () => {
    const fs = await import('node:fs');
    fs.writeFileSync(join(cwd, '.cursorignore'), '# my own ignore\nbuild/\n');
    await cursor.install({ cwd });
    await cursor.uninstall({ cwd });
    const text = readFileSync(join(cwd, '.cursorignore'), 'utf8');
    expect(text).toContain('# my own ignore');
    expect(text).toContain('build/');
    expect(text).not.toContain('# >>> keynv >>>');
  });

  it('aider install is idempotent', async () => {
    await aider.install({ cwd });
    const a = readFileSync(join(cwd, '.aiderignore'), 'utf8');
    await aider.install({ cwd });
    const b = readFileSync(join(cwd, '.aiderignore'), 'utf8');
    expect(b).toBe(a);
  });
});
