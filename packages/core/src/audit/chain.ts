import { createHash } from 'node:crypto';
import { type AuditEntry, type AuditInput, GENESIS_HASH } from './types.js';

/**
 * JSON-canonicalize a payload so the hash is reproducible regardless of
 * key insertion order. Sorts object keys at every level; arrays keep
 * their original order.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`);
  return `{${parts.join(',')}}`;
}

/**
 * Computes the SHA-256 hash for an audit entry given its inputs and the
 * predecessor's hash. Same function used by `appendEntry` and
 * `verifyChain` so they cannot disagree.
 */
export function computeHash(prevHash: string, input: AuditInput): string {
  const canonical = canonicalize({
    prev_hash: prevHash,
    ts: input.ts,
    actor_user_id: input.actor_user_id,
    actor_agent: input.actor_agent,
    event_type: input.event_type,
    payload: input.payload,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Builds the next chain entry. The caller persists the returned object
 * verbatim (id is the auto-incremented row id from the DB).
 *
 * Pass `null` as `prev` when appending the very first entry.
 */
export function appendEntry(
  prev: AuditEntry | null,
  input: AuditInput,
  id: number,
): AuditEntry {
  const prevHash = prev?.hash ?? GENESIS_HASH;
  const hash = computeHash(prevHash, input);
  return {
    id,
    prev_hash: prevHash,
    hash,
    ts: input.ts,
    actor_user_id: input.actor_user_id,
    actor_agent: input.actor_agent,
    event_type: input.event_type,
    payload: input.payload,
  };
}

export interface VerifyResult {
  readonly ok: boolean;
  /** Index (0-based, into `entries`) of the first inconsistent row. */
  readonly brokenAt?: number;
  readonly reason?: 'prev_hash_mismatch' | 'hash_mismatch';
}

/**
 * Walks an audit chain and reports the first inconsistency, if any.
 *
 * Verifies two invariants per row:
 *  1. row.prev_hash equals the predecessor's hash (or GENESIS_HASH for
 *     the first row).
 *  2. row.hash equals the recomputed hash over (prev_hash, inputs).
 */
export function verifyChain(entries: readonly AuditEntry[]): VerifyResult {
  for (let i = 0; i < entries.length; i++) {
    const cur = entries[i];
    if (!cur) continue;
    const expectedPrevHash = i === 0 ? GENESIS_HASH : entries[i - 1]?.hash;
    if (cur.prev_hash !== expectedPrevHash) {
      return { ok: false, brokenAt: i, reason: 'prev_hash_mismatch' };
    }
    const recomputed = computeHash(cur.prev_hash, cur);
    if (recomputed !== cur.hash) {
      return { ok: false, brokenAt: i, reason: 'hash_mismatch' };
    }
  }
  return { ok: true };
}
