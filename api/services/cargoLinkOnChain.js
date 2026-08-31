'use strict';

/**
 * cargoLinkOnChain — post-commit on-chain anchoring for B-UID lifecycle.
 *
 * After each advanceTransaction() confirms in the DB, this service calls the
 * deployed supplychain contracts (SupplyTracker, CustomsClearanceOracle,
 * DeliveryEscrow) to produce an immutable on-chain record of the transition.
 *
 * If anchoring fails the DB transition is NOT reverted — the anchor result
 * is recorded as { anchored: false, mode: 'anchor_failed' } so the frontend
 * and webhooks still reflect the real lifecycle state.
 *
 * Required env vars (all optional — service degrades gracefully):
 *   CARGOLINK_OPERATOR_KEY — private key of the backend signer (OPERATOR_ROLE)
 *   RPC_URL               — JSON-RPC endpoint for the target chain
 *   SUPPLY_TRACKER_ADDRESS, CUSTOMS_CLEARANCE_ORACLE_ADDRESS, DELIVERY_ESCROW_ADDRESS
 *     OR a deployments/<chainId>.json file in smart-contracts/
 */

const { ethers } = require('ethers');
const { chainCall } = require('../utils/chainCall');
const path = require('path');
const fs = require('fs');
const { query } = require('../db/pool');
const logger = require('../utils/logger');
const batcher = require('./cargoLinkBatcher');

const ABI_DIR = path.resolve(__dirname, '../../smart-contracts/abi');

const ERC20_APPROVE_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

const BEZ_TOKEN = process.env.BEZ_TOKEN_ADDRESS || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

const CP_TYPE = {
  ORIGIN: 0,
  WAREHOUSE: 1,
  CUSTOMS: 2,
  PORT: 3,
  DISTRIBUTION: 4,
  DESTINATION: 5,
};

let _provider = null;
let _signer = null;
const _contracts = {};

function loadABI(name) {
  const raw = JSON.parse(fs.readFileSync(path.join(ABI_DIR, `${name}.json`), 'utf8'));
  return raw.abi || raw;
}

function getAddresses() {
  if (process.env.SUPPLY_TRACKER_ADDRESS) {
    return {
      supplyTracker: process.env.SUPPLY_TRACKER_ADDRESS,
      customsClearance: process.env.CUSTOMS_CLEARANCE_ORACLE_ADDRESS || null,
      deliveryEscrow: process.env.DELIVERY_ESCROW_ADDRESS || null,
      warehouseManager: process.env.WAREHOUSE_MANAGER_ADDRESS || null,
      trackingGateway: process.env.TRACKING_GATEWAY_ADDRESS || null,
    };
  }
  try {
    const chainId = process.env.BEZHAS_CHAIN_ID || process.env.CHAIN_ID || '2708';
    const data = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../smart-contracts/deployments', `${chainId}.json`), 'utf8')
    );
    // DeployAll.s.sol escribe las direcciones de supplychain bajo `sectors`,
    // no en la raíz. Leer sólo `data.supplychain` devolvía null para todo y
    // dejaba el anclaje en `not_configured` — en silencio, porque el anclaje
    // es best-effort. Se acepta la forma plana por si algún despliegue la usa.
    const sc = (data.sectors && data.sectors.supplychain) || data.supplychain || {};
    // DeliveryEscrow no es un contrato de sector: vive en `core`.
    const core = data.core || {};
    return {
      supplyTracker: sc.SupplyTracker || null,
      customsClearance: sc.CustomsClearanceOracle || null,
      deliveryEscrow: sc.DeliveryEscrow || core.DeliveryEscrow || null,
      warehouseManager: process.env.WAREHOUSE_MANAGER_ADDRESS || sc.WarehouseManager || null,
      trackingGateway: process.env.TRACKING_GATEWAY_ADDRESS || sc.TrackingIntegrationGateway || null,
      transitGateway: process.env.TRANSIT_GATEWAY_ADDRESS || sc.TrackingToCustomsGateway || null,
    };
  } catch {
    return null;
  }
}

function isConfigured() {
  const key = process.env.CARGOLINK_OPERATOR_KEY || process.env.OPERATOR_PRIVATE_KEY;
  const rpc = process.env.RPC_URL || process.env.BEZHAS_L2_RPC_URL;
  const addrs = getAddresses();
  return Boolean(key && rpc && addrs?.supplyTracker);
}

function getProvider() {
  if (!_provider) {
    const rpc = process.env.RPC_URL || process.env.BEZHAS_L2_RPC_URL;
    if (!rpc) return null;
    // cacheTimeout: -1 desactiva la caché interna de ethers v6, que devuelve
    // getTransactionCount obsoleto y hace fallar con NONCE_EXPIRED las
    // transacciones encadenadas sobre el mismo provider. Ya está documentado
    // en __tests__/integration/setup.js; faltaba aquí.
    _provider = new ethers.JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
  }
  return _provider;
}

function getSigner() {
  if (!_signer) {
    const key = process.env.CARGOLINK_OPERATOR_KEY || process.env.OPERATOR_PRIVATE_KEY;
    const provider = getProvider();
    if (!key || !provider) return null;
    // NonceManager serializa el nonce en local. Sin él, varias transiciones
    // simultáneas (cosa normal: un buque descarga y llegan N eventos a la vez)
    // se pisan el nonce y todas menos una revierten con "nonce has already
    // been used". Medido: 8 de 12 creaciones concurrentes fallaban así.
    _signer = new ethers.NonceManager(new ethers.Wallet(key, provider));
  }
  return _signer;
}

function getContract(name, address) {
  if (!address) return null;
  const cacheKey = `${name}_${address}`;
  if (!_contracts[cacheKey]) {
    const signer = getSigner();
    if (!signer) return null;
    _contracts[cacheKey] = new ethers.Contract(address, loadABI(name), signer);
  }
  return _contracts[cacheKey];
}

function contentHash(value) {
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(value || {})));
}

function escrowIdFromBuid(bUid) {
  return ethers.keccak256(ethers.toUtf8Bytes(bUid));
}

function getBezToken() {
  const signer = getSigner();
  if (!signer) return null;
  const cacheKey = `ERC20_${BEZ_TOKEN}`;
  if (!_contracts[cacheKey]) {
    _contracts[cacheKey] = new ethers.Contract(BEZ_TOKEN, ERC20_APPROVE_ABI, signer);
  }
  return _contracts[cacheKey];
}

async function getChainShipmentId(bUid) {
  const { rows } = await query(
    `SELECT payload FROM cargolink_transitions
     WHERE b_uid = $1 AND to_status = 'CREATED'
     ORDER BY created_at ASC LIMIT 1`,
    [bUid],
  );
  const id = rows[0]?.payload?.anchor?.chainShipmentId;
  return id != null ? Number(id) : null;
}

async function storeAnchorInTransition(bUid, toStatus, anchor) {
  await query(
    `UPDATE cargolink_transitions
     SET payload = jsonb_set(COALESCE(payload, '{}'), '{anchor}', $1::jsonb)
     WHERE id = (
       SELECT id FROM cargolink_transitions
       WHERE b_uid = $2 AND to_status = $3
       ORDER BY created_at DESC LIMIT 1
     )`,
    [JSON.stringify(anchor), bUid, toStatus],
  );
}

async function anchorCreated(tx, addresses) {
  const tracker = getContract('SupplyTracker', addresses.supplyTracker);
  if (!tracker) return { anchored: false, mode: 'no_contract' };

  // SupplyTracker.sol:59 exige `_receiver != address(0)`, así que pasar
  // ZeroAddress hacía que createShipment revirtiera SIEMPRE con "Invalid
  // receiver" — el evento más básico del ciclo no podía anclarse nunca, con o
  // sin configuración correcta. El receptor es el destinatario del envío
  // cuando se conoce; si no, el propio operador, que es quien responde de la
  // custodia hasta que haya uno.
  // NonceManager no expone `.address` de forma síncrona (envuelve al signer),
  // así que el fallback se resuelve con await sobre getAddress().
  const receiver = ethers.isAddress(tx.receiver_address || '')
    ? tx.receiver_address
    : await getSigner().getAddress();
  const hash = contentHash(tx.cargo);
  const weight = BigInt(tx.cargo?.weight || 0);

  const receipt = await (await tracker.createShipment(receiver, hash, weight)).wait();

  const parsed = receipt.logs
    .map((log) => { try { return tracker.interface.parseLog(log); } catch { return null; } })
    .find((e) => e?.name === 'ShipmentCreated');
  const chainShipmentId = parsed ? Number(parsed.args.shipmentId) : null;

  const result = {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.supplyTracker,
    chainShipmentId,
    mode: 'anchored',
  };

  // If the transaction carries an escrow, lock funds in DeliveryEscrow.
  const escrowAmount = Number(tx.escrow_amount_bez || 0);
  if (escrowAmount > 0 && addresses.deliveryEscrow) {
    try {
      const escrow = await anchorEscrowCreation(tx, addresses);
      result.escrow = escrow;
    } catch (err) {
      result.escrow = { anchored: false, mode: 'escrow_failed', error: err.message };
    }
  }

  return result;
}

async function anchorEscrowCreation(tx, addresses) {
  const escrowContract = getContract('DeliveryEscrow', addresses.deliveryEscrow);
  const bezToken = getBezToken();
  if (!escrowContract || !bezToken) return { anchored: false, mode: 'no_contract' };

  const escrowId = escrowIdFromBuid(tx.b_uid);
  const amount = ethers.parseUnits(String(tx.escrow_amount_bez), 18);
  const seller = ethers.ZeroAddress;
  const memo = `BZ CargoLink escrow for ${tx.b_uid}`;

  // Approve BEZ transfer to the escrow contract.
  const allowance = await bezToken.allowance(await getSigner().getAddress(), addresses.deliveryEscrow);
  if (allowance < amount) {
    await (await bezToken.approve(addresses.deliveryEscrow, amount)).wait();
  }

  const receipt = await (
    await escrowContract.createEscrow(escrowId, seller, amount, memo)
  ).wait();

  return {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.deliveryEscrow,
    escrowId,
    mode: 'escrow_locked',
  };
}

async function anchorCustomsCleared(tx, payload, addresses) {
  const oracle = getContract('CustomsClearanceOracle', addresses.customsClearance);
  if (!oracle) return { anchored: false, mode: 'no_contract' };

  const chainShipmentId = await getChainShipmentId(tx.b_uid);
  if (chainShipmentId == null) return { anchored: false, mode: 'no_chain_shipment' };

  const input = payload?.input || {};
  const hsCode = ethers.encodeBytes32String((input.hsCode || '0000.00').slice(0, 31));
  const cargoValue = BigInt(Math.round((input.declaredValue || tx.cargo?.value || 0) * 100));
  const duaHash = contentHash(payload);

  const receipt = await (
    await oracle.requestClearance(chainShipmentId, hsCode, cargoValue, 'BZCargoLink', duaHash)
  ).wait();

  return {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.customsClearance,
    chainShipmentId,
    mode: 'anchored',
  };
}

async function anchorCheckpoint(tx, cpType, payload, addresses) {
  const tracker = getContract('SupplyTracker', addresses.supplyTracker);
  if (!tracker) return { anchored: false, mode: 'no_contract' };

  const chainShipmentId = await getChainShipmentId(tx.b_uid);
  if (chainShipmentId == null) return { anchored: false, mode: 'no_chain_shipment' };

  const input = payload?.input || {};
  const locationHash = contentHash({ location: input.location || input.port || tx.origin });
  const temperature = BigInt(Math.round((input.temperature || 0) * 100));

  const receipt = await (
    await tracker.recordCheckpoint(chainShipmentId, cpType, locationHash, temperature)
  ).wait();

  return {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.supplyTracker,
    chainShipmentId,
    mode: 'anchored',
  };
}

async function anchorMarkInTransit(tx, addresses) {
  const tracker = getContract('SupplyTracker', addresses.supplyTracker);
  if (!tracker) return { anchored: false, mode: 'no_contract' };

  const chainShipmentId = await getChainShipmentId(tx.b_uid);
  if (chainShipmentId == null) return { anchored: false, mode: 'no_chain_shipment' };

  const receipt = await (await tracker.markInTransit(chainShipmentId)).wait();

  return {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.supplyTracker,
    chainShipmentId,
    mode: 'anchored',
  };
}

async function anchorDelivery(tx, addresses) {
  const tracker = getContract('SupplyTracker', addresses.supplyTracker);
  if (!tracker) return { anchored: false, mode: 'no_contract' };

  const chainShipmentId = await getChainShipmentId(tx.b_uid);
  if (chainShipmentId == null) return { anchored: false, mode: 'no_chain_shipment' };

  const receipt = await (await tracker.confirmDelivery(chainShipmentId)).wait();

  const result = {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.supplyTracker,
    chainShipmentId,
    mode: 'anchored',
  };

  // If the transaction had escrow LOCKED, release funds to the seller.
  if (tx.escrow_status === 'LOCKED' && addresses.deliveryEscrow) {
    try {
      const escrow = await anchorEscrowRelease(tx, addresses);
      result.escrow = escrow;
    } catch (err) {
      result.escrow = { anchored: false, mode: 'escrow_release_failed', error: err.message };
    }
  }

  return result;
}

async function anchorEscrowRelease(tx, addresses) {
  const escrowContract = getContract('DeliveryEscrow', addresses.deliveryEscrow);
  if (!escrowContract) return { anchored: false, mode: 'no_contract' };

  const escrowId = escrowIdFromBuid(tx.b_uid);
  const evidenceHash = contentHash({ bUid: tx.b_uid, status: 'DELIVERED', at: tx.updated_at });

  const receipt = await (
    await escrowContract.validateAndRelease(escrowId, evidenceHash)
  ).wait();

  return {
    anchored: true,
    txHash: receipt.hash,
    contract: addresses.deliveryEscrow,
    escrowId,
    mode: 'escrow_released',
  };
}

/**
 * Post-commit hook: anchor a lifecycle transition on-chain.
 *
 * @param {object} tx             — the transaction row AFTER the DB update
 * @param {string} toStatus       — the status it just transitioned TO
 * @param {object} transitionPayload — { input, validation } stored in the transition
 * @returns {{ anchored, txHash?, contract?, chainShipmentId?, mode, error? }}
 */
/**
 * GATE_IN → WarehouseManager.receiveLot.
 *
 * El almacén se registra on-chain la primera vez que se usa (registerWarehouse)
 * y su id se cachea en cargolink_warehouses. Es idempotente: si ya tiene
 * chain_warehouse_id no se vuelve a registrar.
 */
/**
 * Devuelve el id on-chain de un almacén, registrándolo la primera vez.
 *
 * El registro es perezoso —se paga gas sólo por almacenes que se usan de
 * verdad— pero tiene que poder dispararse desde cualquier operación que
 * necesite la dirección, no sólo desde el gate-in: un traspaso de custodia
 * hacia un almacén que aún no ha recibido nada también lo necesita.
 */
async function ensureWarehouseOnChain(wm, code) {
  const { rows } = await query(
    'SELECT id, chain_warehouse_id, capacity_kg FROM cargolink_warehouses WHERE code = $1',
    [code]
  );
  if (rows.length === 0) return { id: null, mode: 'warehouse_unknown' };
  const wh = rows[0];
  if (wh.chain_warehouse_id !== null && wh.chain_warehouse_id !== undefined) {
    return { id: wh.chain_warehouse_id, rowId: wh.id };
  }

  const r = await (await wm.registerWarehouse(contentHash({ code }), BigInt(wh.capacity_kg))).wait();
  const ev = r.logs
    .map((l) => { try { return wm.interface.parseLog(l); } catch { return null; } })
    .find((e) => e?.name === 'WarehouseRegistered');
  const chainId = ev ? Number(ev.args.warehouseId ?? ev.args[0]) : null;
  if (chainId === null) return { id: null, mode: 'warehouse_register_failed' };

  await query(
    'UPDATE cargolink_warehouses SET chain_warehouse_id = $1, chain_tx_hash = $2 WHERE id = $3',
    [chainId, r.hash, wh.id]
  );
  return { id: chainId, rowId: wh.id, registeredNow: true };
}

async function anchorGateIn(tx, payload, addresses) {
  const wm = getContract('WarehouseManager', addresses.warehouseManager);
  if (!wm) return { anchored: false, mode: 'no_contract' };

  const v = payload?.validation || payload || {};
  const code = v.warehouseCode;
  if (!code) return { anchored: false, mode: 'no_warehouse' };

  const wh = await ensureWarehouseOnChain(wm, code);
  if (wh.id === null) return { anchored: false, mode: wh.mode };
  const chainWarehouseId = wh.id;

  const qty = BigInt(Math.round(Number(v.quantityKg || tx.cargo?.weight || 0)));
  // receiveLot exige expiry > now. Para carga no perecedera se usa un horizonte
  // largo en vez de rechazar: el contrato no distingue tipos de mercancía.
  const expiryMs = v.expiryDate ? new Date(v.expiryDate).getTime() : Date.now() + 5 * 365 * 24 * 3600 * 1000;
  const productHash = contentHash({ bUid: tx.b_uid, cargo: tx.cargo });

  const receipt = await (await wm.receiveLot(
    BigInt(chainWarehouseId), productHash, qty, BigInt(Math.floor(expiryMs / 1000))
  )).wait();

  const lotEv = receipt.logs
    .map((l) => { try { return wm.interface.parseLog(l); } catch { return null; } })
    .find((e) => e?.name === 'LotReceived');
  const chainLotId = lotEv ? Number(lotEv.args.lotId ?? lotEv.args[0]) : null;

  await query(
    `INSERT INTO cargolink_warehouse_lots (b_uid, warehouse_id, chain_lot_id, quantity_kg, expiry_date, gate_in_tx)
     VALUES ($1, $2, $3, $4, to_timestamp($5), $6)`,
    [tx.b_uid, wh.rowId, chainLotId, qty.toString(), Math.floor(expiryMs / 1000), receipt.hash]
  );

  return {
    anchored: true, txHash: receipt.hash, contract: addresses.warehouseManager,
    chainWarehouseId, chainLotId, gasUsed: Number(receipt.gasUsed), mode: 'warehouse_receive',
  };
}

/** GATE_OUT → WarehouseManager.consumeLot + checkpoint de puerto. */
async function anchorGateOut(tx, payload, addresses) {
  const wm = getContract('WarehouseManager', addresses.warehouseManager);
  if (!wm) return { anchored: false, mode: 'no_contract' };

  const { rows } = await query(
    `SELECT id, chain_lot_id, quantity_kg FROM cargolink_warehouse_lots
      WHERE b_uid = $1 AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1`,
    [tx.b_uid]
  );
  if (rows.length === 0 || rows[0].chain_lot_id === null) {
    return { anchored: false, mode: 'no_active_lot' };
  }
  const lot = rows[0];

  const receipt = await (await wm.consumeLot(
    BigInt(lot.chain_lot_id), BigInt(lot.quantity_kg)
  )).wait();

  await query(
    `UPDATE cargolink_warehouse_lots SET status = 'CONSUMED', gate_out_tx = $1 WHERE id = $2`,
    [receipt.hash, lot.id]
  );

  return {
    anchored: true, txHash: receipt.hash, contract: addresses.warehouseManager,
    chainLotId: lot.chain_lot_id, gasUsed: Number(receipt.gasUsed), mode: 'warehouse_consume',
  };
}

/**
 * Cambio de custodia (TX006) → WarehouseManager.transferLot cuando el traspaso
 * es entre almacenes. Si el destino no es un almacén (un camión, un buque), no
 * hay contrato que lo represente: se registra off-chain con su hash y se ancla
 * como evidencia en el lote merkle, que para eso está.
 */
async function anchorCustodyTransfer(tx, { toWarehouseCode }, addresses) {
  if (!toWarehouseCode) return { anchored: false, mode: 'off_chain_custody' };

  const wm = getContract('WarehouseManager', addresses.warehouseManager);
  if (!wm) return { anchored: false, mode: 'no_contract' };

  const { rows: lots } = await query(
    `SELECT id, chain_lot_id FROM cargolink_warehouse_lots
      WHERE b_uid = $1 AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1`,
    [tx.b_uid]
  );
  if (lots.length === 0 || lots[0].chain_lot_id === null) return { anchored: false, mode: 'no_active_lot' };

  // El destino puede no haber recibido mercancía nunca, así que se registra
  // aquí si hace falta en vez de rechazar el traspaso.
  const dest = await ensureWarehouseOnChain(wm, toWarehouseCode);
  if (dest.id === null) return { anchored: false, mode: dest.mode || 'destination_unknown' };

  const receipt = await (await wm.transferLot(
    BigInt(lots[0].chain_lot_id), BigInt(dest.id)
  )).wait();

  const ev = receipt.logs
    .map((l) => { try { return wm.interface.parseLog(l); } catch { return null; } })
    .find((e) => e?.name === 'LotTransferred');

  return {
    anchored: true, txHash: receipt.hash, contract: addresses.warehouseManager,
    chainTransferId: ev ? Number(ev.args.transferId ?? ev.args[0]) : null,
    gasUsed: Number(receipt.gasUsed), mode: 'warehouse_transfer',
  };
}

/**
 * Inspección aduanera (TX010) → CustomsClearanceOracle.
 *
 * El contrato ya modelaba el flujo completo del Test 9 del análisis de
 * Algeciras (DECLARED → INSPECTION → HOLD → CLEARED) con
 * preClearanceValidation / approveClearanceByOfficer / rejectClearance, pero
 * sólo se estaba usando requestClearance. Aquí se cierra el circuito.
 *
 * Requiere que el envío tenga clearance abierta: sin `requestClearance`
 * previa el registro no existe y el contrato revierte. Por eso se comprueba
 * antes y se devuelve un motivo claro en vez de dejar que reviente.
 */
async function anchorInspection(tx, { riskScore, outcome, evidenceHash, chainStatus }) {
  const oracle = getContract('CustomsClearanceOracle', addressesOrNull()?.customsClearance);
  if (!oracle) return { anchored: false, mode: 'no_contract' };

  const shipmentId = await getChainShipmentId(tx.b_uid);
  if (shipmentId === null) return { anchored: false, mode: 'no_chain_shipment' };

  const hashes = [];
  try {
    // Estado actual en el contrato. Hay que consultarlo antes de actuar
    // porque cada función tiene su propia precondición y una segunda
    // inspección sobre el mismo envío ya no parte de PENDING.
    // No hay getter de estado suelto: viene en el campo 6 del registro.
    const details = await chainCall('CustomsClearanceOracle.getClearanceDetails',
    () => oracle.getClearanceDetails(shipmentId), null);
    const current = details ? Number(details.status ?? details[6]) : -1;
    const ST = { PENDING: 0, PRE_VALIDATED: 1, APPROVED: 2, REJECTED: 3, IN_CUSTOMS: 4, ESCALATED: 5 };

    // 1. Validación previa: sólo es válida desde PENDING (el contrato lo exige).
    //    En una segunda inspección el registro ya está pre-validado o escalado,
    //    así que se salta en vez de provocar un revert previsible.
    if (current === ST.PENDING) {
      const r1 = await (await oracle.preClearanceValidation(
        shipmentId, riskScore, outcome === 'PASSED' ? 'CLEAR' : outcome
      )).wait();
      hashes.push(r1.hash);
    }

    // 2. Resolución del oficial. Un HELD no resuelve nada a propósito: deja la
    //    mercancía retenida, que es justo el estado que hay que representar.
    if (outcome === 'PASSED') {
      // LIMITACIÓN DEL CONTRATO, no del servicio: approveClearanceByOfficer
      // sólo acepta PENDING o PRE_VALIDATED. Un envío ESCALATED no tiene
      // camino de vuelta a APPROVED — sólo puede rechazarse.
      //
      // En la operación real una escalada sí se resuelve: el inspector
      // escala, el operador aporta la documentación que falta y la mercancía
      // se despacha. Ese retorno no existe en CustomsClearanceOracle.
      //
      // Se declara en vez de fingir que se ancló: la base de datos dirá
      // APPROVED y la cadena seguirá en ESCALATED, y quien audite tiene que
      // poder ver esa divergencia.
      const post = hashes.length ? ST.PRE_VALIDATED : current;
      if (post === ST.ESCALATED) {
        return {
          anchored: false,
          mode: 'contract_cannot_approve_escalated',
          chainStatus: 'ESCALATED',
          chainShipmentId: shipmentId,
          txHashes: hashes,
          note: 'CustomsClearanceOracle.approveClearanceByOfficer no admite ESCALATED; '
              + 'el despacho consta en base de datos pero la cadena sigue escalada',
        };
      }
      const r2 = await (await oracle.approveClearanceByOfficer(shipmentId, evidenceHash)).wait();
      hashes.push(r2.hash);
    } else if (outcome === 'REJECTED') {
      const r2 = await (await oracle.rejectClearance(shipmentId, `INSPECTION:${chainStatus}`)).wait();
      hashes.push(r2.hash);
    }

    return {
      anchored: hashes.length > 0,
      txHash: hashes[hashes.length - 1] || null,
      txHashes: hashes,
      contract: addressesOrNull()?.customsClearance,
      chainShipmentId: shipmentId,
      mode: outcome === 'HELD' ? 'inspection_held' : 'inspection_resolved',
    };
  } catch (err) {
    return { anchored: false, mode: 'anchor_failed', error: err.message, txHashes: hashes };
  }
}

/** getAddresses() puede devolver null si el fichero de despliegue no se lee. */
function addressesOrNull() {
  try { return getAddresses(); } catch { return null; }
}

/**
 * Checkpoint declarado por un proveedor de tracking externo (DHL, un TOS
 * portuario, un operador de flota) → TrackingIntegrationGateway.
 *
 * Este contrato estaba escrito y probado (14 tests) y no lo llamaba nadie. Lo
 * que aporta frente a anclar el checkpoint sin más es la contabilidad por
 * proveedor: cada evento consume presupuesto mensual en BEZ, así que un
 * proveedor que inunde la red de eventos se queda sin cuota en vez de
 * encarecer la operación de todos.
 *
 * Las coordenadas van como enteros con 6 decimales fijos, que es lo que
 * espera el contrato: Solidity no tiene coma flotante y redondear a 6
 * decimales deja precisión de ~11 cm, de sobra para trazabilidad de carga.
 */
async function anchorProviderCheckpoint(shipmentId, {
  providerId, lat, lng, timestamp, statusCode, temperature, speed, locationName,
}) {
  const addrs = addressesOrNull();
  const gw = getContract('TrackingIntegrationGateway', addrs?.trackingGateway);
  if (!gw) return { anchored: false, mode: 'no_contract' };
  if (shipmentId === null || shipmentId === undefined) {
    return { anchored: false, mode: 'no_chain_shipment' };
  }

  const toFixed6 = (v) => (v === null || v === undefined || Number.isNaN(Number(v))
    ? 0n : BigInt(Math.round(Number(v) * 1e6)));

  try {
    const receipt = await (await gw.recordCheckpointViaAPI(
      BigInt(shipmentId),
      toFixed6(lat),
      toFixed6(lng),
      BigInt(Math.floor(new Date(timestamp || Date.now()).getTime() / 1000)),
      Number(statusCode ?? 0),
      // La temperatura también en enteros: décimas de grado, con signo.
      BigInt(Math.round(Number(temperature ?? 0) * 10)),
      BigInt(Math.round(Number(speed ?? 0))),
      String(locationName || '').slice(0, 64),
    )).wait();

    return {
      anchored: true, txHash: receipt.hash, gasUsed: Number(receipt.gasUsed),
      contract: addrs.trackingGateway, providerId, mode: 'provider_checkpoint',
    };
  } catch (err) {
    // El presupuesto agotado es un resultado legítimo del diseño, no un fallo
    // de la plataforma: conviene distinguirlo para que el operador sepa que
    // tiene que recargar en vez de buscar una avería.
    const budget = /budget|Budget/.test(err.message || '');
    return {
      anchored: false,
      mode: budget ? 'provider_budget_exhausted' : 'anchor_failed',
      error: err.message,
    };
  }
}

/**
 * Alta de un envío integrado: tracking + despacho en la MISMA transacción.
 *
 * Que vayan juntos no es comodidad. `createIntegratedShipment` arranca el
 * seguimiento y pide el despacho de aduanas de una vez, así que o quedan
 * ligados los dos o no queda ninguno. Hacerlo en dos llamadas deja abierta la
 * ventana a un envío que se rastrea pero que nadie ha declarado — el
 * expediente que luego aparece parado en el puerto sin que nadie sepa por qué.
 *
 * Y a continuación registra la ruta multipaís, que es lo que permite preguntar
 * a la cadena si la mercancía está libre en TODAS las jurisdicciones en vez de
 * fiarse de un campo marcado a mano.
 */
async function anchorIntegratedShipment(shipmentId, {
  trackingProvider, trackingRef, customsPlatform, hsCode, cargoValueCents, duaHash, countries,
}) {
  const addrs = addressesOrNull();
  const gw = getContract('TrackingToCustomsGateway', addrs?.transitGateway);
  if (!gw) return { anchored: false, mode: 'no_contract' };
  if (shipmentId === null || shipmentId === undefined) {
    return { anchored: false, mode: 'no_chain_shipment' };
  }

  const asBytes32 = (v) => ethers.keccak256(ethers.toUtf8Bytes(String(v ?? '')));

  try {
    const receipt = await (await gw.createIntegratedShipment(
      BigInt(shipmentId),
      asBytes32(trackingProvider),
      String(trackingRef || ''),
      String(customsPlatform || ''),
      asBytes32(hsCode),
      BigInt(cargoValueCents || 0),
      duaHash && /^0x[0-9a-fA-F]{64}$/.test(duaHash) ? duaHash : asBytes32(duaHash || ''),
    )).wait();

    let route = { anchored: false, mode: 'not_attempted' };
    if (Array.isArray(countries) && countries.length > 1) {
      try {
        const r2 = await (await gw.setupMultiCountryClearance(
          BigInt(shipmentId), countries.map(String),
        )).wait();
        route = { anchored: true, txHash: r2.hash, gasUsed: Number(r2.gasUsed) };
      } catch (err) {
        // La cabecera ya está anclada; la ruta se puede reintentar. Se
        // distingue para que no parezca que falló todo.
        route = { anchored: false, mode: 'route_failed', error: err.message };
      }
    }

    return {
      anchored: true, txHash: receipt.hash, gasUsed: Number(receipt.gasUsed),
      contract: addrs.transitGateway, mode: 'integrated_shipment', route,
    };
  } catch (err) {
    return { anchored: false, mode: 'anchor_failed', error: err.message };
  }
}

/**
 * Cierra el despacho de un país en la ruta.
 *
 * El contrato recorre la lista y decide él si quedan países pendientes. Ese
 * booleano es el que libera la mercancía, así que conviene que lo calcule
 * quien no tiene interés en el resultado.
 */
async function anchorCountryClearance(shipmentId, countryCode) {
  const addrs = addressesOrNull();
  const gw = getContract('TrackingToCustomsGateway', addrs?.transitGateway);
  if (!gw) return { anchored: false, mode: 'no_contract' };
  if (shipmentId === null || shipmentId === undefined) {
    return { anchored: false, mode: 'no_chain_shipment' };
  }
  try {
    const receipt = await (await gw.completeCountryClearance(
      BigInt(shipmentId), String(countryCode),
    )).wait();
    return {
      anchored: true, txHash: receipt.hash, gasUsed: Number(receipt.gasUsed),
      contract: addrs.transitGateway, mode: 'country_clearance', country: countryCode,
    };
  } catch (err) {
    return { anchored: false, mode: 'anchor_failed', error: err.message };
  }
}

async function anchorTransition(tx, toStatus, transitionPayload) {
  if (!isConfigured()) {
    return { anchored: false, mode: 'not_configured' };
  }

  const addresses = getAddresses();
  if (!addresses) return { anchored: false, mode: 'no_addresses' };

  // Eventos de evidencia: van a un lote merkle en vez de gastar una tx propia.
  // Medido: 199.676 gas por evento suelto frente a 6.251 dentro de un lote de
  // 19 hojas — 31,9x. Los eventos que mueven el escrow (CREATED, DELIVERED) NO
  // entran aquí: agruparlos probaría que ocurrieron, pero no cambiaría el
  // estado que el contrato de escrow lee para pagar. Ver cargoLinkBatcher.js.
  if (batcher.shouldBatch(toStatus)) {
    try {
      const queued = await batcher.enqueue({
        bUid: tx.b_uid,
        toStatus,
        actor: tx.owner_bezhas_id,
        payloadHash: contentHash(transitionPayload),
        occurredAt: new Date(),
      });
      await storeAnchorInTransition(tx.b_uid, toStatus, queued);
      return queued;
    } catch (err) {
      // Si la cola falla, se cae al anclaje individual: es más caro, pero
      // perder la evidencia sería peor que pagar el gas.
      logger.warn(`[CARGOLINK][BATCH] encolado falló, se ancla individualmente: ${err.message}`);
    }
  }

  let result;
  try {
    switch (toStatus) {
      case 'CREATED':
        result = await anchorCreated(tx, addresses);
        break;
      case 'GATE_IN':
        result = await anchorGateIn(tx, transitionPayload, addresses);
        break;
      case 'GATE_OUT':
        result = await anchorGateOut(tx, transitionPayload, addresses);
        break;
      case 'CUSTOMS_CLEARED':
        result = await anchorCustomsCleared(tx, transitionPayload, addresses);
        break;
      case 'STOWED':
        result = await anchorCheckpoint(tx, CP_TYPE.WAREHOUSE, transitionPayload, addresses);
        break;
      case 'DEPARTED':
        result = await anchorCheckpoint(tx, CP_TYPE.PORT, transitionPayload, addresses);
        break;
      case 'IN_TRANSIT':
        result = await anchorMarkInTransit(tx, addresses);
        break;
      case 'DELIVERED':
        result = await anchorDelivery(tx, addresses);
        break;
      default:
        return { anchored: false, mode: 'unknown_status' };
    }
  } catch (err) {
    result = { anchored: false, mode: 'anchor_failed', error: err.message };
  }

  try {
    await storeAnchorInTransition(tx.b_uid, toStatus, result);
  } catch {
    // Storing the anchor record is best-effort; don't mask the real result.
  }

  return result;
}

module.exports = {
  isConfigured,
  anchorTransition,
  anchorCustodyTransfer,
  anchorInspection,
  anchorProviderCheckpoint,
  anchorIntegratedShipment,
  anchorCountryClearance,
  // Expuesto para que cargoLinkBatcher use EL MISMO NonceManager: dos
  // instancias sobre la misma cuenta se pisan el nonce.
  getSigner,
  getChainShipmentId,
  getAddresses,
  CP_TYPE,
};
