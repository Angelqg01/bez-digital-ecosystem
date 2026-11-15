-- Migration 027: recompensas en el libro de BEZ con idempotencia, logros y ocultación automática de posts.
--
-- Hasta ahora el oráculo de calidad y las automatizaciones repartían BEZ con `User.update(id, {$inc: {bezBalance}})`, una
-- operación de Mongo que el usuario de Postgres no entiende (no se pagaba nada) y que, de haber funcionado, no tenía ninguna barrera
-- contra pagar dos veces. Ahora cada recompensa es un asiento EARN en `bezcoin_transactions` con una CLAVE DE IDEMPOTENCIA:
-- el índice único hace imposible abonar dos veces lo mismo (el mismo post, el mismo bono del día, el mismo logro).
-- Revertir: DROP INDEX uq_bezcoin_idempotency; DROP TABLE user_achievements; ALTER TABLE posts DROP COLUMN hidden_reason, DROP COLUMN hidden_at;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bezcoin_idempotency ON bezcoin_transactions ((metadata ->> 'idempotencyKey'))
    WHERE metadata ? 'idempotencyKey';

ALTER TABLE posts ADD COLUMN IF NOT EXISTS hidden_reason TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge VARCHAR(80) NOT NULL,
    reward NUMERIC(20, 6) NOT NULL DEFAULT 0 CHECK (reward >= 0),
    unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_achievement UNIQUE (user_id, badge)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements (user_id);
