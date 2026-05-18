import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runWatcher } from './watcher.js';

let workdir: string;
let prevStateDir: string | undefined;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'keynv-watcher-'));
  prevStateDir = process.env.KEYNV_WATCHER_STATE_DIR;
  process.env.KEYNV_WATCHER_STATE_DIR = join(workdir, 'state');
});

afterEach(async () => {
  if (prevStateDir === undefined) delete process.env.KEYNV_WATCHER_STATE_DIR;
  else process.env.KEYNV_WATCHER_STATE_DIR = prevStateDir;
  await rm(workdir, { recursive: true, force: true });
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('runWatcher', () => {
  it('scrubs a secret written to a new .jsonl file', async () => {
    const watchDir = join(workdir, 'transcripts');
    await mkdir(watchDir, { recursive: true });

    const observed = deferred<{ path: string; matchCount: number; skipped: boolean }>();
    const handle = await runWatcher({
      watchDirs: [watchDir],
      debounceMs: 50,
      skipStateFiles: true,
      usePolling: true,
      onScrub: (obs) => {
        if (!obs.skipped && obs.matchCount > 0) observed.resolve(obs);
      },
    });
    try {
      await handle.ready;

      const file = join(watchDir, 'session.jsonl');
      await writeFile(
        file,
        `${JSON.stringify({ role: 'user', content: 'curl -H "Auth: ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" api' })}\n`,
      );

      const result = await observed.promise;
      expect(result.matchCount).toBeGreaterThanOrEqual(1);

      const after = await readFile(file, 'utf8');
      expect(after).not.toContain('ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(after).toContain('<REDACTED:github-pat-classic>');
    } finally {
      await handle.stop('test-cleanup');
    }
  }, 15_000);

  it('leaves clean files untouched (no spurious rewrites)', async () => {
    const watchDir = join(workdir, 'transcripts');
    await mkdir(watchDir, { recursive: true });

    const observed = deferred<{ path: string; matchCount: number; skipped: boolean }>();
    const handle = await runWatcher({
      watchDirs: [watchDir],
      debounceMs: 50,
      skipStateFiles: true,
      usePolling: true,
      onScrub: (obs) => observed.resolve(obs),
    });
    try {
      await handle.ready;
      const file = join(watchDir, 'clean.jsonl');
      const content = `${JSON.stringify({ role: 'user', content: 'plain text' })}\n`;
      await writeFile(file, content);

      const result = await observed.promise;
      // Either matchCount === 0 (preferred) or matchCount > 0 + scrubbed
      // (entropy false positive). For a known-clean string, we expect 0.
      expect(result.matchCount).toBe(0);
      expect(result.skipped).toBe(false);
      expect(await readFile(file, 'utf8')).toBe(content);
      const snap = handle.snapshot();
      expect(snap.totalRewrites).toBe(0);
    } finally {
      await handle.stop('test-cleanup');
    }
  }, 15_000);

  it('reflects scrub count in the snapshot', async () => {
    const watchDir = join(workdir, 'transcripts');
    await mkdir(watchDir, { recursive: true });

    const handle = await runWatcher({
      watchDirs: [watchDir],
      debounceMs: 50,
      skipStateFiles: true,
      usePolling: true,
    });
    try {
      await handle.ready;
      await writeFile(join(watchDir, 'a.jsonl'), 'key=AKIAIOSFODNN7EXAMPLE\n');
      // Small gap between writes so chokidar polling treats them as
      // independent events rather than batching one into the other.
      await new Promise((r) => setTimeout(r, 600));
      await writeFile(join(watchDir, 'b.jsonl'), 'creds=postgres://u:p@host:5432/db\n');

      // Poll the snapshot until both rewrites land or we time out.
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const snap = handle.snapshot();
        if (snap.totalRewrites >= 2) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      const final = handle.snapshot();
      expect(final.totalRewrites).toBeGreaterThanOrEqual(2);
      expect(final.totalMatchesScrubbed).toBeGreaterThanOrEqual(2);
      expect(final.lastRewriteAt).not.toBeNull();
      expect(await readFile(join(watchDir, 'a.jsonl'), 'utf8')).not.toContain(
        'AKIAIOSFODNN7EXAMPLE',
      );
      expect(await readFile(join(watchDir, 'b.jsonl'), 'utf8')).not.toContain(
        'postgres://u:p@host:5432/db',
      );
    } finally {
      await handle.stop('test-cleanup');
    }
  }, 20_000);
});
