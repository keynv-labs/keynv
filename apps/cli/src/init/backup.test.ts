import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backupEnvFile, timestampSlug } from './backup.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'keynv-backup-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('backupEnvFile', () => {
  it('renames .env to .env.backup on first call', () => {
    const envPath = join(root, '.env');
    writeFileSync(envPath, 'DATABASE_URL=foo');
    const r = backupEnvFile(envPath);
    expect(r.renamedTo).toBe(`${envPath}.backup`);
    expect(r.usedTimestamp).toBe(false);
    expect(existsSync(envPath)).toBe(false);
    expect(readFileSync(`${envPath}.backup`, 'utf8')).toBe('DATABASE_URL=foo');
  });

  it('falls back to timestamped name when .env.backup already exists', () => {
    const envPath = join(root, '.env');
    writeFileSync(envPath, 'NEW=1');
    writeFileSync(`${envPath}.backup`, 'OLD=1');
    const fixedDate = new Date(2026, 4, 15, 14, 30); // May 15 2026 14:30 local
    const r = backupEnvFile(envPath, fixedDate);
    expect(r.usedTimestamp).toBe(true);
    expect(r.renamedTo).toBe(`${envPath}.backup-20260515-1430`);
    expect(readFileSync(`${envPath}.backup`, 'utf8')).toBe('OLD=1');
    expect(readFileSync(`${envPath}.backup-20260515-1430`, 'utf8')).toBe('NEW=1');
  });

  it('also works for suffixed env files (.env.local → .env.local.backup)', () => {
    const envPath = join(root, '.env.local');
    writeFileSync(envPath, '');
    const r = backupEnvFile(envPath);
    expect(r.renamedTo).toBe(`${envPath}.backup`);
    expect(existsSync(`${envPath}.backup`)).toBe(true);
  });
});

describe('timestampSlug', () => {
  it('formats local time as YYYYMMDD-HHmm', () => {
    expect(timestampSlug(new Date(2026, 0, 1, 0, 0))).toBe('20260101-0000');
    expect(timestampSlug(new Date(2026, 11, 31, 23, 59))).toBe('20261231-2359');
    expect(timestampSlug(new Date(2026, 4, 15, 14, 30))).toBe('20260515-1430');
  });

  it('produces a string matching the expected regex', () => {
    expect(timestampSlug()).toMatch(/^\d{8}-\d{4}$/);
  });
});
