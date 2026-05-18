import { constants, access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Lifecycle state for the keynv watcher daemon.
 *
 *   ~/.local/share/keynv/watcher.pid     — pidfile
 *   ~/.local/share/keynv/watcher.status  — JSON snapshot, updated every ~10s
 *   ~/.local/share/keynv/watcher.log     — append-only JSONL audit log
 *
 * Honours `KEYNV_WATCHER_STATE_DIR` so tests can stub the location.
 */

export function stateDir(): string {
  if (process.env.KEYNV_WATCHER_STATE_DIR) return process.env.KEYNV_WATCHER_STATE_DIR;
  return join(homedir(), '.local', 'share', 'keynv');
}

export function pidPath(): string {
  return join(stateDir(), 'watcher.pid');
}

export function statusPath(): string {
  return join(stateDir(), 'watcher.status');
}

export function logPath(): string {
  return join(stateDir(), 'watcher.log');
}

export async function ensureStateDir(): Promise<void> {
  await mkdir(stateDir(), { recursive: true, mode: 0o700 });
}

export async function readPidfile(): Promise<number | null> {
  try {
    const raw = await readFile(pidPath(), 'utf8');
    const n = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function writePidfile(pid: number): Promise<void> {
  await ensureStateDir();
  await writeFile(pidPath(), `${pid}\n`, { mode: 0o600 });
}

export async function removePidfile(): Promise<void> {
  try {
    await rm(pidPath());
  } catch {
    // ignore — best-effort cleanup
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export interface WatcherStatus {
  readonly pid: number;
  readonly startedAt: string;
  readonly version: string;
  readonly surfaces: ReadonlyArray<string>;
  readonly filesWatched: number;
  readonly totalRewrites: number;
  readonly totalMatchesScrubbed: number;
  readonly lastRewriteAt: string | null;
  readonly lastError?: { ts: string; message: string };
}

export async function readStatus(): Promise<WatcherStatus | null> {
  try {
    const raw = await readFile(statusPath(), 'utf8');
    return JSON.parse(raw) as WatcherStatus;
  } catch {
    return null;
  }
}

export async function writeStatus(status: WatcherStatus): Promise<void> {
  await ensureStateDir();
  await writeFile(statusPath(), JSON.stringify(status, null, 2), { mode: 0o600 });
}

export async function statusFilePresent(): Promise<boolean> {
  try {
    await access(statusPath(), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
