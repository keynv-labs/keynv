-- Phase 6: multi-org support. A user can belong to multiple orgs
-- through the org_memberships table. The primary org (users.org_id)
-- is the org the user registered under; additional orgs are tracked
-- here. When a user creates a new org, they become an owner via both
-- users.org_id (primary) AND org_memberships.
--
-- The active org is resolved at request time via the X-Keynv-Org
-- header, or falls back to users.org_id.

CREATE TABLE IF NOT EXISTS org_memberships (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'developer', 'reader')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS org_memberships_by_user ON org_memberships (user_id);
CREATE INDEX IF NOT EXISTS org_memberships_by_org ON org_memberships (org_id);
