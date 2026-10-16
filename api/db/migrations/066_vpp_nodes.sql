-- 066_vpp_nodes.sql
--
-- Registro de nodos VPP propios de cada titular («conectar mi planta»).
-- Hasta ahora GET /api/energy/nodes devolvía una lista fija de cinco nodos de demostración para todos los usuarios y la
-- telemetría real sólo entraba por MQTT con claves de dispositivo. Cada nodo tiene su propia clave (bzn_…, sólo se guarda
-- el hash) para enviar lecturas por HTTPS a POST /api/energy/telemetry/ingest, que las deja en telemetry_logs.

CREATE TABLE IF NOT EXISTS vpp_nodes (
    id               TEXT        PRIMARY KEY,
    owner_bezhas_id  TEXT        NOT NULL,
    name             TEXT        NOT NULL,
    type             TEXT        NOT NULL CHECK (type IN ('SOLAR', 'WIND', 'HYDRO', 'BATTERY', 'LOAD')),
    location         TEXT,
    capacity_kw      NUMERIC(14, 2) NOT NULL CHECK (capacity_kw > 0),
    protocol         TEXT        NOT NULL DEFAULT 'HTTPS',
    status           TEXT        NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
    key_hash         TEXT        NOT NULL UNIQUE,
    last_seen        TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vpp_nodes_owner ON vpp_nodes (owner_bezhas_id, status);
