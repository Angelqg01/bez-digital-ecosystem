// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BeZhas SmartWallet (Account Abstraction)
 * @dev Wallet inteligente NO CUSTODIAL con control criptográfico del usuario.
 * Soporta: ejecución por firma (meta-tx), guardián para recuperación social,
 * límites de retiro diarios, timelock para operaciones grandes, y pausas de emergencia.
 * El usuario SIEMPRE controla su clave — BeZhas nunca tiene acceso a fondos.
 */
contract SmartWallet is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ─── Estado ───────────────────────────────────────────────────────
    address public owner;
    address public guardian;
    address public pendingOwner;
    
    uint256 public nonce;
    bool public isLocked;

    // ─── Límites de seguridad ─────────────────────────────────────────
    uint256 public dailyLimit;
    uint256 public dailySpent;
    uint256 public lastDayReset;
    
    uint256 public constant TIMELOCK_DELAY = 48 hours;
    uint256 public constant RECOVERY_DELAY = 72 hours;
    uint256 public constant MAX_DAILY_LIMIT = 1_000_000 ether;

    // ─── Operaciones pendientes (timelock) ────────────────────────────
    struct TimelockOp {
        address target;
        uint256 value;
        bytes data;
        uint256 executeAfter;
        bool executed;
    }
    
    mapping(uint256 => TimelockOp) public timelockOps;
    uint256 public timelockOpCount;

    // ─── Recuperación social ──────────────────────────────────────────
    struct RecoveryRequest {
        address newOwner;
        uint256 executeAfter;
        bool executed;
    }
    RecoveryRequest public activeRecovery;

    // ─── Sessions (gasless con delegación temporal) ───────────────────
    struct Session {
        address sessionKey;
        uint256 validUntil;
        uint256 spendLimit;
        uint256 spent;
    }
    mapping(address => Session) public sessions;

    // ─── Eventos ──────────────────────────────────────────────────────
    event Executed(address indexed target, uint256 value, bytes data);
    event ExecutedBySig(address indexed signer, address indexed target, uint256 value);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event GuardianChanged(address indexed oldGuardian, address indexed newGuardian);
    event WalletLocked(address indexed by);
    event WalletUnlocked(address indexed by);
    event DailyLimitChanged(uint256 oldLimit, uint256 newLimit);
    event TimelockQueued(uint256 indexed opId, address target, uint256 value, uint256 executeAfter);
    event TimelockExecuted(uint256 indexed opId);
    event TimelockCancelled(uint256 indexed opId);
    event RecoveryInitiated(address indexed guardian, address indexed newOwner, uint256 executeAfter);
    event RecoveryCancelled(address indexed owner);
    event RecoveryExecuted(address indexed newOwner);
    event SessionCreated(address indexed sessionKey, uint256 validUntil, uint256 spendLimit);
    event SessionRevoked(address indexed sessionKey);
    event Received(address indexed from, uint256 amount);

    // ─── Modificadores ────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "SW: not owner");
        _;
    }

    modifier onlyGuardian() {
        require(msg.sender == guardian, "SW: not guardian");
        _;
    }

    modifier onlyOwnerOrGuardian() {
        require(msg.sender == owner || msg.sender == guardian, "SW: not authorized");
        _;
    }

    modifier notLocked() {
        require(!isLocked, "SW: wallet locked");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────
    constructor(address _owner, address _guardian, uint256 _dailyLimit) {
        require(_owner != address(0), "SW: zero owner");
        require(_dailyLimit <= MAX_DAILY_LIMIT, "SW: limit too high");
        owner = _owner;
        guardian = _guardian;
        dailyLimit = _dailyLimit;
        lastDayReset = block.timestamp;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  EJECUCIÓN DIRECTA (por owner)
    // ═══════════════════════════════════════════════════════════════════

    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwner notLocked nonReentrant returns (bytes memory) {
        _checkDailyLimit(value);
        bytes memory result = _call(target, value, data);
        emit Executed(target, value, data);
        return result;
    }

    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external onlyOwner notLocked nonReentrant returns (bytes[] memory results) {
        require(targets.length == values.length && values.length == datas.length, "SW: length mismatch");
        require(targets.length <= 10, "SW: too many ops");
        
        uint256 totalValue;
        for (uint256 i = 0; i < values.length; i++) {
            totalValue += values[i];
        }
        _checkDailyLimit(totalValue);

        results = new bytes[](targets.length);
        for (uint256 i = 0; i < targets.length; i++) {
            results[i] = _call(targets[i], values[i], datas[i]);
            emit Executed(targets[i], values[i], datas[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    //  EJECUCIÓN POR FIRMA (Meta-Transacciones / Account Abstraction)
    // ═══════════════════════════════════════════════════════════════════

    function executeBySignature(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 _nonce,
        bytes calldata signature
    ) external notLocked nonReentrant returns (bytes memory) {
        require(_nonce == nonce, "SW: invalid nonce");
        
        bytes32 hash = keccak256(abi.encodePacked(
            address(this), target, value, data, _nonce, block.chainid
        ));
        bytes32 ethHash = hash.toEthSignedMessageHash();
        address signer = ethHash.recover(signature);
        
        require(signer == owner, "SW: invalid signature");
        nonce++;

        _checkDailyLimit(value);
        bytes memory result = _call(target, value, data);
        emit ExecutedBySig(signer, target, value);
        return result;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SESIONES (delegación temporal gasless)
    // ═══════════════════════════════════════════════════════════════════

    function createSession(
        address sessionKey,
        uint256 validUntil,
        uint256 spendLimit
    ) external onlyOwner {
        require(sessionKey != address(0), "SW: zero session key");
        require(validUntil > block.timestamp, "SW: expired session");
        require(validUntil <= block.timestamp + 30 days, "SW: session too long");
        
        sessions[sessionKey] = Session({
            sessionKey: sessionKey,
            validUntil: validUntil,
            spendLimit: spendLimit,
            spent: 0
        });
        emit SessionCreated(sessionKey, validUntil, spendLimit);
    }

    function executeBySession(
        address target,
        uint256 value,
        bytes calldata data
    ) external notLocked nonReentrant returns (bytes memory) {
        Session storage session = sessions[msg.sender];
        require(session.sessionKey == msg.sender, "SW: not session key");
        require(block.timestamp <= session.validUntil, "SW: session expired");
        require(session.spent + value <= session.spendLimit, "SW: session limit");
        
        session.spent += value;
        _checkDailyLimit(value);
        bytes memory result = _call(target, value, data);
        emit Executed(target, value, data);
        return result;
    }

    function revokeSession(address sessionKey) external onlyOwner {
        delete sessions[sessionKey];
        emit SessionRevoked(sessionKey);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TIMELOCK (operaciones grandes requieren espera)
    // ═══════════════════════════════════════════════════════════════════

    function queueTimelockOp(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwner returns (uint256 opId) {
        opId = timelockOpCount++;
        timelockOps[opId] = TimelockOp({
            target: target,
            value: value,
            data: data,
            executeAfter: block.timestamp + TIMELOCK_DELAY,
            executed: false
        });
        emit TimelockQueued(opId, target, value, timelockOps[opId].executeAfter);
    }

    function executeTimelockOp(uint256 opId) external onlyOwner notLocked nonReentrant {
        TimelockOp storage op = timelockOps[opId];
        require(!op.executed, "SW: already executed");
        require(block.timestamp >= op.executeAfter, "SW: too early");
        require(op.target != address(0), "SW: invalid op");
        
        op.executed = true;
        _call(op.target, op.value, op.data);
        emit TimelockExecuted(opId);
    }

    function cancelTimelockOp(uint256 opId) external onlyOwnerOrGuardian {
        TimelockOp storage op = timelockOps[opId];
        require(!op.executed, "SW: already executed");
        delete timelockOps[opId];
        emit TimelockCancelled(opId);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  RECUPERACIÓN SOCIAL (por Guardian)
    // ═══════════════════════════════════════════════════════════════════

    function initiateRecovery(address newOwner) external onlyGuardian {
        require(newOwner != address(0), "SW: zero address");
        require(newOwner != owner, "SW: same owner");
        
        activeRecovery = RecoveryRequest({
            newOwner: newOwner,
            executeAfter: block.timestamp + RECOVERY_DELAY,
            executed: false
        });
        emit RecoveryInitiated(msg.sender, newOwner, activeRecovery.executeAfter);
    }

    function executeRecovery() external onlyGuardian {
        require(activeRecovery.newOwner != address(0), "SW: no recovery");
        require(!activeRecovery.executed, "SW: already executed");
        require(block.timestamp >= activeRecovery.executeAfter, "SW: too early");
        
        address oldOwner = owner;
        owner = activeRecovery.newOwner;
        activeRecovery.executed = true;
        isLocked = false;
        
        emit OwnerChanged(oldOwner, owner);
        emit RecoveryExecuted(owner);
    }

    function cancelRecovery() external onlyOwner {
        delete activeRecovery;
        emit RecoveryCancelled(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SEGURIDAD: Lock / Unlock / Límites
    // ═══════════════════════════════════════════════════════════════════

    function lockWallet() external onlyOwnerOrGuardian {
        isLocked = true;
        emit WalletLocked(msg.sender);
    }

    function unlockWallet() external onlyOwner {
        isLocked = false;
        emit WalletUnlocked(msg.sender);
    }

    function setDailyLimit(uint256 newLimit) external onlyOwner {
        require(newLimit <= MAX_DAILY_LIMIT, "SW: limit too high");
        emit DailyLimitChanged(dailyLimit, newLimit);
        dailyLimit = newLimit;
    }

    function setGuardian(address newGuardian) external onlyOwner {
        emit GuardianChanged(guardian, newGuardian);
        guardian = newGuardian;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TOKEN HELPERS (ERC20 approval-free via wallet)
    // ═══════════════════════════════════════════════════════════════════

    function transferToken(
        IERC20 token,
        address to,
        uint256 amount
    ) external onlyOwner notLocked nonReentrant {
        _checkDailyLimit(amount);
        token.safeTransfer(to, amount);
    }

    function approveToken(
        IERC20 token,
        address spender,
        uint256 amount
    ) external onlyOwner notLocked {
        token.forceApprove(spender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VISTAS
    // ═══════════════════════════════════════════════════════════════════

    function getRemainingDailyLimit() external view returns (uint256) {
        if (block.timestamp >= lastDayReset + 1 days) {
            return dailyLimit;
        }
        if (dailySpent >= dailyLimit) return 0;
        return dailyLimit - dailySpent;
    }

    function getTimelockOp(uint256 opId) external view returns (
        address target, uint256 value, bytes memory data, uint256 executeAfter, bool executed
    ) {
        TimelockOp storage op = timelockOps[opId];
        return (op.target, op.value, op.data, op.executeAfter, op.executed);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  INTERNOS
    // ═══════════════════════════════════════════════════════════════════

    function _checkDailyLimit(uint256 value) internal {
        if (dailyLimit == 0) return; // sin límite
        
        if (block.timestamp >= lastDayReset + 1 days) {
            dailySpent = 0;
            lastDayReset = block.timestamp;
        }
        dailySpent += value;
        require(dailySpent <= dailyLimit, "SW: daily limit exceeded");
    }

    function _call(address target, uint256 value, bytes memory data) internal returns (bytes memory) {
        require(target != address(0), "SW: zero target");
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "SW: call failed");
        return result;
    }
}
