CREATE TYPE payment_type AS ENUM ('token_purchase', 'vip_subscription', 'nft_purchase', 'donation', 'ad_credit');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
    session_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    wallet_address VARCHAR(42) NOT NULL,
    email VARCHAR(255),
    
    type payment_type NOT NULL,
    status payment_status DEFAULT 'pending',
    
    fiat_amount NUMERIC(10, 2) NOT NULL,
    fiat_currency VARCHAR(10) DEFAULT 'USD',
    bez_amount NUMERIC(20, 8),
    exchange_rate NUMERIC(10, 4),
    
    tx_hash VARCHAR(255),
    block_number BIGINT,
    network_chain_id INTEGER DEFAULT 80002,
    gas_used VARCHAR(255),
    
    metadata JSONB,
    distribution JSONB,
    
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMP WITH TIME ZONE,
    
    paid_at TIMESTAMP WITH TIME ZONE,
    distributed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_wallet_created ON payments(wallet_address, created_at);
CREATE INDEX idx_payments_status_created ON payments(status, created_at);
CREATE INDEX idx_payments_tx_hash ON payments(tx_hash);

-- VIP Subscriptions Table
CREATE TYPE vip_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');
CREATE TYPE vip_status AS ENUM ('active', 'cancelled', 'expired', 'pending');

CREATE TABLE IF NOT EXISTS vip_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(42) NOT NULL,
    
    tier vip_tier NOT NULL,
    status vip_status DEFAULT 'active',
    
    start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    stripe_payment_method VARCHAR(255),
    
    benefits JSONB DEFAULT '{}'::jsonb,
    savings_history JSONB DEFAULT '[]'::jsonb,
    stats JSONB DEFAULT '{ "totalSavings": 0, "totalPurchases": 0, "totalShipments": 0, "bezEarned": 0 }'::jsonb,
    billing JSONB NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    cancellation JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vip_wallet_status ON vip_subscriptions(wallet_address, status);
CREATE INDEX idx_vip_status_enddate ON vip_subscriptions(status, end_date);
CREATE INDEX idx_vip_tier_status ON vip_subscriptions(tier, status);
