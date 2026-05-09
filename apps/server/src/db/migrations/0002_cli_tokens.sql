-- Long-lived CLI tokens. Distinct from auth_refresh_tokens (which back
-- the short-lived web/CLI session pair); CLI tokens are issued by the
-- user from /settings/account/cli-tokens and used for headless agents,
-- CI runners, scripts, etc. Authority is the same as the issuing user.

CREATE TABLE IF NOT EXISTS cli_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_used_at TEXT,
  expires_at   TEXT,
  revoked_at   TEXT
);

CREATE INDEX cli_tokens_by_user ON cli_tokens(user_id);
CREATE INDEX cli_tokens_by_hash ON cli_tokens(token_hash);
