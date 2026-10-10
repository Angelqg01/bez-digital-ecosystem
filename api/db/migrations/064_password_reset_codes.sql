-- Migration 064: códigos de recuperación de contraseña (un solo uso, caducan, intentos limitados).
-- Sólo se guarda el hash del código; el código en claro viaja únicamente por email.
CREATE TABLE IF NOT EXISTS password_reset_codes (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   CHAR(64)    NOT NULL,
    attempts    SMALLINT    NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_codes (user_id, created_at DESC);
