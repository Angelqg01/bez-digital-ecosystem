-- OPERANT · esquema inicial (multi-tenant con Row-Level Security)
--
-- Dos clases de tabla, con reglas distintas a propósito:
--
--   1. PLANO DE DATOS (tasks, interactions, facts, audit_log, approvals):
--      contenido de cada empresa cliente. Llevan tenant_id + RLS FORZADA.
--
--   2. PLANO DE CONTROL (tenants, api_keys): el inventario que el proceso lee
--      AL ARRANCAR, antes de saber a qué tenant sirve. No pueden llevar RLS por
--      tenant — la rehidratación necesita verlas todas — y no contienen datos de
--      cliente: plan, departamentos y hashes de clave (nunca la clave en claro).
--
-- FORCE ROW LEVEL SECURITY no es decorativo: la aplicación se conecta con el
-- MISMO rol que crea las tablas (PG_USER, dueño del esquema) y Postgres exime
-- al dueño de sus propias políticas salvo que se fuerce. Sin FORCE, la RLS de
-- este fichero no aislaría absolutamente nada.
--
-- Sin claves foráneas a tenants(id) a propósito: la persistencia es best-effort
-- (ver Orchestrator._persistTask / HITLGate._persist) y una fila de inventario
-- que falte nunca debe tumbar la durabilidad de una tarea o de una aprobación
-- pendiente. Una fila huérfana es un problema menor; perder el rastro de una
-- acción que espera al humano, no. Mismo criterio que SqliteStore, que tampoco
-- las declara: los tres adaptadores deben comportarse igual.

-- ── Plano de control ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id            TEXT PRIMARY KEY,
  plan          TEXT NOT NULL DEFAULT 'starter',
  departments   JSONB NOT NULL DEFAULT '[]'::jsonb,
  business_id   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  tenant_id     TEXT PRIMARY KEY,
  key_hash      TEXT NOT NULL UNIQUE
);

-- ── Plano de datos ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  type          TEXT,
  department    TEXT,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL,
  error         TEXT,
  result        JSONB,
  -- Con DEFAULT: el orden del historial nunca depende de que quien escribe se
  -- acuerde de poner la fecha. El listado del panel ordena por esta columna.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approvals (
  approval_id   TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  agent_id      TEXT,
  action        JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);

-- embedding VECTOR(768): dimensión de `nomic-embed-text`, el modelo de
-- embeddings del stack soberano (cognition/providers/ollama.js). pgvector exige
-- una dimensión fija por columna, así que este número y el modelo van atados:
-- cambiar de modelo obliga a `ALTER TABLE interactions ALTER COLUMN embedding
-- TYPE vector(<dims>)` y a fijar EMBEDDING_DIMS. PostgresStore.connect() lo
-- comprueba al arrancar y falla con el ALTER exacto si no cuadran, en vez de
-- dejar que reviente en la primera escritura de memoria.
CREATE TABLE IF NOT EXISTS interactions (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  agent_id      TEXT,
  summary       TEXT,
  outcome       TEXT,
  embedding     VECTOR(768),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  event         TEXT NOT NULL,
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Índices de las consultas reales del código ──────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tasks_tenant     ON tasks (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_appr_tenant      ON approvals (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_inter_tenant     ON interactions (tenant_id, agent_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_ts  ON audit_log (tenant_id, ts DESC);

-- ── Row-Level Security del plano de datos ───────────────────────────────────
-- Cada conexión fija app.tenant_id dentro de la transacción (PostgresStore.
-- _withTenant). Sin fijarlo, current_setting(...) devuelve NULL, la comparación
-- da NULL y no se ve ni se escribe NADA: falla cerrado, que es como debe fallar.

ALTER TABLE tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks        FORCE  ROW LEVEL SECURITY;
ALTER TABLE approvals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals    FORCE  ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions FORCE  ROW LEVEL SECURITY;
ALTER TABLE audit_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log    FORCE  ROW LEVEL SECURITY;

-- DROP + CREATE (en vez de CREATE POLICY a secas) para que el fichero se pueda
-- reaplicar con `npm run db:migrate` sobre una base ya creada.
DROP POLICY IF EXISTS tenant_isolation_tasks ON tasks;
CREATE POLICY tenant_isolation_tasks ON tasks
  USING (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_approvals ON approvals;
CREATE POLICY tenant_isolation_approvals ON approvals
  USING (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_interactions ON interactions;
CREATE POLICY tenant_isolation_interactions ON interactions
  USING (tenant_id = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_audit ON audit_log;
CREATE POLICY tenant_isolation_audit ON audit_log
  USING (tenant_id = current_setting('app.tenant_id', true));
