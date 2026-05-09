import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Marker that wraps every block keynv writes into a shared file (e.g.,
 * .gitignore, shell rc). The marker lets uninstall remove only our
 * additions without touching user-authored content.
 */
export const KEYNV_BEGIN = '# >>> keynv >>>';
export const KEYNV_END = '# <<< keynv <<<';

export function readJsonOrEmpty(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function writeJson(path: string, value: unknown): void {
  ensureDir(path);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o644 });
}

/**
 * Adds `lines` to `path` (creating the file if needed) inside a
 * keynv-marked block. Idempotent: re-running with the same lines
 * leaves the file unchanged.
 */
export function ensureKeynvBlock(path: string, lines: ReadonlyArray<string>): boolean {
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const marked = existing.split('\n');
  const beginIdx = marked.findIndex((l) => l.trim() === KEYNV_BEGIN);
  const endIdx = marked.findIndex((l) => l.trim() === KEYNV_END);

  const block = [KEYNV_BEGIN, ...lines, KEYNV_END];
  let next: string[];
  if (beginIdx >= 0 && endIdx > beginIdx) {
    next = [...marked.slice(0, beginIdx), ...block, ...marked.slice(endIdx + 1)];
  } else {
    next = existing.length > 0 && !existing.endsWith('\n')
      ? [...marked, '', ...block]
      : [...(marked[marked.length - 1] === '' ? marked.slice(0, -1) : marked), ...block, ''];
  }
  const out = next.join('\n');
  if (out === existing) return false;
  ensureDir(path);
  writeFileSync(path, out, { mode: 0o644 });
  return true;
}

/**
 * Removes a previously-written keynv block from `path` if present.
 * Returns true if the file was modified.
 */
export function removeKeynvBlock(path: string): boolean {
  if (!existsSync(path)) return false;
  const lines = readFileSync(path, 'utf8').split('\n');
  const beginIdx = lines.findIndex((l) => l.trim() === KEYNV_BEGIN);
  const endIdx = lines.findIndex((l) => l.trim() === KEYNV_END);
  if (beginIdx < 0 || endIdx <= beginIdx) return false;
  const next = [...lines.slice(0, beginIdx), ...lines.slice(endIdx + 1)];
  // Drop a trailing blank artifact if the block ended right at EOF.
  while (next.length > 0 && next[next.length - 1] === '') next.pop();
  writeFileSync(path, `${next.join('\n')}${next.length ? '\n' : ''}`, { mode: 0o644 });
  return true;
}
