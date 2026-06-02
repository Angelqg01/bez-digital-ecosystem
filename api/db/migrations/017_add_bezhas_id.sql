-- Migration 017: Add BeZhas_ID
-- Adds a unique, universal BeZhas_ID to the users table for SSO.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS bezhas_id VARCHAR(50) UNIQUE;

-- Create an index to look up users by BeZhas_ID quickly
CREATE INDEX IF NOT EXISTS idx_users_bezhas_id ON users(bezhas_id);
