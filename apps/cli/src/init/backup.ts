/**
 * Safe rename of a migrated `.env` file to a `.env.backup` sibling.
 * If the plain `.env.backup` target already exists (e.g. from a
 * prior init run) we append a local-time minute-resolution stamp so
 * the previous backup is never clobbered.
 */
import { existsSync, renameSync } from 'node:fs';

export interface BackupResult {
  /** Absolute path the original was renamed to. */
  renamedTo: string;
  /** True when a timestamped suffix was needed to avoid clobbering. */
  usedTimestamp: boolean;
}

/**
 * Rename `absolutePath` to `<absolutePath>.backup`. On collision,
 * appends `-YYYYMMDD-HHmm` (local time). Throws on filesystem
 * failure — the caller logs and proceeds.
 */
export function backupEnvFile(absolutePath: string, now: Date = new Date()): BackupResult {
  const plain = `${absolutePath}.backup`;
  if (!existsSync(plain)) {
    renameSync(absolutePath, plain);
    return { renamedTo: plain, usedTimestamp: false };
  }
  const stamped = `${absolutePath}.backup-${timestampSlug(now)}`;
  renameSync(absolutePath, stamped);
  return { renamedTo: stamped, usedTimestamp: true };
}

/** `YYYYMMDD-HHmm` in local time, e.g. `20260515-1430`. */
export function timestampSlug(d: Date = new Date()): string {
  const y = d.getFullYear();
  const mo = pad2(d.getMonth() + 1);
  const da = pad2(d.getDate());
  const h = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return `${y}${mo}${da}-${h}${mi}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
