-- 053_onboarding_connect.sql
--
-- Añade el flujo `connect`: conectar la IA de un cliente QUE YA TIENE CUENTA.
--
-- POR QUÉ NO ENTRABA EN LA 052
--
-- La 052 cubrió el alta de quien todavía no es cliente. Faltaba el caso
-- inverso, que en la práctica es más frecuente: la empresa ya está dada de
-- alta, pero acaba de cambiar de IA, ha entrado alguien nuevo, o quiere el
-- conector en otro equipo. Sin este flujo, esa persona tenía que salir del chat,
-- buscar el panel, iniciar sesión y copiar una clave a mano — exactamente el
-- recorrido que este trabajo viene a eliminar.
--
-- QUÉ CAMBIA Y QUÉ NO
--
-- Sólo se amplía la lista cerrada de `kind`. La sesión de conexión se comporta
-- igual que las demás: token hasheado, un uso, caducidad corta, y la persona se
-- identifica en la pantalla.
--
-- Lo que NO cambia, y es lo que importa: la credencial que se emita al final de
-- ese login NO vuelve por el MCP. El agente se entera de que la sesión está
-- «completado» y de nada más. Si la clave viajara en la respuesta de una
-- herramienta, acabaría en el contexto del modelo y en el historial del chat, y
-- entonces daría igual lo bien hecho que estuviera el resto.

ALTER TABLE onboarding_sessions
    DROP CONSTRAINT IF EXISTS onboarding_sessions_kind_check;

ALTER TABLE onboarding_sessions
    ADD CONSTRAINT onboarding_sessions_kind_check CHECK (kind IN (
        'signup', 'connect', 'sdk_install', 'erp_integration',
        'node_provision', 'bank_setup'
    ));
