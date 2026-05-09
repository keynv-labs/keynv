-- Phase 1 initial schema. Hand-written rather than drizzle-kit-generated
-- so we control DDL order and pragmas explicitly.

CREATE TABLE IF NOT EXISTS orgs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  org_role      TEXT NOT NULL CHECK (org_role IN ('owner', 'admin', 'developer', 'reader')),
  mfa_enrolled  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT users_email_org_unique UNIQUE (email, org_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  dek_wrapped  BLOB NOT NULL,
  dek_nonce    BLOB NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at   TEXT,
  CONSTRAINT projects_name_org_unique UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS environments (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  tier              TEXT NOT NULL DEFAULT 'non-production' CHECK (tier IN ('production', 'non-production')),
  require_approval  INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT environments_name_project_unique UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS secrets (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id  TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  ciphertext      BLOB NOT NULL,
  nonce           BLOB NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  prev_version_id TEXT,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at      TEXT,
  CONSTRAINT secrets_alias_unique UNIQUE (project_id, environment_id, key, version)
);

CREATE INDEX IF NOT EXISTS secrets_by_project_env ON secrets (project_id, environment_id);

CREATE TABLE IF NOT EXISTS memberships (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('lead', 'developer', 'reader')),
  granted_by  TEXT REFERENCES users(id),
  granted_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at  TEXT,
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS audit (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  prev_hash       TEXT NOT NULL,
  hash            TEXT NOT NULL,
  ts              TEXT NOT NULL,
  actor_user_id   TEXT,
  actor_agent     TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  payload_json    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_by_ts    ON audit (ts);
CREATE INDEX IF NOT EXISTS audit_by_event ON audit (event_type);

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash          TEXT NOT NULL,
  device_fingerprint  TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at          TEXT NOT NULL,
  revoked_at          TEXT
);

CREATE INDEX IF NOT EXISTS auth_refresh_tokens_by_user ON auth_refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS auth_refresh_tokens_by_hash ON auth_refresh_tokens (token_hash);
