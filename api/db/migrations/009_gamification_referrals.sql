-- Migration: 009_gamification_referrals.sql
-- Description: Add referral system tables for gamification.

CREATE TABLE IF NOT EXISTS referral_codes (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    code            VARCHAR(20) UNIQUE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    referred_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    rewarded_at     TIMESTAMPTZ,
    UNIQUE(referred_id)
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);

-- Achievement rules table (optional but recommended for automation)
CREATE TABLE IF NOT EXISTS achievement_rules (
    id              SERIAL PRIMARY KEY,
    key             VARCHAR(100) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    xp              INTEGER NOT NULL,
    threshold       INTEGER NOT NULL,
    metric_type     VARCHAR(50) NOT NULL, -- 'transactions', 'nfts', 'referrals', 'staking'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed some rules
INSERT INTO achievement_rules (key, name, description, xp, threshold, metric_type) VALUES
('first_tx', 'Primera Transacción', 'Registra tu primera transacción on-chain', 50, 1, 'transactions'),
('tx_100', 'Centenario', 'Alcanza 100 transacciones confirmadas', 200, 100, 'transactions'),
('first_nft', 'Primer NFT', 'Mintea tu primer NFT logístico', 100, 1, 'nfts'),
('ambassador_1', 'Embajador', 'Invita a tu primera empresa al ecosistema', 500, 1, 'referrals'),
('network_builder', 'Constructor de Red', 'Invita a 5 empresas al ecosistema', 1500, 5, 'referrals')
ON CONFLICT (key) DO NOTHING;
