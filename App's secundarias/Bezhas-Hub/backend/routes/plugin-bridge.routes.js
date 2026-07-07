/**
 * plugin-bridge.routes.js
 * ----------------------------------------------------------------------------
 * Superficie pública que consume el Plugin WordPress (y cualquier CRM/ERP con
 * webview) para renderizar la consola embebida de BeZhas-Hub DENTRO de la
 * plataforma del tercero, sin que éste salga de su panel.
 *
 * El plugin NO embebe el código de cada SubApp: consume este manifiesto y luego
 * habla con el Hub usando la API-Key del tenant. Fuente única de planes
 * (config/plans.js) y de SubApps (control-plane/policy.js) — cero drift.
 *
 * Endpoints:
 *   GET  /api/plugin-bridge/manifest   → planes + SubApps + config de pago + plugin
 *   POST /api/plugin-bridge/quote      → calcula coste de una suscripción (proxy plans)
 *   GET  /api/plugin-bridge/health     → estado real para el badge "Conectado"
 *
 * Todo lo que muta (suscribir, activar SubApp, crear pago) lo ejecuta el plugin
 * contra los endpoints existentes (/api/plans, /api/bezpay, /api/identity) con
 * la API-Key scoped del tenant — aquí solo se sirve el catálogo de lectura.
 */

const express = require('express');
const router = express.Router();

const { PLANS, calculateSubscription, BEZ_DISCOUNT_RATE, IVA_RATE } = require('../config/plans');
const { getBezPriceUSD, TREASURY_ADDR } = require('../services/bezpay.service');

let getSubappRegistry;
try {
    ({ getSubappRegistry } = require('../control-plane/policy'));
} catch {
    getSubappRegistry = () => [];
}

// Auth por API-Key en modo OPCIONAL: si el plugin manda X-API-Key válida,
// quedan req.apiKeyRecord/req.apiKeyId para persistir scope/plan; si no, las
// rutas de lectura siguen siendo públicas y las de mutación degradan a "local".
let withApiKey = (req, res, next) => next();
let ApiKey = null;
try {
    const { apiKeyTenant } = require('../middleware/apiKeyTenant');
    withApiKey = apiKeyTenant({ required: false });
    ApiKey = require('../models/pg/ApiKey');
} catch {
    /* sin DB/middleware: el bridge funciona en modo solo-lectura */
}

// BEZ token (moneda de settlement) — Polygon es la red recomendada.
const BEZ_TOKEN = {
    polygon: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    bsc: '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55',
};

const PLUGIN_VERSION = process.env.BEZHAS_WP_PLUGIN_VERSION || '2.0.0';

// Etiquetas de presentación de cada SubApp para la consola embebida.
const SUBAPP_LABELS = {
    wallet: 'Wallet, bridge, gobernanza y gas',
    gas: 'Patrocinio de gas y relayer',
    nodes: 'Nodos DePIN y recompensas',
    vision: 'Visión artificial y trazabilidad',
    capital: 'DeFi: staking, farming, RWA, tesorería',
    cargo: 'Trazabilidad logística y aduanera',
    pay: 'Pagos, checkout y liquidación SEPA',
};

function buildManifest() {
    const subapps = (getSubappRegistry() || []).map((s) => ({
        key: s.key,
        name: s.name,
        description: SUBAPP_LABELS[s.key] || '',
        capabilities: s.owns || [],
        // Activar una SubApp = ampliar el scope de la API-Key del tenant.
        scope: (s.owns || [])[0] || `${s.key}_operations`,
    }));

    return {
        plugin: {
            name: 'BeZhas Hub — Embedded Gateway',
            version: PLUGIN_VERSION,
            downloadUrl: '/api/downloads/bezhas-hub-wp.zip',
        },
        hub: {
            apiBase: process.env.PUBLIC_API_BASE || 'https://api.bez.digital',
            developerConsole: 'https://bez.digital/developer-console',
        },
        pay: {
            settlementToken: 'BEZ',
            tokenAddress: BEZ_TOKEN,
            defaultNetwork: 'polygon',
            networks: ['polygon', 'bsc'],
            currency: 'EUR',
        },
        plans: PLANS,
        planMeta: { currency: 'EUR', bezDiscountRate: BEZ_DISCOUNT_RATE, ivaRate: IVA_RATE },
        subapps,
    };
}

// ── GET /api/plugin-bridge/manifest ──────────────────────────────────────────
router.get('/manifest', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ success: true, manifest: buildManifest() });
});

// ── POST /api/plugin-bridge/quote ────────────────────────────────────────────
router.post('/quote', (req, res) => {
    try {
        const { planId, payWithBez, annual } = req.body || {};
        if (!planId) {
            return res.status(400).json({ success: false, code: 'NO_PLAN', message: 'planId requerido.' });
        }
        const quote = calculateSubscription({ planId, payWithBez: !!payWithBez, annual: !!annual });
        res.json({ success: true, quote });
    } catch (err) {
        const status = err.code === 'UNKNOWN_PLAN' ? 404 : 500;
        res.status(status).json({ success: false, code: err.code || 'ERROR', message: err.message });
    }
});

// ── POST /api/plugin-bridge/subapp ───────────────────────────────────────────
// Activa/desactiva una SubApp para el tenant. Valida la key contra el registro
// real del Control Plane y, si la petición trae una API-Key válida (X-API-Key),
// PERSISTE el scope en api_keys.permissions. Sin key → valida y resuelve scope.
router.post('/subapp', withApiKey, async (req, res) => {
    const { key, enabled } = req.body || {};
    const registry = getSubappRegistry() || [];
    const subapp = registry.find((s) => s.key === key);
    if (!subapp) {
        return res.status(404).json({ success: false, code: 'UNKNOWN_SUBAPP', message: `SubApp desconocida: ${key}` });
    }
    const scope = (subapp.owns || [])[0] || `${subapp.key}_operations`;

    let persisted = false;
    if (ApiKey && req.apiKeyId) {
        try {
            await ApiKey.setSubappScope(req.apiKeyId, scope, !!enabled);
            persisted = true;
        } catch (err) {
            // No rompemos la UI: el plugin mantiene espejo local del estado.
            console.warn('[plugin-bridge] setSubappScope falló:', err.message);
        }
    }

    res.json({
        success: true,
        subapp: subapp.key,
        enabled: !!enabled,
        scope,
        persisted,
        capabilities: subapp.owns || [],
    });
});

// ── POST /api/plugin-bridge/subscribe ────────────────────────────────────────
// Contrata un plan usando la API-Key del tenant (evita el JWT de
// /api/subscription/checkout). Calcula el coste definitivo y deja el plan como
// PENDIENTE de pago: no se activa hasta que /subscribe/confirm verifique la
// transferencia $BEZ on-chain. Los planes gratuitos (total 0) activan directo.
router.post('/subscribe', withApiKey, async (req, res) => {
    try {
        const { planId, payWithBez, annual } = req.body || {};
        if (!planId) {
            return res.status(400).json({ success: false, code: 'NO_PLAN', message: 'planId requerido.' });
        }
        if (!req.apiKeyId) {
            return res.status(401).json({ success: false, code: 'NO_API_KEY', message: 'Conecta tu cuenta BeZhas (X-API-Key) para contratar.' });
        }
        const quote = calculateSubscription({ planId, payWithBez: !!payWithBez, annual: !!annual });

        // Plan gratuito: nada que cobrar → activación inmediata.
        if (quote.total === 0) {
            let persisted = false;
            if (ApiKey) {
                try { await ApiKey.setPlan(req.apiKeyId, planId); persisted = true; }
                catch (err) { console.warn('[plugin-bridge] setPlan falló:', err.message); }
            }
            return res.json({ success: true, plan: planId, status: 'active', persisted, quote });
        }

        // Plan de pago: cotizar el importe en BEZ y dejarlo pendiente.
        const bezPriceUSD = await getBezPriceUSD();
        // Aproximación EUR≈USD del feed de precio; la tolerancia de /confirm
        // absorbe el spread. Sustituir por un feed EUR real al unificar Payments Core.
        const expectedBez = Math.round((quote.total / bezPriceUSD) * 1e6) / 1e6;

        let persisted = false;
        if (ApiKey) {
            try {
                await ApiKey.setPendingPlan(req.apiKeyId, {
                    planId,
                    amountEUR: quote.total,
                    expectedBez,
                    quotedAt: new Date().toISOString(),
                });
                persisted = true;
            } catch (err) {
                console.warn('[plugin-bridge] setPendingPlan falló:', err.message);
            }
        }
        if (!persisted) {
            return res.status(503).json({ success: false, code: 'NO_PERSISTENCE', message: 'No se pudo registrar la contratación. Reintenta.' });
        }

        res.json({
            success: true,
            plan: planId,
            status: 'pending_payment',
            quote,
            payment: {
                token: 'BEZ',
                tokenAddress: BEZ_TOKEN,
                defaultNetwork: 'polygon',
                to: TREASURY_ADDR,
                amountEUR: quote.total,
                expectedBez,
                bezPriceUSD,
                note: `Transfiere ${expectedBez} $BEZ al Treasury y confirma con POST /api/plugin-bridge/subscribe/confirm { txHash }.`,
            },
        });
    } catch (err) {
        const status = err.code === 'UNKNOWN_PLAN' ? 404 : 500;
        res.status(status).json({ success: false, code: err.code || 'ERROR', message: err.message });
    }
});

// ── POST /api/plugin-bridge/subscribe/confirm ────────────────────────────────
// Verifica el pago on-chain del plan pendiente y, solo entonces, lo activa:
//  1. La tx existe y está confirmada (receipt.status === 1).
//  2. Contiene un Transfer del token BEZ hacia el Treasury.
//  3. El importe cubre lo cotizado (con tolerancia por spread/movimiento).
//  4. El txHash no fue usado por ningún otro tenant (anti-reuso global).
const PLAN_PAYMENT_TOLERANCE = Math.min(0.5, Math.max(0, parseFloat(process.env.PLAN_PAYMENT_TOLERANCE || '0.10')));
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

router.post('/subscribe/confirm', withApiKey, async (req, res) => {
    try {
        const { txHash, chainId = 137 } = req.body || {};
        if (!req.apiKeyId || !ApiKey) {
            return res.status(401).json({ success: false, code: 'NO_API_KEY', message: 'Conecta tu cuenta BeZhas (X-API-Key) para confirmar.' });
        }
        if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
            return res.status(400).json({ success: false, code: 'BAD_TX', message: 'txHash inválido.' });
        }

        const pending = await ApiKey.getPendingPlan(req.apiKeyId);
        if (!pending) {
            return res.status(404).json({ success: false, code: 'NO_PENDING_PLAN', message: 'No hay contratación pendiente. Llama antes a /subscribe.' });
        }

        if (await ApiKey.isPlanTxUsed(txHash)) {
            return res.status(409).json({ success: false, code: 'TX_REUSED', message: 'Esta transacción ya activó un plan.' });
        }

        const { ethers } = require('ethers');
        const rpcMap = {
            137: process.env.POLYGON_MAINNET_RPC || 'https://polygon-bor.publicnode.com',
            56: 'https://bsc-dataseed.binance.org/',
            80002: process.env.POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology',
        };
        const bezByChain = { 137: BEZ_TOKEN.polygon, 56: BEZ_TOKEN.bsc, 80002: process.env.BEZ_AMOY_ADDRESS };
        const bezAddress = bezByChain[chainId];
        if (!rpcMap[chainId] || !bezAddress) {
            return res.status(400).json({ success: false, code: 'BAD_CHAIN', message: `Red no soportada para el pago del plan: ${chainId}` });
        }

        const provider = new ethers.JsonRpcProvider(rpcMap[chainId]);
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
            return res.json({ success: true, status: 'pending', confirmed: false, message: 'Tx aún sin confirmar — reintenta en unos segundos.' });
        }
        if (receipt.status !== 1) {
            return res.status(400).json({ success: false, code: 'TX_FAILED', message: 'La transacción falló on-chain.' });
        }

        // Transfer(BEZ → Treasury) dentro de la tx
        const transfer = receipt.logs.find((log) =>
            log.address.toLowerCase() === bezAddress.toLowerCase() &&
            log.topics[0] === TRANSFER_TOPIC &&
            log.topics[2] &&
            ('0x' + log.topics[2].slice(26)).toLowerCase() === TREASURY_ADDR.toLowerCase()
        );
        if (!transfer) {
            return res.status(400).json({ success: false, code: 'NO_BEZ_TRANSFER', message: 'La tx no contiene una transferencia BEZ al Treasury.' });
        }

        const amountBez = parseFloat(ethers.formatUnits(BigInt(transfer.data), 18));
        const minBez = pending.expectedBez * (1 - PLAN_PAYMENT_TOLERANCE);
        if (amountBez < minBez) {
            return res.status(400).json({
                success: false,
                code: 'UNDERPAID',
                message: `Importe insuficiente: ${amountBez} BEZ recibidos, se esperaban ≥ ${minBez.toFixed(6)} BEZ.`,
                expectedBez: pending.expectedBez,
                receivedBez: amountBez,
            });
        }

        const updated = await ApiKey.confirmPendingPlan(req.apiKeyId, { txHash, chainId, amountBez });
        if (!updated) {
            return res.status(500).json({ success: false, code: 'PERSIST_FAILED', message: 'Pago verificado pero no se pudo activar el plan. Contacta soporte.' });
        }

        res.json({
            success: true,
            status: 'active',
            plan: pending.planId,
            payment: { txHash, chainId, amountBez, amountEUR: pending.amountEUR },
        });
    } catch (err) {
        console.error('[plugin-bridge] subscribe/confirm error:', err.message);
        res.status(500).json({ success: false, code: 'ERROR', message: err.message });
    }
});

// ── GET /api/plugin-bridge/health ────────────────────────────────────────────
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'online',
        service: 'plugin-bridge',
        version: PLUGIN_VERSION,
        time: new Date().toISOString(),
    });
});

module.exports = router;
