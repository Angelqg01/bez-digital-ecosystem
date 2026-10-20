'use strict';

/**
 * Cabeceras para hablar con el Brain (obsidian-mcp).
 *
 * - `x-brain-key`: la clave compartida BRAIN_API_KEY, que el Brain exige en
 *   todo salvo /health.
 * - `x-serverless-authorization`: en Cloud Run el Brain va con
 *   `--no-allow-unauthenticated`, así que hace falta un ID token de Google con
 *   la URL del servicio como audience. Cloud Run lo valida y lo retira; no pisa
 *   la clave. En local (http, localhost, nombres de docker compose) no se pide.
 *
 * Falla abierto en el token: si no se puede acuñar, la petición sale igual y
 * Cloud Run responde 401, que quien llama trata como Brain no disponible.
 */
const logger = require('pino')({ level: 'info', name: 'brain-client' });

const BRAIN_URL = process.env.OBSIDIAN_MCP_URL || 'http://obsidian-mcp:4007';

const idTokenClients = new Map();
const idTokenCache = new Map(); // audience -> { token, exp }

function audienceFor(url) {
    let origin;
    try { origin = new URL(url); } catch { return null; }
    if (origin.protocol !== 'https:' || /^(localhost|127\.0\.0\.1)$/.test(origin.hostname)) return null;
    return origin.origin;
}

async function idTokenHeader(url) {
    const audience = audienceFor(url);
    if (!audience) return {};
    const cached = idTokenCache.get(audience);
    if (cached && cached.exp > Date.now()) return { 'x-serverless-authorization': `Bearer ${cached.token}` };
    try {
        const { GoogleAuth } = require('google-auth-library');
        if (!idTokenClients.has(audience)) {
            idTokenClients.set(audience, await new GoogleAuth().getIdTokenClient(audience));
        }
        const headers = await idTokenClients.get(audience).getRequestHeaders();
        const token = String(headers.Authorization || headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!token) return {};
        idTokenCache.set(audience, { token, exp: Date.now() + 45 * 60 * 1000 }); // dura ~1 h
        return { 'x-serverless-authorization': `Bearer ${token}` };
    } catch (err) {
        logger.warn({ error: err.message }, 'No se pudo acuñar el ID token para el Brain');
        return {};
    }
}

/** Cabeceras de autenticación para una URL del Brain. */
async function brainHeaders(url = BRAIN_URL) {
    const key = process.env.BRAIN_API_KEY || '';
    return {
        ...(key ? { 'x-brain-key': key } : {}),
        ...(await idTokenHeader(url)),
    };
}

module.exports = { BRAIN_URL, brainHeaders, audienceFor };
