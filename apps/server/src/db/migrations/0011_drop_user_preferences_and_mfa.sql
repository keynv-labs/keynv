-- Remove dead surface.
--
-- user_preferences backed a notification-settings page whose toggles were
-- never wired to any delivery mechanism (no email/push was ever sent), so
-- the whole table was inert. mfa_enrolled was a placeholder column with no
-- MFA implementation anywhere in the codebase. Drop both.
DROP TABLE IF EXISTS user_preferences;
ALTER TABLE users DROP COLUMN mfa_enrolled;
