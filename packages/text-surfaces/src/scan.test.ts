import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scanFile } from './scan.js';
import { createBashHistorySurface, createZshHistorySurface } from './surfaces/shell-history.js';

let workdir: string;
let prevHome: string | undefined;
let prevHistfile: string | undefined;
let prevShell: string | undefined;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'keynv-ts-test-'));
  prevHome = process.env.KEYNV_TS_HOME;
  prevHistfile = process.env.HISTFILE;
  prevShell = process.env.SHELL;
  process.env.KEYNV_TS_HOME = workdir;
  delete process.env.HISTFILE;
  delete process.env.SHELL;
});

afterEach(async () => {
  if (prevHome === undefined) delete process.env.KEYNV_TS_HOME;
  else process.env.KEYNV_TS_HOME = prevHome;
  if (prevHistfile === undefined) delete process.env.HISTFILE;
  else process.env.HISTFILE = prevHistfile;
  if (prevShell === undefined) delete process.env.SHELL;
  else process.env.SHELL = prevShell;
  await rm(workdir, { recursive: true, force: true });
});

describe('scanFile', () => {
  it('flags AWS-shaped secrets and counts patterns honestly', async () => {
    const path = join(workdir, 'history');
    await writeFile(
      path,
      [
        'export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
        'curl -H "X-Token: ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" example.com',
        'echo hello world',
      ].join('\n'),
    );
    const scan = await scanFile(path);
    expect(scan.matchCount).toBeGreaterThanOrEqual(2);
    expect(scan.patternCounts['aws-access-key-id']).toBe(1);
    expect(scan.patternCounts['github-pat-classic']).toBe(1);
    expect(scan.skipped).toBeUndefined();
    // previews never carry the raw value
    for (const p of scan.previews) {
      expect(p.preview.length).toBeLessThanOrEqual(8);
      expect(p.preview).not.toContain('AKIAIOSFODNN7EXAMPLE');
    }
  });

  it('does not flag long filesystem paths as high-entropy', async () => {
    const path = join(workdir, 'history');
    await writeFile(
      path,
      [
        'cd /Users/someone/projects/my-app/packages/core/src',
        'ls -la /var/log/system.log /usr/local/bin/keynv',
        'cat ~/Library/Application\\ Support/keynv/config.json',
      ].join('\n'),
    );
    const scan = await scanFile(path);
    expect(scan.matchCount).toBe(0);
    expect(scan.patternCounts).toEqual({});
  });

  it('marks the file as skipped when missing instead of throwing', async () => {
    const scan = await scanFile(join(workdir, 'does-not-exist'));
    expect(scan.skipped).toBe(true);
    expect(scan.skipReason).toBe('missing');
    expect(scan.matchCount).toBe(0);
  });

  it('respects --no-entropy by leaving entropy hits out', async () => {
    const path = join(workdir, 'history');
    // 40-char random-ish token that the entropy detector would
    // otherwise flag (no vendor prefix; high entropy).
    const entropyFixture = ['k9Lp2X7vQ4', 'mN8jR3wY6', 'tZ1bC5sA0e', 'F7dG8hP6qJ2'].join('');
    await writeFile(path, `TOKEN=${entropyFixture}`);
    const withEntropy = await scanFile(path);
    expect(withEntropy.matchCount).toBeGreaterThanOrEqual(1);
    const noEntropy = await scanFile(path, { entropy: false });
    expect(noEntropy.matchCount).toBe(0);
  });
});

describe('ShellHistorySurface', () => {
  it('reports not present when the history file is missing', async () => {
    const surface = createZshHistorySurface();
    expect(await surface.isPresent()).toBe(false);
  });

  it('scans the zsh history file when present', async () => {
    await writeFile(
      join(workdir, '.zsh_history'),
      ': 1700000000:0;export SECRET=ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n',
    );
    const surface = createZshHistorySurface();
    expect(await surface.isPresent()).toBe(true);
    const result = await surface.scan();
    expect(result.surfaceId).toBe('shell-history:zsh');
    expect(result.totalMatches).toBe(1);
    expect(result.files[0]?.patternCounts['github-pat-classic']).toBe(1);
  });

  it('returns 0 matches for a clean bash history', async () => {
    await writeFile(join(workdir, '.bash_history'), 'ls\ncd /tmp\necho hi\n');
    const surface = createBashHistorySurface();
    expect(await surface.isPresent()).toBe(true);
    const result = await surface.scan();
    expect(result.totalMatches).toBe(0);
  });
});
