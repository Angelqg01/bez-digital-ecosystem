-- 020_bezpay_entrega_intencion.sql
--
-- La entrega de BEZ por pagos FIAT ya no sale del hot wallet: se pide a la
-- capa de seguridad de la API como intención (metadata.entrega). Este índice
-- sirve al seguimiento periódico de las entregas pendientes de aprobación
-- (PaymentPG.findPendingDeliveries), que si no recorrería toda la tabla.
CREATE INDEX IF NOT EXISTS idx_payments_entrega_pendiente
    ON payments (updated_at)
    WHERE status = 'processing'
      AND settled_at IS NOT NULL
      AND (metadata->'entrega'->>'estado') = 'pendiente_aprobacion';
