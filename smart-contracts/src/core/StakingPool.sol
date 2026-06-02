// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

interface IValidatorRegistryForStaking {
    function getRewardBoost(address operator) external view returns (uint256);
    function isActiveValidator(address operator) external view returns (bool);
    function getValidatorTier(address operator) external view returns (uint8);
}

/**
 * @title BeZhas Staking Pool
 * @dev Contrato de Single-sided Staking integrado con ValidatorRegistry.
 * Las empresas depositan $BEZ para recibir retornos, fortalecen la seguridad
 * económica de la red L2, y reciben boost de rewards según su tier de validador.
 *
 * Integración con ValidatorRegistry:
 *   - Validadores registrados reciben boost en rewards según tier (1x-2x)
 *   - Non-validators pueden stakear pero sin boost (1x base)
 *   - Se consulta el tier en tiempo real al claim
 */
contract StakingPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public bezToken;
    IValidatorRegistryForStaking public validatorRegistry;
    
    uint256 public rewardRate; 
    /// @notice Maximum reward rate to prevent admin abuse (1 BEZ/s)
    uint256 public constant MAX_REWARD_RATE = 1e18;
    /// @notice Daily emission cap to protect treasury (50,000 BEZ/day = $5,000/day)
    uint256 public constant DAILY_EMISSION_CAP = 50_000 * 1e18;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    // ─── Daily emission tracking ─────────────────────────────────────
    uint256 public currentEpochDay;
    uint256 public epochDailyEmitted;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward, uint256 boostBps);
    event RewardRateUpdated(uint256 newRate);
    event ValidatorRegistryUpdated(address indexed registry);

    constructor(address _bezToken, address _validatorRegistry, address initialOwner) Ownable(initialOwner) {
        bezToken = IERC20(_bezToken);
        validatorRegistry = IValidatorRegistryForStaking(_validatorRegistry);
        rewardRate = 5e16; // 0.05 BEZ/s = 4,320 BEZ/day
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;

        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function rewardPerToken() public view returns (uint256) {
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            (((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / _totalSupply);
    }

    function earned(address account) public view returns (uint256) {
        return
            ((_balances[account] *
                (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18) +
            rewards[account];
    }

    /**
     * @dev Estimación de earned con boost aplicado (para UI)
     */
    function earnedBoosted(address account) public view returns (uint256) {
        uint256 base = earned(account);
        uint256 boost = _getBoost(account);
        return (base * boost) / 10000;
    }

    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        _totalSupply += amount;
        _balances[msg.sender] += amount;
        bezToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        require(_balances[msg.sender] >= amount, "Not enough staked");
        _totalSupply -= amount;
        _balances[msg.sender] -= amount;
        bezToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @dev Claim rewards con boost automático según tier del validador.
     * Validadores Gold (tier 3) = 1.5x, Platinum (tier 4) = 2x.
     * Non-validators o Bronze/Silver reciben base 1x o su boost respectivo.
     */
    function getReward() public nonReentrant updateReward(msg.sender) {
        uint256 baseReward = rewards[msg.sender];
        if (baseReward > 0) {
            uint256 boostBps = _getBoost(msg.sender);
            uint256 boostedReward = (baseReward * boostBps) / 10000;

            // ── Daily emission cap ──
            uint256 today = block.timestamp / 1 days;
            if (today != currentEpochDay) {
                currentEpochDay = today;
                epochDailyEmitted = 0;
            }
            require(epochDailyEmitted + boostedReward <= DAILY_EMISSION_CAP, "SP: daily cap reached");
            epochDailyEmitted += boostedReward;

            rewards[msg.sender] = 0;
            bezToken.safeTransfer(msg.sender, boostedReward);
            emit RewardPaid(msg.sender, boostedReward, boostBps);
        }
    }

    function exit() external {
        withdraw(_balances[msg.sender]);
        getReward();
    }
    
    // ─── Admin ───────────────────────────────────────────────────────

    function setRewardRate(uint256 _rewardRate) external onlyOwner updateReward(address(0)) {
        require(_rewardRate <= MAX_REWARD_RATE, "SP: rate exceeds max");
        rewardRate = _rewardRate;
        emit RewardRateUpdated(rewardRate);
    }

    function setValidatorRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "SP: zero address");
        validatorRegistry = IValidatorRegistryForStaking(_registry);
        emit ValidatorRegistryUpdated(_registry);
    }

    // ─── Vistas ──────────────────────────────────────────────────────

    function getStakerInfo(address account) external view returns (
        uint256 stakedAmount,
        uint256 baseEarned,
        uint256 boostedEarned,
        uint256 boostBps,
        uint8   validatorTier,
        bool    isValidator
    ) {
        uint256 base = earned(account);
        uint256 boost = _getBoost(account);
        bool isVal = address(validatorRegistry) != address(0) && 
                     validatorRegistry.isActiveValidator(account);
        uint8 tier = 0;
        if (isVal) {
            tier = validatorRegistry.getValidatorTier(account);
        }
        return (
            _balances[account],
            base,
            (base * boost) / 10000,
            boost,
            tier,
            isVal
        );
    }

    // ─── Internal ────────────────────────────────────────────────────

    function _getBoost(address account) internal view returns (uint256) {
        if (address(validatorRegistry) == address(0)) return 10000;
        
        uint256 boost = validatorRegistry.getRewardBoost(account);
        return boost > 0 ? boost : 10000; // Default 1x for non-validators
    }
}
