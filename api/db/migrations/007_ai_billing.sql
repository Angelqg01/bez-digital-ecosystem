-- Migration 007: AI Billing System
-- Usage tracking, invoices, payments and subscriptions for AI services

-- 1. AI usage log (one row per AI call)
CREATE TABLE IF NOT EXISTS ai_usage (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL,
    enterprise_address  VARCHAR(42) NOT NULL,
    provider            VARCHAR(50)  NOT NULL,
    model               VARCHAR(100) NOT NULL,
    input_tokens        BIGINT  NOT NULL DEFAULT 0,
    output_tokens       BIGINT  NOT NULL DEFAULT 0,
    exec_seconds        INTEGER NOT NULL DEFAULT 0,
    api_cost            DECIMAL(18,6) NOT NULL DEFAULT 0,
    commission          DECIMAL(18,6) NOT NULL DEFAULT 0,
    discount            DECIMAL(18,6) NOT NULL DEFAULT 0,
    total_cost          DECIMAL(18,6) NOT NULL DEFAULT 0,
    subscription_tier   VARCHAR(50)  NOT NULL DEFAULT 'free',
    invoice_json        JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user      ON ai_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_enterprise ON ai_usage (enterprise_address);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider   ON ai_usage (provider);

-- 2. AI invoices
CREATE TABLE IF NOT EXISTS ai_invoices (
    id                  SERIAL PRIMARY KEY,
    usage_id            INTEGER NOT NULL REFERENCES ai_usage(id),
    user_id             INTEGER NOT NULL,
    enterprise_address  VARCHAR(42) NOT NULL,
    amount_usd          DECIMAL(18,6) NOT NULL,
    amount_bez          NUMERIC(78,0) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','paid','overdue','cancelled')),
    paid_at             TIMESTAMPTZ,
    due_date            TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_invoices_user   ON ai_invoices (user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_invoices_status ON ai_invoices (status);

-- 3. AI payments (audit trail)
CREATE TABLE IF NOT EXISTS ai_payments (
    id                  SERIAL PRIMARY KEY,
    invoice_id          INTEGER NOT NULL REFERENCES ai_invoices(id),
    user_id             INTEGER NOT NULL,
    enterprise_address  VARCHAR(42) NOT NULL,
    amount_bez          NUMERIC(78,0) NOT NULL,
    tx_hash             VARCHAR(66),
    status              VARCHAR(20) NOT NULL DEFAULT 'processed',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. AI subscriptions (one active per user)
CREATE TABLE IF NOT EXISTS ai_subscriptions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL UNIQUE,
    tier        VARCHAR(50) NOT NULL DEFAULT 'free'
                    CHECK (tier IN ('free','starter','professional','enterprise')),
    start_date  TIMESTAMPTZ NOT NULL,
    end_date    TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_subs_end ON ai_subscriptions (end_date);
