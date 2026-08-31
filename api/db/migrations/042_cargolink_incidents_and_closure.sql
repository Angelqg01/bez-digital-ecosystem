-- Incidencia reportada (TX014) y cierre de operación (TX020)
--
-- Son los dos últimos eventos del piloto de Algeciras que no tenían nada.
--
-- TX014: el oracle de disputas ya gradúa incidencias DETECTADAS por telemetría.
-- Falta la reportada por una PERSONA — daño en la descarga, robo, mala
-- declaración — que ningún sensor ve. Va a la misma matriz de severidad en vez
-- de a una propia: dos escalas de gravedad conviviendo sobre el mismo envío es
-- garantía de que acaben contradiciéndose.
--
-- TX020: el ciclo de vida termina en DELIVERED, pero entregar no es cerrar. El
-- cierre es la afirmación de que NO QUEDA NADA PENDIENTE, y es la que consulta
-- un auditor. Por eso se verifica en vez de aceptarse.

CREATE TABLE IF NOT EXISTS cargolink_incidents (
    id                  BIGSERIAL PRIMARY KEY,
    b_uid               TEXT        NOT NULL,
    reference           TEXT        NOT NULL UNIQUE,
    kind                TEXT        NOT NULL,
    -- Severidad tal como la reporta quien lo ve. La definitiva la fija el
    -- oracle: si el reportante pudiera fijarla, la escala no significaría nada.
    reported_severity   TEXT        NOT NULL DEFAULT 'MINOR',
    graded_severity     INTEGER,
    description         TEXT        NOT NULL,
    occurred_at         TIMESTAMPTZ NOT NULL,
    location            TEXT,
    reported_by         TEXT        NOT NULL,
    evidence_hash       TEXT,
    dispute_id          BIGINT,
    anchor_tx_hash      TEXT,
    anchor_mode         TEXT,
    status              TEXT        NOT NULL DEFAULT 'OPEN',
    resolved_at         TIMESTAMPTZ,
    resolution          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cargolink_incidents_status_chk CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
    CONSTRAINT cargolink_incidents_sev_chk
        CHECK (reported_severity IN ('MINOR', 'MODERATE', 'CRITICAL'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_buid ON cargolink_incidents (b_uid, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_open ON cargolink_incidents (status) WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS cargolink_operation_closures (
    id                  BIGSERIAL PRIMARY KEY,
    b_uid               TEXT        NOT NULL UNIQUE,
    reference           TEXT        NOT NULL UNIQUE,
    closed_by           TEXT        NOT NULL,
    closed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Foto de las comprobaciones en el momento del cierre. Se guarda el detalle
    -- y no un simple booleano: dentro de dos años, "cerrada" sin decir qué se
    -- comprobó no vale como evidencia de nada.
    checks              JSONB       NOT NULL,
    -- Cierre forzado pese a pendientes. Existe porque a veces hay que cerrar de
    -- todos modos; se exige motivo y queda marcado para siempre.
    forced              BOOLEAN     NOT NULL DEFAULT FALSE,
    forced_reason       TEXT,
    anchor_tx_hash      TEXT,
    anchor_mode         TEXT,
    content_hash        TEXT        NOT NULL,

    CONSTRAINT cargolink_closures_forced_chk
        CHECK (NOT forced OR forced_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_closures_forced ON cargolink_operation_closures (forced) WHERE forced;
