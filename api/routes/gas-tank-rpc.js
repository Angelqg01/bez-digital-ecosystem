/**
 * routes/gas-tank-rpc.js — paymaster web service ERC-7677 (JSON-RPC) para wallets y SDKs de terceros.
 *
 *   POST /api/rpc/paymaster              cabecera x-api-key
 *   POST /api/rpc/paymaster/:appKey      la clave en la URL (los SDKs de wallets solo aceptan una URL)
 *
 * La app que llama debe tener el scope `gas` y pertenecer a una organización con Gas Tank. Siempre HTTP 200 con
 * un cuerpo JSON-RPC; los fallos van en `error` (-32602 parámetros, -32001 denegado o sin saldo, -32000 no disponible).
 */
const { Router } = require('express');
const { authenticateGateway, requireScope } = require('../middleware/gateway-auth');
const { query } = require('../db/pool');
const erc7677 = require('../services/gasTank/erc7677');

const router = Router();

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

router.post('/', authenticateGateway, requireScope('gas'), handle);
router.post('/:appKey', keyFromPath, authenticateGateway, requireScope('gas'), handle);

module.exports = router;
