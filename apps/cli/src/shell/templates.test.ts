import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BUILTIN_PATTERNS } from '@keynv/redactor';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BASH_HOOK, FISH_HOOK, SHELL_SECRET_ERE, ZSH_HOOK } from './templates.js';

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

// AUDIT-FINDINGS-4 K3: the shell ERE bank is a hand-mirrored subset of the
// canonical `@keynv/redactor` pattern bank. Nothing enforced that the two stay
// in sync, so a pattern added to the redactor could silently never protect
// shell history. This suite makes drift a test failure: every canonical pattern
// must be either behaviourally covered by the shell bank OR explicitly exempted
// with a reason.
describe('shell secret bank stays in sync with the canonical redactor bank', () => {
  // Representative samples per pattern, built from concatenated pieces so no
  // contiguous secret-shaped literal appears in source (keeps gitleaks quiet).
  const x = (n: number) => 'x'.repeat(n);
  const SAMPLES: Record<string, string> = {
    'postgres-uri': 'postgres://user:pass@db.example.com:5432/app',
    'mysql-uri': 'mysql://root:rootpw@10.0.0.5:3306/app',
    'mongodb-uri': 'mongodb+srv://u:p@cluster0.mongo.net/app',
    'redis-uri-with-password': 'rediss://default:abc123@redis.example.com:6379/0',
    'aws-access-key-id': `AKIA${'ABCD1234'.repeat(2)}`,
    'gcp-api-key': `${'AIza'}${x(35)}`,
    'github-pat-classic': `${'ghp'}_${x(36)}`,
    'github-oauth-user-to-server': `${'ghu'}_${x(36)}`,
    'github-oauth-server-to-server': `${'gho'}_${x(36)}`,
    'github-pat-fine-grained': `${'github'}_pat_${x(40)}`,
    'slack-bot-token': `${'xoxb'}-${x(24)}`,
    'slack-user-token': `${'xoxp'}-${x(24)}`,
    'stripe-live-secret-key': `${'sk'}_${'live'}_${x(24)}`,
    'stripe-test-secret-key': `${'sk'}_${'test'}_${x(24)}`,
    'stripe-restricted-live-key': `${'rk'}_${'live'}_${x(24)}`,
    'stripe-restricted-test-key': `${'rk'}_${'test'}_${x(24)}`,
    'openai-api-key': `${'sk'}-${x(20)}`,
    'anthropic-api-key': `${'sk'}-ant-api03-${x(20)}`,
    jwt: `${'eyJ'}${x(10)}.${'eyJ'}${x(10)}.${x(10)}`,
  };

  // Canonical patterns intentionally NOT mirrored into the pure-shell bank.
  const SHELL_EXEMPT: Record<string, string> = {
    'pem-private-key': 'multiline — cannot appear on a single shell command line',
    'pgp-private-key': 'multiline — cannot appear on a single shell command line',
    'slack-webhook': 'low shell-history incidence; caught by the watcher daemon',
    'twilio-account-sid': 'hex-shaped; deferred to the watcher daemon',
    'twilio-api-key-sid': 'hex-shaped; deferred to the watcher daemon',
    'mailgun-api-key': 'hex-shaped; deferred to the watcher daemon',
    'sendgrid-api-key': 'deferred to the watcher daemon',
  };

  const shellRe = new RegExp(SHELL_SECRET_ERE);

  it('every canonical pattern is categorized (mirrored-with-sample or exempted)', () => {
    for (const p of BUILTIN_PATTERNS) {
      const categorized = p.name in SHELL_EXEMPT || p.name in SAMPLES;
      expect(
        categorized,
        `${p.name} is neither exempted nor mirrored — add it to SHELL_SECRET_ERE (+ a SAMPLE) or to SHELL_EXEMPT with a reason`,
      ).toBe(true);
    }
  });

  it('shell bank behaviourally covers every non-exempt canonical pattern', () => {
    for (const p of BUILTIN_PATTERNS) {
      if (p.name in SHELL_EXEMPT) continue;
      const sample = SAMPLES[p.name];
      expect(sample, `missing sample for ${p.name}`).toBeTruthy();
      // The sample really is an instance of the canonical pattern …
      expect(new RegExp(p.regex.source).test(sample as string), `canonical ${p.name}`).toBe(true);
      // … and the shell bank catches it too (else the banks drifted).
      expect(shellRe.test(sample as string), `shell bank missing ${p.name}`).toBe(true);
    }
  });
});
