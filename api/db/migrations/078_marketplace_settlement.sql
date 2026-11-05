-- 078_marketplace_settlement.sql
--
-- API Marketplace, paso 5: pago en BEZ por MarketplaceSettlement.sol (Polygon), sin custodia.
--
-- El consumidor paga al contrato y el reparto proveedor/comisión ocurre en esa misma transacción.
-- BeZhas sólo registra el listing en el contrato y, al ver el evento Paid, activa el acceso. Nunca
-- tiene los BEZ del consumidor: no hay ninguna columna de saldo aquí, el saldo vive en el contrato.

CREATE TABLE IF NOT EXISTS marketplace_onchain_listings (
    listing_id    UUID PRIMARY KEY REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    chain_id      INT  NOT NULL,
    contract      TEXT NOT NULL CHECK (contract ~ '^0x[0-9a-fA-F]{40}$'),
    listing_key   TEXT NOT NULL UNIQUE CHECK (listing_key ~ '^0x[0-9a-f]{64}$'),  -- bytes32 en el contrato
    provider      TEXT NOT NULL CHECK (provider ~ '^0x[0-9a-fA-F]{40}$'),
    price_wei     NUMERIC(78, 0) NOT NULL CHECK (price_wei > 0),
    tx_hash       TEXT NOT NULL CHECK (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un pago on-chain sólo puede activar UN acceso: purchase_id es la clave contra la reutilización.
CREATE TABLE IF NOT EXISTS marketplace_onchain_payments (
    purchase_id     TEXT PRIMARY KEY CHECK (purchase_id ~ '^0x[0-9a-f]{64}$'),
    tx_hash         TEXT NOT NULL CHECK (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
    chain_id        INT  NOT NULL,
    listing_id      UUID NOT NULL REFERENCES marketplace_listings(id),
    consumer_app_id UUID NOT NULL REFERENCES app_registry(id),
    payer           TEXT NOT NULL CHECK (payer ~ '^0x[0-9a-f]{40}$'),
    price_wei       NUMERIC(78, 0) NOT NULL,
    fee_wei         NUMERIC(78, 0) NOT NULL,
    block_number    BIGINT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_onchain_payments_consumer ON marketplace_onchain_payments (consumer_app_id, listing_id);
