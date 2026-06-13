import { describe, expect, it } from 'vitest';
import { hasAliases, substitute } from './resolve.js';

describe('hasAliases', () => {
  it('returns false for a plain command with no aliases (server-free redaction path)', () => {
    expect(hasAliases(['npm', 'run', 'dev'])).toBe(false);
    expect(hasAliases(['next', 'dev', '--port', '3005'])).toBe(false);
  });

  it('detects an alias embedded in an argv token', () => {
    expect(hasAliases(['mysql', '-p@billing.dev.db_pass', '-h', 'db.example.com'])).toBe(true);
  });

  it('detects an alias only present in extra strings (--via-env / env-file values)', () => {
    expect(hasAliases(['node', './migrate.js'], ['DB_PASS=@billing.dev.db_pass'])).toBe(true);
  });

  it('returns false when extra strings are all plain values', () => {
    expect(hasAliases(['echo', 'hello'], ['PORT=3000', 'NODE_ENV=production'])).toBe(false);
  });

  it('ignores an at-sign that is not a valid alias literal', () => {
    expect(hasAliases(['git', 'commit', '-m', 'fix @here'])).toBe(false);
    expect(hasAliases(['echo', 'user@example.com'])).toBe(false);
  });
});

describe('substitute', () => {
  it('returns the text unchanged when there are no resolved aliases', () => {
    expect(substitute('npm run dev', [])).toBe('npm run dev');
  });
});
