-- Migration 035: PureScan deja de ser un mock.
--
-- CONTEXTO
-- routes/purescan.js montaba 7 endpoints en /api/purescan que devolvían datos
-- inventados: siempre los mismos aguacates Hass, hashes de transacción con
-- Math.random(), inventario aleatorio en cada petición y un DID fijo escrito a
-- mano. No había servicio, ni tabla, ni test.
--
-- Estas tablas son el estado real. El análisis de visión no se resuelve aquí:
-- se delega en el AgentManager, que es asíncrono, y por eso el escaneo tiene
-- máquina de estados propia (pending → analyzing → completed/failed) en lugar
-- de fabricar un veredicto al vuelo.

CREATE TABLE IF NOT EXISTS purescan_scans (
    id              SERIAL PRIMARY KEY,
    scan_ref        VARCHAR(64)  NOT NULL UNIQUE,
    wallet_address  VARCHAR(42),
    sku             VARCHAR(64),
    product         VARCHAR(255),
    batch           VARCHAR(64),
    -- Lo que mandó el nodo edge, tal cual. Es la prueba de qué se analizó.
    source_payload  JSONB,
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'analyzing', 'completed', 'failed', 'unavailable')),
    -- Id devuelto por AgentManager.dispatch(); permite correlacionar con el runtime.
    task_id         VARCHAR(128),
    analysis        JSONB,
    risk_level      VARCHAR(20),
    error_message   TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purescan_scans_status  ON purescan_scans (status);
CREATE INDEX IF NOT EXISTS idx_purescan_scans_created ON purescan_scans (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purescan_scans_sku     ON purescan_scans (sku);
CREATE INDEX IF NOT EXISTS idx_purescan_scans_task    ON purescan_scans (task_id)
    WHERE task_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Digital Product Passport
--
-- El anclaje reutiliza el merkle de services/telemetryAnchor.js (el mismo que
-- usa la telemetría de CargoLink) en lugar de introducir un contrato nuevo: el
-- DPP es un documento cuyo hash hay que poder demostrar, exactamente el mismo
-- problema. Un DPP nace 'pending' y pasa a 'anchored' cuando la raíz llega a la
-- cadena; si no hay bridge configurado se queda pendiente, que es honesto,
-- frente al hash aleatorio con status CONFIRMED que devolvía el mock.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purescan_dpp (
    id              SERIAL PRIMARY KEY,
    dpp_ref         VARCHAR(64)  NOT NULL UNIQUE,
    scan_id         INTEGER      REFERENCES purescan_scans (id) ON DELETE SET NULL,
    payload         JSONB        NOT NULL,
    leaf_hash       VARCHAR(66)  NOT NULL,
    merkle_root     VARCHAR(66),
    anchor_tx_hash  VARCHAR(66),
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'anchored', 'failed')),
    anchored_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purescan_dpp_status ON purescan_dpp (status);
CREATE INDEX IF NOT EXISTS idx_purescan_dpp_scan   ON purescan_dpp (scan_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Inventario
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purescan_inventory (
    id            SERIAL PRIMARY KEY,
    sku           VARCHAR(64)  NOT NULL UNIQUE,
    product       VARCHAR(255),
    quantity      INTEGER      NOT NULL DEFAULT 0,
    batch         VARCHAR(64),
    status        VARCHAR(20)  NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('verified', 'pending', 'warning')),
    last_scan_at  TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purescan_inventory_status ON purescan_inventory (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Feedback humano (HITL) sobre un análisis
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purescan_feedback (
    id          SERIAL PRIMARY KEY,
    scan_id     INTEGER      NOT NULL REFERENCES purescan_scans (id) ON DELETE CASCADE,
    verdict     VARCHAR(20)  NOT NULL CHECK (verdict IN ('confirm', 'reject', 'correct')),
    comment     TEXT,
    created_by  VARCHAR(64),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purescan_feedback_scan ON purescan_feedback (scan_id);
