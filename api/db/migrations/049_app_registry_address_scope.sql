-- 049_app_registry_address_scope.sql
--
-- Vincula una api-key del Gateway con las direcciones que tiene derecho a
-- consultar, y arregla con ello una fuga de datos entre clientes.
--
-- EL PROBLEMA
--
-- Siete rutas del Gateway aceptan una dirección como parámetro y devuelven sus
-- datos sin comprobar de quién es. Dos de ellas no son datos de cadena:
--
--   GET /payments/history/:address  tipo, importe, método, destinatario, NOTA y
--                                   tx de cualquiera. Registros internos.
--   GET /kyc/status/:address        nivel KYC, proveedor, fecha de verificación
--                                   y volumen acumulado en USD. Dato personal y
--                                   de cumplimiento.
--
-- Bastaba una api-key con scope `wallet` y una dirección —que es pública en
-- cadena— para leer los pagos y el KYC de cualquier otro cliente.
--
-- La causa era que no había con qué comparar: `app_registry` guardaba nombre,
-- hash de la clave, scopes y tarifa, pero ningún titular. La clave identificaba
-- una APP, no a un dueño de datos.
--
-- LA SOLUCIÓN
--
-- Tres formas de acreditar el derecho a una dirección, de más común a más
-- excepcional:
--
--   1. El JWT del usuario final. Es el caso del frontend: el usuario conecta su
--      wallet, la app manda su token y la dirección consultada es la suya.
--      authenticateGateway YA rellena req.user en ese caso — las rutas
--      simplemente no lo miraban. No requiere ninguna columna.
--   2. enterprise_id: la clave pertenece a una empresa, y se aceptan las
--      direcciones de esa empresa.
--   3. authorized_addresses: lista explícita, para integraciones que operan
--      sobre direcciones concretas sin usuario detrás.

ALTER TABLE app_registry
    ADD COLUMN IF NOT EXISTS enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL;

ALTER TABLE app_registry
    ADD COLUMN IF NOT EXISTS authorized_addresses TEXT[] NOT NULL DEFAULT '{}';

-- Modo de aplicación, por clave.
--
--   strict — por defecto y para toda clave nueva. Sin acreditación, 403.
--   legacy — deja pasar Y REGISTRA UN AVISO en cada uso. Es una salida de
--            emergencia para desatascar una integración concreta mientras se
--            arregla, no un estado en el que quedarse. Se avisa en cada
--            petición justamente para que moleste y no se olvide.
--
-- No hay valor 'off': una clave o está protegida o está dejando rastro de que
-- no lo está.
ALTER TABLE app_registry
    ADD COLUMN IF NOT EXISTS address_access_mode VARCHAR(10) NOT NULL DEFAULT 'strict'
        CHECK (address_access_mode IN ('strict', 'legacy'));

CREATE INDEX IF NOT EXISTS idx_app_registry_enterprise ON app_registry(enterprise_id);

COMMENT ON COLUMN app_registry.enterprise_id IS
    'Empresa titular de la clave. Sus direcciones son consultables por ella.';
COMMENT ON COLUMN app_registry.authorized_addresses IS
    'Direcciones concretas que esta clave puede consultar, además de las de su empresa.';
COMMENT ON COLUMN app_registry.address_access_mode IS
    'strict: sin acreditación, 403. legacy: pasa pero deja aviso en cada uso.';
