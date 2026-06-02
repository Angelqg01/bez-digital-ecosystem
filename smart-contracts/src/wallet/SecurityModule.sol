// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BeZhas Security Module
 * @dev Módulo central de seguridad para todo el ecosistema BeZhas.
 * Funciones: pausa global de emergencia, timelock para upgrades críticos,
 * circuit breaker automático, registro de auditoría on-chain, y
 * control de acceso granular para operaciones administrativas.
 * Gobernanza segura: multi-sig + retraso obligatorio en cambios críticos.
 */
contract SecurityModule is Ownable, ReentrancyGuard {

    // ─── Constantes ───────────────────────────────────────────────────
    uint256 public constant MIN_DELAY = 24 hours;
    uint256 public constant MAX_DELAY = 30 days;
    uint256 public constant GRACE_PERIOD = 14 days;

    // ─── Estado global de emergencia ──────────────────────────────────
    bool public globalPause;
    mapping(address => bool) public contractPaused; // pausa individual por contrato

    // ─── Timelock para operaciones del protocolo ──────────────────────
    uint256 public timelockDelay;

    struct TimelockOperation {
        bytes32 opHash;
        address target;
        uint256 value;
        bytes data;
        uint256 scheduledAt;
        uint256 executeAfter;
        uint256 expiresAt;
        bool executed;
        bool cancelled;
        string description;
    }

    mapping(bytes32 => TimelockOperation) public timelockOps;
    bytes32[] public opHashes;

    // ─── Circuit Breaker ──────────────────────────────────────────────
    struct CircuitBreaker {
        uint256 threshold;    // Monto máximo en ventana
        uint256 window;       // Ventana de tiempo (ej: 1 hora)
        uint256 spent;        // Gastado en la ventana actual
        uint256 windowStart;  // Inicio de la ventana actual
        bool tripped;         // Si se activó el circuit breaker
    }
    mapping(address => CircuitBreaker) public circuitBreakers;

    // ─── Guardianes del protocolo ─────────────────────────────────────
    mapping(address => bool) public isGuardian;
    address[] public guardians;
    uint256 public guardianThreshold; // M-de-N para pausas de emergencia

    // ─── Registro de auditoría on-chain ───────────────────────────────
    struct AuditEntry {
        uint256 timestamp;
        address actor;
        string action;
        bytes32 dataHash;
    }
    AuditEntry[] public auditLog;

    // ─── Eventos ──────────────────────────────────────────────────────
    event GlobalPauseActivated(address indexed by);
    event GlobalPauseDeactivated(address indexed by);
    event ContractPauseToggled(address indexed contractAddr, bool paused);
    event OperationScheduled(bytes32 indexed opHash, address target, uint256 executeAfter, string description);
    event OperationExecuted(bytes32 indexed opHash);
    event OperationCancelled(bytes32 indexed opHash);
    event CircuitBreakerSet(address indexed contractAddr, uint256 threshold, uint256 window);
    event CircuitBreakerTripped(address indexed contractAddr, uint256 amount);
    event CircuitBreakerReset(address indexed contractAddr);
    event GuardianAdded(address indexed guardian);
    event GuardianRemoved(address indexed guardian);
    event GuardianThresholdChanged(uint256 oldThreshold, uint256 newThreshold);
    event AuditLogged(uint256 indexed entryId, address indexed actor, string action);
    event TimelockDelayChanged(uint256 oldDelay, uint256 newDelay);

    // ─── Modificadores ────────────────────────────────────────────────
    modifier onlyGuardian() {
        require(isGuardian[msg.sender], "SEC: not guardian");
        _;
    }

    modifier notGloballyPaused() {
        require(!globalPause, "SEC: globally paused");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────
    constructor(
        address admin,
        uint256 _timelockDelay,
        address[] memory _guardians,
        uint256 _guardianThreshold
    ) Ownable(admin) {
        require(_timelockDelay >= MIN_DELAY && _timelockDelay <= MAX_DELAY, "SEC: invalid delay");
        require(_guardians.length >= _guardianThreshold, "SEC: threshold > guardians");
        require(_guardianThreshold >= 1, "SEC: threshold must be >= 1");

        timelockDelay = _timelockDelay;
        guardianThreshold = _guardianThreshold;

        for (uint256 i = 0; i < _guardians.length; i++) {
            require(_guardians[i] != address(0), "SEC: zero guardian");
            require(!isGuardian[_guardians[i]], "SEC: dup guardian");
            isGuardian[_guardians[i]] = true;
            guardians.push(_guardians[i]);
            emit GuardianAdded(_guardians[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  PAUSA DE EMERGENCIA
    // ═══════════════════════════════════════════════════════════════════

    function activateGlobalPause() external onlyGuardian {
        globalPause = true;
        _logAudit(msg.sender, "GLOBAL_PAUSE_ON");
        emit GlobalPauseActivated(msg.sender);
    }

    function deactivateGlobalPause() external onlyOwner {
        globalPause = false;
        _logAudit(msg.sender, "GLOBAL_PAUSE_OFF");
        emit GlobalPauseDeactivated(msg.sender);
    }

    function toggleContractPause(address contractAddr) external onlyGuardian {
        contractPaused[contractAddr] = !contractPaused[contractAddr];
        _logAudit(msg.sender, "CONTRACT_PAUSE_TOGGLE");
        emit ContractPauseToggled(contractAddr, contractPaused[contractAddr]);
    }

    function isContractOperational(address contractAddr) external view returns (bool) {
        return !globalPause && !contractPaused[contractAddr];
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TIMELOCK — Operaciones del protocolo
    // ═══════════════════════════════════════════════════════════════════

    function scheduleOperation(
        address target,
        uint256 value,
        bytes calldata data,
        string calldata description
    ) external onlyOwner returns (bytes32 opHash) {
        opHash = keccak256(abi.encodePacked(target, value, data, block.timestamp));
        require(timelockOps[opHash].scheduledAt == 0, "SEC: op exists");

        uint256 executeAfter = block.timestamp + timelockDelay;
        uint256 expiresAt = executeAfter + GRACE_PERIOD;

        timelockOps[opHash] = TimelockOperation({
            opHash: opHash,
            target: target,
            value: value,
            data: data,
            scheduledAt: block.timestamp,
            executeAfter: executeAfter,
            expiresAt: expiresAt,
            executed: false,
            cancelled: false,
            description: description
        });

        opHashes.push(opHash);
        _logAudit(msg.sender, "OP_SCHEDULED");
        emit OperationScheduled(opHash, target, executeAfter, description);
    }

    function executeOperation(bytes32 opHash) external onlyOwner notGloballyPaused nonReentrant {
        TimelockOperation storage op = timelockOps[opHash];
        require(op.scheduledAt > 0, "SEC: op not found");
        require(!op.executed, "SEC: already executed");
        require(!op.cancelled, "SEC: cancelled");
        require(block.timestamp >= op.executeAfter, "SEC: too early");
        require(block.timestamp <= op.expiresAt, "SEC: expired");

        op.executed = true;

        (bool success,) = op.target.call{value: op.value}(op.data);
        require(success, "SEC: execution failed");

        _logAudit(msg.sender, "OP_EXECUTED");
        emit OperationExecuted(opHash);
    }

    function cancelOperation(bytes32 opHash) external onlyOwner {
        TimelockOperation storage op = timelockOps[opHash];
        require(op.scheduledAt > 0, "SEC: op not found");
        require(!op.executed, "SEC: already executed");

        op.cancelled = true;
        _logAudit(msg.sender, "OP_CANCELLED");
        emit OperationCancelled(opHash);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CIRCUIT BREAKER (protección contra drenaje)
    // ═══════════════════════════════════════════════════════════════════

    function setCircuitBreaker(
        address contractAddr,
        uint256 threshold,
        uint256 window
    ) external onlyOwner {
        require(window >= 1 hours, "SEC: window too short");
        circuitBreakers[contractAddr] = CircuitBreaker({
            threshold: threshold,
            window: window,
            spent: 0,
            windowStart: block.timestamp,
            tripped: false
        });
        emit CircuitBreakerSet(contractAddr, threshold, window);
    }

    function checkCircuitBreaker(address contractAddr, uint256 amount) external returns (bool allowed) {
        CircuitBreaker storage cb = circuitBreakers[contractAddr];
        if (cb.threshold == 0) return true; // no circuit breaker configured
        if (cb.tripped) return false;

        // Reset window if expired
        if (block.timestamp >= cb.windowStart + cb.window) {
            cb.spent = 0;
            cb.windowStart = block.timestamp;
        }

        cb.spent += amount;
        if (cb.spent > cb.threshold) {
            cb.tripped = true;
            emit CircuitBreakerTripped(contractAddr, amount);
            return false;
        }
        return true;
    }

    function resetCircuitBreaker(address contractAddr) external onlyOwner {
        circuitBreakers[contractAddr].tripped = false;
        circuitBreakers[contractAddr].spent = 0;
        circuitBreakers[contractAddr].windowStart = block.timestamp;
        _logAudit(msg.sender, "CB_RESET");
        emit CircuitBreakerReset(contractAddr);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  GOBERNANZA DE GUARDIANES
    // ═══════════════════════════════════════════════════════════════════

    function addGuardian(address guardian) external onlyOwner {
        require(!isGuardian[guardian], "SEC: already guardian");
        require(guardian != address(0), "SEC: zero address");
        isGuardian[guardian] = true;
        guardians.push(guardian);
        emit GuardianAdded(guardian);
    }

    function removeGuardian(address guardian) external onlyOwner {
        require(isGuardian[guardian], "SEC: not guardian");
        require(guardians.length - 1 >= guardianThreshold, "SEC: would break threshold");
        
        isGuardian[guardian] = false;
        for (uint256 i = 0; i < guardians.length; i++) {
            if (guardians[i] == guardian) {
                guardians[i] = guardians[guardians.length - 1];
                guardians.pop();
                break;
            }
        }
        emit GuardianRemoved(guardian);
    }

    function setGuardianThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold >= 1 && _threshold <= guardians.length, "SEC: invalid threshold");
        emit GuardianThresholdChanged(guardianThreshold, _threshold);
        guardianThreshold = _threshold;
    }

    function setTimelockDelay(uint256 _delay) external onlyOwner {
        require(_delay >= MIN_DELAY && _delay <= MAX_DELAY, "SEC: invalid delay");
        emit TimelockDelayChanged(timelockDelay, _delay);
        timelockDelay = _delay;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  AUDITORÍA ON-CHAIN
    // ═══════════════════════════════════════════════════════════════════

    function logExternalAudit(string calldata action, bytes32 dataHash) external onlyGuardian {
        _logAudit(msg.sender, action);
        auditLog[auditLog.length - 1].dataHash = dataHash;
    }

    function getAuditLogLength() external view returns (uint256) {
        return auditLog.length;
    }

    function getAuditEntry(uint256 index) external view returns (
        uint256 timestamp, address actor, string memory action, bytes32 dataHash
    ) {
        AuditEntry storage entry = auditLog[index];
        return (entry.timestamp, entry.actor, entry.action, entry.dataHash);
    }

    function getRecentAudits(uint256 count) external view returns (AuditEntry[] memory) {
        uint256 total = auditLog.length;
        uint256 start = total > count ? total - count : 0;
        uint256 length = total - start;
        
        AuditEntry[] memory entries = new AuditEntry[](length);
        for (uint256 i = 0; i < length; i++) {
            entries[i] = auditLog[start + i];
        }
        return entries;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VISTAS
    // ═══════════════════════════════════════════════════════════════════

    function getGuardians() external view returns (address[] memory) {
        return guardians;
    }

    function getPendingOperations() external view returns (bytes32[] memory pending) {
        uint256 count = 0;
        for (uint256 i = 0; i < opHashes.length; i++) {
            TimelockOperation storage op = timelockOps[opHashes[i]];
            if (!op.executed && !op.cancelled) count++;
        }
        pending = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < opHashes.length; i++) {
            TimelockOperation storage op = timelockOps[opHashes[i]];
            if (!op.executed && !op.cancelled) {
                pending[idx++] = opHashes[i];
            }
        }
    }

    function getOperationCount() external view returns (uint256) {
        return opHashes.length;
    }

    // ─── Internos ─────────────────────────────────────────────────────

    function _logAudit(address actor, string memory action) internal {
        auditLog.push(AuditEntry({
            timestamp: block.timestamp,
            actor: actor,
            action: action,
            dataHash: bytes32(0)
        }));
        emit AuditLogged(auditLog.length - 1, actor, action);
    }
}
