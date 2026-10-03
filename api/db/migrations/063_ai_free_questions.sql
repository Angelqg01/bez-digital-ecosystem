-- 063_ai_free_questions.sql
--
-- Pregunta gratis del chat para visitantes sin sesión: una por visitante cada
-- 30 días; después, registro o login. Se controla en el servidor (borrar
-- datos del navegador no da otra). La clave es un HMAC de la IP con un secreto
-- del servidor: no se guarda la IP. used_at sirve además para el tope global
-- por hora (protección de coste frente a IPs rotativas).

CREATE TABLE IF NOT EXISTS ai_free_questions (
    key_hash CHAR(64)    PRIMARY KEY,
    used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_free_questions_used_at ON ai_free_questions(used_at);
