import { randomBytes } from 'node:crypto';

const TTL_MS = 60_000;

interface Token {
  alias: string;
  expires_at: number;
  consumed: boolean;
}

const STORE = new Map<string, Token>();

/**
 * Issues a single-use reference token bound to the given alias. The
 * token expires after 60 seconds and is consumed on the first
 * successful resolution.
 *
 * The MCP contract is: tools NEVER return raw secret values. Agents
 * receive the token and must hand it to a privileged-process
 * resolver (`keynv exec --resolve <token>` is the planned wiring).
 * Phase 2 ships the issuance + expiry + single-use semantics; the
 * resolver wiring lands in Phase 5 hardening.
 */
export function issueReferenceToken(alias: string): {
  reference_token: string;
  expires_at: string;
} {
  const raw = randomBytes(24).toString('base64url');
  const reference_token = `keynv-ref:${raw}`;
  const expires_at_ms = Date.now() + TTL_MS;
  STORE.set(reference_token, { alias, expires_at: expires_at_ms, consumed: false });
  scheduleEviction(reference_token, TTL_MS);
  return { reference_token, expires_at: new Date(expires_at_ms).toISOString() };
}

/**
 * Resolves a reference token to its bound alias if and only if the
 * token is still valid AND has not been consumed. Returns null in
 * every other case. Successful resolution flips `consumed` so reuse
 * fails.
 */
export function consumeReferenceToken(token: string): string | null {
  const entry = STORE.get(token);
  if (!entry) return null;
  if (entry.consumed) return null;
  if (entry.expires_at <= Date.now()) {
    STORE.delete(token);
    return null;
  }
  entry.consumed = true;
  return entry.alias;
}

/** Test-only hook: clears every stored token. */
export function _resetTokenStoreForTests(): void {
  STORE.clear();
}

function scheduleEviction(token: string, ms: number): void {
  const t = setTimeout(() => STORE.delete(token), ms);
  t.unref();
}
