/**
 * Per-event-type payload schemas. The audit pipeline validates every
 * payload against the schema for its event_type before hashing — this
 * closes audit finding H2 (no schema → non-JSON values could hash
 * deterministically without round-tripping through JSON.parse).
 *
 * Every schema is `.strict()` so unknown keys are rejected at compile
 * time, not silently dropped or hashed. Adding a new event type
 * requires extending this map; the type system enforces it.
 */
import { z } from 'zod';
import type { AuditEventType } from './types.js';

const projectId = z.string().min(1);
const userId = z.string().min(1);
const alias = z.string().min(1);
const env = z.string().min(1);
const key = z.string().min(1);
const role = z.enum(['lead', 'developer', 'reader']);
const orgRole = z.enum(['owner', 'admin', 'developer', 'reader']);
const email = z.string().email();
const version = z.coerce.number().int().positive();

const empty = z.object({}).strict();
const orgId = z.string().min(1);

export const PAYLOAD_SCHEMAS = {
  'auth.register': z
    .object({
      email,
      org_id: orgId,
      org_name: z.string().min(1),
    })
    .strict(),
  'auth.login.allowed': z.object({ email }).strict(),
  'auth.login.denied': z.object({ email }).strict(),
  'auth.logout': empty,
  'auth.refresh': empty,
  'auth.password_change.allowed': empty,
  'auth.password_change.denied': empty,
  'cli_token.created': z.object({ token_id: z.string().min(1), name: z.string().min(1) }).strict(),
  'cli_token.revoked': z.object({ token_id: z.string().min(1), name: z.string().min(1) }).strict(),
  'user.invited': z.object({ target_user_id: userId, email, org_role: orgRole }).strict(),
  'user.removed': z.object({ target_user_id: userId, email }).strict(),
  'user.role_changed': z.object({ target_user_id: userId, org_role: orgRole }).strict(),
  'project.created': z
    .object({
      project_id: projectId,
      name: z.string().min(1),
      environments: z.array(z.string().min(1)),
    })
    .strict(),
  'project.deleted': z.object({ project_id: projectId, name: z.string() }).strict(),
  'project.dek_rotated': z.object({ project_id: projectId }).strict(),
  'environment.created': z
    .object({
      project_id: projectId,
      environment: z.string().min(1),
      tier: z.enum(['production', 'non-production']),
      require_approval: z.boolean(),
    })
    .strict(),
  'member.added': z.object({ project_id: projectId, target_user_id: userId, role }).strict(),
  'member.removed': z.object({ project_id: projectId, target_user_id: userId }).strict(),
  'member.role_changed': z.object({ project_id: projectId, target_user_id: userId, role }).strict(),
  'secret.created': z.object({ project_id: projectId, env, key, version }).strict(),
  'secret.read.allowed': z.object({ alias, version }).strict(),
  'secret.read.denied': z.object({ alias }).strict(),
  'secret.rotated': z
    .object({
      project_id: projectId,
      env,
      key,
      from_version: version,
      to_version: version,
    })
    .strict(),
  'secret.deleted': z.object({ project_id: projectId, env, key }).strict(),
  'secret.test.invoked': z
    .object({ alias, tester: z.string(), ok: z.boolean(), latency_ms: z.number() })
    .strict(),
  'approval.requested': z.object({ alias }).strict(),
  'approval.granted': z.object({ alias, granted_by: userId }).strict(),
  'approval.denied': z.object({ alias, denied_by: userId }).strict(),
  'org.updated': z.object({ org_id: orgId, name: z.string().min(1) }).strict(),
  'kek.rotated': empty,
} as const satisfies Record<AuditEventType, z.ZodType<Record<string, unknown>>>;

/**
 * Validates a payload for the given event type. Returns the parsed
 * (typed) value on success; throws on mismatch — invalid audit
 * payloads are programmer errors and should fail loudly so the
 * triggering route returns 500 rather than recording a malformed
 * chain entry.
 */
export function validateAuditPayload(
  eventType: AuditEventType,
  payload: unknown,
): Record<string, unknown> {
  const schema = PAYLOAD_SCHEMAS[eventType];
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(
      `audit payload validation failed for '${eventType}': ${result.error.issues
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; ')}`,
    );
  }
  return result.data as Record<string, unknown>;
}
