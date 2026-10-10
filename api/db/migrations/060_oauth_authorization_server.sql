-- 060_oauth_authorization_server.sql
--
-- OAuth 2.1 + PKCE para el MCP de cliente (ChatGPT, Codex, agentes propios).
--
-- QUÉ PROBLEMA RESUELVE
--
-- Hasta ahora la única forma de autenticarse contra /api/mcp era una api-key
-- estática en x-api-key. Le sirve a un agente propio (Claude Code, Cursor,
-- un cron), pero no a un conector remoto de ChatGPT/Codex: esos clientes
-- necesitan que una PERSONA autorice en su navegador, con una credencial de
-- vida corta que se pueda revocar sin tocar la api-key de nadie más.
--
-- CÓMO ENCAJA CON LO QUE YA EXISTE
--
-- No sustituye nada: añade una segunda vía de autenticación junto a la
-- api-key. gateway-auth.js acepta ahora también un `Authorization: Bearer
-- <jwt>` emitido aquí, y el `sub` de ese JWT es el mismo app_registry.id de
-- siempre — la ruta MCP (routes/mcp-gateway.js) no cambia una sola línea.
--
-- El código de autorización y el refresh token siguen el mismo idioma que el
-- resto del sistema (onboarding_sessions, client_nodes, app_registry): SHA-256
-- en columna *_hash, nunca el valor en claro, un solo uso, vida corta. El
-- access token en sí es un JWT autocontenido (services/oauthTokens.js) y por
-- eso no tiene tabla propia — sólo la denylist para poder revocarlo antes de
-- que expire.
--
-- PKCE ES OBLIGATORIO Y SÓLO S256
--
-- code_challenge_method está restringido por CHECK a 'S256'. Aceptar 'plain'
-- —o no exigir PKCE, que es lo que hacía OAuth 2.0— permitiría a una app
-- maliciosa en el mismo dispositivo robar el código de otra. Eso es
-- literalmente la diferencia entre "2.0" y "2.1".
--
-- POR QUÉ oauth_clients NO ES app_registry
--
-- app_registry identifica a un TENANT de BeZhas (una empresa, una integración
-- ya contratada). oauth_clients identifica a la APLICACIÓN llamante —ChatGPT,
-- Codex, un partner— que un mismo client_id lo usan decenas de tenants
-- distintos. La vinculación a un tenant concreto ocurre en CADA autorización
-- (qué organización elige la persona en la pantalla de consentimiento), nunca
-- en el registro del cliente.

CREATE TABLE IF NOT EXISTS oauth_clients (
    client_id            TEXT PRIMARY KEY,
    -- NULL = cliente público (ChatGPT/Codex vía PKCE, sin secreto que guardar
    -- en un binario que el usuario controla). No NULL = cliente confidencial
    -- de un partner con backend propio.
    client_secret_hash   CHAR(64),
    client_name          TEXT NOT NULL,
    -- Match EXACTO en /oauth/authorize y en /oauth/token, nunca por prefijo:
    -- un prefijo abierto ("https://chat.openai.com/*") deja que cualquier ruta
    -- de ese dominio reciba el código.
    redirect_uris         TEXT[] NOT NULL,
    client_type           TEXT NOT NULL DEFAULT 'public'
                           CHECK (client_type IN ('public', 'confidential')),
    registration_source   TEXT NOT NULL DEFAULT 'dcr'
                           CHECK (registration_source IN ('dcr', 'manual')),
    is_active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- oauth_authorization_codes hace de sesión de consentimiento Y de código final
-- a la vez —mismo motivo que onboarding_sessions no separa sesión de
-- resultado—: antes de aprobarse es la pantalla de login/consentimiento
-- (identificada por session_token_hash); al aprobarse se le rellena code_hash
-- y pasa a ser el código que el cliente canjea en /oauth/token.
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token_hash     CHAR(64) NOT NULL UNIQUE,
    code_hash              CHAR(64) UNIQUE,
    client_id              TEXT NOT NULL REFERENCES oauth_clients(client_id),
    redirect_uri           TEXT NOT NULL,
    code_challenge         TEXT NOT NULL,
    code_challenge_method  TEXT NOT NULL DEFAULT 'S256' CHECK (code_challenge_method = 'S256'),
    scope_solicitado       TEXT[] NOT NULL,
    scope_concedido        TEXT[],
    resource               TEXT,
    state                  TEXT,
    -- Se rellenan al aprobar, tras identificarse en la pantalla. Antes de eso
    -- la sesión no sabe de quién es —igual que onboarding_sessions 'connect'.
    app_id                 UUID REFERENCES app_registry(id),
    user_id                UUID REFERENCES users(id),
    -- Mismo límite que onboarding_sessions.intentos_login y por la misma
    -- razón: este formulario está en internet y acepta correo/contraseña sin
    -- credencial previa.
    intentos_login         SMALLINT NOT NULL DEFAULT 0,
    status                 TEXT NOT NULL DEFAULT 'pendiente'
                            CHECK (status IN ('pendiente', 'aprobado', 'canjeado', 'caducado', 'denegado')),
    source_ip              INET,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at             TIMESTAMPTZ NOT NULL,
    consumed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_expira
    ON oauth_authorization_codes (expires_at)
    WHERE status IN ('pendiente', 'aprobado');

-- oauth_refresh_tokens: opaco, rotación obligatoria en cada canje. family_id
-- es la defensa contra REPLAY: si un refresh token ya canjeado (used_at no
-- nulo) vuelve a presentarse, es que alguien tiene una copia, y se revoca TODA
-- la familia — no sólo ese token — porque no hay forma de saber si el
-- poseedor legítimo es el que acaba de fallar o el atacante.
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash     CHAR(64) NOT NULL UNIQUE,
    family_id      UUID NOT NULL,
    client_id      TEXT NOT NULL REFERENCES oauth_clients(client_id),
    app_id         UUID NOT NULL REFERENCES app_registry(id),
    scope          TEXT[] NOT NULL,
    revoked_at     TIMESTAMPTZ,
    used_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_family ON oauth_refresh_tokens (family_id);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_app ON oauth_refresh_tokens (app_id);

-- Denylist de jti para poder revocar un access token pese a ser un JWT
-- autocontenido. Vive sólo hasta que el token habría expirado de todas formas
-- (10 min): no hace falta guardarla más allá de eso.
CREATE TABLE IF NOT EXISTS oauth_token_denylist (
    jti         UUID PRIMARY KEY,
    revoked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_denylist_expira ON oauth_token_denylist (expires_at);

COMMENT ON TABLE oauth_clients IS
    'Aplicaciones OAuth registradas (ChatGPT, Codex, partners). No son tenants de BeZhas — ver cabecera del fichero.';
COMMENT ON TABLE oauth_authorization_codes IS
    'Sesión de consentimiento + código de un solo uso. token/code van hasheados, nunca en claro.';
COMMENT ON TABLE oauth_refresh_tokens IS
    'Opaco, rotación obligatoria. used_at no nulo + reuso => replay => revocar family_id entera.';
