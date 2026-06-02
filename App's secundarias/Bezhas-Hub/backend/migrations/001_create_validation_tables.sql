-- =====================================================
-- CONTENT VALIDATION SYSTEM - DATABASE SCHEMA
-- PostgreSQL Migration Script
-- =====================================================

-- Table: content_validations
-- Almacena todas las validaciones de contenido en blockchain
CREATE TABLE IF NOT EXISTS content_validations (
    id SERIAL PRIMARY KEY,
    
    -- Blockchain data
    content_hash VARCHAR(66) UNIQUE NOT NULL, -- SHA-256 hash (0x + 64 chars)
    transaction_hash VARCHAR(66), -- Transaction hash on blockchain
    block_number BIGINT,
    validation_id BIGINT, -- ID from smart contract
    
    -- Content data
    content_id INTEGER, -- FK to content table (if exists)
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('post', 'reel', 'article')),
    content_uri TEXT, -- URI/link to content
    
    -- Author data
    author_address VARCHAR(42) NOT NULL, -- Ethereum address
    author_user_id INTEGER, -- FK to users table (if exists)
    
    -- Payment data
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('BezCoin', 'NativeCurrency', 'FiatDelegated')),
    payment_session_id VARCHAR(255), -- Stripe session ID (for FIAT)
    payment_amount INTEGER, -- Amount in cents (for FIAT)
    payment_currency VARCHAR(3), -- EUR, USD, etc.
    
    -- Status
    is_validated BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true, -- false if revoked
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'confirmed', 'failed', 'revoked')),
    
    -- Revocation data (if applicable)
    revoked_by VARCHAR(42), -- Address who revoked
    revocation_reason TEXT,
    revoked_at TIMESTAMP,
    revocation_tx_hash VARCHAR(66),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    confirmed_at TIMESTAMP, -- When blockchain tx confirmed
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT fk_author_user FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_content FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE SET NULL
);

-- Indexes para performance
CREATE INDEX idx_content_hash ON content_validations(content_hash);
CREATE INDEX idx_author_address ON content_validations(author_address);
CREATE INDEX idx_transaction_hash ON content_validations(transaction_hash);
CREATE INDEX idx_validation_id ON content_validations(validation_id);
CREATE INDEX idx_payment_session_id ON content_validations(payment_session_id);
CREATE INDEX idx_is_validated ON content_validations(is_validated);
CREATE INDEX idx_created_at ON content_validations(created_at DESC);
CREATE INDEX idx_author_validated ON content_validations(author_address, is_validated);

-- =====================================================

-- Table: pending_validations
-- Almacena validaciones pendientes (pago FIAT en proceso)
CREATE TABLE IF NOT EXISTS pending_validations (
    id SERIAL PRIMARY KEY,
    
    -- Stripe data
    stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    
    -- Content data
    content_hash VARCHAR(66) NOT NULL,
    content_type VARCHAR(20) NOT NULL,
    content_data JSONB, -- Preview of content
    
    -- Author data
    author_address VARCHAR(42) NOT NULL,
    author_email VARCHAR(255),
    
    -- Payment data
    amount INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    
    -- Metadata
    metadata JSONB, -- Additional data
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP, -- Stripe session expiration
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_stripe_session_id ON pending_validations(stripe_session_id);
CREATE INDEX idx_pending_content_hash ON pending_validations(content_hash);
CREATE INDEX idx_pending_author ON pending_validations(author_address);
CREATE INDEX idx_pending_status ON pending_validations(status);
CREATE INDEX idx_expires_at ON pending_validations(expires_at);

-- =====================================================

-- Table: validation_events
-- Log de todos los eventos de blockchain relacionados con validaciones
CREATE TABLE IF NOT EXISTS validation_events (
    id SERIAL PRIMARY KEY,
    
    -- Event data
    event_type VARCHAR(50) NOT NULL, -- ContentValidated, ValidationRevoked, etc.
    event_name VARCHAR(100) NOT NULL,
    
    -- Blockchain data
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    log_index INTEGER,
    
    -- Associated validation
    content_hash VARCHAR(66),
    validation_id BIGINT,
    
    -- Event-specific data
    event_data JSONB NOT NULL, -- Raw event data
    
    -- Processing
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    error_message TEXT,
    
    -- Timestamps
    block_timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_event_tx_hash ON validation_events(transaction_hash);
CREATE INDEX idx_event_content_hash ON validation_events(content_hash);
CREATE INDEX idx_event_type ON validation_events(event_type);
CREATE INDEX idx_event_processed ON validation_events(processed);
CREATE INDEX idx_event_block_number ON validation_events(block_number DESC);

-- =====================================================

-- Table: validation_stats
-- Estadísticas agregadas de validaciones
CREATE TABLE IF NOT EXISTS validation_stats (
    id SERIAL PRIMARY KEY,
    
    -- Time period
    stat_date DATE UNIQUE NOT NULL,
    
    -- Counts
    total_validations INTEGER DEFAULT 0,
    validations_bezcoin INTEGER DEFAULT 0,
    validations_native INTEGER DEFAULT 0,
    validations_fiat INTEGER DEFAULT 0,
    
    -- By content type
    validations_posts INTEGER DEFAULT 0,
    validations_reels INTEGER DEFAULT 0,
    validations_articles INTEGER DEFAULT 0,
    
    -- Revenue (FIAT only)
    revenue_cents INTEGER DEFAULT 0,
    revenue_currency VARCHAR(3) DEFAULT 'EUR',
    
    -- Revocations
    total_revocations INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX idx_stat_date ON validation_stats(stat_date DESC);

-- =====================================================

-- Table: validator_wallets
-- Wallets autorizados para validaciones delegadas
CREATE TABLE IF NOT EXISTS validator_wallets (
    id SERIAL PRIMARY KEY,
    
    -- Wallet data
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    wallet_name VARCHAR(100),
    
    -- Status
    is_authorized BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    
    -- Stats
    total_delegated_validations INTEGER DEFAULT 0,
    last_validation_at TIMESTAMP,
    
    -- Metadata
    added_by VARCHAR(42), -- Admin address
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deactivated_at TIMESTAMP
);

-- Index
CREATE INDEX idx_validator_address ON validator_wallets(wallet_address);
CREATE INDEX idx_validator_authorized ON validator_wallets(is_authorized, is_active);

-- =====================================================

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_validations_updated_at
    BEFORE UPDATE ON content_validations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pending_validations_updated_at
    BEFORE UPDATE ON pending_validations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_validation_stats_updated_at
    BEFORE UPDATE ON validation_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_validator_wallets_updated_at
    BEFORE UPDATE ON validator_wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================

-- Views útiles

-- Vista: validaciones activas recientes
CREATE OR REPLACE VIEW recent_validations AS
SELECT 
    cv.content_hash,
    cv.content_type,
    cv.author_address,
    cv.payment_method,
    cv.transaction_hash,
    cv.confirmed_at,
    cv.is_active
FROM content_validations cv
WHERE cv.is_validated = true
  AND cv.is_active = true
ORDER BY cv.confirmed_at DESC
LIMIT 100;

-- Vista: estadísticas del día actual
CREATE OR REPLACE VIEW today_stats AS
SELECT 
    COUNT(*) as total_today,
    COUNT(*) FILTER (WHERE payment_method = 'BezCoin') as bezcoin_today,
    COUNT(*) FILTER (WHERE payment_method = 'NativeCurrency') as native_today,
    COUNT(*) FILTER (WHERE payment_method = 'FiatDelegated') as fiat_today,
    COUNT(*) FILTER (WHERE content_type = 'post') as posts_today,
    COUNT(*) FILTER (WHERE content_type = 'reel') as reels_today,
    COUNT(*) FILTER (WHERE content_type = 'article') as articles_today
FROM content_validations
WHERE DATE(confirmed_at) = CURRENT_DATE
  AND is_validated = true;

-- Vista: top validadores
CREATE OR REPLACE VIEW top_validators AS
SELECT 
    author_address,
    COUNT(*) as total_validations,
    COUNT(*) FILTER (WHERE payment_method = 'BezCoin') as bezcoin_count,
    COUNT(*) FILTER (WHERE payment_method = 'NativeCurrency') as native_count,
    COUNT(*) FILTER (WHERE payment_method = 'FiatDelegated') as fiat_count,
    MAX(confirmed_at) as last_validation
FROM content_validations
WHERE is_validated = true
  AND is_active = true
GROUP BY author_address
ORDER BY total_validations DESC
LIMIT 100;

-- =====================================================

-- Function: obtener validación por hash
CREATE OR REPLACE FUNCTION get_validation_by_hash(hash VARCHAR(66))
RETURNS TABLE (
    content_hash VARCHAR(66),
    author_address VARCHAR(42),
    content_type VARCHAR(20),
    is_validated BOOLEAN,
    transaction_hash VARCHAR(66),
    payment_method VARCHAR(20),
    confirmed_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cv.content_hash,
        cv.author_address,
        cv.content_type,
        cv.is_validated,
        cv.transaction_hash,
        cv.payment_method,
        cv.confirmed_at
    FROM content_validations cv
    WHERE cv.content_hash = hash
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================

-- Datos iniciales (opcional)

-- Insertar wallet del backend como validador autorizado
-- INSERT INTO validator_wallets (wallet_address, wallet_name, is_authorized, notes)
-- VALUES ('0xYOUR_BACKEND_WALLET_ADDRESS', 'Backend Main Validator', true, 'Primary validator for FIAT delegated validations')
-- ON CONFLICT (wallet_address) DO NOTHING;

-- =====================================================

COMMENT ON TABLE content_validations IS 'Almacena todas las validaciones de contenido registradas en blockchain';
COMMENT ON TABLE pending_validations IS 'Validaciones pendientes de completar pago FIAT';
COMMENT ON TABLE validation_events IS 'Log de eventos de blockchain relacionados con validaciones';
COMMENT ON TABLE validation_stats IS 'Estadísticas agregadas diarias de validaciones';
COMMENT ON TABLE validator_wallets IS 'Wallets autorizados para validaciones delegadas';

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
