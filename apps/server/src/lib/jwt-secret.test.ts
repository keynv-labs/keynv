import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveJwtSecret } from './jwt-secret.js';

describe('resolveJwtSecret', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'keynv-jwt-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('prefers a valid env value and does not write a file', () => {
    const path = join(dir, 'jwt.secret');
    const secret = resolveJwtSecret({ envValue: 'a'.repeat(40), path });
    expect(secret).toBe('a'.repeat(40));
    expect(existsSync(path)).toBe(false);
  });

  it('generates and persists a secret when none is provided', () => {
    const path = join(dir, 'jwt.secret');
    const secret = resolveJwtSecret({ envValue: undefined, path });
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(readFileSync(path, 'utf8')).toBe(secret);
  });

  it('reuses the persisted secret across restarts', () => {
    const path = join(dir, 'jwt.secret');
    const first = resolveJwtSecret({ envValue: undefined, path });
    const second = resolveJwtSecret({ envValue: undefined, path });
    expect(second).toBe(first);
  });

  it('ignores an env value shorter than 32 chars and falls back to a generated one', () => {
    const path = join(dir, 'jwt.secret');
    const secret = resolveJwtSecret({ envValue: 'tooshort', path });
    expect(secret).not.toBe('tooshort');
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(existsSync(path)).toBe(true);
  });
});
