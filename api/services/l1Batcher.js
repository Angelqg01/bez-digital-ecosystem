'use strict';

/**
 * l1Batcher — publica en Ethereum L1 el compromiso de estado de la L2.
 *
 * ── Qué publica ─────────────────────────────────────────────────────────────
 *
 * Recorre un rango de bloques de la L2 y ancla cuatro cosas:
 *
 *   batchRoot   raíz merkle de las transacciones — permite probar inclusión.
 *   stateRoot   el ACUMULADOR de BeZhas tras plegar el lote sobre el anterior.
 *   dataHash    keccak256 de las hojas: el compromiso de disponibilidad, sin el
 *               cual ninguna prueba de fraude sería sólida.
 *   l2StateRoot la raíz MPT de la EVM. INFORMATIVA: L1 no puede verificarla.
 *
 * Y deposita una FIANZA. Ése es el punto: el batcher no pide que le crean, pone
 * dinero. Si alguno de los tres primeros campos no cuadra con los datos que él
 * mismo publicó, cualquiera lo demuestra en L1 y se lleva la fianza. Ver
 * `l1FraudProver.js` para el lado que detecta y `BeZhasL1Commitment.sol` para
 * el que verifica.
 *
 * ── Qué sigue sin estar cubierto ────────────────────────────────────────────
 *
 *   * `l2StateRoot` no es verificable en L1: haría falta reejecutar la EVM,
 *     que es el problema de los juegos de bisección con verificador de un paso.
 *     Su única vía es la gobernanza (`dispute`), y eso es confianza, no prueba.
 *   * No hay puente de fondos. Retirar de L2 a L1 exige, además, pruebas de
 *     inclusión de mensajes y una cola de salida.
 *   * Pasada la ventana sin que nadie objete, el lote es firme aunque fuera
 *     falso. Un sistema optimista supone que hay al menos un vigilante honesto
 *     mirando dentro del plazo.
 *
 * ── Sobre el coste ──────────────────────────────────────────────────────────
 *
 * Publicar en L1 es la partida dominante del coste de una L2. Por eso el
 * batcher agrupa: el coste de un compromiso es fijo, así que cuantos más
 * bloques cubra, menos cuesta por transacción. La contrapartida es latencia
 * de finalización, y ése es el compromiso que hay que calibrar por negocio.
 */

const crypto = require('crypto');
const { chainCall } = require('../utils/chainCall');
const { ethers } = require('ethers');
const logger = require('../utils/logger');

const COMMITMENT_ABI = [
  'function propose(bytes32 parentStateRoot, bytes32 stateRoot, bytes32 batchRoot, bytes32 dataHash, bytes32 l2StateRoot, uint64 fromBlock, uint64 toBlock, uint32 txCount) external payable returns (uint256)',
  'function finalize(uint256 index) external',
  'function commitmentCount() external view returns (uint256)',
  'function fraudCount() external view returns (uint256)',
  'function lastCommittedBlock() external view returns (uint64)',
  'function proposerBond() external view returns (uint256)',
  'function isFinalized(uint256 index) external view returns (bool)',
  'function isCanonical(uint256 index) external view returns (bool)',
  'function timeUntilFinalizable(uint256 index) external view returns (uint64)',
  'function verifyInBatch(uint256 index, bytes32 leaf, bytes32[] proof) external view returns (bool)',
  'function withdraw() external',
  'function commitments(uint256) external view returns (bytes32 parentStateRoot, bytes32 stateRoot, bytes32 batchRoot, bytes32 dataHash, bytes32 l2StateRoot, uint64 fromBlock, uint64 toBlock, uint32 txCount, uint64 proposedAt, address proposer, uint256 bond, uint8 status, string note)',
];

// ── Merkle: mismo esquema de pares ordenados que el resto de la plataforma ───

const sha256Buf = (b) => crypto.createHash('sha256').update(b).digest();
const hex = (b) => `0x${b.toString('hex')}`;
const unhex = (s) => Buffer.from(String(s).replace(/^0x/, ''), 'hex');

function hashPair(a, b) {
  return Buffer.compare(a, b) <= 0
    ? sha256Buf(Buffer.concat([a, b]))
    : sha256Buf(Buffer.concat([b, a]));
}

function merkleRoot(leaves) {
  if (leaves.length === 0) return Buffer.alloc(32); // lote vacío: raíz cero
  let level = leaves.slice();
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(hashPair(level[i], i + 1 < level.length ? level[i + 1] : level[i]));
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
      next.push(hashPair(level[j], j + 1 < level.length ? level[j + 1] : level[j]));
    }
    const sibling = i % 2 === 0 ? Math.min(i + 1, level.length - 1) : i - 1;
    proof.push(level[sibling]);
    i = Math.floor(i / 2);
    level = next;
  }
  return proof;
}

/** La hoja de una transacción L2 es su hash: es lo que la identifica. */
const leafForTx = (txHash) => unhex(txHash);

/**
 * Regla de transición del acumulador de BeZhas: acc' = sha256(acc || hoja).
 *
 * Se eligió así, y no la raíz MPT de la EVM, por una razón concreta: ESTA regla
 * cabe en L1. Replegar cien hojas cuesta menos que una transferencia de ERC-20,
 * de modo que la validez del estado se puede DEMOSTRAR en Ethereum de una sola
 * llamada, sin juego de bisección y sin verificador de un paso.
 */
function fold(parentRoot, leaves) {
  let acc = unhex(parentRoot);
  for (const leaf of leaves) acc = sha256Buf(Buffer.concat([acc, leaf]));
  return acc;
}

/** Compromiso de disponibilidad de datos: keccak256 de las hojas concatenadas. */
function dataHashOf(leaves) {
  return ethers.keccak256(ethers.concat(leaves.map(hex)));
}

// ── Conexiones ───────────────────────────────────────────────────────────────

function l2Provider() {
  const rpc = process.env.BEZHAS_L2_RPC_URL || process.env.RPC_URL;
  if (!rpc) return null;
  return new ethers.JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
}

function l1Signer() {
  const rpc = process.env.L1_RPC_URL;
  const key = process.env.L1_BATCHER_KEY || process.env.CARGOLINK_OPERATOR_KEY;
  if (!rpc || !key) return null;
  const provider = new ethers.JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
  // NonceManager por la misma razón que en el resto de la plataforma: dos
  // publicaciones seguidas sin él se pisan el nonce.
  return new ethers.NonceManager(new ethers.Wallet(key, provider));
}

function commitmentContract() {
  const addr = process.env.L1_COMMITMENT_ADDRESS;
  const signer = l1Signer();
  if (!addr || !signer) return null;
  return new ethers.Contract(addr, COMMITMENT_ABI, signer);
}

function isConfigured() {
  return Boolean(l2Provider() && commitmentContract());
}

// ── Recolección del lote ─────────────────────────────────────────────────────

/**
 * Reúne las transacciones de un rango de bloques L2 y su raíz de estado.
 *
 * La raíz de estado se toma del ÚLTIMO bloque del rango: es la que resume el
 * estado resultante de aplicar todo el lote, que es justo lo que se
 * compromete.
 */
async function collectRange(fromBlock, toBlock, parentStateRoot = ethers.ZeroHash) {
  const provider = l2Provider();
  if (!provider) throw new Error('L2 RPC not configured');

  const txHashes = [];
  let l2StateRoot = null;

  for (let n = fromBlock; n <= toBlock; n++) {
    const block = await provider.getBlock(n);
    if (!block) throw new Error(`L2 block ${n} not found`);
    for (const h of block.transactions) txHashes.push(h);
    if (n === toBlock) l2StateRoot = block.stateRoot;
  }

  const leaves = txHashes.map(leafForTx);
  return {
    fromBlock, toBlock, txHashes, leaves, l2StateRoot,
    txCount: txHashes.length,
    batchRoot: hex(merkleRoot(leaves)),
    stateRoot: hex(fold(parentStateRoot, leaves)),
    dataHash: dataHashOf(leaves),
  };
}

/** Acumulador del último compromiso vigente, o cero si la cadena está vacía. */
async function currentAccumulator(contract) {
  const count = Number(await contract.commitmentCount());
  if (count === 0) return ethers.ZeroHash;
  return (await contract.commitments(count - 1)).stateRoot;
}

/**
 * Publica en L1 el compromiso del siguiente rango pendiente.
 *
 * El rango arranca donde terminó el compromiso anterior — el contrato lo
 * exige contiguo, porque un hueco permitiría ocultar bloques L2.
 *
 * @param {number} maxBlocks techo de bloques por compromiso. Más bloques
 *   abaratan el coste por transacción y encarecen la latencia de finalización.
 */
async function publishNext({ maxBlocks = 100, minTxs = 0 } = {}) {
  const contract = commitmentContract();
  const provider = l2Provider();
  if (!contract || !provider) return { published: false, mode: 'not_configured' };

  const count = Number(await contract.commitmentCount());
  const last = Number(await contract.lastCommittedBlock());
  const head = await provider.getBlockNumber();

  // El primer compromiso arranca en el bloque 0; los siguientes, en el
  // posterior al último cubierto. Si una prueba de fraude truncó la cadena,
  // `lastCommittedBlock` ya ha retrocedido y aquí se republica desde ahí.
  const from = count === 0 ? 0 : last + 1;
  if (from > head) return { published: false, mode: 'up_to_date', l2Head: head };

  const to = Math.min(head, from + maxBlocks - 1);
  const parentStateRoot = await currentAccumulator(contract);
  const batch = await collectRange(from, to, parentStateRoot);

  if (batch.txCount < minTxs) {
    // No merece la pena pagar L1 por un lote casi vacío. El operador decide
    // el umbral según cuánto le cueste la latencia frente al gas.
    return {
      published: false, mode: 'below_min_txs',
      fromBlock: from, toBlock: to, txCount: batch.txCount, minTxs,
    };
  }

  const bond = await contract.proposerBond();

  const t0 = Date.now();
  const receipt = await (await contract.propose(
    parentStateRoot, batch.stateRoot, batch.batchRoot, batch.dataHash, batch.l2StateRoot,
    BigInt(from), BigInt(to), batch.txCount,
    { value: bond },
  )).wait();

  const result = {
    published: true,
    index: count,
    fromBlock: from, toBlock: to,
    blocksCovered: to - from + 1,
    txCount: batch.txCount,
    parentStateRoot,
    stateRoot: batch.stateRoot,
    batchRoot: batch.batchRoot,
    dataHash: batch.dataHash,
    bond: bond.toString(),
    l1TxHash: receipt.hash,
    l1GasUsed: Number(receipt.gasUsed),
    gasPerL2Tx: batch.txCount > 0 ? Math.round(Number(receipt.gasUsed) / batch.txCount) : null,
    elapsedMs: Date.now() - t0,
  };

  logger.info(
    `[L1][BATCH] compromiso #${result.index}: bloques ${from}-${to} `
    + `(${batch.txCount} tx) gas=${result.l1GasUsed} `
    + `(${result.gasPerL2Tx ?? '-'} gas/tx L2) fianza=${ethers.formatEther(bond)} tx=${receipt.hash}`
  );
  return result;
}

/**
 * Prueba de que una transacción L2 concreta está en un compromiso publicado.
 *
 * Es la demostración que se le enseña a alguien que sólo confía en L1: aquí
 * está la rama que reconstruye la raíz que está anclada en Ethereum.
 */
async function proveTx(index, txHash) {
  const contract = commitmentContract();
  if (!contract) return null;

  const c = await chainCall('BeZhasL1Commitment.commitments',
    () => contract.commitments(index), null);
  if (!c) return null;

  const batch = await collectRange(Number(c.fromBlock), Number(c.toBlock), c.parentStateRoot);
  const pos = batch.txHashes.findIndex((h) => h.toLowerCase() === String(txHash).toLowerCase());
  if (pos < 0) return { found: false, index, txHash };

  const leaves = batch.txHashes.map(leafForTx);
  const proof = merkleProof(leaves, pos).map(hex);
  const verified = await contract.verifyInBatch(index, txHash, proof);

  return {
    found: true, index, txHash, position: pos,
    leafCount: leaves.length, proof,
    verifiedOnL1: Boolean(verified),
  };
}

// ── Temporizador ─────────────────────────────────────────────────────────────

let timer = null;

function start() {
  if (process.env.L1_BATCHER_ENABLED !== 'true' || timer) return false;
  const intervalMs = parseInt(process.env.L1_BATCHER_INTERVAL_MS || '60000', 10);
  const maxBlocks = parseInt(process.env.L1_BATCHER_MAX_BLOCKS || '100', 10);
  const minTxs = parseInt(process.env.L1_BATCHER_MIN_TXS || '1', 10);

  timer = setInterval(() => {
    publishNext({ maxBlocks, minTxs })
      .catch((err) => logger.warn(`[L1][BATCH] publicación falló: ${err.message}`));
  }, intervalMs);
  if (timer.unref) timer.unref();

  logger.info(`[L1][BATCH] batcher L1 activo (cada ${intervalMs}ms, máx ${maxBlocks} bloques/lote)`);
  return true;
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

/**
 * Acuse de recibo firmado de una evidencia aceptada.
 *
 * Es la contrapartida del cliente frente a la censura: con esta firma en la
 * mano, si BeZhas publica un lote que cubre `promisedBlock` y la evidencia no
 * está dentro, cualquiera lo demuestra en L1 con `proveOmittedTransaction` y se
 * queda la fianza. Sin acuse de recibo esa prueba no existe — el secuenciador
 * siempre podría alegar que nunca recibió nada.
 *
 * EIP-712 con dominio separado: la promesa vale para este contrato y esta
 * cadena, y para ningún otro sitio.
 */
async function signInclusionPromise(txHash, promisedBlock) {
  const signer = l1Signer();
  const addr = process.env.L1_COMMITMENT_ADDRESS;
  if (!signer || !addr) return null;

  const { chainId } = await signer.provider.getNetwork();
  const domain = {
    name: 'BeZhasL1Commitment',
    version: '1',
    chainId: Number(chainId),
    verifyingContract: addr,
  };
  const types = {
    InclusionPromise: [
      { name: 'txHash', type: 'bytes32' },
      { name: 'promisedBlock', type: 'uint64' },
    ],
  };
  const value = { txHash, promisedBlock: BigInt(promisedBlock) };
  // NonceManager delega la firma en el wallet que envuelve.
  const wallet = signer.signer ?? signer;
  return {
    txHash,
    promisedBlock,
    signature: await wallet.signTypedData(domain, types, value),
    domain,
  };
}

module.exports = {
  isConfigured, collectRange, currentAccumulator, publishNext, proveTx,
  signInclusionPromise, merkleRoot, merkleProof, fold, dataHashOf, start, stop,
};
