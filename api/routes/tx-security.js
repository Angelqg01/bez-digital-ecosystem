'use strict';

/**
 * routes/tx-security.js — operaciones con fondos y controles de emergencia.
 *
 *   /api/gateway/v1/tx/*   intenciones, aprobaciones, ejecución, destinos, agentes
 *   /api/security/*        kill switch, aprobadores, KYB, verificación de auditoría
 *
 * Todo lo que mueve dinero entra por /tx/intents y sigue el mismo camino:
 * intención → simulación → riesgo → política → aprobación firmada → firmante
 * aislado o proveedor FIAT. No hay atajo: las rutas antiguas del Gateway que
 * devuelven transacciones sin firmar siguen existiendo para la custodia propia,
 * pero ninguna mueve fondos custodiados.
 */

const { Router } = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const { authenticateGateway, requireScope } = require('../middleware/gateway-auth');
const { resolverPlan } = require('../middleware/resolve-plan');
const { orquestador } = require('../services/txOrchestrator');
const killSwitch = require('../services/killSwitch');
const txApproval = require('../services/txApproval');
const auditoria = require('../services/securityAudit');
const repo = require('../services/txRepository');
const txIntent = require('../services/txIntent');
const { RAILS } = require('../config/tx-rails');
const { INTERNAL_API_KEY } = require('../config/secrets');
const { query } = require('../db/pool');
const logger = require('../utils/logger');

function coincide(dado, esperado) {
    if (typeof dado !== 'string' || typeof esperado !== 'string') return false;
    const a = Buffer.from(dado);
    const b = Buffer.from(esperado);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function claveInternaValida(req) {
    const k = req.headers['x-internal-key'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    return Boolean(INTERNAL_API_KEY) && coincide(k, INTERNAL_API_KEY);
}

function responderError(res, err) {
    if (err?.name === 'TxError') {
        return res.status(err.status).json({ error: err.message, code: err.code, detalles: err.detalles });
    }
    if (err?.code && /^(KILL_SWITCH|SECURITY_ACTION|APPROVAL)_/.test(err.code)) {
        return res.status(400).json({ error: err.message, code: err.code });
    }
    logger.error({ error: err?.message, code: err?.code }, 'tx-security: error no controlado');
    return res.status(500).json({ error: 'Error interno.', code: 'INTERNAL' });
}

const limitador = rateLimit({
    windowMs: 60 * 1000,
    max: () => Number(process.env.TX_RATE_LIMIT_PER_MIN) || 60,
    keyGenerator: (req) => req.headers['x-api-key'] || req.ip,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas operaciones por minuto.', code: 'TX_RATE_LIMIT' },
});

const exigirApiKey = (req, res, next) => (req.registeredApp
    ? next()
    : res.status(401).json({ error: 'Las operaciones con fondos exigen api-key.', code: 'API_KEY_REQUIRED' }));

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_FIRMA = /^0x[0-9a-fA-F]{130}$/;

// ═══════════════════════════════════════════════════════════════════════════
//  /api/gateway/v1/tx
// ═══════════════════════════════════════════════════════════════════════════

const txRouter = Router();
txRouter.use(authenticateGateway, exigirApiKey, resolverPlan, limitador);

const SCOPES_DINERO = ['wallet', 'payments', 'treasury'];

txRouter.post('/intents', requireScope(...SCOPES_DINERO), async (req, res) => {
    try {
        const intencion = await orquestador().crearIntencion({
            entrada: req.body,
            app: req.registeredApp,
            agente: req.agent || null,
            plan: req.plan,
            canal: req.agent ? `agent:${req.agent.agentId}` : 'api',
        });
        res.status(intencion.idempotente ? 200 : 201).json({ success: true, intencion });
    } catch (err) {
        responderError(res, err);
    }
});

txRouter.get('/intents/:id', requireScope(...SCOPES_DINERO), async (req, res) => {
    if (!RE_UUID.test(req.params.id)) return res.status(404).json({ error: 'Intención no encontrada.', code: 'INTENT_NOT_FOUND' });
    try {
        res.json({ success: true, intencion: await orquestador().obtener({ id: req.params.id, app: req.registeredApp }) });
    } catch (err) {
        responderError(res, err);
    }
});

/**
 * La firma es la credencial: quien la envía da igual, lo que cuenta es qué
 * wallet firmó y si está en la lista de aprobadores. Un agente puede
 * transportar una firma, nunca producirla.
 */
txRouter.post('/intents/:id/approvals', requireScope(...SCOPES_DINERO), async (req, res) => {
    if (!RE_UUID.test(req.params.id)) return res.status(404).json({ error: 'Intención no encontrada.', code: 'INTENT_NOT_FOUND' });
    const { signature, decision = 'APPROVE' } = req.body || {};
    if (!RE_FIRMA.test(String(signature || ''))) {
        return res.status(400).json({ error: 'signature debe ser una firma EIP-712 (65 bytes en hex).', code: 'APPROVAL_SIGNATURE_INVALID' });
    }
    try {
        const intencion = await orquestador().aprobar({ id: req.params.id, app: req.registeredApp, firma: signature, decision });
        res.json({ success: true, intencion });
    } catch (err) {
        responderError(res, err);
    }
});

txRouter.post('/intents/:id/execute', requireScope(...SCOPES_DINERO), async (req, res) => {
    if (!RE_UUID.test(req.params.id)) return res.status(404).json({ error: 'Intención no encontrada.', code: 'INTENT_NOT_FOUND' });
    try {
        const intencion = await orquestador().ejecutar({
            id: req.params.id, app: req.registeredApp, agente: req.agent || null, plan: req.plan,
        });
        res.json({ success: true, intencion });
    } catch (err) {
        responderError(res, err);
    }
});

// ── Destinos ───────────────────────────────────────────────────────────────

txRouter.get('/destinations', requireScope(...SCOPES_DINERO), async (req, res) => {
    try {
        res.json({ success: true, destinos: await repo.listarDestinos(req.registeredApp.id) });
    } catch (err) {
        responderError(res, err);
    }
});

/**
 * Alta de destino. Entra en `pending` con periodo de enfriamiento: durante ese
 * tiempo cualquier pago a él pide aprobación. Es la defensa clásica contra el
 * fraude del «cambio de cuenta del proveedor».
 */
txRouter.post('/destinations', requireScope(...SCOPES_DINERO), async (req, res) => {
    const { type, value, name, country } = req.body || {};
    try {
        let normalizado;
        if (type === 'evm_address') {
            normalizado = txIntent.normalizarDireccion(value, 'value');
        } else if (type === 'iban') {
            const iban = txIntent.validarIban(value);
            if (!iban.valido) return res.status(400).json({ error: `IBAN no válido (${iban.motivo}).`, code: 'IBAN_INVALID' });
            normalizado = iban.iban;
        } else {
            return res.status(400).json({ error: 'type debe ser evm_address o iban.', code: 'DESTINATION_TYPE_INVALID' });
        }
        if (country !== undefined && !/^[A-Z]{2}$/.test(String(country))) {
            return res.status(400).json({ error: 'country debe ser ISO 3166-1 alfa-2.', code: 'COUNTRY_INVALID' });
        }
        const horas = Number(process.env.TX_DESTINATION_COOLING_HOURS) || 24;
        const alta = await repo.registrarDestino({
            appId: req.registeredApp.id, type, value: normalizado,
            name: typeof name === 'string' ? name.slice(0, 140) : null, country: country || null, enfriamientoHoras: horas,
        });
        await auditoria.registrar({
            eventType: 'destination.added', appId: req.registeredApp.id, agentId: req.agent?.agentId || null,
            payload: { type, value: normalizado, nuevo: Boolean(alta) },
        });
        res.status(alta ? 201 : 200).json({ success: true, destino: alta || { type, value: normalizado, yaExistia: true } });
    } catch (err) {
        responderError(res, err);
    }
});

// ── Agentes ────────────────────────────────────────────────────────────────

txRouter.post('/agents', async (req, res) => {
    // Un agente no crea agentes: sería una forma de salir de sus propios límites.
    if (req.agent) return res.status(403).json({ error: 'Una credencial de agente no puede crear agentes.', code: 'AGENT_CANNOT_MANAGE_AGENTS' });
    const b = req.body || {};
    if (!/^[a-z0-9][a-z0-9._-]{1,63}$/.test(String(b.agentId || ''))) {
        return res.status(400).json({ error: 'agentId: minúsculas, dígitos, punto, guion; 2-64.', code: 'AGENT_ID_INVALID' });
    }
    const deEmpresa = req.registeredApp.scopes || [];
    const scopes = (Array.isArray(b.scopes) ? b.scopes : []).filter((s) => s !== 'admin'
        && (deEmpresa.includes('admin') || deEmpresa.includes(s)));
    const rails = (Array.isArray(b.rails) ? b.rails : []).filter((r) => Object.prototype.hasOwnProperty.call(RAILS, r));
    const dias = Math.min(Math.max(Number(b.expiresInDays) || 90, 1), 365);
    const limite = (v) => (v === undefined || v === null ? null : Math.max(Number(v) || 0, 0));

    const clave = `bzag_${crypto.randomBytes(24).toString('base64url')}`;
    try {
        await query(
            `INSERT INTO app_agents (app_id, agent_id, name, key_hash, key_prefix, scopes, rails,
                                     per_tx_limit_eur, daily_limit_eur, can_execute, expires_at)
             VALUES ($1, $2, $3, encode(digest($4, 'sha256'), 'hex'), $5, $6, $7, $8, $9, $10, NOW() + ($11 || ' days')::interval)`,
            [req.registeredApp.id, b.agentId, typeof b.name === 'string' ? b.name.slice(0, 120) : null, clave, clave.slice(0, 12),
                scopes, rails, limite(b.perTxLimitEur), limite(b.dailyLimitEur), b.canExecute === true, String(dias)]
        );
        await auditoria.registrar({
            eventType: 'agent.created', appId: req.registeredApp.id, agentId: b.agentId,
            payload: { scopes, rails, perTxLimitEur: limite(b.perTxLimitEur), dailyLimitEur: limite(b.dailyLimitEur), canExecute: b.canExecute === true, dias },
        });
        // La clave se enseña UNA vez. Aquí sólo queda su hash.
        res.status(201).json({ success: true, agente: { agentId: b.agentId, scopes, rails, canExecute: b.canExecute === true, expiraEnDias: dias }, clave });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un agente con ese id.', code: 'AGENT_EXISTS' });
        responderError(res, err);
    }
});

txRouter.delete('/agents/:agentId', async (req, res) => {
    if (req.agent) return res.status(403).json({ error: 'Una credencial de agente no puede gestionar agentes.', code: 'AGENT_CANNOT_MANAGE_AGENTS' });
    try {
        const r = await query(
            `UPDATE app_agents SET status = 'revoked' WHERE app_id = $1 AND agent_id = $2 AND status = 'active'`,
            [req.registeredApp.id, req.params.agentId]
        );
        await auditoria.registrar({ eventType: 'agent.revoked', appId: req.registeredApp.id, agentId: req.params.agentId });
        res.json({ success: true, revocado: r.rowCount > 0 });
    } catch (err) {
        responderError(res, err);
    }
});

// ═══════════════════════════════════════════════════════════════════════════
//  /api/security
// ═══════════════════════════════════════════════════════════════════════════

const securityRouter = Router();

securityRouter.get('/kill-switch', authenticateGateway, async (req, res) => {
    try {
        const global = await killSwitch.estadoEfectivo({});
        const propio = req.registeredApp ? await killSwitch.estadoEfectivo({ appId: req.registeredApp.id }) : null;
        res.json({ success: true, global, cliente: propio });
    } catch (err) {
        responderError(res, err);
    }
});

/** Elevar: clave interna o UNA firma de un aprobador de seguridad. */
securityRouter.post('/kill-switch/raise', async (req, res) => {
    const { scope, state, reason, message, signature } = req.body || {};
    try {
        let actor = null;
        if (claveInternaValida(req)) {
            actor = 'internal-key';
        } else if (message && signature) {
            const firmante = txApproval.recuperarAccionSeguridad({ message, signature });
            if (message.action !== 'raise' || message.scope !== scope || message.state !== state) {
                return res.status(400).json({ error: 'La firma no corresponde a esta acción.', code: 'SECURITY_ACTION_MISMATCH' });
            }
            if (!(await txApproval.aprobadoresDeSeguridad([firmante])).length) {
                return res.status(403).json({ error: 'No es un aprobador de seguridad.', code: 'SECURITY_APPROVER_REQUIRED' });
            }
            actor = firmante;
        } else {
            return res.status(401).json({ error: 'Clave interna o firma de seguridad requerida.', code: 'SECURITY_AUTH_REQUIRED' });
        }
        const r = await killSwitch.elevar({ scope, estado: state, motivo: reason, actor });
        await auditoria.registrar({ eventType: 'kill_switch.raised', actor, payload: { ...r, motivo: reason } });
        res.json({ success: true, killSwitch: r });
    } catch (err) {
        responderError(res, err);
    }
});

/**
 * Rebajar: dos firmas de aprobadores de seguridad distintos, en la misma
 * petición. Cada nonce se usa una vez: una rebaja firmada no se puede guardar y
 * repetir después de que alguien vuelva a elevar el estado.
 */
securityRouter.post('/kill-switch/lower', async (req, res) => {
    const { scope, state, reason, approvals } = req.body || {};
    try {
        if (!Array.isArray(approvals) || approvals.length < 2 || approvals.length > 5) {
            return res.status(400).json({ error: 'Hacen falta entre 2 y 5 firmas.', code: 'KILL_SWITCH_LOWER_REQUIRES_TWO' });
        }
        const firmantes = [];
        const nonces = [];
        for (const a of approvals) {
            const dir = txApproval.recuperarAccionSeguridad(a);
            const m = a.message;
            if (m.action !== 'lower' || m.scope !== scope || m.state !== state) {
                return res.status(400).json({ error: 'Una firma no corresponde a esta acción.', code: 'SECURITY_ACTION_MISMATCH' });
            }
            firmantes.push(dir);
            nonces.push(String(m.nonce));
        }
        const { rows: usados } = await query(
            `SELECT 1 FROM security_audit_log
              WHERE event_type = 'kill_switch.lowered' AND payload->'nonces' ?| $1 LIMIT 1`,
            [nonces]
        );
        if (usados.length) return res.status(409).json({ error: 'Firma ya utilizada.', code: 'SECURITY_ACTION_REPLAYED' });

        const validos = await txApproval.aprobadoresDeSeguridad([...new Set(firmantes)]);
        if (validos.length < 2) {
            return res.status(403).json({ error: 'Hacen falta dos aprobadores de seguridad distintos y activos.', code: 'KILL_SWITCH_LOWER_REQUIRES_TWO' });
        }
        const r = await killSwitch.rebajar({ scope, estado: state, motivo: reason, actores: validos });
        await auditoria.registrar({ eventType: 'kill_switch.lowered', actor: validos.join(','), payload: { ...r, motivo: reason, nonces } });
        res.json({ success: true, killSwitch: r });
    } catch (err) {
        responderError(res, err);
    }
});

/**
 * Alta de aprobadores: sólo backoffice (clave interna), tras KYB. Si una api-key
 * de cliente pudiera dar de alta aprobadores, robar esa clave bastaría para
 * aprobarse a sí mismo cualquier pago.
 */
securityRouter.post('/approvers', async (req, res) => {
    if (!claveInternaValida(req)) return res.status(401).json({ error: 'Clave interna requerida.', code: 'INTERNAL_KEY_REQUIRED' });
    const { appId = null, address, roles, label, expiresAt, createdBy } = req.body || {};
    try {
        if (!/^0x[0-9a-fA-F]{40}$/.test(String(address || ''))) return res.status(400).json({ error: 'address no válida.', code: 'ADDRESS_INVALID' });
        const permitidos = ['approver', 'treasury', 'security'];
        if (!Array.isArray(roles) || !roles.length || !roles.every((r) => permitidos.includes(r))) {
            return res.status(400).json({ error: `roles ⊂ ${permitidos.join(', ')}`, code: 'ROLES_INVALID' });
        }
        if (appId && (roles.includes('treasury') || roles.includes('security'))) {
            return res.status(400).json({ error: 'Los roles treasury y security son globales de BeZhas.', code: 'ROLES_INVALID' });
        }
        if (!createdBy) return res.status(400).json({ error: 'createdBy: quién da el alta, para la auditoría.', code: 'CREATED_BY_REQUIRED' });
        const { rows } = await query(
            `INSERT INTO tx_approvers (app_id, address, roles, label, expires_at, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, app_id, address, roles, status, expires_at`,
            [appId, address.toLowerCase(), roles, label || null, expiresAt || null, String(createdBy).slice(0, 120)]
        );
        await auditoria.registrar({ eventType: 'approver.added', appId, actor: String(createdBy), payload: { address: address.toLowerCase(), roles } });
        res.status(201).json({ success: true, aprobador: rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Ese aprobador ya existe.', code: 'APPROVER_EXISTS' });
        responderError(res, err);
    }
});

securityRouter.post('/kyb', async (req, res) => {
    if (!claveInternaValida(req)) return res.status(401).json({ error: 'Clave interna requerida.', code: 'INTERNAL_KEY_REQUIRED' });
    const { enterpriseId, level, provider, reference } = req.body || {};
    if (!RE_UUID.test(String(enterpriseId || '')) || ![0, 1, 2].includes(level)) {
        return res.status(400).json({ error: 'enterpriseId (uuid) y level (0-2) obligatorios.', code: 'KYB_INVALID' });
    }
    try {
        const { rows } = await query(
            `INSERT INTO kyb_status (enterprise_id, level, provider, reference, verified_at, updated_at)
             VALUES ($1, $2, $3, $4, CASE WHEN $2 > 0 THEN NOW() ELSE NULL END, NOW())
             ON CONFLICT (enterprise_id) DO UPDATE
                SET level = $2, provider = $3, reference = $4,
                    verified_at = CASE WHEN $2 > 0 THEN NOW() ELSE NULL END, updated_at = NOW()
             RETURNING enterprise_id, level, provider, verified_at`,
            [enterpriseId, level, provider || null, reference || null]
        );
        await auditoria.registrar({ eventType: 'kyb.updated', actor: 'internal-key', payload: { enterpriseId, level, provider } });
        res.json({ success: true, kyb: rows[0] });
    } catch (err) {
        responderError(res, err);
    }
});

securityRouter.get('/audit/verify', async (req, res) => {
    if (!claveInternaValida(req)) return res.status(401).json({ error: 'Clave interna requerida.', code: 'INTERNAL_KEY_REQUIRED' });
    try {
        const limite = Math.min(Number(req.query.limit) || 10000, 100000);
        const { rows } = await query('SELECT * FROM security_audit_log ORDER BY seq ASC LIMIT $1', [limite]);
        res.json({ success: true, verificacion: auditoria.verificarCadena(rows) });
    } catch (err) {
        responderError(res, err);
    }
});

module.exports = { txRouter, securityRouter };
