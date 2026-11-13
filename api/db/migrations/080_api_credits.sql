-- ============================================================================
--  BeZhas — Migración 080: saldo prepago de la API (plan Starter, pago por uso)
-- ============================================================================
--  El plan Starter facturaba a mes vencido por el medidor de Stripe: el coste
--  se generaba antes de saber si se podría cobrar. Con esto el cliente compra
--  saldo por adelantado y cada llamada lo descuenta; sin saldo, 402.
--
--  Unidad: el crédito API de config/usage-pricing.js (1 crédito = 0,001 EUR),
--  la misma de gateway_usage_ledger, así que no hay conversiones.
--
--  Mismo patrón que el Gas Tank (072): saldo con CHECK >= 0 y un libro de
--  movimientos idempotente por referencia. Tablas propias porque el del Gas
--  Tank lleva columnas de transacciones on-chain que aquí no pintan nada.
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_credit_accounts (
    app_id              TEXT        PRIMARY KEY,                 -- app_registry.id (texto, como gateway_usage_ledger)
    balance_credits     BIGINT      NOT NULL DEFAULT 0 CHECK (balance_credits >= 0),
    -- Total recargado alguna vez. > 0 marca la cuenta como «prepago»: a partir
    -- de ahí el consumo sale del saldo y deja de mandarse al medidor de Stripe.
    lifetime_recharged  BIGINT      NOT NULL DEFAULT 0 CHECK (lifetime_recharged >= 0),
    status              VARCHAR(20) NOT NULL DEFAULT 'active',   -- active | suspended
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_credit_ledger (
    id              BIGSERIAL   PRIMARY KEY,
    app_id          TEXT        NOT NULL REFERENCES api_credit_accounts(app_id) ON DELETE CASCADE,
    -- recharge/bonus/adjustment/refund suman; charge resta; hold retira el
    -- máximo de una operación cara y settle devuelve lo que no se gastó.
    kind            VARCHAR(20) NOT NULL CHECK (kind IN ('recharge', 'bonus', 'adjustment', 'refund', 'charge', 'hold', 'settle')),
    credits         BIGINT      NOT NULL,                        -- con signo
    balance_after   BIGINT      NOT NULL,
    ref             TEXT,                                        -- idempotencia: 'stripe:<sesión>', 'charge:<app>:<ref>'…
    meta            JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una referencia sólo se aplica una vez: un webhook reenviado o un reintento
-- no recargan ni cobran dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_credit_ledger_ref ON api_credit_ledger(ref) WHERE ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_credit_ledger_app ON api_credit_ledger(app_id, created_at DESC);
