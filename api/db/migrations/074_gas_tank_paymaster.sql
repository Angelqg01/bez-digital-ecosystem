-- 074_gas_tank_paymaster.sql
--
-- Fase 2 del Gas Tank (paymaster ERC-4337): políticas de patrocinio por organización,
-- metadatos de cada reserva (comisión de protocolo y precio fijados al firmar) y cursor
-- del conciliador de eventos del EntryPoint.

-- Sin fila de política no se patrocina nada (denegación por defecto).
CREATE TABLE IF NOT EXISTS gas_tank_policies (
    organization_id         UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    -- [{ "address": "0x…", "selectors": ["0x12345678", …], "maxFeeBez": "100" }]
    allowed_targets         JSONB NOT NULL DEFAULT '[]'::jsonb,
    max_cost_credits_per_op BIGINT NOT NULL DEFAULT 5000 CHECK (max_cost_credits_per_op > 0),
    daily_cap_credits       BIGINT CHECK (daily_cap_credits IS NULL OR daily_cap_credits > 0),
    -- Operaciones reguladas (tokenización…): exige organización con KYB verificado.
    require_verified        BOOLEAN NOT NULL DEFAULT TRUE,
    active                  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE gas_tank_reservations
    ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS gas_tank_chain_cursor (
    name        VARCHAR(60) PRIMARY KEY,
    chain_id    INTEGER NOT NULL,
    last_block  BIGINT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
