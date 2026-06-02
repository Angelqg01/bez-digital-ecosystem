-- ═══════════════════════════════════════════════════════════
--  BeZhas Blockchain — PostgreSQL Schema
--  Database: bezhas_control
-- ═══════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────
--  USERS & AUTH
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address  VARCHAR(42) UNIQUE NOT NULL,
    username        VARCHAR(100),
    email           VARCHAR(255),
    role            VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'enterprise', 'edge_node')),
    avatar_url      TEXT,
    bezhas_id       VARCHAR(50) UNIQUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login      TIMESTAMPTZ
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_role ON users(role);

-- ─────────────────────────────────────────────────────────
--  ENTERPRISES (B2B clients)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS enterprises (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    sector          VARCHAR(50) NOT NULL,
    tier            VARCHAR(20) DEFAULT 'basic' CHECK (tier IN ('basic', 'professional', 'enterprise')),
    gas_tank_address VARCHAR(42),
    monthly_quota   NUMERIC(20, 8) DEFAULT 0,
    api_key_hash    VARCHAR(128),
    webhook_url     TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enterprises_sector ON enterprises(sector);
CREATE INDEX idx_enterprises_user ON enterprises(user_id);

-- ─────────────────────────────────────────────────────────
--  CONTRACT ADDRESSES (deployed contract registry)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contract_addresses (
    id              SERIAL PRIMARY KEY,
    chain_id        INTEGER NOT NULL,
    name            VARCHAR(100) NOT NULL,
    category        VARCHAR(50) NOT NULL,  -- 'core', 'health', 'energy', etc.
    address         VARCHAR(42) NOT NULL,
    abi_hash        VARCHAR(66),
    deployed_at     TIMESTAMPTZ DEFAULT NOW(),
    deployer        VARCHAR(42),
    UNIQUE(chain_id, name)
);

CREATE INDEX idx_contracts_chain ON contract_addresses(chain_id);
CREATE INDEX idx_contracts_category ON contract_addresses(category);

-- ─────────────────────────────────────────────────────────
--  TRANSACTIONS
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tx_hash         VARCHAR(66) UNIQUE NOT NULL,
    chain_id        INTEGER NOT NULL DEFAULT 2708,
    from_address    VARCHAR(42) NOT NULL,
    to_address      VARCHAR(42),
    value_wei       NUMERIC(78, 0) DEFAULT 0,
    gas_used        BIGINT,
    gas_price       BIGINT,
    block_number    BIGINT,
    status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'reverted')),
    contract_name   VARCHAR(100),
    method_name     VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tx_hash ON transactions(tx_hash);
CREATE INDEX idx_tx_from ON transactions(from_address);
CREATE INDEX idx_tx_to ON transactions(to_address);
CREATE INDEX idx_tx_block ON transactions(block_number);
CREATE INDEX idx_tx_status ON transactions(status);

-- ─────────────────────────────────────────────────────────
--  BLOCKCHAIN EVENTS (normalized on-chain event index)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blockchain_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id        INTEGER NOT NULL DEFAULT 2708,
    contract_name   VARCHAR(120) NOT NULL,
    event_name      VARCHAR(120) NOT NULL,
    event_type      VARCHAR(50) DEFAULT 'generic',
    tx_hash         VARCHAR(66) NOT NULL,
    block_number    BIGINT,
    log_index       INTEGER,
    actor_address   VARCHAR(42),
    event_data      JSONB NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tx_hash, log_index)
);

CREATE INDEX idx_bevents_created ON blockchain_events(created_at DESC);
CREATE INDEX idx_bevents_contract ON blockchain_events(contract_name);
CREATE INDEX idx_bevents_event ON blockchain_events(event_name);
CREATE INDEX idx_bevents_actor ON blockchain_events(actor_address);
CREATE INDEX idx_bevents_type ON blockchain_events(event_type);

-- ─────────────────────────────────────────────────────────
--  NFTs (Logistics + Sector NFTs)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nfts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id        BIGINT NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    owner_address   VARCHAR(42) NOT NULL,
    nft_type        VARCHAR(50) NOT NULL,  -- 'logistics', 'vehicle', 'land_title', etc.
    metadata_uri    TEXT,
    metadata_json   JSONB,
    minted_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(contract_address, token_id)
);

CREATE INDEX idx_nfts_owner ON nfts(owner_address);
CREATE INDEX idx_nfts_type ON nfts(nft_type);

-- ─────────────────────────────────────────────────────────
--  TELEMETRY (IoT sensor data from Edge Nodes)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS telemetry_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enterprise_id   UUID REFERENCES enterprises(id),
    edge_node       VARCHAR(42) NOT NULL,
    shipment_id     VARCHAR(100),
    temperature     REAL,
    humidity        REAL,
    gps_lat         DOUBLE PRECISION,
    gps_lng         DOUBLE PRECISION,
    weight_kg       REAL,
    anomaly_score   REAL,
    ai_verdict      VARCHAR(20) CHECK (ai_verdict IN ('approved', 'flagged', 'rejected')),
    tx_hash         VARCHAR(66),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_telemetry_enterprise ON telemetry_logs(enterprise_id);
CREATE INDEX idx_telemetry_edge ON telemetry_logs(edge_node);
CREATE INDEX idx_telemetry_shipment ON telemetry_logs(shipment_id);
CREATE INDEX idx_telemetry_created ON telemetry_logs(created_at DESC);

-- ─────────────────────────────────────────────────────────
--  GAS BALANCES (Enterprise gas tank tracking)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gas_balances (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enterprise_id   UUID REFERENCES enterprises(id) ON DELETE CASCADE,
    wallet_address  VARCHAR(42) NOT NULL,
    balance_bez     NUMERIC(30, 18) NOT NULL DEFAULT 0,
    threshold_bez   NUMERIC(30, 18) DEFAULT 1,
    last_recharge   TIMESTAMPTZ,
    auto_recharge   BOOLEAN DEFAULT TRUE,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gas_enterprise ON gas_balances(enterprise_id);

-- ─────────────────────────────────────────────────────────
--  STAKING POSITIONS
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staking_positions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    wallet_address  VARCHAR(42) NOT NULL,
    amount_staked   NUMERIC(30, 18) NOT NULL,
    rewards_earned  NUMERIC(30, 18) DEFAULT 0,
    staked_at       TIMESTAMPTZ DEFAULT NOW(),
    unstaked_at     TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_staking_user ON staking_positions(user_id);
CREATE INDEX idx_staking_active ON staking_positions(is_active);

-- ─────────────────────────────────────────────────────────
--  FARMING POSITIONS
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS farming_positions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    wallet_address  VARCHAR(42) NOT NULL,
    pool_id         INTEGER NOT NULL,
    lp_amount       NUMERIC(30, 18) NOT NULL,
    pending_rewards NUMERIC(30, 18) DEFAULT 0,
    deposited_at    TIMESTAMPTZ DEFAULT NOW(),
    withdrawn_at    TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_farming_user ON farming_positions(user_id);
CREATE INDEX idx_farming_pool ON farming_positions(pool_id);

-- ─────────────────────────────────────────────────────────
--  AI / AEGIS LOGS
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module          VARCHAR(50) NOT NULL,  -- 'anomaly_detector', 'sentiment', 'auto_healer', etc.
    action          VARCHAR(100) NOT NULL,
    severity        VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'critical')),
    input_data      JSONB,
    output_data     JSONB,
    confidence      REAL,
    processing_ms   INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_module ON ai_logs(module);
CREATE INDEX idx_ai_severity ON ai_logs(severity);
CREATE INDEX idx_ai_created ON ai_logs(created_at DESC);

-- ─────────────────────────────────────────────────────────
--  NOTIFICATIONS
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    type            VARCHAR(50) NOT NULL,  -- 'transaction', 'alert', 'system', 'reward'
    title           VARCHAR(255) NOT NULL,
    message         TEXT,
    metadata        JSONB,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_unread ON notifications(user_id, is_read) WHERE NOT is_read;

-- ─────────────────────────────────────────────────────────
--  BRIDGE TRANSFERS
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bridge_transfers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_chain_id   INTEGER NOT NULL,
    to_chain_id     INTEGER NOT NULL,
    sender          VARCHAR(42) NOT NULL,
    recipient       VARCHAR(42) NOT NULL,
    token_address   VARCHAR(42) NOT NULL,
    amount          NUMERIC(30, 18) NOT NULL,
    l1_tx_hash      VARCHAR(66),
    l2_tx_hash      VARCHAR(66),
    status          VARCHAR(20) DEFAULT 'initiated' CHECK (status IN ('initiated', 'deposited', 'relayed', 'finalized', 'failed')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    finalized_at    TIMESTAMPTZ
);

CREATE INDEX idx_bridge_sender ON bridge_transfers(sender);
CREATE INDEX idx_bridge_status ON bridge_transfers(status);

-- ─────────────────────────────────────────────────────────
--  PLATFORM ANALYTICS (aggregated daily)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_analytics (
    id              SERIAL PRIMARY KEY,
    date            DATE UNIQUE NOT NULL,
    total_transactions  INTEGER DEFAULT 0,
    total_volume_bez    NUMERIC(30, 18) DEFAULT 0,
    active_users        INTEGER DEFAULT 0,
    active_enterprises  INTEGER DEFAULT 0,
    new_nfts_minted     INTEGER DEFAULT 0,
    telemetry_events    INTEGER DEFAULT 0,
    ai_actions          INTEGER DEFAULT 0,
    avg_gas_price       BIGINT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_date ON daily_analytics(date DESC);

-- ─────────────────────────────────────────────────────────
--  MIGRATIONS TRACKING
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS migrations (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) UNIQUE NOT NULL,
    applied_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────
--  UNIFIED AI AGENT CONFIG
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_config (
    id              TEXT PRIMARY KEY DEFAULT 'default',
    config          JSONB NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
