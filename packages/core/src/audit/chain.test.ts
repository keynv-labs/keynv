import { describe, expect, it } from 'vitest';
import { GENESIS_HASH, appendEntry, computeHash, verifyChain } from './index.js';
import type { AuditEntry, AuditInput } from './index.js';

function input(seed: number): AuditInput {
  return {
    ts: `2026-05-09T12:00:${String(seed).padStart(2, '0')}.000Z`,
    actor_user_id: 'u_alice',
    actor_agent: 'cli-0.0.0',
    event_type: 'secret.read.allowed',
    payload: { alias: `@p.dev.k${seed}`, version: 1 },
  };
}

function buildChain(n: number): AuditEntry[] {
  const entries: AuditEntry[] = [];
  let prev: AuditEntry | null = null;
  for (let i = 0; i < n; i++) {
    const e = appendEntry(prev, input(i), i + 1);
    entries.push(e);
    prev = e;
  }
  return entries;
}

describe('computeHash', () => {
  it('is deterministic for equal inputs', () => {
    const a = computeHash(GENESIS_HASH, input(1));
    const b = computeHash(GENESIS_HASH, input(1));
    expect(a).toBe(b);
  });

  it('changes when prev_hash changes', () => {
    const a = computeHash(GENESIS_HASH, input(1));
    const b = computeHash(`${'1'.repeat(64)}`, input(1));
    expect(a).not.toBe(b);
  });

  it('is independent of payload key insertion order', () => {
    const i: AuditInput = {
      ts: '2026-05-09T12:00:00.000Z',
      actor_user_id: 'u',
      actor_agent: 'cli',
      event_type: 'secret.read.allowed',
      payload: { alias: '@p.d.k', version: 1, extra: { a: 1, b: 2 } },
    };
    const j: AuditInput = {
      ...i,
      payload: { extra: { b: 2, a: 1 }, version: 1, alias: '@p.d.k' },
    };
    expect(computeHash(GENESIS_HASH, i)).toBe(computeHash(GENESIS_HASH, j));
  });

  it('is 64 hex chars (SHA-256)', () => {
    expect(computeHash(GENESIS_HASH, input(1))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('appendEntry', () => {
  it('uses GENESIS_HASH for the first entry', () => {
    const e = appendEntry(null, input(1), 1);
    expect(e.prev_hash).toBe(GENESIS_HASH);
    expect(e.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('chains subsequent entries to the previous hash', () => {
    const a = appendEntry(null, input(1), 1);
    const b = appendEntry(a, input(2), 2);
    expect(b.prev_hash).toBe(a.hash);
  });

  it('returns identical entries for the same input + prev', () => {
    const a1 = appendEntry(null, input(1), 1);
    const a2 = appendEntry(null, input(1), 1);
    expect(a1.hash).toBe(a2.hash);
  });
});

describe('verifyChain', () => {
  it('returns ok for a valid chain', () => {
    const chain = buildChain(50);
    expect(verifyChain(chain)).toEqual({ ok: true });
  });

  it('returns ok for an empty chain', () => {
    expect(verifyChain([])).toEqual({ ok: true });
  });

  it('detects a flipped payload byte (hash mismatch)', () => {
    const chain = buildChain(10);
    const tampered = chain.map((e, i) =>
      i === 5 ? { ...e, payload: { ...e.payload, version: 999 } } : e,
    );
    const result = verifyChain(tampered);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(5);
    expect(result.reason).toBe('hash_mismatch');
  });

  it('detects a removed entry (prev_hash mismatch on the row that follows)', () => {
    const chain = buildChain(10);
    const truncated = [...chain.slice(0, 5), ...chain.slice(6)];
    const result = verifyChain(truncated);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(5);
    expect(result.reason).toBe('prev_hash_mismatch');
  });

  it('detects a re-ordered entry', () => {
    const chain = buildChain(10);
    const swapped = [...chain.slice(0, 3), chain[4]!, chain[3]!, ...chain.slice(5)];
    const result = verifyChain(swapped);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBeGreaterThanOrEqual(3);
  });

  it('detects a forged entry inserted in the middle', () => {
    const chain = buildChain(10);
    const forged: AuditEntry = {
      id: 999,
      prev_hash: chain[4]!.hash,
      hash: '0'.repeat(64),
      ...input(99),
    };
    const tampered = [...chain.slice(0, 5), forged, ...chain.slice(5)];
    const result = verifyChain(tampered);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(5);
  });

  it('handles a 1000-entry chain without false positives', () => {
    const chain = buildChain(1000);
    expect(verifyChain(chain)).toEqual({ ok: true });
  });

  it('verifies across page boundaries when startingPrevHash is threaded (regression for audit B1)', () => {
    const chain = buildChain(2500);
    const page1 = chain.slice(0, 1000);
    const page2 = chain.slice(1000, 2000);
    const page3 = chain.slice(2000);

    expect(verifyChain(page1)).toEqual({ ok: true });

    // Without startingPrevHash the second page falsely reports a
    // mismatch — exactly the bug audit B1 caught.
    expect(verifyChain(page2)).toMatchObject({ ok: false, reason: 'prev_hash_mismatch' });

    // With startingPrevHash threaded, every page boundary checks out.
    const tail1 = page1.at(-1);
    const tail2 = page2.at(-1);
    if (!tail1 || !tail2) throw new Error('expected non-empty pages');
    expect(verifyChain(page2, { startingPrevHash: tail1.hash })).toEqual({ ok: true });
    expect(verifyChain(page3, { startingPrevHash: tail2.hash })).toEqual({ ok: true });
  });

  it('flags a tampered cross-page boundary', () => {
    const chain = buildChain(2000);
    const page1 = chain.slice(0, 1000);
    const tail1 = page1.at(-1);
    if (!tail1) throw new Error('expected page1 non-empty');
    const tamperedPage2 = chain
      .slice(1000)
      .map((e, i) => (i === 0 ? { ...e, prev_hash: 'a'.repeat(64) } : e));
    const result = verifyChain(tamperedPage2, { startingPrevHash: tail1.hash });
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(0);
    expect(result.reason).toBe('prev_hash_mismatch');
  });
});
