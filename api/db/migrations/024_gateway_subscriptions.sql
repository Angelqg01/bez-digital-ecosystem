-- Migration 024: gateway subscriptions + entitlements
--
-- The @bezhas/connect SDK (subscription module) calls
-- /api/gateway/v1/subscription/* but the gateway had no backing store: which
-- plan a registered app is on and which SubApps it has activated lived only in
-- the Hub backend. This table makes the gateway the source of truth for the
-- entitlements of its own API keys (app_registry), matching the SDK contract:
--   GET  /subscription            → { plan, subapps, status, renewsAt }
--   POST /subscription/activate   → adds a SubApp to the active set
--   POST /subscription/deactivate → removes it at the next cycle

CREATE TABLE IF NOT EXISTS gateway_subscriptions (
    id         SERIAL PRIMARY KEY,
    app_id     UUID        NOT NULL UNIQUE REFERENCES app_registry(id) ON DELETE CASCADE,
    plan_id    VARCHAR(40) NOT NULL DEFAULT 'starter',
    subapps    JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- activated SubApp ids (add-ons)
    status     VARCHAR(20) NOT NULL DEFAULT 'active',     -- active | past_due | canceled
    renews_at  TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gateway_subscriptions_app ON gateway_subscriptions(app_id);
