/**
 * operantAnchor — ancla en la cadena la auditoría de los agentes de OPERANT.
 *
 * ── Qué problema resuelve ───────────────────────────────────────────────────
 * OPERANT ya encadena por hash cada decisión de sus agentes (AuditLog: cada
 * registro incluye el hash del anterior). Eso hace DETECTABLE una alteración,
 * pero solo para quien tenga la cadena entera... que es el propio proveedor.
 * Ante una due diligence, un regulador o un cliente, "mi log dice que no lo he
 * tocado" no prueba nada.
 *
 * Anclar la raíz merkle del tramo en BeZhas L2 cierra el círculo: la prueba
 * pasa a estar fuera del alcance de quien podría querer reescribirla, con
 * fecha, y cualquier registro suelto se puede demostrar contra ella con una
 * prueba de inclusión.
 *
 * ── Por qué se recalcula la raíz aquí ───────────────────────────────────────
 * OPERANT devuelve las HOJAS (los hashes de sus registros), no la raíz. Si
 * BeZhas anclara la raíz que le dan, estaría notarizando un número que no ha
 * comprobado: el ancla sería tan fiable como el servicio auditado. Recalcular
 * la raíz sobre las hojas cuesta microsegundos y convierte el ancla en una
 * afirmación propia.
 *
 * ── Contrato ────────────────────────────────────────────────────────────────
 * Reutiliza `TelemetryAnchor.sol` (supplychain), que ya está desplegado y es
 * genérico: indexa por una cadena arbitraria. La clave aquí es
 * `operant:<tenantId>`. El esquema merkle es sha256 con pares ORDENADOS, igual
 * que `cargoTelemetryAnchor.js`, para que `TelemetryAnchor.verify()` on-chain
 * valide las pruebas de inclusión sin ningún cambio en Solidity.
 *
 * Sin RPC/contrato/clave configurados el ancla se guarda igualmente en base de
 * datos con `tx_hash` nulo: el lote no se pierde y se reintenta. Es preferible
 * a no calcular nada — la raíz es la parte que no se puede reconstruir después
 * si la cadena de auditoría crece.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { query } = require('../db/pool');
const operant = require('./operantBridge');
const logger = require('pino')({ level: 'info', name: 'operant-anchor' });

let ethers = null;
try { ethers = require('ethers'); } catch { /* opcional: sin ethers, solo off-chain */ }

const ANCHOR_ABI = [
    'function anchorBatch(string bUid, bytes32 merkleRoot, uint64 fromTs, uint64 toTs, uint32 leafCount) external returns (uint256)',
    'function anchorCount(string bUid) external view returns (uint256)',
    'function verify(string bUid, uint256 index, bytes32 leaf, bytes32[] proof) external view returns (bool)',
];

const sha256Buf = (buf) => crypto.createHash('sha256').update(buf).digest();
const hex = (buf) => '0x' + buf.toString('hex');

/** Clave on-chain del tenant. Prefijada para no colisionar con B-UIDs de CargoLink. */
const anchorKey = (tenantId) => `operant:${tenantId}`;

/** Par ordenado: el orden de los hermanos no puede cambiar el resultado. */
function hashPair(a, b) {
    return Buffer.compare(a, b) <= 0
        ? sha256Buf(Buffer.concat([a, b]))
        : sha256Buf(Buffer.concat([b, a]));
}

/** Raíz merkle sha256 con pares ordenados (espejo de TelemetryAnchor.verify). */
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

/** Prueba de inclusión de la hoja `index` (hermanos, de abajo arriba). */
function merkleProof(leaves, index) {
    const proof = [];
    let level = leaves.slice();
    let idx = index;
    while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = i + 1 < level.length ? level[i + 1] : level[i];
            if (i === idx || i + 1 === idx) {
                proof.push(i === idx ? right : left);
                idx = next.length;
            }
            next.push(hashPair(left, right));
        }
        level = next;
    }
    return proof;
}

/** Hoja = el propio hash del registro de auditoría (hex de 64 chars) → Buffer. */
function toLeaf(auditHash) {
    const clean = String(auditHash).replace(/^0x/, '');
    if (!/^[0-9a-f]{64}$/i.test(clean)) {
        const err = new Error(`Hash de auditoría inválido: ${auditHash}`);
        err.code = 'BAD_AUDIT_HASH';
        throw err;
    }
    return Buffer.from(clean, 'hex');
}

// ── On-chain ────────────────────────────────────────────────────────────────

function getAnchorAddress() {
    if (process.env.TELEMETRY_ANCHOR_ADDRESS) return process.env.TELEMETRY_ANCHOR_ADDRESS;
    try {
        const chainId = process.env.BEZHAS_CHAIN_ID || process.env.CHAIN_ID || '2708';
        const data = JSON.parse(fs.readFileSync(
            path.resolve(__dirname, '../../smart-contracts/deployments', `${chainId}.json`), 'utf8'
        ));
        return (data.supplychain && data.supplychain.TelemetryAnchor) || null;
    } catch {
        return null;
    }
}

function getSigner() {
    if (!ethers) return null;
    const key = process.env.OPERANT_OPERATOR_KEY || process.env.OPERATOR_PRIVATE_KEY;
    const rpc = process.env.RPC_URL || process.env.BEZHAS_L2_RPC_URL;
    if (!key || !rpc) return null;
    return new ethers.Wallet(key, new ethers.JsonRpcProvider(rpc));
}

async function anchorOnChain({ tenantId, root, fromTs, toTs, leafCount }) {
    const address = getAnchorAddress();
    const signer = getSigner();
    if (!address || !signer) return { anchored: false, mode: 'not_configured' };
    try {
        const contract = new ethers.Contract(address, ANCHOR_ABI, signer);
        const tx = await contract.anchorBatch(
            anchorKey(tenantId), root,
            Math.floor(new Date(fromTs).getTime() / 1000),
            Math.floor(new Date(toTs).getTime() / 1000),
            leafCount
        );
        const receipt = await tx.wait();
        const network = await signer.provider.getNetwork();
        return {
            anchored: true,
            txHash: receipt.hash,
            chainId: Number(network.chainId),
            blockNumber: Number(receipt.blockNumber),
        };
    } catch (err) {
        // No se propaga: el ancla off-chain ya está guardada y se reintenta.
        logger.error({ tenantId, error: err.message }, 'Anclaje on-chain fallido');
        return { anchored: false, mode: 'anchor_failed', error: err.message };
    }
}

// ── API ─────────────────────────────────────────────────────────────────────

/**
 * Ancla el tramo de auditoría pendiente de un tenant.
 * @returns {{merkleRoot:string, leafCount:number, anchored:boolean, txHash?:string}}
 *          o `{ leafCount: 0 }` si no había nada nuevo que anclar.
 */
async function anchorTenant({ appId, tenantId }) {
    // Desde dónde: el último tramo anclado marca el corte.
    const { rows: prev } = await query(
        `SELECT last_hash, period_end FROM operant_audit_anchors
          WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1`,
        [tenantId]
    );
    const since = prev[0]?.period_end || null;

    const batch = await operant.auditBatch({ tenantId, since });
    const hashes = Array.isArray(batch.leaves) ? batch.leaves : [];
    if (hashes.length === 0) {
        return { tenantId, leafCount: 0, anchored: false, reason: 'sin registros nuevos' };
    }

    // Recalculado aquí a propósito (ver cabecera): la raíz es afirmación de BeZhas.
    const leaves = hashes.map(toLeaf);
    const root = merkleRoot(leaves);
    const rootHex = hex(root);

    const periodStart = batch.from || since || new Date().toISOString();
    const periodEnd = batch.to || new Date().toISOString();

    // Se persiste ANTES de tocar la cadena: si la tx falla, el tramo ya está
    // cerrado y el reintento no recalcula una raíz distinta sobre otras hojas.
    const { rows } = await query(
        `INSERT INTO operant_audit_anchors
           (app_id, tenant_id, merkle_root, leaf_count, first_hash, last_hash, period_start, period_end)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (tenant_id, merkle_root) DO UPDATE SET leaf_count = EXCLUDED.leaf_count
         RETURNING id`,
        [appId, tenantId, rootHex, leaves.length,
         hashes[0].replace(/^0x/, ''), hashes[hashes.length - 1].replace(/^0x/, ''),
         periodStart, periodEnd]
    );
    const anchorId = rows[0].id;

    const chain = await anchorOnChain({
        tenantId, root: rootHex, fromTs: periodStart, toTs: periodEnd, leafCount: leaves.length,
    });

    if (chain.anchored) {
        await query(
            `UPDATE operant_audit_anchors
                SET tx_hash = $1, chain_id = $2, block_number = $3, anchored_at = NOW()
              WHERE id = $4`,
            [chain.txHash, chain.chainId, chain.blockNumber, anchorId]
        );
        // Que OPERANT sepa hasta dónde está notarizado (mejor esfuerzo: si falla,
        // el ancla sigue siendo válida; solo se pierde el eco en su panel).
        operant.auditMarkAnchored({
            tenantId, merkleRoot: rootHex, txHash: chain.txHash,
            chainId: chain.chainId, blockNumber: chain.blockNumber,
        }).catch((e) => logger.warn({ tenantId, error: e.message }, 'No se pudo notificar el ancla a OPERANT'));
    }

    return {
        tenantId,
        anchorId,
        merkleRoot: rootHex,
        leafCount: leaves.length,
        periodStart,
        periodEnd,
        anchored: chain.anchored,
        txHash: chain.txHash || null,
        chainId: chain.chainId || null,
        mode: chain.mode,
    };
}

/**
 * Prueba de inclusión de un registro concreto contra su ancla.
 * Devuelve la prueba lista para `TelemetryAnchor.verify()` on-chain.
 */
async function proveRecord({ tenantId, auditHash }) {
    const { rows } = await query(
        `SELECT id, merkle_root, leaf_count, period_start, period_end, tx_hash, chain_id
           FROM operant_audit_anchors WHERE tenant_id = $1 ORDER BY id ASC`,
        [tenantId]
    );
    if (rows.length === 0) {
        const err = new Error('Este tenant no tiene ningún tramo anclado todavía');
        err.status = 404;
        throw err;
    }

    // Se rehidrata el tramo desde OPERANT y se comprueba que la raíz coincide:
    // si el proveedor hubiera alterado un registro, la raíz recalculada ya no
    // cuadraría con la anclada y la prueba falla — que es exactamente lo que
    // debe pasar.
    for (const anchor of rows) {
        const batch = await operant.auditBatch({ tenantId, since: anchor.period_start, until: anchor.period_end });
        const hashes = (batch.leaves || []).map((h) => String(h).replace(/^0x/, '').toLowerCase());
        const index = hashes.indexOf(String(auditHash).replace(/^0x/, '').toLowerCase());
        if (index === -1) continue;

        const leaves = hashes.map(toLeaf);
        const recomputed = hex(merkleRoot(leaves));
        if (recomputed !== anchor.merkle_root) {
            return {
                found: true, valid: false,
                reason: 'La raíz recalculada no coincide con la anclada: la auditoría ha sido alterada',
                anchoredRoot: anchor.merkle_root, recomputedRoot: recomputed,
                txHash: anchor.tx_hash,
            };
        }

        return {
            found: true, valid: true,
            anchorKey: anchorKey(tenantId),
            merkleRoot: anchor.merkle_root,
            leafIndex: index,
            leaf: '0x' + hashes[index],
            proof: merkleProof(leaves, index).map(hex),
            txHash: anchor.tx_hash,
            chainId: anchor.chain_id,
            verifyOnChain: anchor.tx_hash
                ? 'TelemetryAnchor.verify(anchorKey, anchorIndex, leaf, proof)'
                : 'Tramo aún no confirmado on-chain',
        };
    }

    return { found: false, valid: false, reason: 'El registro no pertenece a ningún tramo anclado' };
}

module.exports = {
    anchorKey,
    merkleRoot,
    merkleProof,
    toLeaf,
    anchorTenant,
    proveRecord,
    getAnchorAddress,
};
