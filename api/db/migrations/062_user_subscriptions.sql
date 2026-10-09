-- Migration 062: plan contratado por USUARIO (compras desde el chat). El plan del Gateway sigue siendo
-- por api-key (gateway_subscriptions); aquí no hay vínculo usuario↔app, así que son tablas distintas.
CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    plan_id                 VARCHAR(40)  NOT NULL,
    billing                 VARCHAR(10)  NOT NULL DEFAULT 'monthly',
    status                  VARCHAR(20)  NOT NULL DEFAULT 'active',
    renews_at               TIMESTAMPTZ,
    stripe_customer_id      TEXT,
    stripe_subscription_id  TEXT UNIQUE,
    last_event_id           TEXT,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_subs_stripe_sub ON user_subscriptions (stripe_subscription_id);
