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
 * Las lecturas son GET. Las ESCRITURAS (lanzar automatizaciones, resolver
 * aprobaciones, sincronizar el RAG) exigen además la cabecera `x-bezhas-admin: 1`:
 * al ser una cabecera personalizada fuerza la comprobación previa de CORS, así
 * que una web de terceros no puede disparar la acción con la cookie del admin.
 * Cada escritura deja una fila en admin_automation_runs con el actor.
 * Se opera siempre sobre el tenant de la propia empresa
 * (`BEZHAS_TENANT_ID`, por defecto `bezhas`): el tenant no se acepta del cliente,
 * así esta puerta no sirve para mirar los de los clientes.
 */
const { Router } = require('express');
const crypto = require('crypto');
const { requireSuperAdmin } = require('../middleware/admin-auth');
const operant = require('../services/operantBridge');
const { query } = require('../db/pool');
const { register } = require('../middleware/metrics');
const { crearAdminAutomation } = require('../services/adminAutomation');

const router = Router();

/** Valores de una métrica Prometheus de esta instancia (null si no existe). */
async function metricValues(name) {
    const m = register.getSingleMetric(name);
    return m ? (await m.get()).values : null;
}

const automation = crearAdminAutomation({
    query, operant, metricValues,
    // Carga perezosa: el Knowledge Plane arranca un store al importarlo.
    knowledgeStore: { chunksVisibles: (t) => require('../services/knowledge').knowledge.store.chunksVisibles(t) },
});

// ── Caché corta de lecturas ──────────────────────────────────────────────────
// Cada lectura abre una conexión a OPERANT (y, si es la bandeja, una IMAP al
// buzón: 2-4 s). Abrir la pestaña lanzaba varias a la vez, y la propia pestaña
// las repetía al refrescar. Se reutiliza la respuesta unos segundos y las
// peticiones simultáneas comparten una sola. Los errores NO se cachean, y toda
// escritura vacía la caché para que el panel vea su propio efecto al instante.
const cache = new Map();
// Apagada bajo test (Jest fija JEST_WORKER_ID; NODE_ENV no siempre es 'test'),
// salvo que el propio test la active con ADMIN_OPERANT_CACHE=on.
const cacheActiva = () => process.env.ADMIN_OPERANT_CACHE === 'on'
    || (process.env.ADMIN_OPERANT_CACHE !== 'off' && process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID);

function conCache(clave, ttlMs, fn) {
    if (!cacheActiva()) return fn();
    const hit = cache.get(clave);
    if (hit && Date.now() - hit.at < ttlMs) return hit.promesa;
    const promesa = fn().catch((err) => { cache.delete(clave); throw err; });
    cache.set(clave, { at: Date.now(), promesa });
    return promesa;
}
const vaciarCache = () => cache.clear();

const igualesSeguro = (a, b) => {
    const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * El programador (Cloud Scheduler) no tiene sesión de admin: llama a /tick con
 * un token propio (ADMIN_AUTOMATION_TOKEN, >= 32 caracteres). Sin token
 * configurado esa puerta está cerrada. Cualquier otra petición sigue el camino
 * normal de SuperAdmin.
 */
router.post('/automations/tick', (req, res, next) => {
    const token = process.env.ADMIN_AUTOMATION_TOKEN || '';
    const enviado = req.headers['x-automation-token'];
    if (enviado) {
        if (token.length < 32 || !igualesSeguro(enviado, token)) {
            return res.status(401).json({ error: 'token de automatización inválido', code: 'AUTOMATION_TOKEN_INVALID' });
        }
        req.automationActor = 'scheduler';
        return next();
    }
    return requireSuperAdmin(req, res, next);
}, async (req, res) => {
    if (process.env.ADMIN_AUTOMATION_ENABLED === 'false') {
        return res.status(503).json({ error: 'automatizaciones desactivadas (ADMIN_AUTOMATION_ENABLED=false)', code: 'AUTOMATION_DISABLED' });
    }
    try {
        const results = await automation.tick({ actor: req.automationActor || actorDe(req) });
        vaciarCache();
        res.json({ results });
    } catch (err) { fail(res, err); }
});

router.use(requireSuperAdmin);

const actorDe = (req) => String(req.admin?.wallet || req.admin?.username || 'admin').slice(0, 120);

/** Las escrituras exigen la cabecera que fuerza la comprobación previa de CORS. */
function escritura(req, res, next) {
    if (req.headers['x-bezhas-admin'] !== '1') {
        return res.status(403).json({ error: 'falta la cabecera x-bezhas-admin', code: 'ADMIN_HEADER_REQUIRED' });
    }
    next();
}

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
router.get('/status', wrap(() => conCache('status', 10_000, async () => ({
    configured: operant.configured(),
    tenantId: tenantId(),
    runtime: await operant.health(),
}))));

// ── Automatizaciones: sección de admin → señal → tarea de OPERANT ───────────
router.get('/automations', wrap(() => conCache('automations', 10_000, async () => ({ automations: await automation.listar(), coverage: automation.cobertura() }))));

router.post('/automations/:id/run', escritura, async (req, res) => {
    try {
        const r = await automation.ejecutar(req.params.id, { actor: actorDe(req), force: req.body?.force === true });
        vaciarCache();
        if (r.status === 'unknown') return res.status(404).json({ error: 'automatización desconocida' });
        res.json(r);
    } catch (err) { fail(res, err); }
});

router.post('/approvals/:approvalId/resolve', escritura, async (req, res) => {
    try {
        const resuelta = await automation.resolverAprobacion({
            approvalId: req.params.approvalId, decision: req.body?.decision,
            reason: typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : undefined,
            actor: actorDe(req),
        });
        vaciarCache();
        res.json(resuelta);
    } catch (err) {
        if (err.status === 400) return res.status(400).json({ error: err.message });
        fail(res, err);
    }
});

router.post('/knowledge/sync', escritura, async (req, res) => {
    try { const r = await automation.sincronizarConocimiento({ actor: actorDe(req) }); vaciarCache(); res.json(r); }
    catch (err) { if (err.status) return res.status(err.status).json({ error: err.message }); fail(res, err); }
});

router.get('/overview', wrap(() => conCache('overview', 10_000, () => operant.tenantDashboard({ tenantId: tenantId() }))));
router.get('/approvals', wrap(() => conCache('approvals', 10_000, () => operant.listApprovals({ tenantId: tenantId() }))));
router.get('/audit/verify', wrap(() => conCache('audit', 30_000, () => operant.auditVerify({ tenantId: tenantId() }))));

router.get('/mailbox', wrap((req) => {
    const { folder, q, sort, limit, offset } = req.query;
    return conCache(`mailbox:${JSON.stringify([folder, q, sort, limit, offset])}`, 15_000,
        () => operant.mailboxList({ tenantId: tenantId(), folder, q, sort, limit, offset }));
}));

// Antes de /mailbox/:uid, o "dmarc" se tomaría por un uid.
router.get('/mailbox/dmarc', wrap((req) => conCache(`dmarc:${req.query.days || ''}`, 30_000, () => operant.mailboxDmarc({ tenantId: tenantId(), days: req.query.days }))));

router.get('/mailbox/:uid', wrap((req) => operant.mailboxGet({
    tenantId: tenantId(), uid: req.params.uid, folder: req.query.folder,
})));

module.exports = router;
