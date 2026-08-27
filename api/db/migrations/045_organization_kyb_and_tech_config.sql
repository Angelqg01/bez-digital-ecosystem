-- Migration 045: KYB documental + config técnica/cripto por organización.
--
-- Sigue a 044 (organizations + organization_members). Cuatro tablas:
--
--   organization_documents      — KYB documental (certificado de constitución,
--                                  NIF, ID del representante legal, prueba de
--                                  domicilio). Deliberadamente NO reutiliza la
--                                  tabla `documents` (migración 004): esa es un
--                                  sistema de documentos de comercio con anclaje
--                                  on-chain, veredicto de IA (Aegis) y firmas
--                                  multi-parte — pensado para bill of lading,
--                                  certificados de origen, etc. Forzar ahí
--                                  documentos de identidad de empresa habría
--                                  significado o bien anclar PII en una cadena
--                                  pública, o mantener un CHECK constraint y un
--                                  modelo de "owner" (wallet) que no encajan con
--                                  "documento revisado por un admin de BeZhas
--                                  para una organización". Más simple tener su
--                                  propia tabla, sin las piezas que no aplican.
--
--   organization_credentials    — RPC providers (Alchemy/Infura/nodo propio) y
--                                  claves de API de oráculos. El secreto va
--                                  cifrado con secretVault (AES-256-GCM, mismo
--                                  esquema que ya protege credenciales de
--                                  terceros en cargoLinkPosConnector) — nunca en
--                                  claro en la base de datos.
--
--   organization_wallets        — direcciones de wallets corporativas (EOA,
--                                  multisig, Safe) que pertenecen a la
--                                  organización. Solo la dirección pública: la
--                                  lectura de firmantes/pendientes de un
--                                  multisig ya existe en walletService y no se
--                                  duplica aquí.
--
--   organization_contract_configs — qué estándar de token y en qué dirección
--                                  ha desplegado la organización (ERC-20,
--                                  ERC-721, ERC-1400 para activos regulados…).
--                                  Registro, no gestión de despliegue.

-- Nota del admin de BeZhas que decide el estado KYB (por qué se rechazó, qué
-- falta, etc.) — sin esto, `kyb/review` no tendría dónde dejar el motivo.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS verification_notes TEXT;

CREATE TABLE IF NOT EXISTS organization_documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    doc_type            VARCHAR(40) NOT NULL CHECK (doc_type IN (
                            'incorporation_certificate', 'tax_id_proof', 'legal_representative_id',
                            'proof_of_address', 'other'
                        )),
    file_name           VARCHAR(255) NOT NULL,
    file_hash           VARCHAR(66),
    mime_type           VARCHAR(100),
    storage_url         TEXT NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
    uploaded_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_documents_org ON organization_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_documents_status ON organization_documents(status);

CREATE TABLE IF NOT EXISTS organization_credentials (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category            VARCHAR(20) NOT NULL CHECK (category IN ('rpc_provider', 'oracle')),
    provider            VARCHAR(50) NOT NULL,   -- 'alchemy' | 'infura' | 'quicknode' | 'custom' | 'chainlink' | 'pyth' | 'other'
    chain_id            INTEGER,
    label               VARCHAR(120) NOT NULL,
    secret_encrypted    TEXT NOT NULL,          -- secretVault.encryptSecret() — nunca en claro
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,  -- ej. { "baseUrl": "...", "network": "polygon-mainnet" }, sin secretos
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_credentials_org ON organization_credentials(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_credentials_category ON organization_credentials(organization_id, category);

CREATE TABLE IF NOT EXISTS organization_wallets (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    address             VARCHAR(42) NOT NULL,
    chain_id            INTEGER NOT NULL,
    label               VARCHAR(120),
    wallet_type         VARCHAR(20) NOT NULL DEFAULT 'eoa' CHECK (wallet_type IN ('eoa', 'multisig', 'safe')),
    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
    added_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, address, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_org_wallets_org ON organization_wallets(organization_id);

CREATE TABLE IF NOT EXISTS organization_contract_configs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token_standard      VARCHAR(20) NOT NULL CHECK (token_standard IN ('ERC-20', 'ERC-721', 'ERC-1155', 'ERC-1400', 'other')),
    name                VARCHAR(120) NOT NULL,
    address             VARCHAR(42),
    chain_id            INTEGER NOT NULL,
    notes               TEXT,
    added_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_contract_configs_org ON organization_contract_configs(organization_id);
