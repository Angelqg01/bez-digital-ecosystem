-- Migration 043: OPERANT como SubApp del ecosistema BeZhas.
--
-- OPERANT (Gestión Empresarial Autónoma) deja de ser un SaaS suelto y pasa a
-- servirse por el Gateway. Necesita tres cosas que la API no tenía:
--
--   1. Un mapeo app registrada ↔ tenant de OPERANT (una app del Gateway
--      aprovisiona UN tenant; el tenant vive en el runtime de OPERANT).
--   2. Un contador de tareas del ciclo, para saber cuándo se agota la cuota
--      del plan y empieza el overage por créditos. El ledger de créditos ya
--      existe (gateway_usage_ledger); aquí se guarda el detalle por tarea,
--      que es lo que el cliente ve en su panel.
--   3. Anclas de auditoría: la raíz merkle de la cadena de auditoría de cada
--      tenant, con su tx on-chain. Es la prueba que se enseña en una due
--      diligence, así que se guarda aparte y no se borra con la retención.

CREATE TABLE IF NOT EXISTS operant_tenants (
    id              SERIAL PRIMARY KEY,
    app_id          UUID        NOT NULL UNIQUE REFERENCES app_registry(id) ON DELETE CASCADE,
    tenant_id       VARCHAR(80) NOT NULL UNIQUE,   -- id del tenant dentro de OPERANT
    plan_id         VARCHAR(40) NOT NULL DEFAULT 'starter',
    departments     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    autonomy        VARCHAR(20) NOT NULL DEFAULT 'draft',
    anchor_mode     VARCHAR(20) NOT NULL DEFAULT 'none',
    wallet_address  VARCHAR(42),                   -- destino de recompensas / origen de settlement
    status          VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | suspended | canceled
    provisioned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operant_tenants_app ON operant_tenants(app_id);

-- Detalle por tarea. `credits`/`billable_eur` replican lo que se manda al
-- ledger de facturación para que el panel del cliente pueda desglosar el
-- consumo sin cruzar tablas.
CREATE TABLE IF NOT EXISTS operant_tasks (
    id             BIGSERIAL PRIMARY KEY,
    app_id         UUID        NOT NULL REFERENCES app_registry(id) ON DELETE CASCADE,
    tenant_id      VARCHAR(80) NOT NULL,
    task_id        VARCHAR(80) NOT NULL,           -- id devuelto por OPERANT
    department     VARCHAR(40) NOT NULL,
    tier           VARCHAR(20) NOT NULL,
    model          VARCHAR(60),
    input_tokens   INTEGER     NOT NULL DEFAULT 0,
    output_tokens  INTEGER     NOT NULL DEFAULT 0,
    ai_actions     INTEGER     NOT NULL DEFAULT 0,
    credits        INTEGER     NOT NULL DEFAULT 0,
    billable_eur   NUMERIC(12,6) NOT NULL DEFAULT 0,
    raw_cost_eur   NUMERIC(12,6) NOT NULL DEFAULT 0,
    billed_as      VARCHAR(12) NOT NULL DEFAULT 'quota',  -- quota | payg
    status         VARCHAR(20) NOT NULL DEFAULT 'accepted',
    audit_hash     CHAR(64),                       -- hash del registro en la cadena de auditoría
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_operant_tasks_app_period ON operant_tasks(app_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operant_tasks_tenant ON operant_tasks(tenant_id, created_at);

-- Anclas merkle de la cadena de auditoría. `tx_hash` nulo = calculada pero
-- todavía no confirmada on-chain (la cadena puede estar caída; el ancla no se
-- pierde y se reintenta).
CREATE TABLE IF NOT EXISTS operant_audit_anchors (
    id            BIGSERIAL PRIMARY KEY,
    app_id        UUID        NOT NULL REFERENCES app_registry(id) ON DELETE CASCADE,
    tenant_id     VARCHAR(80) NOT NULL,
    merkle_root   CHAR(66)    NOT NULL,            -- 0x + 64 hex
    leaf_count    INTEGER     NOT NULL,
    first_hash    CHAR(64),
    last_hash     CHAR(64),
    period_start  TIMESTAMPTZ NOT NULL,
    period_end    TIMESTAMPTZ NOT NULL,
    tx_hash       VARCHAR(66),
    chain_id      INTEGER,
    block_number  BIGINT,
    anchored_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operant_anchors_tenant ON operant_audit_anchors(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_operant_anchors_root ON operant_audit_anchors(tenant_id, merkle_root);
