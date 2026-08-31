'use strict';

/**
 * PureScan — trazabilidad alimentaria (escaneo → análisis → DPP anclado).
 *
 * Sustituye a los mocks que devolvía routes/purescan.js. Dos decisiones que
 * explican la forma del módulo:
 *
 *  1. El análisis de visión NO se resuelve aquí. Se delega en el AgentManager,
 *     cuya API (`dispatch`) es asíncrona y devuelve un taskId. Por eso el
 *     escaneo tiene máquina de estados (pending → analyzing → completed/failed)
 *     y el cliente sondea, en lugar de recibir un veredicto fabricado al vuelo.
 *
 *  2. El DPP reutiliza el HASHEO merkle de telemetryAnchor.js (leafHash y
 *     merkleRoot), no su anclaje: anchorTelemetryOnChain() es específico del
 *     EnergyOracle (kWh, período) y meter ahí un pasaporte alimentario sería
 *     abusar de su semántica. Todavía no hay contrato para DPP de alimentación,
 *     así que createDpp() acepta un bridge con `anchor(root, account)` y, sin él,
 *     el pasaporte queda en 'pending' con su raíz calculada y guardada. Eso es la
 *     verdad; el mock devolvía un hash aleatorio con status CONFIRMED.
 */

const crypto = require('crypto');
const { query } = require('../db/pool');
const { leafHash, merkleRoot } = require('./telemetryAnchor');

/** El mock de DB en desarrollo devuelve `{ rows: [{}] }`: sin id no hay fila. */
const realRow = (rows) => {
    const row = rows && rows[0];
    return row && row.id ? row : null;
};

const ANALYZE_TASK_TYPE = process.env.PURESCAN_TASK_TYPE || 'purescan.analyze';

function newRef(prefix) {
    return `${prefix}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Escaneos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registra un escaneo y encarga su análisis al runtime de agentes.
 *
 * Devuelve siempre el escaneo persistido. Si no hay AgentManager disponible el
 * escaneo queda en 'unavailable' en lugar de inventar un análisis: la
 * trazabilidad alimentaria es justo el sitio donde un dato falso hace daño.
 */
async function createScan({ walletAddress = null, sku = null, product = null, batch = null, payload = {} }, manager = null) {
    const scanRef = newRef('SCAN');

    const inserted = await query(
        `INSERT INTO purescan_scans (scan_ref, wallet_address, sku, product, batch, source_payload, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING id, scan_ref, status, created_at`,
        [scanRef, walletAddress, sku, product, batch, JSON.stringify(payload || {})]
    );
    const scan = realRow(inserted.rows) || { id: null, scan_ref: scanRef, status: 'pending' };

    if (!manager || typeof manager.dispatch !== 'function') {
        await setScanStatus(scanRef, 'unavailable', {
            errorMessage: 'No hay runtime de agentes disponible para analizar el escaneo',
        });
        return { ...scan, status: 'unavailable', taskId: null };
    }

    try {
        const taskId = await manager.dispatch({
            type: ANALYZE_TASK_TYPE,
            priority: 'normal',
            source: 'purescan',
            payload: { scanRef, sku, product, batch, scan: payload },
        });

        await query(
            `UPDATE purescan_scans SET status = 'analyzing', task_id = $2, updated_at = NOW()
              WHERE scan_ref = $1`,
            [scanRef, taskId ? String(taskId) : null]
        );

        return { ...scan, status: 'analyzing', taskId: taskId ? String(taskId) : null };
    } catch (err) {
        await setScanStatus(scanRef, 'failed', { errorMessage: err.message });
        return { ...scan, status: 'failed', taskId: null, error: err.message };
    }
}

async function setScanStatus(scanRef, status, { errorMessage = null, analysis = null, riskLevel = null } = {}) {
    const { rows } = await query(
        `UPDATE purescan_scans
            SET status = $2,
                error_message = $3,
                analysis = COALESCE($4::jsonb, analysis),
                risk_level = COALESCE($5, risk_level),
                updated_at = NOW()
          WHERE scan_ref = $1
      RETURNING id, scan_ref, status, analysis, risk_level, updated_at`,
        [scanRef, status, errorMessage, analysis ? JSON.stringify(analysis) : null, riskLevel]
    );
    return realRow(rows);
}

/** Escritura del resultado por parte del agente. Cierra el ciclo del sondeo. */
async function completeScan(scanRef, analysis) {
    if (!analysis || typeof analysis !== 'object') {
        throw new Error('completeScan requiere un objeto de análisis');
    }
    return setScanStatus(scanRef, 'completed', {
        analysis,
        riskLevel: analysis.risk_level || analysis.riskLevel || null,
    });
}

async function getScan(scanRef) {
    const { rows } = await query(
        `SELECT id, scan_ref, wallet_address, sku, product, batch, status, task_id,
                analysis, risk_level, error_message, created_at, updated_at
           FROM purescan_scans WHERE scan_ref = $1 LIMIT 1`,
        [scanRef]
    );
    return realRow(rows);
}

async function listScans({ limit = 10, status = null } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const { rows } = await query(
        `SELECT scan_ref, sku, product, batch, status, risk_level, created_at, updated_at
           FROM purescan_scans
          WHERE ($1::text IS NULL OR status = $1)
          ORDER BY created_at DESC
          LIMIT $2`,
        [status, safeLimit]
    );
    return (rows || []).filter((r) => r.scan_ref);
}

async function recordFeedback(scanRef, { verdict, comment = null, createdBy = null }) {
    const allowed = ['confirm', 'reject', 'correct'];
    if (!allowed.includes(verdict)) {
        throw new Error(`verdict debe ser uno de: ${allowed.join(', ')}`);
    }

    const { rows } = await query(
        `INSERT INTO purescan_feedback (scan_id, verdict, comment, created_by)
         SELECT s.id, $2, $3, $4 FROM purescan_scans s WHERE s.scan_ref = $1
         RETURNING id, verdict, created_at`,
        [scanRef, verdict, comment, createdBy]
    );

    return realRow(rows);
}

// ─────────────────────────────────────────────────────────────────────────────
// Digital Product Passport
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea el DPP y calcula su hoja merkle. Si se pasa un bridge se ancla la raíz en
 * cadena; si no, queda 'pending' a la espera de que alguien lo haga.
 */
async function createDpp({ scanRef = null, payload }, bridge = null, account = null) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('createDpp requiere el payload del pasaporte');
    }

    const dppRef = newRef('DPP');
    const leaf = leafHash(payload);
    const root = merkleRoot([leaf]);

    // El escaneo asociado es opcional: se puede emitir un DPP sin escaneo previo.
    let scanId = null;
    if (scanRef) {
        const found = await query(
            'SELECT id FROM purescan_scans WHERE scan_ref = $1 LIMIT 1',
            [scanRef]
        );
        const row = realRow(found.rows);
        scanId = row ? row.id : null;
    }

    const inserted = await query(
        `INSERT INTO purescan_dpp (dpp_ref, scan_id, payload, leaf_hash, merkle_root, status)
         VALUES ($1, $2, $3::jsonb, $4, $5, 'pending')
         RETURNING id, dpp_ref, status, leaf_hash, merkle_root`,
        [dppRef, scanId, JSON.stringify(payload), `0x${leaf}`, root]
    );

    const dpp = realRow(inserted.rows)
        || { dpp_ref: dppRef, status: 'pending', leaf_hash: `0x${leaf}`, merkle_root: root };

    if (!bridge || typeof bridge.anchor !== 'function') {
        return { ...dpp, anchored: false, reason: 'sin bridge configurado' };
    }

    try {
        const txHash = await bridge.anchor(root, account);
        const updated = await query(
            `UPDATE purescan_dpp
                SET status = 'anchored', anchor_tx_hash = $2, anchored_at = NOW()
              WHERE dpp_ref = $1
          RETURNING id, dpp_ref, status, anchor_tx_hash, merkle_root`,
            [dppRef, txHash || null]
        );
        return { ...(realRow(updated.rows) || dpp), anchored: true, txHash: txHash || null };
    } catch (err) {
        await query(
            `UPDATE purescan_dpp SET status = 'failed' WHERE dpp_ref = $1`,
            [dppRef]
        );
        return { ...dpp, status: 'failed', anchored: false, error: err.message };
    }
}

async function getDpp(dppRef) {
    const { rows } = await query(
        `SELECT dpp_ref, scan_id, payload, leaf_hash, merkle_root, anchor_tx_hash,
                status, anchored_at, created_at
           FROM purescan_dpp WHERE dpp_ref = $1 LIMIT 1`,
        [dppRef]
    );
    return realRow(rows);
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventario y analíticas
// ─────────────────────────────────────────────────────────────────────────────

async function listInventory({ limit = 50 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const { rows } = await query(
        `SELECT sku, product, quantity, batch, status, last_scan_at, updated_at
           FROM purescan_inventory
          ORDER BY updated_at DESC
          LIMIT $1`,
        [safeLimit]
    );
    return (rows || []).filter((r) => r.sku);
}

/** Alta o actualización de una referencia de inventario. */
async function upsertInventory({ sku, product = null, quantity = 0, batch = null, status = 'pending' }) {
    if (!sku) throw new Error('upsertInventory requiere sku');

    const { rows } = await query(
        `INSERT INTO purescan_inventory (sku, product, quantity, batch, status, last_scan_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (sku) DO UPDATE
             SET product = COALESCE(EXCLUDED.product, purescan_inventory.product),
                 quantity = EXCLUDED.quantity,
                 batch = COALESCE(EXCLUDED.batch, purescan_inventory.batch),
                 status = EXCLUDED.status,
                 last_scan_at = NOW(),
                 updated_at = NOW()
         RETURNING id, sku, quantity, status`,
        [sku, product, Number(quantity) || 0, batch, status]
    );
    return realRow(rows);
}

/**
 * Analíticas agregadas sobre lo que hay en la base de datos.
 * El mock devolvía 128 escaneos y un 99,2 % de acierto fijos.
 */
async function getAnalytics() {
    const { rows } = await query(
        `SELECT
             COUNT(*)::int                                                        AS total_scans,
             COUNT(*) FILTER (WHERE status = 'completed')::int                    AS completed_scans,
             COUNT(*) FILTER (WHERE status IN ('pending', 'analyzing'))::int      AS pending_review,
             COUNT(*) FILTER (WHERE status = 'failed')::int                       AS failed_scans,
             COUNT(*) FILTER (WHERE risk_level IN ('HIGH', 'CRITICAL'))::int      AS risk_detected
           FROM purescan_scans`
    );
    const base = (rows && rows[0]) || {};

    const daily = await query(
        `SELECT DATE(created_at) AS date, COUNT(*)::int AS count
           FROM purescan_scans
          WHERE created_at >= NOW() - INTERVAL '7 days'
          GROUP BY DATE(created_at)
          ORDER BY date DESC`
    );

    const anchored = await query(
        `SELECT COUNT(*) FILTER (WHERE status = 'anchored')::int AS anchored_dpp,
                COUNT(*)::int                                    AS total_dpp
           FROM purescan_dpp`
    );

    const total = Number(base.total_scans || 0);
    const completed = Number(base.completed_scans || 0);

    return {
        total_scans: total,
        completed_scans: completed,
        pending_review: Number(base.pending_review || 0),
        failed_scans: Number(base.failed_scans || 0),
        risk_detected: Number(base.risk_detected || 0),
        // Ratio real de escaneos que llegaron a completarse, no una cifra fija.
        completion_rate: total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0,
        anchored_dpp: Number((anchored.rows && anchored.rows[0] && anchored.rows[0].anchored_dpp) || 0),
        total_dpp: Number((anchored.rows && anchored.rows[0] && anchored.rows[0].total_dpp) || 0),
        daily_scans: (daily.rows || []).filter((r) => r.date),
    };
}

/**
 * DID del nodo. Se deriva de la wallet configurada en el entorno; el mock
 * devolvía una cadena fija con credenciales caducadas en 2026.
 */
function getNodeDid() {
    const wallet = process.env.PURESCAN_NODE_WALLET
        || process.env.BEZ_TOKEN_ADDRESS
        || null;

    if (!wallet) {
        return { did: null, verified: false, reason: 'PURESCAN_NODE_WALLET sin configurar' };
    }

    return {
        did: `did:bezhas:${wallet.toLowerCase()}`,
        name: process.env.PURESCAN_NODE_NAME || 'BeZhas Food Oracle Node',
        verified: true,
        wallet_address: wallet,
    };
}

module.exports = {
    createScan,
    setScanStatus,
    completeScan,
    getScan,
    listScans,
    recordFeedback,
    createDpp,
    getDpp,
    listInventory,
    upsertInventory,
    getAnalytics,
    getNodeDid,
    ANALYZE_TASK_TYPE,
};
