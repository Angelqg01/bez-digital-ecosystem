-- Migration 032: CargoLink IoT v2 — unified canonical events, geofences,
-- third-party ingestion providers, disputes and telemetry merkle anchors.
--
-- Implements the "Hub de Ingestión Unificado" design (Sensores/PLAN_DESARROLLO_SENSORES_IOT.md):
--   * new sensor families: e-seals, light, barometric, BLE beacons, humidity rules
--   * canonical event columns on telemetry (event_type, data_source, tamper, geofence)
--   * edge signatures: devices may register a signer address (secp256k1)
--   * cargolink_providers: external systems (DHL, port authority, customs) push
--     HMAC-signed webhooks that normalize into the SAME canonical event
--   * cargolink_disputes: severity-matrix verdicts that hold the BEZ escrow
--   * cargolink_telemetry_anchors: merkle roots of telemetry batches anchored on-chain

-- ── Devices: edge signature support ──────────────────────────────────────────
ALTER TABLE cargolink_devices
    ADD COLUMN IF NOT EXISTS signer_address VARCHAR(42);  -- secp256k1 address; when set, payloads MUST be signed

-- type now additionally allows: eseal | light | baro | ble | humidity (enforced in service layer)

-- ── Telemetry: canonical event fields ────────────────────────────────────────
ALTER TABLE cargolink_telemetry
    ADD COLUMN IF NOT EXISTS event_type VARCHAR(48),                                   -- COLD_CHAIN_BREACH | CONTAINER_UNSEALED | LIGHT_BREACH | PRESSURE_LOSS | GEOFENCE_EXIT | SHOCK_ALERT | HUMIDITY_BREACH | READING
    ADD COLUMN IF NOT EXISTS provider VARCHAR(64) NOT NULL DEFAULT 'PROPRIETARY_DEVICE', -- data_source.provider
    ADD COLUMN IF NOT EXISTS system_id VARCHAR(128),                                   -- data_source.device_or_system_id
    ADD COLUMN IF NOT EXISTS tamper BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS geofence_verified BOOLEAN,                                -- NULL = no gps in reading / no fences configured
    ADD COLUMN IF NOT EXISTS trust_level VARCHAR(12) NOT NULL DEFAULT 'key';           -- key | signed | hmac

CREATE INDEX IF NOT EXISTS idx_cargolink_telemetry_event ON cargolink_telemetry(event_type) WHERE event_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cargolink_telemetry_tamper ON cargolink_telemetry(tamper) WHERE tamper = TRUE;

-- ── Geofences ────────────────────────────────────────────────────────────────
-- Bound to a B-UID (per-shipment) or owner-wide (b_uid NULL). Circle (center+radius)
-- or polygon (JSONB array of [lat,lng]). kind 'route_corridor' fences with
-- enforce=TRUE emit GEOFENCE_EXIT when a GPS reading falls outside ALL of them.
CREATE TABLE IF NOT EXISTS cargolink_geofences (
    id SERIAL PRIMARY KEY,
    bezhas_id VARCHAR(50) NOT NULL,
    b_uid VARCHAR(64),                            -- NULL = applies to all owner shipments
    name VARCHAR(120) NOT NULL,
    kind VARCHAR(24) NOT NULL DEFAULT 'port',     -- port | customs | warehouse | route_corridor
    center_lat NUMERIC(10,6),
    center_lng NUMERIC(10,6),
    radius_m NUMERIC(12,2),
    polygon JSONB,                                -- [[lat,lng], ...] (>= 3 vertices)
    enforce BOOLEAN NOT NULL DEFAULT FALSE,       -- TRUE (route_corridor): outside all enforced fences = GEOFENCE_EXIT
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_geofences_owner ON cargolink_geofences(bezhas_id, status);
CREATE INDEX IF NOT EXISTS idx_cargolink_geofences_buid ON cargolink_geofences(b_uid) WHERE b_uid IS NOT NULL;

-- ── Third-party ingestion providers (API-First hub) ─────────────────────────
CREATE TABLE IF NOT EXISTS cargolink_providers (
    id SERIAL PRIMARY KEY,
    provider_id VARCHAR(64) UNIQUE NOT NULL,      -- prv_xxx (public id, path segment)
    bezhas_id VARCHAR(50) NOT NULL,               -- owner who registered this integration
    name VARCHAR(120) NOT NULL,                   -- e.g. 'DHL_API', 'PORT_AUTHORITY_ALGECIRAS'
    kind VARCHAR(24) NOT NULL DEFAULT 'carrier',  -- carrier | port_authority | customs | forwarder | network_server
    secret VARCHAR(128) NOT NULL,                 -- HMAC-SHA256 shared secret (like webhook secrets)
    mapping JSONB NOT NULL DEFAULT '{}'::jsonb,   -- declarative payload -> canonical event mapping
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    last_event_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_providers_owner ON cargolink_providers(bezhas_id);

-- Replay protection for inbound webhooks: (provider, nonce) is single-use.
CREATE TABLE IF NOT EXISTS cargolink_ingest_nonces (
    id SERIAL PRIMARY KEY,
    provider_id VARCHAR(64) NOT NULL,
    nonce VARCHAR(96) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider_id, nonce)
);

-- ── Disputes (severity matrix verdicts) ─────────────────────────────────────
-- escrow_status on cargolink_transactions additionally allows: DISPUTED | REFUNDED
CREATE TABLE IF NOT EXISTS cargolink_disputes (
    id SERIAL PRIMARY KEY,
    b_uid VARCHAR(64) NOT NULL,
    severity SMALLINT NOT NULL,                   -- 0 OK | 1 MINOR | 2 MODERATE | 3 CRITICAL
    action VARCHAR(24) NOT NULL,                  -- ALERT_ONLY | HOLD_ESCROW | AUTO_CLAIM
    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    settlement JSONB,                             -- proposed BEZ movements
    status VARCHAR(16) NOT NULL DEFAULT 'open',   -- open | resolved
    resolution VARCHAR(24),                       -- release | refund | partial
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cargolink_disputes_buid ON cargolink_disputes(b_uid, status);

-- ── Telemetry merkle anchors ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cargolink_telemetry_anchors (
    id SERIAL PRIMARY KEY,
    b_uid VARCHAR(64) NOT NULL,
    merkle_root VARCHAR(66) NOT NULL,             -- 0x + 64 hex (sha256, sorted pairs)
    leaf_count INTEGER NOT NULL,
    first_reading_id INTEGER NOT NULL,
    last_reading_id INTEGER NOT NULL,
    from_ts TIMESTAMPTZ NOT NULL,
    to_ts TIMESTAMPTZ NOT NULL,
    anchored BOOLEAN NOT NULL DEFAULT FALSE,      -- TRUE once confirmed on-chain
    tx_hash VARCHAR(66),
    chain_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_anchors_buid ON cargolink_telemetry_anchors(b_uid, created_at DESC);
