-- Migration 023: saldo publicitario (antes, colección `adbalances` de Mongo).
--
-- Saldos con CHECK >= 0: la base de datos impide un saldo negativo aunque falle una comprobación de la aplicación.
-- Además protege los dos caminos de acreditación contra el doble abono:
--   * un mismo hash de transacción BEZ sólo puede acreditarse una vez (antes se podía repetir el mismo hash);
--   * un mismo PaymentIntent de Stripe sólo puede tener una transacción de recarga.
-- Los índices únicos de billing_transactions se crean sólo si no hay duplicados ya existentes (en ese caso avisa y no los crea,
-- para no tumbar el despliegue; hay que limpiar los duplicados a mano y repetir estas dos sentencias).
-- Revertir: DROP TABLE ad_balances; DROP INDEX IF EXISTS uq_billing_deposit_bez_tx, uq_billing_deposit_fiat_intent;
CREATE TABLE IF NOT EXISTS ad_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(42) NOT NULL,
    fiat_balance NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (fiat_balance >= 0),
    bez_balance NUMERIC(36, 18) NOT NULL DEFAULT 0 CHECK (bez_balance >= 0),
    total_deposited NUMERIC(20, 6) NOT NULL DEFAULT 0,
    total_spent NUMERIC(20, 6) NOT NULL DEFAULT 0,
    total_refunded NUMERIC(20, 6) NOT NULL DEFAULT 0,
    pending_charges NUMERIC(20, 6) NOT NULL DEFAULT 0,
    last_deposit_at TIMESTAMP WITH TIME ZONE,
    last_charge_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_balances_wallet ON ad_balances (LOWER(wallet_address));

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM billing_transactions WHERE type = 'deposit_bez' AND blockchain_tx_hash IS NOT NULL
               GROUP BY LOWER(blockchain_tx_hash) HAVING COUNT(*) > 1) THEN
        RAISE WARNING 'billing_transactions tiene hashes BEZ duplicados: no se crea uq_billing_deposit_bez_tx. Limpiar y repetir.';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_deposit_bez_tx ON billing_transactions (LOWER(blockchain_tx_hash))
            WHERE type = 'deposit_bez' AND blockchain_tx_hash IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM billing_transactions WHERE type = 'deposit_fiat' AND stripe_payment_intent_id IS NOT NULL
               GROUP BY stripe_payment_intent_id HAVING COUNT(*) > 1) THEN
        RAISE WARNING 'billing_transactions tiene PaymentIntents duplicados: no se crea uq_billing_deposit_fiat_intent. Limpiar y repetir.';
    ELSE
        CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_deposit_fiat_intent ON billing_transactions (stripe_payment_intent_id)
            WHERE type = 'deposit_fiat' AND stripe_payment_intent_id IS NOT NULL;
    END IF;
END $$;
