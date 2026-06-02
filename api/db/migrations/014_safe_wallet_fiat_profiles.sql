-- Migration 014: FIAT-first Safe Wallet profiles
-- Adds managed wallet metadata for users that do not want to interact with crypto.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_type VARCHAR(20) NOT NULL DEFAULT 'wallet'
        CHECK (auth_type IN ('wallet', 'fiat', 'hybrid')),
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
    ADD COLUMN IF NOT EXISTS primary_wallet_address VARCHAR(42),
    ADD COLUMN IF NOT EXISTS primary_smart_wallet_address VARCHAR(42),
    ADD COLUMN IF NOT EXISTS custody_mode VARCHAR(20) NOT NULL DEFAULT 'external'
        CHECK (custody_mode IN ('external', 'managed', 'hybrid'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
    ON users (LOWER(email))
    WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_primary_wallet ON users(primary_wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_primary_smart_wallet ON users(primary_smart_wallet_address);

CREATE TABLE IF NOT EXISTS smart_wallets (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    owner_address       VARCHAR(42) NOT NULL,
    wallet_address      VARCHAR(42) UNIQUE NOT NULL,
    guardian_address    VARCHAR(42),
    daily_limit         NUMERIC(36, 18) DEFAULT 0,
    custody_mode        VARCHAR(20) NOT NULL DEFAULT 'external'
        CHECK (custody_mode IN ('external', 'managed', 'hybrid')),
    purpose             VARCHAR(40) NOT NULL DEFAULT 'primary'
        CHECK (purpose IN ('primary', 'enterprise', 'session', 'recovery', 'legacy')),
    tx_hash             VARCHAR(66),
    chain_id            INTEGER NOT NULL DEFAULT 2708,
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('pending', 'active', 'failed', 'disabled')),
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_wallets_user ON smart_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_wallets_owner ON smart_wallets(owner_address);
CREATE INDEX IF NOT EXISTS idx_smart_wallets_purpose ON smart_wallets(purpose);

CREATE TABLE IF NOT EXISTS managed_wallet_keys (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    wallet_address      VARCHAR(42) UNIQUE NOT NULL,
    encrypted_key       TEXT NOT NULL,
    key_version         INTEGER NOT NULL DEFAULT 1,
    kms_provider        VARCHAR(40) NOT NULL DEFAULT 'local-aes-gcm',
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'rotating', 'disabled')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_managed_wallet_keys_user ON managed_wallet_keys(user_id);

ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS platform_fee_usd DECIMAL(18,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS platform_fee_bez DECIMAL(36,18) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS primary_wallet_address VARCHAR(42),
    ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(160);

CREATE INDEX IF NOT EXISTS idx_payment_tx_primary_wallet ON payment_transactions(primary_wallet_address);
