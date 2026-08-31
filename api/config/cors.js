/**
 * cors — quién puede llamar a esta API desde un navegador.
 *
 * Las SubApps (Sphere, PureScan, Energy, Genesis, Pay…) autentican contra
 * /api/auth/* desde su propio origen. La allowlist anterior era una enumeración
 * a mano de 4 dominios y 5 puertos locales, ninguno de ellos de una SubApp, así
 * que su login moría en el preflight — sin ningún error en el servidor, sólo un
 * "Failed to fetch" en el navegador. Aquí se resuelve por patrón, y lo que no
 * encaje se añade por env (CORS_EXTRA_ORIGINS) en vez de tocando código.
 *
 * Vive en su propio módulo para poder testearlo sin arrancar la app entera.
 */

/** Cualquier subdominio de bez.digital, y el dominio raíz. Sólo https. */
const PROD_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)*bez\.digital$/;

/**
 * En desarrollo cada SubApp levanta su propio puerto de Vite (3004, 3010-3020…);
 * enumerarlos obligaba a tocar este archivo cada vez que nace una app.
 */
const DEV_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** Orígenes extra separados por comas, para lo que no encaje en los patrones. */
function parseExtraOrigins(raw) {
    return String(raw || '').split(',').map(o => o.trim()).filter(Boolean);
}

/**
 * @param {string} origin — cabecera Origin de la petición.
 * @param {{ isProduction?: boolean, extraOrigins?: string[] }} opts
 */
function isAllowedOrigin(origin, { isProduction = false, extraOrigins = [] } = {}) {
    if (!origin || typeof origin !== 'string') return false;
    if (extraOrigins.includes(origin)) return true;
    if (PROD_ORIGIN_RE.test(origin)) return true;
    // Los orígenes locales sólo valen fuera de producción: en producción, un
    // http://localhost permitido sería una vía para que una página local
    // hablase con la API real del usuario.
    return !isProduction && DEV_ORIGIN_RE.test(origin);
}

/**
 * Construye la opción `origin` que espera el paquete `cors`.
 * Sin cabecera Origin = misma máquina (curl, health checks, SSR): no es una
 * petición de navegador, así que CORS no aplica y se deja pasar.
 */
function makeCorsOriginFn(opts = {}) {
    return function corsOrigin(origin, callback) {
        if (!origin) return callback(null, true);
        if (isAllowedOrigin(origin, opts)) return callback(null, true);
        return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    };
}

module.exports = {
    PROD_ORIGIN_RE,
    DEV_ORIGIN_RE,
    parseExtraOrigins,
    isAllowedOrigin,
    makeCorsOriginFn,
};
