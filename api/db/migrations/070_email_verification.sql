-- 070_email_verification.sql
--
-- Confirmación de email al registrarse con usuario/email/contraseña.
--
-- Hasta ahora los emails de `users` no estaban verificados (ver 061), y por eso un plan comprado no se
-- asigna nunca por email. Con esta migración el titular confirma su dirección desde un enlace que le
-- llega por correo; ese enlace lo lleva a elegir plan y, tras pagar, de vuelta a la app donde estaba.
--
-- El token sólo se guarda como SHA-256 (la base no permite reconstruir un enlace), caduca a las 24 h y es
-- de un solo uso. `return_to` es la URL de la app de origen, ya validada contra bezhas.com al guardarla.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS email_verifications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  CHAR(64)    NOT NULL,
    return_to   TEXT,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_verifications_token ON email_verifications (token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications (user_id) WHERE used_at IS NULL;
