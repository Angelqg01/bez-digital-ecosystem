-- 051_revoke_seeded_dev_keys.sql
--
-- Invalida las claves de desarrollo que la migración 005 sembraba con su
-- secreto EN CLARO dentro del propio fichero versionado:
--
--     'core-internal-key'  → scope admin
--     'defi-dev-key'
--     'app-dev-key'
--     'web3-dev-key'
--
-- Cualquiera con acceso al repositorio calculaba el SHA-256 y entraba. Y
-- 'core-internal-key' lleva scope `admin`, que en middleware/address-access.js
-- salta la comprobación de titularidad: esa clave anulaba por sí sola el
-- control que impide leer los datos de otros clientes. Comprobado antes de
-- arreglarlo: devolvía HTTP 200 sobre /kyc/status de una dirección arbitraria.
--
-- La 005 ya no las siembra, pero eso solo protege a las instalaciones nuevas.
-- Esta migración se ocupa de las que ya corrieron aquella.
--
-- COMPARA POR HASH, no por nombre de app: si alguien ya rotó su clave a mano,
-- su hash no coincidirá y esta migración la deja en paz. Solo toca las que
-- siguen teniendo exactamente el valor publicado.

DO $$
DECLARE
    afectadas INTEGER;
BEGIN
    UPDATE app_registry
       SET api_key_hash = 'REVOKED_' || gen_random_uuid(),
           is_active    = FALSE,
           updated_at   = NOW()
     WHERE api_key_hash IN (
        encode(digest('core-internal-key', 'sha256'), 'hex'),
        encode(digest('defi-dev-key',      'sha256'), 'hex'),
        encode(digest('app-dev-key',       'sha256'), 'hex'),
        encode(digest('web3-dev-key',      'sha256'), 'hex')
     );

    GET DIAGNOSTICS afectadas = ROW_COUNT;

    IF afectadas > 0 THEN
        RAISE NOTICE '[051] % clave(s) de desarrollo revocadas y desactivadas.', afectadas;
        RAISE NOTICE '[051] Las apps que las usaran dejarán de autenticar. Para dar de alta una nueva:';
        RAISE NOTICE '[051]   UPDATE app_registry SET api_key_hash = encode(digest(''<clave>'',''sha256''),''hex''), is_active = TRUE WHERE app_name = ''<app>'';';
        RAISE NOTICE '[051] Genera la clave con: openssl rand -hex 32';
    ELSE
        RAISE NOTICE '[051] Ninguna clave sembrada seguía activa. Nada que revocar.';
    END IF;
END $$;
