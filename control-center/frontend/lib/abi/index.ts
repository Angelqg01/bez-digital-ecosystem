/**
 * abi/index.ts — ABI barrel file
 *
 * Expone los ABIs de los contratos compilados por Foundry.
 * Los archivos JSON se generan con:
 *   forge build → out/{Contract}.sol/{Contract}.json → se extrae .abi
 *
 * Usage:
 *   import { BeZhasPaymentABI } from '@/lib/abi';
 */

// ── Core Payment ────────────────────────────────────────────────────────
export { default as BeZhasPaymentABI } from './BeZhasPayment.json';

// ── Wallet (Account Abstraction) ────────────────────────────────────────
export { default as SmartWalletFactoryABI } from './SmartWalletFactory.json';
export { default as SmartWalletABI } from './SmartWallet.json';
export { default as WalletGuardianABI } from './WalletGuardian.json';
export { default as PaymasterABI } from './Paymaster.json';

// ── Validation Infrastructure ───────────────────────────────────────────
export { default as ValidatorRegistryABI } from './ValidatorRegistry.json';
export { default as StakingPoolABI } from './StakingPool.json';
export { default as BeZhasStakingABI } from './StakingPool.json';

// ── DeFi / Bridge ───────────────────────────────────────────────────────
export { default as BEZPolygonBridgeABI } from './BEZPolygonBridge.json';
export { default as WrappedBEZABI } from './WrappedBEZ.json';
export { default as BEZCoinV2ABI } from './WrappedBEZ.json';
export { default as LiquidityFarmingABI } from './LiquidityFarming.json';
export { default as BeZhasBridgeL2ABI } from './BeZhasBridgeL2.json';
export { default as BeZhasBridgeABI } from './BeZhasBridgeL2.json';
export { default as BeZhasTreasuryABI } from './BeZhasPayment.json';

// ── L2 Sequencer & Security ─────────────────────────────────────────────
export { default as L2SequencerABI } from './L2Sequencer.json';
export { default as SequencerRotationABI } from './SequencerRotation.json';
export { default as SlashingManagerABI } from './SlashingManager.json';
export { default as EdgeNodeRewardsABI } from './EdgeNodeRewards.json';
