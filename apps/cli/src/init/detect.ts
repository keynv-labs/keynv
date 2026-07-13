/**
 * Project-root + env-file discovery for `keynv init`. Walks upward
 * from a starting dir looking for any conventional project marker;
 * once a root is found, lists the .env-family files inside it
 * (recursively, with a sensible ignore list).
 */
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

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
/** Matches keynv's own `.env.backup` / `.env.backup-YYYYMMDD-HHmm[-N]` output. */
const ENV_BACKUP_EXCLUDE = /^\.env\.backup(-\d{8}-\d{4}(-\d+)?)?$/;
const KEYNV_ENV_BASENAME = '.keynv.env';
/** Matches `.keynv.env` and `.keynv.<env>.env` — keynv's own output. */
const KEYNV_ENV_EXCLUDE = /^\.keynv\.(.+\.)?env$/;

/**
 * Directory basenames we never descend into. Covers VCS metadata, package
 * manager caches, framework build/cache outputs, deployment-tool state,
 * Python virtualenvs, and IDE folders. The goal is to skip places that
 * would yield irrelevant `.env` matches (vendored copies, build artifacts,
 * fixtures) or massively bloat the scan (node_modules).
 */
export const IGNORE_DIRS: ReadonlySet<string> = new Set([
  // VCS + git hooks
  '.git',
  '.husky',
  // Package managers / dep caches
  'node_modules',
  '.yarn', // Yarn Berry / PnP cache
  'bower_components',
  // Generic build / output / coverage dirs
  'dist',
  'build',
  'out',
  'coverage',
  '.cache',
  '.nyc_output',
  // Rust / Go / PHP
  'target',
  'vendor',
  // JS / TS frameworks
  '.next', // Next.js
  '.turbo', // Turborepo
  '.nuxt', // Nuxt 2/3
  '.output', // Nitro / Nuxt 3 build output
  '.svelte-kit', // SvelteKit
  '.astro', // Astro
  '.angular', // Angular CLI cache
  '.parcel-cache', // Parcel bundler
  '.docusaurus', // Docusaurus
  '.expo', // Expo / React Native
  // Deployment / serverless platforms
  '.vercel',
  '.netlify',
  '.wrangler', // Cloudflare Workers
  '.serverless', // Serverless framework
  '.sst', // SST
  '.amplify', // AWS Amplify
  '.firebase', // Firebase
  // Python tooling (mixed-language monorepos)
  '.venv',
  'venv',
  '__pycache__',
  '.tox',
  '.mypy_cache',
  '.pytest_cache',
  '.ruff_cache',
  // IDE / editor state
  '.idea',
  '.vscode',
  '.fleet',
]);

const DEFAULT_MAX_DEPTH = 5;
/**
 * Safety cap on how many env files a single scan collects. A correctly
 * scoped project has a handful; hitting this many usually means the scan
 * root is too high (e.g. keynv run in the home directory). Callers can
 * treat a result at this length as "possibly truncated" and warn.
 */
export const DEFAULT_MAX_RESULTS = 100;

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
 * Walk up from `startDir` looking for the nearest project marker, but
 * never ascend to or past `boundaryDir` (the user's home directory by
 * default). A stray marker in the home directory — or anywhere above
 * it — must not turn the whole home tree into a "project root", which
 * would then make the env scan crawl the user's entire home folder.
 *
 * When no marker is found within that bounded region, the starting
 * directory itself becomes the root, so setup stays scoped to wherever
 * the user actually ran `keynv`. Only returns null in pathological
 * cases where the starting directory can't be resolved.
 */
export function findProjectRoot(
  startDir: string,
  boundaryDir: string = homedir(),
): ProjectRoot | null {
  const start = resolve(startDir);
  const boundary = resolve(boundaryDir);

  let dir = start;
  for (let i = 0; i < 64; i++) {
    // Never treat the boundary (home) or anything at/above it as a root.
    if (dir === boundary || isAncestorOf(dir, boundary)) break;
    const marker = markerAt(dir);
    if (marker) return buildRoot(dir, marker);
    const parent = dirname(dir);
    if (parent === dir) break; // reached the filesystem root
    dir = parent;
  }

  // No project marker found within scope — fall back to the starting
  // directory so setup stays scoped to the current project.
  return buildRoot(start, 'current directory');
}

/** Return the project-marker filename present in `dir`, or null. */
function markerAt(dir: string): string | null {
  for (const marker of PROJECT_MARKERS) {
    if (existsSync(join(dir, marker))) return marker;
  }
  if (existsSync(join(dir, GIT_MARKER))) return GIT_MARKER;
  return null;
}

/** True when `ancestor` is a strict parent (any level up) of `descendant`. */
function isAncestorOf(ancestor: string, descendant: string): boolean {
  const rel = relative(resolve(ancestor), resolve(descendant));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
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
          Object.entries(pkg.scripts).filter(([, v]) => typeof v === 'string') as Array<
            [string, string]
          >,
        );
      }
    } catch {
      invalid = true;
    }
  }
  return {
    path: dir,
    suggestedName,
    marker,
    packageJsonScripts: scripts,
    packageJsonInvalid: invalid,
  };
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
  /**
   * Path of the containing directory relative to the scan root, using
   * POSIX separators for stable display/sort across platforms.
   * Empty string for files at the scan root itself.
   */
  relativeDir: string;
  /** Absolute directory containing the file — where the sibling `.keynv.env` goes. */
  containingDir: string;
}

export interface FindEnvFilesOptions {
  /** Max directory depth from the scan root (root itself is depth 0). */
  maxDepth?: number;
  /** Directory basenames to skip when descending. Defaults to {@link IGNORE_DIRS}. */
  ignore?: ReadonlySet<string>;
  /** Max number of hits to collect before stopping. Defaults to {@link DEFAULT_MAX_RESULTS}. */
  limit?: number;
}

/**
 * Non-recursive listing of `.env*` files in a single directory.
 * Kept as a thin wrapper over the recursive walker for callers/tests
 * that only care about the top level.
 */
export function findEnvFiles(rootDir: string): EnvFileHit[] {
  return findEnvFilesRecursive(rootDir, { maxDepth: 1 });
}

/**
 * Recursively list `.env*` files under `rootDir`. Skips well-known
 * vendor / build / cache directories ({@link IGNORE_DIRS}), follows
 * symlinked files but never descends into symlinked directories
 * (cycle safety; a separate realpath-based visited set guards against
 * cycles created via mixed links). Excludes `.env.example` family and
 * keynv's own `.keynv*.env` outputs so re-running init never
 * re-ingests its previous run.
 *
 * Returned hits are sorted: files at the scan root first (plain `.env`
 * before suffixed siblings, alphabetical), then by subdirectory
 * (alphabetical), then by name within each subdirectory.
 */
export function findEnvFilesRecursive(
  rootDir: string,
  opts: FindEnvFilesOptions = {},
): EnvFileHit[] {
  const maxDepth = Math.max(1, opts.maxDepth ?? DEFAULT_MAX_DEPTH);
  const ignore = opts.ignore ?? IGNORE_DIRS;
  const limit = Math.max(1, opts.limit ?? DEFAULT_MAX_RESULTS);

  let rootReal: string;
  try {
    rootReal = realpathSync(rootDir);
  } catch {
    return [];
  }

  const hits: EnvFileHit[] = [];
  const seen = new Set<string>([rootReal]);
  // (absolute dir, depth) — depth is the number of directory levels
  // below the scan root (0 = root itself).
  const queue: Array<{ dir: string; depth: number }> = [{ dir: rootDir, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const { dir, depth } = current;

    let entries: Array<{ name: string; isFile: boolean; isDir: boolean; isSymlink: boolean }>;
    try {
      const raw = readdirSync(dir, { withFileTypes: true });
      entries = raw.map((d) => ({
        name: d.name,
        isFile: d.isFile(),
        isDir: d.isDirectory(),
        isSymlink: d.isSymbolicLink(),
      }));
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = join(dir, entry.name);

      // File candidate.
      // Note: for symlinks, isFile/isDir are false on the dirent; we resolve via statSync.
      let isFile = entry.isFile;
      let isDir = entry.isDir;
      if (entry.isSymlink) {
        // Files we follow (preserve existing semantics); dirs we skip.
        try {
          const st = statSync(full);
          isFile = st.isFile();
          // Deliberately leave isDir=false: never descend into symlinked dirs.
          if (st.isDirectory()) isDir = false;
        } catch {
          continue;
        }
      }

      if (isFile) {
        if (!ENV_GLOB.test(entry.name)) continue;
        if (ENV_EXAMPLE.test(entry.name)) continue;
        if (ENV_BACKUP_EXCLUDE.test(entry.name)) continue;
        if (KEYNV_ENV_EXCLUDE.test(entry.name)) continue;
        const suffixMatch = entry.name.match(/^\.env\.(.+)$/);
        const suffix = suffixMatch ? (suffixMatch[1] as string) : null;
        const rel = relative(rootDir, dir);
        const relativeDir = rel === '' ? '' : rel.split(sep).join('/');
        hits.push({
          path: full,
          name: entry.name,
          suffix,
          suggestedEnv: suggestedEnvForSuffix(suffix),
          relativeDir,
          containingDir: dir,
        });
        if (hits.length >= limit) {
          queue.length = 0; // stop scanning: hit the safety cap
          break;
        }
        continue;
      }

      if (isDir && depth + 1 < maxDepth) {
        if (ignore.has(entry.name)) continue;
        // Skip arbitrary hidden dirs (.gemini, .config, .omniroute, …) that
        // aren't in the ignore allowlist — they're not project source and
        // would otherwise pull in unrelated .env files.
        if (entry.name.startsWith('.')) continue;
        let realDir: string;
        try {
          realDir = realpathSync(full);
        } catch {
          continue;
        }
        if (seen.has(realDir)) continue;
        seen.add(realDir);
        queue.push({ dir: full, depth: depth + 1 });
      }
    }
  }

  // Stable ordering:
  //   1. Root hits before subdirectory hits.
  //   2. Within root: plain `.env` first, then alphabetical by name.
  //   3. Across subdirs: alphabetical by relativeDir (POSIX), then plain `.env` first, then name.
  hits.sort((a, b) => {
    const aRoot = a.relativeDir === '';
    const bRoot = b.relativeDir === '';
    if (aRoot !== bRoot) return aRoot ? -1 : 1;
    if (a.relativeDir !== b.relativeDir) return a.relativeDir.localeCompare(b.relativeDir);
    if (a.suffix === null && b.suffix !== null) return -1;
    if (a.suffix !== null && b.suffix === null) return 1;
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
