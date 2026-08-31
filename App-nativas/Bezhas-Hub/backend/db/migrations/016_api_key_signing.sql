-- 016_api_key_signing.sql
-- =============================================================================
-- Firma de peticiones y scopes efectivos para la API pública.
--
-- `signing_secret`: secreto HMAC por clave. Permite que el cliente firme cada
-- petición (timestamp + nonce + método + ruta + cuerpo), de modo que una API
-- key filtrada NO baste por sí sola para operar. Ver middleware/apiSecurity.js.
--
-- `permissions` (jsonb) ya existía pero nadie lo comprobaba; a partir de ahora
-- lo aplica `requireScope()`. Las claves antiguas sin scopes siguen operando
-- hasta que se active API_STRICT_SCOPES=true.
--
-- Aditivo y no destructivo: sólo añade columnas e índices.
-- =============================================================================

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS signing_secret TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS signature_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Búsqueda de claves activas por hash (ruta caliente de cada petición).
CREATE INDEX IF NOT EXISTS idx_api_keys_hash_active
  ON api_keys(key_hash) WHERE status = 'active';

-- Listado de claves por organización en el panel.
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);

COMMENT ON COLUMN api_keys.signing_secret IS
  'Secreto HMAC-SHA256 para firmar peticiones. Se muestra UNA vez al emitir la clave.';
COMMENT ON COLUMN api_keys.signature_required IS
  'Si es TRUE, el gateway rechaza peticiones sin firma válida para esta clave.';
