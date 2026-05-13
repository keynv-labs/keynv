import { sql } from 'drizzle-orm';
import {
  blob,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';

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
    onboarding_dismissed_at: text('onboarding_dismissed_at'),
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
    alias_unique: unique('secrets_alias_unique').on(
      t.project_id,
      t.environment_id,
      t.key,
      t.version,
    ),
    by_project_env: index('secrets_by_project_env').on(t.project_id, t.environment_id),
  }),
);

/**
 * Organization memberships. A user can belong to multiple orgs.
 * The primary org (users.org_id) is the org the user registered
 * under; additional orgs are tracked here with their own role.
 */
export const org_memberships = sqliteTable(
  'org_memberships',
  {
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    org_id: text('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'admin', 'developer', 'reader'] }).notNull(),
    created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.user_id, t.org_id] }),
    by_user: index('org_memberships_by_user').on(t.user_id),
    by_org: index('org_memberships_by_org').on(t.org_id),
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
 * Approval lifecycle for production-gated reads. A developer who hits
 * an environment with `require_approval=true` causes a 'pending' row to
 * be inserted; a lead / admin / owner transitions it to 'granted'
 * (with an optional `expires_at`) or 'denied'. The next read on the
 * same alias by the same user checks for a granted-and-unexpired row
 * and bypasses the pending_approval branch.
 */
export const approvals = sqliteTable(
  'approvals',
  {
    id: text('id').primaryKey(),
    project_id: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    alias: text('alias').notNull(),
    requester_user_id: text('requester_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pending', 'granted', 'denied', 'expired'] }).notNull(),
    reason: text('reason'),
    decided_by_user_id: text('decided_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    decided_at: text('decided_at'),
    expires_at: text('expires_at'),
    created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => ({
    by_project_status: index('approvals_by_project_status').on(t.project_id, t.status),
    by_alias_user: index('approvals_by_alias_user').on(t.alias, t.requester_user_id, t.status),
  }),
);

/**
 * Long-lived CLI tokens. Distinct from auth_refresh_tokens (those back
 * short-lived web/CLI sessions). CLI tokens are user-managed via
 * /settings/account/cli-tokens and used for headless agents, CI
 * runners, and scripts. Authority equals the issuing user.
 */
export const cli_tokens = sqliteTable(
  'cli_tokens',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    token_hash: text('token_hash').notNull().unique(),
    created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    last_used_at: text('last_used_at'),
    expires_at: text('expires_at'),
    revoked_at: text('revoked_at'),
  },
  (t) => ({
    by_user: index('cli_tokens_by_user').on(t.user_id),
    by_hash: index('cli_tokens_by_hash').on(t.token_hash),
  }),
);

/**
 * Short-lived browser authorization handshakes started by the CLI.
 * Raw device/user codes are never persisted; only SHA-256 hashes live here.
 */
export const cli_auth_flows = sqliteTable(
  'cli_auth_flows',
  {
    device_code_hash: text('device_code_hash').primaryKey(),
    user_code_hash: text('user_code_hash').notNull().unique(),
    user_id: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    device_name: text('device_name'),
    created_at: text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    expires_at: text('expires_at').notNull(),
    authorized_at: text('authorized_at'),
    consumed_at: text('consumed_at'),
  },
  (t) => ({
    by_user_code: index('cli_auth_flows_by_user_code').on(t.user_code_hash),
    by_expires_at: index('cli_auth_flows_by_expires_at').on(t.expires_at),
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
