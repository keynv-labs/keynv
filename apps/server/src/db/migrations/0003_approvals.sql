-- Approval state machine. When a developer hits a production secret
-- gated by environments.require_approval, the secret read route inserts
-- a pending row here. Lead/admin/owner grants or denies it from
-- /projects/<id>/approvals; granted rows expire and the requester then
-- has to re-request.

CREATE TABLE IF NOT EXISTS approvals (
  id                 TEXT PRIMARY KEY,
  project_id         TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  alias              TEXT NOT NULL,
  requester_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status             TEXT NOT NULL CHECK (status IN ('pending', 'granted', 'denied', 'expired')),
  reason             TEXT,
  decided_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at         TEXT,
  expires_at         TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX approvals_by_project_status ON approvals(project_id, status);
CREATE INDEX approvals_by_alias_user ON approvals(alias, requester_user_id, status);
