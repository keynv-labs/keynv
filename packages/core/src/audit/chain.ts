import { createHash, createHmac } from 'node:crypto';
import { type AuditEntry, type AuditInput, GENESIS_HASH } from './types.js';

/**
 * HMAC key that makes the chain tamper-evident: an attacker with DB write
 * access cannot recompute hashes without it. The server configures it from
 * the KEK at startup (see configureChainKey). When no key is set, hashing
 * uses a plain SHA-256 that is NOT tamper-evident — used only by tests.
 *
 * Keyed hashes carry a `v1:` prefix. Verification is STRICT and symmetric to
 * the current configuration to defeat downgrade attacks: when a key IS
 * configured every row must be a keyed (`v1:`) HMAC (a bare hash is rejected
 * as a downgrade); when NO key is configured every row must be a bare keyless
 * hash. There is intentionally no keyless fallback while a key is present, so
 * an attacker cannot strip the prefix and recompute keyless to forge a row.
 *
 * Migration note: turning the key on establishes tamper-evidence for rows
 * written from then on. A chain that contains rows written by an older
 * keyless build will not HMAC-verify under a configured key — those rows are
 * retained but reported as not verifiable.
 */
let chainHmacKey: Uint8Array | null = null;

const HMAC_PREFIX = 'v1:';

export function configureChainKey(key: Uint8Array | null): void {
  chainHmacKey = key;
}

/** True once a tamper-evident chain key has been configured. */
export function isChainKeyConfigured(): boolean {
  return chainHmacKey !== null;
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

function canonicalOf(prevHash: string, input: AuditInput): string {
  return canonicalize({
    prev_hash: prevHash,
    ts: input.ts,
    actor_user_id: input.actor_user_id,
    actor_agent: input.actor_agent,
    event_type: input.event_type,
    payload: input.payload,
  });
}

/**
 * Computes the hash for a NEW audit entry. When a chain key is configured
 * (via configureChainKey) this is an HMAC-SHA-256 tagged with the `v1:`
 * prefix; otherwise it is a plain SHA-256 (not tamper-evident, legacy/test
 * only).
 */
export function computeHash(prevHash: string, input: AuditInput): string {
  const canonical = canonicalOf(prevHash, input);
  if (chainHmacKey) {
    return HMAC_PREFIX + createHmac('sha256', chainHmacKey).update(canonical, 'utf8').digest('hex');
  }
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Recomputes a stored hash and reports whether it matches, STRICTLY in the
 * current key mode so a downgrade is impossible:
 *  - key configured  → the row MUST be a `v1:` HMAC; a bare hash is rejected.
 *  - no key configured → the row MUST be a bare keyless SHA-256; a `v1:` row
 *    cannot be verified without the key and is rejected.
 */
function hashMatches(prevHash: string, input: AuditInput, storedHash: string): boolean {
  const canonical = canonicalOf(prevHash, input);
  if (chainHmacKey) {
    if (!storedHash.startsWith(HMAC_PREFIX)) return false; // downgrade attempt
    const h = `${HMAC_PREFIX}${createHmac('sha256', chainHmacKey).update(canonical, 'utf8').digest('hex')}`;
    return h === storedHash;
  }
  if (storedHash.startsWith(HMAC_PREFIX)) return false; // keyed row, no key to verify
  return createHash('sha256').update(canonical, 'utf8').digest('hex') === storedHash;
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
    if (!hashMatches(cur.prev_hash, cur, cur.hash)) {
      return { ok: false, brokenAt: i, reason: 'hash_mismatch' };
    }
  }
  return { ok: true };
}
