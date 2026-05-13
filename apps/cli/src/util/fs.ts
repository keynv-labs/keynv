import { dirname, resolve } from 'node:path';

/**
 * Walk up from `startDir` to filesystem root, calling `predicate` at
 * each level. Returns the first non-null result, or null after reaching
 * root without a hit.
 *
 * Bound at 64 levels to defend against pathological symlink trees.
 */
export function walkUp<T>(startDir: string, predicate: (dir: string) => T): T | null {
  let dir = resolve(startDir);
  for (let i = 0; i < 64; i++) {
    const result = predicate(dir);
    if (result !== null && result !== undefined) return result;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}
