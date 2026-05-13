-- Per-user onboarding checklist dismissal. Null means not dismissed.
-- Replaces the previous localStorage-only approach so dismissal persists
-- across devices and browsers.

ALTER TABLE users ADD COLUMN onboarding_dismissed_at TEXT;
