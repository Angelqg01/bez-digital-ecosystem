const { ethers } = require('ethers');

/**
 * Verificación EN CADENA de un depósito de BEZ para recargar saldo publicitario.
 *
 * Antes, POST /api/billing/add-bez-funds acreditaba el importe que dijera el cliente con cualquier txHash (había un TODO
 * en lugar de la comprobación): cualquier usuario autenticado podía regalarse saldo. Ahora se acredita SÓLO lo que la cadena
 * demuestra: un `Transfer` del token BEZ desde la wallet del usuario hacia la dirección de depósito configurada, ya confirmado.
 *
 *   BEZ_TOKEN_ADDRESS        token BEZ (por defecto el de Polygon)
 *   BEZ_ADS_DEPOSIT_ADDRESS  dirección que recibe los depósitos (obligatoria: sin ella el endpoint responde 503)
 *   BEZ_DEPOSIT_CONFIRMATIONS confirmaciones mínimas (20 por defecto)
 */
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const BEZ_DEFAULT = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const BEZ_DECIMALS = 18;

const topicDe = (addr) => ethers.zeroPadValue(ethers.getAddress(addr), 32).toLowerCase();

function configuracion(env = process.env) {
    const deposito = env.BEZ_ADS_DEPOSIT_ADDRESS;
    return {
        token: env.BEZ_TOKEN_ADDRESS || BEZ_DEFAULT,
        deposito: deposito && ethers.isAddress(deposito) ? deposito : null,
        confirmaciones: Math.max(1, Number(env.BEZ_DEPOSIT_CONFIRMATIONS) || 20),
        rpc: env.POLYGON_RPC_URL || env.POLYGON_MAINNET_RPC || 'https://polygon-bor-rpc.publicnode.com',
    };
}

/**
 * @returns {Promise<{ok: true, amountBez: number, blockNumber: number} | {ok: false, code: string, error: string}>}
 */
async function verifyBezDeposit({ txHash, fromWallet, provider, env = process.env }) {
    const cfg = configuracion(env);
    if (!cfg.deposito) return { ok: false, code: 'NOT_CONFIGURED', error: 'Los depósitos en BEZ no están configurados' };
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(txHash))) return { ok: false, code: 'BAD_TX_HASH', error: 'Hash de transacción inválido' };
    if (!fromWallet || !ethers.isAddress(fromWallet)) return { ok: false, code: 'WALLET_REQUIRED', error: 'El usuario no tiene wallet válida' };

    const prov = provider || new ethers.JsonRpcProvider(cfg.rpc);
    let receipt;
    let head;
    try {
        [receipt, head] = await Promise.all([prov.getTransactionReceipt(txHash), prov.getBlockNumber()]);
    } catch (err) {
        return { ok: false, code: 'RPC_ERROR', error: `No se pudo consultar la cadena: ${err.message}` };
    }
    if (!receipt) return { ok: false, code: 'TX_NOT_FOUND', error: 'Transacción no encontrada' };
    if (receipt.status !== 1) return { ok: false, code: 'TX_FAILED', error: 'La transacción falló en cadena' };
    if (head - receipt.blockNumber + 1 < cfg.confirmaciones) {
        return { ok: false, code: 'NOT_CONFIRMED', error: `Faltan confirmaciones (mínimo ${cfg.confirmaciones})` };
    }

    const token = cfg.token.toLowerCase();
    const from = topicDe(fromWallet);
    const to = topicDe(cfg.deposito);
    let total = 0n;
    for (const log of receipt.logs || []) {
        if (String(log.address).toLowerCase() !== token) continue;
        if (!log.topics || log.topics[0] !== TRANSFER_TOPIC || log.topics.length !== 3) continue;
        if (String(log.topics[1]).toLowerCase() !== from || String(log.topics[2]).toLowerCase() !== to) continue;
        total += BigInt(log.data);
    }
    if (total <= 0n) return { ok: false, code: 'NO_MATCHING_TRANSFER', error: 'No hay una transferencia de BEZ desde tu wallet a la dirección de depósito' };
    return { ok: true, amountBez: Number(ethers.formatUnits(total, BEZ_DECIMALS)), blockNumber: receipt.blockNumber };
}

module.exports = { verifyBezDeposit, configuracion, TRANSFER_TOPIC };
