// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract BackupRecoverySystem is ReentrancyGuard, Pausable, AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BACKUP_OPERATOR_ROLE = keccak256("BACKUP_OPERATOR_ROLE");

    struct BackupData {
        bytes32 dataHash;
        string ipfsHash;
        uint256 timestamp;
        address creator;
        bool isEncrypted;
        string description;
        uint256 version;
    }

    struct RecoveryRequest {
        address requester;
        bytes32 backupId;
        string reason;
        uint256 timestamp;
        bool isApproved;
        bool isExecuted;
        address approver;
        uint256 expiryTime;
    }

    struct SystemSnapshot {
        bytes32 contractStatesHash;
        bytes32 userDataHash;
        bytes32 configurationHash;
        uint256 blockNumber;
        uint256 timestamp;
        string description;
    }

    // Storage
    mapping(bytes32 => BackupData) public backups;
    mapping(address => bytes32[]) public userBackups;
    mapping(bytes32 => RecoveryRequest) public recoveryRequests;
    mapping(uint256 => SystemSnapshot) public systemSnapshots;
    
    bytes32[] public allBackupIds;
    bytes32[] public pendingRecoveryRequests;
    uint256 public snapshotCounter;
    uint256 public constant RECOVERY_EXPIRY_TIME = 7 days;

    // Configuration
    uint256 public maxBackupsPerUser = 10;
    uint256 public backupRetentionPeriod = 365 days;
    bool public autoBackupEnabled = true;
    uint256 public autoBackupInterval = 24 hours;
    mapping(address => uint256) public lastAutoBackup;

    // Events
    event BackupCreated(bytes32 indexed backupId, address indexed creator, string ipfsHash);
    event BackupRestored(bytes32 indexed backupId, address indexed requester);
    event RecoveryRequested(bytes32 indexed requestId, address indexed requester, bytes32 backupId);
    event RecoveryApproved(bytes32 indexed requestId, address indexed approver);
    event RecoveryExecuted(bytes32 indexed requestId, address indexed requester);
    event SystemSnapshotCreated(uint256 indexed snapshotId, uint256 blockNumber);
    event BackupDeleted(bytes32 indexed backupId, string reason);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(BACKUP_OPERATOR_ROLE, msg.sender);
    }

    modifier validBackup(bytes32 backupId) {
        require(backups[backupId].timestamp > 0, "Backup does not exist");
        _;
    }

    modifier onlyBackupOwner(bytes32 backupId) {
        require(backups[backupId].creator == msg.sender, "Not backup owner");
        _;
    }

    function createBackup(
        string memory ipfsHash,
        string memory description,
        bool isEncrypted
    ) external nonReentrant whenNotPaused returns (bytes32) {
        require(bytes(ipfsHash).length > 0, "IPFS hash required");
        require(userBackups[msg.sender].length < maxBackupsPerUser, "Max backups exceeded");

        bytes32 backupId = keccak256(abi.encodePacked(
            msg.sender,
            ipfsHash,
            block.timestamp,
            block.number
        ));

        bytes32 dataHash = keccak256(abi.encodePacked(ipfsHash, description));

        backups[backupId] = BackupData({
            dataHash: dataHash,
            ipfsHash: ipfsHash,
            timestamp: block.timestamp,
            creator: msg.sender,
            isEncrypted: isEncrypted,
            description: description,
            version: userBackups[msg.sender].length + 1
        });

        userBackups[msg.sender].push(backupId);
        allBackupIds.push(backupId);
        lastAutoBackup[msg.sender] = block.timestamp;

        emit BackupCreated(backupId, msg.sender, ipfsHash);
        return backupId;
    }

    function requestRecovery(
        bytes32 backupId,
        string memory reason
    ) external nonReentrant whenNotPaused validBackup(backupId) returns (bytes32) {
        require(bytes(reason).length > 0, "Reason required");

        bytes32 requestId = keccak256(abi.encodePacked(
            msg.sender,
            backupId,
            block.timestamp
        ));

        recoveryRequests[requestId] = RecoveryRequest({
            requester: msg.sender,
            backupId: backupId,
            reason: reason,
            timestamp: block.timestamp,
            isApproved: false,
            isExecuted: false,
            approver: address(0),
            expiryTime: block.timestamp + RECOVERY_EXPIRY_TIME
        });

        pendingRecoveryRequests.push(requestId);

        emit RecoveryRequested(requestId, msg.sender, backupId);
        return requestId;
    }

    function approveRecovery(bytes32 requestId) external onlyRole(ADMIN_ROLE) {
        RecoveryRequest storage request = recoveryRequests[requestId];
        require(request.timestamp > 0, "Request does not exist");
        require(!request.isApproved, "Already approved");
        require(!request.isExecuted, "Already executed");
        require(block.timestamp <= request.expiryTime, "Request expired");

        request.isApproved = true;
        request.approver = msg.sender;

        emit RecoveryApproved(requestId, msg.sender);
    }

    function executeRecovery(bytes32 requestId) external nonReentrant {
        RecoveryRequest storage request = recoveryRequests[requestId];
        require(request.requester == msg.sender, "Not request owner");
        require(request.isApproved, "Not approved");
        require(!request.isExecuted, "Already executed");
        require(block.timestamp <= request.expiryTime, "Request expired");

        request.isExecuted = true;

        // Remove from pending requests
        _removePendingRequest(requestId);

        emit RecoveryExecuted(requestId, msg.sender);
        emit BackupRestored(request.backupId, msg.sender);
    }

    function createSystemSnapshot(string memory description) 
        external 
        onlyRole(BACKUP_OPERATOR_ROLE) 
        returns (uint256) 
    {
        uint256 snapshotId = snapshotCounter++;
        
        // Create hashes for different system components
        bytes32 contractStatesHash = keccak256(abi.encodePacked(
            block.number,
            block.timestamp,
            "contract_states"
        ));
        
        bytes32 userDataHash = keccak256(abi.encodePacked(
            allBackupIds.length,
            "user_data"
        ));
        
        bytes32 configurationHash = keccak256(abi.encodePacked(
            maxBackupsPerUser,
            backupRetentionPeriod,
            autoBackupEnabled
        ));

        systemSnapshots[snapshotId] = SystemSnapshot({
            contractStatesHash: contractStatesHash,
            userDataHash: userDataHash,
            configurationHash: configurationHash,
            blockNumber: block.number,
            timestamp: block.timestamp,
            description: description
        });

        emit SystemSnapshotCreated(snapshotId, block.number);
        return snapshotId;
    }

    function deleteBackup(bytes32 backupId, string memory reason) 
        external 
        validBackup(backupId) 
    {
        require(
            backups[backupId].creator == msg.sender || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        _deleteBackup(backupId, reason);
    }

    function _deleteBackup(bytes32 backupId, string memory reason) internal {
        // Remove from user's backup list
        address creator = backups[backupId].creator;
        bytes32[] storage userBackupList = userBackups[creator];
        for (uint256 i = 0; i < userBackupList.length; i++) {
            if (userBackupList[i] == backupId) {
                userBackupList[i] = userBackupList[userBackupList.length - 1];
                userBackupList.pop();
                break;
            }
        }

        // Remove from all backups list
        for (uint256 i = 0; i < allBackupIds.length; i++) {
            if (allBackupIds[i] == backupId) {
                allBackupIds[i] = allBackupIds[allBackupIds.length - 1];
                allBackupIds.pop();
                break;
            }
        }

        delete backups[backupId];
        emit BackupDeleted(backupId, reason);
    }

    function cleanupExpiredBackups() external onlyRole(BACKUP_OPERATOR_ROLE) {
        uint256 cutoffTime = block.timestamp - backupRetentionPeriod;
        uint256 deletedCount = 0;

        for (uint256 i = allBackupIds.length; i > 0; i--) {
            bytes32 backupId = allBackupIds[i - 1];
            if (backups[backupId].timestamp < cutoffTime) {
                _deleteBackup(backupId, "Expired");
                deletedCount++;
            }
        }
    }

    function getUserBackups(address user) external view returns (bytes32[] memory) {
        return userBackups[user];
    }

    function getBackupDetails(bytes32 backupId) 
        external 
        view 
        validBackup(backupId) 
        returns (
            string memory ipfsHash,
            string memory description,
            uint256 timestamp,
            address creator,
            bool isEncrypted,
            uint256 version
        ) 
    {
        BackupData memory backup = backups[backupId];
        return (
            backup.ipfsHash,
            backup.description,
            backup.timestamp,
            backup.creator,
            backup.isEncrypted,
            backup.version
        );
    }

    function getPendingRecoveryRequests() external view returns (bytes32[] memory) {
        return pendingRecoveryRequests;
    }

    function getRecoveryRequestDetails(bytes32 requestId) 
        external 
        view 
        returns (
            address requester,
            bytes32 backupId,
            string memory reason,
            uint256 timestamp,
            bool isApproved,
            bool isExecuted,
            address approver,
            uint256 expiryTime
        ) 
    {
        RecoveryRequest memory request = recoveryRequests[requestId];
        return (
            request.requester,
            request.backupId,
            request.reason,
            request.timestamp,
            request.isApproved,
            request.isExecuted,
            request.approver,
            request.expiryTime
        );
    }

    function getSystemSnapshot(uint256 snapshotId) 
        external 
        view 
        returns (
            bytes32 contractStatesHash,
            bytes32 userDataHash,
            bytes32 configurationHash,
            uint256 blockNumber,
            uint256 timestamp,
            string memory description
        ) 
    {
        SystemSnapshot memory snapshot = systemSnapshots[snapshotId];
        return (
            snapshot.contractStatesHash,
            snapshot.userDataHash,
            snapshot.configurationHash,
            snapshot.blockNumber,
            snapshot.timestamp,
            snapshot.description
        );
    }

    function _removePendingRequest(bytes32 requestId) internal {
        for (uint256 i = 0; i < pendingRecoveryRequests.length; i++) {
            if (pendingRecoveryRequests[i] == requestId) {
                pendingRecoveryRequests[i] = pendingRecoveryRequests[pendingRecoveryRequests.length - 1];
                pendingRecoveryRequests.pop();
                break;
            }
        }
    }

    // Admin functions
    function setMaxBackupsPerUser(uint256 _maxBackups) external onlyRole(ADMIN_ROLE) {
        maxBackupsPerUser = _maxBackups;
    }

    function setBackupRetentionPeriod(uint256 _period) external onlyRole(ADMIN_ROLE) {
        backupRetentionPeriod = _period;
    }

    function setAutoBackupEnabled(bool _enabled) external onlyRole(ADMIN_ROLE) {
        autoBackupEnabled = _enabled;
    }

    function setAutoBackupInterval(uint256 _interval) external onlyRole(ADMIN_ROLE) {
        autoBackupInterval = _interval;
    }

    function emergencyDeleteBackup(bytes32 backupId) external onlyRole(ADMIN_ROLE) {
        require(backups[backupId].timestamp > 0, "Backup does not exist");
        _deleteBackup(backupId, "Emergency deletion");
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
