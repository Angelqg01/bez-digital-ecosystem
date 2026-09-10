-- 055_credential_issuance.sql
--
-- Cierra el bucle del onboarding asistido: hasta ahora una sesión llevaba a una
-- pantalla que explicaba los pasos, pero la pantalla no ENTREGABA nada. Faltaba
-- lo único que el cliente se lleva de ahí: la credencial del SDK y el token de
-- registro del nodo.
--
-- DOS COSAS SE EMITEN Y NINGUNA VUELVE POR EL MCP
--
-- Es la misma regla de todo este trabajo, y aquí es donde se hace efectiva: lo
-- que se emite se enseña UNA VEZ en el navegador de la persona y se guarda
-- hasheado. El agente sabe que la sesión pasó a «completado» y nada más. Si la
-- clave volviera por la herramienta acabaría en el contexto del modelo y en el
-- historial del chat, y daría igual lo bien hecho que estuviera el resto.
--
-- ─────────────────────────────────────────────────────────────────────────────
--  app_registry.derived_from — por qué instalar el SDK NO rota la clave
-- ─────────────────────────────────────────────────────────────────────────────
--
-- La reacción natural a «dame credenciales para instalar el SDK» es rotar la
-- clave de la app. Sería un error: el cliente está instalando en OTRA máquina,
-- y rotar dejaría sin autenticar la integración que ya tiene funcionando, sin
-- avisar y en el peor momento.
--
-- En su lugar se crea una entrada DERIVADA: mismos permisos y mismo titular que
-- la original, clave propia y revocable por separado. Una instalación
-- comprometida se corta sola sin tocar las demás, que es justo lo que no se
-- puede hacer cuando todas comparten clave.

ALTER TABLE app_registry
    ADD COLUMN IF NOT EXISTS derived_from UUID REFERENCES app_registry(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_app_registry_derived
    ON app_registry (derived_from) WHERE derived_from IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
--  Nodos del cliente
--
--  LA CLAVE PRIVADA NO ESTÁ AQUÍ Y NO PUEDE ESTARLO. El nodo genera su par al
--  arrancar en la máquina del cliente y nos manda SOLO la pública. Esta tabla
--  no tiene columna donde guardar una privada, y eso es deliberado: una columna
--  que no existe no se rellena por descuido en un parche futuro.
--
--  `registration_token_hash` es un vale de un solo uso, igual que el de las
--  sesiones de onboarding: se enseña una vez en la pantalla, se guarda hasheado
--  y se consume al registrar. Si viajara por el chat quedaría en el historial.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_nodes (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id                  UUID NOT NULL REFERENCES app_registry(id) ON DELETE CASCADE,

    tipo                    TEXT NOT NULL CHECK (tipo IN ('edge', 'enterprise')),
    entorno                 TEXT NOT NULL DEFAULT 'sandbox' CHECK (entorno IN ('sandbox', 'produccion')),
    nombre                  TEXT NOT NULL,

    registration_token_hash CHAR(64) UNIQUE,
    token_expira_at         TIMESTAMPTZ,

    -- Sólo la pública. Ver arriba.
    public_key              TEXT,
    version                 TEXT,

    estado                  TEXT NOT NULL DEFAULT 'pendiente'
                                CHECK (estado IN ('pendiente', 'registrado', 'revocado', 'caducado')),

    registrado_at           TIMESTAMPTZ,
    ultimo_contacto_at      TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_nodes_app ON client_nodes (app_id);
CREATE INDEX IF NOT EXISTS idx_client_nodes_pendientes
    ON client_nodes (token_expira_at) WHERE estado = 'pendiente';

COMMENT ON TABLE client_nodes IS
    'Nodos edge/enterprise de clientes. Sólo se guarda la clave PÚBLICA: la privada se genera y se queda en la máquina del cliente.';
COMMENT ON COLUMN app_registry.derived_from IS
    'Entrada de la que deriva esta clave. Permite revocar una instalación sin tocar las demás.';
