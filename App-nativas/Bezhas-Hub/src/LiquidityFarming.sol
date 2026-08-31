// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract LiquidityFarming is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct PoolInfo {
        IERC20 lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accRewardPerShare;
        uint256 totalStaked;
        uint256 minStakeAmount;
        uint256 maxStakeAmount;
        bool isActive;
    }

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 pendingRewards;
        uint256 lastStakeTime;
        uint256 lockEndTime;
        uint256 multiplier;
    }

    IERC20 public immutable rewardToken;
    uint256 public rewardPerBlock;
    uint256 public totalAllocPoint;
    uint256 public startBlock;
    uint256 public bonusEndBlock;
    uint256 public constant BONUS_MULTIPLIER = 2;

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    mapping(address => bool) public authorizedPools;

    // Bonus multipliers for lock periods
    mapping(uint256 => uint256) public lockMultipliers;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event RewardPaid(address indexed user, uint256 amount);
    event PoolAdded(uint256 indexed pid, address lpToken, uint256 allocPoint);
    event PoolUpdated(uint256 indexed pid, uint256 allocPoint);

    constructor(
        IERC20 _rewardToken,
        uint256 _rewardPerBlock,
        uint256 _startBlock,
        uint256 _bonusEndBlock
    ) {
        rewardToken = _rewardToken;
        rewardPerBlock = _rewardPerBlock;
        startBlock = _startBlock;
        bonusEndBlock = _bonusEndBlock;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        // Set default lock multipliers
        lockMultipliers[0] = 10000; // No lock: 1x
        lockMultipliers[7 days] = 11000; // 1 week: 1.1x
        lockMultipliers[30 days] = 12500; // 1 month: 1.25x
        lockMultipliers[90 days] = 15000; // 3 months: 1.5x
        lockMultipliers[180 days] = 20000; // 6 months: 2x
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function addPool(
        uint256 _allocPoint,
        IERC20 _lpToken,
        uint256 _minStakeAmount,
        uint256 _maxStakeAmount,
        bool _withUpdate
    ) external onlyRole(ADMIN_ROLE) {
        require(!authorizedPools[address(_lpToken)], "Pool already exists");
        
        if (_withUpdate) {
            massUpdatePools();
        }

        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint += _allocPoint;
        authorizedPools[address(_lpToken)] = true;

        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accRewardPerShare: 0,
            totalStaked: 0,
            minStakeAmount: _minStakeAmount,
            maxStakeAmount: _maxStakeAmount,
            isActive: true
        }));

        emit PoolAdded(poolInfo.length - 1, address(_lpToken), _allocPoint);
    }

    function setPool(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) external onlyRole(ADMIN_ROLE) {
        require(_pid < poolInfo.length, "Invalid pool ID");
        
        if (_withUpdate) {
            massUpdatePools();
        }

        totalAllocPoint = totalAllocPoint - poolInfo[_pid].allocPoint + _allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;

        emit PoolUpdated(_pid, _allocPoint);
    }

    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= bonusEndBlock) {
            return (_to - _from) * BONUS_MULTIPLIER;
        } else if (_from >= bonusEndBlock) {
            return _to - _from;
        } else {
            return (bonusEndBlock - _from) * BONUS_MULTIPLIER + (_to - bonusEndBlock);
        }
    }

    function pendingReward(uint256 _pid, address _user) external view returns (uint256) {
        require(_pid < poolInfo.length, "Invalid pool ID");
        
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accRewardPerShare = pool.accRewardPerShare;
        uint256 lpSupply = pool.totalStaked;

        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 reward = (multiplier * rewardPerBlock * pool.allocPoint) / totalAllocPoint;
            accRewardPerShare += (reward * 1e12) / lpSupply;
        }

        uint256 pending = ((user.amount * accRewardPerShare) / 1e12) - user.rewardDebt;
        return (pending * user.multiplier) / 10000;
    }

    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    function updatePool(uint256 _pid) public {
        require(_pid < poolInfo.length, "Invalid pool ID");
        
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }

        uint256 lpSupply = pool.totalStaked;
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 reward = (multiplier * rewardPerBlock * pool.allocPoint) / totalAllocPoint;
        pool.accRewardPerShare += (reward * 1e12) / lpSupply;
        pool.lastRewardBlock = block.number;
    }

    function deposit(uint256 _pid, uint256 _amount, uint256 _lockPeriod) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(_pid < poolInfo.length, "Invalid pool ID");
        require(_amount > 0, "Amount must be greater than 0");
        require(lockMultipliers[_lockPeriod] > 0, "Invalid lock period");

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(pool.isActive, "Pool is not active");
        require(_amount >= pool.minStakeAmount, "Amount below minimum");
        require(user.amount + _amount <= pool.maxStakeAmount, "Amount exceeds maximum");

        updatePool(_pid);

        if (user.amount > 0) {
            uint256 pending = ((user.amount * pool.accRewardPerShare) / 1e12) - user.rewardDebt;
            if (pending > 0) {
                user.pendingRewards += (pending * user.multiplier) / 10000;
            }
        }

        pool.lpToken.safeTransferFrom(msg.sender, address(this), _amount);
        user.amount += _amount;
        user.lastStakeTime = block.timestamp;
        user.lockEndTime = block.timestamp + _lockPeriod;
        user.multiplier = lockMultipliers[_lockPeriod];
        user.rewardDebt = (user.amount * pool.accRewardPerShare) / 1e12;

        pool.totalStaked += _amount;

        emit Deposit(msg.sender, _pid, _amount);
    }

    function withdraw(uint256 _pid, uint256 _amount) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(_pid < poolInfo.length, "Invalid pool ID");
        
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(user.amount >= _amount, "Insufficient balance");
        require(block.timestamp >= user.lockEndTime, "Tokens are still locked");

        updatePool(_pid);

        uint256 pending = ((user.amount * pool.accRewardPerShare) / 1e12) - user.rewardDebt;
        if (pending > 0) {
            user.pendingRewards += (pending * user.multiplier) / 10000;
        }

        user.amount -= _amount;
        user.rewardDebt = (user.amount * pool.accRewardPerShare) / 1e12;
        pool.totalStaked -= _amount;

        pool.lpToken.safeTransfer(msg.sender, _amount);

        emit Withdraw(msg.sender, _pid, _amount);
    }

    function claimRewards(uint256 _pid) external nonReentrant whenNotPaused {
        require(_pid < poolInfo.length, "Invalid pool ID");
        
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        updatePool(_pid);

        uint256 pending = ((user.amount * pool.accRewardPerShare) / 1e12) - user.rewardDebt;
        uint256 totalRewards = user.pendingRewards + (pending * user.multiplier) / 10000;

        if (totalRewards > 0) {
            user.pendingRewards = 0;
            user.rewardDebt = (user.amount * pool.accRewardPerShare) / 1e12;
            
            rewardToken.safeTransfer(msg.sender, totalRewards);
            emit RewardPaid(msg.sender, totalRewards);
        }
    }

    function emergencyWithdraw(uint256 _pid) external nonReentrant {
        require(_pid < poolInfo.length, "Invalid pool ID");
        
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        user.pendingRewards = 0;
        pool.totalStaked -= amount;

        pool.lpToken.safeTransfer(msg.sender, amount);
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    function getUserInfo(uint256 _pid, address _user) 
        external 
        view 
        returns (
            uint256 amount,
            uint256 rewardDebt,
            uint256 pendingRewards,
            uint256 lockEndTime,
            uint256 multiplier
        ) 
    {
        UserInfo storage user = userInfo[_pid][_user];
        return (
            user.amount,
            user.rewardDebt,
            user.pendingRewards,
            user.lockEndTime,
            user.multiplier
        );
    }

    function getPoolInfo(uint256 _pid) 
        external 
        view 
        returns (
            address lpToken,
            uint256 allocPoint,
            uint256 totalStaked,
            uint256 accRewardPerShare,
            bool isActive
        ) 
    {
        require(_pid < poolInfo.length, "Invalid pool ID");
        PoolInfo storage pool = poolInfo[_pid];
        return (
            address(pool.lpToken),
            pool.allocPoint,
            pool.totalStaked,
            pool.accRewardPerShare,
            pool.isActive
        );
    }

    // Admin functions
    function setRewardPerBlock(uint256 _rewardPerBlock) external onlyRole(ADMIN_ROLE) {
        massUpdatePools();
        rewardPerBlock = _rewardPerBlock;
    }

    function setLockMultiplier(uint256 _lockPeriod, uint256 _multiplier) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(_multiplier >= 10000, "Multiplier must be at least 1x");
        lockMultipliers[_lockPeriod] = _multiplier;
    }

    function setPoolActive(uint256 _pid, bool _isActive) external onlyRole(ADMIN_ROLE) {
        require(_pid < poolInfo.length, "Invalid pool ID");
        poolInfo[_pid].isActive = _isActive;
    }

    function withdrawRewardTokens(uint256 _amount) external onlyRole(ADMIN_ROLE) {
        rewardToken.safeTransfer(msg.sender, _amount);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
