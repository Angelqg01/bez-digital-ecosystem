-- OPERANT · pone al día las bases creadas ANTES de completar PostgresStore.
--
-- No hace falta en una base nueva: 001/002 ya la dejan correcta y este fichero
-- se queda en no-op. Existe para las bases de desarrollo creadas con el esquema
-- viejo, donde el initdb de Postgres no vuelve a ejecutarse (solo corre en el
-- primer arranque del volumen). Aplicable con `npm run db:migrate`.
--
-- Corrige tres cosas del esquema original:
--   1. Faltaban columnas que el Store necesita (departamentos y perfil de
--      negocio del tenant, error/updated_at de la tarea).
--   2. embedding era VECTOR(1536) — dimensión de un modelo que este proyecto
--      no usa. El modelo real (nomic-embed-text) produce 768, así que la
--      primera escritura de memoria con vector habría fallado siempre.
--   3. Claves foráneas a tenants(id) que podían tumbar la persistencia de una
--      tarea o una aprobación por una fila de inventario ausente (ver 001).

-- ── 1. Columnas que faltaban ────────────────────────────────────────────────

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS departments JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_id TEXT;

ALTER TABLE tasks   ADD COLUMN IF NOT EXISTS error      TEXT;
ALTER TABLE tasks   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE tasks SET payload = '{}'::jsonb WHERE payload IS NULL;
ALTER TABLE tasks ALTER COLUMN payload SET DEFAULT '{}'::jsonb;
ALTER TABLE tasks ALTER COLUMN payload SET NOT NULL;

UPDATE tasks SET created_at = updated_at WHERE created_at IS NULL;
ALTER TABLE tasks ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE tasks ALTER COLUMN created_at SET NOT NULL;

UPDATE audit_log SET data = '{}'::jsonb WHERE data IS NULL;
ALTER TABLE audit_log ALTER COLUMN data SET DEFAULT '{}'::jsonb;
ALTER TABLE audit_log ALTER COLUMN data SET NOT NULL;

-- ── 2. Dimensión del vector de embeddings ───────────────────────────────────
-- Los embeddings son caché derivada, no la fuente de la verdad: el texto de la
-- interacción sigue ahí y el vector se recalcula al rehidratar. Por eso se
-- pueden vaciar para poder cambiar el tipo de columna.

DO $$
DECLARE actual TEXT;
BEGIN
  SELECT format_type(atttypid, atttypmod) INTO actual
    FROM pg_attribute
   WHERE attrelid = 'interactions'::regclass AND attname = 'embedding' AND NOT attisdropped;

  IF actual IS NOT NULL AND actual <> 'vector(768)' THEN
    RAISE NOTICE 'interactions.embedding era % — se vacía y se convierte a vector(768)', actual;
    UPDATE interactions SET embedding = NULL WHERE embedding IS NOT NULL;
    ALTER TABLE interactions ALTER COLUMN embedding TYPE vector(768);
  END IF;
END $$;

-- ── 3. Claves foráneas heredadas ────────────────────────────────────────────

ALTER TABLE tasks        DROP CONSTRAINT IF EXISTS tasks_tenant_id_fkey;
ALTER TABLE interactions DROP CONSTRAINT IF EXISTS interactions_tenant_id_fkey;

-- ── 4. Índices del esquema viejo que 001 sustituye por otros mejores ────────

DROP INDEX IF EXISTS idx_interactions_tenant_agent;
