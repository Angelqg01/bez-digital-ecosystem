-- 050_link_first_party_apps.sql
--
-- Da titular a las apps de primera parte de BeZhas, para que la comprobación
-- de la migración 049 (middleware/address-access.js) las deje operar sobre las
-- direcciones de plataforma sin abrir la puerta a las demás.
--
-- Tras la 049 estas claves quedaron en `strict` sin titular, así que recibían
-- 403 en las siete rutas con `:address`. Esto las vincula.
--
-- OJO con bezhas-web3: esto NO es la solución completa. Es un frontend, y sus
-- usuarios consultan CADA UNO su propia dirección, no las de la plataforma.
-- Para eso la vía es el JWT del usuario final, que address-access.js ya acepta
-- y que no necesita ninguna fila aquí. Esta vinculación solo cubre lo que la
-- app consulta EN NOMBRE DE LA PLATAFORMA: tesorería, pools, contratos.

-- Empresa titular. WHERE NOT EXISTS y no ON CONFLICT: `name` no es única, así
-- que un ON CONFLICT no evitaría el duplicado en una segunda pasada.
INSERT INTO enterprises (name, sector, tier, gas_tank_address, is_active)
SELECT 'BeZhas', 'fintech', 'enterprise', '0x52Df82920CBAE522880dD7657e43d1A754eD044E', TRUE
WHERE NOT EXISTS (SELECT 1 FROM enterprises WHERE name = 'BeZhas');

-- Direcciones de plataforma que estas apps consultan legítimamente para pintar
-- tesorería, staking y bridge. En minúsculas: la comparación normaliza, pero
-- guardarlas ya normalizadas evita sorpresas si alguien las lee a ojo.
UPDATE app_registry SET
    enterprise_id = (SELECT id FROM enterprises WHERE name = 'BeZhas' LIMIT 1),
    authorized_addresses = ARRAY[
        '0x89c23890c742d710265dd61be789c71dc8999b12',  -- Treasury DAO
        '0x3efc42095e8503d41ad8001328fc23388e00e8a3',  -- QualityEscrow / Safe
        '0x52df82920cbae522880dd7657e43d1a754ed044e',  -- Hot Wallet
        '0xecba873b534c54de2b62acde232adca4369f11a8',  -- BEZ token (Polygon)
        '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55'   -- BEZ token (BNB Chain)
    ],
    address_access_mode = 'strict',
    updated_at = NOW()
WHERE app_name IN ('bezhas-web3', 'bezhas-defi');
