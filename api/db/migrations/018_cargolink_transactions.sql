-- Migration 018: CargoLink transaction lifecycle (B-UID object model)
--
-- Core architecture: ONE shared B-UID transaction object travels a single
-- lifecycle. The four actors (customs, carrier/naviera, industrial logistics,
-- last-mile) are ROLES whose BeZhas_ID-scoped keys can only perform their own
-- state transition. Each transition fans out a signed webhook to every
-- subscriber of that B-UID (incl. the client POS). Keeps it simple: roles on
-- one object, not parallel pipelines.

-- ── Role-scoped API keys tied to a BeZhas_ID ──────────────────────────────
CREATE TABLE IF NOT EXISTS cargolink_api_keys (
    id SERIAL PRIMARY KEY,
    key_hash VARCHAR(96) UNIQUE NOT NULL,
    bezhas_id VARCHAR(50) NOT NULL,
    role VARCHAR(24) NOT NULL DEFAULT 'pos',   -- pos | customs | carrier | logistics | lastmile | admin
    label VARCHAR(120),
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_api_keys_bezhas ON cargolink_api_keys(bezhas_id);

-- ── The B-UID transaction (digital twin of the shipment/order) ────────────
CREATE TABLE IF NOT EXISTS cargolink_transactions (
    id SERIAL PRIMARY KEY,
    b_uid VARCHAR(64) UNIQUE NOT NULL,
    owner_bezhas_id VARCHAR(50) NOT NULL,        -- the registered user (POS owner)
    pos_ref VARCHAR(120),                        -- external POS order id
    status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
    origin VARCHAR(160),
    destination VARCHAR(160),
    cargo JSONB NOT NULL DEFAULT '{}'::jsonb,     -- weight, type, value, etc.
    escrow_status VARCHAR(24) NOT NULL DEFAULT 'NONE',  -- NONE | LOCKED | RELEASED
    escrow_amount_bez NUMERIC(20,4) NOT NULL DEFAULT 0,
    escrow_token VARCHAR(66),                    -- BEZ Token V1 address (settlement)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_tx_owner ON cargolink_transactions(owner_bezhas_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cargolink_tx_status ON cargolink_transactions(status);

-- ── Transition history = the audit trail of validations ───────────────────
CREATE TABLE IF NOT EXISTS cargolink_transitions (
    id SERIAL PRIMARY KEY,
    b_uid VARCHAR(64) NOT NULL,
    from_status VARCHAR(32),
    to_status VARCHAR(32) NOT NULL,
    role VARCHAR(24) NOT NULL,
    actor_bezhas_id VARCHAR(50),
    api_key_hash VARCHAR(96),
    payload_hash VARCHAR(66),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_transitions_buid ON cargolink_transitions(b_uid, created_at);

-- ── Webhook subscriptions are owned by a BeZhas_ID; secret kept to HMAC-sign ─
ALTER TABLE cargolink_webhooks ADD COLUMN IF NOT EXISTS bezhas_id VARCHAR(50);
ALTER TABLE cargolink_webhooks ADD COLUMN IF NOT EXISTS secret VARCHAR(96);  -- TODO: encrypt at rest

CREATE INDEX IF NOT EXISTS idx_cargolink_webhooks_bezhas ON cargolink_webhooks(bezhas_id);

-- ── Delivery log: proof each subscriber's platform was notified ───────────
CREATE TABLE IF NOT EXISTS cargolink_webhook_deliveries (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER,
    b_uid VARCHAR(64),
    event_name VARCHAR(80) NOT NULL,
    target_url TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'pending',  -- pending | delivered | failed
    response_code INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_deliveries_buid ON cargolink_webhook_deliveries(b_uid, created_at DESC);
