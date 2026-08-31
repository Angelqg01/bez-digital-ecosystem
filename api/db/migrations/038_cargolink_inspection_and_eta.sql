-- Migration 038: inspección aduanera (TX010) y cambio de ETA/ruta (TX011).
--
-- Dos eventos que el piloto de Algeciras marca como prioridad Alta y que no
-- existían. Como con los gates, el soporte on-chain ya estaba escrito y
-- probado —CustomsClearanceOracle tiene preClearanceValidation,
-- approveClearanceByOfficer y rejectClearance, con 19 tests en verde— pero
-- ningún servicio los invocaba: sólo se usaba requestClearance.
--
-- ── Inspección ──────────────────────────────────────────────────────────────
-- El contrato modela el flujo que el propio análisis describe en su Test 9:
--     DECLARED → INSPECTION → HOLD → CLEARED → RELEASED
-- traducido a estados de ClearanceRecord:
--     PENDING → PRE_VALIDATED | ESCALATED → APPROVED | REJECTED
-- El riesgo se deriva del carril que ya calcula cargoLinkValidators
-- (GREEN/ORANGE/RED), así que la inspección no inventa un criterio nuevo:
-- formaliza el que ya se estaba aplicando.
--
-- ── Cambio de ETA/ruta ──────────────────────────────────────────────────────
-- El análisis lo pide de forma explícita a raíz del cambio de rotación del
-- servicio EMUSA de MSC en julio de 2025 (Algeciras → Málaga): «la red debe
-- representar cambios de ruta sin perder la integridad histórica del envío».
-- De ahí que esto sea una tabla de HISTÓRICO y no una columna que se
-- sobrescribe: cada cambio conserva el valor anterior y quién lo declaró.

CREATE TABLE IF NOT EXISTS cargolink_inspections (
    id              SERIAL PRIMARY KEY,
    b_uid           VARCHAR(64)  NOT NULL,
    kind            VARCHAR(24)  NOT NULL,          -- CUSTOMS | SECURITY | PHYTO | SCAN
    lane            VARCHAR(16),                    -- GREEN_LANE | ORANGE_LANE | RED_LANE
    risk_score      SMALLINT     NOT NULL,          -- 0..100, el que consume preClearanceValidation
    outcome         VARCHAR(16)  NOT NULL,          -- PASSED | HELD | REJECTED
    officer_id      VARCHAR(50),                    -- BeZhas_ID del inspector
    findings        TEXT,
    evidence_hash   CHAR(66),
    chain_status    VARCHAR(24),                    -- PRE_VALIDATED | ESCALATED | APPROVED | REJECTED
    chain_tx_hash   VARCHAR(80),
    anchor_mode     VARCHAR(32)  NOT NULL DEFAULT 'pending',
    inspected_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_inspections_buid
    ON cargolink_inspections (b_uid, inspected_at);

CREATE TABLE IF NOT EXISTS cargolink_route_changes (
    id              SERIAL PRIMARY KEY,
    b_uid           VARCHAR(64)  NOT NULL,
    change_type     VARCHAR(20)  NOT NULL,          -- ETA_CHANGE | ROUTE_CHANGE | PORT_CHANGE | CARGO_REROUTED
    -- Se guarda el ANTES y el DESPUÉS. Sobrescribir la ETA perdería justo lo
    -- que un cliente reclama cuando su mercancía llega tarde.
    previous_eta    TIMESTAMPTZ,
    new_eta         TIMESTAMPTZ,
    previous_port   VARCHAR(64),
    new_port        VARCHAR(64),
    previous_route  VARCHAR(64),
    new_route       VARCHAR(64),
    reason          VARCHAR(120),
    declared_by     VARCHAR(50)  NOT NULL,
    delay_minutes   INTEGER,                        -- derivado: new_eta − previous_eta
    sla_breach      BOOLEAN      NOT NULL DEFAULT FALSE,
    evidence_hash   CHAR(66),
    anchor_mode     VARCHAR(32)  NOT NULL DEFAULT 'pending',
    occurred_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_route_changes_buid
    ON cargolink_route_changes (b_uid, occurred_at);

-- ETA comprometida y puerto de destino vigentes. Se actualizan con cada
-- cambio, pero el histórico completo vive en cargolink_route_changes.
ALTER TABLE cargolink_transactions
    ADD COLUMN IF NOT EXISTS committed_eta TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_port  VARCHAR(64),
    ADD COLUMN IF NOT EXISTS eta_revisions SMALLINT NOT NULL DEFAULT 0;
