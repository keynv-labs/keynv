/**
 * Canonical event types emitted into the audit chain.
 *
 * Server code must use these constants — string literals risk drift.
 * Adding a new event type is a deliberate decision: extend the union
 * here, then update both the server emitter and the audit-list filter.
 */
export type AuditEventType =
  | 'auth.login.allowed'
  | 'auth.login.denied'
  | 'auth.logout'
  | 'auth.refresh'
  | 'user.invited'
  | 'user.removed'
  | 'user.role_changed'
  | 'project.created'
  | 'project.deleted'
  | 'project.dek_rotated'
  | 'member.added'
  | 'member.removed'
  | 'member.role_changed'
  | 'secret.created'
  | 'secret.read.allowed'
  | 'secret.read.denied'
  | 'secret.rotated'
  | 'secret.deleted'
  | 'secret.test.invoked'
  | 'approval.requested'
  | 'approval.granted'
  | 'approval.denied'
  | 'kek.rotated';

/**
 * The pieces of an audit entry that are *input*. The server fills in
 * the chain bookkeeping (id, prev_hash, hash) using `appendEntry`.
 */
export interface AuditInput {
  readonly ts: string;
  readonly actor_user_id: string | null;
  readonly actor_agent: string;
  readonly event_type: AuditEventType;
  /** JSON-serializable payload. Must NEVER contain a secret value. */
  readonly payload: Record<string, unknown>;
}

/**
 * A persisted audit row.
 */
export interface AuditEntry extends AuditInput {
  readonly id: number;
  readonly prev_hash: string;
  readonly hash: string;
}

/**
 * The all-zeros 32-byte hex hash used as `prev_hash` of the first
 * entry. Matches the convention documented in 05-encryption-design.md.
 */
export const GENESIS_HASH = '0'.repeat(64);
