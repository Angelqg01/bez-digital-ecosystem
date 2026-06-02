/**
 * @bezhas/contracts — Typed ABI fragments for all BeZhas smart contracts.
 * 
 * These are minimal ABI fragments covering the functions each sub-app needs.
 * The full ABIs live in Bezhas-Hub/frontend/src/abis/ and Bezhas-Hub/backend/abis/.
 * These typed fragments allow sub-apps to call contracts without importing 
 * the full ABI files.
 */

// ─── BEZCoinV2 (ERC20 + ERC20Votes) ──────────────────────
export const BEZCoinV2_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function delegate(address delegatee)',
  'function getVotes(address account) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
] as const;

// ─── StakingPool ─────────────────────────────────────────
export const StakingPool_ABI = [
  'function stake(uint256 amount)',
  'function unstake(uint256 amount)',
  'function claimRewards()',
  'function getStakedBalance(address user) view returns (uint256)',
  'function getPendingRewards(address user) view returns (uint256)',
  'function getAPY() view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'event Staked(address indexed user, uint256 amount)',
  'event Unstaked(address indexed user, uint256 amount)',
  'event RewardsClaimed(address indexed user, uint256 amount)',
] as const;

// ─── LiquidityFarming ────────────────────────────────────
export const LiquidityFarming_ABI = [
  'function addLiquidity(uint256 amountA, uint256 amountB)',
  'function removeLiquidity(uint256 lpAmount)',
  'function harvest(uint256 poolId)',
  'function getPoolInfo(uint256 poolId) view returns (tuple(uint256 totalLP, uint256 apy, uint256 rewardRate))',
  'function getUserPosition(uint256 poolId, address user) view returns (tuple(uint256 lpBalance, uint256 pendingRewards))',
  'event LiquidityAdded(address indexed user, uint256 amountA, uint256 amountB, uint256 lpMinted)',
  'event Harvested(address indexed user, uint256 poolId, uint256 reward)',
] as const;

// ─── BeZhasLogisticsNFT ─────────────────────────────────
export const LogisticsNFT_ABI = [
  'function mintLogisticsNFT(address recipient, string metadataHash, string verdict, string sector) returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function getAssetMetadata(uint256 tokenId) view returns (tuple(string metadataHash, string verdict, string sector, uint256 timestamp))',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'event LogisticsNFTMinted(address indexed to, uint256 indexed tokenId, string sector)',
] as const;

// ─── QualityEscrow ──────────────────────────────────────
export const QualityEscrow_ABI = [
  'function createEscrow(uint256 nftId, address buyer, address seller, uint256 amount) returns (uint256)',
  'function releaseEscrow(uint256 escrowId)',
  'function disputeEscrow(uint256 escrowId, string reason)',
  'function registerSensorData(uint256 nftId, string sensorType, string dataHash)',
  'function getEscrowStatus(uint256 escrowId) view returns (uint8)',
  'function getSensorData(uint256 nftId) view returns (tuple(string sensorType, string dataHash, uint256 timestamp)[])',
  'event EscrowCreated(uint256 indexed escrowId, uint256 indexed nftId, uint256 amount)',
  'event EscrowReleased(uint256 indexed escrowId)',
  'event EscrowDisputed(uint256 indexed escrowId, string reason)',
] as const;

// ─── EdgeNodeRewards ────────────────────────────────────
export const EdgeNodeRewards_ABI = [
  'function registerNode(string apiKeyHash, string enterpriseDid) returns (uint256)',
  'function claimRewards(uint256 nodeId)',
  'function getNodeInfo(uint256 nodeId) view returns (tuple(address owner, uint256 points, uint256 uptime, bool active))',
  'function getPendingRewards(uint256 nodeId) view returns (uint256)',
  'function getActiveNodeCount() view returns (uint256)',
  'event NodeRegistered(uint256 indexed nodeId, address indexed owner)',
  'event RewardsClaimed(uint256 indexed nodeId, uint256 amount)',
] as const;

// ─── GovernanceSystem ───────────────────────────────────
export const Governance_ABI = [
  'function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)',
  'function castVote(uint256 proposalId, uint8 support) returns (uint256)',
  'function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) returns (uint256)',
  'function state(uint256 proposalId) view returns (uint8)',
  'function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)',
  'function hasVoted(uint256 proposalId, address account) view returns (bool)',
  'event ProposalCreated(uint256 proposalId, address proposer, string description)',
  'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight)',
] as const;

// ─── Bridge Contracts ───────────────────────────────────
export const BridgeL2_ABI = [
  'function bridgeToL1(uint256 amount, address recipient)',
  'function bridgeFromL1(uint256 amount, address recipient, bytes proof)',
  'function getPendingBridges(address user) view returns (tuple(uint256 amount, uint256 timestamp, uint8 status)[])',
  'event BridgeInitiated(address indexed sender, uint256 amount, uint256 targetChain)',
  'event BridgeCompleted(address indexed recipient, uint256 amount, uint256 sourceChain)',
] as const;

// ─── Treasury ───────────────────────────────────────────
export const Treasury_ABI = [
  'function getBalance() view returns (uint256)',
  'function getAllocation(string category) view returns (uint256)',
  'function requestFunding(string category, uint256 amount, string justification) returns (uint256)',
  'event FundingApproved(uint256 indexed requestId, string category, uint256 amount)',
] as const;

// ─── Contract Name → ABI Map ────────────────────────────
export const CONTRACT_ABIS = {
  BEZCoinV2: BEZCoinV2_ABI,
  StakingPool: StakingPool_ABI,
  LiquidityFarming: LiquidityFarming_ABI,
  BeZhasLogisticsNFT: LogisticsNFT_ABI,
  QualityEscrow: QualityEscrow_ABI,
  EdgeNodeRewards: EdgeNodeRewards_ABI,
  GovernanceSystem: Governance_ABI,
  BridgeL2: BridgeL2_ABI,
  Treasury: Treasury_ABI,
} as const;

export type ContractName = keyof typeof CONTRACT_ABIS;
