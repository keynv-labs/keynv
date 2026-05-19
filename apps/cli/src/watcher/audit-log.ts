import { appendFile } from 'node:fs/promises';
import { ensureStateDir, logPath } from './state.js';

export type WatcherEvent =
  | {
      readonly kind: 'text_surface_scrubbed';
      readonly ts: string;
      readonly path: string;
      readonly matchCount: number;
      readonly bytesWritten: number;
    }
  | {
      readonly kind: 'watcher_started';
      readonly ts: string;
      readonly pid: number;
      readonly version: string;
      readonly surfaces: ReadonlyArray<string>;
    }
  | {
      readonly kind: 'watcher_stopped';
      readonly ts: string;
      readonly pid: number;
      readonly reason: string;
    }
  | {
      readonly kind: 'scrub_skipped';
      readonly ts: string;
      readonly path: string;
      readonly reason: string;
    }
  | {
      readonly kind: 'scrub_failed';
      readonly ts: string;
      readonly path: string;
      readonly error: string;
    };

/**
 * Append-only JSONL log. One event per line. Lives at
 * `~/.local/share/keynv/watcher.log`. No rotation in Phase A — the
 * file grows unbounded and the user is responsible for trimming.
 * (Rotation lands when we wire the watcher into the server-side
 * audit chain, Phase B+.)
 */
export async function logEvent(event: WatcherEvent): Promise<void> {
  await ensureStateDir();
  await appendFile(logPath(), `${JSON.stringify(event)}\n`, { mode: 0o600 });
}
