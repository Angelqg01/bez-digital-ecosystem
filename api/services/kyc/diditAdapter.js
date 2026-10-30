/**
 * diditAdapter.js — adaptador del proveedor KYC Didit.
 *
 * Responsabilidades (sin estado, sin acceso a base de datos):
 *   - crear sesiones de verificación para una wallet
 *   - verificar la firma de los webhooks (X-Signature-V2 / X-Signature)
 *   - traducir un evento de sesión al nivel KYC de complianceGate
 *
 * Niveles (ver complianceGate.js): 1 = identidad + prueba de vida,
 * 2 = identidad + AML + prueba de domicilio. El nivel 2 sólo se concede
 * cuando el workflow aprobado es el configurado como «nivel 2».
 *
 * API: https://verification.didit.me/v3/session/ (probado en sandbox: 201).
 */

'use strict';

const crypto = require('crypto');

const MAX_CLOCK_SKEW_SECONDS = 300;
const DEFAULT_API_BASE = 'https://verification.didit.me';

/**
 * Serialización canónica de JSON: claves ordenadas, sin espacios y sin
 * escapar Unicode. Es lo que Didit firma en X-Signature-V2.
 */
function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value !== null && typeof value === 'object') {
        const keys = Object.keys(value).sort();
        return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function hmacHex(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

function safeEqualHex(received, expectedHex) {
    if (typeof received !== 'string' || received.length === 0) return false;
    const a = Buffer.from(received, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length === 0 || a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/**
 * Comprueba que el webhook viene de Didit (X-Signature-V2 sobre el JSON canónico)
 * y que es reciente según el campo `timestamp` DEL CUERPO, que sí va firmado.
 * La cabecera X-Timestamp no está en la firma: un atacante podría refrescarla
 * y reenviar un cuerpo capturado, así que no se usa para la frescura.
 * @param {object} p
 * @param {object} p.body      cuerpo parseado
 * @param {object} p.headers   cabeceras (en minúsculas, como las entrega Express)
 * @param {string} p.secret    secreto del destino en Didit
 * @param {number} [p.nowSeconds] para tests
 * @returns {boolean}
 */
function verifyWebhookSignature({ body, headers, secret, nowSeconds = Date.now() / 1000 }) {
    if (!secret || !headers || !body || typeof body !== 'object') return false;

    const expected = hmacHex(canonicalJson(body), secret);
    if (!safeEqualHex(headers['x-signature-v2'], expected)) return false;

    const timestamp = Number(body.timestamp);
    return Number.isFinite(timestamp) && Math.abs(nowSeconds - timestamp) <= MAX_CLOCK_SKEW_SECONDS;
}

/**
 * Extrae los campos útiles de un evento de sesión.
 * vendor_data lleva la dirección de la wallet que se pasó al crear la sesión.
 */
function parseSessionEvent(body) {
    const b = body && typeof body === 'object' ? body : {};
    const vendor = typeof b.vendor_data === 'string' ? b.vendor_data.trim() : '';
    const walletAddress = /^0x[0-9a-fA-F]{40}$/.test(vendor) ? vendor.toLowerCase() : null;
    return {
        walletAddress,
        sessionId: typeof b.session_id === 'string' ? b.session_id : null,
        status: typeof b.status === 'string' ? b.status : null,
        webhookType: typeof b.webhook_type === 'string' ? b.webhook_type : null,
        workflowId: typeof b.workflow_id === 'string' ? b.workflow_id : null,
    };
}

/**
 * Nivel KYC que concede un evento, o null si no debe cambiar nada.
 * Sólo «Approved» sube de nivel; Declined, In Review, etc. se registran fuera.
 * @param {{status: string|null, workflowId: string|null}} event
 * @param {{level2WorkflowId?: string}} [config]
 * @returns {1|2|null}
 */
function levelForEvent(event, { level2WorkflowId = '' } = {}) {
    if (event.status !== 'Approved') return null;
    if (level2WorkflowId && event.workflowId === level2WorkflowId) return 2;
    return 1;
}

/**
 * Crea una sesión de verificación en Didit para una wallet.
 * @returns {Promise<{sessionId: string, url: string}>}
 */
async function createSession({
    walletAddress,
    workflowId,
    callbackUrl,
    apiKey = process.env.DIDIT_API_KEY,
    apiBase = process.env.DIDIT_API_BASE || DEFAULT_API_BASE,
    fetchImpl = globalThis.fetch,
}) {
    if (!apiKey) throw new Error('DIDIT_API_KEY no configurada');
    if (!workflowId) throw new Error('workflowId requerido');

    const res = await fetchImpl(`${apiBase}/v3/session/`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
            workflow_id: workflowId,
            vendor_data: walletAddress.toLowerCase(),
            callback: callbackUrl,
        }),
    });
    if (!res.ok) throw new Error(`Didit createSession HTTP ${res.status}`);
    const data = await res.json();
    return { sessionId: data.session_id, url: data.url };
}

module.exports = {
    canonicalJson,
    verifyWebhookSignature,
    parseSessionEvent,
    levelForEvent,
    createSession,
    MAX_CLOCK_SKEW_SECONDS,
};
