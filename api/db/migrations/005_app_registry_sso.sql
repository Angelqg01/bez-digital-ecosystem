-- ═══════════════════════════════════════════════════════════
--  Migration 005: App Registry + SSO Sessions
--  Supports cross-app authentication for the BeZhas ecosystem
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
--  APP REGISTRY (registered ecosystem apps)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_registry (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_name        VARCHAR(100) UNIQUE NOT NULL,
    api_key_hash    VARCHAR(128) UNIQUE NOT NULL,
    scopes          TEXT[] NOT NULL DEFAULT '{}',
    tier            VARCHAR(20) DEFAULT 'standard' CHECK (tier IN ('free', 'standard', 'premium', 'internal')),
    rate_limit      INTEGER DEFAULT 1000,       -- requests per minute
    allowed_origins TEXT[] DEFAULT '{}',         -- CORS origins for this app
    webhook_url     TEXT,                        -- callback URL for events
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_registry_name ON app_registry(app_name);
CREATE INDEX IF NOT EXISTS idx_app_registry_key ON app_registry(api_key_hash);

-- ─────────────────────────────────────────────────────────
--  SSO SESSIONS (cross-app user sessions)
-- ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sso_sessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_origin          VARCHAR(50) NOT NULL,    -- 'core', 'defi', 'app', 'web3'
    refresh_token_hash  VARCHAR(128) NOT NULL,
    is_revoked          BOOLEAN DEFAULT FALSE,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sso_user ON sso_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sso_token ON sso_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_sso_active ON sso_sessions(user_id, is_revoked) WHERE NOT is_revoked;

-- ─────────────────────────────────────────────────────────
--  SEED: Register default ecosystem apps
-- ─────────────────────────────────────────────────────────

-- Core (internal — full access)
INSERT INTO app_registry (app_name, api_key_hash, scopes, tier, allowed_origins) VALUES
    ('bezhas-core', encode(digest('core-internal-key', 'sha256'), 'hex'),
     ARRAY['admin'], 'internal', ARRAY['http://localhost:3000', 'https://bezhas.com']),
    ('bezhas-defi', encode(digest('defi-dev-key', 'sha256'), 'hex'),
     ARRAY['staking', 'farming', 'governance', 'bridge', 'treasury', 'wallet', 'token', 'contracts'],
     'premium', ARRAY['http://localhost:5174', 'https://defi.bezhas.com']),
    ('bezhas-app', encode(digest('app-dev-key', 'sha256'), 'hex'),
     ARRAY['auth', 'wallet', 'token', 'marketplace', 'social', 'notifications'],
     'premium', ARRAY['http://localhost:5173', 'https://app.bezhas.com']),
    ('bezhas-web3', encode(digest('web3-dev-key', 'sha256'), 'hex'),
     ARRAY['auth', 'wallet', 'token', 'contracts', 'staking', 'bridge', 'marketplace', 'notifications'],
     'premium', ARRAY['http://localhost:5175', 'https://web3.bezhas.com'])
ON CONFLICT (app_name) DO NOTHING;

-- Cleanup expired sessions (run via cron or pg_cron)
-- DELETE FROM sso_sessions WHERE expires_at < NOW() OR is_revoked = TRUE;
