-- 071_starter_summaries.sql
--
-- Resúmenes del plan Starter (pago por uso): al acabar el ciclo, y poco antes de que termine la prueba de 15 días, se
-- manda un correo con el consumo y la comparación con los otros planes. Stripe reenvía los eventos hasta recibir un
-- 2xx; esta tabla es lo que impide mandar el mismo correo dos veces (una fila por factura o por prueba).

CREATE TABLE IF NOT EXISTS starter_summaries (
    key              TEXT PRIMARY KEY,                 -- invoice:<id> | trial:<subscription id>
    subscription_id  TEXT        NOT NULL,
    kind             VARCHAR(16) NOT NULL CHECK (kind IN ('cycle', 'trial')),
    sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
