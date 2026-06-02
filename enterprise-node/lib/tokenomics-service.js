'use strict';

const { ethers } = require('ethers');
const { query } = require('./db');
const sdkBridge = require('./sdk-bridge');

const READ_ABIS = {
  BEZCoinV2: [
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function name() view returns (string)',
    'function symbol() view returns (string)',
  ],
  StakingPool: [
    'function getTotalStaked() view returns (uint256)',
    'function currentAPY() view returns (uint256)',
    'function minStakeAmount() view returns (uint256)',
  ],
  LiquidityFarming: [
    'function poolLength() view returns (uint256)',
    'function totalAllocPoint() view returns (uint256)',
    'function bezPerBlock() view returns (uint256)',
  ],
  GovernanceSystem: [
    'function quorumNumerator() view returns (uint256)',
  ],
  QualityEscrow: [
    'function totalEscrowed() view returns (uint256)',
    'function activeEscrows() view returns (uint256)',
  ],
  BeZhasQualityEscrow: [
    'function totalEscrowed() view returns (uint256)',
    'function activeEscrows() view returns (uint256)',
  ],
  ValidatorRegistry: [
    'function totalValidators() view returns (uint256)',
    'function minValidatorStake() view returns (uint256)',
  ],
  EdgeNodeRewards: [
    'function totalActiveNodes() view returns (uint256)',
    'function rewardPerNode() view returns (uint256)',
  ],
};

function getProvider() {
  const rpcUrl = process.env.BEZHAS_L2_RPC_URL || 'http://bezhas-geth:8545';
  return new ethers.JsonRpcProvider(rpcUrl);
}

function getConfiguredAddresses() {
  const sdkContracts = sdkBridge.getContractsForFrontend();
  const fromSdk = {};
  if (sdkContracts.contracts) {
    for (const [name, info] of Object.entries(sdkContracts.contracts)) {
      if (info.address) fromSdk[name] = info.address;
    }
  }

  const env = {
    BEZCoinV2: process.env.BEZCOINV2_ADDRESS || process.env.BEZCOINV2_ADDRESS_L2,
    StakingPool: process.env.STAKING_POOL_ADDRESS || process.env.STAKING_POOL_ADDRESS_L2,
    LiquidityFarming: process.env.LIQUIDITY_FARMING_ADDRESS || process.env.LIQUIDITY_FARMING_ADDRESS_L2,
    GovernanceSystem: process.env.GOVERNANCE_SYSTEM_ADDRESS || process.env.GOVERNANCE_SYSTEM_ADDRESS_L2,
    QualityEscrow: process.env.QUALITY_ESCROW_ADDRESS || process.env.QUALITY_ESCROW_ADDRESS_L2,
    BeZhasQualityEscrow: process.env.BEZHAS_QUALITY_ESCROW_ADDRESS,
    ValidatorRegistry: process.env.VALIDATOR_REGISTRY_ADDRESS,
    EdgeNodeRewards: process.env.EDGE_NODE_REWARDS_ADDRESS,
  };

  return Object.fromEntries(
    Object.entries({ ...fromSdk, ...env }).filter(([, value]) => ethers.isAddress(value || ''))
  );
}

function contract(provider, addresses, name) {
  if (!addresses[name] || !READ_ABIS[name]) return null;
  return new ethers.Contract(addresses[name], READ_ABIS[name], provider);
}

async function safe(label, fn, fallback = null) {
  try {
    return await fn();
  } catch (err) {
    return { unavailable: true, label, error: err.message };
  }
}

function fmt(value, decimals = 18) {
  try {
    return ethers.formatUnits(value || 0n, decimals);
  } catch {
    return '0';
  }
}

function num(value) {
  try {
    return Number(value || 0);
  } catch {
    return 0;
  }
}

async function buildSnapshot({ persist = true } = {}) {
  const provider = getProvider();
  const chainId = parseInt(process.env.CHAIN_ID || '2708', 10);
  const addresses = getConfiguredAddresses();
  const network = await safe('network', async () => {
    const [blockNumber, net, feeData] = await Promise.all([
      provider.getBlockNumber(),
      provider.getNetwork(),
      provider.getFeeData(),
    ]);
    return {
      chain_id: Number(net.chainId),
      configured_chain_id: chainId,
      block_height: blockNumber,
      gas_price_gwei: feeData.gasPrice ? Number(ethers.formatUnits(feeData.gasPrice, 'gwei')) : null,
    };
  });

  const bez = contract(provider, addresses, 'BEZCoinV2');
  const staking = contract(provider, addresses, 'StakingPool');
  const farming = contract(provider, addresses, 'LiquidityFarming');
  const governance = contract(provider, addresses, 'GovernanceSystem');
  const escrow = contract(provider, addresses, 'BeZhasQualityEscrow') || contract(provider, addresses, 'QualityEscrow');
  const validators = contract(provider, addresses, 'ValidatorRegistry');
  const edge = contract(provider, addresses, 'EdgeNodeRewards');

  const token = await safe('token', async () => {
    if (!bez) return { configured: false };
    const [totalSupply, decimals, name, symbol] = await Promise.all([
      bez.totalSupply(),
      bez.decimals(),
      bez.name().catch(() => 'BeZhas'),
      bez.symbol().catch(() => 'BEZ'),
    ]);
    return {
      configured: true,
      address: addresses.BEZCoinV2,
      name,
      symbol,
      decimals: Number(decimals),
      total_supply: fmt(totalSupply, Number(decimals)),
      total_supply_raw: totalSupply.toString(),
    };
  });

  const stakingStats = await safe('staking', async () => {
    if (!staking) return { configured: false };
    const [totalStaked, apy, minStake] = await Promise.all([
      staking.getTotalStaked().catch(() => 0n),
      staking.currentAPY().catch(() => 0n),
      staking.minStakeAmount().catch(() => 0n),
    ]);
    return {
      configured: true,
      address: addresses.StakingPool,
      total_staked: fmt(totalStaked),
      apy_percent: num(apy) / 100,
      min_stake: fmt(minStake),
    };
  });

  const farmingStats = await safe('farming', async () => {
    if (!farming) return { configured: false };
    const [poolLength, totalAllocPoint, bezPerBlock] = await Promise.all([
      farming.poolLength().catch(() => 0n),
      farming.totalAllocPoint().catch(() => 0n),
      farming.bezPerBlock().catch(() => 0n),
    ]);
    return {
      configured: true,
      address: addresses.LiquidityFarming,
      pool_count: num(poolLength),
      total_alloc_point: num(totalAllocPoint),
      bez_per_block: fmt(bezPerBlock),
    };
  });

  const governanceStats = await safe('governance', async () => {
    if (!governance) return { configured: false };
    const quorum = await governance.quorumNumerator().catch(() => 0n);
    return {
      configured: true,
      address: addresses.GovernanceSystem,
      quorum_percent: num(quorum),
    };
  });

  const escrowStats = await safe('escrow', async () => {
    if (!escrow) return { configured: false };
    const [totalEscrowed, activeEscrows] = await Promise.all([
      escrow.totalEscrowed().catch(() => 0n),
      escrow.activeEscrows().catch(() => 0n),
    ]);
    return {
      configured: true,
      address: escrow.target,
      total_escrowed: fmt(totalEscrowed),
      active_escrows: num(activeEscrows),
    };
  });

  const validatorStats = await safe('validators', async () => {
    if (!validators) return { configured: false };
    const [totalValidators, minValidatorStake] = await Promise.all([
      validators.totalValidators().catch(() => 0n),
      validators.minValidatorStake().catch(() => 0n),
    ]);
    return {
      configured: true,
      address: addresses.ValidatorRegistry,
      total_validators: num(totalValidators),
      min_validator_stake: fmt(minValidatorStake),
    };
  });

  const edgeStats = await safe('edge_nodes', async () => {
    if (!edge) return { configured: false };
    const [totalActiveNodes, rewardPerNode] = await Promise.all([
      edge.totalActiveNodes().catch(() => 0n),
      edge.rewardPerNode().catch(() => 0n),
    ]);
    return {
      configured: true,
      address: addresses.EdgeNodeRewards,
      total_active_nodes: num(totalActiveNodes),
      reward_per_node: fmt(rewardPerNode),
    };
  });

  const snapshot = {
    timestamp: new Date().toISOString(),
    chain_id: chainId,
    network,
    addresses,
    token,
    staking: stakingStats,
    farming: farmingStats,
    governance: governanceStats,
    escrow: escrowStats,
    validators: validatorStats,
    edge_nodes: edgeStats,
    revenue_model: getRevenueModel(),
  };

  snapshot.derived = deriveMetrics(snapshot);

  if (persist) {
    await query(
      'INSERT INTO tokenomics_snapshots (chain_id, snapshot) VALUES ($1, $2)',
      [chainId, JSON.stringify(snapshot)]
    );
  }

  return snapshot;
}

function getRevenueModel() {
  return {
    monthly_node_fee_eur: parseFloat(process.env.REVENUE_MONTHLY_NODE_FEE_EUR || '199'),
    setup_fee_eur: parseFloat(process.env.REVENUE_SETUP_FEE_EUR || '999'),
    webhook_fee_eur: parseFloat(process.env.REVENUE_WEBHOOK_FEE_EUR || '0.01'),
    indexed_event_fee_eur: parseFloat(process.env.REVENUE_INDEXED_EVENT_FEE_EUR || '0.001'),
    validator_reward_bez_monthly: parseFloat(process.env.REVENUE_VALIDATOR_REWARD_BEZ_MONTHLY || '0'),
    bez_price_eur: parseFloat(process.env.BEZ_PRICE_EUR || '0.05'),
    infra_cost_eur_monthly: parseFloat(process.env.INFRA_COST_EUR_MONTHLY || '60'),
  };
}

function deriveMetrics(snapshot) {
  const total = parseFloat(snapshot.token?.total_supply || '0');
  const staked = parseFloat(snapshot.staking?.total_staked || '0');
  return {
    staked_percent: total > 0 ? Number(((staked / total) * 100).toFixed(2)) : 0,
    configured_contracts: Object.keys(snapshot.addresses || {}).length,
    monetizable_surfaces: [
      'monthly enterprise node fee',
      'indexed event volume',
      'ERP/webhook volume',
      'validator/edge rewards when enabled',
      'premium analytics and SLA support',
    ],
  };
}

async function buildProfitabilityReport(input = {}) {
  const model = { ...getRevenueModel(), ...input };
  const events = parseFloat(input.indexed_events_monthly || process.env.EST_INDEXED_EVENTS_MONTHLY || '50000');
  const hooks = parseFloat(input.webhooks_monthly || process.env.EST_WEBHOOKS_MONTHLY || '10000');
  const clients = parseFloat(input.enterprise_clients || process.env.EST_ENTERPRISE_CLIENTS || '1');
  const validatorRewardEur = model.validator_reward_bez_monthly * model.bez_price_eur;

  const monthlyRevenue =
    clients * model.monthly_node_fee_eur +
    events * model.indexed_event_fee_eur +
    hooks * model.webhook_fee_eur +
    validatorRewardEur;

  const firstMonthRevenue = monthlyRevenue + clients * model.setup_fee_eur;
  const monthlyProfit = monthlyRevenue - model.infra_cost_eur_monthly;
  const margin = monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0;

  const report = {
    timestamp: new Date().toISOString(),
    assumptions: {
      enterprise_clients: clients,
      indexed_events_monthly: events,
      webhooks_monthly: hooks,
      ...model,
    },
    revenue: {
      recurring_monthly_eur: Number(monthlyRevenue.toFixed(2)),
      first_month_eur: Number(firstMonthRevenue.toFixed(2)),
      validator_rewards_eur: Number(validatorRewardEur.toFixed(2)),
    },
    costs: {
      infra_monthly_eur: model.infra_cost_eur_monthly,
    },
    profit: {
      monthly_eur: Number(monthlyProfit.toFixed(2)),
      first_month_eur: Number((firstMonthRevenue - model.infra_cost_eur_monthly).toFixed(2)),
      margin_percent: Number(margin.toFixed(2)),
    },
    recommendations: [
      'Charge a fixed monthly enterprise node fee for predictable revenue.',
      'Keep RPC private by default and sell managed access with SLA.',
      'Index only useful enterprise contracts to reduce database and compute cost.',
      'Use webhook volume pricing for ERP integrations because it scales with client usage.',
      'Enable validator/edge rewards only for clients that can maintain uptime and stake requirements.',
    ],
  };

  await query('INSERT INTO profitability_reports (report) VALUES ($1)', [JSON.stringify(report)]);
  return report;
}

module.exports = {
  buildSnapshot,
  buildProfitabilityReport,
  getConfiguredAddresses,
  getRevenueModel,
};
