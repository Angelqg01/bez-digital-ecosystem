/**
 * BeZhas SDK — BridgeManager
 * Gestión unificada de los tres bridges cross-chain.
 *
 * Bridges cubiertos:
 *   BeZhasL1Bridge.sol     → Ethereum ↔ L2 BeZhas
 *   BeZhasBridgeL2.sol     → L2 BeZhas ↔ BNB Chain
 *   BEZPolygonBridge.sol   → Polygon ↔ L2 BeZhas
 *
 * Rutas soportadas:
 *   Polygon (137)  ↔  L2 BeZhas (31337)
 *   BNB Chain (56) ↔  L2 BeZhas (31337)
 *   Ethereum (1)   ↔  L2 BeZhas (31337)
 */

'use strict';

const { ethers } = require('ethers');

const BRIDGE_ABI = [
  // Deposit / Withdraw (estandarizado entre los 3 bridges)
  'function depositBEZ(uint256 amount, address recipient) payable external',
  'function withdrawBEZ(bytes32 txHash, uint256 amount, address recipient) external',
  'function bridgeFee() view returns (uint256)',
  'function minBridgeAmount() view returns (uint256)',
  'function maxBridgeAmount() view returns (uint256)',
  'function totalBridged() view returns (uint256)',
  'function isPaused() view returns (bool)',
  'event BEZDeposited(address indexed from, address indexed recipient, uint256 amount, bytes32 indexed depositId)',
  'event BEZWithdrawn(address indexed recipient, uint256 amount, bytes32 indexed txHash)',
  'event BridgePaused(address indexed by)',
  'event BridgeResumed(address indexed by)',
];

// Rutas bridge → nombre de cadena
const BRIDGE_ROUTES = [
  {
    id:      'polygon-l2',
    name:    'Polygon → L2 BeZhas',
    from:    { chainId: 137,   name: 'Polygon',   token: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' },
    to:      { chainId: 31337, name: 'L2 BeZhas' },
    contract:'BEZPolygonBridge',
    envKey:  'POLYGON_BRIDGE_ADDRESS',
    avgTime: '~5 min',
    fee:     '0.1%',
  },
  {
    id:      'bnb-l2',
    name:    'BNB Chain → L2 BeZhas',
    from:    { chainId: 56,    name: 'BNB Chain', token: '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55' },
    to:      { chainId: 31337, name: 'L2 BeZhas' },
    contract:'BeZhasBridgeL2',
    envKey:  'BNB_BRIDGE_ADDRESS',
    avgTime: '~3 min',
    fee:     '0.1%',
  },
  {
    id:      'eth-l2',
    name:    'Ethereum → L2 BeZhas',
    from:    { chainId: 1,     name: 'Ethereum' },
    to:      { chainId: 31337, name: 'L2 BeZhas' },
    contract:'BeZhasL1Bridge',
    envKey:  'ETH_BRIDGE_ADDRESS',
    avgTime: '~15 min (L1 finality)',
    fee:     '0.2%',
  },
];

class BridgeManager {
  constructor(providers = {}, signers = {}, addresses = {}) {
    this.providers = providers;  // { 137: provider, 56: provider, ... }
    this.signers   = signers;    // { 137: signer, ... }
    this.addresses = addresses;  // { 'polygon-l2': '0x...', ... }
    this._bridges  = {};
    this._txHistory = [];
  }

  static async create(config = {}) {
    const mgr = new BridgeManager(
      config.providers || {},
      config.signers   || {},
      config.addresses || {},
    );
    await mgr._initBridges();
    return mgr;
  }

  async _initBridges() {
    for (const route of BRIDGE_ROUTES) {
      const addr = this.addresses[route.id] || process.env[route.envKey];
      if (!addr) continue;

      const chainId  = route.from.chainId;
      const provider = this.providers[chainId];
      const signer   = this.signers[chainId];
      if (!provider) continue;

      this._bridges[route.id] = new ethers.Contract(addr, BRIDGE_ABI, signer || provider);
      console.log(`[BridgeManager] 🌉 ${route.name}: ${addr}`);
    }
  }

  // ─── INFORMACIÓN DE RUTAS ─────────────────────────────────────────────────

  getRoutes() { return BRIDGE_ROUTES; }

  async getRouteStats(routeId) {
    const bridge = this._bridges[routeId];
    const route  = BRIDGE_ROUTES.find(r => r.id === routeId);
    if (!bridge || !route) return { ...route, available: false };

    const [fee, minAmt, maxAmt, total, paused] = await Promise.allSettled([
      bridge.bridgeFee(),
      bridge.minBridgeAmount(),
      bridge.maxBridgeAmount(),
      bridge.totalBridged(),
      bridge.isPaused(),
    ]);

    return {
      ...route,
      available:    !this._valOrDefault(paused, true),
      feeRaw:       this._valOrDefault(fee, 0n),
      feePercent:   (Number(this._valOrDefault(fee, 0n)) / 100).toFixed(2),
      minAmount:    ethers.formatEther(this._valOrDefault(minAmt, 0n)),
      maxAmount:    ethers.formatEther(this._valOrDefault(maxAmt, ethers.parseEther('1000000'))),
      totalBridged: ethers.formatEther(this._valOrDefault(total, 0n)),
    };
  }

  async getAllRoutesStats() {
    return Promise.all(BRIDGE_ROUTES.map(r => this.getRouteStats(r.id)));
  }

  // ─── BRIDGE DEPOSIT ───────────────────────────────────────────────────────

  /**
   * Inicia un bridge de BEZ desde la cadena origen al destino.
   * @param {string} routeId   — 'polygon-l2' | 'bnb-l2' | 'eth-l2'
   * @param {string} amount    — cantidad en BEZ (como string)
   * @param {string} recipient — dirección destino en la cadena L2
   * @returns {object}  { depositId, txHash, amount, route, timestamp }
   */
  async bridgeDeposit(routeId, amount, recipient) {
    const bridge = this._bridges[routeId];
    const route  = BRIDGE_ROUTES.find(r => r.id === routeId);

    if (!bridge) throw new Error(`Bridge no disponible: ${routeId}`);
    if (!route)  throw new Error(`Ruta desconocida: ${routeId}`);

    const paused = await bridge.isPaused().catch(() => false);
    if (paused)  throw new Error(`Bridge ${routeId} está pausado`);

    const stats = await this.getRouteStats(routeId);
    const amtBN = ethers.parseEther(String(amount));

    if (amtBN < ethers.parseEther(stats.minAmount)) {
      throw new Error(`Mínimo: ${stats.minAmount} BEZ`);
    }
    if (amtBN > ethers.parseEther(stats.maxAmount)) {
      throw new Error(`Máximo: ${stats.maxAmount} BEZ`);
    }

    console.log(`[BridgeManager] 🌉 Iniciando bridge: ${amount} BEZ via ${route.name}`);

    const tx      = await bridge.depositBEZ(amtBN, recipient);
    const receipt = await tx.wait();

    // Extraer depositId del log
    const log       = receipt.logs.find(l => l.topics[0] === bridge.interface.getEvent('BEZDeposited').topicHash);
    const depositId = log?.topics[3] || ethers.id(`${tx.hash}:${Date.now()}`);

    const record = {
      depositId,
      txHash:    receipt.hash,
      routeId,
      route:     route.name,
      amount:    String(amount),
      recipient,
      timestamp: new Date().toISOString(),
      status:    'pending', // pending → confirmed → finalized
    };

    this._txHistory.unshift(record);
    return record;
  }

  // ─── HISTORIAL ────────────────────────────────────────────────────────────

  getTxHistory(limit = 50) {
    return this._txHistory.slice(0, limit);
  }

  // ─── ESTIMACIÓN DE FEE ────────────────────────────────────────────────────

  async estimateBridgeFee(routeId, amount) {
    const stats = await this.getRouteStats(routeId);
    const fee   = parseFloat(stats.feePercent || '0.1');
    const amtN  = parseFloat(amount);
    return {
      feePercent:  fee,
      feeAmount:   (amtN * fee / 100).toFixed(6),
      netAmount:   (amtN - amtN * fee / 100).toFixed(6),
      currency:    'BEZ',
      estimatedTime: BRIDGE_ROUTES.find(r => r.id === routeId)?.avgTime || '—',
    };
  }

  // ─── INTERNALS ────────────────────────────────────────────────────────────

  _valOrDefault(settled, def) {
    return settled.status === 'fulfilled' ? settled.value : def;
  }
}

module.exports = BridgeManager;
module.exports.BRIDGE_ROUTES = BRIDGE_ROUTES;
