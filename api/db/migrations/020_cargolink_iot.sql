-- Migration 020: CargoLink IoT / hardware ingestion
--
-- Devices (GPS trackers, temp/humidity loggers, shock sensors, RFID readers)
-- register under a BeZhas_ID, optionally bound to a B-UID shipment. They push
-- telemetry which is stored, rule-checked (e.g. cold-chain breach), and on a
-- breach fans out a signed webhook to the B-UID's subscribers — same mechanism
-- as the lifecycle. Hardware is just another validated data source on the B-UID.

CREATE TABLE IF NOT EXISTS cargolink_devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(64) UNIQUE NOT NULL,
    key_hash VARCHAR(96) UNIQUE NOT NULL,
    bezhas_id VARCHAR(50) NOT NULL,
    type VARCHAR(24) NOT NULL DEFAULT 'multi',   -- gps | temp | shock | rfid | multi
    b_uid VARCHAR(64),                            -- shipment this device is attached to
    config JSONB NOT NULL DEFAULT '{}'::jsonb,    -- thresholds: tempMin, tempMax, shockMax
    label VARCHAR(120),
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_devices_bezhas ON cargolink_devices(bezhas_id);
CREATE INDEX IF NOT EXISTS idx_cargolink_devices_buid ON cargolink_devices(b_uid);

CREATE TABLE IF NOT EXISTS cargolink_telemetry (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL,
    bezhas_id VARCHAR(50) NOT NULL,
    b_uid VARCHAR(64),
    metric VARCHAR(32) NOT NULL,                  -- temperature | humidity | shock | rfid | gps
    value NUMERIC(20,4),
    unit VARCHAR(16),
    lat NUMERIC(10,6),
    lng NUMERIC(10,6),
    breach BOOLEAN NOT NULL DEFAULT FALSE,
    reason TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_telemetry_buid ON cargolink_telemetry(b_uid, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_cargolink_telemetry_device ON cargolink_telemetry(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_cargolink_telemetry_breach ON cargolink_telemetry(breach) WHERE breach = TRUE;
