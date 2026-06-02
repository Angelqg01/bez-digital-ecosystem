-- Migration 006: Payment Transactions
-- Supports BEZ purchases and BezPay transfers

CREATE TABLE IF NOT EXISTS payment_transactions (
    id              SERIAL PRIMARY KEY,
    wallet_address  VARCHAR(42) NOT NULL,
    recipient       VARCHAR(255),
    amount_usd      DECIMAL(18,2),
    amount_bez      DECIMAL(36,18),
    payment_method  VARCHAR(20),
    type            VARCHAR(20) NOT NULL CHECK (type IN ('buy', 'payment')),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    note            TEXT,
    tx_hash         VARCHAR(66),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_wallet ON payment_transactions (wallet_address);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status ON payment_transactions (status);
CREATE INDEX IF NOT EXISTS idx_payment_tx_type   ON payment_transactions (type);

-- Token price cache (updated by oracle/cron)
CREATE TABLE IF NOT EXISTS token_price_cache (
    symbol      VARCHAR(10) PRIMARY KEY,
    price_usd   DECIMAL(18,8) NOT NULL,
    change_24h  DECIMAL(8,4) DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial BEZ price
INSERT INTO token_price_cache (symbol, price_usd, change_24h)
VALUES ('BEZ', 0.10, 0)
ON CONFLICT (symbol) DO NOTHING;
