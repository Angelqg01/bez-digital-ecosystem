-- ============================================================================
-- 019 — BezPay: comisión negociada por wallet
-- ============================================================================
-- Antes, la única forma de dar una tarifa preferente a una cuenta grande era
-- cambiar el 1,5% global en calculatePaymentAmounts() — lo que se lo cambia
-- a TODOS los clientes a la vez. Esta tabla permite fijar una tarifa distinta
-- para una wallet concreta sin tocar el valor por defecto de nadie más.
--
-- Sin fila para una wallet → se usa el 1,5%/0,5% de siempre (comportamiento
-- sin cambios). Con fila → esa wallet usa fee_rate en su lugar.

CREATE TABLE IF NOT EXISTS bezpay_fee_overrides (
    wallet_address   VARCHAR(42) PRIMARY KEY,
    fee_rate         NUMERIC(6, 5) NOT NULL,   -- p.ej. 0.01000 = 1%
    note             TEXT,                      -- por qué existe este acuerdo (auditoría)
    created_by       VARCHAR(255),              -- admin que lo dio de alta
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Una tarifa negativa no tiene sentido; por encima del 5% tampoco es una
    -- "tarifa preferente" — evita que un typo cobre de más o regale margen.
    CONSTRAINT bezpay_fee_override_range CHECK (fee_rate >= 0 AND fee_rate <= 0.05)
);

CREATE INDEX IF NOT EXISTS idx_bezpay_fee_overrides_updated
    ON bezpay_fee_overrides (updated_at);
