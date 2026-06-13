import { setTimeout as wait } from 'node:timers/promises';
import { Command, Option } from 'clipanion';
import { handleExecError } from '../ui/format.js';
import {
  type WatcherStatus,
  isProcessAlive,
  pidPath,
  readPidfile,
  readStatus,
  removePidfile,
  statusPath,
} from '../watcher/state.js';
import { describeDefaultWatchDirs, runWatcher } from '../watcher/watcher.js';

/**
 * `keynv watch start` — run the watcher in the foreground. Subscribes
 * to Claude Code transcript JSONL + Cursor logs, scrubs matched
 * secret-shaped substrings on file change with a 1s debounce.
 *
 * Foreground only for now. For background use, prefix with `nohup` or
 * append `&`; a managed launchd/systemd unit installer may land in a
 * later iteration.
 */
export class WatchStartCommand extends Command {
  static override paths = [['watch', 'start']];
  static override usage = Command.Usage({
    description: 'Run the keynv text-surface watcher in the foreground.',
    details: `
Subscribes to Claude Code transcripts (~/.claude/projects) and
Cursor logs (~/Library/Application Support/Cursor/logs on macOS or
~/.config/Cursor/logs on Linux) and scrubs secret-shaped substrings
on each file change with a 1-second debounce.

Backups are *not* written on every event (the 1Hz cadence would
clutter the directory). Use \`keynv scrub\` for the retro path with
backups. The watcher's lifecycle and per-event audit lands in
~/.local/share/keynv/watcher.log.
`,
    examples: [
      ['Foreground (Ctrl-C to stop)', '$0 watch start'],
      ['Verbose path listing on startup', '$0 watch start --debug'],
      ['Background via nohup', 'nohup $0 watch start &'],
    ],
  });

  debug = Option.Boolean('--debug', false);
  usePolling = Option.Boolean('--use-polling', false);

  async execute(): Promise<number> {
    try {
      const existing = await readPidfile();
      if (existing && isProcessAlive(existing)) {
        this.context.stderr.write(
          `keynv: watcher already running (pid ${existing}). Stop it first with \`keynv watch stop\`.\n`,
        );
        return 1;
      }
      if (existing && !isProcessAlive(existing)) {
        // Stale pidfile — clean it up so we can start.
        await removePidfile();
      }

      if (this.debug) {
        this.context.stdout.write('keynv watch — watching:\n');
        for (const d of describeDefaultWatchDirs()) {
          this.context.stdout.write(`  ${d}\n`);
        }
        this.context.stdout.write('\n');
      }

      const onScrub = this.debug
        ? (obs: { path: string; matchCount: number; skipped: boolean; skipReason?: string }) => {
            if (obs.matchCount > 0) {
              this.context.stdout.write(`  scrubbed ${obs.matchCount} in ${obs.path}\n`);
            } else if (obs.skipped && !obs.skipReason?.startsWith('actively-written')) {
              this.context.stdout.write(`  skipped ${obs.path} (${obs.skipReason ?? 'unknown'})\n`);
            }
          }
        : null;
      const handle = await runWatcher({
        ...(this.usePolling ? { usePolling: true } : {}),
        ...(onScrub ? { onScrub } : {}),
      });

      await handle.ready;
      this.context.stdout.write(`keynv watch — ready (pid ${process.pid}). Ctrl-C to stop.\n`);

      const exitOnSignal = (signal: NodeJS.Signals): void => {
        // chokidar's polling-mode teardown can take seconds on big trees
        // (hundreds of watched files). Cap graceful cleanup at 8s, then
        // force exit — orphaning the watcher process is much worse than
        // skipping a few cleanup steps.
        const hardExitTimer = setTimeout(() => {
          this.context.stderr.write(
            `keynv watch — graceful stop timed out; forcing exit on ${signal}\n`,
          );
          process.exit(signal === 'SIGINT' ? 130 : 1);
        }, 8_000);
        // Do not unref — the watcher still has handles open (chokidar
        // poller + status interval), and unref would let the process
        // exit without firing the timer if those teardowns somehow
        // unwound first.
        void handle.stop(signal).then(() => {
          clearTimeout(hardExitTimer);
          this.context.stdout.write(`keynv watch — stopped on ${signal}\n`);
          process.exit(signal === 'SIGINT' ? 130 : 0);
        });
      };
      process.on('SIGINT', exitOnSignal);
      process.on('SIGTERM', exitOnSignal);

      // Block forever; the signal handlers exit.
      return await new Promise<number>(() => {
        /* never resolves; signal handler calls process.exit */
      });
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}

export class WatchStopCommand extends Command {
  static override paths = [['watch', 'stop']];
  static override usage = Command.Usage({
    description: 'Stop the running keynv watcher (sends SIGTERM via pidfile).',
  });

  timeout = Option.String('--timeout', '15');

  async execute(): Promise<number> {
    try {
      const pid = await readPidfile();
      if (!pid) {
        this.context.stdout.write('keynv watch: not running (no pidfile).\n');
        return 0;
      }
      if (!isProcessAlive(pid)) {
        this.context.stdout.write(
          `keynv watch: stale pidfile (pid ${pid} not alive); cleaning up.\n`,
        );
        await removePidfile();
        return 0;
      }
      const deadlineMs = Number.parseInt(this.timeout, 10) * 1000;
      try {
        process.kill(pid, 'SIGTERM');
      } catch (err) {
        this.context.stderr.write(`keynv: kill ${pid}: ${(err as Error).message}\n`);
        return 1;
      }
      const start = Date.now();
      while (Date.now() - start < deadlineMs) {
        if (!isProcessAlive(pid)) {
          this.context.stdout.write(`keynv watch: stopped (pid ${pid}).\n`);
          await removePidfile();
          return 0;
        }
        await wait(200);
      }
      // SIGTERM didn't take. Escalate to SIGKILL — orphaning the
      // watcher is much worse than skipping a few cleanup steps.
      // Chokidar's polling-mode close() on big trees (~400 files) is
      // the usual culprit.
      this.context.stderr.write(
        `keynv watch: pid ${pid} did not exit within ${this.timeout}s; escalating to SIGKILL.\n`,
      );
      try {
        process.kill(pid, 'SIGKILL');
      } catch (err) {
        this.context.stderr.write(`keynv: kill -9 ${pid}: ${(err as Error).message}\n`);
        return 1;
      }
      const killStart = Date.now();
      while (Date.now() - killStart < 2_000) {
        if (!isProcessAlive(pid)) {
          this.context.stdout.write(`keynv watch: killed (pid ${pid}).\n`);
          await removePidfile();
          return 0;
        }
        await wait(100);
      }
      this.context.stderr.write(`keynv: pid ${pid} survived SIGKILL — manual cleanup needed.\n`);
      return 1;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }
}

export class WatchStatusCommand extends Command {
  static override paths = [['watch', 'status']];
  static override usage = Command.Usage({
    description: 'Show watcher state from the pidfile + status snapshot.',
  });

  json = Option.Boolean('--json', false);

  async execute(): Promise<number> {
    try {
      const pid = await readPidfile();
      const alive = pid !== null && isProcessAlive(pid);
      const status = (await readStatus()) ?? null;

      if (this.json) {
        this.context.stdout.write(
          `${JSON.stringify({ running: alive, pid, status, pidPath: pidPath(), statusPath: statusPath() }, null, 2)}\n`,
        );
        return alive ? 0 : 1;
      }

      if (!alive) {
        if (pid !== null) {
          this.context.stdout.write(`keynv watch: NOT RUNNING (stale pidfile pid ${pid}).\n`);
        } else {
          this.context.stdout.write('keynv watch: NOT RUNNING.\n');
        }
        return 1;
      }

      this.context.stdout.write(`keynv watch: RUNNING (pid ${pid}).\n`);
      if (status) {
        this.printStatus(status);
      } else {
        this.context.stdout.write('  (no status snapshot yet — flushed every 10s)\n');
      }
      return 0;
    } catch (err) {
      return handleExecError(this.context.stderr, err);
    }
  }

  private printStatus(s: WatcherStatus): void {
    const out = this.context.stdout;
    out.write(`  started:    ${s.startedAt}\n`);
    out.write(`  surfaces:   ${s.surfaces.join(', ')}\n`);
    out.write(`  files:      ${s.filesWatched}\n`);
    out.write(`  scrubs:     ${s.totalRewrites} (${s.totalMatchesScrubbed} matches)\n`);
    if (s.lastRewriteAt) out.write(`  last:       ${s.lastRewriteAt}\n`);
    if (s.lastError) {
      out.write(`  last error: ${s.lastError.message} (${s.lastError.ts})\n`);
    }
  }
}
