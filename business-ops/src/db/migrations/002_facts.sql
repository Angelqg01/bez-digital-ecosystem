-- OPERANT · memoria semántica (hechos/perfiles acumulados por tenant).
-- Clave compuesta (tenant_id, key): un hecho por clave y empresa cliente.
--
-- Es plano de datos: lleva RLS forzada como el resto (ver cabecera de 001).
-- Aquí viven cosas como el perfil de negocio, la KB, la cuota consumida y el
-- coste acumulado — precisamente lo que no puede cruzarse entre clientes.

CREATE TABLE IF NOT EXISTS facts (
  tenant_id   TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, key)
);

ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_facts ON facts;
CREATE POLICY tenant_isolation_facts ON facts
  USING (tenant_id = current_setting('app.tenant_id', true));
