-- Migration 022: Energy ledger (replaces the simulated wallet/staking/p2p/cae data)
--
-- Backs the previously hardcoded endpoints in api/routes/energy.js with real,
-- per-user persisted state. On-chain reads (BEZ/CAE/staking) enrich these rows
-- best-effort when the contract addresses + RPC are configured; otherwise the DB
-- is the source of truth. All amounts in BZHS/BEZ use NUMERIC to avoid float drift.

-- Per-user energy wallet (balance, staking position, reputation, self-sufficiency).
CREATE TABLE IF NOT EXISTS energy_wallets (
    user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    wallet_address       VARCHAR(42),
    balance_bzhs         NUMERIC(30, 8) NOT NULL DEFAULT 0,
    staked_bzhs          NUMERIC(30, 8) NOT NULL DEFAULT 0,
    pending_rewards_bzhs NUMERIC(30, 8) NOT NULL DEFAULT 0,
    apy_pct              NUMERIC(6, 2)  NOT NULL DEFAULT 8.50,
    reputation_score     INTEGER        NOT NULL DEFAULT 50,
    self_sufficiency_pct NUMERIC(5, 2)  NOT NULL DEFAULT 0,
    available_kwh        NUMERIC(18, 4) NOT NULL DEFAULT 0,
    reserved_kwh         NUMERIC(18, 4) NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable energy transaction history (arbitrage, DR, P2P, staking, top-ups).
CREATE TABLE IF NOT EXISTS energy_tx_history (
    id           SERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         VARCHAR(20) NOT NULL CHECK (type IN ('ARBITRAGE','P2P','DR_INCENTIVE','STAKING','CREDIT_PURCHASE')),
    amount_bzhs  NUMERIC(30, 8) NOT NULL,
    amount_eur   NUMERIC(30, 8),
    status       VARCHAR(16) NOT NULL DEFAULT 'CONFIRMED',
    tx_hash      VARCHAR(80) UNIQUE,                 -- UNIQUE → on-chain replay protection
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_energy_tx_user ON energy_tx_history(user_id, created_at DESC);

-- CAE tokens (Certificados de Ahorro Energético — RWA, EnergyCAEToken.sol ERC-1155).
CREATE TABLE IF NOT EXISTS energy_cae_tokens (
    id               SERIAL PRIMARY KEY,
    token_id         VARCHAR(64) UNIQUE NOT NULL,
    owner_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    savings_kwh      NUMERIC(18, 4) NOT NULL,
    period           VARCHAR(12) NOT NULL,           -- YYYY-Qn
    certifier        VARCHAR(24) NOT NULL,           -- CNMC | IDAE | BEZHAS_ORACLE
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING_MINT',
    market_value_eur NUMERIC(18, 2),
    for_sale         BOOLEAN NOT NULL DEFAULT FALSE,
    listing_price_eur NUMERIC(18, 2),
    telemetry_proof  TEXT,
    tx_hash          VARCHAR(80),
    minted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cae_owner ON energy_cae_tokens(owner_user_id);

-- P2P energy offers (prosumer surplus sold to other nodes, settled in BZHS).
CREATE TABLE IF NOT EXISTS energy_p2p_offers (
    id              SERIAL PRIMARY KEY,
    offer_id        VARCHAR(48) UNIQUE NOT NULL,
    seller_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    seller_address  VARCHAR(42),
    energy_kwh      NUMERIC(18, 4) NOT NULL,
    price_bzhs_kwh  NUMERIC(18, 6) NOT NULL,
    source          VARCHAR(16),                     -- SOLAR | WIND | HYDRO | BATTERY
    location        VARCHAR(80),
    node_id         VARCHAR(16),
    status          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SOLD','EXPIRED','CANCELLED')),
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    buyer_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    settle_tx_hash  VARCHAR(80),
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_p2p_status ON energy_p2p_offers(status, expires_at);
