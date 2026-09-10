-- 054_erp_connections.sql
--
-- Conexiones gestionadas con el ERP del cliente (modo B del documento de
-- estrategia). Una fila por sistema conectado.
--
-- LO QUE ESTA TABLA CAMBIA PARA BEZHAS
--
-- Hasta ahora custodiábamos datos que el cliente nos manda. A partir de aquí
-- guardamos credenciales para ENTRAR NOSOTROS en su sistema, lo que nos
-- convierte en encargado de tratamiento de su base de datos. Eso no es una
-- decisión técnica y por eso la tabla lo hace explícito:
--
--   · `dpa_firmado_at` es NOT NULL en la práctica: el servicio se niega a
--     activar una conexión sin él. Se guarda la fecha, no un booleano, porque
--     lo que hay que poder demostrar es CUÁNDO.
--   · `alcance_campos` es la lista de campos que una persona aprobó. Vacía
--     significa «todos los canónicos», y sólo se llega a eso aprobándolo
--     explícitamente en la pantalla.
--   · `activa` empieza en FALSE. Dar de alta una conexión no es encenderla.
--
-- LAS CREDENCIALES VAN CIFRADAS
--
-- `credenciales_cifradas` guarda el JSON cifrado con services/secretVault
-- (AES-256-GCM, formato v1:iv:tag:ct). Nunca se devuelven por ninguna ruta, ni
-- enmascaradas: lo que se devuelve es qué campos hay puestos, no su valor.
--
-- POR QUÉ LA URL BASE ESTÁ APARTE Y NO DENTRO DEL JSON CIFRADO
--
-- Porque hay que poder auditarla sin descifrar nada. Es el destino al que se
-- conecta nuestro servidor, así que interesa poder listar de un vistazo a qué
-- hosts sale la plataforma. Ver services/erp/httpGuard.js: además se vuelve a
-- validar en cada uso, no sólo al darla de alta.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS erp_connections (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    app_id                  UUID NOT NULL REFERENCES app_registry(id) ON DELETE CASCADE,
    org_id                  UUID,

    erp                     TEXT NOT NULL CHECK (erp IN (
                                'sap_s4hana', 'sap_b1', 'odoo', 'dynamics', 'netsuite'
                            )),
    nombre                  TEXT NOT NULL,
    base_url                TEXT NOT NULL,

    credenciales_cifradas   TEXT,

    -- Campos canónicos que una persona autorizó a salir del ERP.
    alcance_campos          TEXT[] NOT NULL DEFAULT '{}',

    -- Tipos que esta conexión puede escribir. Vacío = solo lectura, que es el
    -- estado por defecto y el que debería quedarse la mayoría.
    tipos_escritura         TEXT[] NOT NULL DEFAULT '{}',

    modo                    TEXT NOT NULL DEFAULT 'gestionado'
                                CHECK (modo IN ('gestionado', 'agente')),

    activa                  BOOLEAN NOT NULL DEFAULT FALSE,
    dpa_firmado_at          TIMESTAMPTZ,

    ultima_prueba_at        TIMESTAMPTZ,
    ultima_prueba_ok        BOOLEAN,
    ultimo_error            TEXT,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una app no puede tener dos conexiones con el mismo nombre: el nombre es lo
-- que la persona ve en la pantalla y lo que el agente menciona al hablar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_connections_app_nombre
    ON erp_connections (app_id, nombre);

CREATE INDEX IF NOT EXISTS idx_erp_connections_app
    ON erp_connections (app_id) WHERE activa = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
--  Escrituras hacia el ERP, con su clave de idempotencia.
--
--  Al otro lado hay un agente, y un agente reintenta. Esta tabla es lo que hace
--  que el segundo intento devuelva el resultado del primero en vez de crear una
--  segunda factura en la contabilidad del cliente. El índice único sobre
--  (conexión, clave) es la garantía real; el adaptador comprueba además contra
--  el propio ERP porque el reintento puede llegar de otro proceso.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS erp_write_log (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id       UUID NOT NULL REFERENCES erp_connections(id) ON DELETE CASCADE,
    idempotency_key     TEXT NOT NULL,
    tipo                TEXT NOT NULL,

    -- Huella del contenido, no el contenido. Sirve para detectar que alguien
    -- reusó la misma clave con datos distintos —que es un error del llamante,
    -- no un reintento— sin guardar aquí datos del ERP del cliente.
    payload_sha256      CHAR(64) NOT NULL,

    estado              TEXT NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente', 'aplicado', 'fallido')),
    documento_id        TEXT,
    error               TEXT,

    approval_id         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_write_idempotencia
    ON erp_write_log (connection_id, idempotency_key);

COMMENT ON TABLE erp_connections IS
    'Conexiones gestionadas con el ERP del cliente. Credenciales cifradas; exige DPA firmado para activarse.';
COMMENT ON TABLE erp_write_log IS
    'Escrituras hacia el ERP con clave de idempotencia. El índice único evita que un reintento duplique el documento.';
