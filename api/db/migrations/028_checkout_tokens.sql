-- Migration 028: hosted checkout tokens
--
-- Every buy order gets an unguessable bearer token so the customer can open
-- the hosted checkout page (GET /c/<token>) and the page can poll a PUBLIC
-- status endpoint (GET /api/gateway/v1/checkout/<token>) without an API key —
-- Stripe-Checkout-style: the merchant creates the order server-side and hands
-- the customer only the URL.

ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS checkout_token VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_tx_checkout_token
    ON payment_transactions (checkout_token)
    WHERE checkout_token IS NOT NULL;
