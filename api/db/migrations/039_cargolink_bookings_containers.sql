-- Migration 039: booking (TX002) y contenedor (TX003).
--
-- Los dos últimos eventos de prioridad Alta que quedaban sin modelar.
--
-- ── Booking ─────────────────────────────────────────────────────────────────
-- En la operación real el booking PRECEDE al envío: el cargador reserva
-- capacidad en un buque y sólo después entrega la mercancía. Hasta ahora el
-- ciclo empezaba en CREATED, es decir, con el envío ya existiendo — se perdía
-- el compromiso de capacidad, que es justo lo que se discute cuando hay
-- sobreventa o un no-show.
--
-- Un booking puede cubrir VARIOS envíos (consolidación de carga suelta en un
-- mismo contenedor), de ahí que la relación sea 1:N y no un campo en el envío.
--
-- ── Contenedor ──────────────────────────────────────────────────────────────
-- Hasta ahora el contenedor era texto libre dentro del jsonb `cargo`. Un
-- contenedor es un ACTIVO reutilizable: el mismo equipo hace decenas de viajes
-- para dueños distintos, y su historial (precintos, incidencias, inspecciones)
-- pertenece al contenedor, no al envío de turno.
--
-- El número sigue la norma ISO 6346, que incluye dígito de control calculable.
-- Validarlo permite rechazar una errata de teclado antes de que llegue a la
-- cadena, donde ya no se corrige.

CREATE TABLE IF NOT EXISTS cargolink_bookings (
    id                SERIAL PRIMARY KEY,
    booking_ref       VARCHAR(48)  NOT NULL UNIQUE,   -- referencia del transportista
    carrier_bezhas_id VARCHAR(50)  NOT NULL,
    shipper_bezhas_id VARCHAR(50)  NOT NULL,
    vessel            VARCHAR(80),
    voyage            VARCHAR(40),
    pol               VARCHAR(64)  NOT NULL,          -- puerto de carga
    pod               VARCHAR(64)  NOT NULL,          -- puerto de descarga
    -- Capacidad comprometida. `teu_used` sube al asignar envíos y el servicio
    -- impide sobrepasar `teu_booked`: sin eso el booking no compromete nada.
    teu_booked        NUMERIC(8,2) NOT NULL,
    teu_used          NUMERIC(8,2) NOT NULL DEFAULT 0,
    -- Cut-offs: pasados estos instantes el booking ya no admite carga. Son la
    -- base de la penalización por no-show que describe el análisis.
    doc_cutoff        TIMESTAMPTZ,
    cargo_cutoff      TIMESTAMPTZ,
    freight_rate_eur  NUMERIC(14,2),
    status            VARCHAR(20)  NOT NULL DEFAULT 'CONFIRMED',  -- CONFIRMED | AMENDED | CANCELLED | EXPIRED | CLOSED
    no_show           BOOLEAN      NOT NULL DEFAULT FALSE,
    evidence_hash     CHAR(66),
    anchor_mode       VARCHAR(32)  NOT NULL DEFAULT 'pending',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_bookings_carrier
    ON cargolink_bookings (carrier_bezhas_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cargolink_containers (
    id                SERIAL PRIMARY KEY,
    container_no      VARCHAR(11)  NOT NULL UNIQUE,   -- ISO 6346: 4 letras + 7 dígitos
    iso_type          VARCHAR(8),                     -- 22G1, 42R1(reefer), 45G1...
    category          VARCHAR(16)  NOT NULL DEFAULT 'DRY',  -- DRY | REEFER | TANK | OPEN_TOP | FLAT_RACK
    tare_kg           INTEGER,
    max_payload_kg    INTEGER,
    owner_bezhas_id   VARCHAR(50),
    -- Estado del activo, no del envío: un contenedor DAMAGED no puede
    -- asignarse aunque el envío esté listo.
    status            VARCHAR(16)  NOT NULL DEFAULT 'AVAILABLE',  -- AVAILABLE | IN_USE | DAMAGED | RETIRED
    last_seen_location VARCHAR(120),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Asignación contenedor ↔ envío. Es una tabla propia y no una columna porque
-- un contenedor pasa por muchos envíos y un envío puede llevar varios
-- contenedores (carga fraccionada).
CREATE TABLE IF NOT EXISTS cargolink_container_assignments (
    id              SERIAL PRIMARY KEY,
    container_id    INTEGER      NOT NULL REFERENCES cargolink_containers(id),
    b_uid           VARCHAR(64)  NOT NULL,
    booking_id      INTEGER      REFERENCES cargolink_bookings(id),
    seal_no         VARCHAR(32),
    gross_weight_kg INTEGER,
    assigned_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    released_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_container_assignments_buid
    ON cargolink_container_assignments (b_uid);
-- Un contenedor no puede estar en dos envíos a la vez. El índice parcial lo
-- garantiza en la base de datos, no sólo en el servicio.
CREATE UNIQUE INDEX IF NOT EXISTS idx_container_single_active
    ON cargolink_container_assignments (container_id) WHERE released_at IS NULL;

ALTER TABLE cargolink_transactions
    ADD COLUMN IF NOT EXISTS booking_id INTEGER REFERENCES cargolink_bookings(id);
