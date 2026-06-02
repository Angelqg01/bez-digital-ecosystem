/**
 * contracts.config.js
 * Configuración central de contratos BeZhas
 * Actualizado automáticamente por el sync daemon
 */

// ── Redes soportadas ─────────────────────────────────────────────────────────
export const BEZHAS_CHAINS = {
  BSC_MAINNET: {
    chainId:    56,
    name:       'BNB Chain',
    network:    'bsc',
    rpc:        'https://bsc-dataseed.binance.org',
    rpcAlt:     'https://bsc-dataseed1.defibit.io',
    explorer:   'https://bscscan.com',
    symbol:     'BNB',
    decimals:   18,
    isTestnet:  false,
    token:      'BEP-20',
  },
  BSC_TESTNET: {
    chainId:    97,
    name:       'BSC Testnet',
    network:    'bscTestnet',
    rpc:        'https://data-seed-prebsc-1-s1.binance.org:8545',
    explorer:   'https://testnet.bscscan.com',
    symbol:     'tBNB',
    decimals:   18,
    isTestnet:  true,
    token:      'BEP-20',
  },
  POLYGON: {
    chainId:    137,
    name:       'Polygon',
    network:    'polygon',
    rpc:        'https://polygon-rpc.com',
    rpcAlt:     'https://rpc-mainnet.matic.network',
    explorer:   'https://polygonscan.com',
    symbol:     'MATIC',
    decimals:   18,
    isTestnet:  false,
    token:      'ERC-20',
  },
  POLYGON_MUMBAI: {
    chainId:    80001,
    name:       'Mumbai Testnet',
    network:    'mumbai',
    rpc:        'https://rpc-mumbai.maticvigil.com',
    explorer:   'https://mumbai.polygonscan.com',
    symbol:     'MATIC',
    decimals:   18,
    isTestnet:  true,
    token:      'ERC-20',
  },
};

// ── Helpers de red ────────────────────────────────────────────────────────────
export function getChainConfig(chainId) {
  return Object.values(BEZHAS_CHAINS).find(c => c.chainId === chainId) ?? null;
}

export function isTestnet(chainId) {
  return getChainConfig(chainId)?.isTestnet ?? false;
}

export function getExplorerUrl(chainId, hash, type = 'tx') {
  const explorer = getChainConfig(chainId)?.explorer;
  return explorer ? `${explorer}/${type}/${hash}` : '#';
}

// ── Parámetros DeFi ──────────────────────────────────────────────────────────
export const DEFI_CONFIG = {
  // Slippage máximo para swaps (en basis points: 50 = 0.5%)
  MAX_SLIPPAGE_BPS: 50,
  DEFAULT_SLIPPAGE_BPS: 30,

  // Deadline para transacciones (en minutos)
  TX_DEADLINE_MINUTES: 20,

  // Confirmaciones requeridas por red
  CONFIRMATIONS: {
    56:    3,   // BSC mainnet
    97:    1,   // BSC testnet
    137:   5,   // Polygon
    80001: 1,   // Mumbai
  },

  // Protocolos DeFi por red
  PROTOCOLS: {
    56: {
      DEX:      'PancakeSwap V3',
      DEX_ROUTER: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
      FARMING:  'PancakeSwap Farms',
      BRIDGE:   'LayerZero',
    },
    137: {
      DEX:      'QuickSwap V3',
      DEX_ROUTER: '0xf5b509bB0909a69B1c207E495f687a596C168E12',
      FARMING:  'QuickSwap Farms',
      BRIDGE:   'Wormhole',
    },
  },
};

// ── Configuración de pagos ────────────────────────────────────────────────────
export const PAYMENT_CONFIG = {
  // Comisión de plataforma (en basis points)
  PLATFORM_FEE_BPS: 10,         // 0.1%
  STAKING_FEE_BPS:  50,         // 0.5% para holders en staking

  // Proveedores fiat on-ramp
  FIAT_PROVIDERS: {
    MOONPAY:  { enabled: true,  minAmount: 20,  maxAmount: 10000 },
    TRANSAK:  { enabled: true,  minAmount: 15,  maxAmount: 5000  },
    RAMP:     { enabled: true,  minAmount: 10,  maxAmount: 20000 },
  },

  // Límites de pago
  MIN_PAYMENT_BEZ:  1,
  MAX_PAYMENT_BEZ:  1_000_000,
};

// ── Configuración de Staking ──────────────────────────────────────────────────
export const STAKING_CONFIG = {
  POOLS: [
    { id: 0, lockDays: 0,   APY: 8,   label: 'Flexible'  },
    { id: 1, lockDays: 30,  APY: 15,  label: '1 Mes'     },
    { id: 2, lockDays: 90,  APY: 25,  label: '3 Meses'   },
    { id: 3, lockDays: 180, APY: 40,  label: '6 Meses'   },
    { id: 4, lockDays: 365, APY: 65,  label: '1 Año'     },
  ],
  MIN_STAKE_BEZ: 100,
  COMPOUND_INTERVAL_HOURS: 24,
};

// ── Configuración de DAO ──────────────────────────────────────────────────────
export const DAO_CONFIG = {
  MIN_TOKENS_TO_PROPOSE:  10_000,  // BEZ mínimo para crear propuesta
  MIN_TOKENS_TO_VOTE:     100,     // BEZ mínimo para votar
  VOTING_PERIOD_DAYS:     7,
  EXECUTION_DELAY_DAYS:   2,
  QUORUM_PERCENT:         4,       // 4% del supply total
};

// ── Tokens externos (para swaps) ─────────────────────────────────────────────
export const EXTERNAL_TOKENS = {
  56: {
    USDC:  { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, symbol: 'USDC' },
    USDT:  { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, symbol: 'USDT' },
    WBNB:  { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, symbol: 'WBNB' },
    ETH:   { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18, symbol: 'ETH'  },
  },
  137: {
    USDC:  { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6,  symbol: 'USDC'  },
    USDT:  { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6,  symbol: 'USDT'  },
    WMATIC:{ address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18, symbol: 'WMATIC'},
    WETH:  { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, symbol: 'WETH'  },
  },
};

export default {
  BEZHAS_CHAINS,
  DEFI_CONFIG,
  PAYMENT_CONFIG,
  STAKING_CONFIG,
  DAO_CONFIG,
  EXTERNAL_TOKENS,
  getChainConfig,
  isTestnet,
  getExplorerUrl,
};
