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

/**
 * OPERANT en Cloud Run se despliega con `--no-allow-unauthenticated`, como el
 * resto de backends privados: Cloud Run exige un ID token de Google cuyo
 * audience sea su URL. Va en `X-Serverless-Authorization` y no en
 * `Authorization` ni en `x-api-key`: Cloud Run lo valida y lo retira, y deja
 * intacta la clave interna que OPERANT comprueba por su cuenta. En local
 * (localhost, o una URL http) no hace nada. Falla abierto: si no se puede
 * acuñar el token, la petición sale igualmente y Cloud Run responde 401, que
 * aquí cuenta como servicio no disponible.
 */
let _idTokenClient = null;
let _idTokenCache = { token: null, exp: 0 };
async function cabeceraIdToken() {
    let origin;
    try { origin = new URL(BASE_URL); } catch { return {}; }
    if (origin.protocol !== 'https:' || /^(localhost|127\.0\.0\.1)$/.test(origin.hostname)) return {};
    if (_idTokenCache.token && _idTokenCache.exp > Date.now()) {
        return { 'x-serverless-authorization': `Bearer ${_idTokenCache.token}` };
    }
    try {
        const { GoogleAuth } = require('google-auth-library');
        _idTokenClient = _idTokenClient || await new GoogleAuth().getIdTokenClient(origin.origin);
        const headers = await _idTokenClient.getRequestHeaders();
        const bearer = headers.Authorization || headers.authorization || '';
        const token = bearer.replace(/^Bearer\s+/i, '');
        if (!token) return {};
        _idTokenCache = { token, exp: Date.now() + 45 * 60 * 1000 }; // dura ~1 h
        return { 'x-serverless-authorization': `Bearer ${token}` };
    } catch (err) {
        logger.warn({ error: err.message }, 'No se pudo acuñar el ID token para OPERANT');
        return {};
    }
}
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

async function request(method, path, body, opciones = {}) {
    if (!configured()) {
        throw new OperantUnavailableError('falta OPERANT_INTERNAL_KEY');
    }
    if (circuitState() === 'open') {
        throw new OperantUnavailableError(`circuito abierto tras ${failures} fallos`);
    }

    const controller = new AbortController();
    const timeoutMs = opciones.timeoutMs || TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            method,
            signal: controller.signal,
            headers: {
                'content-type': 'application/json',
                'x-api-key': INTERNAL_KEY,
                ...(opciones.headers || {}),
                ...(await cabeceraIdToken()),
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
        throw new OperantUnavailableError(err.name === 'AbortError' ? `timeout ${timeoutMs}ms` : err.message);
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
        // `/health`, no `/healthz`: en Cloud Run ésta es una ruta reservada y devuelve 404 sin llegar a OPERANT.
        const data = await request('GET', '/health');
        return { available: true, circuit: circuitState(), ...data };
    } catch (err) {
        // OPERANT responde 503 con un cuerpo `status: degraded` cuando una dependencia
        // (el correo, p. ej.) falla. Eso es un servicio VIVO con un canal caído, no un
        // servicio caído: tratarlo como no disponible escondía todo OPERANT del panel
        // por una contraseña de buzón mal puesta.
        if (err instanceof OperantError && err.body && typeof err.body.status === 'string') {
            return { available: true, degraded: true, circuit: circuitState(), ...err.body };
        }
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

/** Panel del tenant (KPIs, tareas, aprobaciones, cuota). Solo lectura. */
function tenantDashboard({ tenantId }) {
    return request('GET', `/tenants/${encodeURIComponent(tenantId)}/dashboard`);
}

/** Lote de la bandeja del buzón de la plataforma (OPERANT lo lee por IMAP). Solo lectura. */
function mailboxList({ tenantId, folder, q, sort, limit, offset }) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ folder, q, sort, limit, offset })) {
        if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    return request('GET', `/tenants/${encodeURIComponent(tenantId)}/mailbox?${qs}`);
}

/** Un correo completo, como texto plano. No lo marca como leído. */
function mailboxGet({ tenantId, uid, folder }) {
    const qs = folder ? `?folder=${encodeURIComponent(folder)}` : '';
    return request('GET', `/tenants/${encodeURIComponent(tenantId)}/mailbox/${encodeURIComponent(uid)}${qs}`);
}

/** Digest DMARC del buzón (informes agregados resumidos por remitente). Solo lectura. */
function mailboxDmarc({ tenantId, days }) {
    const qs = days ? `?days=${encodeURIComponent(days)}` : '';
    return request('GET', `/tenants/${encodeURIComponent(tenantId)}/mailbox/dmarc${qs}`);
}

/** Indexa (o reemplaza, por id) un artículo en la base de conocimiento del tenant. */
function kbIngest({ tenantId, id, title, body, tags }) {
    return request('POST', `/tenants/${encodeURIComponent(tenantId)}/kb`, { id, title, body, tags });
}

/** Estado del embudo de ventas: leads pendientes de procesar. Solo lectura. */
function funnel({ tenantId }) {
    return request('GET', `/tenants/${encodeURIComponent(tenantId)}/funnel`);
}

/** Cola de publicaciones sociales programadas. Solo lectura. */
function marketingQueue({ tenantId }) {
    return request('GET', `/tenants/${encodeURIComponent(tenantId)}/marketing/queue`);
}

/**
 * Reenvía a OPERANT un mensaje entrante de un canal (Telegram, correo…) tal como llegó.
 * Los webhooks de los proveedores no pueden llamar a OPERANT directamente (es privado en
 * Cloud Run): entran por la API, que verifica su secreto y los pasa por aquí con el ID token.
 * `headers` lleva el secreto propio del canal, que OPERANT vuelve a comprobar.
 */
function forwardChannel({ channel, tenantId, body, headers }) {
    return request('POST', `/channels/${encodeURIComponent(channel)}/${encodeURIComponent(tenantId)}/inbound`, body,
        { headers, timeoutMs: 28000 });
}

module.exports = {
    OperantUnavailableError,
    OperantError,
    configured,
    circuitState,
    health,
    forwardChannel,
    provisionTenant,
    dispatchTask,
    getTask,
    listApprovals,
    resolveApproval,
    auditBatch,
    auditVerify,
    auditMarkAnchored,
    tenantUsage,
    tenantDashboard,
    mailboxList,
    mailboxGet,
    mailboxDmarc,
    kbIngest,
    funnel,
    marketingQueue,
    _resetCircuitForTests: () => { failures = 0; openUntil = 0; },
};
