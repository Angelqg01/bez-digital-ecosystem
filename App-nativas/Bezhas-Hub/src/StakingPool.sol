// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title StakingPool
 * @dev Allows users to stake BEZ tokens and earn rewards.
 */
contract StakingPool is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public stakingToken; // The BEZ token

    struct Stake {
        uint256 amount;
        uint256 since;
    }

    mapping(address => Stake) public stakes;
    mapping(address => uint256) private _rewards;
    mapping(address => uint256) private _userRewardPerTokenPaid;

    uint256 public totalStaked;
    uint256 public rewardRate; // Amount of tokens rewarded per second
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    constructor(address initialOwner, address _stakingTokenAddress) Ownable(initialOwner) {
        stakingToken = IERC20(_stakingTokenAddress);
        lastUpdateTime = block.timestamp;
        rewardRate = 1; // Example: 1 token per second, can be adjusted
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + ((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / totalStaked;
    }

    function earned(address account) public view returns (uint256) {
        return (stakes[account].amount * (rewardPerToken() - _userRewardPerTokenPaid[account])) / 1e18 + _rewards[account];
    }

    modifier _updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            _rewards[account] = earned(account);
            _userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function stake(uint256 amount) external nonReentrant whenNotPaused _updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");

        totalStaked += amount;
        if (stakes[msg.sender].amount == 0) {
            stakes[msg.sender].since = block.timestamp;
        }
        stakes[msg.sender].amount += amount;

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant whenNotPaused _updateReward(msg.sender) {
        require(stakes[msg.sender].amount >= amount, "Cannot unstake more than you have staked");

        totalStaked -= amount;
        stakes[msg.sender].amount -= amount;

        stakingToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimReward() external nonReentrant whenNotPaused _updateReward(msg.sender) {
        uint256 reward = _rewards[msg.sender];
        if (reward > 0) {
            _rewards[msg.sender] = 0;
            stakingToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function unstakeAndClaim(uint256 amount) external nonReentrant whenNotPaused _updateReward(msg.sender) {
        // Unstake first
        require(stakes[msg.sender].amount >= amount, "Cannot unstake more than you have staked");
        totalStaked -= amount;
        stakes[msg.sender].amount -= amount;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);

        // Then claim rewards
        uint256 reward = _rewards[msg.sender];
        if (reward > 0) {
            _rewards[msg.sender] = 0;
            stakingToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    // --- Admin Functions ---

    function setRewardRate(uint256 _newRate) public onlyOwner _updateReward(address(0)) {
        require(_newRate > 0, "Reward rate must be greater than 0");
        rewardRate = _newRate;
    }

    function fund(uint256 amount) public onlyOwner whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
    }
    
    function emergencyWithdraw() external onlyOwner {
        // Only allow emergency withdraw when no user stakes remain
        require(totalStaked == 0, "Cannot withdraw while users are staked");
        uint256 balance = stakingToken.balanceOf(address(this));
        stakingToken.safeTransfer(owner(), balance);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
