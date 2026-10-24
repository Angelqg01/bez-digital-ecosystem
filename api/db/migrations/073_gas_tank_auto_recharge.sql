-- 073_gas_tank_auto_recharge.sql
--
-- Auto-recarga del Gas Tank con el método de pago guardado de la organización
-- (organization_billing_profiles). `last_auto_attempt_at` hace de cerrojo entre
-- instancias de la API: sólo una reclama cada intento (y no se reintenta a
-- diario un cobro rechazado).

ALTER TABLE gas_tank_accounts
    ADD COLUMN IF NOT EXISTS last_auto_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_auto_error      TEXT;
