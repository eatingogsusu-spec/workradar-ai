-- Migration 001: add authentication columns to users table
-- Run once against the opsradar2 schema.

SET search_path = opsradar2, public;

-- username: unique login identifier (separate from name/email)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users (username) WHERE username IS NOT NULL;

-- password_hash: bcrypt hash, never store plaintext
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- status: active | inactive (deleted_at covers hard-delete, status covers soft-suspend)
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';

-- Backfill: set username = email prefix for existing rows that have no username yet
UPDATE users
SET username = split_part(email, '@', 1)
WHERE username IS NULL AND email IS NOT NULL AND email <> '';
