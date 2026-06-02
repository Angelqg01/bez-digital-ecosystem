-- 004_qr_documents_channels.sql
-- Adds tables for QR codes, document validation, and multichannel communication.

-- ─────────────────────────────────────────────────────────
--  QR CODES (Payments, Tracking, Validation, Custom)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qr_codes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(64) UNIQUE NOT NULL,
    type            VARCHAR(30) NOT NULL CHECK (type IN ('payment', 'tracking', 'validation', 'identity', 'custom')),
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked')),
    owner_address   VARCHAR(42) NOT NULL,
    enterprise_id   UUID REFERENCES enterprises(id) ON DELETE SET NULL,

    -- Payload (what the QR encodes)
    payload         JSONB NOT NULL,

    -- Payment-specific
    amount_bez      NUMERIC(30, 18),
    recipient       VARCHAR(42),

    -- Tracking-specific  
    shipment_id     VARCHAR(100),
    nft_token_id    BIGINT,

    -- Lifecycle
    max_scans       INTEGER DEFAULT 1,
    scan_count      INTEGER DEFAULT 0,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qr_code ON qr_codes(code);
CREATE INDEX idx_qr_owner ON qr_codes(owner_address);
CREATE INDEX idx_qr_type ON qr_codes(type);
CREATE INDEX idx_qr_status ON qr_codes(status);
CREATE INDEX idx_qr_enterprise ON qr_codes(enterprise_id);
CREATE INDEX idx_qr_shipment ON qr_codes(shipment_id);

-- QR scan log (audit trail)
CREATE TABLE IF NOT EXISTS qr_scans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qr_id           UUID REFERENCES qr_codes(id) ON DELETE CASCADE,
    scanned_by      VARCHAR(42),
    ip_address      INET,
    user_agent      TEXT,
    gps_lat         DOUBLE PRECISION,
    gps_lng         DOUBLE PRECISION,
    result          VARCHAR(20) DEFAULT 'success' CHECK (result IN ('success', 'expired', 'revoked', 'limit_reached', 'invalid')),
    metadata        JSONB,
    scanned_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qrscan_qr ON qr_scans(qr_id);
CREATE INDEX idx_qrscan_by ON qr_scans(scanned_by);
CREATE INDEX idx_qrscan_at ON qr_scans(scanned_at DESC);

-- ─────────────────────────────────────────────────────────
--  DOCUMENT VALIDATION
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_type        VARCHAR(50) NOT NULL CHECK (doc_type IN (
        'invoice', 'bill_of_lading', 'certificate_of_origin', 'customs_declaration',
        'inspection_report', 'insurance_certificate', 'packing_list', 'contract', 'other'
    )),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending', 'validating', 'approved', 'rejected', 'expired', 'revoked'
    )),
    owner_address   VARCHAR(42) NOT NULL,
    enterprise_id   UUID REFERENCES enterprises(id) ON DELETE SET NULL,

    -- File reference (IPFS or local)
    file_hash       VARCHAR(66) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_size       BIGINT,
    mime_type       VARCHAR(100),
    ipfs_cid        VARCHAR(100),
    storage_url     TEXT,

    -- Blockchain anchoring
    tx_hash         VARCHAR(66),
    block_number    BIGINT,
    chain_id        INTEGER DEFAULT 2708,

    -- Validation metadata
    validator_address VARCHAR(42),
    validated_at    TIMESTAMPTZ,
    rejection_reason TEXT,
    ai_confidence   REAL,
    ai_verdict      VARCHAR(20) CHECK (ai_verdict IN ('approved', 'flagged', 'rejected')),

    -- QR link
    qr_code_id      UUID REFERENCES qr_codes(id) ON DELETE SET NULL,

    -- Lifecycle
    expires_at      TIMESTAMPTZ,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_owner ON documents(owner_address);
CREATE INDEX idx_doc_enterprise ON documents(enterprise_id);
CREATE INDEX idx_doc_status ON documents(status);
CREATE INDEX idx_doc_type ON documents(doc_type);
CREATE INDEX idx_doc_hash ON documents(file_hash);
CREATE INDEX idx_doc_qr ON documents(qr_code_id);

-- Document signatures (multi-party signing)
CREATE TABLE IF NOT EXISTS document_signatures (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID REFERENCES documents(id) ON DELETE CASCADE,
    signer_address  VARCHAR(42) NOT NULL,
    signature       TEXT NOT NULL,
    message_hash    VARCHAR(66) NOT NULL,
    tx_hash         VARCHAR(66),
    signed_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(document_id, signer_address)
);

CREATE INDEX idx_docsig_doc ON document_signatures(document_id);
CREATE INDEX idx_docsig_signer ON document_signatures(signer_address);

-- ─────────────────────────────────────────────────────────
--  MULTICHANNEL COMMUNICATION
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS channels (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    channel_type    VARCHAR(30) NOT NULL CHECK (channel_type IN (
        'email', 'whatsapp', 'telegram', 'discord', 'slack', 'webhook', 'sms'
    )),
    channel_id      VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100),
    is_verified     BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    verification_code VARCHAR(10),
    verified_at     TIMESTAMPTZ,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, channel_type, channel_id)
);

CREATE INDEX idx_channel_user ON channels(user_id);
CREATE INDEX idx_channel_type ON channels(channel_type);

-- Message log (all outbound messages)
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id      UUID REFERENCES channels(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    direction       VARCHAR(10) DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
    channel_type    VARCHAR(30) NOT NULL,
    recipient       VARCHAR(255) NOT NULL,
    template        VARCHAR(100),
    subject         VARCHAR(255),
    body            TEXT NOT NULL,
    metadata        JSONB,
    status          VARCHAR(20) DEFAULT 'queued' CHECK (status IN (
        'queued', 'sent', 'delivered', 'read', 'failed', 'bounced'
    )),
    external_id     VARCHAR(255),
    error_message   TEXT,
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_msg_channel ON messages(channel_id);
CREATE INDEX idx_msg_user ON messages(user_id);
CREATE INDEX idx_msg_status ON messages(status);
CREATE INDEX idx_msg_type ON messages(channel_type);
CREATE INDEX idx_msg_created ON messages(created_at DESC);

-- Notification preferences (per user, per event type)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type      VARCHAR(50) NOT NULL,
    channel_types   TEXT[] NOT NULL DEFAULT '{}',
    is_enabled      BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, event_type)
);

CREATE INDEX idx_notifpref_user ON notification_preferences(user_id);
