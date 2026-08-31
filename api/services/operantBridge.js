/**
 * operantBridge — cliente HTTP del runtime de OPERANT desde la API de BeZhas.
 *
 * OPERANT corre como servicio aparte (multi-tenant, cola de tareas, agentes).
 * El Gateway no ejecuta agentes: aprovisiona el tenant, autoriza según el plan,
 * mide el consumo y factura. Este módulo es la única puerta entre los dos.
 *
 * Autenticación: clave interna compartida (`OPERANT_INTERNAL_KEY`), que en
 * OPERANT corresponde a `INTERNAL_API_KEY` — la clave de administración que da
 * acceso a todos los tenants. Nunca se expone al cliente final: el cliente se
 * autentica contra BeZhas con SU api-key del Gateway, y es BeZhas quien habla
 * con OPERANT.
 *
 * Degradación: mismo contrato que BeZhasCoreConnector al revés — cortocircuito
 * tras N fallos seguidos para no acumular timeouts cuando OPERANT está caído.
 * A diferencia de una lectura de telemetría, aquí NO se devuelve un simulado:
 * una tarea de agente que "parece" haberse ejecutado y no existe es peor que un
 * error. Se lanza `OperantUnavailableError` y la ruta responde 503.
 */

'use strict';

const logger = require('pino')({ level: 'info', name: 'operant-bridge' });

const BASE_URL = (process.env.OPERANT_API_URL || 'http://localhost:3010').replace(/\/$/, '');
const INTERNAL_KEY = process.env.OPERANT_INTERNAL_KEY || '';
const TIMEOUT_MS = parseInt(process.env.OPERANT_TIMEOUT_MS || '20000', 10);
const FAILURE_THRESHOLD = parseInt(process.env.OPERANT_FAILURE_THRESHOLD || '3', 10);
const COOLDOWN_MS = parseInt(process.env.OPERANT_COOLDOWN_MS || '60000', 10);

class OperantUnavailableError extends Error {
    constructor(reason) {
        super(`OPERANT no disponible: ${reason}`);
        this.name = 'OperantUnavailableError';
        this.code = 'OPERANT_UNAVAILABLE';
        this.status = 503;
    }
}

class OperantError extends Error {
    constructor(status, body) {
        super(body?.error || `OPERANT respondió ${status}`);
        this.name = 'OperantError';
        this.code = 'OPERANT_ERROR';
        this.status = status;
        this.body = body;
    }
}

let failures = 0;
let openUntil = 0;

/** 'open' = se sabe caído y no se gasta otro timeout hasta el enfriado. */
function circuitState() {
    return Date.now() < openUntil ? 'open' : 'closed';
}

function configured() {
    return Boolean(INTERNAL_KEY);
}

async function request(method, path, body) {
    if (!configured()) {
        throw new OperantUnavailableError('falta OPERANT_INTERNAL_KEY');
    }
    if (circuitState() === 'open') {
        throw new OperantUnavailableError(`circuito abierto tras ${failures} fallos`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            method,
            signal: controller.signal,
            headers: {
                'content-type': 'application/json',
                'x-api-key': INTERNAL_KEY,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });

        // Respondió: el servicio está vivo aunque la respuesta sea un 4xx de
        // negocio (tenant inexistente, plan sin ese departamento...). Eso NO
        // debe abrir el circuito.
        failures = 0;

        const text = await res.text();
        const parsed = text ? safeJson(text) : {};
        if (!res.ok) throw new OperantError(res.status, parsed);
        return parsed;
    } catch (err) {
        if (err instanceof OperantError) throw err;
        failures++;
        if (failures >= FAILURE_THRESHOLD) {
            openUntil = Date.now() + COOLDOWN_MS;
            logger.error({ failures, cooldownMs: COOLDOWN_MS }, 'Circuito OPERANT abierto');
        }
        throw new OperantUnavailableError(err.name === 'AbortError' ? `timeout ${TIMEOUT_MS}ms` : err.message);
    } finally {
        clearTimeout(timer);
    }
}

function safeJson(text) {
    try { return JSON.parse(text); } catch { return { raw: text }; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Operaciones
// ─────────────────────────────────────────────────────────────────────────────

/** Salud del runtime (no abre circuito: es justo lo que se usa para sondearlo). */
async function health() {
    try {
        const data = await request('GET', '/healthz');
        return { available: true, circuit: circuitState(), ...data };
    } catch (err) {
        return { available: false, circuit: circuitState(), reason: err.message };
    }
}

/**
 * Aprovisiona (o reconfigura) un tenant en OPERANT con los límites del plan.
 * Idempotente: OPERANT hace upsert por tenantId.
 */
function provisionTenant({ tenantId, planId, departments, limits, businessId }) {
    return request('POST', '/bridge/tenants', {
        tenantId, plan: planId, departments, limits, businessId,
    });
}

/** Lanza una tarea a un departamento. Devuelve { taskId, status, usage, auditHash }. */
function dispatchTask({ tenantId, department, input, context, autonomy, async: isAsync }) {
    return request('POST', `/bridge/tenants/${encodeURIComponent(tenantId)}/handle`, {
        department, input, context, autonomy, async: isAsync,
    });
}

/** Estado y traza de una tarea. */
function getTask({ tenantId, taskId }) {
    return request('GET', `/bridge/tenants/${encodeURIComponent(tenantId)}/tasks/${encodeURIComponent(taskId)}`);
}

/** Aprobaciones humanas pendientes (cola HITL). */
function listApprovals({ tenantId }) {
    return request('GET', `/bridge/tenants/${encodeURIComponent(tenantId)}/approvals`);
}

/** Resuelve una aprobación humana. `decision`: 'approve' | 'reject'. */
function resolveApproval({ tenantId, approvalId, decision, reason, approver }) {
    return request('POST', `/bridge/tenants/${encodeURIComponent(tenantId)}/approvals/${encodeURIComponent(approvalId)}`, {
        decision, reason, approver,
    });
}

/**
 * Lote de auditoría pendiente de anclar: raíz merkle + metadatos del tramo.
 * OPERANT lo calcula sobre SU cadena de hashes (es quien la tiene entera).
 */
function auditBatch({ tenantId, since }) {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return request('GET', `/bridge/tenants/${encodeURIComponent(tenantId)}/audit/batch${qs}`);
}

/** Verificación de integridad de la cadena de auditoría completa. */
function auditVerify({ tenantId }) {
    return request('GET', `/bridge/tenants/${encodeURIComponent(tenantId)}/audit/verify`);
}

/** Marca un lote como anclado (guarda la tx en el propio OPERANT). */
function auditMarkAnchored({ tenantId, merkleRoot, txHash, chainId, blockNumber }) {
    return request('POST', `/bridge/tenants/${encodeURIComponent(tenantId)}/audit/anchored`, {
        merkleRoot, txHash, chainId, blockNumber,
    });
}

/** Consumo del ciclo según el propio OPERANT (para conciliar con el ledger). */
function tenantUsage({ tenantId }) {
    return request('GET', `/bridge/tenants/${encodeURIComponent(tenantId)}/usage`);
}

module.exports = {
    OperantUnavailableError,
    OperantError,
    configured,
    circuitState,
    health,
    provisionTenant,
    dispatchTask,
    getTask,
    listApprovals,
    resolveApproval,
    auditBatch,
    auditVerify,
    auditMarkAnchored,
    tenantUsage,
    _resetCircuitForTests: () => { failures = 0; openUntil = 0; },
};
