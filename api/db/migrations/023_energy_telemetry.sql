-- Migration 023: VPP telemetry + Aegis event persistence (Phase 3)
--
-- Until now Edge Node telemetry and Aegis anomaly events lived only in memory
-- (services/vppMqttBroker.js store + aegisAnomalyEngine ring buffer) and were
-- lost on every API restart. This persists both so the dashboard has real
-- history/analytics and the arbitrage agent can back-test on past data.
--
-- Uses a TimescaleDB hypertable when the extension is available (high-frequency
-- time-series); falls back to a plain partition-free table on vanilla Postgres.

-- ── Telemetry samples (one row per node per published reading) ──
CREATE TABLE IF NOT EXISTS telemetry_logs (
    node_id        TEXT        NOT NULL,
    ts             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type           TEXT,
    status         TEXT,
    -- Hot scalar columns for fast analytics; full metric set kept in `metrics`.
    output_kw      NUMERIC(14, 4),
    consumption_kw NUMERIC(14, 4),
    voltage_v      NUMERIC(10, 2),
    grid_frequency NUMERIC(7, 3),
    soc_pct        NUMERIC(6, 2),
    temp_c         NUMERIC(7, 2),
    energy_kwh     NUMERIC(18, 4),
    metrics        JSONB,
    seq            BIGINT,
    signed         BOOLEAN     NOT NULL DEFAULT FALSE,
    key_id         TEXT
);

CREATE INDEX IF NOT EXISTS idx_telemetry_node_ts ON telemetry_logs (node_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_ts      ON telemetry_logs (ts DESC);

-- ── Aegis anomaly / audit events ──
CREATE TABLE IF NOT EXISTS aegis_events (
    id        BIGSERIAL   PRIMARY KEY,
    ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    node_id   TEXT,
    type      TEXT        NOT NULL,   -- SPOOFING_ATTEMPT | REPLAY | SEQUENCE_GAP | IMPLAUSIBLE_VALUE | TELEMETRY_VALIDATED
    severity  TEXT        NOT NULL,   -- HIGH | WARNING | INFO
    result    TEXT        NOT NULL,   -- FAIL | PASS
    message   TEXT
);

CREATE INDEX IF NOT EXISTS idx_aegis_ts        ON aegis_events (ts DESC);
CREATE INDEX IF NOT EXISTS idx_aegis_node_type ON aegis_events (node_id, type);

-- ── Optional TimescaleDB hypertable (no-op on vanilla Postgres) ──
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
        CREATE EXTENSION IF NOT EXISTS timescaledb;
        PERFORM create_hypertable('telemetry_logs', 'ts', if_not_exists => TRUE, migrate_data => TRUE);
        -- Keep raw samples 90 days; downstream rollups/continuous aggregates can extend this.
        PERFORM add_retention_policy('telemetry_logs', INTERVAL '90 days', if_not_exists => TRUE);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'TimescaleDB setup skipped: %', SQLERRM;
END$$;
