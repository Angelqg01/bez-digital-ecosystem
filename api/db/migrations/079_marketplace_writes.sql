-- 079_marketplace_writes.sql
--
-- API Marketplace, paso 6: listings con escritura (POST/PUT/PATCH/DELETE en el sistema del proveedor).
--
--   · upstream_spki_pin: sha256 (base64) de la clave pública del servidor del proveedor. Opcional;
--     si está, el proxy no conecta con un certificado de otra clave aunque sea válido.
--   · marketplace_idempotency: una escritura con la misma Idempotency-Key no se ejecuta dos veces.
--     Se guarda el hash de la clave y el resultado (estado y recibo), NUNCA el cuerpo: repetir la
--     petición devuelve el recibo de la primera, no su respuesta.

ALTER TABLE marketplace_listings
    ADD COLUMN IF NOT EXISTS upstream_spki_pin TEXT
        CHECK (upstream_spki_pin IS NULL OR upstream_spki_pin ~ '^[A-Za-z0-9+/]{43}=$');

CREATE TABLE IF NOT EXISTS marketplace_idempotency (
    consumer_app_id UUID NOT NULL REFERENCES app_registry(id) ON DELETE CASCADE,
    listing_id      UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    key_hash        TEXT NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
    request_hash    TEXT NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),  -- misma clave, otra petición → 422
    -- in_progress: en vuelo · completed: 2xx con recibo · unknown: timeout o red, el proveedor
    -- puede haberla ejecutado; se permite reintentar con la MISMA clave (el proveedor deduplica).
    status          TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'unknown', 'failed')),
    http_status     INT,
    call_id         UUID REFERENCES marketplace_calls(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    PRIMARY KEY (consumer_app_id, listing_id, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_mkt_idem_expires ON marketplace_idempotency (expires_at);
