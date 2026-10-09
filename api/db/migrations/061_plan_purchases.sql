-- 061_plan_purchases.sql
--
-- Cada compra de plan (Payment Link con metadata.plan_id) queda registrada,
-- tenga o no app asignada. Antes, una compra sin client_reference_id sólo
-- dejaba un aviso en el log: el cliente pagaba y el plan no se activaba nunca.
--
-- ASIGNACIÓN
--   client_reference_id → la app viene en el enlace (el Hub la añade).
--   reclamo             → el titular de la organización presenta el id de la
--                         sesión de Checkout (sólo lo recibe quien pagó, en la
--                         URL de vuelta) y elige una app suya.
-- No se asigna por email: los emails de `users` no están verificados y
-- cualquiera podría registrar el del comprador para quedarse el plan.
--
-- CICLO DE VIDA
--   customer.subscription.updated/deleted y el reembolso completo actualizan
--   `status` aquí y en gateway_subscriptions (por stripe_subscription_id).

CREATE TABLE IF NOT EXISTS plan_purchases (
    id                     BIGSERIAL PRIMARY KEY,
    stripe_account         VARCHAR(20) NOT NULL DEFAULT 'principal',
    checkout_session_id    TEXT        NOT NULL UNIQUE,
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    customer_email         TEXT,
    plan_id                VARCHAR(40) NOT NULL,
    billing                VARCHAR(10) NOT NULL DEFAULT 'monthly',
    app_id                 UUID REFERENCES app_registry(id) ON DELETE SET NULL,
    assigned_via           VARCHAR(30),
    status                 VARCHAR(20) NOT NULL DEFAULT 'pending_assignment'
                           CHECK (status IN ('pending_assignment', 'active', 'past_due', 'canceled', 'refunded')),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_purchases_subscription ON plan_purchases(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_plan_purchases_customer ON plan_purchases(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_plan_purchases_pending ON plan_purchases(status) WHERE status = 'pending_assignment';
CREATE INDEX IF NOT EXISTS idx_gateway_subscriptions_stripe_sub ON gateway_subscriptions(stripe_subscription_id);
