/**
 * routes/gas-tank-rpc.js — paymaster web service ERC-7677 (JSON-RPC) para wallets y SDKs de terceros.
 *
 *   POST /api/rpc/paymaster              cabecera x-api-key
 *   POST /api/rpc/paymaster/:appKey      la clave en la URL (los SDKs de wallets solo aceptan una URL)
 *
 * La app que llama debe tener el scope `gas` y pertenecer a una organización con Gas Tank. Siempre HTTP 200 con
 * un cuerpo JSON-RPC; los fallos van en `error` (-32602 parámetros, -32001 denegado o sin saldo, -32000 no disponible).
 */
const crypto = require('crypto');
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { authenticateGateway, requireScope } = require('../middleware/gateway-auth');
const { query } = require('../db/pool');
const erc7677 = require('../services/gasTank/erc7677');

const router = Router();

// Límites ANTES de autenticar, para que una avalancha de claves falsas no llegue a la base de datos:
//   - por IP (generoso: varias apps pueden salir por la misma), y
//   - por clave (la clave se guarda hasheada en la memoria del limitador).
// Responden con un error JSON-RPC (-32005, «limit exceeded» de EIP-1474).
const keyOf = (req) => req.headers['x-api-key'] || req.params.appKey || '';
const tooMany = (_req, res) => res.status(429).json({ jsonrpc: '2.0', id: null, error: { code: -32005, message: 'Demasiadas peticiones' } });
const ipLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.GAS_RPC_IP_RATE_LIMIT, 10) || 300,
    keyGenerator: (req) => `gasrpc-ip:${req.ip}`,
    handler: tooMany, standardHeaders: true, legacyHeaders: false,
});
const keyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseInt(process.env.GAS_RPC_KEY_RATE_LIMIT, 10) || 120,
    keyGenerator: (req) => `gasrpc-key:${crypto.createHash('sha256').update(keyOf(req)).digest('hex')}`,
    skip: (req) => !keyOf(req),
    handler: tooMany, standardHeaders: true, legacyHeaders: false,
});

const rpcFail = (res, id, error) => res.json({ jsonrpc: '2.0', id: id ?? null, error });

// La clave de la URL solo se acepta si no vino ya en la cabecera, y no se registra en ningún sitio.
function keyFromPath(req, _res, next) {
    if (req.params.appKey && !req.headers['x-api-key']) req.headers['x-api-key'] = req.params.appKey;
    next();
}

async function handle(req, res) {
    const { id, method, params } = req.body || {};
    if (!req.registeredApp) return rpcFail(res, id, { code: -32001, message: 'Se requiere una API key de app' });
    const fn = erc7677.METHODS[method];
    if (!fn) return rpcFail(res, id, { code: -32601, message: 'Método no soportado' });
    if (!Array.isArray(params) || params.length < 3) return rpcFail(res, id, { code: -32602, message: 'Parámetros: [userOp, entryPoint, chainId, context?]' });

    try {
        const { rows } = await query(
            `SELECT o.id FROM organizations o JOIN app_registry a ON a.enterprise_id = o.legacy_enterprise_id WHERE a.id::text = $1 LIMIT 1`,
            [req.registeredApp.id]
        );
        if (!rows[0]) return rpcFail(res, id, { code: -32001, message: 'La app no pertenece a ninguna organización con Gas Tank' });
        const result = await fn({ orgId: rows[0].id, appId: String(req.registeredApp.id), params });
        return res.json({ jsonrpc: '2.0', id: id ?? null, result });
    } catch (err) {
        return rpcFail(res, id, erc7677.toRpcError(err));
    }
}

router.post('/', ipLimiter, keyLimiter, authenticateGateway, requireScope('gas'), handle);
router.post('/:appKey', ipLimiter, keyLimiter, keyFromPath, authenticateGateway, requireScope('gas'), handle);

module.exports = router;
