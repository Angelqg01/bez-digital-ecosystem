/**
 * BeZhas Agent Runtime — TokenomicsConnector
 * Lee el estado on-chain de todos los contratos tokenómicos en tiempo real.
 * Alimenta al TokenomicsAgent con datos frescos del ecosistema BEZ.
 *
 * Monitorea:
 *   BEZCoinV2 → supply, transfers grandes
 *   StakingPool → APY, total staked, eventos
 *   LiquidityFarming → TVL por pool, rewards emitidos
 *   ValidatorRegistry → validators activos, slashing
 *   EdgeNodeRewards → nodos activos, rewards
 *   GovernanceSystem → propuestas, votos
 *   BeZhasPayment → volumen, fees
 *   BEZPolygonBridge + BeZhasBridgeL2 → flujos cross-chain
 */

'use strict';

const EventEmitter = require('events');
const { ethers }   = require('ethers');

// Umbral para "transferencia grande" (alerta automática)
const LARGE_TRANSFER_THRESHOLD = ethers.parseEther('100000'); // 100K BEZ

const MINIMAL_ABIS = {
  bez: [
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  ],
  staking: [
    'function getTotalStaked() view returns (uint256)',
    'function currentAPY() view returns (uint256)',
    'function currentEpoch() view returns (uint256)',
    'event Staked(address indexed user, uint256 amount, uint256 epoch)',
    'event Unstaked(address indexed user, uint256 amount)',
    'event RewardsClaimed(address indexed user, uint256 amount)',
  ],
  farming: [
    'function bezPerBlock() view returns (uint256)',
    'event Deposit(address indexed user, uint256 indexed pid, uint256 amount)',
    'event Harvest(address indexed user, uint256 indexed pid, uint256 amount)',
  ],
  validators: [
    'function totalValidators() view returns (uint256)',
    'event ValidatorRegistered(address indexed validator, uint256 stake)',
    'event ValidatorSlashed(address indexed validator, uint256 amount)',
  ],
  slashing: [
    'function totalSlashed() view returns (uint256)',
    'event Slashed(address indexed validator, uint256 amount, string reason)',
  ],
  bridge: [
    'function totalBridged() view returns (uint256)',
    'event BEZDeposited(address indexed from, address indexed recipient, uint256 amount, bytes32 indexed depositId)',
    'event BEZWithdrawn(address indexed recipient, uint256 amount, bytes32 indexed txHash)',
  ],
  payments: [
    'function totalVolume() view returns (uint256)',
    'function transactionCount() view returns (uint256)',
    'event PaymentProcessed(address indexed payer, address indexed recipient, uint256 amount, uint256 fee)',
  ],
};

class TokenomicsConnector extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      rpcUrl:           config.rpcUrl           || process.env.RPC_URL || 'http://localhost:8545',
      wsUrl:            config.wsUrl            || process.env.WS_URL  || 'ws://localhost:8545',
      bezAddress:       config.bezAddress       || process.env.BEZ_TOKEN_ADDRESS,
      stakingAddress:   config.stakingAddress   || process.env.STAKING_POOL_ADDRESS,
      farmingAddress:   config.farmingAddress   || process.env.FARMING_POOL_ADDRESS,
      validatorsAddress:config.validatorsAddress|| process.env.VALIDATOR_REGISTRY_ADDRESS,
      slashingAddress:  config.slashingAddress  || process.env.SLASHING_MANAGER_ADDRESS,
      paymentsAddress:  config.paymentsAddress  || process.env.PAYMENTS_ADDRESS,
      polygonBridge:    config.polygonBridge    || process.env.POLYGON_BRIDGE_ADDRESS,
      bnbBridge:        config.bnbBridge        || process.env.BNB_BRIDGE_ADDRESS,
      snapshotIntervalMs: config.snapshotIntervalMs || 60_000, // snapshot cada 60s
      ...config,
    };

    this.provider    = null;
    this._contracts  = {};
    this._listeners  = [];
    this._running    = false;
    this._snapshotTimer = null;

    // Estado en memoria del ecosistema (actualizado continuamente)
    this._state = {
      supply:          null,
      staking:         null,
      farming:         null,
      validators:      null,
      bridge:          null,
      payments:        null,
      lastSnapshot:    null,
      recentEvents:    [],   // últimos 100 eventos tokenómicos
    };
  }

  // ─── CICLO DE VIDA ────────────────────────────────────────────────────────

  async connect() {
    if (!this._hasConfiguredContracts()) {
      this._running = true;
      this._state.lastSnapshot = new Date().toISOString();
      console.log('[TokenomicsConnector] 📊 Sin contratos configurados; monitor tokenomics en modo idle');
      return;
    }

    try {
      this.provider = new ethers.WebSocketProvider(this.config.wsUrl);
      this._attachProviderErrorHandlers();
    } catch {
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      console.warn('[TokenomicsConnector] ⚠️  Usando HTTP (sin eventos en tiempo real)');
    }

    this._initContracts();
    this._subscribeEvents();

    // Snapshot inicial
    await this.takeSnapshot();

    // Snapshots periódicos
    this._snapshotTimer = setInterval(() => this.takeSnapshot(), this.config.snapshotIntervalMs);

    this._running = true;
    console.log('[TokenomicsConnector] 📊 Tokenomics monitor activo');
  }

  async disconnect() {
    this._running = false;
    clearInterval(this._snapshotTimer);
    for (const { contract, event, handler } of this._listeners) {
      contract.off(event, handler);
    }
    this._listeners = [];
    if (this.provider?.destroy) await this.provider.destroy();
  }

  // ─── SNAPSHOT COMPLETO ────────────────────────────────────────────────────

  async takeSnapshot() {
    const prev = { ...this._state };

    const [supply, staking, validators, payments] = await Promise.allSettled([
      this._readSupply(),
      this._readStaking(),
      this._readValidators(),
      this._readPayments(),
    ]);

    this._state.supply     = supply.status     === 'fulfilled' ? supply.value     : prev.supply;
    this._state.staking    = staking.status    === 'fulfilled' ? staking.value    : prev.staking;
    this._state.validators = validators.status === 'fulfilled' ? validators.value : prev.validators;
    this._state.payments   = payments.status   === 'fulfilled' ? payments.value   : prev.payments;
    this._state.lastSnapshot = new Date().toISOString();

    this.emit('snapshot', this._state);

    // Detectar cambios significativos
    this._detectAnomalies(prev, this._state);

    return this._state;
  }

  // ─── LECTURAS ON-CHAIN ────────────────────────────────────────────────────

  async _readSupply() {
    const bez = this._contracts.bez;
    if (!bez) return null;

    const total = await bez.totalSupply();
    const staked = this._contracts.staking
      ? await this._contracts.staking.getTotalStaked().catch(() => 0n)
      : 0n;

    return {
      total:          ethers.formatEther(total),
      staked:         ethers.formatEther(staked),
      circulating:    ethers.formatEther(total - staked),
      stakedPercent:  total > 0n ? ((Number(staked) / Number(total)) * 100).toFixed(2) : '0',
    };
  }

  async _readStaking() {
    const s = this._contracts.staking;
    if (!s) return null;

    const [totalStaked, apy, epoch] = await Promise.allSettled([
      s.getTotalStaked(),
      s.currentAPY(),
      s.currentEpoch(),
    ]);

    return {
      totalStaked: totalStaked.status === 'fulfilled' ? ethers.formatEther(totalStaked.value) : '0',
      apy:         apy.status         === 'fulfilled' ? Number(apy.value) / 100             : 0,
      epoch:       epoch.status       === 'fulfilled' ? Number(epoch.value)                  : 0,
    };
  }

  async _readValidators() {
    const v = this._contracts.validators;
    const s = this._contracts.slashing;
    if (!v) return null;

    const [total, totalSlashed] = await Promise.allSettled([
      v.totalValidators(),
      s?.totalSlashed() || Promise.resolve(0n),
    ]);

    return {
      total:        total.status        === 'fulfilled' ? Number(total.value)                        : 0,
      totalSlashed: totalSlashed.status === 'fulfilled' ? ethers.formatEther(totalSlashed.value)    : '0',
    };
  }

  async _readPayments() {
    const p = this._contracts.payments;
    if (!p) return null;

    const [vol, count] = await Promise.allSettled([
      p.totalVolume(),
      p.transactionCount(),
    ]);

    return {
      totalVolume: vol.status   === 'fulfilled' ? ethers.formatEther(vol.value)  : '0',
      txCount:     count.status === 'fulfilled' ? Number(count.value)            : 0,
    };
  }

  // ─── SUSCRIPCIÓN A EVENTOS ────────────────────────────────────────────────

  _subscribeEvents() {
    const { bez, staking, validators, slashing, payments, polygonBridge, bnbBridge } = this._contracts;

    // BEZ Token — transfers grandes
    if (bez) {
      this._on(bez, 'Transfer', (from, to, value) => {
        if (value >= LARGE_TRANSFER_THRESHOLD) {
          const evt = {
            type:      'large_transfer',
            severity:  value >= ethers.parseEther('1000000') ? 'high' : 'medium',
            from, to,
            amount:    ethers.formatEther(value),
            timestamp: new Date().toISOString(),
          };
          this._addEvent(evt);
          this.emit('large:transfer', evt);
        }
      });
    }

    // Staking events
    if (staking) {
      this._on(staking, 'Staked', (user, amount, epoch) => {
        this._addEvent({ type: 'staked', user, amount: ethers.formatEther(amount), epoch: Number(epoch), timestamp: new Date().toISOString() });
        this.emit('staking:staked', { user, amount: ethers.formatEther(amount), epoch: Number(epoch) });
      });

      this._on(staking, 'Unstaked', (user, amount) => {
        this._addEvent({ type: 'unstaked', user, amount: ethers.formatEther(amount), timestamp: new Date().toISOString() });
        this.emit('staking:unstaked', { user, amount: ethers.formatEther(amount) });
      });

      this._on(staking, 'RewardsClaimed', (user, amount) => {
        const amtFmt = ethers.formatEther(amount);
        this._addEvent({ type: 'rewards_claimed', user, amount: amtFmt, timestamp: new Date().toISOString() });
        this.emit('staking:rewards', { user, amount: amtFmt });
      });
    }

    // Slashing — crítico
    if (slashing) {
      this._on(slashing, 'Slashed', (validator, amount, reason) => {
        const evt = {
          type:      'slashing',
          severity:  'critical',
          validator,
          amount:    ethers.formatEther(amount),
          reason,
          timestamp: new Date().toISOString(),
        };
        this._addEvent(evt);
        this.emit('validator:slashed', evt);
        console.warn(`[TokenomicsConnector] ⚠️  SLASHING: ${validator} → ${ethers.formatEther(amount)} BEZ — ${reason}`);
      });
    }

    // Bridge deposits (flujos cross-chain)
    for (const [name, bridge] of [['polygon', polygonBridge], ['bnb', bnbBridge]]) {
      if (!bridge) continue;
      this._on(bridge, 'BEZDeposited', (from, recipient, amount, depositId) => {
        const evt = {
          type:      'bridge_deposit',
          bridge:    name,
          from, recipient,
          amount:    ethers.formatEther(amount),
          depositId: depositId.toString(),
          timestamp: new Date().toISOString(),
        };
        this._addEvent(evt);
        this.emit('bridge:deposit', evt);
      });
    }

    // Payments
    if (payments) {
      this._on(payments, 'PaymentProcessed', (payer, recipient, amount, fee) => {
        this._addEvent({
          type: 'payment', payer, recipient,
          amount: ethers.formatEther(amount),
          fee:    ethers.formatEther(fee),
          timestamp: new Date().toISOString(),
        });
      });
    }
  }

  // ─── DETECCIÓN DE ANOMALÍAS TOKENÓMICAS ──────────────────────────────────

  _detectAnomalies(prev, current) {
    if (!prev.staking || !current.staking) return;

    // Caída brusca de staking (>5% en un snapshot)
    const prevStaked    = parseFloat(prev.staking?.totalStaked || '0');
    const currentStaked = parseFloat(current.staking?.totalStaked || '0');

    if (prevStaked > 0 && currentStaked > 0) {
      const delta = ((currentStaked - prevStaked) / prevStaked) * 100;
      if (delta < -5) {
        const anomaly = {
          type:      'staking_drop',
          severity:  delta < -15 ? 'critical' : 'high',
          delta:     delta.toFixed(2),
          prev:      prevStaked.toFixed(0),
          current:   currentStaked.toFixed(0),
          timestamp: new Date().toISOString(),
        };
        this.emit('anomaly:detected', anomaly);
        console.warn(`[TokenomicsConnector] 🚨 Anomalía tokenómica: Staking cayó ${delta.toFixed(2)}%`);
      }

      // Subida de APY anormal (>50% instantáneo = posible exploit)
      const prevAPY    = prev.staking?.apy    || 0;
      const currentAPY = current.staking?.apy || 0;
      if (prevAPY > 0 && currentAPY > prevAPY * 2) {
        const anomaly = {
          type:     'apy_spike',
          severity: 'high',
          prevAPY, currentAPY,
          timestamp: new Date().toISOString(),
        };
        this.emit('anomaly:detected', anomaly);
      }
    }
  }

  // ─── API PÚBLICA ──────────────────────────────────────────────────────────

  getState()              { return this._state; }
  getRecentEvents(n = 20) { return this._state.recentEvents.slice(0, n); }

  async healthCheck() {
    const block = await this.provider?.getBlockNumber().catch(() => null);
    return {
      status:      this._running ? 'running' : 'stopped',
      latestBlock: block,
      contracts:   Object.keys(this._contracts),
      lastSnapshot:this._state.lastSnapshot,
    };
  }

  // ─── INTERNALS ────────────────────────────────────────────────────────────

  _initContracts() {
    const p = this.provider;
    const c = this.config;

    if (c.bezAddress)        this._contracts.bez          = new ethers.Contract(c.bezAddress,        MINIMAL_ABIS.bez,        p);
    if (c.stakingAddress)    this._contracts.staking      = new ethers.Contract(c.stakingAddress,    MINIMAL_ABIS.staking,    p);
    if (c.farmingAddress)    this._contracts.farming      = new ethers.Contract(c.farmingAddress,    MINIMAL_ABIS.farming,    p);
    if (c.validatorsAddress) this._contracts.validators   = new ethers.Contract(c.validatorsAddress, MINIMAL_ABIS.validators, p);
    if (c.slashingAddress)   this._contracts.slashing     = new ethers.Contract(c.slashingAddress,   MINIMAL_ABIS.slashing,   p);
    if (c.paymentsAddress)   this._contracts.payments     = new ethers.Contract(c.paymentsAddress,   MINIMAL_ABIS.payments,   p);
    if (c.polygonBridge)     this._contracts.polygonBridge= new ethers.Contract(c.polygonBridge,     MINIMAL_ABIS.bridge,     p);
    if (c.bnbBridge)         this._contracts.bnbBridge    = new ethers.Contract(c.bnbBridge,         MINIMAL_ABIS.bridge,     p);
  }

  _hasConfiguredContracts() {
    return Boolean(
      this.config.bezAddress ||
      this.config.stakingAddress ||
      this.config.farmingAddress ||
      this.config.validatorsAddress ||
      this.config.slashingAddress ||
      this.config.paymentsAddress ||
      this.config.polygonBridge ||
      this.config.bnbBridge
    );
  }

  _attachProviderErrorHandlers() {
    const sockets = [
      this.provider?.websocket,
      this.provider?._websocket,
      this.provider?._socket,
    ].filter(Boolean);

    for (const socket of sockets) {
      if (typeof socket.on === 'function') {
        socket.on('error', (err) => {
          console.warn('[TokenomicsConnector] WebSocket error:', err.message);
        });
        socket.on('close', () => {
          if (this._running) console.warn('[TokenomicsConnector] WebSocket cerrado');
        });
      }
    }

    if (typeof this.provider?.on === 'function') {
      try {
        this.provider.on('error', (err) => {
          console.warn('[TokenomicsConnector] Provider error:', err.message);
        });
      } catch {
        // Some ethers providers do not expose generic error events.
      }
    }
  }

  _on(contract, event, handler) {
    contract.on(event, handler);
    this._listeners.push({ contract, event, handler });
  }

  _addEvent(evt) {
    this._state.recentEvents.unshift(evt);
    if (this._state.recentEvents.length > 100) {
      this._state.recentEvents = this._state.recentEvents.slice(0, 100);
    }
  }
}

module.exports = TokenomicsConnector;
