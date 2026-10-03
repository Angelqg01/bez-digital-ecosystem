-- 059_fiat_delivery_indexes.sql
--
-- Índice para el barrido de services/cardSettlementWorker: cada 10 minutos
-- busca las compras FIAT retenidas o pendientes de entrega. Sin índice era un
-- recorrido completo de payment_transactions, que crece con cada pago.
--
-- Parcial y con el MISMO predicado que la consulta, para que Postgres lo use y
-- ocupe sólo las filas vivas (las completadas salen del índice solas).
CREATE INDEX IF NOT EXISTS idx_payment_tx_entregas_pendientes
    ON payment_transactions (id)
    WHERE type = 'buy'
      AND status = 'processing'
      AND note LIKE '%"entrega"%';
