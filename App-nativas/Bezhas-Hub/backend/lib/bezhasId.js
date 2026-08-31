/**
 * bezhasId — formato CANÓNICO del BeZhas_ID para todo el ecosistema.
 *
 *   BZ-XXXXXXXXXX   (prefijo + 10 chars Crockford base32, sin I/L/O/U)
 *
 * Antes convivían dos formatos: `BEZ-XXXXXXXX-XXXXXXXX` (hex, columna
 * users.bezhas_id de la API core) y `BZ-XXXXXXXXXX` (tabla `identities` del
 * Hub). Una misma persona podía acabar con dos identidades distintas según por
 * dónde entrase. El canónico es el del Hub: alfabeto sin caracteres ambiguos,
 * más corto de dictar por teléfono, y ya referenciado por
 * `memberships.bezhas_id` y `api_keys.bezhas_id`.
 *
 * ESTE ARCHIVO ESTÁ DUPLICADO A PROPÓSITO en:
 *   - api/lib/bezhasId.js
 *   - App-nativas/Bezhas-Hub/backend/lib/bezhasId.js
 * Cada servicio se empaqueta en su propio contenedor, así que no pueden
 * compartir un require() relativo. Si tocas uno, toca el otro: el test
 * `bezhasId.test.js` de cada lado comprueba que ambos generan el mismo formato.
 */
const crypto = require('crypto');

/** Crockford base32: 32 símbolos, sin I, L, O ni U (se confunden con 1, 0 y V). */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ID_LENGTH = 10;
const PREFIX = 'BZ-';

/** Un BeZhas_ID canónico y bien formado. */
const CANONICAL_RE = /^BZ-[0-9A-HJKMNP-TV-Z]{10}$/;

/** El formato antiguo de la API core, que esta capa migra. */
const LEGACY_RE = /^BEZ-[0-9A-F]{8}-[0-9A-F]{8}$/i;

/**
 * Genera un BeZhas_ID nuevo. 10 símbolos sobre 32 = 50 bits de entropía.
 * 256 es múltiplo de 32, así que el `% 32` no introduce sesgo.
 */
function generateBezhasId() {
    const bytes = crypto.randomBytes(ID_LENGTH);
    let out = '';
    for (let i = 0; i < ID_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
    return PREFIX + out;
}

function isValidBezhasId(id) {
    return typeof id === 'string' && CANONICAL_RE.test(id);
}

function isLegacyBezhasId(id) {
    return typeof id === 'string' && LEGACY_RE.test(id);
}

/**
 * Corrige un ID tecleado a mano: mayúsculas, prefijo implícito y las
 * sustituciones estándar de Crockford (I/L→1, O→0, U→V). Devuelve null si aun
 * así no es un ID válido, para que quien llame decida si es un 400 o un 404.
 */
function normalizeBezhasId(input) {
    if (typeof input !== 'string') return null;
    let s = input.trim().toUpperCase().replace(/\s+/g, '');
    if (s.startsWith(PREFIX)) s = s.slice(PREFIX.length);
    s = s.replace(/[IL]/g, '1').replace(/O/g, '0').replace(/U/g, 'V');
    const candidate = PREFIX + s;
    return CANONICAL_RE.test(candidate) ? candidate : null;
}

/**
 * Convierte un ID legacy `BEZ-…` a su equivalente canónico, de forma
 * DETERMINISTA: el mismo legacy da siempre el mismo canónico. Eso permite que
 * la migración SQL y este código lleguen al mismo resultado, que la migración
 * sea idempotente y que un ID impreso en un albarán antiguo se pueda resolver.
 *
 * Debe coincidir exactamente con el SQL de la migración 033:
 *   'BZ-' || upper(substr(encode(sha256(convert_to(bezhas_id,'UTF8')),'hex'),1,10))
 *
 * Los 10 primeros chars hex son [0-9A-F], subconjunto del alfabeto Crockford,
 * así que el resultado siempre valida contra CANONICAL_RE.
 */
function legacyToCanonical(legacyId) {
    if (!isLegacyBezhasId(legacyId)) return null;
    const hex = crypto.createHash('sha256').update(legacyId, 'utf8').digest('hex');
    return PREFIX + hex.slice(0, ID_LENGTH).toUpperCase();
}

/**
 * Acepta cualquiera de los dos formatos y devuelve siempre el canónico.
 * Úsalo en los bordes (params de ruta, payloads de SubApps) para que un cliente
 * antiguo que aún mande `BEZ-…` siga funcionando.
 */
function toCanonical(anyId) {
    if (isValidBezhasId(anyId)) return anyId;
    if (isLegacyBezhasId(anyId)) return legacyToCanonical(anyId);
    return normalizeBezhasId(anyId);
}

module.exports = {
    ALPHABET,
    ID_LENGTH,
    PREFIX,
    CANONICAL_RE,
    LEGACY_RE,
    generateBezhasId,
    isValidBezhasId,
    isLegacyBezhasId,
    normalizeBezhasId,
    legacyToCanonical,
    toCanonical,
};
