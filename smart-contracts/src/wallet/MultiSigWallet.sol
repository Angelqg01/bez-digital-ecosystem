// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BeZhas Multi-Signature Wallet
 * @dev Para empresas, corporaciones e instituciones.
 * Requiere M-de-N firmas para ejecutar transacciones.
 * Incluye: roles por cuenta, timelock obligatorio para operaciones grandes,
 * límites de retiro, y pausa de emergencia.
 */
contract MultiSigWallet is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constantes ───────────────────────────────────────────────────
    uint256 public constant MAX_SIGNERS = 20;
    uint256 public constant TIMELOCK_DELAY = 48 hours;
    uint256 public constant EMERGENCY_TIMELOCK = 24 hours;

    // ─── Estado ───────────────────────────────────────────────────────
    address[] public signers;
    mapping(address => bool) public isSigner;
    uint256 public required; // M de N
    bool public paused;

    // ─── Límites ──────────────────────────────────────────────────────
    uint256 public dailyLimit;
    uint256 public dailySpent;
    uint256 public lastDayReset;
    uint256 public largeOpThreshold; // operaciones > threshold van a timelock

    // ─── Transacciones ────────────────────────────────────────────────
    struct Transaction {
        address target;
        uint256 value;
        bytes data;
        uint256 confirmations;
        bool executed;
        uint256 createdAt;
        uint256 executeAfter; // 0 = inmediato, >0 = timelock
        string description;
    }

    Transaction[] public transactions;
    // txId => signer => confirmed
    mapping(uint256 => mapping(address => bool)) public confirmations;

    // ─── Políticas por cuenta ─────────────────────────────────────────
    enum SignerRole { ADMIN, OPERATOR, VIEWER }
    mapping(address => SignerRole) public signerRoles;

    // ─── Eventos ──────────────────────────────────────────────────────
    event TransactionSubmitted(uint256 indexed txId, address indexed submitter, address target, uint256 value, string description);
    event TransactionConfirmed(uint256 indexed txId, address indexed signer);
    event TransactionRevoked(uint256 indexed txId, address indexed signer);
    event TransactionExecuted(uint256 indexed txId);
    event SignerAdded(address indexed signer, SignerRole role);
    event SignerRemoved(address indexed signer);
    event RequirementChanged(uint256 oldRequired, uint256 newRequired);
    event DailyLimitChanged(uint256 oldLimit, uint256 newLimit);
    event LargeOpThresholdChanged(uint256 oldThreshold, uint256 newThreshold);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event Received(address indexed from, uint256 amount);

    // ─── Modificadores ────────────────────────────────────────────────
    modifier onlySigner() {
        require(isSigner[msg.sender], "MS: not signer");
        _;
    }

    modifier onlyAdmin() {
        require(isSigner[msg.sender] && signerRoles[msg.sender] == SignerRole.ADMIN, "MS: not admin");
        _;
    }

    modifier onlyWallet() {
        require(msg.sender == address(this), "MS: only via multisig");
        _;
    }

    modifier notPaused() {
        require(!paused, "MS: paused");
        _;
    }

    modifier txExists(uint256 txId) {
        require(txId < transactions.length, "MS: tx not found");
        _;
    }

    modifier notExecuted(uint256 txId) {
        require(!transactions[txId].executed, "MS: already executed");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────
    constructor(
        address[] memory _signers,
        uint256 _required,
        uint256 _dailyLimit,
        uint256 _largeOpThreshold
    ) {
        require(_signers.length >= 2, "MS: min 2 signers");
        require(_signers.length <= MAX_SIGNERS, "MS: too many signers");
        require(_required >= 2 && _required <= _signers.length, "MS: invalid required");

        for (uint256 i = 0; i < _signers.length; i++) {
            address signer = _signers[i];
            require(signer != address(0), "MS: zero address");
            require(!isSigner[signer], "MS: duplicate signer");

            isSigner[signer] = true;
            signers.push(signer);
            // Primer firmante es ADMIN, resto OPERATOR
            signerRoles[signer] = i == 0 ? SignerRole.ADMIN : SignerRole.OPERATOR;
            emit SignerAdded(signer, signerRoles[signer]);
        }

        required = _required;
        dailyLimit = _dailyLimit;
        largeOpThreshold = _largeOpThreshold;
        lastDayReset = block.timestamp;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  TRANSACCIONES
    // ═══════════════════════════════════════════════════════════════════

    function submitTransaction(
        address target,
        uint256 value,
        bytes calldata data,
        string calldata description
    ) external onlySigner notPaused returns (uint256 txId) {
        require(target != address(0), "MS: zero target");

        uint256 executeAfter = 0;
        if (value > largeOpThreshold && largeOpThreshold > 0) {
            executeAfter = block.timestamp + TIMELOCK_DELAY;
        }

        txId = transactions.length;
        transactions.push(Transaction({
            target: target,
            value: value,
            data: data,
            confirmations: 0,
            executed: false,
            createdAt: block.timestamp,
            executeAfter: executeAfter,
            description: description
        }));

        emit TransactionSubmitted(txId, msg.sender, target, value, description);
        
        // Auto-confirm por el submitter
        _confirm(txId);
    }

    function confirmTransaction(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
    {
        _confirm(txId);
    }

    function revokeConfirmation(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
    {
        require(confirmations[txId][msg.sender], "MS: not confirmed");
        confirmations[txId][msg.sender] = false;
        transactions[txId].confirmations--;
        emit TransactionRevoked(txId, msg.sender);
    }

    function executeTransaction(uint256 txId)
        external
        onlySigner
        txExists(txId)
        notExecuted(txId)
        notPaused
        nonReentrant
    {
        Transaction storage txn = transactions[txId];
        require(txn.confirmations >= required, "MS: not enough confirmations");
        
        if (txn.executeAfter > 0) {
            require(block.timestamp >= txn.executeAfter, "MS: timelock active");
        }

        _checkDailyLimit(txn.value);
        
        (bool success,) = txn.target.call{value: txn.value}(txn.data);
        require(success, "MS: execution failed");
        txn.executed = true;

        emit TransactionExecuted(txId);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SEGURIDAD: Pausa / Emergencia
    // ═══════════════════════════════════════════════════════════════════

    function pause() external onlySigner {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  GOBERNANZA INTERNA (solo vía multisig)
    // ═══════════════════════════════════════════════════════════════════

    function addSigner(address signer, SignerRole role) external onlyWallet {
        require(!isSigner[signer], "MS: already signer");
        require(signer != address(0), "MS: zero address");
        require(signers.length < MAX_SIGNERS, "MS: max signers");

        isSigner[signer] = true;
        signers.push(signer);
        signerRoles[signer] = role;
        emit SignerAdded(signer, role);
    }

    function removeSigner(address signer) external onlyWallet {
        require(isSigner[signer], "MS: not signer");
        require(signers.length - 1 >= required, "MS: would break quorum");

        isSigner[signer] = false;
        for (uint256 i = 0; i < signers.length; i++) {
            if (signers[i] == signer) {
                signers[i] = signers[signers.length - 1];
                signers.pop();
                break;
            }
        }
        delete signerRoles[signer];
        emit SignerRemoved(signer);
    }

    function changeRequirement(uint256 _required) external onlyWallet {
        require(_required >= 2 && _required <= signers.length, "MS: invalid");
        emit RequirementChanged(required, _required);
        required = _required;
    }

    function setDailyLimit(uint256 _dailyLimit) external onlyWallet {
        emit DailyLimitChanged(dailyLimit, _dailyLimit);
        dailyLimit = _dailyLimit;
    }

    function setLargeOpThreshold(uint256 _threshold) external onlyWallet {
        emit LargeOpThresholdChanged(largeOpThreshold, _threshold);
        largeOpThreshold = _threshold;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VISTAS
    // ═══════════════════════════════════════════════════════════════════

    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    function getConfirmationCount(uint256 txId) external view returns (uint256) {
        if (txId >= transactions.length) return 0;
        return transactions[txId].confirmations;
    }

    function isConfirmed(uint256 txId, address signer) external view returns (bool) {
        if (txId >= transactions.length) return false;
        return confirmations[txId][signer];
    }

    function getRemainingDailyLimit() external view returns (uint256) {
        if (block.timestamp >= lastDayReset + 1 days) {
            return dailyLimit;
        }
        if (dailySpent >= dailyLimit) return 0;
        return dailyLimit - dailySpent;
    }

    function getPendingTransactions() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < transactions.length; i++) {
            if (!transactions[i].executed) count++;
        }
        uint256[] memory pending = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < transactions.length; i++) {
            if (!transactions[i].executed) {
                pending[idx++] = i;
            }
        }
        return pending;
    }

    // ─── Internos ─────────────────────────────────────────────────────

    function _confirm(uint256 txId) internal {
        require(!confirmations[txId][msg.sender], "MS: already confirmed");
        confirmations[txId][msg.sender] = true;
        transactions[txId].confirmations++;
        emit TransactionConfirmed(txId, msg.sender);
    }

    function _checkDailyLimit(uint256 value) internal {
        if (dailyLimit == 0) return;
        if (block.timestamp >= lastDayReset + 1 days) {
            dailySpent = 0;
            lastDayReset = block.timestamp;
        }
        dailySpent += value;
        require(dailySpent <= dailyLimit, "MS: daily limit exceeded");
    }
}
