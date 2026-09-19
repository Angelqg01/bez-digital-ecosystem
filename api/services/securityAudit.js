'use strict';

/**
 * securityAudit — registro de auditoría append-only de la capa transaccional,
 * encadenado por hash y anclable en cadena.
 *
 * Mismo principio que el AuditLog de OPERANT y su ancla: cada registro lleva el
 * hash del anterior, así que reescribir uno rompe todos los que vienen después;
 * y la raíz merkle de cada tramo se ancla en TelemetryAnchor, fuera del alcance
 * de quien podría querer reescribirla. Además la tabla tiene un trigger que
 * rechaza UPDATE y DELETE (migración 058): la aplicación no puede editar el
 * pasado ni por error.
 *
 * Qué se registra: quién pidió, qué pidió, qué decidió la política, qué riesgo
 * salió, quién aprobó, qué se firmó y qué llegó a la red (§24). Qué NO: claves,
 * secretos, tokens. `redactar()` los quita aunque alguien los pase por descuido.
 *
 * Concurrencia sin transacción: el `seq` es UNIQUE. Dos escrituras que leen el
 * mismo último registro chocan en la inserción y la perdedora reintenta con el
 * nuevo último. Sirve con el `query` simple del pool, que es lo que hay.
 */

const { query } = require('../db/pool');
const { stableStringify, sha256Hex } = require('./txCanonical');
const logger = require('../utils/logger');

const GENESIS = `0x${'0'.repeat(64)}`;
const RE_SENSIBLE = /(private.?key|secret|password|passphrase|mnemonic|seed|api.?key|authorization|access.?token|refresh.?token)/i;
const MAX_REINTENTOS = 6;

function redactar(valor, profundidad = 0) {
    if (profundidad > 8) return '[profundo]';
    if (Array.isArray(valor)) return valor.map((v) => redactar(v, profundidad + 1));
    if (valor && typeof valor === 'object') {
        return Object.fromEntries(Object.entries(valor).map(([k, v]) =>
            [k, RE_SENSIBLE.test(k) ? '[redactado]' : redactar(v, profundidad + 1)]));
    }
    return typeof valor === 'bigint' ? valor.toString() : valor;
}

function hashRegistro(r) {
    return sha256Hex(stableStringify({
        seq: String(r.seq),
        prevHash: r.prevHash,
        occurredAt: r.occurredAt,
        appId: r.appId ?? null,
        agentId: r.agentId ?? null,
        actor: r.actor ?? null,
        eventType: r.eventType,
        intentId: r.intentId ?? null,
        payload: r.payload ?? null,
    }));
}

/**
 * Añade un evento. No lanza: una auditoría que tumba la operación que audita
 * sería un fallo de disponibilidad. Si no se puede escribir, se registra en el
 * log con nivel error para que la alerta salte.
 */
async function registrar({ eventType, appId = null, agentId = null, actor = null, intentId = null, payload = null }) {
    const limpio = redactar(payload);
    for (let intento = 0; intento < MAX_REINTENTOS; intento += 1) {
        try {
            const { rows } = await query('SELECT seq, hash FROM security_audit_log ORDER BY seq DESC LIMIT 1');
            const seq = rows.length ? BigInt(rows[0].seq) + 1n : 1n;
            const registro = {
                seq,
                prevHash: rows.length ? rows[0].hash : GENESIS,
                occurredAt: new Date().toISOString(),
                appId: appId === null ? null : String(appId),
                agentId, actor, eventType, intentId, payload: limpio,
            };
            const hash = hashRegistro(registro);
            await query(
                `INSERT INTO security_audit_log
                   (seq, prev_hash, hash, occurred_at, app_id, agent_id, actor, event_type, intent_id, payload)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [seq.toString(), registro.prevHash, hash, registro.occurredAt, registro.appId, agentId, actor,
                    eventType, intentId, limpio === null ? null : JSON.stringify(limpio)]
            );
            return { seq: seq.toString(), hash };
        } catch (err) {
            if (err.code === '23505') continue; // otro escritor ganó el seq: reintentar
            logger.error({ eventType, intentId, error: err.message }, 'AUDITORÍA DE SEGURIDAD NO ESCRITA');
            return null;
        }
    }
    logger.error({ eventType, intentId }, 'AUDITORÍA DE SEGURIDAD NO ESCRITA: contención persistente');
    return null;
}

/**
 * Recalcula la cadena. Filas en orden de seq, como las devuelve la base.
 * @returns {{ok:true, n:number} | {ok:false, rotoEn:string, motivo:string}}
 */
function verificarCadena(filas) {
    let previo = null;
    for (const f of filas) {
        const registro = {
            seq: f.seq,
            prevHash: f.prev_hash,
            occurredAt: new Date(f.occurred_at).toISOString(),
            appId: f.app_id, agentId: f.agent_id, actor: f.actor,
            eventType: f.event_type, intentId: f.intent_id,
            payload: typeof f.payload === 'string' ? JSON.parse(f.payload) : f.payload,
        };
        if (previo && registro.prevHash !== previo.hash) {
            return { ok: false, rotoEn: String(f.seq), motivo: 'prev_hash no casa con el registro anterior' };
        }
        if (hashRegistro(registro) !== f.hash) {
            return { ok: false, rotoEn: String(f.seq), motivo: 'el contenido no casa con su hash' };
        }
        previo = f;
    }
    return { ok: true, n: filas.length };
}

/**
 * Cierra el tramo pendiente en una raíz merkle y la ancla. Reutiliza el esquema
 * de operantAnchor (sha256, pares ordenados) para que TelemetryAnchor.verify()
 * valide las pruebas de inclusión sin tocar Solidity.
 */
async function anclarPendiente({ limite = 5000 } = {}) {
    const { merkleRoot, toLeaf, getAnchorAddress } = require('./operantAnchor');
    const { rows: previa } = await query('SELECT last_seq FROM security_audit_anchors ORDER BY id DESC LIMIT 1');
    const desde = previa.length ? previa[0].last_seq : 0;
    const { rows } = await query(
        'SELECT seq, hash, occurred_at FROM security_audit_log WHERE seq > $1 ORDER BY seq ASC LIMIT $2',
        [desde, limite]
    );
    if (!rows.length) return { hojas: 0, anclado: false };

    const raiz = `0x${merkleRoot(rows.map((r) => toLeaf(r.hash))).toString('hex')}`;
    const { rows: ins } = await query(
        `INSERT INTO security_audit_anchors (merkle_root, first_seq, last_seq, leaf_count, period_start, period_end)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [raiz, rows[0].seq, rows[rows.length - 1].seq, rows.length, rows[0].occurred_at, rows[rows.length - 1].occurred_at]
    );

    // El anclaje on-chain es opcional y no mueve fondos: la clave sólo paga gas.
    const clave = process.env.SECURITY_ANCHOR_OPERATOR_KEY;
    const rpc = process.env.RPC_URL || process.env.BEZHAS_L2_RPC_URL;
    const direccion = getAnchorAddress();
    if (!clave || !rpc || !direccion) return { hojas: rows.length, raiz, anclado: false, modo: 'not_configured' };
    try {
        const { ethers } = require('ethers');
        const firmante = new ethers.Wallet(clave, new ethers.JsonRpcProvider(rpc));
        const contrato = new ethers.Contract(direccion, [
            'function anchorBatch(string bUid, bytes32 merkleRoot, uint64 fromTs, uint64 toTs, uint32 leafCount) external returns (uint256)',
        ], firmante);
        const tx = await contrato.anchorBatch('security:bezhas', raiz,
            Math.floor(new Date(rows[0].occurred_at).getTime() / 1000),
            Math.floor(new Date(rows[rows.length - 1].occurred_at).getTime() / 1000),
            rows.length);
        const recibo = await tx.wait();
        await query('UPDATE security_audit_anchors SET tx_hash = $1 WHERE id = $2', [recibo.hash, ins[0].id]);
        return { hojas: rows.length, raiz, anclado: true, txHash: recibo.hash };
    } catch (err) {
        logger.error({ error: err.message }, 'anclaje de auditoría de seguridad fallido; se reintenta en el siguiente tramo');
        return { hojas: rows.length, raiz, anclado: false, modo: 'anchor_failed' };
    }
}

module.exports = { registrar, verificarCadena, anclarPendiente, redactar, hashRegistro, GENESIS };
