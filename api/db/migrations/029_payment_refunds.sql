-- Migration 029: refund state for buy orders
--
-- Adds 'refunded' to the order state machine. A refund only applies to a
-- completed order, is internal-only (settlement key, like /payments/settle),
-- records the on-chain return transfer when available, and emits a
-- payment.refunded webhook to the creating app.

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_status_check;
ALTER TABLE payment_transactions
    ADD CONSTRAINT payment_transactions_status_check
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired', 'refunded'));
