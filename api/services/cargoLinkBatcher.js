'use strict';

/**
 * cargoLinkBatcher — agrupa eventos de ciclo de vida logístico en un árbol
 * merkle y ancla UNA raíz por lote, en vez de una transacción por evento.
 *
 * Por qué existe, con los números que lo motivaron (medidos el 21/08/2026
 * sobre 75 contratos desplegados en cadena local):
 *
 *     recordCheckpoint individual .................. 199.676 gas / evento
 *     anchorBatch, 19 hojas ........................ 118.770 gas / lote
 *                                                  =   6.251 gas / evento
 *                                                  →      31,9x más barato
 *
 * Ese factor es lo que separa un techo de ~75 eventos/s de uno de ~2.400 ev/s
 * con bloques de 30M de gas cada 2 s — es decir, la diferencia entre cubrir o
 * no el pico de 500–1.000 ev/s que exige el escenario de ecosistema.
 *
 * ── Política de dos clases ──────────────────────────────────────────────────
 *
 * No todo se puede agrupar. Un lote merkle demuestra que un evento EXISTIÓ,
 * pero no cambia el estado de un contrato. Por eso:
 *
 *   EVIDENCIA (se agrupa)      CUSTOMS_CLEARED, STOWED, DEPARTED, IN_TRANSIT
 *       Son atestaciones. Nadie mueve dinero al leerlas. Lo que importa es
 *       poder probar después, ante un auditor, que ocurrieron y cuándo.
 *
 *   ESTADO (tx inmediata)      CREATED, GATE_IN, GATE_OUT, DELIVERED
 *       Cambian estado que otro contrato lee. CREATED y DELIVERED crean y
 *       liberan el escrow. GATE_IN y GATE_OUT mueven la capacidad ocupada del
 *       almacén en WarehouseManager: si se agruparan, `receiveLot` acabaría
 *       rechazando entradas por una capacidad que en cadena nunca se liberó.
 *       Agruparlas probaría que ocurrieron, pero no las haría efectivas.
 *
 * El ahorro está donde está el volumen: los eventos de evidencia son la
 * mayoría en una operación real (checkpoints, aduanas, tránsito), mientras que
 * las de liquidación son dos por envío.
 *
 * ── Compatibilidad de la prueba ─────────────────────────────────────────────
 *
 * La hoja canónica y el árbol usan el MISMO esquema de pares ordenados que
 * services/cargoTelemetryAnchor.js. Eso permite validar una prueba de
 * inclusión con TelemetryAnchor.verify() sin tocar el contrato.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');
const { query } = require('../db/pool');
const logger = require('../utils/logger');

const ANCHOR_ABI = [
    'function anchorBatch(string bUid, bytes32 merkleRoot, uint64 fromTs, uint64 toTs, uint32 leafCount) external returns (uint256)',
    'function anchorCount(string bUid) external view returns (uint256)',
    'function verify(string bUid, uint256 index, bytes32 leaf, bytes32[] proof) external view returns (bool)',
];

// ── Configuración ────────────────────────────────────────────────────────────

/** off | evidence | all — 'evidence' es el único valor recomendado en producción. */
const MODE = (process.env.CARGOLINK_BATCH_MODE || 'off').toLowerCase();
const INTERVAL_MS = parseInt(process.env.CARGOLINK_BATCH_INTERVAL_MS || '30000', 10);
/** Techo de hojas por lote. Un árbol muy grande encarece la prueba de inclusión
 *  (log2 n siblings) sin ahorrar gas adicional: el coste de anchorBatch es fijo. */
const MAX_LEAVES = parseInt(process.env.CARGOLINK_BATCH_MAX_LEAVES || '256', 10);

const EVIDENCE_STATUSES = new Set(['CUSTOMS_CLEARED', 'STOWED', 'DEPARTED', 'IN_TRANSIT']);
const SETTLEMENT_STATUSES = new Set(['CREATED', 'DELIVERED']);

function isEnabled() {
    return MODE === 'evidence' || MODE === 'all';
}

/**
 * ¿Este evento va al lote o se ancla ya?
 * En modo 'all' se agrupa todo — útil para medir el techo teórico, NO para
 * producción: rompe la garantía de escrow descrita arriba.
 */
function shouldBatch(toStatus) {
    if (!isEnabled()) return false;
    if (MODE === 'all') return true;
    return EVIDENCE_STATUSES.has(toStatus);
}

// ── Merkle (idéntico a cargoTelemetryAnchor.js) ──────────────────────────────

const sha256Buf = (buf) => crypto.createHash('sha256').update(buf).digest();
const hex = (buf) => `0x${buf.toString('hex')}`;
const unhex = (s) => Buffer.from(String(s).replace(/^0x/, ''), 'hex');

function hashPair(a, b) {
    return Buffer.compare(a, b) <= 0
        ? sha256Buf(Buffer.concat([a, b]))
        : sha256Buf(Buffer.concat([b, a]));
}

function merkleRoot(leaves) {
    if (leaves.length === 0) return null;
    let level = leaves.slice();
    while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = i + 1 < level.length ? level[i + 1] : level[i];
            next.push(hashPair(left, right));
        }
        level = next;
    }
    return level[0];
}

function merkleProof(leaves, index) {
    const proof = [];
    let level = leaves.slice();
    let i = index;
    while (level.length > 1) {
        const next = [];
        for (let j = 0; j < level.length; j += 2) {
            const left = level[j];
            const right = j + 1 < level.length ? level[j + 1] : level[j];
            next.push(hashPair(left, right));
        }
        const sibling = i % 2 === 0 ? Math.min(i + 1, level.length - 1) : i - 1;
        proof.push(level[sibling]);
        i = Math.floor(i / 2);
        level = next;
    }
    return proof;
}

function verifyProof(leaf, proof, root) {
    let acc = leaf;
    for (const sibling of proof) acc = hashPair(acc, sibling);
    return Buffer.compare(acc, root) === 0;
}

/**
 * Hoja canónica de un evento de ciclo de vida. Cualquiera con la fila puede
 * recomputarla: por eso el orden y el separador son parte del contrato.
 */
function leafFor({ bUid, toStatus, actor, payloadHash, occurredAt }) {
    const canonical = [
        bUid,
        toStatus,
        actor || '',
        payloadHash || '',
        new Date(occurredAt).toISOString(),
    ].join('|');
    return sha256Buf(Buffer.from(canonical, 'utf8'));
}

// ── Cadena ───────────────────────────────────────────────────────────────────

function getAnchorAddress() {
    if (process.env.TELEMETRY_ANCHOR_ADDRESS) return process.env.TELEMETRY_ANCHOR_ADDRESS;
    try {
        const chainId = process.env.BEZHAS_CHAIN_ID || process.env.CHAIN_ID || '2708';
        const file = path.resolve(__dirname, '../../smart-contracts/deployments', `${chainId}.json`);
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        // Las direcciones viven bajo sectors.supplychain; se acepta también la
        // forma plana por compatibilidad con despliegues antiguos.
        const sc = (data.sectors && data.sectors.supplychain) || data.supplychain || {};
        return sc.TelemetryAnchor || null;
    } catch {
        return null;
    }
}

/**
 * Signer COMPARTIDO con cargoLinkOnChain, no uno propio.
 *
 * Un NonceManager sólo serializa las transacciones que pasan por él. Al tener
 * el batcher el suyo, dos NonceManager distintos sobre la MISMA cuenta pedían
 * el mismo nonce y la segunda transacción moría con "nonce has already been
 * used" — medido: un lote de 30 eventos perdido justo así, mientras una
 * transición de estado anclaba en paralelo.
 *
 * El require es perezoso a propósito: cargoLinkOnChain requiere este módulo
 * arriba del todo, y hacerlo al revés en el nivel superior cerraría el ciclo.
 */
function getSigner() {
    try {
        const onChain = require('./cargoLinkOnChain');
        if (typeof onChain.getSigner === 'function') {
            const shared = onChain.getSigner();
            if (shared) return shared;
        }
    } catch { /* se cae al signer propio */ }

    const key = process.env.CARGOLINK_OPERATOR_KEY || process.env.OPERATOR_PRIVATE_KEY;
    const rpc = process.env.RPC_URL || process.env.BEZHAS_L2_RPC_URL;
    if (!key || !rpc) return null;
    const provider = new ethers.JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
    return new ethers.NonceManager(new ethers.Wallet(key, provider));
}

// ── Cola ─────────────────────────────────────────────────────────────────────

/**
 * Encola un evento para el próximo lote.
 * @returns {{batched: true, mode: 'queued', queueId: number, leaf: string}}
 */
async function enqueue({ bUid, toStatus, actor, payloadHash, occurredAt }) {
    const at = occurredAt || new Date();
    const leaf = leafFor({ bUid, toStatus, actor, payloadHash, occurredAt: at });
    const { rows } = await query(
        `INSERT INTO cargolink_event_queue (b_uid, to_status, actor, leaf, payload_hash, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [bUid, toStatus, actor || null, hex(leaf), payloadHash || null, at]
    );
    return { batched: true, mode: 'queued', queueId: rows[0].id, leaf: hex(leaf) };
}

async function pendingCount() {
    const { rows } = await query('SELECT COUNT(*)::int AS n FROM cargolink_event_queue WHERE batch_id IS NULL');
    return rows[0].n;
}

/**
 * Cierra un lote con los eventos pendientes y ancla su raíz.
 *
 * Se reclaman las filas ANTES de tocar la cadena: un evento que llegue a mitad
 * del anclaje debe empezar un lote nuevo, no colarse en uno cuya raíz ya está
 * calculada. Si el anclaje falla, el lote queda registrado con su modo de
 * fallo — las hojas no se devuelven a la cola porque la raíz ya las cubre y
 * reanclarlas duplicaría la evidencia.
 */
async function flush() {
    const { rows } = await query(
        `SELECT id, b_uid, to_status, actor, leaf, payload_hash, occurred_at
           FROM cargolink_event_queue
          WHERE batch_id IS NULL
          ORDER BY id ASC
          LIMIT $1`,
        [MAX_LEAVES]
    );
    if (rows.length === 0) return { flushed: 0, mode: 'empty' };

    const leaves = rows.map((r) => unhex(r.leaf));
    const root = merkleRoot(leaves);
    const fromTs = rows[0].occurred_at;
    const toTs = rows[rows.length - 1].occurred_at;
    const batchKey = `BZ-BATCH-${Date.now().toString(36).toUpperCase()}`;

    const { rows: batchRows } = await query(
        `INSERT INTO cargolink_event_batches
            (batch_key, merkle_root, leaf_count, from_ts, to_ts, anchor_mode)
         VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
        [batchKey, hex(root), rows.length, fromTs, toTs]
    );
    const batchId = batchRows[0].id;

    await query(
        'UPDATE cargolink_event_queue SET batch_id = $1 WHERE id = ANY($2::int[])',
        [batchId, rows.map((r) => r.id)]
    );

    const anchor = await anchorOnChain({ batchKey, root: hex(root), fromTs, toTs, leafCount: rows.length });

    await query(
        `UPDATE cargolink_event_batches
            SET tx_hash = $1, chain_id = $2, gas_used = $3, anchor_mode = $4, anchor_error = $5
          WHERE id = $6`,
        [anchor.txHash || null, anchor.chainId || null, anchor.gasUsed || null,
            anchor.anchored ? 'anchored' : (anchor.mode || 'anchor_failed'), anchor.error || null, batchId]
    );

    if (anchor.anchored) {
        logger.info(
            `[CARGOLINK][BATCH] ${rows.length} eventos en 1 tx | gas=${anchor.gasUsed} ` +
            `(${Math.round(anchor.gasUsed / rows.length)} gas/evento) root=${hex(root).slice(0, 18)} tx=${anchor.txHash}`
        );
    } else {
        logger.warn(`[CARGOLINK][BATCH] lote ${batchKey} sin anclar (${anchor.mode}): ${rows.length} eventos`);
    }

    return {
        flushed: rows.length, batchId, batchKey, root: hex(root),
        gasUsed: anchor.gasUsed || null, gasPerEvent: anchor.gasUsed ? Math.round(anchor.gasUsed / rows.length) : null,
        ...anchor,
    };
}

async function anchorOnChain({ batchKey, root, fromTs, toTs, leafCount }) {
    const address = getAnchorAddress();
    const signer = getSigner();
    if (!address || !signer) return { anchored: false, mode: 'not_configured' };
    try {
        const contract = new ethers.Contract(address, ANCHOR_ABI, signer);
        const tx = await contract.anchorBatch(
            batchKey, root,
            Math.floor(new Date(fromTs).getTime() / 1000),
            Math.floor(new Date(toTs).getTime() / 1000),
            leafCount
        );
        const receipt = await tx.wait();
        const network = await signer.provider.getNetwork();
        return {
            anchored: true, txHash: receipt.hash,
            chainId: Number(network.chainId), gasUsed: Number(receipt.gasUsed),
        };
    } catch (err) {
        return { anchored: false, mode: 'anchor_failed', error: err.message };
    }
}

/**
 * Prueba de inclusión de un evento concreto dentro de su lote.
 * Es la demostración que se le enseña a un auditor: no "confíe en la base de
 * datos", sino "aquí está la rama que reconstruye la raíz que está en cadena".
 */
async function proofFor(queueId) {
    const { rows } = await query(
        `SELECT q.id, q.leaf, q.batch_id, b.merkle_root, b.batch_key, b.tx_hash, b.leaf_count
           FROM cargolink_event_queue q
           JOIN cargolink_event_batches b ON b.id = q.batch_id
          WHERE q.id = $1`,
        [queueId]
    );
    if (rows.length === 0) return null;
    const target = rows[0];

    const { rows: siblings } = await query(
        'SELECT id, leaf FROM cargolink_event_queue WHERE batch_id = $1 ORDER BY id ASC',
        [target.batch_id]
    );
    const leaves = siblings.map((r) => unhex(r.leaf));
    const index = siblings.findIndex((r) => r.id === target.id);
    const proof = merkleProof(leaves, index);
    const root = unhex(target.merkle_root);

    return {
        queueId, batchKey: target.batch_key, index,
        leaf: target.leaf, root: target.merkle_root,
        leafCount: target.leaf_count, txHash: target.tx_hash,
        proof: proof.map(hex),
        verified: verifyProof(unhex(target.leaf), proof, root),
    };
}

// ── Temporizador ─────────────────────────────────────────────────────────────

let timer = null;

function start() {
    if (!isEnabled() || timer) return false;
    timer = setInterval(() => {
        flush().catch((err) => logger.warn(`[CARGOLINK][BATCH] flush falló: ${err.message}`));
    }, INTERVAL_MS);
    if (timer.unref) timer.unref();
    logger.info(`[CARGOLINK][BATCH] batching activo (modo=${MODE}, cada ${INTERVAL_MS}ms, máx ${MAX_LEAVES} hojas/lote)`);
    return true;
}

function stop() {
    if (timer) { clearInterval(timer); timer = null; }
}

module.exports = {
    isEnabled, shouldBatch, enqueue, flush, pendingCount, proofFor,
    start, stop, leafFor, merkleRoot, merkleProof, verifyProof,
    MODE, EVIDENCE_STATUSES, SETTLEMENT_STATUSES,
};
