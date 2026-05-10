/**
 * `.keynv.env` parser, finder, and loader.
 *
 * The file format is intentionally a small subset of dotenv — KEY=VALUE
 * lines, optional quoting, `#` comments, optional `export` prefix. No
 * variable interpolation, no inline comments, no multi-line values.
 *
 * Values that parse as a `@project.env.key` alias get resolved through
 * the keynv server before being injected into the subprocess env;
 * everything else is passed through as a plain literal so the same
 * file can carry NODE_ENV, PORT, etc. alongside real secrets.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { parseAlias } from '@keynv/core';

const MAX_FILE_BYTES = 1_000_000;
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const ENV_FILE_BASENAME = '.keynv.env';

export interface EnvFileEntry {
  name: string;
  value: string;
  isAlias: boolean;
  /** 1-indexed source line of the entry. */
  line: number;
}

export interface ParsedEnvFile {
  path: string;
  entries: EnvFileEntry[];
}

export class EnvFileParseError extends Error {
  constructor(
    public readonly file: string,
    public readonly line: number,
    public readonly reason: string,
  ) {
    super(`${file}:${line}: ${reason}`);
    this.name = 'EnvFileParseError';
  }
}

export class EnvFileNotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`env file not found: ${path}`);
    this.name = 'EnvFileNotFoundError';
  }
}

export class EnvFileTooLargeError extends Error {
  constructor(
    public readonly path: string,
    public readonly bytes: number,
  ) {
    super(`env file ${path} is ${bytes} bytes (max ${MAX_FILE_BYTES})`);
    this.name = 'EnvFileTooLargeError';
  }
}

/**
 * Parse `.keynv.env` content. Pure function; throws EnvFileParseError on
 * a bad line. The returned entries preserve source order; on duplicate
 * keys the last entry wins but every occurrence is recorded so the
 * caller can warn.
 */
export function parseEnvFile(content: string, filename: string): EnvFileEntry[] {
  // Strip UTF-8 BOM if present.
  const normalized = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const lines = normalized.split(/\r?\n/);
  const entries: EnvFileEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const lineNo = i + 1;

    // Trim only leading/trailing whitespace from the *line* for comment
    // and blank detection; we re-derive value-side whitespace below.
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith('#')) continue;

    // Strip optional `export ` prefix (dotenv copy-paste compatibility).
    let body = trimmed;
    if (body.startsWith('export ')) {
      body = body.slice('export '.length).trimStart();
    }

    const eq = body.indexOf('=');
    if (eq <= 0) {
      throw new EnvFileParseError(filename, lineNo, "expected 'KEY=value'");
    }

    const name = body.slice(0, eq).trim();
    if (!KEY_RE.test(name)) {
      throw new EnvFileParseError(
        filename,
        lineNo,
        `invalid key '${name}' (must match /^[A-Za-z_][A-Za-z0-9_]*$/)`,
      );
    }

    let valueRaw = body.slice(eq + 1);
    let value: string;

    // Quoting: only honor when the *first non-space* char is a quote.
    const valueLeading = valueRaw.replace(/^\s+/, '');
    const firstCh = valueLeading.charAt(0);
    if (firstCh === '"' || firstCh === "'") {
      const close = valueLeading.lastIndexOf(firstCh);
      if (close === 0) {
        throw new EnvFileParseError(filename, lineNo, `unclosed ${firstCh} quote`);
      }
      // Everything inside the outermost matching quote is preserved
      // verbatim. No escape sequences (keep parser tiny). Anything
      // after the closing quote is treated as a syntax error.
      const after = valueLeading.slice(close + 1).trim();
      if (after.length > 0) {
        throw new EnvFileParseError(
          filename,
          lineNo,
          `unexpected content after closing ${firstCh}`,
        );
      }
      value = valueLeading.slice(1, close);
    } else {
      // Unquoted: trim trailing whitespace; preserve internal spaces.
      value = valueRaw.replace(/\s+$/, '');
      // Also trim leading whitespace for symmetry (devs paste indented).
      value = value.replace(/^\s+/, '');
    }

    entries.push({
      name,
      value,
      isAlias: parseAlias(value) !== null,
      line: lineNo,
    });
  }

  return entries;
}

/**
 * Walk from `startDir` upward looking for `.keynv.env`. Returns the
 * absolute path of the first hit, or null if we reach the filesystem
 * root without finding one.
 */
export function findEnvFile(startDir: string): string | null {
  let dir = resolve(startDir);
  // Bound the loop to a sane depth so a pathological symlink tree
  // can't hang us. 64 levels is far more than any real layout.
  for (let i = 0; i < 64; i++) {
    const candidate = join(dir, ENV_FILE_BASENAME);
    if (existsSync(candidate)) {
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        // Permission error reading stat — treat as not found here;
        // the loader will surface a clearer error if the user passed
        // an explicit path.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

export interface LoadOptions {
  /** --env-file <path>; absolute or cwd-relative. Throws if missing. */
  explicitPath?: string;
  /** --no-env-file; skips discovery AND envVarOverride. */
  disabled?: boolean;
  /** Working directory used for discovery and to resolve explicitPath. */
  cwd: string;
  /** KEYNV_ENV_FILE env var; behaves like explicitPath but lower priority. */
  envVarOverride?: string;
}

/**
 * Resolves which env file (if any) to load for this invocation. Returns
 * null when discovery yields nothing or when --no-env-file is set.
 *
 * Throws EnvFileNotFoundError when an explicit path (flag or env var)
 * points at a missing file, EnvFileTooLargeError when it exceeds the
 * size cap, and EnvFileParseError on parse failures.
 */
export function loadEnvFile(opts: LoadOptions): ParsedEnvFile | null {
  if (opts.disabled) return null;

  const pickExplicit = opts.explicitPath ?? opts.envVarOverride;
  let path: string | null = null;
  if (pickExplicit !== undefined) {
    path = isAbsolute(pickExplicit) ? pickExplicit : resolve(opts.cwd, pickExplicit);
    if (!existsSync(path)) throw new EnvFileNotFoundError(path);
  } else {
    path = findEnvFile(opts.cwd);
  }
  if (path === null) return null;

  const stat = statSync(path);
  if (stat.size > MAX_FILE_BYTES) {
    throw new EnvFileTooLargeError(path, stat.size);
  }
  const content = readFileSync(path, 'utf8');
  const entries = parseEnvFile(content, path);
  return { path, entries };
}
