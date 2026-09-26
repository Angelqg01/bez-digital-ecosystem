'use strict';

/**
 * services/oauthTokens.js — firma y verificación del access token del
 * authorization server OAuth 2.1 del MCP, y utilidades PKCE (RFC 7636).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ UNA CLAVE PROPIA Y NO JWT_SECRET
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * JWT_SECRET (config/secrets.js) firma sesiones de usuario: HS256, simétrico,
 * 24 horas. Un access token de MCP es otra superficie de confianza — lo recibe
 * un tercero (ChatGPT, Codex) y viaja por internet en cada llamada. Si
 * compartieran clave, una fuga en cualquiera de los dos sistemas comprometería
 * el otro. Por eso:
 *
 *   · clave PROPIA, asimétrica (ES256): firmar exige la privada, verificar
 *     sólo la pública — el propio proceso que verifica no puede falsificar.
 *   · TTL corto (10 min): un token que un agente autónomo puede filtrar en un
 *     log no debe seguir sirviendo horas después.
 *   · jti + denylist (services/oauthTokens.js + migración 060): revocación
 *     inmediata pese a ser autocontenido, para el kill switch y el logout.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  GESTIÓN DE LA CLAVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Producción: OAUTH_JWT_PRIVATE_KEY / OAUTH_JWT_PUBLIC_KEY en PEM (o el mismo
 * PEM en base64, para entornos que no toleran saltos de línea en variables de
 * entorno — se detecta por la cabecera `-----BEGIN`). Si faltan, el proceso no
 * arranca: un authorization server sin clave propia no puede fingir que
 * funciona con la de otro.
 *
 * Desarrollo y tests: par de claves EFÍMERO generado una vez al cargar el
 * módulo. Cambia en cada arranque — normal en dev, e irrelevante en test
 * porque cada suite carga su propio proceso.
 *
 * Jest: NODE_ENV llega como 'production' también bajo jest en esta máquina
 * (ver __tests__/helpers.js). Para que eso no tumbe la suite, la exigencia se
 * condiciona a producción FUERA de jest (JEST_WORKER_ID, que jest fija en cada
 * worker y ningún despliegue define).
 *
 * Si hay claves, se comprueba al arrancar que la privada es P-256 y que la
 * pública es su pareja: un par cruzado emitiría tokens que nunca verifican, y
 * el síntoma —«invalid token» en todos los clientes— no delataría la causa.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ISSUER = process.env.OAUTH_ISSUER || 'https://mcp.bez.digital';
const AUDIENCE = process.env.OAUTH_AUDIENCE || ISSUER;
const ACCESS_TOKEN_TTL = process.env.OAUTH_ACCESS_TOKEN_TTL || '10m';

function _pem(valor) {
    if (!valor) return null;
    const v = valor.trim();
    if (v.startsWith('-----BEGIN')) return v;
    // Base64 del PEM completo, para variables de entorno que no admiten \n.
    try {
        const decodificado = Buffer.from(v, 'base64').toString('utf8');
        return decodificado.startsWith('-----BEGIN') ? decodificado : null;
    } catch {
        return null;
    }
}

const EXIGIR_CLAVES = process.env.NODE_ENV === 'production' && !process.env.JEST_WORKER_ID;

function _validarPar(privada, publica) {
    const priv = crypto.createPrivateKey(privada);
    if (priv.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
        throw new Error('FATAL: OAUTH_JWT_PRIVATE_KEY debe ser una clave EC P-256 (ES256).');
    }
    const muestra = Buffer.from('bezhas-oauth-par');
    const firma = crypto.sign('sha256', muestra, priv);
    if (!crypto.verify('sha256', muestra, crypto.createPublicKey(publica), firma)) {
        throw new Error('FATAL: OAUTH_JWT_PUBLIC_KEY no es la pareja de OAUTH_JWT_PRIVATE_KEY.');
    }
}

function _cargarClaves() {
    const privadaEnv = _pem(process.env.OAUTH_JWT_PRIVATE_KEY);
    const publicaEnv = _pem(process.env.OAUTH_JWT_PUBLIC_KEY);

    if (privadaEnv && publicaEnv) {
        _validarPar(privadaEnv, publicaEnv);
        return { privada: privadaEnv, publica: publicaEnv, efimera: false };
    }
    if (process.env.OAUTH_JWT_PRIVATE_KEY || process.env.OAUTH_JWT_PUBLIC_KEY) {
        // Media configuración (o un valor que no es PEM ni PEM en base64): es un
        // error de despliegue, no un motivo para caer a un par efímero en silencio.
        throw new Error('FATAL: OAUTH_JWT_PRIVATE_KEY y OAUTH_JWT_PUBLIC_KEY deben venir las dos, en PEM o PEM en base64.');
    }
    if (EXIGIR_CLAVES) {
        throw new Error(
            'FATAL: OAUTH_JWT_PRIVATE_KEY y OAUTH_JWT_PUBLIC_KEY son obligatorias en producción '
            + '(par EC P-256). Sin ellas cada reinicio invalidaría todas las sesiones OAuth del MCP.'
        );
    }

    // eslint-disable-next-line no-console
    console.warn('\x1b[41m\x1b[37m  OAUTH_JWT_PRIVATE_KEY/PUBLIC_KEY no configuradas: usando un par EFÍMERO. '
        + 'Todo access token emitido deja de verificar en el próximo reinicio. NUNCA uses esto en producción.  \x1b[0m');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1', // = P-256, lo que exige ES256
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    return { privada: privateKey, publica: publicKey, efimera: true };
}

const CLAVES = _cargarClaves();

/** Para el endpoint /.well-known/jwks.json — sólo la pública sale de aquí. */
function claveJwkPublica() {
    const keyObject = crypto.createPublicKey(CLAVES.publica);
    const jwk = keyObject.export({ format: 'jwk' });
    return { ...jwk, use: 'sig', alg: 'ES256', kid: 'mcp-oauth-1' };
}

/**
 * Emite el access token. `scope` ya viene como la intersección final —esta
 * función no decide permisos, sólo firma lo que se le pasa.
 */
function emitirAccessToken({ appId, clientId, scope }) {
    const jti = crypto.randomUUID();
    const token = jwt.sign(
        { scope: (scope || []).join(' '), client_id: clientId },
        CLAVES.privada,
        {
            algorithm: 'ES256',
            subject: String(appId),
            issuer: ISSUER,
            audience: AUDIENCE,
            expiresIn: ACCESS_TOKEN_TTL,
            jwtid: jti,
            keyid: 'mcp-oauth-1',
        }
    );
    return { token, jti, expiresIn: ACCESS_TOKEN_TTL };
}

/** Lanza si la firma, el emisor, la audiencia o la caducidad no cuadran. */
function verificarAccessToken(token) {
    return jwt.verify(token, CLAVES.publica, {
        algorithms: ['ES256'],
        issuer: ISSUER,
        audience: AUDIENCE,
    });
}

// ─────────────────────────────────────────────────────────────────────────
//  PKCE (RFC 7636) — sólo S256, nunca 'plain'. Ver cabecera de la migración.
// ─────────────────────────────────────────────────────────────────────────

const base64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function retoDesdeVerifier(codeVerifier) {
    return base64url(crypto.createHash('sha256').update(codeVerifier).digest());
}

/** Comparación en tiempo constante: un side-channel aquí filtraría el reto. */
function verificarPkce(codeVerifier, codeChallenge) {
    if (typeof codeVerifier !== 'string' || codeVerifier.length < 43 || codeVerifier.length > 128) return false;
    // El propio RFC exige [A-Z a-z 0-9 - . _ ~]; fuera de ese alfabeto no hay
    // cliente conforme que lo genere, así que es más señal de ataque que de
    // error legítimo.
    if (!/^[A-Za-z0-9\-._~]+$/.test(codeVerifier)) return false;
    const esperado = retoDesdeVerifier(codeVerifier);
    const a = Buffer.from(esperado);
    const b = Buffer.from(String(codeChallenge || ''));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

const sha256Hex = (valor) => crypto.createHash('sha256').update(valor).digest('hex');
const tokenAleatorio = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

module.exports = {
    ISSUER, AUDIENCE, ACCESS_TOKEN_TTL,
    emitirAccessToken, verificarAccessToken, claveJwkPublica,
    retoDesdeVerifier, verificarPkce,
    sha256Hex, tokenAleatorio,
    _esEfimera: CLAVES.efimera, // sólo para que un test pueda avisar si hace falta
};
