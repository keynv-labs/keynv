import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FingerprintRegistry } from './registry.js';
import { registerValueWithWatcher, startRpcServer } from './rpc.js';
import { runWatcher } from './watcher.js';

let workdir: string;
let prev: string | undefined;

beforeEach(async () => {
  workdir = await mkdtemp(join(tmpdir(), 'keynv-rpc-'));
  prev = process.env.KEYNV_WATCHER_SOCKET;
  process.env.KEYNV_WATCHER_SOCKET = join(workdir, 'watcher.sock');
});

afterEach(async () => {
  if (prev === undefined) delete process.env.KEYNV_WATCHER_SOCKET;
  else process.env.KEYNV_WATCHER_SOCKET = prev;
  await rm(workdir, { recursive: true, force: true });
});

describe('RPC server + client', () => {
  it('client register lands in the registry and returns the fingerprint', async () => {
    const registry = new FingerprintRegistry();
    const server = await startRpcServer(registry);
    try {
      const fp = await registerValueWithWatcher('super-secret-custom-token-9000');
      expect(fp).toMatch(/^[0-9a-f]{8}$/);
      expect(registry.size()).toBe(1);
      expect(registry.values()).toContain('super-secret-custom-token-9000');
    } finally {
      await server.close();
    }
  });

  it('client returns null when no watcher is listening (silent fail-open)', async () => {
    // No server started; socket file doesn't exist.
    const fp = await registerValueWithWatcher('nobody-home', 100);
    expect(fp).toBeNull();
  });

  it('returns null for stale socket file (ECONNREFUSED)', async () => {
    // Touch a stale socket file with no listener behind it.
    await writeFile(process.env.KEYNV_WATCHER_SOCKET!, '');
    const fp = await registerValueWithWatcher('nobody-home', 100);
    expect(fp).toBeNull();
  });
});

describe('watcher uses registry literals for custom-format secrets', () => {
  it('scrubs a non-pattern-matching custom token once registered', async () => {
    const watchDir = join(workdir, 'transcripts');
    await import('node:fs/promises').then((m) => m.mkdir(watchDir, { recursive: true }));

    // Custom token shape: 32 lowercase letters. Doesn't look like AWS,
    // GCP, GitHub, Stripe, JWT, or any pattern-bank entry. Length is
    // long enough to trigger entropy, but we'll disable entropy in
    // the scan opts via the registry literals path (literals are
    // OR'd with the existing pattern bank).
    const customToken = 'abcdefghijklmnopqrstuvwxyzabcdef';

    const handle = await runWatcher({
      watchDirs: [watchDir],
      debounceMs: 50,
      skipStateFiles: true,
      usePolling: true,
    });
    try {
      await handle.ready;

      // Without registry: the entropy detector would still catch this
      // (32 lowercase chars, ~4.0 entropy). But we want to prove the
      // registry path works. Disable entropy by feeding only the
      // literal mode. Simpler: just register and prove the literal
      // is detected even for short non-entropy-flagged values.
      const shortToken = 'opaque-foo';
      handle.registry.register(shortToken);

      await writeFile(
        join(watchDir, 'session.jsonl'),
        `${JSON.stringify({ role: 'user', content: `db pw is ${shortToken}` })}\n`,
      );

      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const snap = handle.snapshot();
        if (snap.totalRewrites >= 1) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      const after = await readFile(join(watchDir, 'session.jsonl'), 'utf8');
      expect(after).not.toContain(shortToken);
      expect(after).toContain('<REDACTED:literal-alias-resolved-value>');

      // Sanity: customToken is also catchable (just verifying nothing
      // about the test setup is rejecting longer values either).
      handle.registry.register(customToken);
      expect(handle.registry.values()).toContain(customToken);
    } finally {
      await handle.stop('test-cleanup');
    }
  }, 15_000);
});
