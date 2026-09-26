-- Migration 014: Authorization Server OAuth 2.1 + PKCE del MCP público
--
-- mcp.bezhas.com (packages/mcp-server) expone un servidor MCP para Claude,
-- ChatGPT, Codex, Gemini o Cursor. Esos clientes no pegan una clave: una
-- persona autoriza desde su navegador y el cliente recibe un token de vida
-- corta. El servidor de autorización vive AQUÍ, en el backend, porque es quien
-- tiene los usuarios y la base de datos; el servicio MCP no tiene acceso a
-- Postgres y sólo verifica la firma del token con la clave pública
-- (/.well-known/jwks.json).
--
-- Idioma de secretos: nada se guarda en claro. Sesión de consentimiento,
-- código y refresh token se guardan como SHA-256; son de un solo uso y de vida
-- corta. PKCE es obligatorio y sólo S256 (el CHECK lo impone): es lo que
-- distingue OAuth 2.1 de 2.0 y lo que impide que otra app robe el código.

-- Aplicación cliente (ChatGPT, Codex…), NO un usuario de BeZhas: un mismo
-- client_id lo usan muchas personas. La vinculación a una persona ocurre en
-- cada autorización.
CREATE TABLE IF NOT EXISTS oauth_clients (
    client_id           VARCHAR(64) PRIMARY KEY,
    client_secret_hash  CHAR(64),                 -- NULL = cliente público (PKCE)
    client_name         VARCHAR(100) NOT NULL,
    -- Coincidencia EXACTA, nunca por prefijo.
    redirect_uris       JSONB NOT NULL,
    client_type         VARCHAR(20) NOT NULL DEFAULT 'public'
                        CHECK (client_type IN ('public', 'confidential')),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sesión de consentimiento y, una vez aprobada, código de autorización.
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token_hash    CHAR(64) NOT NULL UNIQUE,
    code_hash             CHAR(64) UNIQUE,
    client_id             VARCHAR(64) NOT NULL REFERENCES oauth_clients(client_id),
    redirect_uri          TEXT NOT NULL,
    code_challenge        VARCHAR(128) NOT NULL,
    code_challenge_method VARCHAR(10) NOT NULL DEFAULT 'S256' CHECK (code_challenge_method = 'S256'),
    scope_solicitado      JSONB NOT NULL,
    scope_concedido       JSONB,
    state                 TEXT,
    user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
    -- Este formulario está en internet: intentos limitados por sesión, no sólo por IP.
    intentos_login        SMALLINT NOT NULL DEFAULT 0,
    status                VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                          CHECK (status IN ('pendiente', 'aprobado', 'canjeado', 'denegado')),
    source_ip             VARCHAR(64),
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at            TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at           TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_expira ON oauth_authorization_codes (expires_at);

-- Refresh token opaco con rotación obligatoria. family_id detecta el replay:
-- un token ya rotado que reaparece revoca la familia entera.
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash   CHAR(64) NOT NULL UNIQUE,
    family_id    UUID NOT NULL,
    client_id    VARCHAR(64) NOT NULL REFERENCES oauth_clients(client_id),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope        JSONB NOT NULL,
    revoked_at   TIMESTAMP WITH TIME ZONE,
    used_at      TIMESTAMP WITH TIME ZONE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at   TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_family ON oauth_refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_user ON oauth_refresh_tokens (user_id);
