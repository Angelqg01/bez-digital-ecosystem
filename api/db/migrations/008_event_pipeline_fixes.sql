-- ═══════════════════════════════════════════════════════════
--  Migration 008: Event Pipeline & Multi-Chain Schema Fixes
--  Fixes identified: bridge step tracking, gas_balances chain_id,
--  staking/farming harvest tracking, blockchain_events indexing
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
--  BRIDGE TRANSFERS: Add intermediate TX hashes + step tracker
-- ─────────────────────────────────────────────────────────

ALTER TABLE bridge_transfers ADD COLUMN IF NOT EXISTS relay_tx_hash VARCHAR(66);
ALTER TABLE bridge_transfers ADD COLUMN IF NOT EXISTS finalize_tx_hash VARCHAR(66);
ALTER TABLE bridge_transfers ADD COLUMN IF NOT EXISTS current_step SMALLINT DEFAULT 0
    CHECK (current_step BETWEEN 0 AND 4);
-- Step mapping: 0=initiated, 1=l1_confirmed, 2=l2_deposited, 3=relayed, 4=finalized

CREATE INDEX IF NOT EXISTS idx_bridge_l1tx ON bridge_transfers(l1_tx_hash) WHERE l1_tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bridge_l2tx ON bridge_transfers(l2_tx_hash) WHERE l2_tx_hash IS NOT NULL;

-- ─────────────────────────────────────────────────────────
--  GAS BALANCES: Add chain_id for multi-chain support
-- ─────────────────────────────────────────────────────────

ALTER TABLE gas_balances ADD COLUMN IF NOT EXISTS chain_id INTEGER DEFAULT 2708;
CREATE INDEX IF NOT EXISTS idx_gas_chain ON gas_balances(chain_id);

-- ─────────────────────────────────────────────────────────
--  STAKING POSITIONS: Add harvest tracking + tier
-- ─────────────────────────────────────────────────────────

ALTER TABLE staking_positions ADD COLUMN IF NOT EXISTS duration_days INTEGER;
ALTER TABLE staking_positions ADD COLUMN IF NOT EXISTS harvest_count INTEGER DEFAULT 0;
ALTER TABLE staking_positions ADD COLUMN IF NOT EXISTS tier_at_stake SMALLINT;

-- ─────────────────────────────────────────────────────────
--  FARMING POSITIONS: Add harvest tracking
-- ─────────────────────────────────────────────────────────

ALTER TABLE farming_positions ADD COLUMN IF NOT EXISTS harvest_count INTEGER DEFAULT 0;
ALTER TABLE farming_positions ADD COLUMN IF NOT EXISTS total_harvested NUMERIC(30, 18) DEFAULT 0;

-- ─────────────────────────────────────────────────────────
--  BLOCKCHAIN EVENTS: Composite index for cross-contract queries
-- ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bevents_type_actor ON blockchain_events(event_type, actor_address);
CREATE INDEX IF NOT EXISTS idx_bevents_chain_contract ON blockchain_events(chain_id, contract_name);

-- ─────────────────────────────────────────────────────────
--  PAYMENT TRANSACTIONS: Add approval tracking
-- ─────────────────────────────────────────────────────────

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_transactions') THEN
        EXECUTE 'ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS approval_count SMALLINT DEFAULT 0';
        EXECUTE 'ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS rejection_reason TEXT';
    END IF;
END $$;

-- Track migration
INSERT INTO migrations (name, applied_at)
VALUES ('008_event_pipeline_fixes', NOW())
ON CONFLICT (name) DO NOTHING;
