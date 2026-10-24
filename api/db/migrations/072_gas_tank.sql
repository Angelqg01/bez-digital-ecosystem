-- 072_gas_tank.sql
--
-- Gas Tank (fase 1 de docs/developer/GAS_TANK_PLAN_DESARROLLO.md): saldo prepago
-- por organización, en CRÉDITOS (1 crédito = 0,001 EUR, el mismo del resto de la
-- plataforma). No sustituye todavía a gas_balances/enterprises.gas_tank_address
-- (modelo antiguo de saldo nativo por dirección); esas tablas se retiran cuando
-- el gasMonitor deje de usarlas.

CREATE TABLE IF NOT EXISTS gas_tank_accounts (
    organization_id         UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    status                  VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'suspended')),
    -- Créditos disponibles (lo ya reservado para operaciones en vuelo no cuenta).
    balance_credits         BIGINT NOT NULL DEFAULT 0 CHECK (balance_credits >= 0),
    auto_recharge_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
    threshold_credits       BIGINT NOT NULL DEFAULT 10000 CHECK (threshold_credits >= 0),
    recharge_credits        BIGINT NOT NULL DEFAULT 50000 CHECK (recharge_credits > 0),
    monthly_cap_credits     BIGINT CHECK (monthly_cap_credits IS NULL OR monthly_cap_credits > 0),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operaciones en vuelo: el saldo máximo de la operación se retira al reservar y
-- se liquida (cobra el coste real, devuelve el resto) o se libera al caducar.
CREATE TABLE IF NOT EXISTS gas_tank_reservations (
    op_hash             VARCHAR(80) PRIMARY KEY,
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    app_id              VARCHAR(80),
    sender              VARCHAR(42),
    max_cost_credits    BIGINT NOT NULL CHECK (max_cost_credits > 0),
    status              VARCHAR(10) NOT NULL DEFAULT 'reserved'
                        CHECK (status IN ('reserved', 'settled', 'released')),
    valid_until         TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gas_res_org ON gas_tank_reservations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_gas_res_expiry ON gas_tank_reservations(valid_until) WHERE status = 'reserved';

-- Libro de movimientos (inmutable: se corrige con otro asiento, nunca con UPDATE).
-- `credits` es con signo: positivo suma al saldo, negativo lo resta.
CREATE TABLE IF NOT EXISTS gas_tank_ledger (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind                VARCHAR(20) NOT NULL
                        CHECK (kind IN ('recharge', 'charge', 'refund', 'adjustment', 'bonus')),
    credits             BIGINT NOT NULL CHECK (credits <> 0),
    balance_after       BIGINT NOT NULL,
    op_hash             VARCHAR(80),
    tx_hash             VARCHAR(80),
    chain_id            INTEGER,
    app_id              VARCHAR(80),
    user_ref            VARCHAR(80),
    op_type             VARCHAR(60),
    gas_used            BIGINT,
    -- Idempotencia de las recargas (id de sesión/pago de Stripe).
    external_ref        VARCHAR(120),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gas_ledger_org ON gas_tank_ledger(organization_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_gas_ledger_external ON gas_tank_ledger(external_ref) WHERE external_ref IS NOT NULL;
-- Una operación sólo se carga una vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gas_ledger_charge ON gas_tank_ledger(op_hash) WHERE kind = 'charge' AND op_hash IS NOT NULL;
