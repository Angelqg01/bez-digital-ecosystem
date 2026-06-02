/**
 * BeZhas SDK — TokenomicsEngine
 * Motor tokenómico unificado. Agrega staking.js + farming.js +
 * governance.js + payments.js en una API única y coherente.
 *
 * Contratos cubiertos:
 *   BEZCoinV2, StakingPool, LiquidityFarming, GovernanceSystem,
 *   BeZhasPayment, QualityEscrow, EdgeNodeRewards, ValidatorRegistry,
 *   SlashingManager, WrappedBEZ
 *
 * Redes soportadas:
 *   Polygon (137) | BNB Chain (56) | BeZhas L2 (31337/local)
 */

'use strict';

const { ethers } = require('ethers');

// ─── ABIs mínimas de los contratos tokenómicos ─────────────────────────────

const BEZ_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

const STAKING_ABI = [
  'function stake(uint256 amount) external',
  'function unstake(uint256 amount) external',
  'function claimRewards() external',
  'function getStakeInfo(address user) view returns (uint256 staked, uint256 rewards, uint256 unlockTime)',
  'function getTotalStaked() view returns (uint256)',
  'function currentAPY() view returns (uint256)',
  'function epochDuration() view returns (uint256)',
  'function currentEpoch() view returns (uint256)',
  'function minStakeAmount() view returns (uint256)',
  'function cooldownPeriod() view returns (uint256)',
  'event Staked(address indexed user, uint256 amount, uint256 epoch)',
  'event Unstaked(address indexed user, uint256 amount)',
  'event RewardsClaimed(address indexed user, uint256 amount)',
];

const FARMING_ABI = [
  'function deposit(uint256 poolId, uint256 amount) external',
  'function withdraw(uint256 poolId, uint256 amount) external',
  'function harvest(uint256 poolId) external',
  'function poolLength() view returns (uint256)',
  'function poolInfo(uint256 pid) view returns (address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accBezPerShare)',
  'function userInfo(uint256 pid, address user) view returns (uint256 amount, uint256 rewardDebt)',
  'function pendingBez(uint256 pid, address user) view returns (uint256)',
  'function totalAllocPoint() view returns (uint256)',
  'function bezPerBlock() view returns (uint256)',
  'event Deposit(address indexed user, uint256 indexed pid, uint256 amount)',
  'event Withdraw(address indexed user, uint256 indexed pid, uint256 amount)',
  'event Harvest(address indexed user, uint256 indexed pid, uint256 amount)',
];

const GOVERNANCE_ABI = [
  'function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)',
  'function castVote(uint256 proposalId, uint8 support) returns (uint256)',
  'function getVotes(address account, uint256 blockNumber) view returns (uint256)',
  'function proposalSnapshot(uint256 proposalId) view returns (uint256)',
  'function proposalDeadline(uint256 proposalId) view returns (uint256)',
  'function state(uint256 proposalId) view returns (uint8)',
  'function quorumNumerator() view returns (uint256)',
  'event ProposalCreated(uint256 proposalId, address proposer, string description)',
  'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight)',
];

const PAYMENT_ABI = [
  'function payWithBEZ(address recipient, uint256 amount, bytes calldata data) external',
  'function getTransactionFee() view returns (uint256)',
  'function feeRecipient() view returns (address)',
  'function totalVolume() view returns (uint256)',
  'function transactionCount() view returns (uint256)',
  'event PaymentProcessed(address indexed payer, address indexed recipient, uint256 amount, uint256 fee)',
];

const EDGE_NODE_ABI = [
  'function registerNode(bytes32 nodeId) external',
  'function claimNodeRewards(bytes32 nodeId) external',
  'function getNodeRewards(bytes32 nodeId) view returns (uint256)',
  'function totalActiveNodes() view returns (uint256)',
  'function rewardPerNode() view returns (uint256)',
  'event NodeRegistered(bytes32 indexed nodeId, address indexed operator)',
  'event RewardsClaimed(bytes32 indexed nodeId, uint256 amount)',
];

const VALIDATOR_ABI = [
  'function registerValidator(uint256 stakeAmount) external',
  'function totalValidators() view returns (uint256)',
  'function minValidatorStake() view returns (uint256)',
  'function getValidatorInfo(address validator) view returns (uint256 stake, bool active, uint256 slashCount)',
  'event ValidatorRegistered(address indexed validator, uint256 stake)',
  'event ValidatorSlashed(address indexed validator, uint256 amount)',
];

const SLASHING_ABI = [
  'function totalSlashed() view returns (uint256)',
  'function getSlashHistory(address validator) view returns (uint256 count, uint256 totalAmount)',
  'event Slashed(address indexed validator, uint256 amount, string reason)',
];

const QUALITY_ESCROW_ABI = [
  'function createEscrow(address counterparty, uint256 amount, bytes32 conditionHash) returns (bytes32)',
  'function releaseEscrow(bytes32 escrowId) external',
  'function totalEscrowed() view returns (uint256)',
  'function activeEscrows() view returns (uint256)',
  'event EscrowCreated(bytes32 indexed escrowId, address indexed creator, uint256 amount)',
  'event EscrowReleased(bytes32 indexed escrowId, bool success)',
];

// ─── Direcciones canónicas ─────────────────────────────────────────────────

const ADDRESSES = {
  137: { // Polygon Mainnet
    bezToken:     '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    treasury:     '0x89c23890c742d710265dD61be789C71dC8999b12',
    qualityEscrow:'0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
    hotWallet:    '0x52Df82920CBAE522880dD7657e43d1A754eD044E',
  },
  56: { // BNB Chain
    bezToken:     '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55',
  },
  31337: { // Local / L2 BeZhas
    // Cargados desde deployments/31337.json
  },
};

// ─── Pool definitions (BEZ Farming) ────────────────────────────────────────

const FARMING_POOLS = [
  { id: 0, name: 'BEZ/USDT', pair: 'BEZ-USDT', chain: 'Polygon', weight: 30 },
  { id: 1, name: 'BEZ/BNB',  pair: 'BEZ-BNB',  chain: 'BNB Chain', weight: 25 },
  { id: 2, name: 'BEZ/ETH',  pair: 'BEZ-ETH',  chain: 'Polygon', weight: 20 },
  { id: 3, name: 'BEZ/MATIC',pair: 'BEZ-MATIC',chain: 'Polygon', weight: 15 },
  { id: 4, name: 'BEZ/USDC', pair: 'BEZ-USDC', chain: 'Polygon', weight: 10 },
];

// ─── TokenomicsEngine ──────────────────────────────────────────────────────

class TokenomicsEngine {
  /**
   * @param {object} config
   * @param {ethers.Provider} config.provider  — provider principal
   * @param {ethers.Signer}   config.signer    — signer (opcional, para transacciones)
   * @param {number}          config.chainId   — 137 | 56 | 31337
   * @param {object}          config.addresses — override de direcciones
   */
  constructor(config = {}) {
    this.provider  = config.provider;
    this.signer    = config.signer;
    this.chainId   = config.chainId || 137;
    this.addresses = { ...ADDRESSES[this.chainId], ...config.addresses };
    this._contracts = {};
    this._cache     = new Map();
    this._cacheTTL  = 15_000; // 15s
  }

  // ─── INICIALIZACIÓN ───────────────────────────────────────────────────────

  static async create(rpcUrl, privateKey = null, chainId = 137, extraAddresses = {}) {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer   = privateKey
      ? new ethers.Wallet(privateKey, provider)
      : null;

    const engine = new TokenomicsEngine({
      provider, signer, chainId,
      addresses: { ...ADDRESSES[chainId], ...extraAddresses },
    });

    await engine._initContracts();
    return engine;
  }

  async _initContracts() {
    const sp = this.signer || this.provider;
    const a  = this.addresses;

    if (a.bezToken)      this._contracts.bez       = new ethers.Contract(a.bezToken,       BEZ_ABI,       sp);
    if (a.stakingPool)   this._contracts.staking   = new ethers.Contract(a.stakingPool,    STAKING_ABI,   sp);
    if (a.farmingPool)   this._contracts.farming   = new ethers.Contract(a.farmingPool,    FARMING_ABI,   sp);
    if (a.governance)    this._contracts.gov       = new ethers.Contract(a.governance,     GOVERNANCE_ABI,sp);
    if (a.payments)      this._contracts.payments  = new ethers.Contract(a.payments,       PAYMENT_ABI,   sp);
    if (a.edgeRewards)   this._contracts.edge      = new ethers.Contract(a.edgeRewards,    EDGE_NODE_ABI, sp);
    if (a.validators)    this._contracts.validators= new ethers.Contract(a.validators,     VALIDATOR_ABI, sp);
    if (a.slashing)      this._contracts.slashing  = new ethers.Contract(a.slashing,       SLASHING_ABI,  sp);
    if (a.qualityEscrow) this._contracts.escrow    = new ethers.Contract(a.qualityEscrow,  QUALITY_ESCROW_ABI, sp);
  }

  // ─── BEZ TOKEN ────────────────────────────────────────────────────────────

  async getBEZSupply() {
    return this._cached('bez:supply', async () => {
      const bez = this._contracts.bez;
      if (!bez) return null;
      const [total, decimals] = await Promise.all([bez.totalSupply(), bez.decimals()]);
      return {
        total:       ethers.formatUnits(total, decimals),
        totalRaw:    total.toString(),
        decimals:    Number(decimals),
        symbol:      'BEZ',
        chainId:     this.chainId,
        address:     this.addresses.bezToken,
      };
    });
  }

  async getBEZBalance(address) {
    const bez = this._contracts.bez;
    if (!bez) return '0';
    const [bal, dec] = await Promise.all([bez.balanceOf(address), bez.decimals()]);
    return ethers.formatUnits(bal, dec);
  }

  async approveBEZ(spender, amount) {
    this._requireSigner();
    const dec = await this._contracts.bez.decimals();
    const tx  = await this._contracts.bez.approve(spender, ethers.parseUnits(String(amount), dec));
    return tx.wait();
  }

  // ─── STAKING ──────────────────────────────────────────────────────────────

  async getStakingStats() {
    return this._cached('staking:stats', async () => {
      const s = this._contracts.staking;
      if (!s) return this._mockStakingStats();

      const [totalStaked, apy, epoch, epochDur, minStake, cooldown] = await Promise.allSettled([
        s.getTotalStaked(),
        s.currentAPY(),
        s.currentEpoch(),
        s.epochDuration(),
        s.minStakeAmount(),
        s.cooldownPeriod(),
      ]);

      const dec = 18;
      return {
        totalStaked:    this._fmtOrZero(totalStaked, dec),
        apy:            this._numOrZero(apy) / 100,       // basis points → %
        currentEpoch:   this._numOrZero(epoch),
        epochDuration:  this._numOrZero(epochDur),        // seconds
        minStakeAmount: this._fmtOrZero(minStake, dec),
        cooldownDays:   Math.round(this._numOrZero(cooldown) / 86400),
      };
    });
  }

  async getUserStake(userAddress) {
    const s = this._contracts.staking;
    if (!s) return { staked: '0', rewards: '0', unlockTime: 0 };
    const [staked, rewards, unlockTime] = await s.getStakeInfo(userAddress);
    return {
      staked:     ethers.formatEther(staked),
      rewards:    ethers.formatEther(rewards),
      unlockTime: Number(unlockTime),
      locked:     Number(unlockTime) > Date.now() / 1000,
    };
  }

  async stake(amount) {
    this._requireSigner();
    const parsed = ethers.parseEther(String(amount));
    // Aprobar primero
    await this.approveBEZ(this.addresses.stakingPool, amount);
    const tx = await this._contracts.staking.stake(parsed);
    return tx.wait();
  }

  async unstake(amount) {
    this._requireSigner();
    const tx = await this._contracts.staking.unstake(ethers.parseEther(String(amount)));
    return tx.wait();
  }

  async claimStakingRewards() {
    this._requireSigner();
    const tx = await this._contracts.staking.claimRewards();
    return tx.wait();
  }

  // ─── FARMING ──────────────────────────────────────────────────────────────

  async getFarmingPools() {
    return this._cached('farming:pools', async () => {
      const f = this._contracts.farming;

      if (!f) {
        // Mock con los 5 pares conocidos
        return FARMING_POOLS.map(p => ({
          ...p,
          tvl:        (Math.random() * 2_000_000 + 500_000).toFixed(0),
          apy:        (Math.random() * 80 + 20).toFixed(1),
          bezPerDay:  (Math.random() * 10000 + 1000).toFixed(0),
          userDeposit:'0',
          pendingBez: '0',
        }));
      }

      const poolCount = Number(await f.poolLength().catch(() => BigInt(FARMING_POOLS.length)));

      return Promise.all(
        FARMING_POOLS.slice(0, poolCount).map(async (p) => {
          try {
            const [info, pending] = await Promise.all([
              f.poolInfo(p.id),
              this.signer ? f.pendingBez(p.id, await this.signer.getAddress()) : Promise.resolve(0n),
            ]);

            return {
              ...p,
              allocPoint: Number(info.allocPoint),
              tvl:        '—',   // requiere precio externo
              apy:        '—',
              bezPerDay:  '—',
              pendingBez: ethers.formatEther(pending),
            };
          } catch {
            return { ...p, tvl: '—', apy: '—', pendingBez: '0' };
          }
        })
      );
    });
  }

  async getUserFarmPositions(userAddress) {
    const f = this._contracts.farming;
    if (!f) return [];

    return Promise.all(
      FARMING_POOLS.map(async (pool) => {
        try {
          const [info, pending] = await Promise.all([
            f.userInfo(pool.id, userAddress),
            f.pendingBez(pool.id, userAddress),
          ]);
          return {
            ...pool,
            deposited:  ethers.formatEther(info.amount),
            pendingBez: ethers.formatEther(pending),
          };
        } catch {
          return { ...pool, deposited: '0', pendingBez: '0' };
        }
      })
    );
  }

  async farmDeposit(poolId, amount) {
    this._requireSigner();
    const pool = FARMING_POOLS.find(p => p.id === poolId);
    if (!pool) throw new Error(`Pool ${poolId} no existe`);
    // Aprobar LP token antes
    const parsed = ethers.parseEther(String(amount));
    const tx = await this._contracts.farming.deposit(poolId, parsed);
    return tx.wait();
  }

  async farmWithdraw(poolId, amount) {
    this._requireSigner();
    const tx = await this._contracts.farming.withdraw(poolId, ethers.parseEther(String(amount)));
    return tx.wait();
  }

  async farmHarvest(poolId) {
    this._requireSigner();
    const tx = await this._contracts.farming.harvest(poolId);
    return tx.wait();
  }

  // ─── VALIDATORS & EDGE NODES ──────────────────────────────────────────────

  async getValidatorStats() {
    return this._cached('validator:stats', async () => {
      const v = this._contracts.validators;
      const s = this._contracts.slashing;

      const [total, minStake, totalSlashed] = await Promise.allSettled([
        v?.totalValidators(),
        v?.minValidatorStake(),
        s?.totalSlashed(),
      ]);

      return {
        totalValidators:  this._numOrZero(total),
        minStakeRequired: this._fmtOrZero(minStake, 18),
        totalSlashedBEZ:  this._fmtOrZero(totalSlashed, 18),
      };
    });
  }

  async getEdgeNodeStats() {
    return this._cached('edge:stats', async () => {
      const e = this._contracts.edge;
      if (!e) return { totalNodes: 0, rewardPerNode: '0' };

      const [total, reward] = await Promise.allSettled([
        e.totalActiveNodes(),
        e.rewardPerNode(),
      ]);

      return {
        totalNodes:    this._numOrZero(total),
        rewardPerNode: this._fmtOrZero(reward, 18),
      };
    });
  }

  // ─── GOVERNANCE ───────────────────────────────────────────────────────────

  async getGovernanceStats() {
    return this._cached('gov:stats', async () => {
      const g = this._contracts.gov;
      if (!g) return { quorum: 4, votingPower: '0' };

      const quorum = await g.quorumNumerator().catch(() => 4n);
      return { quorum: Number(quorum) };
    });
  }

  async getUserVotingPower(userAddress) {
    const g = this._contracts.gov;
    if (!g) return '0';
    const block = await this.provider.getBlockNumber();
    const power = await g.getVotes(userAddress, block - 1).catch(() => 0n);
    return ethers.formatEther(power);
  }

  // ─── PAYMENTS ─────────────────────────────────────────────────────────────

  async getPaymentStats() {
    return this._cached('payment:stats', async () => {
      const p = this._contracts.payments;
      if (!p) return { totalVolume: '0', txCount: 0, fee: '0' };

      const [vol, count, fee] = await Promise.allSettled([
        p.totalVolume(),
        p.transactionCount(),
        p.getTransactionFee(),
      ]);

      return {
        totalVolume: this._fmtOrZero(vol, 18),
        txCount:     this._numOrZero(count),
        feePercent:  (this._numOrZero(fee) / 100).toFixed(2),
      };
    });
  }

  // ─── QUALITY ESCROW ───────────────────────────────────────────────────────

  async getEscrowStats() {
    return this._cached('escrow:stats', async () => {
      const e = this._contracts.escrow;
      if (!e) return { totalEscrowed: '0', activeEscrows: 0 };

      const [total, active] = await Promise.allSettled([
        e.totalEscrowed(),
        e.activeEscrows(),
      ]);

      return {
        totalEscrowed: this._fmtOrZero(total, 18),
        activeEscrows: this._numOrZero(active),
      };
    });
  }

  // ─── SNAPSHOT COMPLETO DEL ECOSISTEMA ────────────────────────────────────

  /**
   * Devuelve el estado completo del ecosistema tokenómico en una sola llamada.
   * Ideal para el dashboard principal y el TokenomicsAgent.
   */
  async getEcosystemSnapshot() {
    const [supply, staking, pools, validators, edge, governance, payments, escrow] =
      await Promise.allSettled([
        this.getBEZSupply(),
        this.getStakingStats(),
        this.getFarmingPools(),
        this.getValidatorStats(),
        this.getEdgeNodeStats(),
        this.getGovernanceStats(),
        this.getPaymentStats(),
        this.getEscrowStats(),
      ]);

    const get = (r) => r.status === 'fulfilled' ? r.value : null;

    const snap = {
      timestamp:  new Date().toISOString(),
      chainId:    this.chainId,
      supply:     get(supply),
      staking:    get(staking),
      farming:    { pools: get(pools) || [] },
      validators: get(validators),
      edgeNodes:  get(edge),
      governance: get(governance),
      payments:   get(payments),
      escrow:     get(escrow),
    };

    // Calcular métricas derivadas
    if (snap.supply && snap.staking) {
      const total = parseFloat(snap.supply.total) || 0;
      const staked = parseFloat(snap.staking.totalStaked) || 0;
      snap.supply.stakedPercent = total > 0 ? ((staked / total) * 100).toFixed(2) : '0';
    }

    return snap;
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  async _cached(key, fn) {
    const cached = this._cache.get(key);
    if (cached && Date.now() - cached.ts < this._cacheTTL) return cached.value;
    const value = await fn();
    this._cache.set(key, { value, ts: Date.now() });
    return value;
  }

  _fmtOrZero(r, decimals) {
    if (r.status !== 'fulfilled') return '0';
    try { return ethers.formatUnits(r.value, decimals); } catch { return '0'; }
  }

  _numOrZero(r) {
    if (r.status !== 'fulfilled') return 0;
    try { return Number(r.value); } catch { return 0; }
  }

  _requireSigner() {
    if (!this.signer) throw new Error('Se requiere signer (privateKey) para esta operación');
  }

  _mockStakingStats() {
    return {
      totalStaked:    '4250000',
      apy:            18.5,
      currentEpoch:   42,
      epochDuration:  604800,  // 7 días
      minStakeAmount: '1000',
      cooldownDays:   7,
    };
  }
}

module.exports = {
  TokenomicsEngine,
  FARMING_POOLS,
  ADDRESSES,
};
