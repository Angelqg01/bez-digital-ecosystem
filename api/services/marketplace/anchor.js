'use strict';

/**
 * Anclaje de los recibos del marketplace (paso 4, docs/API_MARKETPLACE_DISENO.md).
 *
 *   1. cerrarLotes(): por cada listing con llamadas sin lote, toma hasta
 *      MAX_LEAVES en orden (at, id), calcula la raíz y las marca con el lote en
 *      UNA transacción (FOR UPDATE SKIP LOCKED: dos pasadas a la vez no meten la
 *      misma llamada en dos lotes).
 *   2. anclarPendientes(): cada lote sin ancla confirmada se ancla en cada red
 *      configurada con TelemetryAnchor.anchorBatch(`mkt:<listingId>`, raíz, …).
 *   3. pruebaDe(callId): prueba de inclusión del recibo, recalculada desde la
 *      base y comprobada contra la raíz guardada antes de devolverla.
 *
 * Hoja = sha256 del recibo canónico (receipts.contenidoRecibo): lo que se ancla
 * es el recibo entero que ve el consumidor, no sólo el id de la llamada.
 *
 * Redes (cada una se activa sola si tiene RPC, dirección y clave):
 *   polygon (137) POLYGON_RPC_URL   + MARKETPLACE_ANCHOR_POLYGON_ADDRESS
 *   l2     (2708) BEZHAS_L2_RPC_URL + MARKETPLACE_ANCHOR_L2_ADDRESS
 * Sin dirección explícita se lee `supplychain.TelemetryAnchor` de
 * smart-contracts/deployments/<chainId>.json. Clave: MARKETPLACE_ANCHOR_KEY
 * (o OPERATOR_PRIVATE_KEY), una hot wallet con OPERATOR_ROLE en el contrato y
 * sólo el POL justo para gas: nunca la Hot Wallet de pagos ni la del tesoro.
 *
 * Esquema merkle: el de operantAnchor (sha256, pares ordenados), que es el que
 * verifica TelemetryAnchor.verify() on-chain sin tocar Solidity.
 */

const fs = require('fs');
const path = require('path');
const { query, getClient } = require('../../db/pool');
const { merkleRoot, merkleProof } = require('../operantAnchor');
const receipts = require('./receipts');
const logger = require('pino')({ level: 'info', name: 'marketplace-anchor' });

let ethers = null;
try { ethers = require('ethers'); } catch { /* sin ethers: sólo lotes off-chain */ }

const MAX_LEAVES = 2048;   // acota la prueba (11 hermanos) y lo que se relee por recibo
const MAX_LOTES_POR_PASADA = 50;
const ABI = [
    'function anchorBatch(string bUid, bytes32 merkleRoot, uint64 fromTs, uint64 toTs, uint32 leafCount) external returns (uint256)',
    'event BatchAnchored(bytes32 indexed bUidHash, string bUid, uint256 indexed index, bytes32 merkleRoot, uint32 leafCount, uint64 fromTs, uint64 toTs)',
];

const REDES = {
    polygon: {
        chainId: 137,
        rpc: () => process.env.POLYGON_RPC_URL,
        direccion: () => process.env.MARKETPLACE_ANCHOR_POLYGON_ADDRESS || direccionDesplegada(137),
        explorador: (tx) => `https://polygonscan.com/tx/${tx}`,
    },
    l2: {
        chainId: 2708,
        rpc: () => process.env.BEZHAS_L2_RPC_URL,
        direccion: () => process.env.MARKETPLACE_ANCHOR_L2_ADDRESS || direccionDesplegada(2708),
        explorador: () => null,
    },
};

const anchorKey = (listingId) => `mkt:${listingId}`;
const hex = (buf) => `0x${buf.toString('hex')}`;
const hojaDe = (fila) => Buffer.from(receipts.sha256(JSON.stringify(receipts.contenidoRecibo(fila))), 'hex');

function direccionDesplegada(chainId) {
    try {
        const d = JSON.parse(fs.readFileSync(
            path.resolve(__dirname, '../../../smart-contracts/deployments', `${chainId}.json`), 'utf8'));
        return d?.supplychain?.TelemetryAnchor || null;
    } catch {
        return null;
    }
}

// Inyectable en tests: (red, direccion) → { anchorBatch, provider, interface }.
let fabricaContrato = (red, direccion) => {
    const clave = process.env.MARKETPLACE_ANCHOR_KEY || process.env.OPERATOR_PRIVATE_KEY;
    const rpc = REDES[red].rpc();
    if (!ethers || !clave || !rpc) return null;
    const signer = new ethers.Wallet(clave, new ethers.JsonRpcProvider(rpc));
    return new ethers.Contract(direccion, ABI, signer);
};

/** Redes listas para anclar ahora mismo: [{ red, chainId, direccion }]. */
function redesActivas() {
    return Object.entries(REDES)
        .map(([red, cfg]) => ({ red, chainId: cfg.chainId, direccion: cfg.direccion(), rpc: cfg.rpc() }))
        .filter((r) => r.direccion && /^0x[0-9a-fA-F]{40}$/.test(r.direccion) && r.rpc)
        .map(({ red, chainId, direccion }) => ({ red, chainId, direccion }));
}

const COLS_RECIBO = `c.id, c.listing_id, c.consumer_app_id, c.at, c.http_status, c.req_hash, c.resp_hash,
    c.amount_cents, c.fee_cents, l.slug, l.pricing->>'currency' AS currency`;

// ── 1. Lotes ────────────────────────────────────────────────────────────────

async function cerrarLoteDe(listingId) {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT ${COLS_RECIBO}
             FROM marketplace_calls c JOIN marketplace_listings l ON l.id = c.listing_id
             WHERE c.listing_id = $1 AND c.batch_id IS NULL
             ORDER BY c.at, c.id
             LIMIT $2
             FOR UPDATE OF c SKIP LOCKED`,
            [listingId, MAX_LEAVES],
        );
        if (!rows.length) {
            await client.query('ROLLBACK');
            return null;
        }
        const raiz = hex(merkleRoot(rows.map(hojaDe)));
        const { rows: lote } = await client.query(
            `INSERT INTO marketplace_receipt_batches (listing_id, merkle_root, anchor_key, leaf_count, from_ts, to_ts)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, listing_id, merkle_root, anchor_key, leaf_count, from_ts, to_ts`,
            [listingId, raiz, anchorKey(listingId), rows.length, rows[0].at, rows[rows.length - 1].at],
        );
        await client.query(
            'UPDATE marketplace_calls SET batch_id = $1 WHERE id = ANY($2::uuid[]) AND batch_id IS NULL',
            [lote[0].id, rows.map((r) => r.id)],
        );
        await client.query('COMMIT');
        return lote[0];
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

async function cerrarLotes() {
    const { rows } = await query(
        `SELECT DISTINCT listing_id FROM marketplace_calls WHERE batch_id IS NULL LIMIT $1`,
        [MAX_LOTES_POR_PASADA],
    );
    const lotes = [];
    for (const { listing_id: listingId } of rows) {
        const lote = await cerrarLoteDe(listingId);
        if (lote) lotes.push(lote);
    }
    return lotes;
}

// ── 2. Anclaje ──────────────────────────────────────────────────────────────

function indiceDelEvento(contrato, recibo) {
    for (const log of recibo.logs || []) {
        try {
            const ev = contrato.interface.parseLog(log);
            if (ev?.name === 'BatchAnchored') return Number(ev.args.index);
        } catch { /* log de otro contrato */ }
    }
    return null;
}

async function anclarEn(lote, red) {
    const contrato = fabricaContrato(red.red, red.direccion);
    if (!contrato) return { red: red.red, status: 'not_configured' };

    const { rows } = await query(
        `INSERT INTO marketplace_batch_anchors (batch_id, network, chain_id, contract_address)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (batch_id, network) DO UPDATE SET updated_at = NOW()
         RETURNING status, tx_hash, attempts`,
        [lote.id, red.red, red.chainId, red.direccion],
    );
    const actual = rows[0];
    if (actual.status === 'confirmed') return { red: red.red, status: 'confirmed', txHash: actual.tx_hash };

    try {
        const cadena = await contrato.runner.provider.getNetwork();
        if (Number(cadena.chainId) !== red.chainId) {
            throw new Error(`El RPC de ${red.red} es la cadena ${cadena.chainId}, no la ${red.chainId}`);
        }

        let recibo;
        if (actual.status === 'sent' && actual.tx_hash) {
            // Ya se envió: se consulta, no se reenvía (sería pagar gas dos veces).
            recibo = await contrato.runner.provider.getTransactionReceipt(actual.tx_hash);
            if (!recibo) return { red: red.red, status: 'sent', txHash: actual.tx_hash };
        } else {
            const tx = await contrato.anchorBatch(
                lote.anchor_key, lote.merkle_root,
                Math.floor(new Date(lote.from_ts).getTime() / 1000),
                Math.floor(new Date(lote.to_ts).getTime() / 1000),
                lote.leaf_count,
            );
            await query(
                `UPDATE marketplace_batch_anchors SET status = 'sent', tx_hash = $3, attempts = attempts + 1,
                        last_error = NULL, updated_at = NOW()
                 WHERE batch_id = $1 AND network = $2`,
                [lote.id, red.red, tx.hash],
            );
            recibo = await tx.wait();
        }
        if (Number(recibo.status) !== 1) throw new Error('La transacción de anclaje revirtió');

        const indice = indiceDelEvento(contrato, recibo);
        await query(
            `UPDATE marketplace_batch_anchors
             SET status = 'confirmed', tx_hash = $3, block_number = $4, anchor_index = $5,
                 anchored_at = NOW(), updated_at = NOW(), last_error = NULL
             WHERE batch_id = $1 AND network = $2`,
            [lote.id, red.red, recibo.hash, Number(recibo.blockNumber), indice],
        );
        return { red: red.red, status: 'confirmed', txHash: recibo.hash, anchorIndex: indice };
    } catch (err) {
        logger.error({ batchId: lote.id, red: red.red, err: err.message }, 'marketplace: anclaje fallido');
        // 'sent' se conserva: la tx puede confirmarse aunque wait() haya fallado.
        await query(
            `UPDATE marketplace_batch_anchors
             SET status = CASE WHEN status = 'sent' THEN 'sent' ELSE 'failed' END,
                 attempts = attempts + CASE WHEN status = 'sent' THEN 0 ELSE 1 END,
                 last_error = $3, updated_at = NOW()
             WHERE batch_id = $1 AND network = $2`,
            [lote.id, red.red, String(err.message).slice(0, 500)],
        ).catch(() => {});
        return { red: red.red, status: 'failed', error: err.message };
    }
}

async function anclarPendientes() {
    const redes = redesActivas();
    if (!redes.length) return { redes: [], anclas: [] };
    // Lotes a los que les falta el ancla confirmada en alguna red activa.
    const { rows: lotes } = await query(
        `SELECT b.id, b.listing_id, b.merkle_root, b.anchor_key, b.leaf_count, b.from_ts, b.to_ts
         FROM marketplace_receipt_batches b
         WHERE EXISTS (
             SELECT 1 FROM unnest($1::text[]) AS r(network)
             WHERE NOT EXISTS (
                 SELECT 1 FROM marketplace_batch_anchors a
                 WHERE a.batch_id = b.id AND a.network = r.network AND a.status = 'confirmed'))
         ORDER BY b.created_at
         LIMIT $2`,
        [redes.map((r) => r.red), MAX_LOTES_POR_PASADA],
    );
    const anclas = [];
    for (const lote of lotes) {
        for (const red of redes) anclas.push({ batchId: lote.id, ...(await anclarEn(lote, red)) });
    }
    return { redes: redes.map((r) => r.red), anclas };
}

/** Una pasada completa: cerrar lotes y anclar lo pendiente. Para el admin o un job. */
async function ejecutar() {
    const lotes = await cerrarLotes();
    const anclaje = await anclarPendientes();
    return { lotesNuevos: lotes.length, ...anclaje };
}

// ── 3. Prueba de inclusión ──────────────────────────────────────────────────

/**
 * Prueba del recibo `callId` dentro de su lote. Recalcula las hojas desde la
 * base: si alguien hubiera tocado una fila de marketplace_calls después de
 * cerrar el lote, la raíz ya no cuadra y se dice, en vez de dar una prueba falsa.
 */
async function pruebaDe(batchId, callId) {
    const [{ rows: lote }, { rows: filas }, { rows: anclas }] = await Promise.all([
        query('SELECT id, merkle_root, anchor_key, leaf_count FROM marketplace_receipt_batches WHERE id = $1', [batchId]),
        query(
            `SELECT ${COLS_RECIBO}
             FROM marketplace_calls c JOIN marketplace_listings l ON l.id = c.listing_id
             WHERE c.batch_id = $1 ORDER BY c.at, c.id`,
            [batchId],
        ),
        query(
            `SELECT network, chain_id, contract_address, status, tx_hash, block_number, anchor_index, anchored_at
             FROM marketplace_batch_anchors WHERE batch_id = $1`,
            [batchId],
        ),
    ]);
    if (!lote[0]) return null;
    const hojas = filas.map(hojaDe);
    const indice = filas.findIndex((f) => f.id === callId);
    const recalculada = hojas.length ? hex(merkleRoot(hojas)) : null;
    const intacto = indice !== -1 && recalculada === lote[0].merkle_root;

    const porRed = {};
    for (const red of Object.keys(REDES)) {
        const a = anclas.find((x) => x.network === red);
        porRed[red] = a
            ? {
                status: a.status,
                chainId: a.chain_id,
                contract: a.contract_address,
                txHash: a.tx_hash,
                blockNumber: a.block_number === null ? null : Number(a.block_number),
                anchorIndex: a.anchor_index === null ? null : Number(a.anchor_index),
                explorer: a.tx_hash ? REDES[red].explorador(a.tx_hash) : null,
                anchoredAt: a.anchored_at,
            }
            : null;
    }
    return {
        batchId: lote[0].id,
        anchorKey: lote[0].anchor_key,
        merkleRoot: lote[0].merkle_root,
        valid: intacto,
        ...(intacto
            ? { leafIndex: indice, leaf: hex(hojas[indice]), proof: merkleProof(hojas, indice).map(hex) }
            : { reason: 'La raíz recalculada no coincide con la del lote: el registro se ha alterado.' }),
        networks: porRed,
        verifyOnChain: 'TelemetryAnchor.verify(anchorKey, anchorIndex, leaf, proof)',
    };
}

module.exports = {
    anchorKey, hojaDe, redesActivas, cerrarLotes, cerrarLoteDe, anclarPendientes, ejecutar, pruebaDe,
    REDES, MAX_LEAVES,
    _setFabricaContrato: (f) => { fabricaContrato = f; },
};
