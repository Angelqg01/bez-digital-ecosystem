// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract EnhancedAuthManager is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant VERIFIED_USER_ROLE = keccak256("VERIFIED_USER_ROLE");
    bytes32 public constant PREMIUM_USER_ROLE = keccak256("PREMIUM_USER_ROLE");

    // Permission constants
    bytes32 public constant PERMISSION_POST = keccak256("PERMISSION_POST");
    bytes32 public constant PERMISSION_COMMENT = keccak256("PERMISSION_COMMENT");
    bytes32 public constant PERMISSION_LIKE = keccak256("PERMISSION_LIKE");
    bytes32 public constant PERMISSION_MESSAGE = keccak256("PERMISSION_MESSAGE");
    bytes32 public constant PERMISSION_CREATE_NFT = keccak256("PERMISSION_CREATE_NFT");
    bytes32 public constant PERMISSION_TRADE = keccak256("PERMISSION_TRADE");
    bytes32 public constant PERMISSION_MODERATE = keccak256("PERMISSION_MODERATE");
    bytes32 public constant PERMISSION_ADMIN = keccak256("PERMISSION_ADMIN");

    struct UserSession {
        uint256 loginTime;
        uint256 lastActivity;
        bool isActive;
        string deviceId;
        uint256 expiresAt;
    }

    struct TwoFactorAuth {
        bool enabled;
        bytes32 secretHash;
        uint256 lastUsed;
        bool isSetup;
        address[] backupCodes;
    }

    struct UserPermissions {
        mapping(bytes32 => bool) permissions;
        uint256 permissionLevel;
        bool isCustom;
    }

    mapping(address => UserSession) public userSessions;
    mapping(address => TwoFactorAuth) public twoFactorAuth;
    mapping(address => UserPermissions) private userPermissions;
    mapping(address => bool) public blockedUsers;
    mapping(address => uint256) public loginAttempts;
    mapping(address => uint256) public lastLoginAttempt;
    
    // Role-based permission mappings
    mapping(bytes32 => mapping(bytes32 => bool)) public rolePermissions;

    uint256 public constant MAX_LOGIN_ATTEMPTS = 5;
    uint256 public constant LOGIN_COOLDOWN = 15 minutes;
    uint256 public constant SESSION_DURATION = 24 hours;

    event UserLoggedIn(address indexed user, string deviceId, uint256 timestamp);
    event UserLoggedOut(address indexed user, uint256 timestamp);
    event SessionExpired(address indexed user, uint256 timestamp);
    event TwoFactorEnabled(address indexed user, uint256 timestamp);
    event TwoFactorDisabled(address indexed user, uint256 timestamp);
    event PermissionGranted(address indexed user, bytes32 permission);
    event PermissionRevoked(address indexed user, bytes32 permission);
    event UserBlocked(address indexed user, address indexed by, uint256 timestamp);
    event UserUnblocked(address indexed user, address indexed by, uint256 timestamp);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        // Set up default role permissions
        _setupRolePermissions();
    }

    function _setupRolePermissions() internal {
        // Admin permissions
        rolePermissions[ADMIN_ROLE][PERMISSION_POST] = true;
        rolePermissions[ADMIN_ROLE][PERMISSION_COMMENT] = true;
        rolePermissions[ADMIN_ROLE][PERMISSION_LIKE] = true;
        rolePermissions[ADMIN_ROLE][PERMISSION_MESSAGE] = true;
        rolePermissions[ADMIN_ROLE][PERMISSION_CREATE_NFT] = true;
        rolePermissions[ADMIN_ROLE][PERMISSION_TRADE] = true;
        rolePermissions[ADMIN_ROLE][PERMISSION_MODERATE] = true;
        rolePermissions[ADMIN_ROLE][PERMISSION_ADMIN] = true;

        // Moderator permissions
        rolePermissions[MODERATOR_ROLE][PERMISSION_POST] = true;
        rolePermissions[MODERATOR_ROLE][PERMISSION_COMMENT] = true;
        rolePermissions[MODERATOR_ROLE][PERMISSION_LIKE] = true;
        rolePermissions[MODERATOR_ROLE][PERMISSION_MESSAGE] = true;
        rolePermissions[MODERATOR_ROLE][PERMISSION_CREATE_NFT] = true;
        rolePermissions[MODERATOR_ROLE][PERMISSION_TRADE] = true;
        rolePermissions[MODERATOR_ROLE][PERMISSION_MODERATE] = true;

        // Verified user permissions
        rolePermissions[VERIFIED_USER_ROLE][PERMISSION_POST] = true;
        rolePermissions[VERIFIED_USER_ROLE][PERMISSION_COMMENT] = true;
        rolePermissions[VERIFIED_USER_ROLE][PERMISSION_LIKE] = true;
        rolePermissions[VERIFIED_USER_ROLE][PERMISSION_MESSAGE] = true;
        rolePermissions[VERIFIED_USER_ROLE][PERMISSION_CREATE_NFT] = true;
        rolePermissions[VERIFIED_USER_ROLE][PERMISSION_TRADE] = true;

        // Premium user permissions
        rolePermissions[PREMIUM_USER_ROLE][PERMISSION_POST] = true;
        rolePermissions[PREMIUM_USER_ROLE][PERMISSION_COMMENT] = true;
        rolePermissions[PREMIUM_USER_ROLE][PERMISSION_LIKE] = true;
        rolePermissions[PREMIUM_USER_ROLE][PERMISSION_MESSAGE] = true;
        rolePermissions[PREMIUM_USER_ROLE][PERMISSION_CREATE_NFT] = true;
        rolePermissions[PREMIUM_USER_ROLE][PERMISSION_TRADE] = true;
    }

    function login(string memory deviceId, bytes32 signatureHash) external nonReentrant whenNotPaused {
        require(!blockedUsers[msg.sender], "User is blocked");
        require(
            loginAttempts[msg.sender] < MAX_LOGIN_ATTEMPTS || 
            block.timestamp > lastLoginAttempt[msg.sender] + LOGIN_COOLDOWN,
            "Too many login attempts"
        );

        // Reset login attempts if cooldown has passed
        if (block.timestamp > lastLoginAttempt[msg.sender] + LOGIN_COOLDOWN) {
            loginAttempts[msg.sender] = 0;
        }

        // Verify signature (simplified for demo)
        require(signatureHash != bytes32(0), "Invalid signature");

        // Check 2FA if enabled
        if (twoFactorAuth[msg.sender].enabled) {
            require(twoFactorAuth[msg.sender].lastUsed < block.timestamp - 30, "2FA code already used");
        }

        // Create session
        userSessions[msg.sender] = UserSession({
            loginTime: block.timestamp,
            lastActivity: block.timestamp,
            isActive: true,
            deviceId: deviceId,
            expiresAt: block.timestamp + SESSION_DURATION
        });

        // Reset login attempts on successful login
        loginAttempts[msg.sender] = 0;

        emit UserLoggedIn(msg.sender, deviceId, block.timestamp);
    }

    function logout() external {
        require(userSessions[msg.sender].isActive, "No active session");
        
        userSessions[msg.sender].isActive = false;
        emit UserLoggedOut(msg.sender, block.timestamp);
    }

    function setup2FA(bytes32 secretHash) external {
        require(!twoFactorAuth[msg.sender].enabled, "2FA already enabled");
        require(hasRole(ADMIN_ROLE, msg.sender) || hasRole(MODERATOR_ROLE, msg.sender), "Only admins/moderators can enable 2FA");
        
        twoFactorAuth[msg.sender] = TwoFactorAuth({
            enabled: true,
            secretHash: secretHash,
            lastUsed: 0,
            isSetup: true,
            backupCodes: new address[](0)
        });

        emit TwoFactorEnabled(msg.sender, block.timestamp);
    }

    function disable2FA() external {
        require(twoFactorAuth[msg.sender].enabled, "2FA not enabled");
        
        twoFactorAuth[msg.sender].enabled = false;
        emit TwoFactorDisabled(msg.sender, block.timestamp);
    }

    function verify2FA(bytes32 codeHash) external {
        require(twoFactorAuth[msg.sender].enabled, "2FA not enabled");
        require(twoFactorAuth[msg.sender].secretHash == codeHash, "Invalid 2FA code");
        require(twoFactorAuth[msg.sender].lastUsed < block.timestamp - 30, "Code already used");
        
        twoFactorAuth[msg.sender].lastUsed = block.timestamp;
    }

    function grantPermission(address user, bytes32 permission) external onlyRole(ADMIN_ROLE) {
        userPermissions[user].permissions[permission] = true;
        userPermissions[user].isCustom = true;
        emit PermissionGranted(user, permission);
    }

    function revokePermission(address user, bytes32 permission) external onlyRole(ADMIN_ROLE) {
        userPermissions[user].permissions[permission] = false;
        emit PermissionRevoked(user, permission);
    }

    function hasPermission(address user, bytes32 permission) public view returns (bool) {
        // Check custom permissions first
        if (userPermissions[user].isCustom && userPermissions[user].permissions[permission]) {
            return true;
        }

        // Check role-based permissions
        if (hasRole(ADMIN_ROLE, user) && rolePermissions[ADMIN_ROLE][permission]) {
            return true;
        }
        if (hasRole(MODERATOR_ROLE, user) && rolePermissions[MODERATOR_ROLE][permission]) {
            return true;
        }
        if (hasRole(VERIFIED_USER_ROLE, user) && rolePermissions[VERIFIED_USER_ROLE][permission]) {
            return true;
        }
        if (hasRole(PREMIUM_USER_ROLE, user) && rolePermissions[PREMIUM_USER_ROLE][permission]) {
            return true;
        }

        return false;
    }

    function blockUser(address user) external onlyRole(MODERATOR_ROLE) {
        require(!hasRole(ADMIN_ROLE, user), "Cannot block admin");
        blockedUsers[user] = true;
        
        // Invalidate session
        if (userSessions[user].isActive) {
            userSessions[user].isActive = false;
        }
        
        emit UserBlocked(user, msg.sender, block.timestamp);
    }

    function unblockUser(address user) external onlyRole(MODERATOR_ROLE) {
        blockedUsers[user] = false;
        emit UserUnblocked(user, msg.sender, block.timestamp);
    }

    function isSessionActive(address user) public view returns (bool) {
        UserSession memory session = userSessions[user];
        return session.isActive && 
               block.timestamp < session.expiresAt && 
               !blockedUsers[user];
    }

    function updateActivity(address user) public {
        require(userSessions[user].isActive, "No active session");
        require(block.timestamp < userSessions[user].expiresAt, "Session expired");
        
        userSessions[user].lastActivity = block.timestamp;
    }

    function getSessionInfo(address user) external view returns (
        uint256 loginTime,
        uint256 lastActivity,
        bool isActive,
        string memory deviceId,
        uint256 expiresAt
    ) {
        UserSession memory session = userSessions[user];
        return (
            session.loginTime,
            session.lastActivity,
            session.isActive,
            session.deviceId,
            session.expiresAt
        );
    }

    function is2FAEnabled(address user) external view returns (bool) {
        return twoFactorAuth[user].enabled;
    }

    function getUserRoles(address user) external view returns (bytes32[] memory) {
        bytes32[] memory roles = new bytes32[](4);
        uint256 count = 0;
        
        if (hasRole(ADMIN_ROLE, user)) {
            roles[count] = ADMIN_ROLE;
            count++;
        }
        if (hasRole(MODERATOR_ROLE, user)) {
            roles[count] = MODERATOR_ROLE;
            count++;
        }
        if (hasRole(VERIFIED_USER_ROLE, user)) {
            roles[count] = VERIFIED_USER_ROLE;
            count++;
        }
        if (hasRole(PREMIUM_USER_ROLE, user)) {
            roles[count] = PREMIUM_USER_ROLE;
            count++;
        }
        
        // Resize array to actual count
        bytes32[] memory result = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = roles[i];
        }
        
        return result;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    modifier requirePermission(bytes32 permission) {
        require(hasPermission(msg.sender, permission), "Insufficient permissions");
        _;
    }

    modifier requireActiveSession() {
        require(isSessionActive(msg.sender), "No active session");
        updateActivity(msg.sender);
        _;
    }
}
