// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SecurityManager is ReentrancyGuard, Pausable, AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant SECURITY_ROLE = keccak256("SECURITY_ROLE");

    struct ActivityLog {
        address user;
        string action;
        uint256 timestamp;
        bytes32 txHash;
        uint256 value;
        address target;
    }

    struct TransactionLimit {
        uint256 dailyLimit;
        uint256 transactionLimit;
        uint256 dailySpent;
        uint256 lastResetTime;
        bool isActive;
    }

    struct FraudPattern {
        uint256 maxTransactionsPerHour;
        uint256 maxValuePerHour;
        uint256 suspiciousPatternThreshold;
        bool isActive;
    }

    struct RecoveryRequest {
        address user;
        address newAddress;
        bytes32 recoveryHash;
        uint256 timestamp;
        uint256 confirmations;
        bool isExecuted;
        mapping(address => bool) hasConfirmed;
    }

    // Storage
    mapping(address => bool) public blacklistedAddresses;
    mapping(address => TransactionLimit) public transactionLimits;
    mapping(address => uint256[]) public userTransactionHistory;
    mapping(address => uint256) public userRiskScore;
    mapping(address => bool) public trustedAddresses;
    mapping(uint256 => RecoveryRequest) public recoveryRequests;

    ActivityLog[] public activityLogs;
    FraudPattern public fraudDetectionConfig;
    
    uint256 public recoveryRequestCount;
    uint256 public constant RECOVERY_CONFIRMATIONS_REQUIRED = 3;
    uint256 public constant RECOVERY_TIMEOUT = 7 days;

    // Events
    event AddressBlacklisted(address indexed addr, bool status);
    event TransactionLimitSet(address indexed user, uint256 dailyLimit, uint256 transactionLimit);
    event FraudDetected(address indexed user, string reason, uint256 riskScore);
    event ActivityLogged(address indexed user, string action, uint256 timestamp);
    event RecoveryRequested(uint256 indexed requestId, address indexed user, address newAddress);
    event RecoveryConfirmed(uint256 indexed requestId, address indexed confirmer);
    event RecoveryExecuted(uint256 indexed requestId, address indexed user, address newAddress);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(SECURITY_ROLE, msg.sender);

        // Set default fraud detection parameters
        fraudDetectionConfig = FraudPattern({
            maxTransactionsPerHour: 50,
            maxValuePerHour: 1000 ether,
            suspiciousPatternThreshold: 80,
            isActive: true
        });
    }

    modifier notBlacklisted(address addr) {
        require(!blacklistedAddresses[addr], "Address is blacklisted");
        _;
    }

    modifier withinLimits(address user, uint256 value) {
        require(checkTransactionLimits(user, value), "Transaction limits exceeded");
        _;
    }

    function logActivity(
        address user,
        string memory action,
        bytes32 txHash,
        uint256 value,
        address target
    ) external onlyRole(SECURITY_ROLE) {
        activityLogs.push(ActivityLog({
            user: user,
            action: action,
            timestamp: block.timestamp,
            txHash: txHash,
            value: value,
            target: target
        }));

        emit ActivityLogged(user, action, block.timestamp);
        
        // Check for fraud patterns
        if (fraudDetectionConfig.isActive) {
            _checkFraudPatterns(user, value);
        }
    }

    function setTransactionLimits(
        address user,
        uint256 dailyLimit,
        uint256 transactionLimit
    ) external onlyRole(ADMIN_ROLE) {
        transactionLimits[user] = TransactionLimit({
            dailyLimit: dailyLimit,
            transactionLimit: transactionLimit,
            dailySpent: 0,
            lastResetTime: block.timestamp,
            isActive: true
        });

        emit TransactionLimitSet(user, dailyLimit, transactionLimit);
    }

    function checkTransactionLimits(address user, uint256 value) public returns (bool) {
        TransactionLimit storage limits = transactionLimits[user];
        
        if (!limits.isActive) return true;

        // Reset daily limits if 24 hours have passed
        if (block.timestamp >= limits.lastResetTime + 1 days) {
            limits.dailySpent = 0;
            limits.lastResetTime = block.timestamp;
        }

        // Check transaction limit
        if (value > limits.transactionLimit) return false;

        // Check daily limit
        if (limits.dailySpent + value > limits.dailyLimit) return false;

        // Update daily spent
        limits.dailySpent += value;
        return true;
    }

    function _checkFraudPatterns(address user, uint256 value) internal {
        uint256 currentHour = block.timestamp / 1 hours;
        uint256 hourlyTransactions = 0;
        uint256 hourlyValue = 0;

        // Count transactions in the last hour
        for (uint256 i = activityLogs.length; i > 0; i--) {
            ActivityLog memory log = activityLogs[i - 1];
            if (log.user == user && log.timestamp / 1 hours == currentHour) {
                hourlyTransactions++;
                hourlyValue += log.value;
            } else if (log.timestamp / 1 hours < currentHour) {
                break;
            }
        }

        uint256 riskScore = 0;

        // Calculate risk score based on patterns
        if (hourlyTransactions > fraudDetectionConfig.maxTransactionsPerHour) {
            riskScore += 30;
        }

        if (hourlyValue > fraudDetectionConfig.maxValuePerHour) {
            riskScore += 40;
        }

        // Check for rapid successive transactions
        if (hourlyTransactions > 10 && hourlyValue > 100 ether) {
            riskScore += 20;
        }

        // Update user risk score
        userRiskScore[user] = riskScore;

        if (riskScore >= fraudDetectionConfig.suspiciousPatternThreshold) {
            emit FraudDetected(user, "Suspicious transaction pattern detected", riskScore);
            // Optionally auto-blacklist high-risk users
            if (riskScore >= 90) {
                blacklistedAddresses[user] = true;
                emit AddressBlacklisted(user, true);
            }
        }
    }

    function requestAccountRecovery(
        address newAddress,
        bytes32 recoveryHash
    ) external returns (uint256) {
        require(newAddress != address(0), "Invalid new address");
        require(newAddress != msg.sender, "New address must be different");

        uint256 requestId = recoveryRequestCount++;
        RecoveryRequest storage request = recoveryRequests[requestId];
        
        request.user = msg.sender;
        request.newAddress = newAddress;
        request.recoveryHash = recoveryHash;
        request.timestamp = block.timestamp;
        request.confirmations = 0;
        request.isExecuted = false;

        emit RecoveryRequested(requestId, msg.sender, newAddress);
        return requestId;
    }

    function confirmRecovery(uint256 requestId) external onlyRole(SECURITY_ROLE) {
        require(requestId < recoveryRequestCount, "Invalid request ID");
        RecoveryRequest storage request = recoveryRequests[requestId];
        
        require(!request.isExecuted, "Recovery already executed");
        require(block.timestamp <= request.timestamp + RECOVERY_TIMEOUT, "Recovery request expired");
        require(!request.hasConfirmed[msg.sender], "Already confirmed");

        request.hasConfirmed[msg.sender] = true;
        request.confirmations++;

        emit RecoveryConfirmed(requestId, msg.sender);

        if (request.confirmations >= RECOVERY_CONFIRMATIONS_REQUIRED) {
            _executeRecovery(requestId);
        }
    }

    function _executeRecovery(uint256 requestId) internal {
        RecoveryRequest storage request = recoveryRequests[requestId];
        request.isExecuted = true;

        // Transfer any existing limits and settings to new address
        if (transactionLimits[request.user].isActive) {
            transactionLimits[request.newAddress] = transactionLimits[request.user];
            delete transactionLimits[request.user];
        }

        emit RecoveryExecuted(requestId, request.user, request.newAddress);
    }

    function blacklistAddress(address addr, bool status) external onlyRole(ADMIN_ROLE) {
        blacklistedAddresses[addr] = status;
        emit AddressBlacklisted(addr, status);
    }

    function setTrustedAddress(address addr, bool status) external onlyRole(ADMIN_ROLE) {
        trustedAddresses[addr] = status;
    }

    function updateFraudDetectionConfig(
        uint256 maxTransactionsPerHour,
        uint256 maxValuePerHour,
        uint256 suspiciousPatternThreshold,
        bool isActive
    ) external onlyRole(ADMIN_ROLE) {
        fraudDetectionConfig = FraudPattern({
            maxTransactionsPerHour: maxTransactionsPerHour,
            maxValuePerHour: maxValuePerHour,
            suspiciousPatternThreshold: suspiciousPatternThreshold,
            isActive: isActive
        });
    }

    function getActivityLogs(
        address user,
        uint256 fromTime,
        uint256 toTime
    ) external view returns (ActivityLog[] memory) {
        uint256 count = 0;
        
        // Count matching logs
        for (uint256 i = 0; i < activityLogs.length; i++) {
            ActivityLog memory log = activityLogs[i];
            if ((user == address(0) || log.user == user) &&
                log.timestamp >= fromTime &&
                log.timestamp <= toTime) {
                count++;
            }
        }

        // Create result array
        ActivityLog[] memory result = new ActivityLog[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < activityLogs.length; i++) {
            ActivityLog memory log = activityLogs[i];
            if ((user == address(0) || log.user == user) &&
                log.timestamp >= fromTime &&
                log.timestamp <= toTime) {
                result[index] = log;
                index++;
            }
        }

        return result;
    }

    function getUserSecurityInfo(address user) external view returns (
        bool isBlacklisted,
        bool isTrusted,
        uint256 riskScore,
        uint256 dailyLimit,
        uint256 dailySpent,
        uint256 transactionLimit
    ) {
        TransactionLimit memory limits = transactionLimits[user];
        return (
            blacklistedAddresses[user],
            trustedAddresses[user],
            userRiskScore[user],
            limits.dailyLimit,
            limits.dailySpent,
            limits.transactionLimit
        );
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
