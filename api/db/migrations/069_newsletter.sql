-- 069_newsletter.sql
--
-- Suscripciones a la newsletter con DOBLE CONFIRMACIÓN (RGPD / LSSI).
--
-- Pedir la suscripción no suscribe: crea una fila `pending` y manda un correo con un
-- enlace; sólo al confirmarlo desde ese correo pasa a `confirmed`. Así nadie puede
-- apuntar a un tercero. Se guarda cuándo, desde qué canal y con qué texto se
-- consintió, que es lo que habrá que enseñar si alguien lo discute.
--
-- Los tokens (confirmar y darse de baja) sólo se guardan como SHA-256: la base no
-- permite reconstruir un enlace.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id                 BIGSERIAL PRIMARY KEY,
    email              VARCHAR(254) NOT NULL,
    status             VARCHAR(16)  NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
    confirm_token_hash CHAR(64),
    unsub_token_hash   CHAR(64)     NOT NULL,
    language           VARCHAR(8),
    source             VARCHAR(40)  NOT NULL,          -- telegram | email | chat | web
    consent_text       TEXT         NOT NULL,
    requested_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    confirmed_at       TIMESTAMPTZ,
    unsubscribed_at    TIMESTAMPTZ
);

-- Una dirección, una fila (sin distinguir mayúsculas).
CREATE UNIQUE INDEX IF NOT EXISTS uq_newsletter_email ON newsletter_subscribers (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_newsletter_confirm ON newsletter_subscribers (confirm_token_hash)
    WHERE confirm_token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_newsletter_unsub ON newsletter_subscribers (unsub_token_hash);
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers (status);
