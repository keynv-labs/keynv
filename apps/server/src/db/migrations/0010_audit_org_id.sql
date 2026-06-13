-- Migration: org-scope the audit log (audit finding H3).
-- GET /v1/audit must only return entries for the caller's active org. Add an
-- org_id column, index it, and backfill existing rows. Backfill is only safe
-- to apply automatically on a single-org deployment (the documented primary
-- deployment); multi-org rows are left NULL and populated going forward.
ALTER TABLE audit ADD COLUMN org_id TEXT;

CREATE INDEX IF NOT EXISTS audit_by_org ON audit (org_id);

UPDATE audit
SET org_id = (SELECT id FROM orgs ORDER BY created_at ASC LIMIT 1)
WHERE org_id IS NULL
  AND (SELECT COUNT(*) FROM orgs) = 1;
