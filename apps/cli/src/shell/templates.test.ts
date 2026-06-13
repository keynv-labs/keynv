import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BASH_HOOK, FISH_HOOK, ZSH_HOOK } from './templates.js';

/** Is `bin` an invokable shell on this machine? */
function shellAvailable(bin: string): boolean {
  try {
    const r = spawnSync(bin, ['--version'], { stdio: 'ignore' });
    return r.error === undefined && (r.status === 0 || r.status === null);
  } catch {
    return false;
  }
}

const HAS = {
  zsh: shellAvailable('zsh'),
  bash: shellAvailable('bash'),
  fish: shellAvailable('fish'),
};

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'keynv-shell-tpl-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Parse-only (no-execute) check of a hook body with the given shell. */
function parseCheck(bin: string, args: string[], body: string, ext: string) {
  const file = join(dir, `hook.${ext}`);
  writeFileSync(file, body);
  return spawnSync(bin, [...args, file], { encoding: 'utf8' });
}

// A broken hook template would break every new interactive shell for anyone
// who ran `keynv shell install` — high blast radius, otherwise untested. Parse
// each generated hook with the real shell (skipped where the shell is absent).
describe('shell hook templates parse under the real shell', () => {
  it.skipIf(!HAS.zsh)('zsh hook is valid (`zsh -n`)', () => {
    const r = parseCheck('zsh', ['-n'], ZSH_HOOK, 'zsh');
    expect(r.status, r.stderr ?? '').toBe(0);
  });

  it.skipIf(!HAS.bash)('bash hook is valid (`bash -n`)', () => {
    const r = parseCheck('bash', ['-n'], BASH_HOOK, 'bash');
    expect(r.status, r.stderr ?? '').toBe(0);
  });

  it.skipIf(!HAS.fish)('fish hook is valid (`fish --no-execute`)', () => {
    const r = parseCheck('fish', ['--no-execute'], FISH_HOOK, 'fish');
    expect(r.status, r.stderr ?? '').toBe(0);
  });
});
