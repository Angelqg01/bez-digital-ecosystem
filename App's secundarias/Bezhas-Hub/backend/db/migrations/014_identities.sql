-- 014_identities.sql
-- =============================================================================
-- BeZhas_ID — identidad ÚNICA y portable por persona/empresa.
-- Unifica los distintos métodos de acceso (email, wallet, OAuth) en UN solo
-- identificador canónico `bezhas_id` (BZ-XXXXXXXXXX), estable independientemente
-- de cómo inicie sesión. Es la identidad sobre la que cuelgan las membresías
-- multi-tenant (Organización → Sedes → Membresías).
-- Aditivo: tabla nueva + columna nullable en memberships.
-- =============================================================================

CREATE TABLE IF NOT EXISTS identities (
  bezhas_id VARCHAR(24) PRIMARY KEY,        -- canónico, humano: BZ-XXXXXXXXXX
  user_id UUID,                             -- id interno del usuario (si aplica)
  email_hash VARCHAR(64),                   -- sha256(email en minúsculas) — privacidad
  wallet_address VARCHAR(42),
  display_name VARCHAR(120),
  status org_status NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_identity_wallet
  ON identities(lower(wallet_address)) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_identity_email ON identities(email_hash);
CREATE INDEX IF NOT EXISTS idx_identity_user ON identities(user_id);

-- Vincular las membresías a la identidad canónica (además de user_id/wallet).
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS bezhas_id VARCHAR(24);
CREATE INDEX IF NOT EXISTS idx_memberships_bezhas ON memberships(bezhas_id);

-- Vincular también las API keys a la identidad emisora.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS bezhas_id VARCHAR(24);
