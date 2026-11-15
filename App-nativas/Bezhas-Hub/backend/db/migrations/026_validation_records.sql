-- Migration 026: registros de validación de contenido (antes, `Validation` de Mongo con un almacén EN MEMORIA de reserva).
--
-- Cuando Mongo no estaba conectado, el modelo guardaba las validaciones en un Map del proceso: se perdían al reiniciar, no
-- las compartían las instancias y con ellas se perdía la prueba del pago (sesión de Stripe + transacción en cadena). Ahora se
-- guardan siempre en Postgres y un fallo de la base ya no se disfraza de éxito.
--
-- Tabla nueva (`validation_records`): la `content_validations` de backend/migrations/001_create_validation_tables.sql nunca formó parte
-- de db/migrations (usa ids enteros y una tabla `content` que no existe) y no se toca.
-- Una sesión de pago valida UNA vez y una transacción en cadena se registra UNA vez (índices únicos parciales): un reintento del job
-- tras la confirmación en cadena ya no duplica el registro.
-- Revertir: DROP TABLE validation_records;
CREATE TABLE IF NOT EXISTS validation_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_hash VARCHAR(66) NOT NULL,
    author_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66),
    block_number BIGINT,
    payment_method VARCHAR(10) NOT NULL DEFAULT 'crypto' CHECK (payment_method IN ('crypto', 'fiat')),
    payment_session_id VARCHAR(255),
    payment_amount NUMERIC(20, 6),
    payment_currency VARCHAR(8),
    status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'confirmed', 'failed')),
    validation_type VARCHAR(10) NOT NULL DEFAULT 'post' CHECK (validation_type IN ('post', 'comment', 'content', 'document', 'reel', 'article')),
    content_uri TEXT,
    validated_by VARCHAR(40),                       -- 'backend-direct' | 'queue-worker' | 'oracle'
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    gas_used VARCHAR(40),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_validation_records_hash_status ON validation_records (content_hash, status);
CREATE INDEX IF NOT EXISTS idx_validation_records_author_status ON validation_records (author_address, status);
CREATE INDEX IF NOT EXISTS idx_validation_records_created ON validation_records (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_validation_records_session ON validation_records (payment_session_id) WHERE payment_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_validation_records_tx ON validation_records (LOWER(transaction_hash)) WHERE transaction_hash IS NOT NULL;
