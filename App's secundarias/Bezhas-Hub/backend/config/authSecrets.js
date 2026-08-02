/**
 * authSecrets — fuente ÚNICA del secreto y la vida de los JWT en el Hub.
 *
 * Antes cada archivo inventaba su propio fallback cuando faltaba JWT_SECRET:
 *   'default-secret-key'      (routes/auth.routes.js)
 *   'default-secret-change-me'(middleware/refreshTokenSystem.js)
 *   'bezhas_super_secret_key' (routes/adminRegister.routes.js)
 *   'default_secret'          (routes/developerConsole.routes.js)
 *   'bezhas-local-dev-only-secret' (middleware/verifyAdminJWT.js)
 * Con SSO entre SubApps eso significaba que un token emitido por una ruta no
 * verificaba en otra, y peor: en producción, si la variable no llegaba, el
 * servicio arrancaba firmando con un secreto que está en el repositorio —
 * cualquiera podía forjar un token de admin.
 *
 * Este módulo replica la semántica de api/config/secrets.js (mismo fallback de
 * desarrollo, misma negativa a arrancar en producción) para que un token
 * emitido por la API core valide en el Hub y viceversa.
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Debe coincidir con api/config/secrets.js o el SSO entre servicios se rompe en dev.
const DEV_FALLBACK_SECRET = 'dev-only-secret';

const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? null : DEV_FALLBACK_SECRET);
if (!JWT_SECRET) {
    throw new Error(
        'FATAL: falta JWT_SECRET en producción. El despliegue lo inyecta desde Secret Manager ' +
        '(jwt-secret:latest, ver backend/app-secrets.yaml). Arrancar sin él significaría firmar ' +
        'tokens con un secreto público.',
    );
}

// Defensa en profundidad: nunca arrancar en producción con el secreto de dev.
if (IS_PRODUCTION && JWT_SECRET === DEV_FALLBACK_SECRET) {
    throw new Error('FATAL: JWT_SECRET tiene el valor de desarrollo en producción. Rótalo antes de desplegar.');
}

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;

// Mismo TTL que el resto del ecosistema (ver api/config/secrets.js).
const JWT_ACCESS_TTL = process.env.JWT_ACCESS_TTL || '24h';
const JWT_REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d';

module.exports = {
    JWT_SECRET,
    JWT_REFRESH_SECRET,
    JWT_ACCESS_TTL,
    JWT_REFRESH_TTL,
    IS_PRODUCTION,
    DEV_FALLBACK_SECRET,
};
