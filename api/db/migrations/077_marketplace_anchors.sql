-- 077_marketplace_anchors.sql
--
-- API Marketplace, paso 4: anclaje de los recibos en cadena.
--
-- Cada lote agrupa llamadas de UN listing (clave on-chain `mkt:<listingId>`) y guarda su raíz
-- merkle (sha256, pares ordenados, igual que TelemetryAnchor.verify). El mismo lote se ancla en
-- una o varias redes, una fila por red:
--   · polygon (137): la red pública donde vive BEZ-Coin. Es el ancla verificable hoy.
--   · l2 (2708):     la L2 propia, en cuanto tenga nodo. Mismo contrato y misma raíz, así que la
--                    prueba de inclusión de un recibo vale en las dos.
--
-- 076 dejó un `tx_hash` único en el lote; con varias redes no basta y se sustituye por la tabla
-- de anclas. 076 no se ha aplicado en producción, así que la columna no tiene datos.

ALTER TABLE marketplace_receipt_batches
    ADD COLUMN IF NOT EXISTS anchor_key TEXT,
    ADD COLUMN IF NOT EXISTS leaf_count INT CHECK (leaf_count IS NULL OR leaf_count > 0),
    ADD COLUMN IF NOT EXISTS from_ts    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS to_ts      TIMESTAMPTZ;

ALTER TABLE marketplace_receipt_batches DROP COLUMN IF EXISTS tx_hash;

CREATE INDEX IF NOT EXISTS idx_mkt_batches_listing ON marketplace_receipt_batches (listing_id, created_at);

CREATE TABLE IF NOT EXISTS marketplace_batch_anchors (
    batch_id         UUID NOT NULL REFERENCES marketplace_receipt_batches(id) ON DELETE CASCADE,
    network          TEXT NOT NULL CHECK (network IN ('polygon', 'l2')),
    chain_id         INT  NOT NULL,
    contract_address TEXT NOT NULL CHECK (contract_address ~ '^0x[0-9a-fA-F]{40}$'),
    -- pending: aún no enviado · sent: tx enviada, sin confirmar (el reintento consulta el recibo,
    -- no reenvía) · confirmed · failed: se reintenta en la próxima pasada.
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'sent', 'confirmed', 'failed')),
    tx_hash          TEXT CHECK (tx_hash IS NULL OR tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
    block_number     BIGINT,
    anchor_index     BIGINT,                         -- índice en TelemetryAnchor para verify()
    attempts         INT NOT NULL DEFAULT 0,
    last_error       TEXT,
    anchored_at      TIMESTAMPTZ,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (batch_id, network)
);

CREATE INDEX IF NOT EXISTS idx_mkt_anchors_pending ON marketplace_batch_anchors (status) WHERE status <> 'confirmed';
