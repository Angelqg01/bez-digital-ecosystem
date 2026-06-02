-- 002_blockchain_events.sql
-- Adds normalized on-chain event storage for validator/sequencer/reward analytics.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS blockchain_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER NOT NULL DEFAULT 2708,
    contract_name VARCHAR(120) NOT NULL,
    event_name VARCHAR(120) NOT NULL,
    event_type VARCHAR(50) NOT NULL DEFAULT 'generic',
    tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT,
    log_index INTEGER,
    actor_address VARCHAR(42),
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tx_hash, log_index)
);

ALTER TABLE blockchain_events
    ADD COLUMN IF NOT EXISTS chain_id INTEGER NOT NULL DEFAULT 2708,
    ADD COLUMN IF NOT EXISTS actor_address VARCHAR(42),
    ADD COLUMN IF NOT EXISTS event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_blockchain_events_type_created
    ON blockchain_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blockchain_events_contract_created
    ON blockchain_events (contract_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blockchain_events_block
    ON blockchain_events (block_number DESC);
