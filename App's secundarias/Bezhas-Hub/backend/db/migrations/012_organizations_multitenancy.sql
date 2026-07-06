-- 012_organizations_multitenancy.sql
-- =============================================================================
-- Multi-tenancy B2B: Organización (Holding/Institución/Empresa) → Sedes → Membresías.
-- Es el cimiento para que clientes con +2 sedes controlen todo desde el Hub:
--   - El holding/empresa ve TODO; cada sede sólo lo suyo (scope por site_id).
--   - Las API keys se asocian a una organización y, opcionalmente, a una sede.
--   - Roles por membresía (owner > org_admin > site_manager > operator > auditor).
-- Aditivo y no destructivo: sólo crea tablas/tipos nuevos y columnas nullable.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE org_type AS ENUM ('holding','institucion','empresa','otro');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE org_status AS ENUM ('active','trial','suspended','closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE site_type AS ENUM ('sede','filial','departamento','flota','planta','almacen','inmueble','otro');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE membership_role AS ENUM ('owner','org_admin','site_manager','operator','auditor');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Organización (tenant raíz) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(120) UNIQUE,
  type org_type NOT NULL DEFAULT 'empresa',
  owner_user_id UUID,
  owner_wallet VARCHAR(42),
  plan VARCHAR(40) DEFAULT 'starter',
  status org_status NOT NULL DEFAULT 'active',
  tax_id VARCHAR(64),
  country VARCHAR(2) DEFAULT 'ES',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Sede / filial / departamento / flota / inmueble … ────────────────────────
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  type site_type NOT NULL DEFAULT 'sede',
  external_ref VARCHAR(120),            -- código del cliente (ej: ID de sucursal/flota)
  parent_site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  status org_status NOT NULL DEFAULT 'active',
  location JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Membresía: usuario/wallet ↔ organización (y opcionalmente una sede) ───────
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,   -- NULL = acceso a toda la org
  user_id UUID,
  wallet_address VARCHAR(42),
  role membership_role NOT NULL DEFAULT 'operator',
  status org_status NOT NULL DEFAULT 'active',
  invited_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT membership_identity CHECK (user_id IS NOT NULL OR wallet_address IS NOT NULL)
);

-- ── Scope de las API keys por organización/sede (aditivo, nullable) ──────────
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS site_id UUID;

-- ── Índices de consulta ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sites_org ON sites(org_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_wallet ON memberships(lower(wallet_address));
CREATE UNIQUE INDEX IF NOT EXISTS uq_membership_user
  ON memberships(org_id, COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid), user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id);
