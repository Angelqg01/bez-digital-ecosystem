-- 030: Plan Starter pago por uso (usage-based billing)
--   * gateway_subscriptions gana referencia al customer/subscription de Stripe
--   * gateway_usage_ledger: registro auditable de cada llamada facturable
--     (créditos = coste real Claude+cómputo con +25% de margen; 1 crédito = 0,001 EUR)

ALTER TABLE gateway_subscriptions
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE TABLE IF NOT EXISTS gateway_usage_ledger (
    id BIGSERIAL PRIMARY KEY,
    app_id TEXT NOT NULL,
    action TEXT NOT NULL,
    credits INTEGER NOT NULL,
    billable_eur NUMERIC(12,6) NOT NULL,
    raw_cost_eur NUMERIC(12,6) NOT NULL,
    meta JSONB DEFAULT '{}'::jsonb,
    reported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_app ON gateway_usage_ledger(app_id, created_at);
