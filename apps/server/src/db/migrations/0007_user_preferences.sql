-- Phase 4: user notification preferences. Stores per-user toggle settings
-- for in-app and email notifications. The notification *sending* layer
-- (email, webhook) is built on top of this in a later phase; the UI toggles
-- persist regardless of whether a transport is configured.
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  approval_requests    INTEGER NOT NULL DEFAULT 1,
  secret_changes       INTEGER NOT NULL DEFAULT 1,
  member_changes       INTEGER NOT NULL DEFAULT 1,
  activity_digest      TEXT NOT NULL DEFAULT 'daily' CHECK (activity_digest IN ('daily', 'weekly', 'never')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
