-- Migration 027: payment-intent lifecycle states + order expiry
--
-- Widens the order state machine from pending|completed|failed to:
--   pending → processing → completed | failed | expired
-- ('processing' is reserved for PSP flows that confirm asynchronously.)
--
-- expires_at gives every order a TTL: on-chain (crypto/qr) orders expire fast
-- so the settlement watcher stops matching stale intents against new
-- transfers; card/bank orders get a longer window. expireStaleOrders()
-- (services/paymentSettlement.js) sweeps them and emits payment.expired.

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_status_check;
ALTER TABLE payment_transactions
    ADD CONSTRAINT payment_transactions_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired'));

ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payment_tx_expiry
    ON payment_transactions (status, expires_at)
    WHERE status = 'pending';
