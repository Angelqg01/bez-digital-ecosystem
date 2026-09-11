-- 057_telemetry_and_episodes.sql
--
-- Telemetría de uso y episodios de servicio, con las tres capas separadas.
--
-- ═════════════════════════════════════════════════════════════════════════════
--  MARCO LEGAL — RGPD (UE) 2016/679 y LOPDGDD 3/2018
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Esto NO es una tabla de logs. Es un tratamiento de datos personales con su
-- finalidad, su base jurídica y su plazo, y el esquema está construido para que
-- esas tres cosas sean verificables mirando la tabla, no confiando en un
-- documento aparte.
--
-- Documento de referencia, con el registro de actividades del art. 30, la
-- evaluación de interés legítimo y el texto para el contrato:
-- docs/PRIVACIDAD_TELEMETRIA.md
--
-- LAS TRES CAPAS Y POR QUÉ NO PUEDEN SER UNA
--
--   1. OPERACIONAL — el contenido de las llamadas. NO SE CREA NINGUNA TABLA
--      AQUÍ: ese dato vive donde ya vivía, para prestar el servicio y nada más
--      (art. 6.1.b, ejecución del contrato, y art. 28 cuando es del ERP del
--      cliente). Que esta migración no lo toque es la primera garantía.
--
--   2. TELEMETRÍA (`agent_telemetry`) — qué herramienta, con qué FORMA de
--      argumento, latencia, error, reintento, aprobación. Sin contenido.
--      Base jurídica: interés legítimo (art. 6.1.f) para mejorar el servicio,
--      con oposición disponible (art. 21). Plazo: 90 días.
--
--   3. EPISODIOS (`cs_episodes`) — telemetría agregada + intención inferida +
--      resolución, seudonimizada (art. 4.5). Es el conjunto de evaluación con
--      el que se mide si el servicio automatizado mejora. Plazo: 24 meses.
--
-- LA REGLA QUE HACE ESTO DEFENDIBLE
--
-- La capa 1 nunca alimenta la 3 sin pasar por seudonimización. Si un episodio no
-- sobrevive a ese borrado, es que no era un episodio: era el dato del cliente.
-- Por eso `cs_episodes` NO TIENE ninguna columna de texto libre donde quepa
-- contenido — una columna que no existe no se rellena en un parche futuro.
--
-- MINIMIZACIÓN NO ES UNA BUENA INTENCIÓN, ES UNA COLUMNA QUE NO ESTÁ
--
-- No hay `payload`, ni `request_body`, ni `response`, ni `prompt`, ni `mensaje`.
-- Lo que se guarda de los argumentos es su FORMA: nombres de campo y tipos, no
-- valores. Ver services/episodeAnonymizer.js.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
--  CAPA 2 — Telemetría de uso. 90 días.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_telemetry (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Seudónimo estable del inquilino, NO su identificador real (art. 4.5).
    -- Se deriva con HMAC de una clave que no está en esta base: quien vuelque
    -- la tabla no puede revertirlo a un cliente sin esa clave.
    tenant_seudonimo    CHAR(32) NOT NULL,

    canal               TEXT NOT NULL CHECK (canal IN ('mcp', 'rest', 'cli')),
    herramienta         TEXT NOT NULL,
    plan                TEXT,

    -- FORMA de los argumentos, no su contenido: {"amount":"numero","from":"enum"}.
    forma_argumentos    JSONB NOT NULL DEFAULT '{}'::jsonb,

    resultado           TEXT NOT NULL CHECK (resultado IN ('ok', 'error_cliente', 'error_servidor', 'denegado')),
    codigo_error        TEXT,
    latencia_ms         INTEGER,

    -- Señales de producto: lo que de verdad se quiere aprender.
    reintento           BOOLEAN NOT NULL DEFAULT FALSE,
    requirio_aprobacion BOOLEAN NOT NULL DEFAULT FALSE,
    aprobacion_resuelta TEXT CHECK (aprobacion_resuelta IN ('aprobada', 'rechazada', 'caducada')),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- El plazo va EN LA FILA, no sólo en un proceso que puede pararse. Una fila
    -- sin fecha de borrado es una fila que se queda para siempre.
    purgar_despues_de   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_purga ON agent_telemetry (purgar_despues_de);
CREATE INDEX IF NOT EXISTS idx_telemetry_tenant ON agent_telemetry (tenant_seudonimo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_herramienta ON agent_telemetry (herramienta, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
--  CAPA 3 — Episodios de servicio. 24 meses.
--
--  Lo que se aprende de aquí no es un modelo entrenado con datos de clientes:
--  son huecos de catálogo, descripciones mal escritas, flujos que merecen
--  empaquetarse y aprobaciones que siempre se rechazan. Mejoras de prompt,
--  skill, catálogo y documentación, medidas contra un conjunto de evaluación.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cs_episodes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Seudónimo de SECTOR, no de inquilino: a este nivel ya no interesa quién
    -- fue, sino qué tipo de empresa. Un paso más de agregación.
    sector              TEXT,
    plan                TEXT,

    intencion           TEXT NOT NULL,
    herramientas        TEXT[] NOT NULL DEFAULT '{}',
    turnos              SMALLINT NOT NULL DEFAULT 1,

    resolucion          TEXT NOT NULL CHECK (resolucion IN (
                            'resuelto', 'sin_herramienta', 'error_repetido',
                            'abandonado', 'escalado_humano'
                        )),
    -- La señal de producto más valiosa que existe: qué pidieron que no tenemos.
    hueco_detectado     TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    purgar_despues_de   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_episodes_purga ON cs_episodes (purgar_despues_de);
CREATE INDEX IF NOT EXISTS idx_episodes_resolucion ON cs_episodes (resolucion, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_hueco ON cs_episodes (hueco_detectado)
    WHERE hueco_detectado IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
--  Oposición al tratamiento (art. 21 RGPD)
--
--  El derecho de oposición tiene que poder ejercerse de forma tan sencilla como
--  se recoge el dato, así que es una fila y un interruptor, no un formulario de
--  soporte. Se guarda la FECHA además del booleano: ante una reclamación hay
--  que poder acreditar desde cuándo se dejó de tratar.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS telemetry_preferences (
    app_id              UUID PRIMARY KEY REFERENCES app_registry(id) ON DELETE CASCADE,
    telemetria          BOOLEAN NOT NULL DEFAULT TRUE,
    episodios           BOOLEAN NOT NULL DEFAULT TRUE,
    opuesto_at          TIMESTAMPTZ,
    actualizado_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_telemetry IS
    'Capa 2. Interés legítimo art. 6.1.f, oposición art. 21. Sin contenido de las llamadas. Purga a 90 días.';
COMMENT ON TABLE cs_episodes IS
    'Capa 3. Seudonimizada art. 4.5, agregada por sector. Sin texto libre del cliente. Purga a 24 meses.';
COMMENT ON TABLE telemetry_preferences IS
    'Ejercicio del derecho de oposición (art. 21 RGPD) por api-key.';
COMMENT ON COLUMN agent_telemetry.tenant_seudonimo IS
    'HMAC del app_id con clave fuera de esta base: no reversible desde un volcado.';
