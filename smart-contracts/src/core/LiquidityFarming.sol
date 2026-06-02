// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from
    "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from
    "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BeZhas Liquidity Farming
 * @dev Contrato estilo MasterChef para incentivar la provisión de liquidez ($BEZ y LPs).
 * Implementa bloqueos temporales ("Time-Locks") que aumentan el multiplicador de
 * recompensas en $BEZ por bloque.
 */
contract LiquidityFarming is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Info del usuario
    struct UserInfo {
        uint128 amount; // Cantidad de LP tokens apostados
        uint128 rewardDebt; // Deuda de recompensa (cálculo matemático estándar en dApps)
        uint64 lockEndTimestamp; // Timestamp donde finaliza el bloqueo (si hay)
        uint64 multiplier; // Multiplicador base activo (ej. 100 = 1x, 200 = 2x)
    }

    // Info de la Pool
    struct PoolInfo {
        IERC20 lpToken; // Contrato del Token LP
        uint128 allocPoint; // Puntos de asignación de la pool dictan su peso
        uint64 lastRewardBlock; // Último bloque en el que la distribución ocurrió
        uint64 isLP; // 1 si es LP, 0 si es staking simple
        uint256 accBezPerShare; // BEZ acumulado por accion (x1e12 para precisión)
    }

    IERC20 public bez; // Token de recompensa
    uint256 public bezPerBlock; // Emisión por bloque
    uint256 public constant MAX_BEZ_PER_BLOCK = 5e18; // 5 BEZ max per block
    uint256 public constant DAILY_EMISSION_CAP = 25_000 * 1e18; // 25K BEZ/day = $2,500/day

    // ─── Daily emission tracking ───
    uint256 public currentEpochDay;
    uint256 public epochDailyEmitted;

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    uint256 public totalAllocPoint = 0;
    uint256 public startBlock;

    event Deposit(
        address indexed user,
        uint256 indexed pid,
        uint256 amount,
        uint256 lockDuration
    );
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user, uint256 indexed pid, uint256 amount
    );
    event Claim(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        IERC20 _bez,
        uint256 _bezPerBlock,
        uint256 _startBlock,
        address initialOwner
    ) Ownable(initialOwner) {
        bez = _bez;
        bezPerBlock = _bezPerBlock;
        startBlock = _startBlock;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Agregar nueva pool de liquidez
    function add(
        uint128 _allocPoint,
        IERC20 _lpToken,
        bool _withUpdate,
        bool _isLP
    ) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint64 lastRewardBlock =
            uint64(block.number > startBlock ? block.number : startBlock);
        totalAllocPoint = totalAllocPoint + _allocPoint;
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                isLP: _isLP ? 1 : 0,
                accBezPerShare: 0
            })
        );
    }

    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0 || pool.allocPoint == 0) {
            pool.lastRewardBlock = uint64(block.number);
            return;
        }
        uint256 multiplierBlocks = block.number - pool.lastRewardBlock;
        uint256 bezReward =
            multiplierBlocks * bezPerBlock * pool.allocPoint / totalAllocPoint;

        // No minteamos aquí, asumimos que el contrato tiene reservas o el Owner le inyectó fondos
        pool.accBezPerShare =
            pool.accBezPerShare + (bezReward * 1e12 / lpSupply);
        pool.lastRewardBlock = uint64(block.number);
    }

    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    /**
     * @dev Convierte duración en días a un multiplicador para los rewards
     */
    function _getLockMultiplier(uint256 _lockDays)
        internal
        pure
        returns (uint256)
    {
        if (_lockDays >= 365) return 300; // 3x Boost
        if (_lockDays >= 180) return 200; // 2x Boost
        if (_lockDays >= 90) return 150; // 1.5x Boost
        if (_lockDays >= 30) return 125; // 1.25x Boost
        if (_lockDays >= 7) return 110; // 1.1x Boost
        return 100; // Sin Boost (1x)
    }

    function deposit(uint256 _pid, uint256 _amount, uint256 _lockDays)
        public
        nonReentrant
    {
        // Seguridad: sólo se leen balances de LP, nunca reserves ni precios del pool LP
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);

        // Pre-calculo de multiplicador basado en tiempo
        uint256 newMultiplier = _getLockMultiplier(_lockDays);
        if (user.amount > 0) {
            require(
                newMultiplier >= user.multiplier, "Cannot downgrade multiplier"
            );
            require(
                block.timestamp + (_lockDays * 1 days) >= user.lockEndTimestamp,
                "Cannot shorten lock"
            );
            // No auto-claim, sólo actualiza rewards pendientes
        } else {
            user.multiplier = uint64(newMultiplier);
        }

        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(
                address(msg.sender), address(this), _amount
            );
            user.amount = uint128(user.amount + _amount);

            if (_lockDays > 0) {
                user.lockEndTimestamp =
                    uint64(block.timestamp + (_lockDays * 1 days));
            }
        }

        user.rewardDebt = uint128(user.amount * pool.accBezPerShare / 1e12);
        emit Deposit(msg.sender, _pid, _amount, _lockDays);
    }

    function claim(uint256 _pid) public nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        uint256 pending =
            (user.amount * pool.accBezPerShare / 1e12) - user.rewardDebt;
        pending = pending * user.multiplier / 100;
        if (pending > 0) {
            // ── Daily emission cap ──
            uint256 today = block.number / 43200; // ~43200 blocks/day at 2s
            if (today != currentEpochDay) {
                currentEpochDay = today;
                epochDailyEmitted = 0;
            }
            require(epochDailyEmitted + pending <= DAILY_EMISSION_CAP, "LF: daily cap reached");
            epochDailyEmitted += pending;

            _safeBezTransfer(msg.sender, pending);
            emit Claim(msg.sender, _pid, pending);
        }
        user.rewardDebt = uint128(user.amount * pool.accBezPerShare / 1e12);
    }

    function withdraw(uint256 _pid, uint256 _amount) public nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "Withdraw amount > balance");

        if (_amount > 0 && user.lockEndTimestamp > 0) {
            require(
                block.timestamp >= user.lockEndTimestamp, "Tokens are locked"
            );
        }

        updatePool(_pid);

        // No auto-claim, sólo actualiza rewards pendientes

        if (_amount > 0) {
            user.amount = uint128(user.amount - _amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);

            // Si retira todo, reset a 1x y sin lock
            if (user.amount == 0) {
                user.multiplier = 100;
                user.lockEndTimestamp = 0;
            }
        }
        user.rewardDebt = uint128(user.amount * pool.accBezPerShare / 1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    function emergencyWithdraw(uint256 _pid) public nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint128 amount = user.amount;
        require(amount > 0, "Nothing to withdraw");
        user.amount = 0;
        user.rewardDebt = 0;
        user.lockEndTimestamp = 0;
        user.multiplier = 100;
        pool.lpToken.safeTransfer(msg.sender, amount);
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    // Visualizar recompensas pendientes
    function pendingBez(uint256 _pid, address _user)
        external
        view
        returns (uint256)
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accBezPerShare = pool.accBezPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplierBlocks = block.number - pool.lastRewardBlock;
            uint256 bezReward = multiplierBlocks * bezPerBlock * pool.allocPoint
                / totalAllocPoint;
            accBezPerShare = accBezPerShare + (bezReward * 1e12 / lpSupply);
        }
        uint256 basePending =
            (user.amount * accBezPerShare / 1e12) - user.rewardDebt;
        return basePending * user.multiplier / 100;
    }

    // Helper interno seguro
    function _safeBezTransfer(address _to, uint256 _amount) internal {
        uint256 bezBal = bez.balanceOf(address(this));
        if (_amount > bezBal) {
            bez.transfer(_to, bezBal);
        } else {
            bez.transfer(_to, _amount);
        }
    }

    // ─── Admin ───────────────────────────────────────────────────
    function setBezPerBlock(uint256 _bezPerBlock) external onlyOwner {
        require(_bezPerBlock <= MAX_BEZ_PER_BLOCK, "LF: exceeds max per block");
        massUpdatePools();
        bezPerBlock = _bezPerBlock;
    }
}
