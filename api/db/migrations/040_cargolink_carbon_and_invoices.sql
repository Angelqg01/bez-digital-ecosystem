-- Migration 040: certificado ESG por envío (TX019), factura (TX016) y
-- obligación de pago (TX017) en el dominio logístico.
--
-- ── Por qué el ESG del envío no es el ESG de la empresa ─────────────────────
-- ESGScoreOracle ya existe y puntúa EMPRESAS (env/soc/gov, 0-100). Eso es
-- scoring corporativo. Lo que el piloto de Algeciras pide en TX019 es otra
-- cosa: la huella de una OPERACIÓN concreta, que es lo que un cargador
-- necesita para su propio informe de alcance 3.
--
-- Los dos se relacionan —la suma de envíos alimenta el score corporativo— pero
-- no son el mismo objeto y meterlos en la misma tabla habría mezclado una
-- medida por operación con una calificación por entidad.
--
-- ── Factores de emisión ─────────────────────────────────────────────────────
-- Se guardan en tabla y no en código porque son un parámetro regulatorio que
-- cambia: GLEC Framework e ISO 14083 los revisan, y un certificado emitido en
-- 2026 debe poder explicar con qué factor se calculó aunque en 2028 sea otro.
-- Por eso cada certificado guarda el factor aplicado, no sólo el resultado.
--
-- ── Factura y obligación de pago ────────────────────────────────────────────
-- Existían en el gateway de pagos, pero no en el dominio logístico: no había
-- forma de emitir una factura de flete con sus recargos ni de vincular el
-- cobro a la entrega. La obligación nace de un HECHO verificable (la entrega
-- confirmada), que es lo que permite automatizarla.

-- ── Factores de emisión por modo de transporte ──────────────────────────────
CREATE TABLE IF NOT EXISTS cargolink_emission_factors (
    id              SERIAL PRIMARY KEY,
    mode            VARCHAR(24)  NOT NULL,        -- SEA_CONTAINER | ROAD_TRUCK | RAIL | AIR | INLAND_WATERWAY
    subtype         VARCHAR(40),                  -- p.ej. tamaño de buque o clase de camión
    -- gramos de CO2 equivalente por tonelada-kilómetro. Es la unidad del
    -- sector: permite comparar modos y sumar tramos de una misma cadena.
    gco2e_per_tkm   NUMERIC(10,3) NOT NULL,
    source          VARCHAR(80)  NOT NULL,        -- GLEC_v3 | ISO_14083 | CARRIER_DECLARED
    valid_from      DATE         NOT NULL,
    valid_to        DATE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emission_factors_mode
    ON cargolink_emission_factors (mode, valid_from DESC);

-- Valores del GLEC Framework v3 / ISO 14083. Son rangos en la norma; se toma
-- un valor central y se declara la fuente para que sea auditable y sustituible.
INSERT INTO cargolink_emission_factors (mode, subtype, gco2e_per_tkm, source, valid_from)
SELECT * FROM (VALUES
    ('SEA_CONTAINER',    'feeder <1000 TEU',   16.000, 'GLEC_v3', DATE '2026-01-01'),
    ('SEA_CONTAINER',    'panamax 3-5k TEU',    11.000, 'GLEC_v3', DATE '2026-01-01'),
    ('SEA_CONTAINER',    'ULCV >14k TEU',        8.000, 'GLEC_v3', DATE '2026-01-01'),
    ('ROAD_TRUCK',       'rigid <12t',         120.000, 'GLEC_v3', DATE '2026-01-01'),
    ('ROAD_TRUCK',       'artic 40t',           62.000, 'GLEC_v3', DATE '2026-01-01'),
    ('RAIL',             'electric',            22.000, 'GLEC_v3', DATE '2026-01-01'),
    ('RAIL',             'diesel',              30.000, 'GLEC_v3', DATE '2026-01-01'),
    ('INLAND_WATERWAY',  'barge',               31.000, 'GLEC_v3', DATE '2026-01-01'),
    ('AIR',              'freighter',          602.000, 'GLEC_v3', DATE '2026-01-01')
) AS v(mode, subtype, gco2e_per_tkm, source, valid_from)
WHERE NOT EXISTS (SELECT 1 FROM cargolink_emission_factors);

-- ── Certificado de huella por envío (TX019) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS cargolink_carbon_certificates (
    id                SERIAL PRIMARY KEY,
    certificate_no    VARCHAR(48)  NOT NULL UNIQUE,
    b_uid             VARCHAR(64)  NOT NULL,
    total_kgco2e      NUMERIC(14,3) NOT NULL,
    -- Intensidad: kg CO2e por tonelada transportada. Es la cifra comparable
    -- entre envíos de distinto tamaño y la que se lleva a un informe.
    intensity_kgco2e_per_t NUMERIC(12,4),
    total_distance_km NUMERIC(12,2) NOT NULL,
    cargo_weight_kg   INTEGER      NOT NULL,
    -- Los tramos completos, para que el certificado se pueda recomputar sin
    -- confiar en el total. Cada uno con su modo, distancia y factor aplicado.
    legs              JSONB        NOT NULL,
    methodology       VARCHAR(40)  NOT NULL DEFAULT 'GLEC_v3',
    issuer_bezhas_id  VARCHAR(50)  NOT NULL,
    evidence_hash     CHAR(66)     NOT NULL,
    chain_tx_hash     VARCHAR(80),
    anchor_mode       VARCHAR(32)  NOT NULL DEFAULT 'pending',
    issued_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carbon_certificates_buid
    ON cargolink_carbon_certificates (b_uid);

-- ── Factura de flete (TX016) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cargolink_invoices (
    id              SERIAL PRIMARY KEY,
    invoice_no      VARCHAR(48)  NOT NULL UNIQUE,
    b_uid           VARCHAR(64)  NOT NULL,
    booking_id      INTEGER      REFERENCES cargolink_bookings(id),
    issuer_bezhas_id VARCHAR(50) NOT NULL,
    payer_bezhas_id  VARCHAR(50) NOT NULL,
    -- Las líneas se guardan enteras: una factura de flete lleva flete base más
    -- recargos (BAF, THC, ISPS...) y lo que se discute suele ser un recargo
    -- concreto, no el total.
    lines           JSONB        NOT NULL,
    subtotal_eur    NUMERIC(14,2) NOT NULL,
    tax_eur         NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_eur       NUMERIC(14,2) NOT NULL,
    currency        VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    status          VARCHAR(16)  NOT NULL DEFAULT 'ISSUED',  -- ISSUED | DISPUTED | SETTLED | CANCELLED
    due_date        DATE,
    evidence_hash   CHAR(66)     NOT NULL,
    issued_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_buid ON cargolink_invoices (b_uid);

-- ── Obligación de pago (TX017) ──────────────────────────────────────────────
-- Nace de un hecho verificable, no de una decisión: la entrega confirmada, la
-- rotura de SLA, la avería. Por eso lleva `trigger_event` y `trigger_ref`.
CREATE TABLE IF NOT EXISTS cargolink_payment_obligations (
    id              SERIAL PRIMARY KEY,
    obligation_ref  VARCHAR(48)  NOT NULL UNIQUE,
    b_uid           VARCHAR(64)  NOT NULL,
    invoice_id      INTEGER      REFERENCES cargolink_invoices(id),
    debtor_bezhas_id   VARCHAR(50) NOT NULL,
    creditor_bezhas_id VARCHAR(50) NOT NULL,
    amount_eur      NUMERIC(14,2) NOT NULL,
    kind            VARCHAR(24)  NOT NULL,  -- FREIGHT | SLA_PENALTY | DAMAGE_CLAIM | DEMURRAGE | CARBON_SURCHARGE
    trigger_event   VARCHAR(40)  NOT NULL,  -- qué hecho la originó
    trigger_ref     VARCHAR(64),            -- id de ese hecho (transición, disputa, cambio de ETA)
    status          VARCHAR(16)  NOT NULL DEFAULT 'PENDING',  -- PENDING | SETTLED | WAIVED | DISPUTED
    settled_tx_hash VARCHAR(80),
    due_date        DATE,
    evidence_hash   CHAR(66)     NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    settled_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_obligations_buid ON cargolink_payment_obligations (b_uid, status);
