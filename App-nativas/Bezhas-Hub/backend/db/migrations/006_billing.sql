-- 006_billing.sql
-- Migración para transacciones de facturación (Billing / Factoring)

CREATE TYPE billing_type AS ENUM ('deposit_fiat', 'deposit_bez', 'campaign_charge', 'daily_charge', 'refund', 'adjustment');
CREATE TYPE billing_currency AS ENUM ('EUR', 'BEZ');
CREATE TYPE billing_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded');
CREATE TYPE billing_payment_method AS ENUM ('stripe', 'bez-coin', 'manual', 'system');

CREATE TABLE IF NOT EXISTS billing_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID, -- Referencia a la tabla users
    wallet_address VARCHAR(42) NOT NULL,
    
    type billing_type NOT NULL,
    amount NUMERIC(15, 4) NOT NULL,
    currency billing_currency NOT NULL,
    
    status billing_status DEFAULT 'pending',
    payment_method billing_payment_method,
    
    stripe_payment_intent_id VARCHAR(255),
    blockchain_tx_hash VARCHAR(66),
    campaign_id UUID,
    
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_billing_user ON billing_transactions (user_id, created_at DESC);
CREATE INDEX idx_billing_wallet ON billing_transactions (wallet_address, created_at DESC);
CREATE INDEX idx_billing_status_type ON billing_transactions (status, type);
CREATE INDEX idx_billing_stripe_intent ON billing_transactions (stripe_payment_intent_id);
CREATE INDEX idx_billing_tx_hash ON billing_transactions (blockchain_tx_hash);
CREATE INDEX idx_billing_campaign ON billing_transactions (campaign_id);
