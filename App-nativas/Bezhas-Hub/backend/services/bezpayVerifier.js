/**
 * ============================================================================
 * BEZPAY VERIFIER — verificación on-chain de pagos entrantes
 * ============================================================================
 *
 * El webhook de BezPay lo llama el navegador del pagador, así que NADA de lo
 * que llega en el body es de fiar. Este módulo es el único sitio que decide si
 * un pago ocurrió de verdad, y lo decide leyendo la cadena:
 *
 *   - la TX existe, está minada y no revirtió
 *   - tiene confirmaciones suficientes (reorg safety)
 *   - la envió el titular de la orden
 *   - el destinatario es el Treasury de la orden
 *   - el importe llegado es >= el importe que la orden pedía
 *
 * Errores retryables (RPC caído, TX aún sin minar, pocas confirmaciones) se
 * marcan con `retryable: true`: el llamante debe dejar el pago en 'pending' y
 * reintentar, NUNCA dar el pago por bueno.
 */

'use strict';

const { ethers } = require('ethers');

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

// Confirmaciones mínimas antes de entregar valor. Polygon reorganiza más de lo
// que su tiempo de bloque sugiere; 3 es el mínimo prudente.
const MIN_CONFIRMATIONS = parseInt(process.env.BEZPAY_MIN_CONFIRMATIONS || '3', 10);

const RPC_BY_CHAIN = {
  137:   () => process.env.POLYGON_RPC_URL || process.env.POLYGON_MAINNET_RPC || 'https://polygon-bor.publicnode.com',
  80002: () => process.env.POLYGON_AMOY_RPC || 'https://rpc-amoy.polygon.technology',
  56:    () => process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
  1:     () => process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
};

const _providers = new Map();

function getProviderFor(chainId) {
  const rpcFor = RPC_BY_CHAIN[chainId];
  if (!rpcFor) {
    throw new VerificationError('CHAIN_UNSUPPORTED', `Chain ${chainId} not supported`);
  }
  if (!_providers.has(chainId)) {
    _providers.set(chainId, new ethers.JsonRpcProvider(rpcFor(), chainId));
  }
  return _providers.get(chainId);
}

class VerificationError extends Error {
  constructor(code, message, { retryable = false } = {}) {
    super(message);
    this.name = 'VerificationError';
    this.code = code;
    this.retryable = retryable;
  }
}

/** true si `hash` tiene la forma de un hash de TX. */
function isTxHash(hash) {
  return typeof hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(hash);
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Compara dos direcciones por su valor, no por su checksum.
 *
 * Deliberadamente NO usa ethers.getAddress(): esa función lanza con
 * "bad address checksum" ante una dirección en mayúsculas/minúsculas mezcladas
 * cuyo EIP-55 no cuadra, y aquí eso se traducía en `false` — es decir, en
 * rechazar un pago legítimo. El checksum es una ayuda contra erratas al
 * teclear, no parte de la identidad: 20 bytes son 20 bytes.
 */
function sameAddress(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (!ADDRESS_RE.test(a) || !ADDRESS_RE.test(b)) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/** Dirección empaquetada en un topic de 32 bytes → dirección en minúsculas. */
function addressFromTopic(topic) {
  return '0x' + topic.slice(26).toLowerCase();
}

/**
 * Suma lo que la TX transfirió a `recipient` en `tokenAddress`.
 * Varias transferencias al mismo destino en la misma TX se acumulan.
 */
function sumErc20TransfersTo(receipt, tokenAddress, recipient) {
  let total = 0n;
  for (const log of receipt.logs) {
    if (!sameAddress(log.address, tokenAddress)) continue;
    if (log.topics[0] !== TRANSFER_TOPIC) continue;
    if (log.topics.length < 3) continue;
    if (!sameAddress(addressFromTopic(log.topics[2]), recipient)) continue;
    total += BigInt(log.data);
  }
  return total;
}

/**
 * Verifica que una TX pagó lo que la orden pedía.
 *
 * @param {object} p
 * @param {string} p.txHash
 * @param {number} p.chainId
 * @param {string} p.payer            Wallet titular de la orden (tx.from debe coincidir)
 * @param {string} p.recipient        Treasury que debía cobrar
 * @param {string|null} p.tokenAddress  null → pago nativo (MATIC/ETH/BNB)
 * @param {bigint} p.minAmountWei     Importe mínimo aceptable
 * @returns {Promise<{txHash, blockNumber, confirmations, paidWei, payer}>}
 * @throws {VerificationError}
 */
async function verifyIncomingPayment({ txHash, chainId, payer, recipient, tokenAddress, minAmountWei }) {
  if (!isTxHash(txHash)) {
    throw new VerificationError('BAD_TXHASH', 'txHash malformado');
  }
  if (!recipient) {
    throw new VerificationError('NO_RECIPIENT', 'La orden no tiene destinatario de cobro');
  }
  if (typeof minAmountWei !== 'bigint' || minAmountWei <= 0n) {
    throw new VerificationError('NO_EXPECTED_AMOUNT', 'La orden no tiene importe esperado');
  }

  const provider = getProviderFor(chainId);

  let receipt, tx, head;
  try {
    [receipt, tx, head] = await Promise.all([
      provider.getTransactionReceipt(txHash),
      provider.getTransaction(txHash),
      provider.getBlockNumber(),
    ]);
  } catch (err) {
    // RPC caído NO es "pago válido". Se reintenta.
    throw new VerificationError('RPC_UNAVAILABLE', `RPC no disponible: ${err.message}`, { retryable: true });
  }

  if (!receipt || !tx) {
    throw new VerificationError('TX_NOT_FOUND', 'TX no encontrada o aún sin minar', { retryable: true });
  }
  if (receipt.status !== 1) {
    throw new VerificationError('TX_REVERTED', 'La TX revirtió en la cadena');
  }

  const confirmations = head - receipt.blockNumber + 1;
  if (confirmations < MIN_CONFIRMATIONS) {
    throw new VerificationError(
      'INSUFFICIENT_CONFIRMATIONS',
      `${confirmations}/${MIN_CONFIRMATIONS} confirmaciones`,
      { retryable: true }
    );
  }

  // El pagador debe ser el titular de la orden: si no, cualquiera podría
  // reclamar como suya la TX de otro y cobrar el BEZ.
  if (payer && !sameAddress(tx.from, payer)) {
    throw new VerificationError('WRONG_PAYER', `La TX la envió ${tx.from}, no ${payer}`);
  }

  let paidWei;
  if (tokenAddress) {
    paidWei = sumErc20TransfersTo(receipt, tokenAddress, recipient);
    if (paidWei === 0n) {
      throw new VerificationError('WRONG_RECIPIENT', `La TX no transfirió ese token a ${recipient}`);
    }
  } else {
    if (!sameAddress(tx.to, recipient)) {
      throw new VerificationError('WRONG_RECIPIENT', `La TX pagó a ${tx.to}, no a ${recipient}`);
    }
    paidWei = tx.value;
  }

  if (paidWei < minAmountWei) {
    throw new VerificationError(
      'UNDERPAID',
      `Pagado ${paidWei.toString()} < requerido ${minAmountWei.toString()}`
    );
  }

  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    confirmations,
    paidWei,
    payer: tx.from,
  };
}

module.exports = {
  verifyIncomingPayment,
  VerificationError,
  isTxHash,
  sameAddress,
  MIN_CONFIRMATIONS,
  TRANSFER_TOPIC,
};
