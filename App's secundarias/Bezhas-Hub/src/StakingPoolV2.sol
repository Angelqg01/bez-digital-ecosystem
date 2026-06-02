// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title StakingPoolV2
 * @dev Enhanced staking pool with tier-based APY multipliers verified via backend signatures.
 * 
 * Features:
 * - Base APY rewards for all stakers
 * - Tier-based APY multipliers (STARTER: 1x, CREATOR: 1.5x, BUSINESS: 2.5x)
 * - Backend signature verification for tier claims
 * - Auto-compounding option for premium tiers
 * - Token lock mechanism for free tier upgrades
 * 
 * @notice Version 2.0.0
 * @author BeZhas Team
 */
contract StakingPoolV2 is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ CONSTANTS ============
    
    uint256 public constant PRECISION = 1e18;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    
    // Tier multipliers (scaled by 100 for precision: 100 = 1x, 150 = 1.5x)
    uint256 public constant TIER_STARTER_MULTIPLIER = 100;   // 1.0x
    uint256 public constant TIER_CREATOR_MULTIPLIER = 150;   // 1.5x
    uint256 public constant TIER_BUSINESS_MULTIPLIER = 250;  // 2.5x
    
    // Token lock requirements for free tier access
    uint256 public constant CREATOR_TOKEN_LOCK = 5_000 * 1e18;    // 5,000 BEZ
    uint256 public constant BUSINESS_TOKEN_LOCK = 50_000 * 1e18;  // 50,000 BEZ
    uint256 public constant CREATOR_LOCK_DURATION = 90 days;
    uint256 public constant BUSINESS_LOCK_DURATION = 180 days;

    // ============ ENUMS ============
    
    enum Tier { STARTER, CREATOR, BUSINESS }

    // ============ STATE ============
    
    IERC20 public immutable stakingToken;
    address public signatureVerifier;
    
    // Base APY in basis points (1250 = 12.50%)
    uint256 public baseAPY = 1250;
    
    // Reward distribution
    uint256 public rewardPerTokenStored;
    uint256 public lastUpdateTime;
    uint256 public totalStaked;
    
    // User stakes
    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 rewardDebt;
        Tier tier;
        uint256 tierValidUntil;
        bool autoCompound;
    }
    
    mapping(address => StakeInfo) public stakes;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public userRewardPerTokenPaid;
    
    // Token locks for free tier access
    struct TokenLock {
        uint256 amount;
        uint256 lockedAt;
        uint256 unlockTime;
        Tier targetTier;
        bool isActive;
    }
    
    mapping(address => TokenLock) public tokenLocks;
    uint256 public totalLocked;
    
    // Signature nonces to prevent replay attacks
    mapping(address => uint256) public nonces;
    
    // ============ EVENTS ============
    
    event Staked(address indexed user, uint256 amount, Tier tier);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event TierUpgraded(address indexed user, Tier oldTier, Tier newTier);
    event TokensLocked(address indexed user, uint256 amount, Tier targetTier, uint256 unlockTime);
    event TokensUnlocked(address indexed user, uint256 amount);
    event AutoCompoundToggled(address indexed user, bool enabled);
    event SignatureVerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    event BaseAPYUpdated(uint256 oldAPY, uint256 newAPY);

    // ============ ERRORS ============
    
    error InvalidSignature();
    error SignatureExpired();
    error InvalidTier();
    error InsufficientStake();
    error InsufficientLockAmount();
    error LockNotExpired();
    error NoActiveLock();
    error TierDowngradeNotAllowed();
    error ZeroAmount();
    error AutoCompoundNotAvailable();

    // ============ CONSTRUCTOR ============
    
    constructor(
        address _owner,
        address _stakingToken,
        address _signatureVerifier
    ) Ownable(_owner) {
        stakingToken = IERC20(_stakingToken);
        signatureVerifier = _signatureVerifier;
        lastUpdateTime = block.timestamp;
    }

    // ============ MODIFIERS ============
    
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Calculate reward per token with base APY
     */
    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        
        uint256 timeDelta = block.timestamp - lastUpdateTime;
        uint256 baseReward = (timeDelta * baseAPY * PRECISION) / (SECONDS_PER_YEAR * 10000);
        
        return rewardPerTokenStored + (baseReward * PRECISION) / totalStaked;
    }
    
    /**
     * @notice Calculate earned rewards for an account
     * @param account The user address
     */
    function earned(address account) public view returns (uint256) {
        StakeInfo storage userStake = stakes[account];
        uint256 multiplier = getTierMultiplier(userStake.tier);
        
        uint256 baseEarned = (userStake.amount * (rewardPerToken() - userRewardPerTokenPaid[account])) / PRECISION;
        uint256 multipliedEarned = (baseEarned * multiplier) / 100;
        
        return rewards[account] + multipliedEarned;
    }
    
    /**
     * @notice Get tier multiplier
     * @param tier The subscription tier
     */
    function getTierMultiplier(Tier tier) public pure returns (uint256) {
        if (tier == Tier.BUSINESS) return TIER_BUSINESS_MULTIPLIER;
        if (tier == Tier.CREATOR) return TIER_CREATOR_MULTIPLIER;
        return TIER_STARTER_MULTIPLIER;
    }
    
    /**
     * @notice Get effective APY for a tier
     * @param tier The subscription tier
     */
    function getEffectiveAPY(Tier tier) external view returns (uint256) {
        return (baseAPY * getTierMultiplier(tier)) / 100;
    }
    
    /**
     * @notice Get user's current tier (considering token locks)
     * @param account The user address
     */
    function getUserTier(address account) public view returns (Tier) {
        // Check if user has an active token lock
        TokenLock storage lock = tokenLocks[account];
        if (lock.isActive && block.timestamp < lock.unlockTime) {
            return lock.targetTier;
        }
        
        // Check signature-based tier validity
        StakeInfo storage userStake = stakes[account];
        if (block.timestamp <= userStake.tierValidUntil) {
            return userStake.tier;
        }
        
        // Default to STARTER
        return Tier.STARTER;
    }
    
    /**
     * @notice Get full stake info for a user
     * @param account The user address
     */
    function getStakeInfo(address account) external view returns (
        uint256 stakedAmount,
        uint256 earnedRewards,
        Tier currentTier,
        uint256 effectiveAPY,
        uint256 tierValidUntil,
        bool hasActiveLock,
        bool autoCompound
    ) {
        StakeInfo storage userStake = stakes[account];
        Tier tier = getUserTier(account);
        
        return (
            userStake.amount,
            earned(account),
            tier,
            (baseAPY * getTierMultiplier(tier)) / 100,
            userStake.tierValidUntil,
            tokenLocks[account].isActive,
            userStake.autoCompound
        );
    }

    // ============ STAKING FUNCTIONS ============
    
    /**
     * @notice Stake tokens with default STARTER tier
     * @param amount Amount to stake
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        
        totalStaked += amount;
        
        StakeInfo storage userStake = stakes[msg.sender];
        if (userStake.amount == 0) {
            userStake.stakedAt = block.timestamp;
            userStake.tier = Tier.STARTER;
        }
        userStake.amount += amount;
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount, userStake.tier);
    }
    
    /**
     * @notice Stake tokens with tier verification via backend signature
     * @param amount Amount to stake
     * @param tier Target tier
     * @param validUntil Signature expiration timestamp
     * @param signature Backend signature proving subscription status
     */
    function stakeWithTier(
        uint256 amount,
        Tier tier,
        uint256 validUntil,
        bytes calldata signature
    ) external nonReentrant whenNotPaused updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        if (block.timestamp > validUntil) revert SignatureExpired();
        
        // Verify signature
        _verifyTierSignature(msg.sender, tier, validUntil, signature);
        
        totalStaked += amount;
        
        StakeInfo storage userStake = stakes[msg.sender];
        Tier oldTier = userStake.tier;
        
        if (userStake.amount == 0) {
            userStake.stakedAt = block.timestamp;
        }
        userStake.amount += amount;
        userStake.tier = tier;
        userStake.tierValidUntil = validUntil;
        
        // Enable auto-compound for premium tiers
        if (tier != Tier.STARTER && !userStake.autoCompound) {
            userStake.autoCompound = true;
            emit AutoCompoundToggled(msg.sender, true);
        }
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        emit Staked(msg.sender, amount, tier);
        if (oldTier != tier) {
            emit TierUpgraded(msg.sender, oldTier, tier);
        }
    }
    
    /**
     * @notice Upgrade tier with new signature (no additional stake)
     * @param tier New tier
     * @param validUntil Signature expiration
     * @param signature Backend signature
     */
    function upgradeTier(
        Tier tier,
        uint256 validUntil,
        bytes calldata signature
    ) external nonReentrant whenNotPaused updateReward(msg.sender) {
        if (block.timestamp > validUntil) revert SignatureExpired();
        
        StakeInfo storage userStake = stakes[msg.sender];
        if (tier <= userStake.tier) revert TierDowngradeNotAllowed();
        
        _verifyTierSignature(msg.sender, tier, validUntil, signature);
        
        Tier oldTier = userStake.tier;
        userStake.tier = tier;
        userStake.tierValidUntil = validUntil;
        
        emit TierUpgraded(msg.sender, oldTier, tier);
    }
    
    /**
     * @notice Unstake tokens
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        StakeInfo storage userStake = stakes[msg.sender];
        if (userStake.amount < amount) revert InsufficientStake();
        
        totalStaked -= amount;
        userStake.amount -= amount;
        
        stakingToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }
    
    /**
     * @notice Claim accumulated rewards
     */
    function claimRewards() external nonReentrant whenNotPaused updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            stakingToken.safeTransfer(msg.sender, reward);
            emit RewardClaimed(msg.sender, reward);
        }
    }
    
    /**
     * @notice Compound rewards back into stake
     */
    function compoundRewards() external nonReentrant whenNotPaused updateReward(msg.sender) {
        StakeInfo storage userStake = stakes[msg.sender];
        
        // Only available for CREATOR and BUSINESS tiers
        if (getUserTier(msg.sender) == Tier.STARTER) revert AutoCompoundNotAvailable();
        
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            totalStaked += reward;
            userStake.amount += reward;
            emit Staked(msg.sender, reward, userStake.tier);
        }
    }
    
    /**
     * @notice Unstake all and claim all rewards
     */
    function exit() external nonReentrant whenNotPaused updateReward(msg.sender) {
        StakeInfo storage userStake = stakes[msg.sender];
        uint256 stakedAmount = userStake.amount;
        uint256 reward = rewards[msg.sender];
        
        if (stakedAmount > 0) {
            totalStaked -= stakedAmount;
            userStake.amount = 0;
            stakingToken.safeTransfer(msg.sender, stakedAmount);
            emit Unstaked(msg.sender, stakedAmount);
        }
        
        if (reward > 0) {
            rewards[msg.sender] = 0;
            stakingToken.safeTransfer(msg.sender, reward);
            emit RewardClaimed(msg.sender, reward);
        }
    }

    // ============ TOKEN LOCK FUNCTIONS ============
    
    /**
     * @notice Lock tokens to get free tier access
     * @param targetTier The tier to unlock
     */
    function lockTokensForTier(Tier targetTier) external nonReentrant whenNotPaused {
        if (targetTier == Tier.STARTER) revert InvalidTier();
        
        uint256 requiredAmount;
        uint256 lockDuration;
        
        if (targetTier == Tier.CREATOR) {
            requiredAmount = CREATOR_TOKEN_LOCK;
            lockDuration = CREATOR_LOCK_DURATION;
        } else {
            requiredAmount = BUSINESS_TOKEN_LOCK;
            lockDuration = BUSINESS_LOCK_DURATION;
        }
        
        // Check existing lock
        TokenLock storage existingLock = tokenLocks[msg.sender];
        if (existingLock.isActive) {
            // Upgrade existing lock
            if (targetTier <= existingLock.targetTier) revert TierDowngradeNotAllowed();
            
            // Calculate additional tokens needed
            uint256 additionalAmount = requiredAmount - existingLock.amount;
            stakingToken.safeTransferFrom(msg.sender, address(this), additionalAmount);
            totalLocked += additionalAmount;
            
            existingLock.amount = requiredAmount;
            existingLock.unlockTime = block.timestamp + lockDuration;
            existingLock.targetTier = targetTier;
        } else {
            // New lock
            stakingToken.safeTransferFrom(msg.sender, address(this), requiredAmount);
            totalLocked += requiredAmount;
            
            tokenLocks[msg.sender] = TokenLock({
                amount: requiredAmount,
                lockedAt: block.timestamp,
                unlockTime: block.timestamp + lockDuration,
                targetTier: targetTier,
                isActive: true
            });
        }
        
        emit TokensLocked(msg.sender, requiredAmount, targetTier, block.timestamp + lockDuration);
    }
    
    /**
     * @notice Unlock tokens after lock period expires
     */
    function unlockTokens() external nonReentrant whenNotPaused {
        TokenLock storage lock = tokenLocks[msg.sender];
        if (!lock.isActive) revert NoActiveLock();
        if (block.timestamp < lock.unlockTime) revert LockNotExpired();
        
        uint256 amount = lock.amount;
        totalLocked -= amount;
        
        delete tokenLocks[msg.sender];
        
        stakingToken.safeTransfer(msg.sender, amount);
        emit TokensUnlocked(msg.sender, amount);
    }
    
    /**
     * @notice Extend lock duration to maintain tier access
     */
    function extendLock() external nonReentrant whenNotPaused {
        TokenLock storage lock = tokenLocks[msg.sender];
        if (!lock.isActive) revert NoActiveLock();
        
        uint256 lockDuration = lock.targetTier == Tier.CREATOR 
            ? CREATOR_LOCK_DURATION 
            : BUSINESS_LOCK_DURATION;
            
        lock.unlockTime = block.timestamp + lockDuration;
        
        emit TokensLocked(msg.sender, lock.amount, lock.targetTier, lock.unlockTime);
    }

    // ============ SIGNATURE VERIFICATION ============
    
    /**
     * @dev Verify tier signature from backend
     */
    function _verifyTierSignature(
        address user,
        Tier tier,
        uint256 validUntil,
        bytes calldata signature
    ) internal {
        uint256 nonce = nonces[user];
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            user,
            uint8(tier),
            validUntil,
            nonce,
            block.chainid,
            address(this)
        ));
        
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        
        if (signer != signatureVerifier) revert InvalidSignature();
        
        nonces[user] = nonce + 1;
    }
    
    /**
     * @notice Get current nonce for a user
     * @param user The user address
     */
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Update the signature verifier address
     * @param newVerifier New verifier address
     */
    function setSignatureVerifier(address newVerifier) external onlyOwner {
        address oldVerifier = signatureVerifier;
        signatureVerifier = newVerifier;
        emit SignatureVerifierUpdated(oldVerifier, newVerifier);
    }
    
    /**
     * @notice Update base APY
     * @param newAPY New APY in basis points
     */
    function setBaseAPY(uint256 newAPY) external onlyOwner updateReward(address(0)) {
        uint256 oldAPY = baseAPY;
        baseAPY = newAPY;
        emit BaseAPYUpdated(oldAPY, newAPY);
    }
    
    /**
     * @notice Fund the reward pool
     * @param amount Amount to add
     */
    function fundRewardPool(uint256 amount) external onlyOwner {
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
    }
    
    /**
     * @notice Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency withdraw (only when no stakes)
     */
    function emergencyWithdraw() external onlyOwner {
        require(totalStaked == 0 && totalLocked == 0, "Users have funds");
        uint256 balance = stakingToken.balanceOf(address(this));
        stakingToken.safeTransfer(owner(), balance);
    }
}
