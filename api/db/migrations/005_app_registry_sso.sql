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

-- Apps del ecosistema.
--
-- SIN CLAVE UTILIZABLE, a propósito. Este bloque sembraba las cuatro claves con
-- su secreto EN CLARO dentro de este mismo fichero, que está versionado:
--
--     'core-internal-key'  → scope admin
--     'defi-dev-key' · 'app-dev-key' · 'web3-dev-key'
--
-- Cualquiera con acceso al repositorio calculaba el SHA-256 y entraba. Y
-- 'core-internal-key' lleva scope `admin`, que en middleware/address-access.js
-- salta la comprobación de titularidad: esa clave anulaba por sí sola el
-- control de acceso a datos de otros clientes.
--
-- Se siembran las filas —así queda documentado qué apps existen y con qué
-- permisos— pero DESACTIVADAS y con un hash que ninguna clave puede producir:
-- lleva caracteres fuera del alfabeto hexadecimal, así que no hay entrada cuyo
-- SHA-256 coincida.
--
-- Para dar de alta una de verdad:
--
--   UPDATE app_registry
--      SET api_key_hash = encode(digest('<clave-generada>','sha256'),'hex'),
--          is_active = TRUE
--    WHERE app_name = 'bezhas-core';
--
-- Genera la clave con  openssl rand -hex 32  y guárdala en el gestor de
-- secretos, nunca en el repositorio.
INSERT INTO app_registry (app_name, api_key_hash, scopes, tier, allowed_origins, is_active) VALUES
    ('bezhas-core', 'PROVISION_REQUIRED_' || gen_random_uuid(),
     ARRAY['admin'], 'internal', ARRAY['http://localhost:3000', 'https://bezhas.com'], FALSE),
    ('bezhas-defi', 'PROVISION_REQUIRED_' || gen_random_uuid(),
     ARRAY['staking', 'farming', 'governance', 'bridge', 'treasury', 'wallet', 'token', 'contracts'],
     'premium', ARRAY['http://localhost:5174', 'https://defi.bezhas.com'], FALSE),
    ('bezhas-app', 'PROVISION_REQUIRED_' || gen_random_uuid(),
     ARRAY['auth', 'wallet', 'token', 'marketplace', 'social', 'notifications'],
     'premium', ARRAY['http://localhost:5173', 'https://app.bezhas.com'], FALSE),
    ('bezhas-web3', 'PROVISION_REQUIRED_' || gen_random_uuid(),
     ARRAY['auth', 'wallet', 'token', 'contracts', 'staking', 'bridge', 'marketplace', 'notifications'],
     'premium', ARRAY['http://localhost:5175', 'https://web3.bezhas.com'], FALSE)
ON CONFLICT (app_name) DO NOTHING;

-- Cleanup expired sessions (run via cron or pg_cron)
-- DELETE FROM sso_sessions WHERE expires_at < NOW() OR is_revoked = TRUE;
