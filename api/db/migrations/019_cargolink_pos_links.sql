-- Migration 019: CargoLink POS connector
--
-- Links a client's external POS platform (its own API) to their BeZhas_ID.
-- CargoLink pulls orders from the POS API -> creates B-UID transactions, and
-- the POS receives status back via the signed webhook fan-out (it is just a
-- subscriber of its own B-UIDs). One adapter row per BeZhas_ID keeps it simple.

CREATE TABLE IF NOT EXISTS cargolink_pos_links (
    id SERIAL PRIMARY KEY,
    bezhas_id VARCHAR(50) UNIQUE NOT NULL,
    provider VARCHAR(48) NOT NULL DEFAULT 'generic',  -- square | toast | sap | shopify | generic
    base_url TEXT NOT NULL,
    orders_path VARCHAR(160) NOT NULL DEFAULT '/orders',
    api_key TEXT,                                      -- POS API credential (TODO: encrypt at rest)
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    last_sync_at TIMESTAMPTZ,
    last_sync_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargolink_pos_links_bezhas ON cargolink_pos_links(bezhas_id);

-- Track which external POS order already became a B-UID (idempotent pull).
ALTER TABLE cargolink_transactions
    ADD COLUMN IF NOT EXISTS pos_provider VARCHAR(48);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cargolink_tx_owner_posref
    ON cargolink_transactions(owner_bezhas_id, pos_ref)
    WHERE pos_ref IS NOT NULL;
