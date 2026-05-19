import { createHash } from 'node:crypto';

/**
 * In-memory fingerprint registry. Lives inside the watcher daemon's
 * process. Pure RAM — never persisted to disk; cleared on watcher
 * restart. Each `keynv exec` resolution event re-registers on use.
 *
 * The registry stores actual values (not just fingerprints) because the
 * redactor's `literals` option needs strings to match against. The
 * fingerprint (sha256[:8]) is the *identifier* we use in audit logs
 * so we can say "we scrubbed fp:abc12345" without storing the value
 * anywhere indexable.
 *
 * Threat model: a same-uid attacker who can read this process's memory
 * has already lost the game (they could read the agent's heap, the
 * shell's history file pre-scrub, etc.). The registry isn't broadcast
 * anywhere — only used inline during a redact() call.
 */

export type Fingerprint = string;

export interface RegisteredValue {
  readonly fingerprint: Fingerprint;
  readonly registeredAt: number; // ms epoch
}

export class FingerprintRegistry {
  private readonly store = new Map<Fingerprint, { value: string; registeredAt: number }>();

  /**
   * Register a value. Idempotent — re-registering the same value
   * refreshes its `registeredAt` but doesn't grow the map.
   *
   * Returns the fingerprint for the caller's reference.
   */
  register(value: string): Fingerprint {
    if (value.length === 0) {
      throw new Error('registry: cannot register empty value');
    }
    const fp = fingerprint(value);
    this.store.set(fp, { value, registeredAt: Date.now() });
    return fp;
  }

  has(fp: Fingerprint): boolean {
    return this.store.has(fp);
  }

  /** Snapshot of the registry — values plus their fingerprints. */
  values(): ReadonlyArray<string> {
    const out: string[] = [];
    for (const v of this.store.values()) out.push(v.value);
    return out;
  }

  /** Map-shaped snapshot for audit / status reporting. Values not included. */
  fingerprints(): ReadonlyArray<RegisteredValue> {
    const out: RegisteredValue[] = [];
    for (const [fp, v] of this.store) {
      out.push({ fingerprint: fp, registeredAt: v.registeredAt });
    }
    return out;
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Canonical fingerprint: first 8 hex chars of sha256(value). Same
 * format the redactor's M3 (init-TUI preview) audit findings used,
 * keeps audit logs comparable across primitives.
 */
export function fingerprint(value: string): Fingerprint {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}
