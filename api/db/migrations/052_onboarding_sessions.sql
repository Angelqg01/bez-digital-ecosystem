-- 052_onboarding_sessions.sql
--
-- Sesiones de alta y despliegue asistidos por IA.
--
-- POR QUÉ EXISTE ESTA TABLA
--
-- El MCP público (routes/mcp-public.js) lo llama gente que TODAVÍA NO ES
-- CLIENTE: no tiene api-key, ni organización, ni scopes. Sus herramientas no
-- dan de alta a nadie ni tocan datos de negocio; lo único que hacen es crear
-- una fila aquí y devolver una URL. Todo lo que importa —aceptar condiciones,
-- escribir un IBAN, recoger una credencial— ocurre en la pantalla alojada que
-- cuelga de esa URL, delante de una persona.
--
-- Es decir: esta tabla es la frontera entre lo que un agente puede hacer solo
-- y lo que exige un humano.
--
-- EL TOKEN SE GUARDA HASHEADO
--
-- La URL ES la credencial: quien la tiene, continúa la sesión. Guardar el token
-- en claro convertiría una lectura de esta tabla en la capacidad de retomar el
-- alta de otro —y en el flujo de banco, de ver el formulario con sus datos
-- precargados—. Se guarda el SHA-256, igual que en app_registry, y la búsqueda
-- va por el hash. Un volcado de la tabla no permite continuar ninguna sesión.
--
-- QUÉ NO PUEDE ENTRAR EN `prefill`
--
-- Sólo datos que no pasa nada porque estén escritos en un chat: razón social,
-- sector, país, número de empleados, ERP, plan sugerido. Los llena el agente a
-- partir de la conversación, así que YA han pasado por el modelo del cliente.
--
-- Lo sensible NO se guarda aquí ni llega aquí: número de cuenta, credenciales
-- del ERP, api-keys y claves privadas de nodo no viajan por el MCP en ningún
-- sentido. Se introducen en la pantalla y van a su destino —proveedor de pagos,
-- almacén de secretos, la máquina del cliente—, no a esta fila. La comprobación
-- vive en services/onboardingSession.js, que rechaza un prefill con claves
-- prohibidas en lugar de confiar en que nadie las mande.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS onboarding_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- SHA-256 en hexadecimal del token que va en la URL. Nunca el token.
    token_hash      CHAR(64) NOT NULL UNIQUE,

    -- Qué flujo es. Cerrado a propósito: una sesión sin tipo conocido no sabría
    -- qué pantalla servir, y añadir un tipo debe ser un cambio deliberado.
    kind            TEXT NOT NULL CHECK (kind IN (
                        'signup', 'sdk_install', 'erp_integration',
                        'node_provision', 'bank_setup'
                    )),

    -- Datos NO sensibles que el agente ya conoce, para que la persona no los
    -- reescriba. Ver arriba qué no puede entrar aquí.
    prefill         JSONB NOT NULL DEFAULT '{}'::jsonb,

    status          TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN (
                        'pendiente', 'en_curso', 'completado', 'caducado', 'cancelado'
                    )),
    step            TEXT,

    -- Rellenos cuando la sesión la crea un cliente ya autenticado (instalar el
    -- SDK, conectar el ERP, levantar un nodo) en vez de un desconocido.
    app_id          UUID REFERENCES app_registry(id) ON DELETE SET NULL,
    org_id          UUID,

    -- Para el limitador y para investigar un abuso. La IP es dato personal:
    -- la barre el mismo proceso que caduca las sesiones.
    source_ip       INET,
    user_agent      TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ
);

-- La búsqueda por token_hash —la de cada petición de la pantalla alojada— ya
-- va indexada por la restricción UNIQUE de la columna. Un índice explícito
-- encima sería un segundo árbol que mantener en cada escritura sin ganar nada.

-- Barrido de caducadas.
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_expira
    ON onboarding_sessions (expires_at)
    WHERE status IN ('pendiente', 'en_curso');

-- Cuántas sesiones ha abierto una IP en la última hora. Es el contador que
-- sostiene el límite del canal anónimo, así que necesita índice propio.
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_ip_reciente
    ON onboarding_sessions (source_ip, created_at DESC);

COMMENT ON TABLE onboarding_sessions IS
    'Sesiones de alta/despliegue asistidas por IA. El token va hasheado; el prefill nunca contiene datos sensibles.';
