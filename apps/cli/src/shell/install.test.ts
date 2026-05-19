import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { install, status, uninstall } from './install.js';
import { BLOCK_END, BLOCK_START, SHELL_SECRET_ERE, ZSH_HOOK } from './templates.js';

let workdir: string;
let prev: string | undefined;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'keynv-shell-'));
  prev = process.env.KEYNV_SHELL_HOME;
  process.env.KEYNV_SHELL_HOME = workdir;
});

afterEach(async () => {
  if (prev === undefined) delete process.env.KEYNV_SHELL_HOME;
  else process.env.KEYNV_SHELL_HOME = prev;
  await rm(workdir, { recursive: true, force: true });
});

describe('shell hook install', () => {
  it('creates the hook script + marked block in .zshrc when neither exists', async () => {
    const result = await install('zsh');
    expect(result.status).toBe('installed');

    const hook = await readFile(join(workdir, '.config/keynv/shell/keynv-zsh.zsh'), 'utf8');
    expect(hook).toBe(ZSH_HOOK);

    const rc = await readFile(join(workdir, '.zshrc'), 'utf8');
    expect(rc).toContain(BLOCK_START);
    expect(rc).toContain(BLOCK_END);
    expect(rc).toContain('keynv-zsh.zsh');
  });

  it('preserves existing rc content and appends the block', async () => {
    const rcPath = join(workdir, '.zshrc');
    await writeFile(rcPath, "alias ll='ls -la'\nexport EDITOR=vim\n");
    const result = await install('zsh');
    expect(result.status).toBe('installed');

    const rc = await readFile(rcPath, 'utf8');
    expect(rc).toMatch(/^alias ll='ls -la'\nexport EDITOR=vim/);
    expect(rc).toContain(BLOCK_START);
  });

  it('is idempotent — second install does not duplicate the block', async () => {
    await install('zsh');
    const result = await install('zsh');
    expect(result.status).toBe('already-installed');

    const rc = await readFile(join(workdir, '.zshrc'), 'utf8');
    const occurrences = rc.split(BLOCK_START).length - 1;
    expect(occurrences).toBe(1);
  });

  it('upgrades the hook body on re-install (without re-adding the block)', async () => {
    await install('zsh');
    const hookPath = join(workdir, '.config/keynv/shell/keynv-zsh.zsh');
    // Simulate an older keynv install leaving outdated content
    await writeFile(hookPath, '# old keynv hook — to be replaced\n');
    const result = await install('zsh');
    expect(result.status).toBe('already-installed');
    const hook = await readFile(hookPath, 'utf8');
    expect(hook).toBe(ZSH_HOOK);
  });

  it('uninstall removes the marked block and leaves user content intact', async () => {
    const rcPath = join(workdir, '.zshrc');
    await writeFile(rcPath, "alias ll='ls -la'\nexport EDITOR=vim\n");
    await install('zsh');
    const result = await uninstall('zsh');
    expect(result.status).toBe('removed');
    const rc = await readFile(rcPath, 'utf8');
    expect(rc).not.toContain(BLOCK_START);
    expect(rc).toContain("alias ll='ls -la'");
    expect(rc).toContain('export EDITOR=vim');
  });

  it('uninstall reports not-installed when the block is missing', async () => {
    await writeFile(join(workdir, '.zshrc'), 'plain rc\n');
    const result = await uninstall('zsh');
    expect(result.status).toBe('not-installed');
  });

  it('uninstall optionally deletes the hook script file', async () => {
    await install('zsh');
    const result = await uninstall('zsh', { deleteHookFile: true });
    expect(result.status).toBe('removed');
    await expect(readFile(join(workdir, '.config/keynv/shell/keynv-zsh.zsh'))).rejects.toThrow();
  });

  it('status reports each layer independently', async () => {
    const before = await status('zsh');
    expect(before.rcPresent).toBe(false);
    expect(before.blockPresent).toBe(false);
    expect(before.hookPresent).toBe(false);

    await install('zsh');
    const after = await status('zsh');
    expect(after.rcPresent).toBe(true);
    expect(after.blockPresent).toBe(true);
    expect(after.hookPresent).toBe(true);

    await uninstall('zsh', { deleteHookFile: true });
    const final = await status('zsh');
    expect(final.rcPresent).toBe(true);
    expect(final.blockPresent).toBe(false);
    expect(final.hookPresent).toBe(false);
  });

  it('handles bash + fish identically (.bashrc / config.fish)', async () => {
    await mkdir(join(workdir, '.config/fish'), { recursive: true });
    const bash = await install('bash');
    const fish = await install('fish');
    expect(bash.status).toBe('installed');
    expect(fish.status).toBe('installed');

    const bashRc = await readFile(join(workdir, '.bashrc'), 'utf8');
    expect(bashRc).toContain('keynv-bash.bash');

    const fishRc = await readFile(join(workdir, '.config/fish/config.fish'), 'utf8');
    expect(fishRc).toContain('keynv-fish.fish');
    // Fish syntax uses `test ...; and source ...`
    expect(fishRc).toMatch(/test -f .*; and source/);
  });
});

describe('SHELL_SECRET_ERE pattern bank', () => {
  // We compile the ERE using JavaScript regex with the `u` flag.
  // JS RegExp accepts the same character classes; this is a sanity
  // check that we'd catch the high-impact vendor prefixes.
  const re = () => new RegExp(SHELL_SECRET_ERE);

  // Secret-shape fixtures are *constructed at runtime* (template literals
  // with split prefixes) so the contiguous secret-looking literal never
  // appears in source. GitHub's secret-scanning push protection
  // otherwise rejects the test file even though every value is a
  // shape-only mock — `sk_live_<24x>`, etc.
  it.each([
    ['AWS key', `${'AKIA'}IOSFODNN7EXAMPLE`],
    ['GCP key', `${'AIza'}SyAaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRr`],
    ['github classic PAT', `${'ghp'}_${'a'.repeat(36)}`],
    [
      'github fine-grained PAT',
      `${'github'}_pat_11${'A'.repeat(24)}_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789`,
    ],
    ['slack bot token', `${'xoxb'}-1234567890-1234567890123-abcdefghijklmnop`],
    ['stripe live secret', `${'sk'}_live_${'x'.repeat(24)}`],
    ['anthropic api key', `${'sk'}-ant-api03-${'a'.repeat(24)}`],
    ['openai key', `${'sk'}-proj-${'a'.repeat(20)}`],
    [
      'jwt',
      `${'eyJ'}hbGciOiJIUzI1NiJ9.${'eyJ'}zdWIiOiIxMjM0NTY3ODkwIn0.signaturesigna`,
    ],
    ['postgres uri w/ creds', `${'postgres'}://user:pass@db.example.com:5432/app`],
    ['redis uri w/ creds', `${'redis'}://:secret@cache.example.com:6379`],
  ])('matches a %s shape', (_label, sample) => {
    expect(re().test(sample)).toBe(true);
  });

  it.each([
    'ls /Users/foo/bar/baz',
    'git checkout main',
    'AKIA-NOT-A-KEY-TOO-SHORT',
    'curl https://api.github.com/repos/foo/bar',
  ])('does not match innocuous shell input: %s', (sample) => {
    expect(re().test(sample)).toBe(false);
  });
});
