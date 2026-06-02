/**
 * Contract registry — Maps contract names to addresses and chain IDs.
 * Populated from .env.shared / .env.local variables.
 */

interface ContractEntry {
  address: string;
  chainId: number;
  name: string;
  category: 'core' | 'defi' | 'governance' | 'logistics' | 'bridge';
}

const env = (key: string): string =>
  (typeof window !== 'undefined' ? (window as any).__env?.[key] : process.env[key]) || '';

export const CONTRACTS: Record<string, ContractEntry> = {
  BEZCoinV2: {
    address: env('NEXT_PUBLIC_BEZCOIN_ADDRESS') || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
    chainId: 2708,
    name: 'BEZCoinV2',
    category: 'core',
  },
  StakingPool: {
    address: env('NEXT_PUBLIC_STAKING_POOL_ADDRESS') || '0x5c9bd3136fBAA3861DeAE71e689AD8792202c7Df',
    chainId: 2708,
    name: 'StakingPool',
    category: 'defi',
  },
  LiquidityFarming: {
    address: env('NEXT_PUBLIC_LIQUIDITY_FARMING_ADDRESS') || '',
    chainId: 2708,
    name: 'LiquidityFarming',
    category: 'defi',
  },
  BeZhasLogisticsNFT: {
    address: env('NEXT_PUBLIC_LOGISTICS_NFT_ADDRESS') || '',
    chainId: 2708,
    name: 'BeZhasLogisticsNFT',
    category: 'logistics',
  },
  QualityEscrow: {
    address: env('NEXT_PUBLIC_QUALITY_ESCROW_ADDRESS') || '',
    chainId: 2708,
    name: 'QualityEscrow',
    category: 'logistics',
  },
  EdgeNodeRewards: {
    address: env('NEXT_PUBLIC_EDGE_NODE_REWARDS_ADDRESS') || '',
    chainId: 2708,
    name: 'EdgeNodeRewards',
    category: 'core',
  },
  GovernanceSystem: {
    address: env('NEXT_PUBLIC_GOVERNANCE_ADDRESS') || '',
    chainId: 2708,
    name: 'GovernanceSystem',
    category: 'governance',
  },
  Treasury: {
    address: env('NEXT_PUBLIC_TREASURY_ADDRESS') || '',
    chainId: 2708,
    name: 'Treasury',
    category: 'governance',
  },
  BridgeL2: {
    address: env('NEXT_PUBLIC_BRIDGE_ADDRESS') || '0x0a6B28497a925F526a71DFA6A074493648E8a8aF',
    chainId: 2708,
    name: 'BridgeL2',
    category: 'bridge',
  },
  Marketplace: {
    address: env('NEXT_PUBLIC_MARKETPLACE_ADDRESS') || '0xA923Ff57B88c55bf39b077e63592850450A43FD8',
    chainId: 2708,
    name: 'Marketplace',
    category: 'core',
  },
  SmartWallet: {
    address: '',
    chainId: 2708,
    name: 'SmartWallet',
    category: 'core',
  },
  Paymaster: {
    address: '',
    chainId: 2708,
    name: 'Paymaster',
    category: 'core',
  },
};

export function getContractAddress(name: keyof typeof CONTRACTS): string {
  return CONTRACTS[name]?.address || '';
}

export function getContractsByCategory(category: ContractEntry['category']): ContractEntry[] {
  return Object.values(CONTRACTS).filter(c => c.category === category);
}
