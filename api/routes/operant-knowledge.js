'use strict';

/**
 * Búsqueda en el Knowledge Plane para OPERANT, con la identidad de cada empresa.
 *
 * OPERANT llama aquí desde sus agentes de Soporte (y de onboarding) en vez de
 * depender sólo de la copia que hace sync-operant-kb: así responde con el mismo
 * conocimiento, vigente, que el chat y el MCP.
 *
 * Seguridad:
 *   - Sólo con la clave interna API ↔ OPERANT (`x-api-key` = OPERANT_INTERNAL_KEY).
 *   - El tenant de OPERANT (`bez-…`) se traduce aquí a su app y su plan
 *     (operant_tenants + gateway_subscriptions); el principal es el mismo que
 *     el de la api-key de esa empresa en el MCP (principalDeApp). Nunca se
 *     construye con datos del cuerpo más allá del id del tenant.
 *   - El tenant propio de BeZhas (OPERANT_PLATFORM_TENANT, por defecto
 *     «bezhas») ve el conocimiento público. El de una empresa cliente, sólo su
 *     conocimiento privado: su Soporte atiende a los clientes de esa empresa.
 *   - Tenant desconocido o no activo → 404: no se responde con el público como
 *     si nada, para que un tenant mal aprovisionado se note.
 */
const crypto = require('crypto');
const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { query } = require('../db/pool');
const { buscarConocimiento } = require('../services/knowledge/search');

const router = Router();
const TENANT_RE = /^[a-z0-9][a-z0-9-]{1,38}$/;
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest();

function claveInternaValida(req) {
    const esperada = process.env.OPERANT_INTERNAL_KEY || '';
    const recibida = String(req.headers['x-api-key'] || '');
    if (!esperada || !recibida) return false;
    return crypto.timingSafeEqual(sha256(recibida), sha256(esperada));
}

const limite = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.OPERANT_KNOWLEDGE_RPM || 300),
    keyGenerator: (req) => `opk:${String(req.body?.tenantId || '').slice(0, 40)}`,
    message: { error: 'too_many_requests' },
    standardHeaders: true,
    legacyHeaders: false,
});

/** Empresa (app) y plan de un tenant de OPERANT; null si no existe o no está activo. */
async function appDeTenant(tenantId, db = query) {
    const plataforma = process.env.OPERANT_PLATFORM_TENANT || 'bezhas';
    if (tenantId === plataforma) return { app: { id: `operant-${plataforma}` }, plan: 'starter', soloPropio: false };
    const { rows } = await db(
        `SELECT t.app_id, COALESCE(s.plan_id, t.plan_id) AS plan_id
           FROM operant_tenants t
           LEFT JOIN gateway_subscriptions s ON s.app_id = t.app_id AND s.status = 'active'
          WHERE t.tenant_id = $1 AND t.status = 'active'
          LIMIT 1`,
        [tenantId]
    );
    if (!rows[0]) return null;
    // Empresa cliente: sólo su conocimiento privado. Su Soporte atiende a SUS clientes; el público de BeZhas no aplica.
    return { app: { id: rows[0].app_id }, plan: rows[0].plan_id, soloPropio: true };
}

function crearRouter({ db = query, buscar = buscarConocimiento } = {}) {
    const r = Router();
    r.post('/search', (req, res, next) => (claveInternaValida(req) ? next() : res.status(401).json({ error: 'unauthorized' })), limite, async (req, res) => {
        const tenantId = String(req.body?.tenantId || '');
        if (!TENANT_RE.test(tenantId)) return res.status(400).json({ error: 'invalid_tenant' });
        try {
            const empresa = await appDeTenant(tenantId, db);
            if (!empresa) return res.status(404).json({ error: 'unknown_tenant' });
            const out = await buscar({ ...empresa, pregunta: req.body?.pregunta, limite: req.body?.limite });
            res.json(out);
        } catch (err) {
            res.status(err.status || 500).json({ error: err.status ? err.message : 'search_failed', code: err.code });
        }
    });
    return r;
}

router.use(crearRouter());

module.exports = router;
module.exports.crearRouter = crearRouter;
module.exports.appDeTenant = appDeTenant;
