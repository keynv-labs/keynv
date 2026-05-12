-- Short-lived browser authorization handshakes started by the CLI.
-- Raw device/user codes are never persisted; only SHA-256 hashes live here.

CREATE TABLE IF NOT EXISTS cli_auth_flows (
  device_code_hash TEXT PRIMARY KEY,
  user_code_hash   TEXT NOT NULL UNIQUE,
  user_id          TEXT REFERENCES users(id) ON DELETE CASCADE,
  device_name      TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at       TEXT NOT NULL,
  authorized_at    TEXT,
  consumed_at      TEXT
);

CREATE INDEX cli_auth_flows_by_user_code ON cli_auth_flows(user_code_hash);
CREATE INDEX cli_auth_flows_by_expires_at ON cli_auth_flows(expires_at);
