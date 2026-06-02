CREATE TABLE IF NOT EXISTS cargolink_events (
    id SERIAL PRIMARY KEY,
    api_key_hash VARCHAR(96),
    endpoint VARCHAR(120) NOT NULL,
    method VARCHAR(12) NOT NULL,
    event_name VARCHAR(80) NOT NULL,
    payload_hash VARCHAR(66) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB NOT NULL DEFAULT '{}'::jsonb,
    billing JSONB NOT NULL DEFAULT '{}'::jsonb,
    blockchain JSONB NOT NULL DEFAULT '{}'::jsonb,
    source VARCHAR(32) NOT NULL DEFAULT 'api',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_events_endpoint_created
    ON cargolink_events(endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cargolink_events_payload_hash
    ON cargolink_events(payload_hash);

CREATE TABLE IF NOT EXISTS cargolink_webhooks (
    id SERIAL PRIMARY KEY,
    api_key_hash VARCHAR(96),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    secret_hash VARCHAR(96),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
