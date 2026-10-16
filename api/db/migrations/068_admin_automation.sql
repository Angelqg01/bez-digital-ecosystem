-- 068_admin_automation.sql
--
-- Registro de las automatizaciones del panel SuperAdmin con OPERANT.
--
-- Cada fila es una acción que ocurrió: una tarea lanzada a OPERANT, una
-- aprobación resuelta desde el panel o una sincronización del RAG. Sirve para
-- dos cosas: auditar quién hizo qué (actor = el admin o 'scheduler') y evitar
-- duplicados (una misma señal no vuelve a crear la misma tarea durante el
-- periodo de enfriamiento).
--
-- `detail` guarda solo agregados y ids: nada de contenido de clientes ni de
-- correos. La huella (`fingerprint`) es un hash de las métricas que motivaron
-- la acción, no las métricas en sí.

CREATE TABLE IF NOT EXISTS admin_automation_runs (
    id            BIGSERIAL PRIMARY KEY,
    kind          VARCHAR(20)  NOT NULL CHECK (kind IN ('run', 'resolve', 'kb_sync')),
    automation_id VARCHAR(60),
    fingerprint   CHAR(64),
    actor         VARCHAR(120) NOT NULL,
    status        VARCHAR(20)  NOT NULL,
    task_id       VARCHAR(80),
    detail        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_automation_runs_recent
    ON admin_automation_runs (automation_id, created_at DESC);
