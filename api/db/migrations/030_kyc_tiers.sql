-- Migration 030: tiered KYC status per wallet (MiCA-style volume gates)
--
-- Buy orders are gated by cumulative 12-month volume per wallet:
--   level 0 (anonymous)  → up to KYC_TIER0_LIMIT_USD  (default 150)
--   level 1 (identity)   → up to KYC_TIER1_LIMIT_USD  (default 15000)
--   level 2 (enhanced)   → unlimited
-- Levels are set by the KYC provider callback / backoffice through the
-- internal endpoint (settlement key) — apps cannot self-upgrade.

CREATE TABLE IF NOT EXISTS kyc_status (
    wallet_address VARCHAR(42) PRIMARY KEY,
    level          SMALLINT NOT NULL DEFAULT 0 CHECK (level IN (0, 1, 2)),
    provider       VARCHAR(60),          -- sumsub | onfido | manual | ...
    reference      VARCHAR(160),         -- provider applicant/verification id
    verified_at    TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
