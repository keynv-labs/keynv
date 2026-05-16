-- Close AUDIT-FINDINGS-2 H4: ensurePendingApproval() did a SELECT then
-- INSERT without atomicity, so two concurrent reads of the same alias
-- by the same developer could both pass the existence check and both
-- insert a pending row. The partial UNIQUE index turns the second
-- insert into a NOOP at the database level, regardless of whether the
-- application code remembers to wrap the operation in a transaction.

-- Defensive: collapse any duplicates that may already exist from
-- racing reads before this index was added (keep the oldest row by
-- rowid).
DELETE FROM approvals
WHERE status = 'pending'
  AND rowid NOT IN (
    SELECT MIN(rowid) FROM approvals
    WHERE status = 'pending'
    GROUP BY project_id, alias, requester_user_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS approvals_pending_unique
  ON approvals(project_id, alias, requester_user_id)
  WHERE status = 'pending';
