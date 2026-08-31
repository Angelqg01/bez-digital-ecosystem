-- ============================================================================
-- 018 — BezPay: retención antes de entregar BEZ en pagos fiat
-- ============================================================================
-- Entregar BEZ es irreversible; cobrar en fiat no lo es. Una tarjeta admite
-- contracargo y un adeudo SEPA admite devolución, así que entregar en el
-- instante del cobro regala tokens a quien luego revierta el pago.
--
-- El pago pasa a quedar retenido: se registra, se deja madurar el plazo propio
-- de su medio de pago y sólo entonces se entrega, comprobando antes que no haya
-- disputa ni reembolso.

-- Momento a partir del cual la orden puede entregarse. NULL = no procede
-- (pagos cripto, que ya son firmes al confirmarse en cadena).
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS hold_until TIMESTAMP WITH TIME ZONE;

-- Referencia del cobro en el proveedor (Stripe checkout session / payment
-- intent). Es la clave que impide acreditar dos veces el mismo cobro.
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS provider_reference VARCHAR(255);

-- Motivo por el que una orden cobrada NO debe entregarse (disputa, reembolso,
-- revisión manual). Con esto puesto, el liberador la ignora para siempre.
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS settlement_blocked_reason TEXT;

-- Medio de pago, que determina el plazo de retención aplicado.
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS payment_method_kind VARCHAR(32);

-- Un cobro del proveedor acredita como mucho una orden.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_reference_unique
    ON payments (provider_reference)
    WHERE provider_reference IS NOT NULL;

-- El liberador barre por aquí: órdenes cobradas, con plazo cumplido y sin
-- entregar todavía.
CREATE INDEX IF NOT EXISTS idx_payments_hold_release
    ON payments (hold_until)
    WHERE hold_until IS NOT NULL AND settled_at IS NULL;
