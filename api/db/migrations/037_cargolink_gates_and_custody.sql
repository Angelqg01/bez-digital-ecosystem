-- Migration 037: gate-in, gate-out y cambio de custodia.
--
-- Los tres eventos de criticidad máxima que faltaban del piloto de Algeciras
-- (TX004, TX005, TX006). Los contratos que los soportan ya existían y estaban
-- probados —WarehouseManager con 18 tests en verde— pero ningún servicio los
-- invocaba: eran contratos huérfanos.
--
-- Modelo:
--   * GATE_IN y GATE_OUT son ESTADOS del ciclo de vida. Un envío entra en un
--     almacén una vez y sale una vez, en ese orden, y el estado avanza.
--   * CUSTODY_TRANSFER NO es un estado: es un evento lateral que puede ocurrir
--     N veces (almacén → transportista → terminal → naviera → cliente). Tratarlo
--     como etapa habría obligado a inventar un camino lineal que la operación
--     real no tiene.
--
-- Ciclo resultante:
--   CREATED → GATE_IN → CUSTOMS_CLEARED → STOWED → GATE_OUT → DEPARTED
--           → IN_TRANSIT → DELIVERED
--   con CUSTODY_TRANSFER emitible en cualquier punto entre GATE_IN y DELIVERED.

-- ── Almacenes registrados (espejo off-chain de WarehouseManager) ─────────────
CREATE TABLE IF NOT EXISTS cargolink_warehouses (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(32)  NOT NULL UNIQUE,   -- p.ej. ALG-BA-12000
    name            VARCHAR(160) NOT NULL,
    operator_bezhas_id VARCHAR(50),
    location        VARCHAR(120),
    capacity_kg     BIGINT       NOT NULL,
    chain_warehouse_id INTEGER,                     -- id devuelto por registerWarehouse()
    chain_tx_hash   VARCHAR(80),
    active          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Custodia: quién responde de la mercancía en cada tramo ───────────────────
CREATE TABLE IF NOT EXISTS cargolink_custody (
    id              SERIAL PRIMARY KEY,
    b_uid           VARCHAR(64)  NOT NULL,
    from_actor      VARCHAR(50),                    -- NULL en la primera custodia
    to_actor        VARCHAR(50)  NOT NULL,
    from_role       VARCHAR(24),
    to_role         VARCHAR(24)  NOT NULL,
    reason          VARCHAR(64),                    -- GATE_IN | GATE_OUT | HANDOVER | TRANSSHIPMENT
    location        VARCHAR(120),
    evidence_hash   CHAR(66),
    chain_tx_hash   VARCHAR(80),
    chain_transfer_id INTEGER,                      -- id de transferLot()
    anchor_mode     VARCHAR(32)  NOT NULL DEFAULT 'pending',
    occurred_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_custody_buid
    ON cargolink_custody (b_uid, occurred_at);

-- ── Lotes de almacén asociados a un envío ───────────────────────────────────
-- Un B-UID puede ocupar un lote en el almacén; guardamos el id on-chain para
-- poder consumirlo en el gate-out y transferirlo en un cambio de custodia.
CREATE TABLE IF NOT EXISTS cargolink_warehouse_lots (
    id              SERIAL PRIMARY KEY,
    b_uid           VARCHAR(64)  NOT NULL,
    warehouse_id    INTEGER      NOT NULL REFERENCES cargolink_warehouses(id),
    chain_lot_id    INTEGER,                        -- id devuelto por receiveLot()
    quantity_kg     BIGINT       NOT NULL,
    expiry_date     TIMESTAMPTZ,
    status          VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | CONSUMED | TRANSFERRED
    gate_in_tx      VARCHAR(80),
    gate_out_tx     VARCHAR(80),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_warehouse_lots_buid
    ON cargolink_warehouse_lots (b_uid);

-- El estado de la transacción pasa a admitir GATE_IN y GATE_OUT. No hay CHECK
-- sobre esa columna (la máquina de estados vive en cargoLinkLifecycle.js), así
-- que no hace falta alterarla — se documenta aquí para que quede constancia.
COMMENT ON COLUMN cargolink_transactions.status IS
    'CREATED | GATE_IN | CUSTOMS_CLEARED | STOWED | GATE_OUT | DEPARTED | IN_TRANSIT | DELIVERED';
