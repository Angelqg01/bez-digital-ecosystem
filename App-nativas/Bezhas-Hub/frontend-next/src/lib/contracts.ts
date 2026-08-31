/**
 * BeZhas Contract Hooks — wagmi/viem integration for on-chain reads + writes
 *
 * These hooks bridge the frontend-next app with the deployed smart contracts.
 * Contract addresses are resolved from the @bezhas/sdk contract registry.
 * ABIs are inlined here for frontend compatibility (no Node.js `require`).
 *
 * Usage:
 *   import { useBezBalance, useStakingPosition, useValidatorTier } from '@/lib/contracts';
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther, type Address } from 'viem';

// ── Chain IDs ────────────────────────────────────────────────────────────────
export const CHAIN_IDS = {
  BEZHAS_L2: 2708,
  ANVIL: 31337,
  POLYGON: 137,
  POLYGON_AMOY: 80002,
} as const;

// ── Contract Addresses (Anvil dev — will be replaced per-environment) ────────
// Source of truth: BeZhas Blockchain → smart-contracts/deployments/<chainId>.json
// In production, load from SDK: @bezhas/sdk → contracts.getAddress('BEZCoinV2', chainId)
export const CONTRACTS = {
  // Core Tokens
  BEZCoinV2: (process.env.NEXT_PUBLIC_BEZCOIN_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3') as Address,
  WrappedBEZ: (process.env.NEXT_PUBLIC_WBEZ_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,

  // DeFi Core
  StakingPool: (process.env.NEXT_PUBLIC_STAKING_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0') as Address,
  LiquidityFarming: (process.env.NEXT_PUBLIC_FARMING_ADDRESS || '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9') as Address,
  GovernanceSystem: (process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9') as Address,
  ValidatorRegistry: (process.env.NEXT_PUBLIC_VALIDATOR_ADDRESS || '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707') as Address,
  EdgeNodeRewards: (process.env.NEXT_PUBLIC_EDGENODE_ADDRESS || '0x0165878A594ca255338adfa4d48449f69242Eb8F') as Address,

  // Payments & Bridge
  BeZhasPayment: (process.env.NEXT_PUBLIC_PAYMENT_ADDRESS || '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853') as Address,
  BEZPolygonBridge: (process.env.NEXT_PUBLIC_BRIDGE_ADDRESS || '0x0000000000000000000000000000000000000000') as Address,

  // Treasury
  TreasuryVault: (process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6') as Address,
} as const;

// ════════════════════════════════════════════════════════════════════════════
//  MINIMAL ABIs — Only functions referenced by frontend components
//  Full ABIs loaded from @bezhas/sdk artifacts in production
// ════════════════════════════════════════════════════════════════════════════

export const BEZ_COIN_ABI = [
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'approve', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'MAX_SUPPLY', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getVotes', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'delegate', inputs: [{ name: 'delegatee', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },
] as const;

export const STAKING_POOL_ABI = [
  { type: 'function', name: 'rewardRate', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalStaked', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'DAILY_EMISSION_CAP', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'dailyEmitted', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'MAX_REWARD_RATE', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'stakedBalance', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'earned', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'stake', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'withdraw', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'claimReward', inputs: [], outputs: [], stateMutability: 'nonpayable' },
] as const;

export const LIQUIDITY_FARMING_ABI = [
  { type: 'function', name: 'bezPerBlock', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'DAILY_EMISSION_CAP', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'MAX_BEZ_PER_BLOCK', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'poolLength', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'poolInfo', inputs: [{ name: 'pid', type: 'uint256' }], outputs: [{ name: 'lpToken', type: 'address' }, { name: 'allocPoint', type: 'uint256' }, { name: 'lastRewardBlock', type: 'uint256' }, { name: 'accBezPerShare', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'userInfo', inputs: [{ name: 'pid', type: 'uint256' }, { name: 'user', type: 'address' }], outputs: [{ name: 'amount', type: 'uint256' }, { name: 'rewardDebt', type: 'uint256' }, { name: 'lockEnd', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'pendingBez', inputs: [{ name: 'pid', type: 'uint256' }, { name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'deposit', inputs: [{ name: 'pid', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'lockDays', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'withdraw', inputs: [{ name: 'pid', type: 'uint256' }, { name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
] as const;

export const VALIDATOR_REGISTRY_ABI = [
  { type: 'function', name: 'validators', inputs: [{ name: 'addr', type: 'address' }], outputs: [{ name: 'name', type: 'string' }, { name: 'stakedAmount', type: 'uint256' }, { name: 'tier', type: 'uint8' }, { name: 'isActive', type: 'bool' }, { name: 'uptimeBps', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getRewardBoost', inputs: [{ name: 'validator', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'TIER_BRONZE_MIN', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'TIER_SILVER_MIN', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'TIER_GOLD_MIN', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'TIER_PLATINUM_MIN', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'registerValidator', inputs: [{ name: 'name', type: 'string' }], outputs: [], stateMutability: 'payable' },
] as const;

export const TREASURY_VAULT_ABI = [
  { type: 'function', name: 'getVaultBalance', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'getDailyRemaining', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'dailyLimit', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'requiredApprovals', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'spentToday', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'withdrawals', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ name: 'id', type: 'uint256' }, { name: 'requester', type: 'address' }, { name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'approvals', type: 'uint256' }, { name: 'status', type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'requestWithdrawal', inputs: [{ name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'reasonHash', type: 'bytes32' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'approveWithdrawal', inputs: [{ name: 'withdrawalId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'rejectWithdrawal', inputs: [{ name: 'withdrawalId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'deposit', inputs: [], outputs: [], stateMutability: 'payable' },
] as const;

export const BEZHAS_PAYMENT_ABI = [
  { type: 'function', name: 'platformFeeBps', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'accruedFees', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'processPayment', inputs: [{ name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'ref', type: 'bytes32' }], outputs: [], stateMutability: 'nonpayable' },
] as const;

export const EDGE_NODE_ABI = [
  { type: 'function', name: 'totalRewardsDistributed', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'providerRewards', inputs: [{ name: 'nodeId', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'activeNodesCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'claimRewards', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'submitProof', inputs: [{ name: 'metricsHash', type: 'bytes32' }], outputs: [], stateMutability: 'nonpayable' },
] as const;

// ════════════════════════════════════════════════════════════════════════════
//  READ HOOKS — Pure on-chain data reads
// ════════════════════════════════════════════════════════════════════════════

/** Read BEZ token balance for an address */
export function useBezBalance(address?: Address) {
  return useReadContract({
    address: CONTRACTS.BEZCoinV2,
    abi: BEZ_COIN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

/** Read total BEZ supply */
export function useBezTotalSupply() {
  return useReadContract({
    address: CONTRACTS.BEZCoinV2,
    abi: BEZ_COIN_ABI,
    functionName: 'totalSupply',
  });
}

/** Read max BEZ supply (hard cap) */
export function useBezMaxSupply() {
  return useReadContract({
    address: CONTRACTS.BEZCoinV2,
    abi: BEZ_COIN_ABI,
    functionName: 'MAX_SUPPLY',
  });
}

/** Read voting power for governance */
export function useVotingPower(address?: Address) {
  return useReadContract({
    address: CONTRACTS.BEZCoinV2,
    abi: BEZ_COIN_ABI,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

/** Read staking pool global stats */
export function useStakingStats() {
  const totalStaked = useReadContract({ address: CONTRACTS.StakingPool, abi: STAKING_POOL_ABI, functionName: 'totalStaked' });
  const rewardRate = useReadContract({ address: CONTRACTS.StakingPool, abi: STAKING_POOL_ABI, functionName: 'rewardRate' });
  const dailyCap = useReadContract({ address: CONTRACTS.StakingPool, abi: STAKING_POOL_ABI, functionName: 'DAILY_EMISSION_CAP' });
  const dailyEmitted = useReadContract({ address: CONTRACTS.StakingPool, abi: STAKING_POOL_ABI, functionName: 'dailyEmitted' });
  return { totalStaked, rewardRate, dailyCap, dailyEmitted };
}

/** Read user's staked balance and pending rewards */
export function useStakingPosition(address?: Address) {
  const balance = useReadContract({
    address: CONTRACTS.StakingPool, abi: STAKING_POOL_ABI, functionName: 'stakedBalance',
    args: address ? [address] : undefined, query: { enabled: !!address },
  });
  const earned = useReadContract({
    address: CONTRACTS.StakingPool, abi: STAKING_POOL_ABI, functionName: 'earned',
    args: address ? [address] : undefined, query: { enabled: !!address },
  });
  return { balance, earned };
}

/** Read validator info and tier */
export function useValidatorInfo(address?: Address) {
  return useReadContract({
    address: CONTRACTS.ValidatorRegistry, abi: VALIDATOR_REGISTRY_ABI, functionName: 'validators',
    args: address ? [address] : undefined, query: { enabled: !!address },
  });
}

/** Read validator reward boost */
export function useValidatorBoost(address?: Address) {
  return useReadContract({
    address: CONTRACTS.ValidatorRegistry, abi: VALIDATOR_REGISTRY_ABI, functionName: 'getRewardBoost',
    args: address ? [address] : undefined, query: { enabled: !!address },
  });
}

/** Read treasury vault balance */
export function useTreasuryBalance() {
  return useReadContract({
    address: CONTRACTS.TreasuryVault, abi: TREASURY_VAULT_ABI, functionName: 'getVaultBalance',
  });
}

/** Read treasury daily remaining allowance */
export function useTreasuryDailyRemaining() {
  return useReadContract({
    address: CONTRACTS.TreasuryVault, abi: TREASURY_VAULT_ABI, functionName: 'getDailyRemaining',
  });
}

/** Read platform fee in basis points */
export function usePlatformFee() {
  return useReadContract({
    address: CONTRACTS.BeZhasPayment, abi: BEZHAS_PAYMENT_ABI, functionName: 'platformFeeBps',
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  WRITE HOOKS — State-changing transactions
// ════════════════════════════════════════════════════════════════════════════

/** Stake BEZ tokens into the StakingPool */
export function useStake() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const stake = (amount: string) => {
    writeContract({
      address: CONTRACTS.StakingPool,
      abi: STAKING_POOL_ABI,
      functionName: 'stake',
      args: [parseEther(amount)],
    });
  };

  return { stake, hash, isPending, isConfirming, isSuccess, error };
}

/** Withdraw staked BEZ from StakingPool */
export function useUnstake() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const unstake = (amount: string) => {
    writeContract({
      address: CONTRACTS.StakingPool,
      abi: STAKING_POOL_ABI,
      functionName: 'withdraw',
      args: [parseEther(amount)],
    });
  };

  return { unstake, hash, isPending, isConfirming, isSuccess, error };
}

/** Claim staking rewards */
export function useClaimStakingRewards() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = () => {
    writeContract({
      address: CONTRACTS.StakingPool,
      abi: STAKING_POOL_ABI,
      functionName: 'claimReward',
    });
  };

  return { claim, hash, isPending, isConfirming, isSuccess, error };
}

/** Deposit into a farming pool with optional lock */
export function useFarmDeposit() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const deposit = (poolId: number, amount: string, lockDays: number) => {
    writeContract({
      address: CONTRACTS.LiquidityFarming,
      abi: LIQUIDITY_FARMING_ABI,
      functionName: 'deposit',
      args: [BigInt(poolId), parseEther(amount), BigInt(lockDays)],
    });
  };

  return { deposit, hash, isPending, isConfirming, isSuccess, error };
}

/** Approve treasury withdrawal (multi-sig) */
export function useApproveTreasuryWithdrawal() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (withdrawalId: number) => {
    writeContract({
      address: CONTRACTS.TreasuryVault,
      abi: TREASURY_VAULT_ABI,
      functionName: 'approveWithdrawal',
      args: [BigInt(withdrawalId)],
    });
  };

  return { approve, hash, isConfirming, isPending, isSuccess, error };
}

// ── Edge Node Hooks ──
export function useEdgeNodeStats() {
  const totalRewards = useReadContract({ address: CONTRACTS.EdgeNodeRewards, abi: EDGE_NODE_ABI, functionName: 'totalRewardsDistributed' });
  const activeNodes = useReadContract({ address: CONTRACTS.EdgeNodeRewards, abi: EDGE_NODE_ABI, functionName: 'activeNodesCount' });
  return { totalRewards, activeNodes };
}

export function useEdgeNodeReward(address?: Address) {
  return useReadContract({
    address: CONTRACTS.EdgeNodeRewards,
    abi: EDGE_NODE_ABI,
    functionName: 'providerRewards',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useEdgeNodeClaim() {
  const { writeContract, isPending, isSuccess, error } = useWriteContract();
  return {
    claim: () => writeContract({ address: CONTRACTS.EdgeNodeRewards, abi: EDGE_NODE_ABI, functionName: 'claimRewards' }),
    isPending, isSuccess, error,
  };
}

/** Delegate BEZ votes for DAO governance */
export function useDelegateVotes() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const delegate = (delegatee: Address) => {
    writeContract({
      address: CONTRACTS.BEZCoinV2,
      abi: BEZ_COIN_ABI,
      functionName: 'delegate',
      args: [delegatee],
    });
  };

  return { delegate, hash, isPending, isConfirming, isSuccess, error };
}

// ════════════════════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/** Format BigInt token amount to human-readable string */
export function formatBez(value: bigint | undefined): string {
  if (!value) return '0';
  return formatEther(value);
}

/** Format BigInt to number with decimals */
export function formatBezNum(value: bigint | undefined): number {
  if (!value) return 0;
  return parseFloat(formatEther(value));
}

/** Get validator tier name from numeric tier */
export function getTierName(tier: number): string {
  const tiers = ['None', 'Bronze', 'Silver', 'Gold', 'Platinum'];
  return tiers[tier] || 'Unknown';
}

/** Get tier reward boost multiplier (aligned with ValidatorRegistry.sol) */
export function getTierBoost(tier: number): number {
  const boosts = [0, 100, 125, 150, 200]; // basis points: 100 = 1x
  return (boosts[tier] || 100) / 100;
}
