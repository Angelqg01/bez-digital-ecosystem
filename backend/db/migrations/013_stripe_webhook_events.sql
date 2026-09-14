-- ============================================================================
-- 013 · Registro de eventos de Stripe ya procesados (idempotencia)
-- ============================================================================
--
-- Stripe entrega cada webhook **al menos una vez**: reintenta ante un 5xx, un
-- 429, un timeout o una respuesta que no llega, con reintentos escalonados
-- durante hasta tres días. Nada en el backend distinguía una entrega nueva de
-- una repetida, así que un `checkout.session.completed` reintentado volvía a
-- ejecutar `processFiatPayment` y transfería los BEZ **otra vez**. Dinero real,
-- dos veces.
--
-- Esta tabla es el registro de lo ya procesado. La clave primaria es el id del
-- evento de Stripe (`evt_…`), que es estable entre reintentos: insertar es la
-- operación que decide quién procesa. Si el INSERT choca con la clave, es una
-- repetición y se contesta 200 sin volver a tocar nada.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    -- Id del evento en Stripe (evt_...). Estable entre reintentos.
    event_id        VARCHAR(255) PRIMARY KEY,
    event_type      VARCHAR(100) NOT NULL,
    -- 'processing' mientras corre, 'processed' al terminar bien, 'failed' si
    -- se agotó sin éxito. Un 'processing' viejo se puede reclamar: ver
    -- `claimEvent` en routes/stripe-webhook.routes.js.
    status          VARCHAR(20)  NOT NULL DEFAULT 'processing',
    attempts        INTEGER      NOT NULL DEFAULT 1,
    last_error      TEXT,
    -- Para reconciliar a mano si hiciera falta.
    payload_digest  VARCHAR(64),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Para encontrar rápido lo que quedó a medias o falló.
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
    ON stripe_webhook_events (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type
    ON stripe_webhook_events (event_type, created_at DESC);

DROP TRIGGER IF EXISTS update_stripe_webhook_events_modtime ON stripe_webhook_events;
CREATE TRIGGER update_stripe_webhook_events_modtime
    BEFORE UPDATE ON stripe_webhook_events
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
