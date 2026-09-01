'use strict';

/**
 * middleware/address-access.js — Quién puede consultar los datos de qué dirección.
 *
 * Siete rutas del Gateway aceptan una dirección por la URL y devolvían sus
 * datos sin comprobar de quién era. Con scope `wallet` y una dirección —que es
 * pública en cadena— se leían los pagos y el KYC de cualquier otro cliente.
 *
 * Aquí está la comprobación que faltaba. Tres formas de acreditar el derecho,
 * de la más común a la más excepcional:
 *
 *   1. El JWT del usuario final. Es el caso del frontend: el usuario conecta su
 *      wallet y consulta lo suyo. `authenticateGateway` YA dejaba req.user
 *      montado; las rutas no lo miraban. Es la vía natural y no necesitó
 *      ninguna columna nueva.
 *   2. La empresa titular de la clave (app_registry.enterprise_id).
 *   3. Una lista explícita de direcciones en la clave.
 *
 * Y una cuarta que no es acreditación sino privilegio: el scope `admin`, que
 * llevan las claves internas de BeZhas. Va aparte y se registra.
 *
 * FALLA CERRADO. Si no se puede acreditar, es 403 — no un resultado vacío. Un
 * 404 o una lista vacía serían indistinguibles de «esa dirección no tiene
 * datos», y eso convierte la respuesta en un oráculo para enumerar direcciones
 * con actividad.
 */

const { query } = require('../db/pool');
const logger = require('../utils/logger');

/** Caché breve de direcciones por empresa. Evita dos consultas por petición. */
const CACHE_TTL_MS = parseInt(process.env.ADDRESS_SCOPE_CACHE_MS || '30000', 10);
const cacheEmpresa = new Map();

const normalizar = (a) => (typeof a === 'string' ? a.trim().toLowerCase() : null);

/**
 * Direcciones que pertenecen a una empresa: la de su gas tank y la del usuario
 * dueño. Se cachea poco tiempo: cambian rara vez, pero un permiso revocado no
 * puede tardar minutos en dejar de valer.
 */
async function direccionesDeEmpresa(enterpriseId) {
    if (!enterpriseId) return [];

    const enCache = cacheEmpresa.get(enterpriseId);
    if (enCache && Date.now() - enCache.at < CACHE_TTL_MS) return enCache.addrs;

    try {
        const { rows } = await query(
            `SELECT LOWER(e.gas_tank_address) AS addr
               FROM enterprises e WHERE e.id = $1 AND e.gas_tank_address IS NOT NULL
             UNION
             SELECT LOWER(u.wallet_address)
               FROM enterprises e JOIN users u ON u.id = e.user_id
              WHERE e.id = $1 AND u.wallet_address IS NOT NULL
             UNION
             SELECT LOWER(u.primary_wallet_address)
               FROM enterprises e JOIN users u ON u.id = e.user_id
              WHERE e.id = $1 AND u.primary_wallet_address IS NOT NULL`,
            [enterpriseId]
        );
        const addrs = rows.map((r) => r.addr).filter(Boolean);
        cacheEmpresa.set(enterpriseId, { addrs, at: Date.now() });
        return addrs;
    } catch (err) {
        // Un fallo al resolver la pertenencia NO puede convertirse en permiso.
        logger.error({ enterpriseId, error: err.message }, 'address scope lookup failed');
        return [];
    }
}

/**
 * ¿Puede esta petición leer los datos de `address`?
 * Devuelve { permitido, via, modo }.
 */
async function puedeAcceder(req, address) {
    const objetivo = normalizar(address);
    if (!objetivo) return { permitido: false, via: 'direccion-invalida' };

    const app = req.registeredApp || null;
    const user = req.user || null;

    // 1. El usuario final consulta lo suyo, y lo ha demostrado con su JWT.
    const propias = [user?.address, user?.wallet_address, user?.primary_wallet_address]
        .map(normalizar).filter(Boolean);
    if (propias.includes(objetivo)) return { permitido: true, via: 'jwt-usuario' };

    if (!app) return { permitido: false, via: 'sin-titular' };

    // 2. Clave interna de BeZhas. Privilegio, no acreditación: se registra.
    if (Array.isArray(app.scopes) && app.scopes.includes('admin')) {
        logger.info({ appId: app.id, address: objetivo }, 'address access via admin scope');
        return { permitido: true, via: 'admin' };
    }

    // 3. Lista explícita en la clave.
    const explicitas = (app.authorizedAddresses || []).map(normalizar).filter(Boolean);
    if (explicitas.includes(objetivo)) return { permitido: true, via: 'lista-explicita' };

    // 4. Direcciones de la empresa titular.
    const deEmpresa = await direccionesDeEmpresa(app.enterpriseId);
    if (deEmpresa.includes(objetivo)) return { permitido: true, via: 'empresa' };

    return { permitido: false, via: 'sin-acreditar', modo: app.addressAccessMode || 'strict' };
}

/**
 * Middleware para rutas con `:address`. Colocar DESPUÉS de requireScope.
 *
 * El scope dice «esta clave puede usar la función de pagos»; esto dice «…sobre
 * ESTA dirección». Son controles distintos y hacen falta los dos: tener el
 * scope `wallet` nunca debió significar poder leer la cartera de cualquiera.
 */
function requireAddressAccess(paramName = 'address') {
    return async (req, res, next) => {
        const address = req.params[paramName];
        const resultado = await puedeAcceder(req, address);

        if (resultado.permitido) return next();

        const app = req.registeredApp;

        // Modo legacy: pasa, pero deja rastro en cada uso. Es una salida de
        // emergencia para desatascar una integración concreta, no un sitio
        // donde quedarse — por eso avisa siempre y no una vez.
        if (app?.addressAccessMode === 'legacy') {
            logger.warn(
                { appId: app.id, appName: app.name, address: normalizar(address), path: req.path },
                'ACCESO A DIRECCIÓN AJENA PERMITIDO POR MODO LEGACY — vincula la clave a su titular y pásala a strict'
            );
            return next();
        }

        logger.warn(
            { appId: app?.id, appName: app?.name, address: normalizar(address), path: req.path, via: resultado.via },
            'address access denied'
        );

        // 403 y no 404: un 404 o una lista vacía serían indistinguibles de
        // «esa dirección no tiene datos», y eso permite enumerar direcciones
        // con actividad a base de probar.
        return res.status(403).json({
            error: 'No tienes acceso a los datos de esa dirección.',
            code: 'ADDRESS_ACCESS_DENIED',
        });
    };
}

/** Para pruebas: vacía la caché de pertenencia. */
function _resetCache() { cacheEmpresa.clear(); }

module.exports = { requireAddressAccess, puedeAcceder, _resetCache };
