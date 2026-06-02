'use strict';

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS blockchain_events (
  id              SERIAL PRIMARY KEY,
  contract_name   VARCHAR(100) NOT NULL,
  event_name      VARCHAR(100) NOT NULL,
  tx_hash         VARCHAR(66) NOT NULL,
  block_number    BIGINT NOT NULL,
  log_index       INTEGER NOT NULL DEFAULT 0,
  actor_address   VARCHAR(42),
  event_data      JSONB DEFAULT '{}',
  indexed_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_events_contract ON blockchain_events(contract_name);
CREATE INDEX IF NOT EXISTS idx_events_block ON blockchain_events(block_number);
CREATE INDEX IF NOT EXISTS idx_events_actor ON blockchain_events(actor_address);
CREATE INDEX IF NOT EXISTS idx_events_name ON blockchain_events(event_name);

CREATE TABLE IF NOT EXISTS sync_state (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS abi_registry (
  contract_name VARCHAR(100) PRIMARY KEY,
  abi           JSONB NOT NULL,
  address       VARCHAR(42),
  chain_id      INTEGER NOT NULL DEFAULT 2708,
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_hooks (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  url             TEXT NOT NULL,
  event_type      VARCHAR(80) NOT NULL DEFAULT '*',
  secret          TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_status     INTEGER,
  last_error      TEXT,
  last_delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hooks_event_type ON integration_hooks(event_type);
CREATE INDEX IF NOT EXISTS idx_hooks_active ON integration_hooks(active);

CREATE TABLE IF NOT EXISTS tokenomics_snapshots (
  id              SERIAL PRIMARY KEY,
  chain_id         INTEGER NOT NULL,
  snapshot         JSONB NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokenomics_snapshots_chain ON tokenomics_snapshots(chain_id);
CREATE INDEX IF NOT EXISTS idx_tokenomics_snapshots_created ON tokenomics_snapshots(created_at DESC);

CREATE TABLE IF NOT EXISTS profitability_reports (
  id              SERIAL PRIMARY KEY,
  report          JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS node_operations (
  key             VARCHAR(120) PRIMARY KEY,
  value           JSONB NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
`;

async function initSchema() {
    const client = await pool.connect();
    try {
        await client.query(SCHEMA_SQL);
        console.log('[DB] Schema initialized');
    } finally {
        client.release();
    }
}

async function query(text, params) {
    return pool.query(text, params);
}

async function getPool() {
    return pool;
}

// Run migration if called directly: node lib/db.js
if (require.main === module) {
    initSchema()
        .then(() => { console.log('Migration complete'); process.exit(0); })
        .catch((err) => { console.error('Migration failed:', err); process.exit(1); });
}

module.exports = { pool, query, initSchema };
