-- 075_funnel_events.sql
--
-- Eventos del embudo del chat (disparadores proactivos → cuestionario → alta).
--
-- Para qué: sustituir las hipótesis de conversión por datos propios. Cuántos ven el aviso, cuántos
-- lo abren, cuántos terminan el cuestionario y cuántos llegan a la pantalla segura.
--
-- Qué NO se guarda, a propósito:
--   · Ningún texto libre: ni mensajes del chat, ni emails, ni respuestas del cuestionario. Cada
--     columna es un enumerado o un valor acotado y la ruta valida contra una lista cerrada.
--   · Ningún identificador persistente de la persona. `sid` es un aleatorio de la pestaña
--     (sessionStorage) que deja de existir al cerrarla: sirve para contar un embudo, no para seguir
--     a nadie entre visitas.
--   · Ninguna IP.
--   · La query string de la URL (puede llevar tokens): solo la ruta.
--
-- `source` (utm_source) solo se rellena en modo «personalized», es decir, con consentimiento de
-- cookies aceptado en el banner. En modo «contextual» llega NULL.

CREATE TABLE IF NOT EXISTS funnel_events (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    event       VARCHAR(40)  NOT NULL,
    trigger_id  VARCHAR(40),
    step        VARCHAR(40),
    path        VARCHAR(120) NOT NULL,
    mode        VARCHAR(16)  NOT NULL CHECK (mode IN ('contextual', 'personalized')),
    sid         VARCHAR(36)  NOT NULL,
    source      VARCHAR(40)
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_created ON funnel_events (created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_events_event   ON funnel_events (event, created_at);
