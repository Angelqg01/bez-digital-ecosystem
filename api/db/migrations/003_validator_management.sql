-- 003_validator_management.sql
-- Adds off-chain tracking tables for validator rewards, slashing, and heartbeats.

-- Validator reward claims (mirrors on-chain but queryable off-chain)
CREATE TABLE IF NOT EXISTS validator_rewards (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operator        VARCHAR(42) NOT NULL,
    amount_bez      NUMERIC(30, 18) NOT NULL,
    boost_pct       NUMERIC(6, 2) DEFAULT 100,
    tier_at_claim   SMALLINT DEFAULT 1,
    tx_hash         VARCHAR(66) NOT NULL,
    block_number    BIGINT,
    claimed_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_vrewards_operator ON validator_rewards(operator);
CREATE INDEX IF NOT EXISTS idx_vrewards_claimed ON validator_rewards(claimed_at DESC);

-- Validator slash history
CREATE TABLE IF NOT EXISTS validator_slashes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operator        VARCHAR(42) NOT NULL,
    amount_bez      NUMERIC(30, 18) NOT NULL,
    reason          VARCHAR(200) NOT NULL,
    slashed_by      VARCHAR(42),
    tx_hash         VARCHAR(66) NOT NULL,
    block_number    BIGINT,
    slashed_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_vslashes_operator ON validator_slashes(operator);
CREATE INDEX IF NOT EXISTS idx_vslashes_slashed ON validator_slashes(slashed_at DESC);

-- Heartbeat tracking (aggregated, not per-beat)
CREATE TABLE IF NOT EXISTS validator_heartbeats (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operator        VARCHAR(42) NOT NULL,
    day             DATE NOT NULL DEFAULT CURRENT_DATE,
    beat_count      INTEGER NOT NULL DEFAULT 1,
    last_beat_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(operator, day)
);

CREATE INDEX IF NOT EXISTS idx_vhb_operator_day ON validator_heartbeats(operator, day DESC);

-- Contribution log (mirrors ContributionRecorded events)
CREATE TABLE IF NOT EXISTS validator_contributions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operator        VARCHAR(42) NOT NULL,
    points          INTEGER NOT NULL,
    task_type       VARCHAR(60) NOT NULL,
    tx_hash         VARCHAR(66) NOT NULL,
    block_number    BIGINT,
    recorded_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_vcontrib_operator ON validator_contributions(operator);
CREATE INDEX IF NOT EXISTS idx_vcontrib_recorded ON validator_contributions(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vcontrib_task ON validator_contributions(task_type);
