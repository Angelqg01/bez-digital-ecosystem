-- Migration 034: los pagos de proveedor externo entran en el libro mayor, y la
-- cola de reintentos deja de vivir en memoria.
--
-- CONTEXTO
-- El flujo de Stripe (routes/webhooks.js) minteaba BEZ directamente contra la
-- cadena sin dejar ninguna fila en payment_transactions. Consecuencias:
--
--   1. Los dos TODO de webhooks.js (`payment_intent.payment_failed` y
--      `charge.refunded`) no tenían dónde escribir: no existía la orden que
--      marcar como fallida ni la que reembolsar.
--   2. refundPayment() de services/paymentSettlement.js ya implementa el
--      reembolso completo (estado, nota y webhook payment.refunded), pero
--      necesita un paymentId — y un cargo de Stripe no tenía forma de resolverse
--      a uno.
--   3. Un pago cobrado por Stripe no aparecía en el histórico del usuario.
--
-- Estas columnas atan el evento del proveedor a la orden, de modo que el resto
-- de la máquina de estados (completed → refunded) ya existente sirve tal cual.

ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS provider          VARCHAR(20);
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS provider_event_id VARCHAR(255);
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS provider_charge_id VARCHAR(255);

-- Idempotencia dura: Stripe reintenta el mismo evento hasta recibir un 2xx, y
-- el guard en memoria de webhooks.js se pierde en cada redespliegue de Cloud Run.
-- Este índice hace que un evento repetido no pueda crear una segunda orden ni
-- aunque el proceso haya reiniciado entre medias.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_tx_provider_event
    ON payment_transactions (provider, provider_event_id)
    WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_tx_provider_charge
    ON payment_transactions (provider_charge_id)
    WHERE provider_charge_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Cola de reintentos persistente
--
-- Sustituye a la cola en memoria de webhooks.js ([REL-3], "stub BullMQ"). Esa
-- cola guardaba los minteos fallidos en un array del proceso: cada redespliegue
-- de Cloud Run — o cualquier reinicio de instancia — perdía silenciosamente los
-- pagos cobrados a los que aún no se les había entregado el BEZ.
--
-- No introduce BullMQ ni Redis a propósito: el estado ya está en Postgres, que
-- es el que sobrevive al reinicio, y varias instancias pueden competir por los
-- trabajos con el SELECT ... FOR UPDATE SKIP LOCKED del servicio.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_retry_jobs (
    id                SERIAL PRIMARY KEY,
    kind              VARCHAR(30)  NOT NULL DEFAULT 'mint',
    event_id          VARCHAR(255) NOT NULL,
    wallet_address    VARCHAR(42)  NOT NULL,
    amount_usd_cents  BIGINT       NOT NULL,
    attempt           INTEGER      NOT NULL DEFAULT 0,
    max_attempts      INTEGER      NOT NULL DEFAULT 5,
    status            VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'running', 'succeeded', 'exhausted')),
    next_attempt_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_error        TEXT,
    result_tx_hash    VARCHAR(66),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Un evento de Stripe genera como mucho un trabajo, pase lo que pase.
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_retry_event
    ON webhook_retry_jobs (kind, event_id);

-- El índice que sostiene el "dame el siguiente trabajo vencido".
CREATE INDEX IF NOT EXISTS idx_webhook_retry_due
    ON webhook_retry_jobs (status, next_attempt_at)
    WHERE status = 'pending';
