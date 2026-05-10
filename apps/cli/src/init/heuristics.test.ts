import { describe, expect, it } from 'vitest';
import { classifyEntry, previewValue } from './heuristics.js';

describe('classifyEntry — framework-managed (skip)', () => {
  it('skips NODE_ENV regardless of value (framework sets this itself)', () => {
    expect(classifyEntry('NODE_ENV', 'development').verdict).toBe('skip');
    expect(classifyEntry('NODE_ENV', 'production').verdict).toBe('skip');
  });

  it('skips PORT and HOST (deploy-target sets these)', () => {
    expect(classifyEntry('PORT', '3000').verdict).toBe('skip');
    expect(classifyEntry('HOST', '0.0.0.0').verdict).toBe('skip');
    expect(classifyEntry('HOSTNAME', 'app').verdict).toBe('skip');
  });

  it('skips PATH/HOME/USER/SHELL/PWD (shell-set; never override)', () => {
    expect(classifyEntry('PATH', '/usr/bin:/bin').verdict).toBe('skip');
    expect(classifyEntry('HOME', '/home/me').verdict).toBe('skip');
    expect(classifyEntry('USER', 'me').verdict).toBe('skip');
    expect(classifyEntry('SHELL', '/bin/zsh').verdict).toBe('skip');
    expect(classifyEntry('PWD', '/cwd').verdict).toBe('skip');
  });

  it('skips CI (set by CI runner, not by us)', () => {
    expect(classifyEntry('CI', 'true').verdict).toBe('skip');
  });
});

describe('classifyEntry — literal allowlist', () => {
  it('marks DEBUG literal (user-set debug toggle)', () => {
    expect(classifyEntry('DEBUG', '*').verdict).toBe('literal');
    expect(classifyEntry('DEBUG', 'express:*').verdict).toBe('literal');
  });

  it('marks LOG_LEVEL, TZ, LANG literal (intentional config)', () => {
    expect(classifyEntry('LOG_LEVEL', 'debug').verdict).toBe('literal');
    expect(classifyEntry('TZ', 'America/Los_Angeles').verdict).toBe('literal');
    expect(classifyEntry('LANG', 'en_US.UTF-8').verdict).toBe('literal');
  });

  it('marks NEXT_PUBLIC_* and VITE_* literal (build-time bundled)', () => {
    expect(classifyEntry('NEXT_PUBLIC_API_URL', 'https://api.example.com').verdict).toBe('literal');
    expect(classifyEntry('VITE_APP_TITLE', 'My App').verdict).toBe('literal');
    expect(classifyEntry('REACT_APP_VERSION', '1.0.0').verdict).toBe('literal');
  });

  it('marks empty value literal', () => {
    expect(classifyEntry('SOMETHING', '').verdict).toBe('literal');
  });
});

describe('classifyEntry — value-shape detectors', () => {
  it('flags OpenAI keys', () => {
    const r = classifyEntry('FOO', 'sk-proj-abcdefghijklmnopqrst');
    expect(r.verdict).toBe('secret');
    expect(r.hint).toMatch(/OpenAI/);
  });

  it('flags Stripe live keys (and not Stripe publishable as secret-equivalent)', () => {
    expect(classifyEntry('FOO', 'sk_live_abc123').verdict).toBe('secret');
    const pk = classifyEntry('FOO', 'pk_live_abc123');
    expect(pk.verdict).toBe('secret');
    expect(pk.hint).toMatch(/double-check/);
  });

  it('flags GitHub PATs', () => {
    expect(classifyEntry('FOO', 'ghp_abcdefghijklmnopqrstuvwxyz1234567').verdict).toBe('secret');
    expect(classifyEntry('FOO', 'github_pat_abcdef_xyz').verdict).toBe('secret');
  });

  it('flags AWS access key ids', () => {
    expect(classifyEntry('FOO', 'AKIAIOSFODNN7EXAMPLE').verdict).toBe('secret');
  });

  it('flags JWTs', () => {
    expect(
      classifyEntry(
        'FOO',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.signature-here',
      ).verdict,
    ).toBe('secret');
  });

  it('flags PEM private keys', () => {
    expect(
      classifyEntry('FOO', '-----BEGIN RSA PRIVATE KEY-----\nMIIEpA...').verdict,
    ).toBe('secret');
  });

  it('flags connection strings with embedded credentials', () => {
    expect(classifyEntry('FOO', 'postgres://user:pass@db.example.com:5432/app').verdict).toBe(
      'secret',
    );
    expect(classifyEntry('FOO', 'redis://default:hunter2@redis.example.com:6379').verdict).toBe(
      'secret',
    );
  });
});

describe('classifyEntry — name-shape detectors', () => {
  it('flags *_API_KEY, *_SECRET, *_TOKEN, *_PASSWORD', () => {
    expect(classifyEntry('OPENAI_API_KEY', 'short').verdict).toBe('secret');
    expect(classifyEntry('JWT_SECRET', 'x').verdict).toBe('secret');
    expect(classifyEntry('GITHUB_TOKEN', 'x').verdict).toBe('secret');
    expect(classifyEntry('DB_PASSWORD', 'x').verdict).toBe('secret');
  });

  it('flags DATABASE_URL even without credentials in value', () => {
    expect(classifyEntry('DATABASE_URL', 'postgres://localhost/app').verdict).toBe('secret');
    expect(classifyEntry('REDIS_URL', 'redis://localhost').verdict).toBe('secret');
  });
});

describe('classifyEntry — entropy fallback', () => {
  it('flags 32+ char high-entropy values as secrets', () => {
    const r = classifyEntry('MY_THING', 'aB3cD4eF5gH6iJ7kL8mN9oP0qR1sT2uV3w');
    expect(r.verdict).toBe('secret');
    expect(r.hint).toMatch(/random/);
  });

  it('keeps short values ambiguous (no name + value evidence)', () => {
    expect(classifyEntry('MY_THING', 'short').verdict).toBe('ambiguous');
  });

  it('keeps low-entropy long values ambiguous', () => {
    expect(classifyEntry('MY_THING', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').verdict).toBe(
      'ambiguous',
    );
  });
});

describe('previewValue', () => {
  it('returns (empty) for empty', () => {
    expect(previewValue('')).toBe('(empty)');
  });

  it('passes through short values', () => {
    expect(previewValue('hello', 40)).toBe('hello');
  });

  it('truncates long values with ellipsis', () => {
    expect(previewValue('a'.repeat(50), 10)).toBe(`${'a'.repeat(9)}…`);
  });
});
