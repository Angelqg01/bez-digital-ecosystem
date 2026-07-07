-- Migration 025: idempotency keys for payment orders
--
-- POST /payments/buy creates a pending order on every call: a client retrying
-- after a network timeout duplicated orders. Clients can now send an
-- Idempotency-Key header; the same key replays the original order instead of
-- creating a new one (Stripe-style semantics).

ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_tx_idempotency
    ON payment_transactions (idempotency_key)
    WHERE idempotency_key IS NOT NULL;
