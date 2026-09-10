-- 056_onboarding_login.sql
--
-- Identificación de la persona en la pantalla, para el flujo `connect`.
--
-- EL HUECO QUE CIERRA
--
-- Los flujos `sdk_install` y `node_provision` los abre una herramienta MCP
-- AUTENTICADA, así que la sesión ya sabe de quién es: `app_id` viene puesto y no
-- hay nada que averiguar. `connect` es el caso contrario —quien lo usa todavía
-- no tiene clave, justamente porque viene a pedir una— y por eso se quedó sin
-- emitir cuando se hizo el resto.
--
-- Aquí la titularidad no se hereda: se demuestra. La persona se identifica en la
-- pantalla y sólo entonces se sabe qué organizaciones son suyas y con qué papel.
--
-- POR QUÉ user_id VA EN LA SESIÓN Y NO EN UNA TABLA APARTE
--
-- Porque su vida es exactamente la de la sesión: quince minutos, un uso y a la
-- basura. Una tabla de «logins de onboarding» sería un registro de sesiones de
-- usuario paralelo al de verdad, con su propia caducidad que mantener y su
-- propio riesgo de quedarse abierta. Aquí la caducidad ya existe y la hereda.
--
-- Y NO se emite ningún JWT en este flujo. La persona se identifica para que la
-- pantalla sepa qué organizaciones ofrecerle; el token de la URL sigue siendo la
-- única credencial en juego. Emitir además un JWT dejaría en ese navegador una
-- segunda credencial, de vida más larga, que nadie ha pedido.
--
-- intentos_login ES CONTRA LA FUERZA BRUTA
--
-- Este formulario está en internet y acepta correo y contraseña. El limitador
-- por IP no basta: una botnet reparte los intentos. El contador por sesión
-- convierte cada enlace en cinco oportunidades y se acabó — y como el enlace lo
-- crea una herramienta con su propio techo por IP y hora, conseguir más enlaces
-- también está acotado.

ALTER TABLE onboarding_sessions
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE onboarding_sessions
    ADD COLUMN IF NOT EXISTS intentos_login SMALLINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN onboarding_sessions.user_id IS
    'Persona identificada en la pantalla (sólo flujo connect). Vive lo que la sesión: 15 minutos.';
COMMENT ON COLUMN onboarding_sessions.intentos_login IS
    'Intentos fallidos de identificación. Al llegar al tope la sesión se cancela y hay que pedir otro enlace.';
