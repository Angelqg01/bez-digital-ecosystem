-- 005_social_and_events.sql
-- Migración para Posts (Social Networking/Governance) y IndexedEvents (Blockchain data tracker)

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    likes JSONB DEFAULT '[]'::jsonb,
    comments JSONB DEFAULT '[]'::jsonb,
    image VARCHAR(255) DEFAULT '',
    
    hidden BOOLEAN DEFAULT FALSE,
    pinned BOOLEAN DEFAULT FALSE,
    validated BOOLEAN DEFAULT FALSE,
    
    blockchain_data JSONB DEFAULT '{"txHash": null, "blockNumber": null, "network": "polygon", "validationScore": 0}'::jsonb,
    metadata JSONB DEFAULT '{"title": "", "category": "general", "tags": [], "externalLinks": []}'::jsonb,
    
    modified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_posts_author ON posts (author, created_at DESC);
CREATE INDEX idx_posts_pinned ON posts (pinned DESC, created_at DESC);
CREATE INDEX idx_posts_hidden ON posts (hidden);

-- INDEXED EVENTS (Vital para performance y puente blockchain)
CREATE TABLE IF NOT EXISTS indexed_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_name VARCHAR(100) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    
    event_name VARCHAR(100) NOT NULL,
    event_signature TEXT NOT NULL,
    
    args JSONB NOT NULL,
    decoded_args JSONB DEFAULT '{}'::jsonb,
    
    block_number BIGINT NOT NULL,
    block_hash VARCHAR(66) NOT NULL,
    block_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    transaction_index INTEGER NOT NULL,
    log_index INTEGER NOT NULL,
    
    chain_id INTEGER NOT NULL DEFAULT 137,
    network VARCHAR(50) DEFAULT 'polygon',
    
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_error TEXT,
    
    indexed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    indexer_version VARCHAR(20) DEFAULT '1.0.0',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices compuestos críticos para búsquedas de blockchain y worker sync
CREATE INDEX idx_ev_contract_block ON indexed_events (contract_name, event_name, block_number DESC);
CREATE INDEX idx_ev_user ON indexed_events ((decoded_args->>'user'), event_name, block_timestamp DESC);
CREATE INDEX idx_ev_from ON indexed_events ((decoded_args->>'from'), block_timestamp DESC);
CREATE INDEX idx_ev_to ON indexed_events ((decoded_args->>'to'), block_timestamp DESC);
CREATE INDEX idx_ev_processed ON indexed_events (contract_name, processed, block_number);
CREATE INDEX idx_ev_chain_block ON indexed_events (chain_id, block_number DESC);
