/**
 * Project-root + env-file discovery for `keynv init`. Walks upward
 * from a starting dir looking for any conventional project marker;
 * once a root is found, lists the .env-family files inside it.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const PROJECT_MARKERS = [
  'package.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'pnpm-workspace.yaml',
  'deno.json',
  'deno.jsonc',
  'requirements.txt',
];
const GIT_MARKER = '.git';

const ENV_GLOB = /^\.env(\.[A-Za-z0-9_-]+)?$/;
const ENV_EXAMPLE = /^\.env\.(example|sample|template|dist|defaults)$/;
const KEYNV_ENV_BASENAME = '.keynv.env';

export interface ProjectRoot {
  /** Absolute path of the directory containing the project marker. */
  path: string;
  /** Suggested project name — package.json `name`, then folder basename. */
  suggestedName: string;
  /** Marker that won, e.g. 'package.json' or '.git'. */
  marker: string;
  /** When the marker is package.json, the parsed `scripts` field if present. */
  packageJsonScripts: Record<string, string> | null;
  /** True if the package.json on disk had a JSON parse error. */
  packageJsonInvalid: boolean;
}

/**
 * Walk up from `startDir` looking for the nearest project marker.
 * Returns null if the filesystem root is reached with no marker.
 *
 * Bound at 64 levels to defend against pathological symlink trees.
 */
export function findProjectRoot(startDir: string): ProjectRoot | null {
  let dir = resolve(startDir);
  for (let i = 0; i < 64; i++) {
    for (const marker of PROJECT_MARKERS) {
      const candidate = join(dir, marker);
      if (existsSync(candidate)) {
        return buildRoot(dir, marker);
      }
    }
    if (existsSync(join(dir, GIT_MARKER))) {
      return buildRoot(dir, GIT_MARKER);
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

function buildRoot(dir: string, marker: string): ProjectRoot {
  let suggestedName = basename(dir);
  let scripts: Record<string, string> | null = null;
  let invalid = false;
  if (marker === 'package.json' || existsSync(join(dir, 'package.json'))) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        name?: string;
        scripts?: Record<string, string>;
      };
      if (typeof pkg.name === 'string' && pkg.name.length > 0) {
        // Strip npm scopes (`@org/`) to get a clean keynv project name.
        suggestedName = pkg.name.replace(/^@[^/]+\//, '');
      }
      if (pkg.scripts && typeof pkg.scripts === 'object') {
        scripts = Object.fromEntries(
          Object.entries(pkg.scripts).filter(
            ([, v]) => typeof v === 'string',
          ) as Array<[string, string]>,
        );
      }
    } catch {
      invalid = true;
    }
  }
  return { path: dir, suggestedName, marker, packageJsonScripts: scripts, packageJsonInvalid: invalid };
}

export interface EnvFileHit {
  /** Absolute path to the file. */
  path: string;
  /** Bare basename (e.g. `.env.production`). */
  name: string;
  /** The bit after `.env.` if any (e.g. `production`); null for plain `.env`. */
  suffix: string | null;
  /** Suggested keynv environment name based on suffix conventions. */
  suggestedEnv: string;
}

/**
 * List `.env*` files in a directory (non-recursive). Filters out
 * `.env.example` / `.env.sample` / `.env.template` because those are
 * onboarding placeholders, never real values.
 */
export function findEnvFiles(rootDir: string): EnvFileHit[] {
  let entries: string[];
  try {
    entries = readdirSync(rootDir);
  } catch {
    return [];
  }
  const hits: EnvFileHit[] = [];
  for (const name of entries) {
    if (!ENV_GLOB.test(name)) continue;
    if (ENV_EXAMPLE.test(name)) continue;
    if (name === KEYNV_ENV_BASENAME) continue;
    const full = join(rootDir, name);
    try {
      if (!statSync(full).isFile()) continue;
    } catch {
      continue;
    }
    const suffixMatch = name.match(/^\.env\.(.+)$/);
    const suffix = suffixMatch ? (suffixMatch[1] as string) : null;
    hits.push({ path: full, name, suffix, suggestedEnv: suggestedEnvForSuffix(suffix) });
  }
  // Stable ordering: plain `.env` first, then alphabetical.
  hits.sort((a, b) => {
    if (a.suffix === null) return -1;
    if (b.suffix === null) return 1;
    return a.name.localeCompare(b.name);
  });
  return hits;
}

/**
 * Map a `.env` filename suffix to the conventional keynv environment
 * name. Plain `.env` (no suffix) and `.env.local` both default to
 * `dev` — local is a developer override of the same env, so they
 * merge into one keynv env.
 */
export function suggestedEnvForSuffix(suffix: string | null): string {
  if (suffix === null) return 'dev';
  switch (suffix) {
    case 'local':
    case 'development':
    case 'dev':
      return 'dev';
    case 'production':
    case 'prod':
      return 'prod';
    case 'staging':
    case 'stage':
      return 'staging';
    case 'test':
      return 'test';
    case 'preview':
      return 'preview';
    default:
      return suffix;
  }
}

/**
 * True when the project root already has a `.keynv.env` file.
 * Useful so the init flow can switch to merge mode and never
 * overwrite without confirmation.
 */
export function hasExistingKeynvEnv(rootDir: string): boolean {
  return existsSync(join(rootDir, KEYNV_ENV_BASENAME));
}
