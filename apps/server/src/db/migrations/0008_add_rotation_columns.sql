-- Migration: Add rotation columns to secrets table
ALTER TABLE secrets ADD COLUMN rotation_interval_days INTEGER;
ALTER TABLE secrets ADD COLUMN rotated_at TEXT;
ALTER TABLE secrets ADD COLUMN next_rotation_at TEXT;
