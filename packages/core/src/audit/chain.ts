import { createHash, createHmac } from 'node:crypto';
import { type AuditEntry, type AuditInput, GENESIS_HASH } from './types.js';

/**
 * HMAC key used to prevent chain forgery. Callsites must inject this
 * via configureChainKey() before calling computeHash/appendEntry.
 * Falls back to a SHA-256 hash (no key) when no HMAC key is set, so
 * existing chains remain verifiable.
 */
let chainHmacKey: Uint8Array | null = null;

export function configureChainKey(key: Uint8Array): void {
  chainHmacKey = key;
}

/**
 * JSON-canonicalize a payload so the hash is reproducible regardless of
 * key insertion order. Sorts object keys at every level; arrays keep
 * their original order. Undefined values are normalised to null to
 * avoid JSON.stringify inconsistencies.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return value === undefined ? 'null' : JSON.stringify(value);
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
 * Computes the hash for an audit entry. When an HMAC key is configured
 * (via configureChainKey), uses HMAC-SHA-256 for key-binding; otherwise
 * falls back to plain SHA-256 for backward compatibility.
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
  if (chainHmacKey) {
    return createHmac('sha256', chainHmacKey).update(canonical, 'utf8').digest('hex');
  }
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Builds the next chain entry. The caller persists the returned object
 * verbatim (id is the auto-incremented row id from the DB).
 *
 * Pass `null` as `prev` when appending the very first entry.
 */
export function appendEntry(prev: AuditEntry | null, input: AuditInput, id: number): AuditEntry {
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

export interface VerifyOptions {
  /**
   * The expected `prev_hash` of the first entry in `entries`. Defaults
   * to GENESIS_HASH (the start of the chain). Set to the tail hash of
   * the previous page when verifying a paginated chain so the cross-
   * page boundary is checked. Without this, verifying any chain of
   * more than one page produces a false `prev_hash_mismatch`.
   */
  readonly startingPrevHash?: string;
}

/**
 * Walks an audit chain and reports the first inconsistency, if any.
 *
 * Verifies two invariants per row:
 *  1. row.prev_hash equals the predecessor's hash (or
 *     `opts.startingPrevHash` / GENESIS_HASH for the first row).
 *  2. row.hash equals the recomputed hash over (prev_hash, inputs).
 */
export function verifyChain(
  entries: readonly AuditEntry[],
  opts: VerifyOptions = {},
): VerifyResult {
  const expectedFirstPrevHash = opts.startingPrevHash ?? GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const cur = entries[i];
    if (!cur) continue;
    const expectedPrevHash = i === 0 ? expectedFirstPrevHash : entries[i - 1]?.hash;
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
