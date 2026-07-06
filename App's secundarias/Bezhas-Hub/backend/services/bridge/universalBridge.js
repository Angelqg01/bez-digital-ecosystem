/**
 * Universal Bridge (Fase 3A — Conexión terceros)
 * ============================================================================
 * Cierra el flujo end-to-end del doc CONEXION_TERCEROS:
 *   Suscripción → AEGIS valida → OpenCLaw provisiona credenciales
 *   → (AQUÍ) fan-out a los adapters de las plataformas de terceros.
 *
 * Escucha el evento `client.provisioned` que ya emite payment-openclaw-bridge.js
 * y, por cada plataforma del plan del cliente (vinted/shopify/amazon/…),
 * entrega un webhook FIRMADO (HMAC-SHA256) al endpoint del adapter.
 *
 * Diseño aditivo y seguro:
 *  - OPT-IN: sólo arranca si FEATURE_THIRDPARTY_BRIDGE === 'true'.
 *  - Degrada con elegancia: un adapter sin URL configurada → 'skipped';
 *    un fallo de entrega se aísla por-plataforma y nunca propaga al emitter.
 *  - `deliver` es inyectable (tests sin red); por defecto usa fetch nativo.
 */
const crypto = require('crypto');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ── Firma HMAC de payloads salientes ────────────────────────────────────────
function signPayload(body, secret) {
    return 'sha256=' + crypto.createHmac('sha256', secret)
        .update(typeof body === 'string' ? body : JSON.stringify(body))
        .digest('hex');
}

// ── Entrega por defecto (fetch nativo, Node 18+) ────────────────────────────
async function defaultDeliver(url, body, headers) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { httpStatus: res.status };
}

// ── Adapter de webhook saliente firmado (factory) ──────────────────────────
// Una plataforma = un adapter. `url`/`secret` se resuelven de env por defecto.
function createWebhookAdapter(platform, { url, secret } = {}) {
    return {
        platform,
        url: url ?? process.env[`BRIDGE_${platform.toUpperCase()}_WEBHOOK_URL`] ?? null,
        secret: secret ?? process.env[`BRIDGE_${platform.toUpperCase()}_SECRET`] ?? '',
        async handle(event, payload, { deliver }) {
            if (!this.url) return { status: 'skipped', reason: 'not-configured' };
            const body = { event, platform, ...payload, ts: new Date().toISOString() };
            const sig = signPayload(body, this.secret);
            const out = await deliver(this.url, body, {
                'X-BeZhas-Signature': sig,
                'X-BeZhas-Event': event,
            });
            return { status: 'delivered', ...out };
        },
    };
}

// ── Registro de adapters ────────────────────────────────────────────────────
const adapters = new Map();
function registerAdapter(adapter) {
    adapters.set(adapter.platform, adapter);
    return adapter;
}
function clearAdapters() { adapters.clear(); }
function listAdapters() { return [...adapters.keys()]; }

// Adapters de referencia (los 3 del doc). Sin URL en env quedan en 'skipped'.
function registerDefaultAdapters() {
    for (const p of ['vinted', 'shopify', 'amazon']) {
        registerAdapter(createWebhookAdapter(p));
    }
}

// ── Fan-out a las plataformas del payload ────────────────────────────────────
async function fanOut(event, payload, { deliver = defaultDeliver } = {}) {
    const platforms = Array.isArray(payload?.platforms) ? payload.platforms : [];
    const results = [];
    for (const platform of platforms) {
        const adapter = adapters.get(platform);
        if (!adapter) { results.push({ platform, status: 'no-adapter' }); continue; }
        try {
            const r = await adapter.handle(event, payload, { deliver });
            results.push({ platform, ...r });
        } catch (err) {
            logger.warn({ platform, err: err.message }, '[UniversalBridge] adapter delivery failed');
            results.push({ platform, status: 'error', error: err.message });
        }
    }
    logger.info({ event, clientId: payload?.clientId, results }, '[UniversalBridge] fan-out complete');
    return results;
}

// ── Arranque (opt-in) ────────────────────────────────────────────────────────
let started = false;
function init({ deliver } = {}) {
    if (started) return false;
    if (process.env.FEATURE_THIRDPARTY_BRIDGE !== 'true') {
        logger.info('[UniversalBridge] disabled (set FEATURE_THIRDPARTY_BRIDGE=true to enable)');
        return false;
    }
    // require diferido: evita ciclo y permite arrancar sin el bridge de pagos en tests.
    const { bridgeEvents } = require('../payment-openclaw-bridge');
    if (adapters.size === 0) registerDefaultAdapters();
    bridgeEvents.on('client.provisioned', (payload) => {
        fanOut('client.provisioned', payload, { deliver }).catch((e) =>
            logger.error({ err: e.message }, '[UniversalBridge] fan-out error'));
    });
    started = true;
    logger.info({ adapters: listAdapters() }, '✅ [UniversalBridge] started');
    return true;
}

module.exports = {
    init,
    fanOut,
    signPayload,
    registerAdapter,
    createWebhookAdapter,
    registerDefaultAdapters,
    clearAdapters,
    listAdapters,
    defaultDeliver,
};
