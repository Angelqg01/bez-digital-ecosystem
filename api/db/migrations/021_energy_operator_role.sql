-- Migration 021: Enable the 'operator' role for the VPP Energy app
--
-- The Energy router (api/routes/energy.js) gates SCADA control, arbitrage
-- execution, CAE minting and demand-response behind requireRole('operator').
-- The users.role CHECK constraint never allowed 'operator', so those endpoints
-- were permanently 403 for every real user. This widens the constraint and adds
-- an audit trail for operator provisioning (which admin promoted/revoked whom),
-- in line with the platform's on-chain-audit ethos.

-- 1. Allow 'operator' as a first-class role.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'enterprise', 'edge_node', 'operator'));

-- 2. Immutable audit log of operator provisioning actions.
CREATE TABLE IF NOT EXISTS operator_provisioning_log (
    id            SERIAL PRIMARY KEY,
    operator_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    action        VARCHAR(16) NOT NULL CHECK (action IN ('GRANT', 'REVOKE')),
    previous_role VARCHAR(20),
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operator_log_operator ON operator_provisioning_log(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_log_admin    ON operator_provisioning_log(admin_id);
