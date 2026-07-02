import { describe, expect, it } from 'vitest';
import { type SourceEntry, planVaultKeys } from './collision.js';
import type { EnvFileHit } from './detect.js';

function fileHit(relativeDir: string, name = '.env'): EnvFileHit {
  return {
    path: `/abs/${relativeDir}/${name}`.replace(/\/\//g, '/'),
    name,
    suffix: name === '.env' ? null : (name.match(/^\.env\.(.+)$/)?.[1] ?? null),
    suggestedEnv: 'dev',
    relativeDir,
    containingDir: `/abs/${relativeDir}`.replace(/\/$/, '') || '/abs',
  };
}

function src(file: EnvFileHit, name: string, value: string, line = 1): SourceEntry {
  return { file, envName: 'dev', name, value, isAlias: false, line };
}

describe('planVaultKeys', () => {
  it('uses bare vault key when there is no collision', () => {
    const f = fileHit('apps/api');
    const plan = planVaultKeys([src(f, 'DATABASE_URL', 'postgres://api')]);
    expect(plan.resolved).toHaveLength(1);
    expect(plan.resolved[0]?.vaultKey).toBe('DATABASE_URL');
    expect(plan.resolved[0]?.localKey).toBe('DATABASE_URL');
    expect(plan.renamed).toEqual([]);
    expect(plan.merged).toEqual([]);
  });

  it('merges same-key/same-value collisions across dirs (one vault entry, fanned to all dirs)', () => {
    const a = fileHit('apps/api');
    const b = fileHit('apps/web');
    const plan = planVaultKeys([
      src(a, 'API_BASE', 'https://api.example.com'),
      src(b, 'API_BASE', 'https://api.example.com'),
    ]);
    expect(plan.merged).toHaveLength(1);
    expect(plan.merged[0]?.key).toBe('API_BASE');
    expect(plan.merged[0]?.sources.map((s) => s.relativeDir).sort()).toEqual([
      'apps/api',
      'apps/web',
    ]);
    expect(plan.resolved).toHaveLength(2);
    for (const r of plan.resolved) expect(r.vaultKey).toBe('API_BASE');
    expect(plan.renamed).toEqual([]);
  });

  it('prefixes with parent-dir basename when values differ across dirs', () => {
    const api = fileHit('apps/api');
    const web = fileHit('apps/web');
    const plan = planVaultKeys([
      src(api, 'DATABASE_URL', 'postgres://api'),
      src(web, 'DATABASE_URL', 'postgres://web'),
    ]);
    expect(plan.renamed).toHaveLength(2);
    const byRel = Object.fromEntries(plan.resolved.map((r) => [r.source.relativeDir, r.vaultKey]));
    expect(byRel['apps/api']).toBe('api-DATABASE_URL');
    expect(byRel['apps/web']).toBe('web-DATABASE_URL');
    expect(plan.merged).toEqual([]);
  });

  it('falls back to full-path slug when two collision sources share a basename', () => {
    const apps = fileHit('apps/api');
    const services = fileHit('services/api');
    const plan = planVaultKeys([
      src(apps, 'DATABASE_URL', 'a'),
      src(services, 'DATABASE_URL', 'b'),
    ]);
    const byRel = Object.fromEntries(plan.resolved.map((r) => [r.source.relativeDir, r.vaultKey]));
    expect(byRel['apps/api']).toBe('apps-api-DATABASE_URL');
    expect(byRel['services/api']).toBe('services-api-DATABASE_URL');
  });

  it('uses "root" slug for files at the scan root colliding with a subdir file', () => {
    const r = fileHit('');
    const api = fileHit('apps/api');
    const plan = planVaultKeys([src(r, 'DATABASE_URL', 'one'), src(api, 'DATABASE_URL', 'two')]);
    const byRel = Object.fromEntries(plan.resolved.map((r) => [r.source.relativeDir, r.vaultKey]));
    expect(byRel['']).toBe('root-DATABASE_URL');
    expect(byRel['apps/api']).toBe('api-DATABASE_URL');
  });

  it('disambiguates distinct local keys that normalize to the same vault key (AUDIT-FINDINGS-4 Y4)', () => {
    // `FOO!BAR` and `FOO@BAR` both strip to the vault key `foobar`, but are
    // distinct secrets with distinct values. Without the guard the second would
    // silently overwrite the first in the vault; instead it gets a `-2` suffix.
    const f = fileHit('apps/api');
    const plan = planVaultKeys([
      src(f, 'FOO!BAR', 'first-value'),
      src(f, 'FOO@BAR', 'second-value'),
    ]);
    const vaultKeys = plan.resolved.map((r) => r.vaultKey);
    // No two resolved entries share a vault key.
    expect(new Set(vaultKeys).size).toBe(vaultKeys.length);
    expect(vaultKeys).toContain('foobar');
    expect(vaultKeys).toContain('foobar-2');
    // Local keys (the process.env names) are preserved so app code still works.
    expect(plan.resolved.map((r) => r.localKey).sort()).toEqual(['FOO!BAR', 'FOO@BAR']);
    // The clash is surfaced, not silent.
    expect(plan.renamed.some((r) => r.vaultKey === 'foobar-2')).toBe(true);
  });

  it('collapses intra-dir duplicates with dotenv last-wins and records the shadow', () => {
    const dir = fileHit('apps/api', '.env');
    const dirLocal = fileHit('apps/api', '.env.local');
    const plan = planVaultKeys([
      src(dir, 'DATABASE_URL', 'first', 1),
      src(dirLocal, 'DATABASE_URL', 'second', 1),
    ]);
    expect(plan.resolved).toHaveLength(1);
    expect(plan.resolved[0]?.value).toBe('second');
    expect(plan.resolved[0]?.vaultKey).toBe('DATABASE_URL');
    expect(plan.shadowed).toHaveLength(1);
    expect(plan.shadowed[0]?.laterFile).toBe('.env.local');
    expect(plan.shadowed[0]?.earlierFiles).toEqual(['.env']);
  });

  it('keeps separate envs separate (same localKey in dev and prod is not a collision)', () => {
    const f = fileHit('apps/api');
    const plan = planVaultKeys([
      { ...src(f, 'DATABASE_URL', 'dev-val'), envName: 'dev' },
      { ...src(f, 'DATABASE_URL', 'prod-val'), envName: 'prod' },
    ]);
    expect(plan.resolved).toHaveLength(2);
    for (const r of plan.resolved) expect(r.vaultKey).toBe('DATABASE_URL');
    expect(plan.renamed).toEqual([]);
    expect(plan.merged).toEqual([]);
  });
});
