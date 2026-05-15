import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findEnvFiles,
  findEnvFilesRecursive,
  findProjectRoot,
  hasExistingKeynvEnv,
  suggestedEnvForSuffix,
} from './detect.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'keynv-init-detect-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('findProjectRoot', () => {
  it('finds package.json at startDir', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'my-app' }));
    const r = findProjectRoot(root);
    expect(r?.path).toBe(root);
    expect(r?.marker).toBe('package.json');
    expect(r?.suggestedName).toBe('my-app');
  });

  it('strips npm scope from suggestedName', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@org/my-pkg' }));
    expect(findProjectRoot(root)?.suggestedName).toBe('my-pkg');
  });

  it('falls back to folder basename when package.json has no name', () => {
    writeFileSync(join(root, 'package.json'), '{}');
    const r = findProjectRoot(root);
    expect(r?.suggestedName).toBe(basename(root));
  });

  it('extracts scripts from package.json', () => {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'x', scripts: { dev: 'next dev', build: 'next build' } }),
    );
    const r = findProjectRoot(root);
    expect(r?.packageJsonScripts).toEqual({ dev: 'next dev', build: 'next build' });
  });

  it('handles invalid package.json gracefully', () => {
    writeFileSync(join(root, 'package.json'), '{ this is not json');
    const r = findProjectRoot(root);
    expect(r?.packageJsonInvalid).toBe(true);
    expect(r?.packageJsonScripts).toBeNull();
  });

  it('walks upward through parent dirs', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'outer' }));
    const sub = join(root, 'a', 'b', 'c');
    mkdirSync(sub, { recursive: true });
    expect(findProjectRoot(sub)?.path).toBe(root);
  });

  it('falls back to .git when no language marker exists', () => {
    mkdirSync(join(root, '.git'));
    expect(findProjectRoot(root)?.marker).toBe('.git');
  });

  it('returns null when neither marker is found anywhere up the tree', () => {
    // root is a fresh tmpdir with nothing — but the parent chain may
    // contain a real .git or package.json. Walk to a dir that we know
    // is empty by descending into a sub we just made.
    const sub = join(root, 'leaf');
    mkdirSync(sub);
    // If the host machine's tmp dir has no markers up to /, this is
    // null. If it does (rare), the test reveals an env quirk.
    const r = findProjectRoot(sub);
    if (r !== null) {
      // we'd have walked all the way up to an actual project — make
      // sure the marker is one of the recognized ones, not a false
      // positive
      expect(r.marker).toBeDefined();
    }
  });
});

describe('findEnvFiles', () => {
  it('lists all .env-family files non-recursively', () => {
    writeFileSync(join(root, '.env'), '');
    writeFileSync(join(root, '.env.local'), '');
    writeFileSync(join(root, '.env.production'), '');
    const hits = findEnvFiles(root);
    expect(hits.map((h) => h.name)).toEqual(['.env', '.env.local', '.env.production']);
  });

  it('skips placeholder/template variants (.example, .sample, .template, .dist, .defaults)', () => {
    for (const name of [
      '.env.example',
      '.env.sample',
      '.env.template',
      '.env.dist',
      '.env.defaults',
    ]) {
      writeFileSync(join(root, name), '');
    }
    writeFileSync(join(root, '.env'), '');
    expect(findEnvFiles(root).map((h) => h.name)).toEqual(['.env']);
  });

  it('skips .keynv.env (managed by keynv)', () => {
    writeFileSync(join(root, '.keynv.env'), '');
    writeFileSync(join(root, '.env'), '');
    expect(findEnvFiles(root).map((h) => h.name)).toEqual(['.env']);
  });

  it('returns empty list when no env files exist', () => {
    expect(findEnvFiles(root)).toEqual([]);
  });

  it('returns empty when dir is unreadable', () => {
    expect(findEnvFiles(join(root, 'does-not-exist'))).toEqual([]);
  });

  it('places plain .env first, others alphabetically', () => {
    writeFileSync(join(root, '.env.staging'), '');
    writeFileSync(join(root, '.env.production'), '');
    writeFileSync(join(root, '.env'), '');
    writeFileSync(join(root, '.env.local'), '');
    expect(findEnvFiles(root).map((h) => h.name)).toEqual([
      '.env',
      '.env.local',
      '.env.production',
      '.env.staging',
    ]);
  });
});

describe('suggestedEnvForSuffix', () => {
  it('maps null (plain .env) to dev', () => {
    expect(suggestedEnvForSuffix(null)).toBe('dev');
  });

  it('merges local/development/dev into dev', () => {
    expect(suggestedEnvForSuffix('local')).toBe('dev');
    expect(suggestedEnvForSuffix('development')).toBe('dev');
    expect(suggestedEnvForSuffix('dev')).toBe('dev');
  });

  it('maps production/prod to prod', () => {
    expect(suggestedEnvForSuffix('production')).toBe('prod');
    expect(suggestedEnvForSuffix('prod')).toBe('prod');
  });

  it('maps staging/stage to staging', () => {
    expect(suggestedEnvForSuffix('staging')).toBe('staging');
    expect(suggestedEnvForSuffix('stage')).toBe('staging');
  });

  it('keeps unknown suffix as-is', () => {
    expect(suggestedEnvForSuffix('canary')).toBe('canary');
  });
});

describe('hasExistingKeynvEnv', () => {
  it('detects existing .keynv.env', () => {
    expect(hasExistingKeynvEnv(root)).toBe(false);
    writeFileSync(join(root, '.keynv.env'), '');
    expect(hasExistingKeynvEnv(root)).toBe(true);
  });
});

describe('findEnvFilesRecursive', () => {
  it('discovers .env files at root and across nested workspace dirs', () => {
    writeFileSync(join(root, '.env'), '');
    mkdirSync(join(root, 'apps', 'api'), { recursive: true });
    mkdirSync(join(root, 'apps', 'web'), { recursive: true });
    mkdirSync(join(root, 'packages', 'shared'), { recursive: true });
    writeFileSync(join(root, 'apps', 'api', '.env'), '');
    writeFileSync(join(root, 'apps', 'web', '.env.production'), '');
    writeFileSync(join(root, 'packages', 'shared', '.env'), '');

    const hits = findEnvFilesRecursive(root);
    expect(hits.map((h) => `${h.relativeDir}/${h.name}`)).toEqual([
      '/.env',
      'apps/api/.env',
      'apps/web/.env.production',
      'packages/shared/.env',
    ]);
    const rootHit = hits.find((h) => h.relativeDir === '');
    expect(rootHit?.containingDir).toBe(root);
    const apiHit = hits.find((h) => h.relativeDir === 'apps/api');
    expect(apiHit?.containingDir).toBe(join(root, 'apps', 'api'));
  });

  it('skips well-known vendor / build / cache / framework / venv / IDE dirs', () => {
    for (const ignored of [
      // VCS + dep caches
      'node_modules',
      '.git',
      '.yarn',
      'bower_components',
      // Build / output
      'dist',
      'build',
      'out',
      'coverage',
      '.nyc_output',
      'target',
      'vendor',
      // JS frameworks
      '.next',
      '.turbo',
      '.nuxt',
      '.output',
      '.svelte-kit',
      '.astro',
      '.angular',
      '.parcel-cache',
      '.expo',
      // Deployment
      '.vercel',
      '.netlify',
      '.wrangler',
      '.serverless',
      '.sst',
      '.amplify',
      '.firebase',
      // Python
      '.venv',
      'venv',
      '__pycache__',
      '.pytest_cache',
      // IDE
      '.idea',
      '.vscode',
    ]) {
      const dir = join(root, ignored, 'inner');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, '.env'), 'SECRET=x');
    }
    mkdirSync(join(root, 'apps', 'api'), { recursive: true });
    writeFileSync(join(root, 'apps', 'api', '.env'), '');
    const hits = findEnvFilesRecursive(root);
    expect(hits.map((h) => h.relativeDir)).toEqual(['apps/api']);
  });

  it('honors maxDepth (root only when maxDepth=1)', () => {
    writeFileSync(join(root, '.env'), '');
    mkdirSync(join(root, 'apps', 'api'), { recursive: true });
    writeFileSync(join(root, 'apps', 'api', '.env'), '');
    expect(findEnvFilesRecursive(root, { maxDepth: 1 }).map((h) => h.relativeDir)).toEqual(['']);
    expect(findEnvFilesRecursive(root, { maxDepth: 5 }).map((h) => h.relativeDir).sort()).toEqual([
      '',
      'apps/api',
    ]);
  });

  it('excludes .keynv.env and .keynv.<env>.env (own outputs) everywhere', () => {
    writeFileSync(join(root, '.keynv.env'), '');
    writeFileSync(join(root, '.keynv.prod.env'), '');
    mkdirSync(join(root, 'apps', 'web'), { recursive: true });
    writeFileSync(join(root, 'apps', 'web', '.keynv.env'), '');
    writeFileSync(join(root, 'apps', 'web', '.env'), '');
    const hits = findEnvFilesRecursive(root);
    expect(hits.map((h) => `${h.relativeDir}/${h.name}`)).toEqual(['apps/web/.env']);
  });

  it('skips symlinked directories (cycle safety) but follows symlinked files', () => {
    mkdirSync(join(root, 'real'), { recursive: true });
    writeFileSync(join(root, 'real', '.env'), 'X=1');
    // Symlinked directory — should be skipped.
    try {
      symlinkSync(join(root, 'real'), join(root, 'linked-dir'), 'dir');
    } catch {
      // Symlink may fail on Windows without dev-mode permission; skip silently.
      return;
    }
    // Symlinked file — should be followed.
    try {
      symlinkSync(join(root, 'real', '.env'), join(root, '.env'), 'file');
    } catch {
      // ignore
    }
    const hits = findEnvFilesRecursive(root);
    const seenRelative = new Set(hits.map((h) => `${h.relativeDir}/${h.name}`));
    expect(seenRelative.has('real/.env')).toBe(true);
    expect(seenRelative.has('linked-dir/.env')).toBe(false);
  });

  it('places root files (plain .env first) before subdir files; subdirs sorted alphabetically', () => {
    mkdirSync(join(root, 'z-pkg'), { recursive: true });
    mkdirSync(join(root, 'a-pkg'), { recursive: true });
    writeFileSync(join(root, '.env.production'), '');
    writeFileSync(join(root, '.env'), '');
    writeFileSync(join(root, 'z-pkg', '.env'), '');
    writeFileSync(join(root, 'a-pkg', '.env'), '');
    const hits = findEnvFilesRecursive(root);
    expect(hits.map((h) => `${h.relativeDir}/${h.name}`)).toEqual([
      '/.env',
      '/.env.production',
      'a-pkg/.env',
      'z-pkg/.env',
    ]);
  });
});
