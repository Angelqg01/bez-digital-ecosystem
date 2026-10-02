/**
 * Secreto JWT: única fuente para firmar/verificar tokens.
 *
 *  - Con JWT_SECRET configurado, se usa tal cual.
 *  - En producción sin JWT_SECRET (o con un valor de plantilla) se lanza un error: no hay valor por defecto.
 *  - Fuera de producción sin JWT_SECRET se genera un secreto ALEATORIO por proceso (los tokens
 *    dejan de valer al reiniciar). Nunca se usa un literal conocido que alguien pueda adivinar.
 */
const crypto = require('crypto');

const PLACEHOLDER = /change[-_ ]?(me|this)|your-super-secret|default[-_]secret|supersecret|bezhas_super_secret|local-dev-only/i;
let devSecret = null;

function getJwtSecret() {
    const configured = process.env.JWT_SECRET;
    const production = process.env.NODE_ENV === 'production';

    if (configured && !(production && PLACEHOLDER.test(configured))) return configured;

    if (production) throw new Error('JWT_SECRET no está configurado o es un valor de plantilla');

    if (!devSecret) {
        devSecret = crypto.randomBytes(48).toString('hex');
        if (process.env.NODE_ENV !== 'test') {
            console.warn('⚠️  JWT_SECRET no definido: se usa un secreto aleatorio solo para este proceso (las sesiones se pierden al reiniciar).');
        }
    }
    return devSecret;
}

/** Secreto de refresh: JWT_REFRESH_SECRET si existe; si no, derivado (HMAC) del JWT_SECRET. */
function getRefreshSecret() {
    if (process.env.JWT_REFRESH_SECRET) return process.env.JWT_REFRESH_SECRET;
    return crypto.createHmac('sha256', getJwtSecret()).update('bezhas:refresh-token:v1').digest('hex');
}

module.exports = { getJwtSecret, getRefreshSecret };
