-- Migration 026: outbound payment webhooks + on-chain settlement watcher
--
-- Two Fase-2 pillars of BEZ-Pay:
--  1. Outbound webhooks: registered apps get signed payment events
--     (X-BeZhas-Signature, same HMAC format @bezhas/connect webhooks.verify
--     expects) with exponential-backoff retries and a dead-letter state.
--  2. Settlement watcher: a block scanner auto-settles pending crypto/qr buy
--     orders when the BEZ transfer to the Treasury lands on-chain; the cursor
--     table makes scans resumable and idempotent across restarts.

-- Orders remember which registered app created them so payment events are
-- delivered only to that app's webhooks (tenant isolation).
ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS app_id INTEGER REFERENCES app_registry(id) ON DELETE SET NULL;

-- ── Webhook endpoints registered per app ──
CREATE TABLE IF NOT EXISTS payment_webhooks (
    id         SERIAL PRIMARY KEY,
    app_id     INTEGER NOT NULL REFERENCES app_registry(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    secret     VARCHAR(120) NOT NULL,
    events     JSONB NOT NULL DEFAULT '["payment.settled"]'::jsonb,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, url)
);

-- ── Delivery queue (retry with backoff until delivered or dead) ──
CREATE TABLE IF NOT EXISTS payment_webhook_deliveries (
    id               SERIAL PRIMARY KEY,
    webhook_id       INTEGER NOT NULL REFERENCES payment_webhooks(id) ON DELETE CASCADE,
    event_name       VARCHAR(60) NOT NULL,
    payload          JSONB NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | delivered | dead
    attempts         INTEGER NOT NULL DEFAULT 0,
    max_attempts     INTEGER NOT NULL DEFAULT 8,
    next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_http_status INTEGER,
    last_error       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_deliveries_due
    ON payment_webhook_deliveries (status, next_attempt_at);

-- ── Settlement watcher block cursor (one row per chain) ──
CREATE TABLE IF NOT EXISTS settlement_watcher_cursor (
    chain_id   INTEGER PRIMARY KEY,
    last_block BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
