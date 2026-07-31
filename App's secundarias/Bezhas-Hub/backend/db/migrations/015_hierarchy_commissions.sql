-- 015_hierarchy_commissions.sql
-- =============================================================================
-- Jerarquías de organizaciones (holding/consorcio/naviera → subordinados) +
-- motor de comisiones por validación de transacciones + tesorería interna +
-- motor de políticas (límites de gasto/scope/geofencing) que un padre impone
-- a sus subordinados.
-- Aditivo y no destructivo: sólo tablas/tipos nuevos, todo cuelga de
-- organizations(id) ya creada en 012. Requiere plan business+ (ver
-- config/plans.js → hierarchyEnabled), gate aplicado en la capa de servicio,
-- no en la BD.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE hierarchy_relationship AS ENUM ('holding','consorcio','naviera','franquicia','distribuidor','filial');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE validation_tx_type AS ENUM ('payment','shipment_confirm','iot_reading','escrow_release','api_call','custom');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE ledger_status AS ENUM ('accrued','settled','disputed','void');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE transfer_direction AS ENUM ('advance','sweep');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE transfer_status AS ENUM ('pending','approved','rejected','settled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE policy_type AS ENUM ('spend_limit','api_scope','geofence','rate_limit');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Vínculo padre → subordinado (holding/consorcio sobre sus filiales) ───────
CREATE TABLE IF NOT EXISTS org_hierarchy_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  child_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  relationship_type hierarchy_relationship NOT NULL DEFAULT 'filial',
  commission_rate_bps INT NOT NULL DEFAULT 0,   -- capturado del plan del padre al crear el vínculo
  status org_status NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT no_self_link CHECK (parent_org_id <> child_org_id),
  CONSTRAINT uq_hierarchy_link UNIQUE (parent_org_id, child_org_id)
);

-- ── Evento validable (pago, envío confirmado, lectura IoT, escrow, etc.) ─────
CREATE TABLE IF NOT EXISTS validation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subject_site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  tx_type validation_tx_type NOT NULL DEFAULT 'custom',
  tx_ref VARCHAR(160) NOT NULL,       -- hash on-chain o id interno idempotente
  tx_amount NUMERIC(24,8) NOT NULL DEFAULT 0,
  tx_currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_validation_event UNIQUE (subject_org_id, tx_ref)  -- idempotencia: mismo tx no comisiona dos veces
);

-- ── Comisión devengada por cada organización ancestro en la cascada ──────────
CREATE TABLE IF NOT EXISTS commission_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_event_id UUID NOT NULL REFERENCES validation_events(id) ON DELETE CASCADE,
  beneficiary_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  level SMALLINT NOT NULL,            -- 1 = padre directo, 2 = abuelo, ...
  rate_bps_applied INT NOT NULL,
  amount NUMERIC(24,8) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status ledger_status NOT NULL DEFAULT 'accrued',
  settlement_ref VARCHAR(160),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Política que un padre impone sobre sí mismo o un subordinado ────────────
CREATE TABLE IF NOT EXISTS org_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,     -- quién la define
  applies_to_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, -- sobre quién aplica
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,                           -- opcional, acota a una sede
  policy_type policy_type NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status org_status NOT NULL DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Transferencia interna de tesorería entre niveles (FIAT/BEZ/USDC) ────────
-- NOTA: registro contable (ledger), NO ejecuta el movimiento real de fondos.
-- La liquidación efectiva (banco/on-chain) queda fuera de esta tabla; aquí se
-- audita la solicitud/aprobación/estado para que el operador humano o una
-- integración posterior (Stripe Connect / tx on-chain) la ejecute y confirme.
CREATE TABLE IF NOT EXISTS treasury_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  to_org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  direction transfer_direction NOT NULL,
  currency VARCHAR(10) NOT NULL,
  amount NUMERIC(24,8) NOT NULL,
  status transfer_status NOT NULL DEFAULT 'pending',
  requested_by UUID,
  approved_by UUID,
  note TEXT,
  settlement_ref VARCHAR(160),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMPTZ,
  CONSTRAINT no_self_transfer CHECK (from_org_id <> to_org_id)
);

CREATE INDEX IF NOT EXISTS idx_hierarchy_parent ON org_hierarchy_links(parent_org_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_child ON org_hierarchy_links(child_org_id);
CREATE INDEX IF NOT EXISTS idx_validation_events_subject ON validation_events(subject_org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_beneficiary ON commission_ledger(beneficiary_org_id, status);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_event ON commission_ledger(validation_event_id);
CREATE INDEX IF NOT EXISTS idx_org_policies_applies_to ON org_policies(applies_to_org_id, status);
CREATE INDEX IF NOT EXISTS idx_treasury_transfers_from ON treasury_transfers(from_org_id);
CREATE INDEX IF NOT EXISTS idx_treasury_transfers_to ON treasury_transfers(to_org_id);
