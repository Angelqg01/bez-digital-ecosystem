'use strict';

/**
 * txApproval — aprobaciones humanas como firmas EIP-712.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ UNA FIRMA Y NO UN BOTÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un «aprobado» guardado en la base es una afirmación de la base. Si alguien
 * compromete la API, escribe la fila y el pago sale. Una firma EIP-712 del
 * aprobador, con su wallet, es una prueba: el firmante aislado (tx-signer) la
 * verifica contra SU PROPIA lista de aprobadores, que la API no puede editar.
 *
 * El mensaje incluye, en claro, el activo, el importe, el destino y la red.
 * Así la wallet del aprobador le enseña QUÉ aprueba —no un hash opaco— y firmar
 * a ciegas deja de ser la opción por defecto. Y ata el intentHash y el
 * policyHash: si cualquiera de los dos cambia después, la firma no vale.
 *
 * El dominio no lleva chainId a propósito: una aprobación de un pago FIAT no
 * tiene red, y las wallets obligan a estar conectado a la red del dominio para
 * firmar. La protección contra reutilización la da el intentHash, que es único
 * por intención (lleva nonce y caducidad).
 *
 * La definición de tipos está duplicada en tx-signer/src/eip712.js. Un test
 * comprueba que ambas producen el mismo digest.
 */

const { ethers } = require('ethers');
const { query } = require('../db/pool');

const DOMINIO = Object.freeze({ name: 'BeZhas Transaction Approval', version: '1' });

const TIPOS_APROBACION = Object.freeze({
    TransactionApproval: [
        { name: 'intentId', type: 'string' },
        { name: 'intentHash', type: 'bytes32' },
        { name: 'policyHash', type: 'bytes32' },
        { name: 'rail', type: 'string' },
        { name: 'asset', type: 'string' },
        { name: 'amount', type: 'string' },
        { name: 'destination', type: 'string' },
        { name: 'beneficiary', type: 'string' },
        { name: 'network', type: 'string' },
        { name: 'decision', type: 'string' },
        { name: 'expiresAt', type: 'uint64' },
    ],
});

const TIPOS_SEGURIDAD = Object.freeze({
    SecurityAction: [
        { name: 'action', type: 'string' },
        { name: 'scope', type: 'string' },
        { name: 'state', type: 'string' },
        { name: 'reason', type: 'string' },
        { name: 'nonce', type: 'string' },
        { name: 'expiresAt', type: 'uint64' },
    ],
});

const DECISIONES = ['APPROVE', 'REJECT'];

/**
 * Mensaje a firmar para una intención. `intentRecord` es la fila persistida:
 * { id, intent (normalizada), intent_hash, policy_hash, expires_at }.
 */
function mensajeAprobacion(intentRecord, decision) {
    const i = intentRecord.intent;
    return {
        intentId: String(intentRecord.id),
        intentHash: intentRecord.intent_hash,
        policyHash: intentRecord.policy_hash,
        rail: i.rail,
        asset: i.asset,
        amount: i.amount,
        destination: `${i.destination.type}:${i.destination.value}`,
        beneficiary: i.destination.name || i.counterparty?.legalName || '',
        network: i.network || 'fiat',
        decision,
        expiresAt: Math.floor(Date.parse(i.expiresAt) / 1000),
    };
}

/** Datos tipados listos para `eth_signTypedData_v4`. */
function datosTipados(intentRecord, decision = 'APPROVE') {
    return {
        domain: { ...DOMINIO },
        types: { ...TIPOS_APROBACION },
        primaryType: 'TransactionApproval',
        message: mensajeAprobacion(intentRecord, decision),
    };
}

/** Dirección (en minúsculas) que firmó la aprobación de esta intención con esta decisión. */
function recuperarAprobador(intentRecord, decision, firma) {
    if (!DECISIONES.includes(decision)) {
        const e = new Error('Decisión no válida.'); e.code = 'APPROVAL_DECISION_INVALID'; throw e;
    }
    try {
        return ethers.verifyTypedData(DOMINIO, TIPOS_APROBACION, mensajeAprobacion(intentRecord, decision), firma).toLowerCase();
    } catch {
        const e = new Error('Firma de aprobación no válida.'); e.code = 'APPROVAL_SIGNATURE_INVALID'; throw e;
    }
}

/**
 * Verifica una acción de seguridad firmada (kill switch).
 * Devuelve la dirección firmante si el mensaje no ha caducado.
 */
function recuperarAccionSeguridad({ message, signature }, ahora = Date.now()) {
    const m = message || {};
    const campos = TIPOS_SEGURIDAD.SecurityAction.map((c) => c.name);
    if (!campos.every((c) => m[c] !== undefined)) {
        const e = new Error('Acción de seguridad incompleta.'); e.code = 'SECURITY_ACTION_INVALID'; throw e;
    }
    if (Number(m.expiresAt) * 1000 < ahora) {
        const e = new Error('Acción de seguridad caducada.'); e.code = 'SECURITY_ACTION_EXPIRED'; throw e;
    }
    if (Number(m.expiresAt) * 1000 > ahora + 15 * 60 * 1000) {
        // Una firma válida durante días es una firma que alguien puede guardar
        // y usar cuando le convenga.
        const e = new Error('La acción de seguridad no puede caducar a más de 15 minutos.'); e.code = 'SECURITY_ACTION_TOO_LONG'; throw e;
    }
    try {
        const limpio = Object.fromEntries(campos.map((c) => [c, m[c]]));
        return ethers.verifyTypedData(DOMINIO, TIPOS_SEGURIDAD, limpio, signature).toLowerCase();
    } catch {
        const e = new Error('Firma de la acción de seguridad no válida.'); e.code = 'SECURITY_ACTION_SIGNATURE_INVALID'; throw e;
    }
}

/**
 * ¿Es esta dirección aprobador válido para esta intención?
 *
 *   · Pagos desde la tesorería de BeZhas: rol `treasury`, global (sin app).
 *   · Resto: rol `approver` o `treasury` del MISMO cliente. Un aprobador de otro
 *     cliente no aprueba nada tuyo, y un aprobador global no sustituye a los tuyos.
 */
async function aprobadorValido(direccion, intentRecord) {
    const deTesoreria = intentRecord.intent.source.type === 'bezhas_treasury';
    const { rows } = await query(
        `SELECT address, roles, app_id FROM tx_approvers
          WHERE LOWER(address) = $1 AND status = 'active'
            AND (expires_at IS NULL OR expires_at > NOW())`,
        [direccion]
    );
    return rows.some((r) => {
        const roles = r.roles || [];
        if (deTesoreria) return r.app_id === null && roles.includes('treasury');
        return String(r.app_id) === String(intentRecord.app_id) && (roles.includes('approver') || roles.includes('treasury'));
    });
}

/** ¿Son estas direcciones aprobadores de seguridad activos? Devuelve las que sí. */
async function aprobadoresDeSeguridad(direcciones) {
    if (!direcciones.length) return [];
    const { rows } = await query(
        `SELECT LOWER(address) AS address FROM tx_approvers
          WHERE LOWER(address) = ANY($1) AND status = 'active' AND app_id IS NULL
            AND 'security' = ANY(roles) AND (expires_at IS NULL OR expires_at > NOW())`,
        [direcciones.map((d) => d.toLowerCase())]
    );
    return rows.map((r) => r.address);
}

module.exports = {
    DOMINIO, TIPOS_APROBACION, TIPOS_SEGURIDAD, DECISIONES,
    mensajeAprobacion, datosTipados, recuperarAprobador, recuperarAccionSeguridad,
    aprobadorValido, aprobadoresDeSeguridad,
};
