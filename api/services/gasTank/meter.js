'use strict';

/**
 * gasTank/meter — carga al Gas Tank de una organización el coste de una operación on-chain que
 * BeZhas envía por ella con una clave de operador (anclajes, lotes de CargoLink, certificados…).
 *
 *   const { result, charged } = await meterOperation(
 *     { orgId, opType: 'anchorBatch', appId, maxGasLimit: 250000, maxGasPriceGwei: 80 },
 *     async () => { const tx = await contract.anchor(...); return { receipt: await tx.wait(), tx }; });
 *
 *   1. Reserva el coste MÁXIMO (gas límite × precio máximo): sin saldo, no se envía (402).
 *   2. Ejecuta `send`. Si falla antes de minarse, libera la reserva entera.
 *   3. Liquida con el recibo real: gasUsed × precio efectivo (+ comisión de protocolo en BEZ si la hay).
 *      Una operación revertida y minada también se cobra: el gas se gastó.
 *
 * No firma nada: la clave que envía la transacción sigue siendo la del llamador. La firma por
 * UserOperation (paymaster) llega en la fase 2.
 */

const crypto = require('crypto');
const cfg = require('../../config/gas-tank');
const ledger = require('./ledger');
const prices = require('./prices');
const events = require('./events');
const logger = require('../../utils/logger');

function gasTankError(code, status, message) {
    const e = new Error(message);
    e.code = code;
    e.status = status;
    return e;
}

const gweiOf = (wei) => Number(wei) / 1e9;

async function meterOperation(
    { orgId, opType, appId = null, opId = null, userRef = null, chainId = null, maxGasLimit, maxGasPriceGwei, protocolFeeBez = 0 },
    send,
    deps = {}
) {
    const { ledger: L = ledger, prices: P = prices, events: E = events } = deps;
    if (!orgId || !opType) throw new Error('orgId y opType son obligatorios');
    if (!(maxGasLimit > 0) || !(maxGasPriceGwei > 0)) throw new Error('maxGasLimit y maxGasPriceGwei son obligatorios');

    const polEur = await P.getPolEur();
    const bezEur = protocolFeeBez > 0 ? await P.getBezEur() : 0;
    const cost = (gasUsed, gasPriceGwei) => cfg.operationCostCredits({ gasUsed, gasPriceGwei, polEur, protocolFeeBez, bezEur });

    const opHash = opId || `op:${crypto.randomUUID()}`;
    const reservation = await L.reserve(orgId, cost(maxGasLimit, maxGasPriceGwei), { opHash, appId });
    if (!reservation) {
        throw gasTankError('INSUFFICIENT_GAS_TANK', 402, 'El Gas Tank no tiene saldo suficiente para esta operación.');
    }
    if (reservation.reused && reservation.status !== 'reserved') {
        throw gasTankError('OPERATION_ALREADY_METERED', 409, 'Esta operación ya se midió.');
    }

    async function liquidar(receipt) {
        // Sin recibo no hay coste real: se cobra el máximo reservado (conservador, no regalado).
        const gasUsed = receipt ? Number(receipt.gasUsed) : maxGasLimit;
        const price = receipt && (receipt.gasPrice ?? receipt.effectiveGasPrice) != null
            ? gweiOf(receipt.gasPrice ?? receipt.effectiveGasPrice) : maxGasPriceGwei;
        const actual = cost(gasUsed, price);
        const meta = { txHash: receipt?.hash || receipt?.transactionHash || null, chainId, userRef, opType, gasUsed };
        try {
            return await L.settle(opHash, actual, meta);
        } catch (err) {
            // La operación ya está en la cadena. Se reintenta una vez; si sigue fallando se deja constancia.
            try { return await L.settle(opHash, actual, meta); } catch (err2) {
                logger.error({ err: err2.message, opHash, orgId, actual }, '[gasTank] operación enviada pero NO liquidada: conciliar a mano');
                return null;
            }
        }
    }

    // Avisa sólo al CRUZAR el umbral (antes de la operación estaba por encima, ahora por debajo), no en cada cargo.
    async function avisarSaldoBajo(charged) {
        if (!charged || !charged.charged) return;
        try {
            const b = await L.getBalance(orgId);
            const { thresholdCredits } = b.autoRecharge;
            if (b.balanceCredits < thresholdCredits && b.balanceCredits + charged.charged >= thresholdCredits) {
                await E.emitToOrg(orgId, 'gas.low_balance', { balanceCredits: b.balanceCredits, thresholdCredits });
            }
        } catch (err) {
            logger.warn({ err: err.message, orgId }, '[gasTank] aviso de saldo bajo no emitido');
        }
    }

    let out;
    try {
        out = await send();
    } catch (err) {
        // Revertida pero minada: hay recibo y el gas se gastó, se cobra.
        if (err && err.receipt && err.receipt.gasUsed != null) {
            await liquidar(err.receipt);
        } else {
            await L.release(opHash).catch((e) => logger.error({ err: e.message, opHash }, '[gasTank] no se pudo liberar la reserva'));
        }
        throw err;
    }

    const charged = await liquidar(out && out.receipt);
    await avisarSaldoBajo(charged);
    return { result: out, charged };
}

/** Organización dueña de una app registrada (app_registry → organizations.legacy_enterprise_id). */
async function orgIdForApp(appId) {
    const { rows } = await require('../../db/pool').query(
        `SELECT o.id FROM app_registry a JOIN organizations o ON o.legacy_enterprise_id = a.enterprise_id WHERE a.id::text = $1 LIMIT 1`,
        [String(appId)]
    );
    return rows[0]?.id || null;
}

module.exports = { meterOperation, orgIdForApp };
