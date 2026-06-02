// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

interface IValidatorRegistry {
    function getRewardBoost(address operator) external view returns (uint256);
    function isActiveValidator(address operator) external view returns (bool);
    function recordContribution(address operator, uint256 points, string calldata taskType) external;
}

/**
 * @title EdgeNodeRewards
 * @dev Sistema DePIN (Minería B2B) integrado con ValidatorRegistry.
 * Recompensa a las empresas por procesar datos IoT, validar manifiestos
 * y usar la IA nativa del protocolo BeZhas. El boost de rewards depende
 * del tier del validador en ValidatorRegistry.
 *
 * Puntos por tipo de tarea:
 *   - IoT Traceability:        5 pts
 *   - AI Image Verification:   10 pts
 *   - Compliance Check:        15 pts
 *   - Supply Chain Validation:  8 pts
 *   - Smart Contract Deploy:   20 pts
 *   - DAO Vote Participation:   3 pts
 *   - Enterprise Referral:     50 pts
 */
contract EdgeNodeRewards is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    IERC20 public bezToken;
    IValidatorRegistry public validatorRegistry;

    uint256 public rewardPerPoint = 75e14; // 0.0075 BEZ por punto base (antes de boost)

    /// @notice Max rewardPerPoint admin can set (10 BEZ per point)
    uint256 public constant MAX_REWARD_PER_POINT = 10e18;

    /// @notice Daily emission cap in BEZ (100,000 BEZ/day)
    uint256 public constant DAILY_EMISSION_CAP = 100_000 * 1e18;

    /// @notice Max points per node per day (prevents oracle abuse)
    uint256 public constant MAX_POINTS_PER_NODE_PER_DAY = 10_000;

    /// @notice Max points per single recordValidation call
    uint256 public constant MAX_POINTS_PER_RECORD = 500;

    /// @notice Epoch-based daily emission tracking
    uint256 public currentEpochDay;
    uint256 public epochDailyEmitted;

    /// @notice Per-node daily points tracking
    mapping(address => uint256) public nodeDailyPoints;
    mapping(address => uint256) public nodeLastPointsDay;

    struct NodeStats {
        uint256 totalValidations;
        uint256 claimablePoints;
        uint256 totalBEZEarned;
        uint256 lastActivity;
        bool    isActive;
    }

    mapping(address => NodeStats) public nodeStats;
    address[] public activeNodes;
    mapping(address => bool) private _isNode;

    uint256 public totalPointsDistributed;
    uint256 public totalBEZDistributed;

    // ─── Eventos ─────────────────────────────────────────────────────
    event NodeRegistered(address indexed nodeAddress);
    event NodeDeactivated(address indexed nodeAddress);
    event ValidationRecorded(address indexed nodeAddress, uint256 points, string taskType);
    event RewardsClaimed(address indexed nodeAddress, uint256 bezAmount, uint256 boostBps);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);
    event ValidatorRegistryUpdated(address indexed newRegistry);

    constructor(address _bezToken, address _validatorRegistry, address defaultAdmin) {
        bezToken = IERC20(_bezToken);
        validatorRegistry = IValidatorRegistry(_validatorRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    // ─── Registro de nodo edge (requiere ser validador activo) ───────

    function registerNode() external {
        require(!_isNode[msg.sender], "ENR: already registered");
        require(validatorRegistry.isActiveValidator(msg.sender), "ENR: must be active validator");

        nodeStats[msg.sender] = NodeStats({
            totalValidations: 0,
            claimablePoints: 0,
            totalBEZEarned: 0,
            lastActivity: block.timestamp,
            isActive: true
        });

        activeNodes.push(msg.sender);
        _isNode[msg.sender] = true;

        emit NodeRegistered(msg.sender);
    }

    // ─── Registrar validación (Oracle / Aegis AI) ────────────────────

    function recordValidation(
        address nodeAddress, 
        uint256 points, 
        string calldata taskType
    ) external onlyRole(ORACLE_ROLE) {
        require(_isNode[nodeAddress], "ENR: not registered node");
        require(nodeStats[nodeAddress].isActive, "ENR: node not active");
        require(points > 0, "ENR: zero points");
        require(points <= MAX_POINTS_PER_RECORD, "ENR: points exceed max per record");

        // Per-node daily cap
        uint256 today = block.timestamp / 1 days;
        if (nodeLastPointsDay[nodeAddress] != today) {
            nodeDailyPoints[nodeAddress] = 0;
            nodeLastPointsDay[nodeAddress] = today;
        }
        nodeDailyPoints[nodeAddress] += points;
        require(nodeDailyPoints[nodeAddress] <= MAX_POINTS_PER_NODE_PER_DAY, "ENR: node daily cap exceeded");

        NodeStats storage stats = nodeStats[nodeAddress];
        stats.totalValidations++;
        stats.claimablePoints += points;
        stats.lastActivity = block.timestamp;
        totalPointsDistributed += points;

        // También registrar contribución en ValidatorRegistry para puntos de contribución
        validatorRegistry.recordContribution(nodeAddress, points, taskType);

        emit ValidationRecorded(nodeAddress, points, taskType);
    }

    // ─── Batch record (para eficiencia de gas del Oracle) ────────────

    function batchRecordValidations(
        address[] calldata nodes,
        uint256[] calldata points,
        string calldata taskType
    ) external onlyRole(ORACLE_ROLE) {
        require(nodes.length == points.length, "ENR: array length mismatch");
        
        uint256 today = block.timestamp / 1 days;
        
        for (uint256 i = 0; i < nodes.length; i++) {
            if (!_isNode[nodes[i]] || !nodeStats[nodes[i]].isActive || points[i] == 0) continue;
            require(points[i] <= MAX_POINTS_PER_RECORD, "ENR: points exceed max per record");

            // Per-node daily cap
            if (nodeLastPointsDay[nodes[i]] != today) {
                nodeDailyPoints[nodes[i]] = 0;
                nodeLastPointsDay[nodes[i]] = today;
            }
            if (nodeDailyPoints[nodes[i]] + points[i] > MAX_POINTS_PER_NODE_PER_DAY) continue;
            nodeDailyPoints[nodes[i]] += points[i];
            
            NodeStats storage stats = nodeStats[nodes[i]];
            stats.totalValidations++;
            stats.claimablePoints += points[i];
            stats.lastActivity = block.timestamp;
            totalPointsDistributed += points[i];

            validatorRegistry.recordContribution(nodes[i], points[i], taskType);
            emit ValidationRecorded(nodes[i], points[i], taskType);
        }
    }

    // ─── Claim de recompensas (con boost de ValidatorRegistry tier) ──

    function claimRewards() external nonReentrant {
        NodeStats storage stats = nodeStats[msg.sender];
        require(stats.claimablePoints > 0, "ENR: no rewards");

        // Obtener boost del tier del validador (basis points: 10000 = 1x, 20000 = 2x)
        uint256 boostBps = validatorRegistry.getRewardBoost(msg.sender);
        if (boostBps == 0) boostBps = 10000; // Fallback 1x si no es validador activo

        uint256 baseReward = stats.claimablePoints * rewardPerPoint;
        uint256 boostedReward = (baseReward * boostBps) / 10000;

        // Daily emission cap enforcement
        uint256 today = block.timestamp / 1 days;
        if (currentEpochDay != today) {
            currentEpochDay = today;
            epochDailyEmitted = 0;
        }
        require(epochDailyEmitted + boostedReward <= DAILY_EMISSION_CAP, "ENR: daily emission cap reached");
        epochDailyEmitted += boostedReward;

        // Reset antes de transferir (CEI pattern)
        stats.claimablePoints = 0;
        stats.totalBEZEarned += boostedReward;
        totalBEZDistributed += boostedReward;

        bezToken.safeTransfer(msg.sender, boostedReward);

        emit RewardsClaimed(msg.sender, boostedReward, boostBps);
    }

    // ─── Desactivar nodo ─────────────────────────────────────────────

    function deactivateNode(address nodeAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_isNode[nodeAddress], "ENR: not registered");
        nodeStats[nodeAddress].isActive = false;
        emit NodeDeactivated(nodeAddress);
    }

    // ─── Admin ───────────────────────────────────────────────────────

    function updateRewardPerPoint(uint256 newRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRate <= MAX_REWARD_PER_POINT, "ENR: rate exceeds max");
        emit RewardRateUpdated(rewardPerPoint, newRate);
        rewardPerPoint = newRate;
    }

    function updateValidatorRegistry(address newRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRegistry != address(0), "ENR: zero address");
        validatorRegistry = IValidatorRegistry(newRegistry);
        emit ValidatorRegistryUpdated(newRegistry);
    }

    // ─── Vistas ──────────────────────────────────────────────────────

    function getNodeInfo(address node) external view returns (
        uint256 totalValidations,
        uint256 claimablePoints,
        uint256 totalBEZEarned,
        uint256 pendingBEZ,
        uint256 boostBps,
        bool isActive
    ) {
        NodeStats storage stats = nodeStats[node];
        uint256 boost = validatorRegistry.getRewardBoost(node);
        if (boost == 0) boost = 10000;
        uint256 pending = (stats.claimablePoints * rewardPerPoint * boost) / 10000;
        
        return (
            stats.totalValidations,
            stats.claimablePoints,
            stats.totalBEZEarned,
            pending,
            boost,
            stats.isActive
        );
    }

    function getActiveNodeCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < activeNodes.length; i++) {
            if (nodeStats[activeNodes[i]].isActive) count++;
        }
        return count;
    }
}
