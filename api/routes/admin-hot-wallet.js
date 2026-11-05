/**
 * routes/admin-hot-wallet.js — Treasury & Web3: la Hot Wallet de BeZhas, su Safe y sus
 * firmantes, sólo para el SuperAdmin.
 *
 * Sección «Treasury & Web3» de /admin/profile (antes «Treasury & Web3» y «Hot Wallet»
 * por separado). El resumen cruza la Hot Wallet, el Safe leído en cadena, los
 * firmantes y la configuración, y devuelve un diagnóstico de lo que no cuadra. No es un camino de dinero nuevo: es una
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
const treasuryConfig = require('../services/treasuryConfig');
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
const SAFE_ABI = [
    'function getOwners() view returns (address[])',
    'function getThreshold() view returns (uint256)',
    'function nonce() view returns (uint256)',
    'function VERSION() view returns (string)',
];

const direccionHotWallet = () => process.env.TX_TREASURY_ADDRESS_137 || process.env.TX_TREASURY_ADDRESS || null;
const rpcPolygon = () => (process.env.POLYGON_RPC_URL
    ? new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL, CHAIN_ID, { staticNetwork: true })
    : null);

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
    const rpc = rpcPolygon();
    if (!rpc || !direccion) return null;
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

/** El multisig de tesorería leído en cadena. null si no hay RPC o no es un Safe. */
async function leerSafe(direccion) {
    const rpc = rpcPolygon();
    if (!rpc || !ethers.isAddress(direccion)) return null;
    const c = new ethers.Contract(direccion, SAFE_ABI, rpc);
    const [owners, threshold, nonce, version, pol] = await Promise.allSettled([
        c.getOwners(), c.getThreshold(), c.nonce(), c.VERSION(), rpc.getBalance(direccion),
    ]);
    if (owners.status !== 'fulfilled' || threshold.status !== 'fulfilled') {
        return { address: direccion, isSafe: false };
    }
    return {
        address: direccion,
        isSafe: true,
        owners: owners.value.map((o) => ethers.getAddress(o)),
        threshold: Number(threshold.value),
        nonce: nonce.status === 'fulfilled' ? Number(nonce.value) : null,
        version: version.status === 'fulfilled' ? version.value : null,
        pol: pol.status === 'fulfilled' ? ethers.formatEther(pol.value) : null,
        explorer: `https://polygonscan.com/address/${direccion}`,
    };
}

/**
 * Lo que sólo se ve cruzando los datos de las dos antiguas secciones: la Hot
 * Wallet, el Safe, los firmantes y la configuración. Cada aviso dice qué hacer.
 */
function diagnostico({ hot, safe, aprobadores, appConfigurada, hotConfigurada, loginWallet = null }) {
    const avisos = [];
    const minus = (a) => String(a || '').toLowerCase();
    const activos = aprobadores.filter((a) => a.status === 'active');
    if (!hotConfigurada) avisos.push({ nivel: 'aviso', code: 'HOT_WALLET_NOT_CONFIGURED', texto: 'TX_TREASURY_ADDRESS_137 no está configurada: se ve la Hot Wallet registrada, pero no se puede ejecutar nada.' });
    if (!appConfigurada) avisos.push({ nivel: 'aviso', code: 'TREASURY_APP_MISSING', texto: 'Falta BEZPAY_TREASURY_APP_ID: sin la app interna de tesorería no se pueden proponer operaciones.' });
    if (activos.length < 2) avisos.push({ nivel: 'critico', code: 'NOT_ENOUGH_APPROVERS', texto: `Hay ${activos.length} firmante(s) activo(s) y se exigen 2.` });
    if (activos.some((a) => minus(a.address) === minus(hot))) {
        avisos.push({ nivel: 'critico', code: 'HOT_WALLET_IS_APPROVER', texto: 'La Hot Wallet está dada de alta como firmante: aprobaría sus propias salidas.' });
    }
    if (loginWallet && minus(loginWallet) === minus(hot)) {
        avisos.push({ nivel: 'aviso', code: 'HOT_WALLET_IS_LOGIN', texto: 'La wallet de login del panel (ADMIN_WALLET) es la Hot Wallet: quien robe esa clave entra al panel y mueve fondos con la misma.' });
    }
    if (safe?.isSafe) {
        if (safe.threshold < 2) avisos.push({ nivel: 'critico', code: 'SAFE_THRESHOLD_1', texto: `El Safe firma con ${safe.threshold} de ${safe.owners.length}: una sola clave lo controla.` });
        if (safe.owners.some((o) => minus(o) === minus(hot))) {
            avisos.push({ nivel: 'critico', code: 'HOT_WALLET_IS_SAFE_OWNER', texto: 'La Hot Wallet es propietaria del Safe: la clave más expuesta puede mover el multisig.' });
        }
        const fuera = activos.filter((a) => !safe.owners.some((o) => minus(o) === minus(a.address)));
        if (fuera.length) avisos.push({ nivel: 'info', code: 'APPROVER_NOT_SAFE_OWNER', texto: `${fuera.length} firmante(s) no son propietarios del Safe.` });
    } else if (safe && !safe.isSafe) {
        avisos.push({ nivel: 'aviso', code: 'SAFE_NOT_A_SAFE', texto: 'La dirección configurada como Safe no responde como un Safe en Polygon.' });
    }
    return avisos;
}

// ── Resumen ────────────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
    try {
        const direccion = direccionHotWallet();
        const efectiva = direccion || HOT_WALLET_REGISTRADA;
        const config = await treasuryConfig.leer();
        const [aprob, bal, ks, comision, safe] = await Promise.all([
            query(
                `SELECT address, label, status, expires_at, created_at
                 FROM tx_approvers
                 WHERE app_id IS NULL AND 'treasury' = ANY(roles)
                 ORDER BY created_at ASC`,
            ),
            saldos(efectiva).catch((err) => {
                logger.warn({ err: err.message }, 'hot wallet: no se pudieron leer los saldos');
                return null;
            }),
            killSwitch.estadoEfectivo({ appId: process.env.BEZPAY_TREASURY_APP_ID, rail: 'crypto_transfer' }).catch(() => ({ estado: 'UNKNOWN' })),
            settlement.comisionAcumulada().catch(() => null),
            leerSafe(config.safeWallet).catch((err) => {
                logger.warn({ err: err.message }, 'hot wallet: no se pudo leer el Safe');
                return null;
            }),
        ]);
        const vigentes = aprob.rows.filter((a) => a.status === 'active' && (!a.expires_at || new Date(a.expires_at) > new Date()));
        const minus = (a) => String(a || '').toLowerCase();
        const esOwner = (a) => Boolean(safe?.isSafe && safe.owners.some((o) => minus(o) === minus(a)));
        const aprobadores = aprob.rows.map((a) => ({
            address: a.address,
            label: a.label,
            status: vigentes.includes(a) ? 'active' : (a.status === 'active' ? 'expired' : a.status),
            expiresAt: a.expires_at,
            safeOwner: esOwner(a.address),
            isHotWallet: minus(a.address) === minus(efectiva),
        }));
        res.json({
            hotWallet: {
                address: efectiva,
                configured: Boolean(direccion),
                registeredAddress: HOT_WALLET_REGISTRADA,
                matchesRegistered: !direccion || direccion.toLowerCase() === HOT_WALLET_REGISTRADA.toLowerCase(),
                safeOwner: esOwner(efectiva),
                chainId: CHAIN_ID,
                explorer: `https://polygonscan.com/address/${efectiva}`,
                keyCustody: 'tx-signer (KMS): la API no tiene la clave',
            },
            balances: bal,
            safe: safe && safe.isSafe
                ? {
                    ...safe,
                    owners: safe.owners.map((o) => ({
                        address: o,
                        isHotWallet: minus(o) === minus(efectiva),
                        isApprover: vigentes.some((a) => minus(a.address) === minus(o)),
                    })),
                }
                : safe,
            approvers: aprobadores,
            // Tesorería: txPolicyEngine exige al menos 2 aprobaciones, y el tx-signer
            // vuelve a exigir su minApprovals (≥ 2 en producción) con su propia lista.
            policy: { minApprovals: 2, activeApprovers: vigentes.length, ready: vigentes.length >= 2 },
            config: { ...config, loginWallet: treasuryConfig.delDespliegue().loginWallet },
            killSwitch: { estado: ks.estado, motivo: ks.motivo || null },
            treasuryAppConfigured: Boolean(appTesoreria()),
            marketplaceFees: comision,
            diagnostics: diagnostico({
                hot: efectiva,
                safe,
                aprobadores: aprobadores.map((a) => ({ ...a, status: a.status })),
                appConfigurada: Boolean(appTesoreria()),
                hotConfigurada: Boolean(direccion),
                loginWallet: treasuryConfig.delDespliegue().loginWallet,
            }),
        });
    } catch (err) {
        responderError(res, err, 'resumen');
    }
});

/** Config del panel (Safe vigilado y preferencias). La misma que /api/admin-config/treasury. */
router.put('/config', async (req, res) => {
    try {
        const { safeWallet, dailyLimit, approvalThreshold } = req.body || {};
        const { config, persistida } = await treasuryConfig.guardar({ safeWallet, dailyLimit, approvalThreshold });
        if (!persistida) return res.status(503).json({ error: 'Redis no disponible: no se guardó.', code: 'CONFIG_NOT_PERSISTED' });
        logger.info({ admin: req.admin?.sub || req.admin?.email, safeWallet: config.safeWallet }, 'tesorería: configuración actualizada');
        res.json({ config });
    } catch (err) {
        if (err instanceof treasuryConfig.ConfigInvalida) return res.status(400).json({ error: err.message, code: err.code, details: err.errores });
        responderError(res, err, 'config');
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
module.exports._diagnostico = diagnostico;
