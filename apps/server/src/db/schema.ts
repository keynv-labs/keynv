import { sql } from 'drizzle-orm';
import { blob, index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

/**
 * Organizations. A single self-hosted deployment typically holds one
 * org; multi-tenant deployments hold many.
 */
export const orgs = sqliteTable('orgs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

/**
 * Users. Auth is email + Argon2id-hashed password for Phase 1; SSO
 * adapters arrive in Phase 6.
 */
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    org_id: text('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    password_hash: text('password_hash').notNull(),
    org_role: text('org_role', { enum: ['owner', 'admin', 'developer', 'reader'] }).notNull(),
    mfa_enrolled: integer('mfa_enrolled', { mode: 'boolean' }).notNull().default(false),
    created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => ({
    email_org_unique: unique('users_email_org_unique').on(t.email, t.org_id),
  }),
);

/**
 * Projects. Each project carries its own DEK (wrapped with the master
 * KEK), so a project compromise stays scoped to that project.
 */
export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    org_id: text('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    dek_wrapped: blob('dek_wrapped', { mode: 'buffer' }).notNull(),
    dek_nonce: blob('dek_nonce', { mode: 'buffer' }).notNull(),
    created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    deleted_at: text('deleted_at'),
  },
  (t) => ({
    name_org_unique: unique('projects_name_org_unique').on(t.org_id, t.name),
  }),
);

/**
 * Environments per project (dev, staging, prod, ...). Tier flags
 * production-grade environments that may require approval workflows.
 */
export const environments = sqliteTable(
  'environments',
  {
    id: text('id').primaryKey(),
    project_id: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tier: text('tier', { enum: ['production', 'non-production'] })
      .notNull()
      .default('non-production'),
    require_approval: integer('require_approval', { mode: 'boolean' }).notNull().default(false),
    created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => ({
    name_project_unique: unique('environments_name_project_unique').on(t.project_id, t.name),
  }),
);

/**
 * Secrets. Stored as ciphertext + nonce (XSalsa20-Poly1305 via the
 * project DEK). Versioned: rotation creates a new row pointing at the
 * previous via prev_version_id.
 */
export const secrets = sqliteTable(
  'secrets',
  {
    id: text('id').primaryKey(),
    project_id: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environment_id: text('environment_id')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    ciphertext: blob('ciphertext', { mode: 'buffer' }).notNull(),
    nonce: blob('nonce', { mode: 'buffer' }).notNull(),
    version: integer('version').notNull().default(1),
    prev_version_id: text('prev_version_id'),
    created_by: text('created_by').references(() => users.id),
    created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    deleted_at: text('deleted_at'),
  },
  (t) => ({
    alias_unique: unique('secrets_alias_unique').on(t.project_id, t.environment_id, t.key, t.version),
    by_project_env: index('secrets_by_project_env').on(t.project_id, t.environment_id),
  }),
);

/**
 * Project memberships. A user can hold different project roles on
 * different projects; org owners/admins have implicit access without
 * needing a row here.
 */
export const memberships = sqliteTable(
  'memberships',
  {
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    project_id: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['lead', 'developer', 'reader'] }).notNull(),
    granted_by: text('granted_by').references(() => users.id),
    granted_at: text('granted_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    expires_at: text('expires_at'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.user_id, t.project_id] }),
  }),
);

/**
 * Append-only audit log. Hash-chained per docs/05-encryption-design.md.
 */
export const audit = sqliteTable(
  'audit',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    prev_hash: text('prev_hash').notNull(),
    hash: text('hash').notNull(),
    ts: text('ts').notNull(),
    actor_user_id: text('actor_user_id'),
    actor_agent: text('actor_agent').notNull(),
    event_type: text('event_type').notNull(),
    payload_json: text('payload_json').notNull(),
  },
  (t) => ({
    by_ts: index('audit_by_ts').on(t.ts),
    by_event: index('audit_by_event').on(t.event_type),
  }),
);

/**
 * Refresh tokens for the auth flow. Stored as the SHA-256 hash of the
 * raw token; the raw token is sent to the client only once at issue.
 */
export const auth_refresh_tokens = sqliteTable(
  'auth_refresh_tokens',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token_hash: text('token_hash').notNull(),
    device_fingerprint: text('device_fingerprint'),
    created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    expires_at: text('expires_at').notNull(),
    revoked_at: text('revoked_at'),
  },
  (t) => ({
    by_user: index('auth_refresh_tokens_by_user').on(t.user_id),
    by_hash: index('auth_refresh_tokens_by_hash').on(t.token_hash),
  }),
);
