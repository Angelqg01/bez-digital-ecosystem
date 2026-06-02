-- Migration 013: Allow BEZ sell transactions in payment history

ALTER TABLE payment_transactions
    DROP CONSTRAINT IF EXISTS payment_transactions_type_check;

ALTER TABLE payment_transactions
    ADD CONSTRAINT payment_transactions_type_check
    CHECK (type IN ('buy', 'sell', 'payment'));
