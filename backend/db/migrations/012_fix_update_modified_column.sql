-- ============================================================================
-- 012 · Función `update_modified_column()` que faltaba
-- ============================================================================
--
-- Las migraciones 008 y 009 crean siete disparadores que invocan
-- `update_modified_column()`, pero esa función no se define en ninguna
-- migración. Sobre una base de datos limpia, `psql` falla siete veces con
-- «function update_modified_column() does not exist» y los disparadores no
-- llegan a existir: `updated_at` nunca se actualiza en `users`,
-- `transactions`, `bezcoin_transactions`, `fiat_orders`, `bridge_shipments`,
-- `bridge_synced_items` ni `logistics_shipments`.
--
-- Esto define la función y vuelve a crear los disparadores de forma
-- idempotente, tanto para instalaciones nuevas como para las ya desplegadas.

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'bridge_shipments',
            'bridge_synced_items',
            'logistics_shipments',
            'bezcoin_transactions',
            'fiat_orders',
            'transactions',
            'users'
        ]) AS tabla
    LOOP
        -- Solo si la tabla existe y tiene columna updated_at.
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = t.tabla AND column_name = 'updated_at'
        ) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'update_' || t.tabla || '_modtime', t.tabla);
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_modified_column()',
                'update_' || t.tabla || '_modtime', t.tabla
            );
        END IF;
    END LOOP;
END;
$$;
