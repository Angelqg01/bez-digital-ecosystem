CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS blockchain_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER NOT NULL DEFAULT 2708,
    contract_name VARCHAR(120) NOT NULL,
    event_name VARCHAR(120) NOT NULL,
    event_type VARCHAR(50) DEFAULT 'generic',
    tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT,
    log_index INTEGER,
    actor_address VARCHAR(42),
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_bevents_created ON blockchain_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bevents_contract ON blockchain_events(contract_name);
CREATE INDEX IF NOT EXISTS idx_bevents_event ON blockchain_events(event_name);
CREATE INDEX IF NOT EXISTS idx_bevents_actor ON blockchain_events(actor_address);
CREATE INDEX IF NOT EXISTS idx_bevents_type ON blockchain_events(event_type);
