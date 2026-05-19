import { createClaudeCodeSurface } from './surfaces/claude-code.js';
import { createCursorSurface } from './surfaces/cursor.js';
import {
  createBashHistorySurface,
  createFishHistorySurface,
  createZshHistorySurface,
} from './surfaces/shell-history.js';
import type { TextSurface } from './types.js';

/**
 * Returns the set of *built-in* surfaces — one entry per supported
 * surface kind, in display order. Callers typically pair this with
 * `surface.isPresent()` to filter out kinds that don't apply to this
 * machine (e.g., no fish, no Cursor).
 */
export function builtinSurfaces(): TextSurface[] {
  return [
    createZshHistorySurface(),
    createBashHistorySurface(),
    createFishHistorySurface(),
    createClaudeCodeSurface(),
    createCursorSurface(),
  ];
}

/**
 * Returns only surfaces that are present on this machine. The discovery
 * step is best-effort: a stat error on the surface root counts as
 * "not present" — we never block on a permission denial.
 */
export async function discoverPresentSurfaces(): Promise<TextSurface[]> {
  const all = builtinSurfaces();
  const present: TextSurface[] = [];
  for (const s of all) {
    if (await s.isPresent()) present.push(s);
  }
  return present;
}
