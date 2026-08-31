'use strict';

/**
 * l1FraudProver — vigilante independiente de la L2 de BeZhas.
 *
 * ── Por qué este proceso existe ─────────────────────────────────────────────
 *
 * BeZhasL1Commitment sabe verificar una prueba de fraude, pero no sabe
 * fabricarla: los contratos no miran hacia fuera. Sin alguien que compare lo
 * anclado con lo que de verdad pasó y presente la prueba, el sistema tiene la
 * capacidad de castigar el fraude y ninguna posibilidad de detectarlo.
 *
 * Ése es el papel del vigilante, y su valor depende de una condición que
 * conviene decir en voz alta: **este proceso sólo aporta garantía real si lo
 * ejecuta alguien que no sea BeZhas.** Un vigilante operado por el mismo que
 * secuencia no vigila nada; a lo sumo detecta sus propios errores de software,
 * que no es poco, pero no es la propiedad institucional que se busca.
 *
 * El diseño está pensado para eso: no necesita permisos, ni claves de la
 * plataforma, ni acceso a la base de datos. Le basta un RPC de la L2, un RPC de
 * L1 y una cuenta con gas. Un cliente, un auditor o una aseguradora pueden
 * levantarlo sin pedirle nada a BeZhas — y ganan dinero si nos pillan.
 *
 * ── Qué comprueba ───────────────────────────────────────────────────────────
 *
 *   1. Que la raíz del lote corresponde a los datos publicados.
 *   2. Que el acumulador avanzó según la regla de transición.
 *   3. Que no falta ninguna evidencia con acuse de recibo firmado.
 *   4. Que los datos están disponibles; si no, los reclama en L1.
 *
 * Las tres primeras terminan, si hay fraude, en una transacción a L1 que lo
 * demuestra aritméticamente y se lleva la fianza del secuenciador.
 */

const crypto = require('crypto');
const { ethers } = require('ethers');
const logger = require('../utils/logger');

const COMMITMENT_ABI = [
  'function commitmentCount() external view returns (uint256)',
  'function fraudCount() external view returns (uint256)',
  'function lastCommittedBlock() external view returns (uint64)',
  'function challengeWindow() external view returns (uint64)',
  'function proposerBond() external view returns (uint256)',
  'function daChallengeBond() external view returns (uint256)',
  'function commitments(uint256) external view returns (bytes32 parentStateRoot, bytes32 stateRoot, bytes32 batchRoot, bytes32 dataHash, bytes32 l2StateRoot, uint64 fromBlock, uint64 toBlock, uint32 txCount, uint64 proposedAt, address proposer, uint256 bond, uint8 status, string note)',
  'function proveInvalidBatchRoot(uint256 index, bytes32[] leaves) external',
  'function proveInvalidStateRoot(uint256 index, bytes32[] leaves) external',
  'function proveOmittedTransaction(uint256 index, bytes32 txHash, uint64 promisedBlock, bytes signature, bytes32[] leaves) external',
  'function challengeDataAvailability(uint256 index) external payable',
  'function withdraw() external',
  'function withdrawable(address) external view returns (uint256)',
];

const STATUS = ['PROPOSED', 'FINALIZED', 'DISPUTED', 'REVERTED', 'DA_CHALLENGED'];

// ── Esquema criptográfico: idéntico al del contrato y al del resto del stack ──

const sha256Buf = (b) => crypto.createHash('sha256').update(b).digest();
const hex = (b) => `0x${b.toString('hex')}`;
const unhex = (s) => Buffer.from(String(s).replace(/^0x/, ''), 'hex');

function hashPair(a, b) {
  return Buffer.compare(a, b) <= 0
    ? sha256Buf(Buffer.concat([a, b]))
    : sha256Buf(Buffer.concat([b, a]));
}

function merkleRoot(leaves) {
  if (leaves.length === 0) return Buffer.alloc(32);
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

/** Regla de transición del acumulador: acc' = sha256(acc || hoja). */
function fold(parentRoot, leaves) {
  let acc = unhex(parentRoot);
  for (const leaf of leaves) acc = sha256Buf(Buffer.concat([acc, leaf]));
  return acc;
}

/** Compromiso de disponibilidad: keccak256 de las hojas concatenadas. */
function dataHashOf(leaves) {
  return ethers.keccak256(ethers.concat(leaves.map((l) => hex(l))));
}

// ── Conexiones. Ninguna necesita privilegios en la plataforma. ───────────────

function l2Provider() {
  const rpc = process.env.BEZHAS_L2_RPC_URL || process.env.RPC_URL;
  return rpc ? new ethers.JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 }) : null;
}

function l1Signer() {
  const rpc = process.env.L1_RPC_URL;
  const key = process.env.L1_WATCHER_KEY;
  if (!rpc || !key) return null;
  const provider = new ethers.JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
  return new ethers.NonceManager(new ethers.Wallet(key, provider));
}

function contract() {
  const addr = process.env.L1_COMMITMENT_ADDRESS;
  const signer = l1Signer();
  return addr && signer ? new ethers.Contract(addr, COMMITMENT_ABI, signer) : null;
}

function isConfigured() {
  return Boolean(l2Provider() && contract());
}

// ── Reconstrucción independiente ─────────────────────────────────────────────

/**
 * Recorre la L2 por su cuenta y calcula qué DEBERÍA haberse anclado.
 *
 * No consulta a BeZhas para nada: lee la cadena. Ahí está la independencia del
 * vigilante — si preguntara al secuenciador qué publicó, comprobaría que el
 * secuenciador es coherente consigo mismo, que es una propiedad muy distinta.
 */
async function recompute(fromBlock, toBlock, parentStateRoot) {
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

  const leaves = txHashes.map(unhex);
  return {
    txHashes,
    leaves,
    txCount: txHashes.length,
    batchRoot: hex(merkleRoot(leaves)),
    stateRoot: hex(fold(parentStateRoot, leaves)),
    dataHash: dataHashOf(leaves),
    l2StateRoot,
  };
}

/**
 * Audita un compromiso ya publicado y devuelve el veredicto SIN enviar nada.
 *
 * Separado a propósito de la denuncia: querer mirar antes de acusar es lo
 * normal, y además así el veredicto se puede consultar desde un panel sin que
 * eso mueva una sola transacción.
 */
async function audit(index) {
  const c = contract();
  if (!c) return { checked: false, mode: 'not_configured' };

  const k = await c.commitments(index);
  const from = Number(k.fromBlock);
  const to = Number(k.toBlock);
  const base = {
    index,
    fromBlock: from,
    toBlock: to,
    status: STATUS[Number(k.status)] ?? String(k.status),
    proposer: k.proposer,
    bondAtRisk: k.bond.toString(),
  };

  const mine = await recompute(from, to, k.parentStateRoot);

  // Si el dataHash no coincide, el secuenciador publicó un compromiso sobre un
  // conjunto de datos distinto del que hay en la cadena. No se puede probar con
  // proveInvalidBatchRoot (esa prueba exige el preimagen que ÉL firmó): lo que
  // corresponde es exigirle los datos y comprobarlos.
  if (k.dataHash.toLowerCase() !== mine.dataHash.toLowerCase()) {
    return {
      ...base,
      verdict: 'DATA_MISMATCH',
      provable: false,
      nextAction: 'challengeDataAvailability',
      reason: 'El dataHash anclado no corresponde a las transacciones de la L2; '
            + 'hay que obligarle a publicar el preimagen para poder verificarlo.',
      expected: { dataHash: mine.dataHash, txCount: mine.txCount },
      committed: { dataHash: k.dataHash, txCount: Number(k.txCount) },
    };
  }

  const findings = [];
  if (k.batchRoot.toLowerCase() !== mine.batchRoot.toLowerCase()
      || Number(k.txCount) !== mine.txCount) {
    findings.push({
      kind: 'invalid_batch_root',
      method: 'proveInvalidBatchRoot',
      expected: mine.batchRoot,
      committed: k.batchRoot,
    });
  }
  if (k.stateRoot.toLowerCase() !== mine.stateRoot.toLowerCase()) {
    findings.push({
      kind: 'invalid_state_root',
      method: 'proveInvalidStateRoot',
      expected: mine.stateRoot,
      committed: k.stateRoot,
    });
  }

  // l2StateRoot se compara pero NO es denunciable: el contrato no puede
  // verificar la raíz MPT de la EVM. Se reporta para que un humano lo mire.
  const l2Divergence = k.l2StateRoot !== ethers.ZeroHash
    && mine.l2StateRoot
    && k.l2StateRoot.toLowerCase() !== mine.l2StateRoot.toLowerCase();

  return {
    ...base,
    verdict: findings.length ? 'FRAUD' : (l2Divergence ? 'UNVERIFIABLE_DIVERGENCE' : 'OK'),
    provable: findings.length > 0,
    findings,
    ...(l2Divergence ? {
      note: 'La raíz EVM de la L2 diverge, pero L1 no puede verificarla sin un '
          + 'verificador de un paso. Vía de gobernanza (dispute), no prueba.',
      expectedL2StateRoot: mine.l2StateRoot,
      committedL2StateRoot: k.l2StateRoot,
    } : {}),
    txCount: mine.txCount,
  };
}

/** Presenta en L1 la prueba correspondiente al hallazgo. */
async function proveFraud(index, finding, leaves) {
  const c = contract();
  const args = [index, leaves.map(hex)];
  const tx = finding.method === 'proveInvalidBatchRoot'
    ? await c.proveInvalidBatchRoot(...args)
    : await c.proveInvalidStateRoot(...args);
  const receipt = await tx.wait();
  return { proven: true, kind: finding.kind, l1TxHash: receipt.hash, gasUsed: Number(receipt.gasUsed) };
}

/**
 * Denuncia la exclusión de una evidencia que tenía acuse de recibo firmado.
 *
 * @param promise {txHash, promisedBlock, signature} tal y como se le entregó al
 *   cliente al aceptar su evidencia. Es él quien la guarda y quien la esgrime:
 *   el vigilante no necesita confiar en BeZhas para nada, sólo verificar la
 *   firma contra la clave que el contrato reconoce como secuenciador.
 */
async function proveCensorship(index, promise) {
  const c = contract();
  const k = await c.commitments(index);
  const mine = await recompute(Number(k.fromBlock), Number(k.toBlock), k.parentStateRoot);

  if (k.dataHash.toLowerCase() !== mine.dataHash.toLowerCase()) {
    return { proven: false, mode: 'data_mismatch', reason: 'Hay que reclamar antes los datos en L1' };
  }
  if (mine.txHashes.some((h) => h.toLowerCase() === promise.txHash.toLowerCase())) {
    return { proven: false, mode: 'included', reason: 'La evidencia sí está en el lote' };
  }

  const tx = await c.proveOmittedTransaction(
    index, promise.txHash, promise.promisedBlock, promise.signature, mine.leaves.map(hex),
  );
  const receipt = await tx.wait();
  return { proven: true, kind: 'omitted_transaction', l1TxHash: receipt.hash, gasUsed: Number(receipt.gasUsed) };
}

/** Reclama en L1 los datos de un lote que no cuadra con la cadena. */
async function demandData(index) {
  const c = contract();
  const bond = await c.daChallengeBond();
  const tx = await c.challengeDataAvailability(index, { value: bond });
  const receipt = await tx.wait();
  return { challenged: true, index, bond: bond.toString(), l1TxHash: receipt.hash };
}

/**
 * Una pasada completa: audita los compromisos aún impugnables y actúa.
 *
 * Sólo mira los que están dentro de la ventana. Fuera de ella el lote es firme
 * y no hay nada que hacer — que es precisamente por lo que el vigilante tiene
 * que estar levantado de forma continua y no ejecutarse "de vez en cuando".
 */
async function sweep({ dryRun = false } = {}) {
  const c = contract();
  if (!c) return { swept: false, mode: 'not_configured' };

  const count = Number(await c.commitmentCount());
  const window = Number(await c.challengeWindow());
  const now = Math.floor(Date.now() / 1000);
  const results = [];

  for (let i = count - 1; i >= 0; i--) {
    const k = await c.commitments(i);
    if (now >= Number(k.proposedAt) + window) break; // el resto ya son firmes
    if (STATUS[Number(k.status)] === 'FINALIZED') continue;

    let verdict;
    try {
      verdict = await audit(i);
    } catch (err) {
      results.push({ index: i, verdict: 'AUDIT_FAILED', error: err.message });
      continue;
    }

    if (verdict.verdict === 'FRAUD' && !dryRun) {
      const mine = await recompute(Number(k.fromBlock), Number(k.toBlock), k.parentStateRoot);
      try {
        const proof = await proveFraud(i, verdict.findings[0], mine.leaves);
        logger.error(
          `[L1][FRAUDE] compromiso #${i} DEMOSTRADO FALSO (${proof.kind}) `
          + `proposer=${k.proposer} fianza=${ethers.formatEther(k.bond)} tx=${proof.l1TxHash}`
        );
        results.push({ ...verdict, ...proof });
        continue;
      } catch (err) {
        results.push({ ...verdict, proven: false, error: err.message });
        continue;
      }
    }

    if (verdict.verdict === 'DATA_MISMATCH' && !dryRun
        && STATUS[Number(k.status)] !== 'DA_CHALLENGED') {
      try {
        results.push({ ...verdict, ...(await demandData(i)) });
        continue;
      } catch (err) {
        results.push({ ...verdict, challenged: false, error: err.message });
        continue;
      }
    }

    results.push(verdict);
  }

  const frauds = results.filter((r) => r.proven).length;
  if (frauds === 0 && results.length) {
    logger.info(`[L1][VIGILANTE] ${results.length} compromiso(s) auditado(s), sin discrepancias`);
  }
  return { swept: true, audited: results.length, fraudsProven: frauds, results };
}

// ── Temporizador ─────────────────────────────────────────────────────────────

let timer = null;

function start() {
  if (process.env.L1_WATCHER_ENABLED !== 'true' || timer) return false;
  const intervalMs = parseInt(process.env.L1_WATCHER_INTERVAL_MS || '30000', 10);

  timer = setInterval(() => {
    sweep().catch((err) => logger.warn(`[L1][VIGILANTE] pasada fallida: ${err.message}`));
  }, intervalMs);
  if (timer.unref) timer.unref();

  logger.info(`[L1][VIGILANTE] vigilante de fraude activo (cada ${intervalMs}ms)`);
  return true;
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = {
  isConfigured, recompute, audit, proveFraud, proveCensorship, demandData, sweep,
  merkleRoot, fold, dataHashOf, start, stop,
};
