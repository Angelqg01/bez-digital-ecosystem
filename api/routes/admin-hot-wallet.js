/**
 * routes/admin-hot-wallet.js — la Hot Wallet de BeZhas, sólo para el SuperAdmin.
 *
 * Sección «Hot Wallet» de /admin/profile. No es un camino de dinero nuevo: es una
 * interfaz sobre el que ya existe (services/txOrchestrator):
 *
 *   SuperAdmin propone  →  intención crypto_transfer con origen `bezhas_treasury`
 *   política + riesgo   →  la tesorería exige SIEMPRE ≥ 2 aprobaciones
 *   aprobadores firman  →  EIP-712 con su MetaMask; sólo cuentan las wallets
 *                          registradas en tx_approvers con rol `treasury` global
 *   ejecutar            →  vuelve a evaluarlo todo y pide la firma al tx-signer
 *                          aislado, que comprueba las firmas contra SU lista
 *
 * Qué NO hace, a propósito:
 *   · No tiene la clave de la Hot Wallet: la custodia el tx-signer (KMS). Esta API
 *     puede pedir una firma, no producirla.
 *   · No mueve fondos de terceros. La Hot Wallet custodia el dinero PROPIO de
 *     BeZhas. Los pagos del marketplace van por MarketplaceSettlement (cada parte
 *     retira lo suyo); aquí sólo se ve, en lectura, la comisión acumulada.
 *   · Una sesión SuperAdmin sin firmas de aprobadores no saca ni un BEZ.
 *
 * Config: TX_TREASURY_ADDRESS_137 (dirección de la Hot Wallet), BEZPAY_TREASURY_APP_ID
 * (app interna de tesorería, la misma que usa la liquidación de BEZ-Pay),
 * BEZPAY_TREASURY_PLAN, POLYGON_RPC_URL.
 */

'use strict';

const crypto = require('crypto');
const { Router } = require('express');
const { ethers } = require('ethers');

const { requireSuperAdmin } = require('../middleware/admin-auth');
const { query } = require('../db/pool');
const { orquestador } = require('../services/txOrchestrator');
const repo = require('../services/txRepository');
const killSwitch = require('../services/killSwitch');
const { CRYPTO_ASSETS } = require('../config/tx-rails');
const settlement = require('../services/marketplace/settlement');
const logger = require('pino')({ level: 'info', name: 'admin-hot-wallet' });

const router = Router();
router.use(requireSuperAdmin);

const CHAIN_ID = 137;
// La Hot Wallet registrada de BeZhas (CLAUDE.md). Si el despliegue declara otra en
// TX_TREASURY_ADDRESS_137, manda la del despliegue: es la que el tx-signer firma.
const HOT_WALLET_REGISTRADA = '0x52Df82920CBAE522880dD7657e43d1A754eD044E';
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_FIRMA = /^0x[0-9a-fA-F]{130}$/;
const ACTIVOS = ['BEZ', 'USDC', 'USDT'];
const ERC20 = ['function balanceOf(address) view returns (uint256)'];

const direccionHotWallet = () => process.env.TX_TREASURY_ADDRESS_137 || process.env.TX_TREASURY_ADDRESS || null;

function appTesoreria() {
    const id = process.env.BEZPAY_TREASURY_APP_ID;
    return id ? { id, scopes: ['treasury', 'wallet'], enterpriseId: null } : null;
}
const planTesoreria = () => process.env.BEZPAY_TREASURY_PLAN || 'enterprise_vip';

function responderError(res, err, contexto) {
    if (err?.status && err?.code) return res.status(err.status).json({ error: err.message, code: err.code });
    logger.error({ err: err?.message, contexto }, 'hot wallet: error');
    return res.status(500).json({ error: 'Error interno de tesorería' });
}

function sinApp(res) {
    return res.status(503).json({
        error: 'Falta BEZPAY_TREASURY_APP_ID: la app interna de tesorería no está configurada.',
        code: 'TREASURY_APP_NOT_CONFIGURED',
    });
}

async function saldos(direccion) {
    const rpcUrl = process.env.POLYGON_RPC_URL;
    if (!rpcUrl || !direccion) return null;
    const rpc = new ethers.JsonRpcProvider(rpcUrl, CHAIN_ID, { staticNetwork: true });
    const consultas = [
        rpc.getBalance(direccion).then((v) => ({ asset: 'POL', amount: ethers.formatEther(v) })),
        ...ACTIVOS.map((s) => {
            const def = CRYPTO_ASSETS[s].porCadena[CHAIN_ID];
            return new ethers.Contract(def.address, ERC20, rpc).balanceOf(direccion)
                .then((v) => ({ asset: s, amount: ethers.formatUnits(v, def.decimales) }));
        }),
    ];
    const r = await Promise.allSettled(consultas);
    return r.map((x, i) => (x.status === 'fulfilled' ? x.value : { asset: ['POL', ...ACTIVOS][i], amount: null, error: 'rpc' }));
}

// ── Resumen ────────────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
    try {
        const direccion = direccionHotWallet();
        const [aprob, bal, ks, comision] = await Promise.all([
            query(
                `SELECT address, label, status, expires_at, created_at
                 FROM tx_approvers
                 WHERE app_id IS NULL AND 'treasury' = ANY(roles)
                 ORDER BY created_at ASC`,
            ),
            saldos(direccion || HOT_WALLET_REGISTRADA).catch((err) => {
                logger.warn({ err: err.message }, 'hot wallet: no se pudieron leer los saldos');
                return null;
            }),
            killSwitch.estadoEfectivo({ appId: process.env.BEZPAY_TREASURY_APP_ID, rail: 'crypto_transfer' }).catch(() => ({ estado: 'UNKNOWN' })),
            settlement.comisionAcumulada().catch(() => null),
        ]);
        const activos = aprob.rows.filter((a) => a.status === 'active' && (!a.expires_at || new Date(a.expires_at) > new Date()));
        res.json({
            hotWallet: {
                address: direccion || HOT_WALLET_REGISTRADA,
                configured: Boolean(direccion),
                registeredAddress: HOT_WALLET_REGISTRADA,
                matchesRegistered: !direccion || direccion.toLowerCase() === HOT_WALLET_REGISTRADA.toLowerCase(),
                chainId: CHAIN_ID,
                explorer: `https://polygonscan.com/address/${direccion || HOT_WALLET_REGISTRADA}`,
                keyCustody: 'tx-signer (KMS): la API no tiene la clave',
            },
            balances: bal,
            approvers: aprob.rows.map((a) => ({
                address: a.address, label: a.label, status: a.status, expiresAt: a.expires_at,
            })),
            // Tesorería: txPolicyEngine exige al menos 2 aprobaciones, y el tx-signer
            // vuelve a exigir su minApprovals (≥ 2 en producción) con su propia lista.
            policy: { minApprovals: 2, activeApprovers: activos.length, ready: activos.length >= 2 },
            killSwitch: { estado: ks.estado, motivo: ks.motivo || null },
            treasuryAppConfigured: Boolean(appTesoreria()),
            marketplaceFees: comision,
        });
    } catch (err) {
        responderError(res, err, 'resumen');
    }
});

// ── Operaciones ────────────────────────────────────────────────────────────

router.get('/intents', async (_req, res) => {
    const app = appTesoreria();
    if (!app) return sinApp(res);
    try {
        const { rows } = await query(
            `SELECT i.id, i.status, i.intent->>'asset' AS asset, i.intent->>'amount' AS amount,
                    i.intent->'destination'->>'value' AS destination, i.intent->'destination'->>'name' AS destination_name,
                    i.intent->>'reference' AS reference, i.required_approvals, i.tx_hash, i.created_at,
                    (SELECT COUNT(*)::int FROM tx_approvals a WHERE a.intent_id = i.id AND a.decision = 'APPROVE') AS approvals
             FROM tx_intents i
             WHERE i.app_id = $1 AND i.intent->'source'->>'type' = 'bezhas_treasury'
             ORDER BY i.created_at DESC
             LIMIT 50`,
            [app.id],
        );
        res.json({ intents: rows });
    } catch (err) {
        responderError(res, err, 'intents.list');
    }
});

router.get('/intents/:id', async (req, res) => {
    const app = appTesoreria();
    if (!app) return sinApp(res);
    if (!RE_UUID.test(req.params.id)) return res.status(404).json({ error: 'Operación no encontrada', code: 'INTENT_NOT_FOUND' });
    try {
        const [intencion, firmas] = await Promise.all([
            orquestador().obtener({ id: req.params.id, app }),
            repo.aprobaciones(req.params.id),
        ]);
        res.json({
            intencion,
            firmas: firmas.map((f) => ({ address: f.approver_address, decision: f.decision, at: f.created_at })),
        });
    } catch (err) {
        responderError(res, err, 'intents.get');
    }
});

router.post('/intents', async (req, res) => {
    const app = appTesoreria();
    if (!app) return sinApp(res);
    const { asset, amount, destination, destinationName, reference } = req.body || {};
    if (!ACTIVOS.includes(asset)) return res.status(400).json({ error: `asset ∈ ${ACTIVOS.join(', ')}`, code: 'ASSET_INVALID' });
    if (!ethers.isAddress(String(destination || ''))) return res.status(400).json({ error: 'destination: dirección 0x', code: 'DESTINATION_INVALID' });
    if (String(destination).toLowerCase() === String(direccionHotWallet() || '').toLowerCase()) {
        return res.status(400).json({ error: 'El destino es la propia Hot Wallet.', code: 'DESTINATION_INVALID' });
    }
    try {
        const entrada = {
            rail: 'crypto_transfer',
            asset,
            amount: String(amount || ''),
            network: 'polygon',
            source: { type: 'bezhas_treasury' },
            destination: {
                type: 'evm_address',
                value: ethers.getAddress(destination),
                ...(destinationName ? { name: String(destinationName).slice(0, 140) } : {}),
            },
            purpose: 'treasury',
            ...(reference ? { reference: String(reference).slice(0, 140) } : {}),
            idempotencyKey: `hotwallet-${crypto.randomUUID()}`,
            // Firmar lleva tiempo humano: los aprobadores tienen el día.
            expiresInSeconds: 86400,
        };
        const intencion = await orquestador().crearIntencion({ entrada, app, plan: planTesoreria(), canal: 'admin-hot-wallet' });
        logger.info({ id: intencion.id, asset, amount, admin: req.admin?.sub || req.admin?.email }, 'hot wallet: operación propuesta');
        res.status(201).json({ intencion });
    } catch (err) {
        responderError(res, err, 'intents.create');
    }
});

/**
 * La firma es la credencial: la sesión SuperAdmin sólo la transporta. Cuenta si
 * la wallet que firmó es un aprobador de tesorería activo.
 */
router.post('/intents/:id/approvals', async (req, res) => {
    const app = appTesoreria();
    if (!app) return sinApp(res);
    if (!RE_UUID.test(req.params.id)) return res.status(404).json({ error: 'Operación no encontrada', code: 'INTENT_NOT_FOUND' });
    const { signature, decision = 'APPROVE' } = req.body || {};
    if (!RE_FIRMA.test(String(signature || ''))) {
        return res.status(400).json({ error: 'signature: firma EIP-712 de 65 bytes', code: 'APPROVAL_SIGNATURE_INVALID' });
    }
    try {
        const intencion = await orquestador().aprobar({ id: req.params.id, app, firma: signature, decision });
        res.json({ intencion });
    } catch (err) {
        responderError(res, err, 'intents.approve');
    }
});

router.post('/intents/:id/execute', async (req, res) => {
    const app = appTesoreria();
    if (!app) return sinApp(res);
    if (!RE_UUID.test(req.params.id)) return res.status(404).json({ error: 'Operación no encontrada', code: 'INTENT_NOT_FOUND' });
    try {
        const intencion = await orquestador().ejecutar({ id: req.params.id, app, plan: planTesoreria() });
        logger.info({ id: req.params.id, estado: intencion.estado, admin: req.admin?.sub || req.admin?.email }, 'hot wallet: ejecución');
        res.json({ intencion });
    } catch (err) {
        responderError(res, err, 'intents.execute');
    }
});

router.post('/intents/:id/cancel', async (req, res) => {
    const app = appTesoreria();
    if (!app) return sinApp(res);
    if (!RE_UUID.test(req.params.id)) return res.status(404).json({ error: 'Operación no encontrada', code: 'INTENT_NOT_FOUND' });
    try {
        const intencion = await orquestador().cancelar({
            id: req.params.id, app, motivo: String(req.body?.reason || 'Cancelada desde el panel').slice(0, 200),
        });
        res.json({ intencion });
    } catch (err) {
        responderError(res, err, 'intents.cancel');
    }
});

module.exports = router;
