-- ============================================================================
-- 015 · Facturación de planes con Stripe en la tabla de usuarios
-- ============================================================================
--
-- El plan vigente se guarda en `users.subscription` (ya existía, por defecto
-- 'FREE'): es lo que leen el chat, el RAG y las APIs para decidir qué función
-- está disponible. Estas columnas guardan lo que hace falta para mantenerlo al
-- día desde los webhooks de Stripe (alta, renovación, cancelación) y para abrir
-- el portal de facturación del cliente.
--
-- Antes `subscription.service.js` intentaba escribir `subscription_tier`,
-- `subscription_expires_at`, `stripe_customer_id` y `stripe_subscription_id`
-- en `users`, columnas que no existían: un pago llegaba y el plan no se activaba.
-- ============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS subscription_expires_at     TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS subscription_started_at     TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS subscription_source         VARCHAR(50),
    ADD COLUMN IF NOT EXISTS subscription_billing_cycle  VARCHAR(10),
    ADD COLUMN IF NOT EXISTS stripe_customer_id          VARCHAR(255),
    ADD COLUMN IF NOT EXISTS stripe_subscription_id      VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer     ON users (stripe_customer_id)     WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription ON users (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
