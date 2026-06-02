-- Migration 011: Custodial Wallet and Account Abstraction Support for Web2 Users

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT,
ADD COLUMN IF NOT EXISTS smart_account_address VARCHAR(42);

CREATE INDEX IF NOT EXISTS idx_users_smart_account ON users(smart_account_address);
