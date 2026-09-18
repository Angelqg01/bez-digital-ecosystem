'use strict';

/**
 * txRepository — acceso a datos de la capa transaccional.
 *
 * El orquestador no escribe SQL: habla con esto. Así la lógica de decisión se
 * prueba con un repositorio en memoria, y el SQL vive en un único sitio donde
 * se puede revisar entero.
 */

const { query } = require('../db/pool');

const COLUMNAS_ACTUALIZABLES = new Set([
    'status', 'decision', 'required_approvals', 'policy', 'risk', 'simulation', 'policy_hash',
    'tx_request', 'tx_hash', 'provider_ref', 'execution', 'error_code', 'amount_eur',
]);
const JSONB = new Set(['policy', 'risk', 'simulation', 'tx_request', 'execution']);

async function buscarPorIdempotencia(appId, clave) {
    const { rows } = await query('SELECT * FROM tx_intents WHERE app_id = $1 AND idempotency_key = $2', [appId, clave]);
    return rows[0] || null;
}

async function insertar(f) {
    const { rows } = await query(
        `INSERT INTO tx_intents
           (id, app_id, agent_id, idempotency_key, request_fingerprint, intent, intent_hash, rail, custody,
            amount_eur, status, decision, required_approvals, policy, risk, simulation, policy_hash, tx_request, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (app_id, idempotency_key) DO NOTHING
         RETURNING *`,
        [f.id, f.app_id, f.agent_id, f.idempotency_key, f.request_fingerprint, JSON.stringify(f.intent), f.intent_hash,
            f.rail, f.custody, f.amount_eur, f.status, f.decision, f.required_approvals, JSON.stringify(f.policy),
            JSON.stringify(f.risk), f.simulation ? JSON.stringify(f.simulation) : null, f.policy_hash,
            f.tx_request ? JSON.stringify(f.tx_request) : null, f.expires_at]
    );
    return rows[0] || null;
}

async function obtener(id) {
    if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
    const { rows } = await query('SELECT * FROM tx_intents WHERE id = $1', [id]);
    return rows[0] || null;
}

/**
 * Actualiza sólo si el estado es el esperado. Es el cerrojo que impide que dos
 * peticiones ejecuten la misma intención: la segunda no encuentra la fila en
 * `approved` y recibe null.
 */
async function actualizar(id, cambios, { siEstado } = {}) {
    const claves = Object.keys(cambios).filter((k) => COLUMNAS_ACTUALIZABLES.has(k));
    if (!claves.length) return obtener(id);
    const valores = claves.map((k) => (JSONB.has(k) && cambios[k] !== null ? JSON.stringify(cambios[k]) : cambios[k]));
    const sets = claves.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const params = [id, ...valores];
    let condicion = '';
    if (siEstado) {
        params.push(siEstado);
        condicion = ` AND status = $${params.length}`;
    }
    const { rows } = await query(
        `UPDATE tx_intents SET ${sets}, updated_at = NOW() WHERE id = $1${condicion} RETURNING *`, params
    );
    return rows[0] || null;
}

/**
 * Consumo que cuenta contra los límites. Cuenta lo pendiente y lo aprobado, no
 * sólo lo ejecutado: si no, se esquiva el límite diario abriendo diez
 * intenciones a la vez antes de ejecutar ninguna.
 */
async function uso({ appId, rail, agentId = null, umbralEur = null, excluirId = null }) {
    const { rows } = await query(
        `SELECT
            COALESCE(SUM(amount_eur) FILTER (WHERE created_at > NOW() - INTERVAL '1 day'), 0)   AS dia,
            COALESCE(SUM(amount_eur) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'), 0) AS mes,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')                      AS hora,
            COALESCE(AVG(amount_eur) FILTER (WHERE created_at > NOW() - INTERVAL '30 days'), 0) AS media,
            COALESCE(SUM(amount_eur) FILTER (WHERE created_at > NOW() - INTERVAL '1 day' AND agent_id = $3), 0) AS agente_dia,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day'
                               AND $4::numeric IS NOT NULL
                               AND amount_eur >= $4::numeric * 0.9 AND amount_eur < $4::numeric) AS cerca_umbral
           FROM tx_intents
          WHERE app_id = $1 AND rail = $2
            AND status NOT IN ('denied', 'rejected', 'expired', 'failed')
            AND ($5::uuid IS NULL OR id <> $5::uuid)`,
        [appId, rail, agentId, umbralEur, excluirId]
    );
    const r = rows[0] || {};
    return {
        diaEur: Number(r.dia || 0),
        mesEur: Number(r.mes || 0),
        operacionesUltimaHora: Number(r.hora || 0),
        mediaEur30d: Number(r.media || 0),
        agenteDiaEur: Number(r.agente_dia || 0),
        cercaDeUmbral24h: Number(r.cerca_umbral || 0),
    };
}

/** Estado de un destino para este cliente. Un pendiente cuyo enfriamiento pasó cuenta como activo. */
async function destino({ appId, type, value }) {
    const { rows } = await query(
        `SELECT status, cooling_until, created_at FROM tx_destinations
          WHERE app_id = $1 AND type = $2 AND LOWER(value) = LOWER($3)`,
        [appId, type, value]
    );
    if (!rows.length) return { estado: 'unknown', conocido: false, horasDesdeAlta: null };
    const f = rows[0];
    const horas = (Date.now() - new Date(f.created_at).getTime()) / 3600000;
    let estado = f.status;
    if (estado === 'pending' && f.cooling_until && new Date(f.cooling_until).getTime() <= Date.now()) estado = 'active';
    return { estado, conocido: true, horasDesdeAlta: horas };
}

async function registrarDestino({ appId, type, value, name = null, country = null, enfriamientoHoras = 24 }) {
    const { rows } = await query(
        `INSERT INTO tx_destinations (app_id, type, value, name, country, status, cooling_until)
         VALUES ($1, $2, $3, $4, $5, 'pending', NOW() + ($6 || ' hours')::interval)
         ON CONFLICT (app_id, type, value) DO NOTHING
         RETURNING id, type, value, status, cooling_until`,
        [appId, type, value, name, country, String(enfriamientoHoras)]
    );
    return rows[0] || null;
}

async function listarDestinos(appId) {
    const { rows } = await query(
        `SELECT id, type, value, name, country, status, cooling_until, created_at
           FROM tx_destinations WHERE app_id = $1 ORDER BY created_at DESC LIMIT 500`,
        [appId]
    );
    return rows;
}

async function kycNivel(direccion) {
    if (!direccion) return 0;
    const { rows } = await query('SELECT level FROM kyc_status WHERE wallet_address = $1', [String(direccion).toLowerCase()]);
    return rows.length ? Number(rows[0].level) : 0;
}

async function kybNivel(enterpriseId) {
    if (!enterpriseId) return 0;
    const { rows } = await query('SELECT level FROM kyb_status WHERE enterprise_id = $1', [enterpriseId]);
    return rows.length ? Number(rows[0].level) : 0;
}

async function precioToken(simbolo) {
    const { rows } = await query('SELECT price_usd, updated_at FROM token_price_cache WHERE symbol = $1 LIMIT 1', [simbolo]);
    return rows.length ? { priceUsd: Number(rows[0].price_usd), updatedAt: rows[0].updated_at } : null;
}

async function insertarAprobacion({ intentId, address, decision, signature }) {
    const { rows } = await query(
        `INSERT INTO tx_approvals (intent_id, approver_address, decision, signature)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (intent_id, approver_address) DO NOTHING
         RETURNING id`,
        [intentId, address.toLowerCase(), decision, signature]
    );
    return rows.length > 0;
}

async function aprobaciones(intentId) {
    const { rows } = await query(
        'SELECT approver_address, decision, signature, created_at FROM tx_approvals WHERE intent_id = $1 ORDER BY id ASC',
        [intentId]
    );
    return rows;
}

module.exports = {
    buscarPorIdempotencia, insertar, obtener, actualizar, uso,
    destino, registrarDestino, listarDestinos, kycNivel, kybNivel, precioToken,
    insertarAprobacion, aprobaciones,
};
