-- ============================================================================
-- 017 — BezPay: candado de liquidación
-- ============================================================================
-- El webhook de BezPay (POST /api/payment/webhook) lo llama el navegador del
-- pagador. Sin estas dos garantías, la misma TX podía canjearse N veces (una
-- carrera de N peticiones simultáneas dispensaba N veces el BEZ):
--
--   1. tx_hash único  → una TX liquida como mucho un pago.
--   2. settled_at     → marca de "valor ya entregado", puesta con un UPDATE
--                       condicional que actúa de lock optimista.
--
-- Ambas son idempotentes: se pueden aplicar sobre una BD ya poblada.

-- 1. Unicidad de tx_hash. Parcial: las órdenes 'pending' aún no tienen hash, y
--    varias filas con NULL no colisionan en un índice único normal de Postgres,
--    pero se deja explícito para que la intención se lea sola.
--    Si hubiera duplicados históricos, este índice fallará: revísalos antes con
--      SELECT tx_hash, count(*) FROM payments
--      WHERE tx_hash IS NOT NULL GROUP BY tx_hash HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_tx_hash_unique
    ON payments (tx_hash)
    WHERE tx_hash IS NOT NULL;

-- 2. Instante en el que se entregó el valor (dispensado de BEZ, alta de VIP…).
--    NULL = aún no se ha entregado nada por esta orden.
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE;

-- 3. Pagador real leído de la cadena (tx.from), que puede diferir del
--    wallet_address declarado al crear la orden. Se guarda para auditoría.
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS verified_payer VARCHAR(42);

CREATE INDEX IF NOT EXISTS idx_payments_settled_at
    ON payments (settled_at)
    WHERE settled_at IS NOT NULL;
