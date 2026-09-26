'use strict';

/**
 * services/oauth/tokens.js — firma del access token del MCP y utilidades PKCE.
 *
 * Clave PROPIA y asimétrica (ES256), no JWT_SECRET: el token lo recibe un
 * tercero (ChatGPT, Codex…) y lo verifica OTRO servicio (mcp.bezhas.com, sin
 * base de datos). Con la pública publicada en /.well-known/jwks.json, el MCP
 * puede verificar sin poder firmar, y una fuga de JWT_SECRET no permite
 * fabricar tokens del MCP ni al revés.
 *
 * Producción: OAUTH_JWT_PRIVATE_KEY y OAUTH_JWT_PUBLIC_KEY en PEM o en PEM
 * codificado en base64. Sin ellas NO arranca: un par efímero invalidaría todas
 * las sesiones en cada reinicio de Cloud Run. Fuera de producción (y en jest)
 * se usa un par efímero.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ISSUER = process.env.OAUTH_ISSUER || 'https://api.bezhas.com';
// El recurso protegido es el servidor MCP, no la API: el token sólo vale allí.
const AUDIENCE = process.env.OAUTH_AUDIENCE || process.env.MCP_PUBLIC_URL || 'https://mcp.bezhas.com';
const ACCESS_TOKEN_TTL = process.env.OAUTH_ACCESS_TOKEN_TTL || '10m';
const KID = 'mcp-oauth-1';

function _pem(valor) {
    if (!valor) return null;
    const v = String(valor).trim();
    if (v.startsWith('-----BEGIN')) return v;
    const decodificado = Buffer.from(v, 'base64').toString('utf8');
    return decodificado.startsWith('-----BEGIN') ? decodificado : null;
}

function _validarPar(privada, publica) {
    const priv = crypto.createPrivateKey(privada);
    if (priv.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
        throw new Error('FATAL: OAUTH_JWT_PRIVATE_KEY debe ser una clave EC P-256 (ES256).');
    }
    const muestra = Buffer.from('bezhas-oauth-par');
    if (!crypto.verify('sha256', muestra, crypto.createPublicKey(publica), crypto.sign('sha256', muestra, priv))) {
        throw new Error('FATAL: OAUTH_JWT_PUBLIC_KEY no es la pareja de OAUTH_JWT_PRIVATE_KEY.');
    }
}

function _cargarClaves() {
    const privada = _pem(process.env.OAUTH_JWT_PRIVATE_KEY);
    const publica = _pem(process.env.OAUTH_JWT_PUBLIC_KEY);
    if (privada && publica) {
        _validarPar(privada, publica);
        return { privada, publica, efimera: false };
    }
    if (process.env.OAUTH_JWT_PRIVATE_KEY || process.env.OAUTH_JWT_PUBLIC_KEY) {
        throw new Error('FATAL: OAUTH_JWT_PRIVATE_KEY y OAUTH_JWT_PUBLIC_KEY deben venir las dos, en PEM o PEM en base64.');
    }
    if (process.env.NODE_ENV === 'production' && !process.env.JEST_WORKER_ID) {
        throw new Error('FATAL: OAUTH_JWT_PRIVATE_KEY y OAUTH_JWT_PUBLIC_KEY son obligatorias en producción (par EC P-256).');
    }
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    return { privada: privateKey, publica: publicKey, efimera: true };
}

let CLAVES = null;
/** Carga perezosa: el backend puede arrancar sin tocar OAuth hasta que se use. */
function claves() {
    if (!CLAVES) CLAVES = _cargarClaves();
    return CLAVES;
}

function claveJwkPublica() {
    const jwk = crypto.createPublicKey(claves().publica).export({ format: 'jwk' });
    return { ...jwk, use: 'sig', alg: 'ES256', kid: KID };
}

function emitirAccessToken({ userId, clientId, scope }) {
    const jti = crypto.randomUUID();
    const token = jwt.sign(
        { scope: (scope || []).join(' '), client_id: clientId },
        claves().privada,
        {
            algorithm: 'ES256', subject: String(userId), issuer: ISSUER, audience: AUDIENCE,
            expiresIn: ACCESS_TOKEN_TTL, jwtid: jti, keyid: KID,
        }
    );
    return { token, jti, expiresIn: ACCESS_TOKEN_TTL };
}

function verificarAccessToken(token) {
    return jwt.verify(token, claves().publica, { algorithms: ['ES256'], issuer: ISSUER, audience: AUDIENCE });
}

// ── PKCE (RFC 7636): sólo S256 ────────────────────────────────────────────
const base64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const retoDesdeVerifier = (v) => base64url(crypto.createHash('sha256').update(v).digest());

function verificarPkce(codeVerifier, codeChallenge) {
    if (typeof codeVerifier !== 'string' || codeVerifier.length < 43 || codeVerifier.length > 128) return false;
    if (!/^[A-Za-z0-9\-._~]+$/.test(codeVerifier)) return false;
    const a = Buffer.from(retoDesdeVerifier(codeVerifier));
    const b = Buffer.from(String(codeChallenge || ''));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const sha256Hex = (v) => crypto.createHash('sha256').update(v).digest('hex');
const tokenAleatorio = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

module.exports = {
    ISSUER, AUDIENCE, ACCESS_TOKEN_TTL, KID,
    claves, claveJwkPublica, emitirAccessToken, verificarAccessToken,
    retoDesdeVerifier, verificarPkce, sha256Hex, tokenAleatorio,
    _reset: () => { CLAVES = null; },
};
