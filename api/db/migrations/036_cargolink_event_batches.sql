-- Migration 036: CargoLink lifecycle event batching (merkle).
--
-- Motivo medido: cada transición del ciclo de vida se anclaba con su propia
-- transacción on-chain (191K–251K gas). El camino de telemetría ya agrupaba
-- lecturas en un árbol merkle y gastaba 118.770 gas por 19 hojas — 6.251 gas
-- por evento, 31,9x más barato. Este esquema lleva ese mismo mecanismo a los
-- eventos de ciclo de vida.
--
-- Política de dos clases (cargoLinkBatcher.js):
--   * evidencia   -> se agrupa (CUSTOMS_CLEARED, STOWED, DEPARTED, IN_TRANSIT)
--   * liquidación -> sigue siendo una tx inmediata, porque mueve dinero o
--                    cambia estado que otro contrato lee (CREATED, DELIVERED)
--
-- La hoja canónica y el árbol usan el MISMO esquema de pares ordenados que
-- cargoTelemetryAnchor.js, de modo que TelemetryAnchor.verify() valida on-chain
-- una prueba de inclusión de un evento logístico sin cambios en el contrato.

-- Cola de eventos pendientes de anclar.
CREATE TABLE IF NOT EXISTS cargolink_event_queue (
    id            SERIAL PRIMARY KEY,
    b_uid         VARCHAR(64)  NOT NULL,
    to_status     VARCHAR(32)  NOT NULL,
    actor         VARCHAR(64),
    leaf          CHAR(66)     NOT NULL,          -- 0x + sha256 de la hoja canónica
    payload_hash  CHAR(66),                       -- hash del payload de la transición
    batch_id      INTEGER,                        -- NULL mientras esté pendiente
    occurred_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Sólo se indexa lo pendiente: es la consulta caliente del flusher.
CREATE INDEX IF NOT EXISTS idx_cargolink_event_queue_pending
    ON cargolink_event_queue (id) WHERE batch_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_cargolink_event_queue_buid
    ON cargolink_event_queue (b_uid, id);

-- Lotes anclados. batch_key agrupa eventos de VARIOS envíos en una sola raíz;
-- ahí está el ahorro real frente a anclar por envío.
CREATE TABLE IF NOT EXISTS cargolink_event_batches (
    id            SERIAL PRIMARY KEY,
    batch_key     VARCHAR(64)  NOT NULL,          -- clave del lote usada como bUid en anchorBatch()
    merkle_root   CHAR(66)     NOT NULL,
    leaf_count    INTEGER      NOT NULL,
    from_ts       TIMESTAMPTZ  NOT NULL,
    to_ts         TIMESTAMPTZ  NOT NULL,
    tx_hash       VARCHAR(80),                    -- NULL si el anclaje no estaba configurado o falló
    chain_id      INTEGER,
    gas_used      BIGINT,                         -- para medir el ahorro de verdad
    anchor_mode   VARCHAR(32)  NOT NULL DEFAULT 'pending',
    anchor_error  TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_event_batches_key
    ON cargolink_event_batches (batch_key, id DESC);

ALTER TABLE cargolink_event_queue
    ADD CONSTRAINT fk_cargolink_event_queue_batch
    FOREIGN KEY (batch_id) REFERENCES cargolink_event_batches(id) ON DELETE SET NULL;
