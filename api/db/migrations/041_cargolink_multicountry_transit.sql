-- Tránsito multipaís — TrackingToCustomsGateway
--
-- Un envío Algeciras→Frankfurt no despacha una vez: cruza Marruecos, España y
-- Alemania, y cada aduana resuelve por su cuenta y a su ritmo. Hasta ahora la
-- plataforma modelaba UN despacho por envío, que es el caso fácil y no el del
-- piloto: el Estrecho es precisamente una frontera exterior de la UE.
--
-- Lo que se guarda aquí es el estado por país. El envío no queda libre hasta
-- que todos han despachado, y eso es una condición que se comprueba, no una
-- que alguien afirma.

CREATE TABLE IF NOT EXISTS cargolink_transit_legs (
    id                  BIGSERIAL PRIMARY KEY,
    b_uid               TEXT        NOT NULL,
    chain_shipment_id   BIGINT,
    -- Orden de cruce. Importa: despachar en Alemania antes de salir de España
    -- no es un tránsito, es un error de datos.
    leg_index           INTEGER     NOT NULL,
    country_code        CHAR(2)     NOT NULL,
    customs_platform    TEXT,
    -- PENDING -> CLEARED | REJECTED
    status              TEXT        NOT NULL DEFAULT 'PENDING',
    cleared_at          TIMESTAMPTZ,
    cleared_by          TEXT,
    reference           TEXT,
    notes               TEXT,
    anchor_tx_hash      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cargolink_transit_legs_status_chk
        CHECK (status IN ('PENDING', 'CLEARED', 'REJECTED')),
    -- Un país aparece una sola vez por envío: dos filas para la misma aduana
    -- harían que "todos despachados" dependiera de cuál se mire.
    CONSTRAINT cargolink_transit_legs_unique_country UNIQUE (b_uid, country_code),
    CONSTRAINT cargolink_transit_legs_unique_order   UNIQUE (b_uid, leg_index)
);

CREATE INDEX IF NOT EXISTS idx_transit_legs_buid    ON cargolink_transit_legs (b_uid, leg_index);
CREATE INDEX IF NOT EXISTS idx_transit_legs_pending ON cargolink_transit_legs (status)
    WHERE status = 'PENDING';

-- Cabecera del tránsito: el envío integrado en el gateway.
CREATE TABLE IF NOT EXISTS cargolink_integrated_shipments (
    id                  BIGSERIAL PRIMARY KEY,
    b_uid               TEXT        NOT NULL UNIQUE,
    chain_shipment_id   BIGINT,
    tracking_provider   TEXT,
    tracking_ref        TEXT,
    customs_platform    TEXT,
    hs_code             TEXT,
    cargo_value_cents   BIGINT      NOT NULL DEFAULT 0,
    currency            CHAR(3)     NOT NULL DEFAULT 'EUR',
    dua_hash            TEXT,
    -- Se recalcula al despachar cada país; no se acepta del cliente.
    all_countries_cleared BOOLEAN   NOT NULL DEFAULT FALSE,
    anchor_tx_hash      TEXT,
    anchor_mode         TEXT,
    created_by          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrated_shipments_open
    ON cargolink_integrated_shipments (all_countries_cleared)
    WHERE all_countries_cleared = FALSE;
