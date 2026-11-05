-- 076_marketplace.sql
--
-- API Marketplace, paso 1: proveedores, listings, suscripciones, llamadas y lotes de recibos.
-- Diseño: docs/API_MARKETPLACE_DISENO.md.
--
-- Un proveedor es una app de app_registry que además publica listings. El consumidor llama con su
-- api-key de siempre; BeZhas valida, reenvía, mide y emite un recibo. El dinero nunca pasa por
-- cuentas de BeZhas (Stripe Connect con direct charges en la cuenta del proveedor).
--
-- Qué NO se guarda, a propósito:
--   · Ningún cuerpo de petición ni de respuesta del proxy: sólo sus sha256 (req_hash, resp_hash).
--     BeZhas no trata los datos que pasan por el marketplace más allá del tránsito.
--   · El secreto del upstream en claro: va cifrado con services/secretVault (AES-256-GCM) y sólo
--     se devuelve una vez, al crearlo o rotarlo.
--
-- marketplace_calls y marketplace_receipt_batches se crean ya aunque el proxy sea el paso 2, para
-- que la migración de esquema sea una sola.

CREATE TABLE IF NOT EXISTS marketplace_providers (
    app_id            UUID PRIMARY KEY REFERENCES app_registry(id) ON DELETE CASCADE,
    legal_name        TEXT NOT NULL CHECK (char_length(legal_name) BETWEEN 2 AND 200),
    kyb_status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK (kyb_status IN ('pending', 'verified', 'rejected')),
    stripe_account_id TEXT CHECK (stripe_account_id IS NULL OR stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
    payout_address    TEXT CHECK (payout_address IS NULL OR payout_address ~ '^0x[0-9a-fA-F]{40}$'),
    dpa_signed_at     TIMESTAMPTZ,
    status            TEXT NOT NULL DEFAULT 'onboarding'
                      CHECK (status IN ('onboarding', 'active', 'suspended')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplace_listings (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_app_id  UUID NOT NULL REFERENCES marketplace_providers(app_id) ON DELETE CASCADE,
    slug             TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$'),
    title            TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
    summary          TEXT CHECK (summary IS NULL OR char_length(summary) <= 500),
    version          TEXT NOT NULL CHECK (char_length(version) BETWEEN 1 AND 32),
    upstream_url     TEXT NOT NULL CHECK (upstream_url ~ '^https://'),
    upstream_secret  TEXT NOT NULL,                  -- v1:iv:tag:ct (secretVault)
    upstream_secret_rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    openapi          JSONB NOT NULL,                 -- OpenAPI 3.1: contrato de entrada y de salida
    pricing          JSONB NOT NULL,                 -- {model, amount_cents, currency[, interval]}
    data_categories  TEXT[] NOT NULL DEFAULT '{}',   -- GDPR: datos personales que declara mover
    writes           BOOLEAN NOT NULL DEFAULT FALSE,
    status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'review', 'live', 'suspended')),
    review_note      TEXT,
    reviewed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_listings_provider ON marketplace_listings (provider_app_id);
CREATE INDEX IF NOT EXISTS idx_mkt_listings_live     ON marketplace_listings (status) WHERE status = 'live';

CREATE TABLE IF NOT EXISTS marketplace_subscriptions (
    consumer_app_id        UUID NOT NULL REFERENCES app_registry(id) ON DELETE CASCADE,
    listing_id             UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT,                     -- en la cuenta Connect del proveedor
    status                 TEXT NOT NULL CHECK (status IN ('pending', 'active', 'past_due', 'canceled')),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (consumer_app_id, listing_id)
);

CREATE TABLE IF NOT EXISTS marketplace_receipt_batches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id  UUID NOT NULL REFERENCES marketplace_listings(id),
    merkle_root TEXT NOT NULL,
    tx_hash     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una fila por llamada facturable: base del recibo y de las disputas.
CREATE TABLE IF NOT EXISTS marketplace_calls (
    id              UUID PRIMARY KEY,                -- lo genera el servidor, nunca el cliente
    listing_id      UUID NOT NULL REFERENCES marketplace_listings(id),
    consumer_app_id UUID NOT NULL REFERENCES app_registry(id),
    at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    http_status     INT NOT NULL,
    req_hash        TEXT NOT NULL CHECK (req_hash ~ '^[0-9a-f]{64}$'),
    resp_hash       TEXT NOT NULL CHECK (resp_hash ~ '^[0-9a-f]{64}$'),
    amount_cents    INT NOT NULL CHECK (amount_cents >= 0),
    fee_cents       INT NOT NULL CHECK (fee_cents >= 0 AND fee_cents <= amount_cents),
    reported_at     TIMESTAMPTZ,                     -- NULL = pendiente de enviar a Stripe
    batch_id        UUID REFERENCES marketplace_receipt_batches(id)
);

CREATE INDEX IF NOT EXISTS idx_mkt_calls_listing    ON marketplace_calls (listing_id, at);
CREATE INDEX IF NOT EXISTS idx_mkt_calls_consumer   ON marketplace_calls (consumer_app_id, at);
CREATE INDEX IF NOT EXISTS idx_mkt_calls_unreported ON marketplace_calls (at) WHERE reported_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_calls_unbatched  ON marketplace_calls (listing_id) WHERE batch_id IS NULL;
