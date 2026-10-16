'use strict';

/**
 * routes/admin-operant.js — Pestaña OPERANT del panel SuperAdmin (fase 1: SOLO LECTURA).
 *
 * El panel estático de OPERANT (`business-ops/public/panel.html`) guardaba en el
 * navegador la api-key de administración de OPERANT, la que abre todos los
 * tenants. Aquí el navegador no la ve nunca: se autentica con la sesión de
 * SuperAdmin y es esta API quien habla con OPERANT por `operantBridge`
 * (clave interna, cortacircuitos, sin simulados).
 *
 * Solo GET. Las acciones (aprobar, lanzar tareas, programar) llegan en la fase 2,
 * con auditoría y CSRF. Se opera siempre sobre el tenant de la propia empresa
 * (`BEZHAS_TENANT_ID`, por defecto `bezhas`): el tenant no se acepta del cliente,
 * así esta puerta no sirve para mirar los de los clientes.
 */
const { Router } = require('express');
const { requireSuperAdmin } = require('../middleware/admin-auth');
const operant = require('../services/operantBridge');

const router = Router();
router.use(requireSuperAdmin);

const tenantId = () => process.env.BEZHAS_TENANT_ID || 'bezhas';

/** Traduce los errores del puente a respuestas HTTP honestas. */
function fail(res, err) {
    if (err instanceof operant.OperantUnavailableError) {
        return res.status(503).json({ error: err.message, code: 'OPERANT_UNAVAILABLE' });
    }
    if (err instanceof operant.OperantError) {
        // 503 del buzón sin configurar y similares: se conserva el código de OPERANT.
        const status = err.status >= 400 && err.status < 600 ? err.status : 502;
        return res.status(status === 401 || status === 403 ? 502 : status)
            .json({ error: err.message, code: err.body?.code || 'OPERANT_ERROR' });
    }
    return res.status(500).json({ error: 'error interno', code: 'INTERNAL' });
}

const wrap = (fn) => async (req, res) => {
    try { res.json(await fn(req)); } catch (err) { fail(res, err); }
};

// Estado del puente: sondeo barato para pintar el semáforo de la pestaña.
router.get('/status', wrap(async () => ({
    configured: operant.configured(),
    tenantId: tenantId(),
    runtime: await operant.health(),
})));

router.get('/overview', wrap(() => operant.tenantDashboard({ tenantId: tenantId() })));
router.get('/approvals', wrap(() => operant.listApprovals({ tenantId: tenantId() })));
router.get('/audit/verify', wrap(() => operant.auditVerify({ tenantId: tenantId() })));

router.get('/mailbox', wrap((req) => {
    const { folder, q, sort, limit, offset } = req.query;
    return operant.mailboxList({ tenantId: tenantId(), folder, q, sort, limit, offset });
}));

// Antes de /mailbox/:uid, o "dmarc" se tomaría por un uid.
router.get('/mailbox/dmarc', wrap((req) => operant.mailboxDmarc({ tenantId: tenantId(), days: req.query.days })));

router.get('/mailbox/:uid', wrap((req) => operant.mailboxGet({
    tenantId: tenantId(), uid: req.params.uid, folder: req.query.folder,
})));

module.exports = router;
