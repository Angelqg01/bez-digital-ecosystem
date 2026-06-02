// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ValidatorRegistry
 * @dev Registro central de validadores corporativos para BeZhas L2.
 * Implementa un sistema PoA + PoS + Proof of Contribution donde las empresas
 * ganan influencia e ingresos proporcionales a su stake + contribución operacional.
 *
 * Tiers:
 *   1 = Bronze  (10K BEZ)   → Edge Node rewards base
 *   2 = Silver  (50K BEZ)   → + DAO voting + tx priority + 25% reward boost
 *   3 = Gold    (250K BEZ)  → + Sequencer candidate + 50% reward boost
 *   4 = Platinum (1M BEZ)   → + Active sequencer + council seat + 100% reward boost
 */
contract ValidatorRegistry is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

    IERC20 public bezToken;

    // ─── Tier Thresholds (en wei, 18 decimals) ──────────────────────
    uint256 public constant TIER_BRONZE   = 10_000   * 1e18;
    uint256 public constant TIER_SILVER   = 50_000   * 1e18;
    uint256 public constant TIER_GOLD     = 250_000  * 1e18;
    uint256 public constant TIER_PLATINUM = 1_000_000 * 1e18;

    // Reward boost por tier (en basis points: 10000 = 100%)
    uint256 public constant BOOST_BRONZE   = 10000; // 100% base (1x)
    uint256 public constant BOOST_SILVER   = 12500; // 125% (1.25x)
    uint256 public constant BOOST_GOLD     = 15000; // 150% (1.5x)
    uint256 public constant BOOST_PLATINUM = 20000; // 200% (2x)

    uint256 public constant UNBONDING_PERIOD = 7 days;
    uint256 public constant MIN_UPTIME_BPS = 9000; // 90% mínimo para mantenerse activo

    struct Validator {
        address operator;
        string  companyName;
        uint256 stakedAmount;
        uint256 contributionPoints;
        uint256 totalRewardsEarned;
        uint256 lastHeartbeat;
        uint256 uptimeNumerator;   // Heartbeats exitosos
        uint256 uptimeDenominator; // Heartbeats esperados
        uint256 registeredAt;
        uint256 unbondingStart;    // 0 = no existe unbonding activo
        uint256 unbondingAmount;
        uint8   tier;              // 1-4
        bool    isActive;
        bool    isSequencerEligible;
    }

    mapping(address => Validator) public validators;
    address[] public validatorList;
    mapping(address => bool) public isRegistered;

    uint256 public totalStaked;
    uint256 public activeValidatorCount;

    // ─── Eventos del ecosistema de validación ────────────────────────
    event ValidatorRegistered(address indexed operator, string companyName, uint256 initialStake);
    event StakeAdded(address indexed operator, uint256 amount, uint8 newTier);
    event UnbondingInitiated(address indexed operator, uint256 amount, uint256 availableAt);
    event StakeWithdrawn(address indexed operator, uint256 amount);
    event TierUpdated(address indexed operator, uint8 oldTier, uint8 newTier);
    event HeartbeatRecorded(address indexed operator, uint256 timestamp);
    event ContributionRecorded(address indexed operator, uint256 points, string taskType);
    event ValidatorSlashed(address indexed operator, uint256 amount, string reason);
    event ValidatorDeactivated(address indexed operator, string reason);
    event ValidatorReactivated(address indexed operator);
    event SequencerEligibilityUpdated(address indexed operator, bool eligible);

    constructor(address _bezToken, address defaultAdmin) {
        bezToken = IERC20(_bezToken);
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    // ─── Registro de Validador ───────────────────────────────────────

    function registerValidator(string calldata companyName, uint256 stakeAmount) 
        external nonReentrant 
    {
        require(!isRegistered[msg.sender], "VR: already registered");
        require(stakeAmount >= TIER_BRONZE, "VR: stake below Bronze minimum");

        bezToken.safeTransferFrom(msg.sender, address(this), stakeAmount);
        
        uint8 tier = _calculateTier(stakeAmount);

        validators[msg.sender] = Validator({
            operator: msg.sender,
            companyName: companyName,
            stakedAmount: stakeAmount,
            contributionPoints: 0,
            totalRewardsEarned: 0,
            lastHeartbeat: block.timestamp,
            uptimeNumerator: 1,
            uptimeDenominator: 1,
            registeredAt: block.timestamp,
            unbondingStart: 0,
            unbondingAmount: 0,
            tier: tier,
            isActive: true,
            isSequencerEligible: tier >= 3
        });

        validatorList.push(msg.sender);
        isRegistered[msg.sender] = true;
        totalStaked += stakeAmount;
        activeValidatorCount++;

        emit ValidatorRegistered(msg.sender, companyName, stakeAmount);
        if (tier >= 3) {
            emit SequencerEligibilityUpdated(msg.sender, true);
        }
    }

    // ─── Añadir Stake ────────────────────────────────────────────────

    function addStake(uint256 amount) external nonReentrant {
        require(isRegistered[msg.sender], "VR: not registered");
        require(validators[msg.sender].isActive, "VR: validator not active");
        require(amount > 0, "VR: zero amount");

        bezToken.safeTransferFrom(msg.sender, address(this), amount);

        Validator storage v = validators[msg.sender];
        v.stakedAmount += amount;
        totalStaked += amount;

        uint8 oldTier = v.tier;
        uint8 newTier = _calculateTier(v.stakedAmount);
        
        if (newTier != oldTier) {
            v.tier = newTier;
            v.isSequencerEligible = newTier >= 3;
            emit TierUpdated(msg.sender, oldTier, newTier);
            emit SequencerEligibilityUpdated(msg.sender, newTier >= 3);
        }

        emit StakeAdded(msg.sender, amount, v.tier);
    }

    // ─── Iniciar Unbonding (período de desbloqueo) ───────────────────

    function initiateUnbonding(uint256 amount) external {
        Validator storage v = validators[msg.sender];
        require(isRegistered[msg.sender], "VR: not registered");
        require(v.unbondingStart == 0, "VR: unbonding already in progress");
        require(amount > 0 && amount <= v.stakedAmount, "VR: invalid amount");
        
        // Verificar que tras el unbonding el validador mantiene el tier mínimo o se desactiva
        uint256 remainingStake = v.stakedAmount - amount;
        
        v.unbondingStart = block.timestamp;
        v.unbondingAmount = amount;

        // Si cae bajo el mínimo Bronze, se desactiva
        if (remainingStake < TIER_BRONZE) {
            v.isActive = false;
            activeValidatorCount--;
            emit ValidatorDeactivated(msg.sender, "Stake below minimum after unbonding");
        } else {
            uint8 oldTier = v.tier;
            uint8 newTier = _calculateTier(remainingStake);
            if (newTier != oldTier) {
                v.tier = newTier;
                v.isSequencerEligible = newTier >= 3;
                emit TierUpdated(msg.sender, oldTier, newTier);
                emit SequencerEligibilityUpdated(msg.sender, newTier >= 3);
            }
        }

        emit UnbondingInitiated(msg.sender, amount, block.timestamp + UNBONDING_PERIOD);
    }

    // ─── Completar Withdraw tras unbonding ───────────────────────────

    function completeWithdraw() external nonReentrant {
        Validator storage v = validators[msg.sender];
        require(v.unbondingStart > 0, "VR: no unbonding active");
        require(block.timestamp >= v.unbondingStart + UNBONDING_PERIOD, "VR: unbonding not complete");

        uint256 amount = v.unbondingAmount;
        v.stakedAmount -= amount;
        v.unbondingStart = 0;
        v.unbondingAmount = 0;
        totalStaked -= amount;

        bezToken.safeTransfer(msg.sender, amount);

        emit StakeWithdrawn(msg.sender, amount);
    }

    // ─── Heartbeat (prueba de que el nodo está vivo) ─────────────────

    function heartbeat() external {
        Validator storage v = validators[msg.sender];
        require(isRegistered[msg.sender], "VR: not registered");
        require(v.isActive, "VR: not active");

        v.lastHeartbeat = block.timestamp;
        v.uptimeNumerator++;
        v.uptimeDenominator++;

        emit HeartbeatRecorded(msg.sender, block.timestamp);
    }

    // ─── Registro de Contribución (llamado por Oracle / Aegis AI) ────

    function recordContribution(address operator, uint256 points, string calldata taskType) 
        external onlyRole(ORACLE_ROLE) 
    {
        require(isRegistered[operator], "VR: not registered");
        Validator storage v = validators[operator];
        require(v.isActive, "VR: not active");

        v.contributionPoints += points;
        emit ContributionRecorded(operator, points, taskType);
    }

    // ─── Slashing (llamado por SlashingManager) ──────────────────────

    function slash(address operator, uint256 amount, string calldata reason) 
        external onlyRole(SLASHER_ROLE) nonReentrant 
    {
        Validator storage v = validators[operator];
        require(isRegistered[operator], "VR: not registered");

        uint256 slashAmount = amount > v.stakedAmount ? v.stakedAmount : amount;
        v.stakedAmount -= slashAmount;
        totalStaked -= slashAmount;

        // Los fondos slasheados van al treasury (DEFAULT_ADMIN)
        // El admin puede luego redirigir al TreasuryVault
        bezToken.safeTransfer(msg.sender, slashAmount);

        // Recalcular tier
        uint8 oldTier = v.tier;
        if (v.stakedAmount < TIER_BRONZE) {
            v.isActive = false;
            v.tier = 0;
            v.isSequencerEligible = false;
            activeValidatorCount--;
            emit ValidatorDeactivated(operator, reason);
        } else {
            uint8 newTier = _calculateTier(v.stakedAmount);
            if (newTier != oldTier) {
                v.tier = newTier;
                v.isSequencerEligible = newTier >= 3;
                emit TierUpdated(operator, oldTier, newTier);
            }
        }

        emit ValidatorSlashed(operator, slashAmount, reason);
    }

    // ─── Reactivar validador desactivado ─────────────────────────────

    function reactivateValidator(uint256 stakeAmount) external nonReentrant {
        require(isRegistered[msg.sender], "VR: not registered");
        Validator storage v = validators[msg.sender];
        require(!v.isActive, "VR: already active");

        uint256 totalAfter = v.stakedAmount + stakeAmount;
        require(totalAfter >= TIER_BRONZE, "VR: stake below minimum");

        if (stakeAmount > 0) {
            bezToken.safeTransferFrom(msg.sender, address(this), stakeAmount);
            v.stakedAmount += stakeAmount;
            totalStaked += stakeAmount;
        }

        v.isActive = true;
        v.tier = _calculateTier(v.stakedAmount);
        v.isSequencerEligible = v.tier >= 3;
        v.lastHeartbeat = block.timestamp;
        activeValidatorCount++;

        emit ValidatorReactivated(msg.sender);
    }

    // ─── Incremento de denominator para uptime tracking (Oracle) ─────

    function recordExpectedHeartbeat(address operator) external onlyRole(ORACLE_ROLE) {
        require(isRegistered[operator], "VR: not registered");
        validators[operator].uptimeDenominator++;
    }

    // ─── Vistas ──────────────────────────────────────────────────────

    function getValidatorInfo(address operator) external view returns (
        string memory companyName,
        uint256 stakedAmount,
        uint256 contributionPoints,
        uint8 tier,
        bool isActive,
        bool isSequencerEligible,
        uint256 uptimePercent
    ) {
        Validator storage v = validators[operator];
        uint256 uptime = v.uptimeDenominator > 0 
            ? (v.uptimeNumerator * 10000) / v.uptimeDenominator 
            : 0;
        return (
            v.companyName,
            v.stakedAmount,
            v.contributionPoints,
            v.tier,
            v.isActive,
            v.isSequencerEligible,
            uptime
        );
    }

    function getRewardBoost(address operator) external view returns (uint256) {
        Validator storage v = validators[operator];
        if (!v.isActive) return 0;
        return _getBoostForTier(v.tier);
    }

    function getValidatorCount() external view returns (uint256) {
        return validatorList.length;
    }

    function getActiveSequencerCandidates() external view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].isSequencerEligible && 
                validators[validatorList[i]].isActive) {
                count++;
            }
        }

        address[] memory candidates = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].isSequencerEligible && 
                validators[validatorList[i]].isActive) {
                candidates[idx] = validatorList[i];
                idx++;
            }
        }
        return candidates;
    }

    function getValidatorTier(address operator) external view returns (uint8) {
        return validators[operator].tier;
    }

    function getStakedAmount(address operator) external view returns (uint256) {
        return validators[operator].stakedAmount;
    }

    function isActiveValidator(address operator) external view returns (bool) {
        return validators[operator].isActive;
    }

    // ─── Internals ───────────────────────────────────────────────────

    function _calculateTier(uint256 amount) internal pure returns (uint8) {
        if (amount >= TIER_PLATINUM) return 4;
        if (amount >= TIER_GOLD) return 3;
        if (amount >= TIER_SILVER) return 2;
        if (amount >= TIER_BRONZE) return 1;
        return 0;
    }

    function _getBoostForTier(uint8 tier) internal pure returns (uint256) {
        if (tier == 4) return BOOST_PLATINUM;
        if (tier == 3) return BOOST_GOLD;
        if (tier == 2) return BOOST_SILVER;
        if (tier == 1) return BOOST_BRONZE;
        return 0;
    }
}
