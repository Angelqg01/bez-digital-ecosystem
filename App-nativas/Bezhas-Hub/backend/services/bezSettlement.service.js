/**
 * BEZ Settlement Service (Fase 3C — pagos reales con BEZ)
 * ============================================================================
 * Verifica un pago liquidado en BEZ Token directamente ON-CHAIN a partir de su
 * txHash: confirma que el recibo contiene un evento `Transfer` del contrato BEZ
 * hacia el destinatario esperado por al menos el importe esperado. Idempotente
 * por txHash (no se acredita dos veces el mismo pago).
 *
 * BEZ Token (moneda de settlement): Polygon 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8.
 *
 * Diseño:
 *  - OPT-IN: `isEnabled()` ← FEATURE_BEZ_SETTLEMENT === 'true'. El flujo de pago
 *    actual no cambia hasta activarlo.
 *  - `provider` y `ledger` inyectables → testeable sin red y verificable contra
 *    la cadena real (read-only, sin fondos).
 *  - Read-only: NO firma ni mueve fondos; sólo lee y verifica recibos.
 */
const { ethers } = require('ethers');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const DEFAULT_BEZ = (process.env.BEZCOIN_CONTRACT_ADDRESS || process.env.BEZ_TOKEN_ADDRESS ||
    '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8');
const DEFAULT_RPC = (process.env.POLYGON_MAINNET_RPC || process.env.POLYGON_RPC_URL ||
    'https://polygon-bor.publicnode.com');

const TRANSFER_IFACE = new ethers.Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

function isEnabled() {
    return process.env.FEATURE_BEZ_SETTLEMENT === 'true';
}

function buildProvider(rpcUrl = DEFAULT_RPC) {
    return new ethers.JsonRpcProvider(rpcUrl);
}

// ── Ledger de idempotencia (por defecto en memoria; pluggable a DB/Redis) ───
function createMemoryLedger() {
    const seen = new Map(); // txHash(lower) → settlement result
    return {
        async get(txHash) { return seen.get(txHash.toLowerCase()) || null; },
        async record(txHash, result) { seen.set(txHash.toLowerCase(), result); },
    };
}
const defaultLedger = createMemoryLedger();

/**
 * Verifica (read-only) un settlement BEZ on-chain por txHash.
 * @returns {Promise<{valid, reason?, amountBez?, from?, to?, blockNumber?, confirmations?, txHash}>}
 */
async function verifyBezSettlement({
    txHash,
    expectedTo,
    minAmountBez = 0,
    bezAddress = DEFAULT_BEZ,
    provider = buildProvider(),
    minConfirmations = 1,
} = {}) {
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
        return { valid: false, reason: 'invalid-txhash', txHash };
    }
    const bez = bezAddress.toLowerCase();

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return { valid: false, reason: 'tx-not-found', txHash };
    if (receipt.status !== 1) return { valid: false, reason: 'tx-failed', txHash };

    // Buscar Transfer(s) del contrato BEZ; sumar lo que va a expectedTo (si se indica).
    let matched = null;
    let totalToExpected = 0n;
    for (const log of receipt.logs || []) {
        if ((log.address || '').toLowerCase() !== bez) continue;
        let parsed;
        try { parsed = TRANSFER_IFACE.parseLog(log); } catch { continue; }
        if (!parsed || parsed.name !== 'Transfer') continue;
        const to = parsed.args.to.toLowerCase();
        if (expectedTo && to !== expectedTo.toLowerCase()) continue;
        totalToExpected += parsed.args.value;
        matched = matched || { from: parsed.args.from, to: parsed.args.to };
    }

    if (!matched) {
        return { valid: false, reason: expectedTo ? 'no-transfer-to-recipient' : 'no-bez-transfer', txHash };
    }

    const amountBez = parseFloat(ethers.formatUnits(totalToExpected, 18));
    if (amountBez + 1e-9 < Number(minAmountBez)) {
        return { valid: false, reason: 'amount-too-low', amountBez, minAmountBez: Number(minAmountBez), txHash };
    }

    // Confirmaciones (best-effort; si no hay número de bloque actual, asumimos 1).
    let confirmations = 1;
    try {
        const current = await provider.getBlockNumber();
        confirmations = Math.max(1, current - receipt.blockNumber + 1);
    } catch { /* read-only best-effort */ }

    if (confirmations < minConfirmations) {
        return { valid: false, reason: 'insufficient-confirmations', confirmations, minConfirmations, txHash };
    }

    return {
        valid: true,
        txHash,
        amountBez,
        from: matched.from,
        to: matched.to,
        blockNumber: receipt.blockNumber,
        confirmations,
    };
}

/**
 * Verifica + registra de forma IDEMPOTENTE. La segunda vez con el mismo txHash
 * devuelve `{ alreadySettled: true, ... }` sin re-acreditar.
 */
async function settle(args, { ledger = defaultLedger } = {}) {
    const { txHash } = args || {};
    if (!txHash) return { valid: false, reason: 'invalid-txhash' };

    const prev = await ledger.get(txHash);
    if (prev) {
        logger.info({ txHash }, '[BezSettlement] idempotent hit — already settled');
        return { ...prev, alreadySettled: true };
    }

    const result = await verifyBezSettlement(args);
    if (result.valid) {
        await ledger.record(txHash, result);
        logger.info({ txHash, amountBez: result.amountBez, to: result.to }, '✅ [BezSettlement] settled');
    }
    return { ...result, alreadySettled: false };
}

module.exports = {
    isEnabled,
    buildProvider,
    verifyBezSettlement,
    settle,
    createMemoryLedger,
    BEZ_ADDRESS: DEFAULT_BEZ,
    DEFAULT_RPC,
};
