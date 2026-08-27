-- Migration 044: organizations + organization_members (base de RBAC empresarial).
--
-- Es el cimiento del registro extendido (KYB, config técnica/cripto por
-- empresa, billing con NIF, MFA/RBAC granular): todas esas piezas cuelgan de
-- un `organization_id`, así que tienen que existir primero `organizations` y
-- la membresía con rol.
--
-- No se toca `enterprises` (la usan gas.js, config.js, documentService.js y
-- gamificationService.js con su propio modelo 1:1 usuario↔cuenta B2B, ligado a
-- gas tank y cuotas). En vez de migrar esas rutas de golpe, cada `enterprises`
-- existente se replica como una `organizations` con su `legacy_enterprise_id`
-- y su dueño como member 'owner' — así el nuevo modelo puede crecer sin dejar
-- sin empresa a quien ya tenía una.

CREATE TABLE IF NOT EXISTS organizations (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                        VARCHAR(255) NOT NULL,
    -- Datos legales/fiscales (KYB) — nullable: se rellenan en el onboarding
    -- posterior al alta, no en el registro inicial.
    legal_name                  VARCHAR(255),
    tax_id                      VARCHAR(50),
    country                     VARCHAR(2),                 -- ISO 3166-1 alpha-2
    fiscal_address              TEXT,
    legal_representative_name   VARCHAR(255),
    legal_representative_id     VARCHAR(50),                -- DNI/NIE/pasaporte del representante
    verification_status         VARCHAR(20) NOT NULL DEFAULT 'unverified'
                                 CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
    tier                        VARCHAR(20) NOT NULL DEFAULT 'basic'
                                 CHECK (tier IN ('basic', 'professional', 'enterprise')),
    legacy_enterprise_id        UUID REFERENCES enterprises(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_legacy_enterprise ON organizations(legacy_enterprise_id);
CREATE INDEX IF NOT EXISTS idx_organizations_verification ON organizations(verification_status);

-- Rol de cada usuario dentro de cada organización. Un mismo usuario puede
-- pertenecer a varias organizaciones con roles distintos en cada una — por
-- eso el rol vive aquí y no en `users.role` (que sigue siendo el rol de
-- plataforma: user/admin/enterprise/edge_node/operator).
CREATE TABLE IF NOT EXISTS organization_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL
                    CHECK (role IN ('owner', 'admin', 'developer', 'auditor', 'financial', 'operator')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'invited', 'revoked')),
    invited_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- Backfill: una `organizations` por cada `enterprises` existente, con su
-- dueño como 'owner'. Idempotente por `legacy_enterprise_id` — se puede
-- re-ejecutar la migración sin duplicar filas.
INSERT INTO organizations (name, tier, legacy_enterprise_id, created_at, updated_at)
SELECT e.name, e.tier, e.id, e.created_at, e.updated_at
FROM enterprises e
WHERE NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.legacy_enterprise_id = e.id
);

INSERT INTO organization_members (organization_id, user_id, role)
SELECT o.id, e.user_id, 'owner'
FROM organizations o
JOIN enterprises e ON e.id = o.legacy_enterprise_id
WHERE e.user_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;
