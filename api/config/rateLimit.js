'use strict';

/**
 * rateLimit — opciones del limitador global de la API.
 *
 * Vive en su propio módulo (como config/cors.js) para poder probarlo sin
 * arrancar la app. Tres decisiones, cada una por un fallo real:
 *
 * 1. Se agrupa SOLO por IP. Antes se agrupaba por la cabecera `x-api-key` si
 *    venía, sin comprobar que la clave existiese: cambiando la cabecera en
 *    cada petición, cualquiera tenía un cubo nuevo y el límite no limitaba
 *    nada. Las claves de verdad ya tienen su propio limitador por cliente
 *    (enterpriseRateLimit, middleware/security.js).
 *
 * 2. 1000 peticiones cada 15 min en producción, no 100. El panel refresca
 *    datos cada 10-30 s desde varios componentes a la vez: con 100, un cliente
 *    con la sesión abierta recibía 429 antes de diez minutos. Por encima queda
 *    Cloud Armor (600/min por IP) frente a abusos de verdad. RATE_LIMIT_MAX
 *    sigue mandando si se fija.
 *
 * 3. Los webhooks quedan fuera. Stripe y el banco envían desde un puñado de
 *    IPs compartidas por todos sus clientes; limitarlos por IP rechazaba
 *    confirmaciones de pago en cuanto había tráfico. Su autenticidad la
 *    garantiza la firma, que verifica cada ruta.
 */

const VENTANA_MS = 15 * 60 * 1000;
const MAX_PRODUCCION = 1000;
const MAX_DESARROLLO = 5000;
const IPS_LOCALES = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

// Tienen su propio control: el War Room su limitador y su token; los webhooks
// la firma del emisor.
const RUTAS_EXENTAS = ['/api/monitor', '/api/webhooks/'];

/**
 * @param {{ isProduction?: boolean, env?: Record<string, string|undefined> }} opts
 */
function globalLimiterOptions({ isProduction = false, env = process.env } = {}) {
    return {
        windowMs: VENTANA_MS,
        max: parseInt(env.RATE_LIMIT_MAX, 10) || (isProduction ? MAX_PRODUCCION : MAX_DESARROLLO),
        skip: (req) => (!isProduction && IPS_LOCALES.includes(req.ip))
            || RUTAS_EXENTAS.some((ruta) => req.path.startsWith(ruta)),
        message: { error: 'Too many requests, please try again later.', code: 'RATE_LIMIT_EXCEEDED' },
        standardHeaders: true,
        legacyHeaders: false,
        // Sin keyGenerator: express-rate-limit agrupa por req.ip, que con
        // TRUST_PROXY_HOPS es la IP real del visitante.
    };
}

module.exports = { globalLimiterOptions, MAX_PRODUCCION, RUTAS_EXENTAS };
