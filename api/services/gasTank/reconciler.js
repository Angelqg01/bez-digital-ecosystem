'use strict';

/**
 * gasTank/reconciler — cierra las reservas de patrocinio con lo que el EntryPoint cobró DE VERDAD.
 *
 * Se liquida con `UserOperationEvent.actualGasCost` (incluye el gas del postOp), NO con el `GasCharged` del
 * paymaster, que queda unos puntos por debajo. El precio de POL y la comisión de BEZ son los fijados al reservar
 * (meta de la reserva): el cargo no depende de que el precio se mueva entre la firma y la inclusión.
 *
 *   settleFromEvent(ev)            liquida una UserOperationEvent
 *   scan({provider, from, to})     lee los eventos de un rango de bloques y los liquida
 *   runOnce({provider})            avanza desde el cursor persistido (con confirmaciones)
 */

const { ethers } = require('ethers');
const db = require('../../db/pool');
const cfg = require('../../config/gas-tank');
const ledger = require('./ledger');
const userOp = require('./userOp');
const logger = require('../../utils/logger');

const EP_IFACE = new ethers.Interface([
    'event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)',
]);
const EVENT_TOPIC = EP_IFACE.getEvent('UserOperationEvent').topicHash;
const CONFIRMATIONS = 5;
const MAX_RANGE = 2000;

function creditsFromWei(weiBig, polEur) {
    const pol = Number(ethers.formatEther(weiBig));
    return Math.max(1, Math.ceil((pol * polEur * (1 + cfg.MARKUP_RATE)) / cfg.EUR_PER_CREDIT));
}

async function settleFromEvent({ entryPoint, chainId, sender, nonce, success, actualGasCost, txHash }, deps = {}) {
    const L = deps.ledger || ledger;
    const key = userOp.reservationKey({ entryPoint, chainId, sender, nonce });
    const r = await L.getReservation(key);
    if (!r) return { skipped: 'no_reservation', key };
    if (r.status !== 'reserved') return { skipped: r.status, key };

    const polEur = Number(r.meta?.polEur);
    if (!(polEur > 0)) {
        logger.error({ key }, '[gasTank] reserva sin precio fijado: conciliar a mano');
        return { skipped: 'no_price', key };
    }
    const gasCredits = creditsFromWei(BigInt(actualGasCost), polEur);
    // La comisión de la bóveda solo salió si la ejecución tuvo éxito (si revirtió, el BEZ nunca se movió).
    const feeCredits = success ? Number(r.meta?.feeCredits || 0) : 0;
    const out = await L.settle(key, gasCredits + feeCredits, {
        txHash, chainId, opType: success ? 'sponsoredUserOp' : 'sponsoredUserOpReverted',
        gasUsed: null, userRef: sender,
    });
    return { key, gasCredits, feeCredits, ...out };
}

async function scan({ provider, entryPoint, paymaster, chainId, from, to }, deps = {}) {
    const logs = await provider.getLogs({
        address: entryPoint, fromBlock: from, toBlock: to,
        topics: [EVENT_TOPIC, null, null, ethers.zeroPadValue(paymaster, 32)],
    });
    const results = [];
    for (const log of logs) {
        const ev = EP_IFACE.parseLog(log);
        try {
            results.push(await settleFromEvent({
                entryPoint, chainId, sender: ev.args.sender, nonce: ev.args.nonce, success: ev.args.success,
                actualGasCost: ev.args.actualGasCost, txHash: log.transactionHash,
            }, deps));
        } catch (err) {
            logger.error({ err: err.message, tx: log.transactionHash }, '[gasTank] no se pudo liquidar un UserOperationEvent');
            results.push({ error: err.message, tx: log.transactionHash });
        }
    }
    return results;
}

async function runOnce({ provider, entryPoint, paymaster, chainId, name = 'gas-tank-paymaster', startBlock = null }, deps = {}) {
    const head = await provider.getBlockNumber();
    const safe = head - CONFIRMATIONS;
    const cur = await db.query('SELECT last_block FROM gas_tank_chain_cursor WHERE name = $1', [name]);
    const last = cur.rows.length ? Number(cur.rows[0].last_block) : (startBlock != null ? startBlock - 1 : safe - 1);
    if (safe <= last) return { scanned: 0, results: [] };
    const from = last + 1;
    const to = Math.min(safe, from + MAX_RANGE - 1);
    const results = await scan({ provider, entryPoint, paymaster, chainId, from, to }, deps);
    // El cursor solo avanza si ningún evento falló al liquidarse: un error se reintenta en la siguiente vuelta.
    if (!results.some((r) => r.error)) {
        await db.query(
            `INSERT INTO gas_tank_chain_cursor (name, chain_id, last_block) VALUES ($1, $2, $3)
             ON CONFLICT (name) DO UPDATE SET last_block = EXCLUDED.last_block, updated_at = NOW()`,
            [name, chainId, to]);
    }
    return { scanned: to - from + 1, from, to, results };
}

let timer = null;
/** Arranca el conciliador si el patrocinio está configurado (GAS_TANK_ENTRYPOINT/PAYMASTER/CHAIN_ID). Devuelve false si no. */
function start(intervalMs = 30_000, env = process.env) {
    if (timer || !env.GAS_TANK_ENTRYPOINT || !env.GAS_TANK_PAYMASTER || !env.GAS_TANK_CHAIN_ID) return false;
    const params = {
        entryPoint: ethers.getAddress(env.GAS_TANK_ENTRYPOINT), paymaster: ethers.getAddress(env.GAS_TANK_PAYMASTER),
        chainId: Number(env.GAS_TANK_CHAIN_ID),
        startBlock: env.GAS_TANK_START_BLOCK ? Number(env.GAS_TANK_START_BLOCK) : null,
    };
    const tick = () => runOnce({ provider: require('../contractService').getProvider(), ...params })
        .catch((e) => logger.warn({ err: e.message }, '[gasTank] conciliador'));
    tick();
    timer = setInterval(tick, intervalMs);
    timer.unref?.();
    return true;
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { start, stop, settleFromEvent, scan, runOnce, creditsFromWei, EVENT_TOPIC, EP_IFACE };
