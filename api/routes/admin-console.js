'use strict';

/**
 * routes/admin-console.js — API única del propietario para trabajar y probar
 * todos los sectores y servicios de BeZhas, con el gas subvencionado.
 *
 *   GET  /api/admin/console              índice de esta API
 *   GET  /api/admin/console/catalog      servicios y contratos por sector
 *   GET  /api/admin/console/health       RPC + contratos con código, por sector
 *   POST /api/admin/console/session      JWT de 30 min para llamar a las rutas
 *                                        de cada sector con la sesión SuperAdmin
 *   POST /api/admin/console/contracts/read     llamada view/pure (sin gas)
 *   GET  /api/admin/console/sponsor/status     operador, saldo, topes, gasto
 *   POST /api/admin/console/sponsor/execute    simula; con confirm:true emite
 *   GET  /api/admin/console/knowledge?q=       RAG léxico local sobre docs/ (coste 0)
 *   GET  /api/admin/console/rwa                panorama CargoLink por estado
 *
 * La guarda va en el propio router (igual que admin-config): montado donde sea,
 * queda cerrado por defecto.
 */

const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { requireSuperAdmin } = require('../middleware/admin-auth');
const { JWT_SECRET } = require('../config/secrets');
const { cadenaPorDefecto, entorno } = require('../config/chain-policy');
const { catalogo, contratosDeLaCadena } = require('../config/admin-sectors');
const sponsor = require('../services/adminSponsor');
const logger = require('../utils/logger');

const router = Router();
router.use(requireSuperAdmin);

const SESSION_TTL_S = 30 * 60;

function responderError(res, err) {
    if (err instanceof sponsor.SponsorError) {
        return res.status(err.status).json({ error: err.message, code: err.code });
    }
    logger.error(`[admin-console] ${err.stack || err.message}`);
    return res.status(500).json({ error: 'Error interno de la consola de administración.', code: 'INTERNAL' });
}

router.get('/', (_req, res) => {
    const chainId = cadenaPorDefecto();
    res.json({
        chainId,
        entorno: entorno(chainId),
        endpoints: [
            'GET /catalog', 'GET /health', 'POST /session',
            'POST /contracts/read', 'GET /sponsor/status', 'POST /sponsor/execute',
            'GET /knowledge?q=', 'GET /rwa',
        ],
    });
});

router.get('/catalog', (_req, res) => {
    res.json(catalogo(cadenaPorDefecto()));
});

router.get('/health', async (_req, res) => {
    const chainId = cadenaPorDefecto();
    const { getProvider, pingChain } = require('../services/contractService');
    const rpc = await pingChain();
    if (!rpc.reachable) return res.json({ chainId, rpc, sectores: null });

    const provider = getProvider();
    const { core, sectores } = contratosDeLaCadena(chainId);
    const comprobar = async (grupo) => {
        const entradas = Object.entries(grupo);
        const codigos = await Promise.allSettled(entradas.map(([, addr]) => provider.getCode(addr)));
        const conCodigo = codigos.filter((c) => c.status === 'fulfilled' && c.value !== '0x').length;
        return { contratos: entradas.length, conCodigo, sinCodigo: entradas.length - conCodigo };
    };
    const resultado = { core: await comprobar(core) };
    for (const [s, c] of Object.entries(sectores)) resultado[s] = await comprobar(c);
    res.json({ chainId, rpc, sectores: resultado });
});

/**
 * Las rutas de cada sector validan `authenticateToken` (role 'admin'), no la
 * cookie SuperAdmin. Esto cambia una sesión por la otra, para poder usar una sola
 * credencial. Es corto (30 min), sólo role admin, y queda en el log.
 */
router.post('/session', (req, res) => {
    const wallet = req.admin.wallet || process.env.ADMIN_WALLET || null;
    const token = jwt.sign(
        { role: 'admin', via: 'admin-console', address: wallet, userId: 0 },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: SESSION_TTL_S },
    );
    logger.warn('[admin-console] sesión de sector emitida para el SuperAdmin');
    res.json({ token, expiresIn: SESSION_TTL_S, uso: 'Authorization: Bearer <token>' });
});

router.post('/contracts/read', async (req, res) => {
    try {
        const { contract, method, args, chainId } = req.body || {};
        res.json(await sponsor.leer({ contrato: contract, metodo: method, args, chainId }));
    } catch (err) { responderError(res, err); }
});

router.get('/sponsor/status', async (_req, res) => {
    try { res.json(await sponsor.estado()); } catch (err) { responderError(res, err); }
});

router.post('/sponsor/execute', async (req, res) => {
    try {
        const { contract, method, args, chainId, confirm } = req.body || {};
        const out = await sponsor.ejecutar(
            { contrato: contract, metodo: method, args, chainId, confirm },
            { actor: req.admin.wallet || req.admin.username || 'superadmin' },
        );
        res.json(out);
    } catch (err) { responderError(res, err); }
});

/**
 * RAG sin LLM ni embeddings (BM25 en memoria): lo usa el agente del propietario
 * —Claude, ChatGPT, Gemini— y redacta él. Cuesta cero y devuelve fragmentos.
 */
router.get('/knowledge', (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2 || q.length > 300) {
        return res.status(400).json({ error: 'Parámetro q de 2 a 300 caracteres.', code: 'BAD_QUERY' });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 10);
    res.json(require('../services/knowledgeIndex').buscar(q, limit));
});

/** RWA / CargoLink agregado. Sin carga ni propietario de cada envío. */
router.get('/rwa', async (req, res) => {
    try {
        const { query } = require('../db/pool');
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 25);
        const [porEstado, recientes] = await Promise.all([
            query(`SELECT status, COUNT(*)::int AS total, COALESCE(SUM(escrow_amount_bez),0)::float AS escrow_bez
                     FROM cargolink_transactions GROUP BY status ORDER BY total DESC`),
            query(`SELECT b_uid, status, origin, destination, escrow_status, created_at, updated_at
                     FROM cargolink_transactions ORDER BY created_at DESC LIMIT $1`, [limit]),
        ]);
        res.json({
            total: porEstado.rows.reduce((n, r) => n + r.total, 0),
            porEstado: porEstado.rows,
            recientes: recientes.rows,
        });
    } catch (err) { responderError(res, err); }
});

module.exports = router;
