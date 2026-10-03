-- 058_tx_security_fabric.sql
--
-- Capa de seguridad transaccional: intenciones, aprobaciones firmadas,
-- destinos, identidad de agentes, KYB, kill switch y auditoría encadenada.
--
-- Cubre los cuatro carriles de valor de BeZhas: cripto→cripto, FIAT→cripto,
-- cripto→FIAT y FIAT→FIAT. Diseño y razones: docs/security/TX_SECURITY_FABRIC.md
--
-- Tres principios que el esquema hace cumplir, no sólo el código:
--
--   1. Lo que ya pasó no se edita. security_audit_log, tx_approvals y
--      security_kill_switch_events rechazan UPDATE, DELETE y TRUNCATE con un
--      trigger. La aplicación no puede reescribir el pasado ni por error.
--   2. Una intención es única por (cliente, clave de idempotencia) y por hash.
--      Reintentar nunca crea un segundo pago.
--   3. Un agente siempre caduca. expires_at es NOT NULL en app_agents: una
--      credencial de agente sin fecha de fin es una credencial olvidada.

-- ─────────────────────────────────────────────────────────────────────────────
--  Append-only
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION bezhas_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % es append-only: % no permitido', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege';
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
--  Intenciones
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tx_intents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id              UUID NOT NULL REFERENCES app_registry(id) ON DELETE RESTRICT,
    agent_id            VARCHAR(64),
    idempotency_key     VARCHAR(80) NOT NULL,
    request_fingerprint CHAR(66) NOT NULL,
    intent              JSONB NOT NULL,
    intent_hash         CHAR(66) NOT NULL UNIQUE,
    rail                VARCHAR(20) NOT NULL
        CHECK (rail IN ('crypto_transfer', 'fiat_to_crypto', 'crypto_to_fiat', 'fiat_to_fiat')),
    custody             VARCHAR(10) NOT NULL CHECK (custody IN ('self', 'bezhas', 'partner', 'provider')),
    amount_eur          NUMERIC(20, 2),
    status              VARCHAR(30) NOT NULL CHECK (status IN (
                            'denied', 'awaiting_approval', 'approved', 'ready', 'executing',
                            'broadcast', 'dispatched', 'awaiting_manual_execution', 'awaiting_payment',
                            'rejected', 'expired', 'failed', 'failed_needs_review')),
    decision            VARCHAR(20) NOT NULL CHECK (decision IN ('ALLOW', 'REQUIRE_APPROVAL', 'DENY')),
    required_approvals  SMALLINT NOT NULL DEFAULT 0 CHECK (required_approvals BETWEEN 0 AND 10),
    policy              JSONB NOT NULL,
    risk                JSONB NOT NULL,
    simulation          JSONB,
    policy_hash         CHAR(66) NOT NULL,
    tx_request          JSONB,
    tx_hash             CHAR(66),
    provider_ref        VARCHAR(160),
    execution           JSONB,
    error_code          VARCHAR(60),
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_tx_intents_uso ON tx_intents (app_id, rail, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_intents_estado ON tx_intents (status) WHERE status IN ('awaiting_approval', 'approved', 'executing', 'failed_needs_review');

-- ─────────────────────────────────────────────────────────────────────────────
--  Aprobadores y aprobaciones
-- ─────────────────────────────────────────────────────────────────────────────
-- app_id NULL = aprobador global de BeZhas (roles treasury / security).
CREATE TABLE IF NOT EXISTS tx_approvers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id      UUID REFERENCES app_registry(id) ON DELETE CASCADE,
    address     VARCHAR(42) NOT NULL CHECK (address ~ '^0x[0-9a-fA-F]{40}$'),
    roles       TEXT[] NOT NULL CHECK (roles <@ ARRAY['approver', 'treasury', 'security']::TEXT[] AND cardinality(roles) > 0),
    label       VARCHAR(120),
    status      VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    expires_at  TIMESTAMPTZ,
    created_by  VARCHAR(120),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_approvers_unico
    ON tx_approvers (COALESCE(app_id::TEXT, 'global'), LOWER(address));

CREATE TABLE IF NOT EXISTS tx_approvals (
    id               BIGSERIAL PRIMARY KEY,
    intent_id        UUID NOT NULL REFERENCES tx_intents(id) ON DELETE RESTRICT,
    approver_address VARCHAR(42) NOT NULL,
    decision         VARCHAR(10) NOT NULL CHECK (decision IN ('APPROVE', 'REJECT')),
    signature        TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (intent_id, approver_address)
);
DROP TRIGGER IF EXISTS tx_approvals_append_only ON tx_approvals;
CREATE TRIGGER tx_approvals_append_only BEFORE UPDATE OR DELETE ON tx_approvals
    FOR EACH ROW EXECUTE FUNCTION bezhas_append_only();
DROP TRIGGER IF EXISTS tx_approvals_no_truncate ON tx_approvals;
CREATE TRIGGER tx_approvals_no_truncate BEFORE TRUNCATE ON tx_approvals
    FOR EACH STATEMENT EXECUTE FUNCTION bezhas_append_only();

-- ─────────────────────────────────────────────────────────────────────────────
--  Destinos (con periodo de enfriamiento)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tx_destinations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id        UUID NOT NULL REFERENCES app_registry(id) ON DELETE CASCADE,
    type          VARCHAR(20) NOT NULL CHECK (type IN ('evm_address', 'iban')),
    value         VARCHAR(64) NOT NULL,
    name          VARCHAR(140),
    country       CHAR(2),
    status        VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'blocked')),
    cooling_until TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, type, value)
);

-- ─────────────────────────────────────────────────────────────────────────────
--  Identidad de agentes (§41): subclaves por agente, con límites y caducidad
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_agents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id          UUID NOT NULL REFERENCES app_registry(id) ON DELETE CASCADE,
    agent_id        VARCHAR(64) NOT NULL CHECK (agent_id ~ '^[a-z0-9][a-z0-9._-]{1,63}$'),
    name            VARCHAR(120),
    key_hash        VARCHAR(64) NOT NULL UNIQUE,
    key_prefix      VARCHAR(16) NOT NULL,
    scopes          TEXT[] NOT NULL DEFAULT '{}',
    rails           TEXT[] NOT NULL DEFAULT '{}',
    per_tx_limit_eur NUMERIC(20, 2),
    daily_limit_eur  NUMERIC(20, 2),
    can_execute     BOOLEAN NOT NULL DEFAULT FALSE,
    status          VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    expires_at      TIMESTAMPTZ NOT NULL,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, agent_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
--  KYB de empresas (espejo de kyc_status, que es por wallet)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyb_status (
    enterprise_id UUID PRIMARY KEY REFERENCES enterprises(id) ON DELETE CASCADE,
    level         SMALLINT NOT NULL DEFAULT 0 CHECK (level IN (0, 1, 2)),
    provider      VARCHAR(60),
    reference     VARCHAR(160),
    verified_at   TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
--  Kill switch
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_kill_switch (
    scope      VARCHAR(80) PRIMARY KEY,
    state      VARCHAR(12) NOT NULL CHECK (state IN ('NORMAL', 'SUSPICIOUS', 'LOCKDOWN')),
    reason     VARCHAR(300),
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO security_kill_switch (scope, state, reason, updated_by)
VALUES ('global', 'NORMAL', 'estado inicial', 'migration-058')
ON CONFLICT (scope) DO NOTHING;

CREATE TABLE IF NOT EXISTS security_kill_switch_events (
    id         BIGSERIAL PRIMARY KEY,
    scope      VARCHAR(80) NOT NULL,
    from_state VARCHAR(12),
    to_state   VARCHAR(12) NOT NULL,
    reason     VARCHAR(300),
    actors     TEXT[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS security_kill_switch_events_append_only ON security_kill_switch_events;
CREATE TRIGGER security_kill_switch_events_append_only BEFORE UPDATE OR DELETE ON security_kill_switch_events
    FOR EACH ROW EXECUTE FUNCTION bezhas_append_only();

-- ─────────────────────────────────────────────────────────────────────────────
--  Auditoría de seguridad encadenada
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_audit_log (
    seq         BIGINT PRIMARY KEY,
    prev_hash   CHAR(66) NOT NULL,
    hash        CHAR(66) NOT NULL UNIQUE,
    occurred_at TIMESTAMPTZ NOT NULL,
    app_id      TEXT,
    agent_id    VARCHAR(64),
    actor       VARCHAR(120),
    event_type  VARCHAR(60) NOT NULL,
    intent_id   UUID,
    payload     JSONB
);
CREATE INDEX IF NOT EXISTS idx_security_audit_intent ON security_audit_log (intent_id) WHERE intent_id IS NOT NULL;
DROP TRIGGER IF EXISTS security_audit_log_append_only ON security_audit_log;
CREATE TRIGGER security_audit_log_append_only BEFORE UPDATE OR DELETE ON security_audit_log
    FOR EACH ROW EXECUTE FUNCTION bezhas_append_only();
DROP TRIGGER IF EXISTS security_audit_log_no_truncate ON security_audit_log;
CREATE TRIGGER security_audit_log_no_truncate BEFORE TRUNCATE ON security_audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION bezhas_append_only();

CREATE TABLE IF NOT EXISTS security_audit_anchors (
    id           BIGSERIAL PRIMARY KEY,
    merkle_root  CHAR(66) NOT NULL,
    first_seq    BIGINT NOT NULL,
    last_seq     BIGINT NOT NULL,
    leaf_count   INTEGER NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end   TIMESTAMPTZ NOT NULL,
    tx_hash      CHAR(66),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
