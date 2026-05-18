import { join } from 'node:path';
import { claudeCodeProjectsDir, cursorLogsDir, rewriteFile } from '@keynv/text-surfaces';
import chokidar from 'chokidar';
import { VERSION } from '../version.js';
import { logEvent } from './audit-log.js';
import { FingerprintRegistry } from './registry.js';
import { type RpcServer, startRpcServer } from './rpc.js';
import { type WatcherStatus, removePidfile, writePidfile, writeStatus } from './state.js';

const DEFAULT_DEBOUNCE_MS = 1000;
const STATUS_FLUSH_MS = 10_000;

export interface WatcherOptions {
  /**
   * Override the directories we watch. By default the watcher
   * subscribes to Claude Code's `~/.claude/projects` tree and
   * Cursor's logs directory. Tests pass temp paths here.
   */
  readonly watchDirs?: ReadonlyArray<string>;
  /** Default 1000 (1s). */
  readonly debounceMs?: number;
  /** Disable pidfile / status writes. Used by tests + foreground demos. */
  readonly skipStateFiles?: boolean;
  /** Pass-through to chokidar — useful on filesystems where native events fail. */
  readonly usePolling?: boolean;
  /** Default: ['.jsonl', '.log']. Other extensions are ignored. */
  readonly fileExtensions?: ReadonlyArray<string>;
  /**
   * Hook fired right after each scrub completes (success OR no-op
   * OR skip). Lets tests await observable progress without polling.
   */
  readonly onScrub?: (result: ScrubObservation) => void;
}

export interface ScrubObservation {
  readonly path: string;
  readonly matchCount: number;
  readonly skipped: boolean;
  readonly skipReason?: string;
}

export interface WatcherHandle {
  /** Resolves when the watcher's initial scan is complete + ready for live events. */
  readonly ready: Promise<void>;
  /** Stops the watcher, cancels timers, removes pidfile. */
  stop(reason?: string): Promise<void>;
  /** Current in-memory counters (also flushed to disk every 10s). */
  snapshot(): WatcherStatus;
  /** The fingerprint registry — exposed for tests to assert state. */
  readonly registry: FingerprintRegistry;
}

/**
 * Spawn a long-running watcher in the *current process*. The caller
 * typically arranges signal handling (`keynv watch start`).
 *
 * Strategy:
 *   1. Subscribe to file `add` and `change` events under the configured
 *      directories (recursive by default; chokidar abstracts macOS
 *      FSEvents vs Linux inotify).
 *   2. Per-file debouncer: bursts of writes within `debounceMs` collapse
 *      to one rewrite call. This is the dominant pattern for Claude
 *      Code's streaming JSONL writers.
 *   3. Each rewrite calls `@keynv/text-surfaces`' `rewriteFile` with
 *      `includeActive: true` (we explicitly *want* live files) and
 *      `backup: false` (a 1Hz backup cadence would clutter the surface).
 *   4. Status snapshot persists to `~/.local/share/keynv/watcher.status`
 *      every `STATUS_FLUSH_MS` and on stop.
 *
 * Honest gaps:
 *   - A file appended to between our read and our rename loses those
 *     bytes. Race window is sub-100ms on typical hardware; we don't
 *     attempt fcntl locking in Phase A.
 *   - We don't currently watch shell histories (Step 3 hooks cover
 *     them preventively, except fish which is suppression-only and
 *     loses commands entirely).
 */
export async function runWatcher(options: WatcherOptions = {}): Promise<WatcherHandle> {
  const watchDirs = options.watchDirs ?? defaultWatchDirs();
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const fileExtensions = options.fileExtensions ?? ['.jsonl', '.log'];
  const startedAt = new Date().toISOString();
  const surfaceIds = surfaceIdsFor(watchDirs);

  let filesWatched = 0;
  let totalRewrites = 0;
  let totalMatchesScrubbed = 0;
  let lastRewriteAt: string | null = null;
  let lastError: { ts: string; message: string } | undefined;
  const debouncers = new Map<string, NodeJS.Timeout>();
  const registry = new FingerprintRegistry();

  // RPC server is optional — tests skip it via skipStateFiles.
  let rpcServer: RpcServer | null = null;
  if (!options.skipStateFiles) {
    try {
      rpcServer = await startRpcServer(registry);
    } catch (err) {
      // Don't fail boot if the socket can't bind — the watcher still
      // delivers value via regex matching even without resolution-event
      // registration.
      lastError = {
        ts: new Date().toISOString(),
        message: `rpc-bind-failed: ${(err as Error).message}`,
      };
    }
  }

  if (!options.skipStateFiles) {
    await writePidfile(process.pid);
    await logEvent({
      kind: 'watcher_started',
      ts: startedAt,
      pid: process.pid,
      version: VERSION,
      surfaces: surfaceIds,
    });
  }

  const matchesExt = (p: string): boolean => fileExtensions.some((ext) => p.endsWith(ext));

  const scheduleRewrite = (path: string): void => {
    if (!matchesExt(path)) return;
    const existing = debouncers.get(path);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      debouncers.delete(path);
      try {
        // Hand the live registry contents to the redactor as literals
        // so we catch resolved values even when their format doesn't
        // match any pattern-bank entry.
        const literals = registry.values();
        const result = await rewriteFile(path, {
          includeActive: true,
          backup: false,
          ...(literals.length > 0 ? { scanOptions: { literals } } : {}),
        });
        const ts = new Date().toISOString();
        if (result.skipped) {
          await logEvent({
            kind: 'scrub_skipped',
            ts,
            path,
            reason: result.skipReason ?? 'unknown',
          });
          options.onScrub?.({
            path,
            matchCount: 0,
            skipped: true,
            ...(result.skipReason !== undefined ? { skipReason: result.skipReason } : {}),
          });
          return;
        }
        if (result.matchCount > 0) {
          totalRewrites += 1;
          totalMatchesScrubbed += result.matchCount;
          lastRewriteAt = ts;
          await logEvent({
            kind: 'text_surface_scrubbed',
            ts,
            path,
            matchCount: result.matchCount,
            bytesWritten: result.bytesWritten,
          });
        }
        options.onScrub?.({
          path,
          matchCount: result.matchCount,
          skipped: false,
        });
      } catch (err) {
        const message = (err as Error).message ?? String(err);
        lastError = { ts: new Date().toISOString(), message };
        await logEvent({
          kind: 'scrub_failed',
          ts: lastError.ts,
          path,
          error: message,
        });
        options.onScrub?.({
          path,
          matchCount: 0,
          skipped: true,
          skipReason: `error: ${message}`,
        });
      }
    }, debounceMs);
    debouncers.set(path, t);
  };

  const watcher = chokidar.watch(watchDirs as string[], {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: false,
    ...(options.usePolling ? { usePolling: true, interval: 500 } : {}),
  });

  const readyPromise = new Promise<void>((resolve) => {
    watcher.once('ready', () => resolve());
  });

  watcher.on('add', (path: string) => {
    if (matchesExt(path)) filesWatched += 1;
    scheduleRewrite(path);
  });
  watcher.on('change', scheduleRewrite);
  watcher.on('unlink', (path: string) => {
    if (matchesExt(path) && filesWatched > 0) filesWatched -= 1;
    const t = debouncers.get(path);
    if (t) {
      clearTimeout(t);
      debouncers.delete(path);
    }
  });
  watcher.on('error', (err) => {
    const message = err instanceof Error ? err.message : String(err);
    lastError = { ts: new Date().toISOString(), message };
  });

  const buildSnapshot = (): WatcherStatus => ({
    pid: process.pid,
    startedAt,
    version: VERSION,
    surfaces: surfaceIds,
    filesWatched,
    totalRewrites,
    totalMatchesScrubbed,
    lastRewriteAt,
    ...(lastError !== undefined ? { lastError } : {}),
  });

  const flushTimer = options.skipStateFiles
    ? null
    : setInterval(() => {
        void writeStatus(buildSnapshot()).catch(() => {
          // best-effort
        });
      }, STATUS_FLUSH_MS);

  let stopped = false;
  const stop = async (reason = 'sigterm'): Promise<void> => {
    if (stopped) return;
    stopped = true;
    if (flushTimer) clearInterval(flushTimer);
    for (const t of debouncers.values()) clearTimeout(t);
    debouncers.clear();
    if (rpcServer) {
      try {
        await rpcServer.close();
      } catch {
        // best-effort
      }
    }
    await watcher.close();
    if (!options.skipStateFiles) {
      try {
        await writeStatus(buildSnapshot());
      } catch {
        // best-effort
      }
      await logEvent({
        kind: 'watcher_stopped',
        ts: new Date().toISOString(),
        pid: process.pid,
        reason,
      });
      await removePidfile();
    }
  };

  return {
    ready: readyPromise,
    stop,
    snapshot: buildSnapshot,
    registry,
  };
}

function defaultWatchDirs(): ReadonlyArray<string> {
  // Each path is rooted at a user-private location; chokidar handles
  // recursive subscription.
  return [claudeCodeProjectsDir(), cursorLogsDir()];
}

function surfaceIdsFor(dirs: ReadonlyArray<string>): ReadonlyArray<string> {
  const ids: string[] = [];
  for (const d of dirs) {
    if (d === claudeCodeProjectsDir()) ids.push('claude-code:transcripts');
    else if (d === cursorLogsDir()) ids.push('cursor:logs');
    else ids.push(`custom:${d}`);
  }
  return ids;
}

/** Helper for `keynv watch start --debug` to surface paths to the user. */
export function describeDefaultWatchDirs(): ReadonlyArray<string> {
  return [join(claudeCodeProjectsDir(), '**', '*.jsonl'), join(cursorLogsDir(), '**', '*.log')];
}
