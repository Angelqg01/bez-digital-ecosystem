// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AuthenticationManager
 * @dev Manages user authentication, roles, and security features
 */
contract AuthenticationManager is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant VERIFIED_USER_ROLE = keccak256("VERIFIED_USER_ROLE");
    
    struct UserSession {
        uint256 loginTime;
        uint256 lastActivity;
        bool isActive;
        string sessionId;
    }
    
    struct UserSecurity {
        bool isBlocked;
        uint256 blockExpiry;
        uint256 failedLoginAttempts;
        uint256 lastFailedLogin;
        bool twoFactorEnabled;
        bytes32 recoveryHash;
    }
    
    mapping(address => UserSession) public userSessions;
    mapping(address => UserSecurity) public userSecurity;
    mapping(address => bool) public verifiedUsers;
    mapping(string => address) public sessionToUser;
    
    uint256 public constant SESSION_TIMEOUT = 24 hours;
    uint256 public constant MAX_FAILED_ATTEMPTS = 5;
    uint256 public constant BLOCK_DURATION = 1 hours;
    
    event UserLoggedIn(address indexed user, string sessionId, uint256 timestamp);
    event UserLoggedOut(address indexed user, uint256 timestamp);
    event UserBlocked(address indexed user, uint256 blockExpiry);
    event UserUnblocked(address indexed user);
    event UserVerified(address indexed user);
    event RecoveryInitiated(address indexed user);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MODERATOR_ROLE, msg.sender);
    }
    
    modifier notBlocked() {
        require(!isUserBlocked(msg.sender), "User is blocked");
        _;
    }
    
    modifier validSession() {
        require(isSessionValid(msg.sender), "Invalid or expired session");
        _;
    }
    
    /**
     * @dev Login user and create session
     */
    function login(string memory sessionId) external nonReentrant whenNotPaused notBlocked {
        require(bytes(sessionId).length > 0, "Invalid session ID");
        require(sessionToUser[sessionId] == address(0), "Session ID already in use");
        
        // Clear any existing session
        if (userSessions[msg.sender].isActive) {
            _clearSession(msg.sender);
        }
        
        userSessions[msg.sender] = UserSession({
            loginTime: block.timestamp,
            lastActivity: block.timestamp,
            isActive: true,
            sessionId: sessionId
        });
        
        sessionToUser[sessionId] = msg.sender;
        
        // Reset failed login attempts on successful login
        userSecurity[msg.sender].failedLoginAttempts = 0;
        
        emit UserLoggedIn(msg.sender, sessionId, block.timestamp);
    }
    
    /**
     * @dev Logout user and clear session
     */
    function logout() external nonReentrant {
        require(userSessions[msg.sender].isActive, "No active session");
        _clearSession(msg.sender);
        emit UserLoggedOut(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Update user activity timestamp
     */
    function updateActivity() external validSession {
        userSessions[msg.sender].lastActivity = block.timestamp;
    }
    
    /**
     * @dev Check if user session is valid
     */
    function isSessionValid(address user) public view returns (bool) {
        UserSession memory session = userSessions[user];
        if (!session.isActive) return false;
        if (block.timestamp > session.lastActivity + SESSION_TIMEOUT) return false;
        return true;
    }
    
    /**
     * @dev Check if user is blocked
     */
    function isUserBlocked(address user) public view returns (bool) {
        UserSecurity memory security = userSecurity[user];
        if (!security.isBlocked) return false;
        if (block.timestamp > security.blockExpiry) return false;
        return true;
    }
    
    /**
     * @dev Block user (moderator only)
     */
    function blockUser(address user, uint256 duration) external onlyRole(MODERATOR_ROLE) {
        require(user != address(0), "Invalid user address");
        require(duration > 0, "Invalid block duration");
        
        userSecurity[user].isBlocked = true;
        userSecurity[user].blockExpiry = block.timestamp + duration;
        
        // Clear active session if blocked
        if (userSessions[user].isActive) {
            _clearSession(user);
        }
        
        emit UserBlocked(user, userSecurity[user].blockExpiry);
    }
    
    /**
     * @dev Unblock user (moderator only)
     */
    function unblockUser(address user) external onlyRole(MODERATOR_ROLE) {
        require(user != address(0), "Invalid user address");
        
        userSecurity[user].isBlocked = false;
        userSecurity[user].blockExpiry = 0;
        userSecurity[user].failedLoginAttempts = 0;
        
        emit UserUnblocked(user);
    }
    
    /**
     * @dev Verify user (admin only)
     */
    function verifyUser(address user) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(user != address(0), "Invalid user address");
        
        verifiedUsers[user] = true;
        _grantRole(VERIFIED_USER_ROLE, user);
        
        emit UserVerified(user);
    }
    
    /**
     * @dev Set recovery hash for account recovery
     */
    function setRecoveryHash(bytes32 recoveryHash) external validSession {
        require(recoveryHash != bytes32(0), "Invalid recovery hash");
        userSecurity[msg.sender].recoveryHash = recoveryHash;
    }
    
    /**
     * @dev Initiate account recovery
     */
    function initiateRecovery(bytes32 recoveryProof) external nonReentrant whenNotPaused {
        require(userSecurity[msg.sender].recoveryHash != bytes32(0), "No recovery hash set");
        require(keccak256(abi.encodePacked(recoveryProof)) == userSecurity[msg.sender].recoveryHash, "Invalid recovery proof");
        
        // Unblock user and reset security settings
        userSecurity[msg.sender].isBlocked = false;
        userSecurity[msg.sender].blockExpiry = 0;
        userSecurity[msg.sender].failedLoginAttempts = 0;
        
        emit RecoveryInitiated(msg.sender);
    }
    
    /**
     * @dev Record failed login attempt
     */
    function recordFailedLogin(address user) external onlyRole(MODERATOR_ROLE) {
        userSecurity[user].failedLoginAttempts++;
        userSecurity[user].lastFailedLogin = block.timestamp;
        
        // Auto-block after max failed attempts
        if (userSecurity[user].failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
            userSecurity[user].isBlocked = true;
            userSecurity[user].blockExpiry = block.timestamp + BLOCK_DURATION;
            emit UserBlocked(user, userSecurity[user].blockExpiry);
        }
    }
    
    /**
     * @dev Get user session info
     */
    function getUserSession(address user) external view returns (UserSession memory) {
        return userSessions[user];
    }
    
    /**
     * @dev Get user security info (admin/moderator only)
     */
    function getUserSecurity(address user) external view returns (UserSecurity memory) {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || hasRole(MODERATOR_ROLE, msg.sender), "Access denied");
        return userSecurity[user];
    }
    
    /**
     * @dev Emergency pause (admin only)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause (admin only)
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Internal function to clear user session
     */
    function _clearSession(address user) internal {
        string memory sessionId = userSessions[user].sessionId;
        delete sessionToUser[sessionId];
        delete userSessions[user];
    }
    
    /**
     * @dev Check if user has any role
     */
    function hasAnyRole(address user) external view returns (bool) {
        return hasRole(DEFAULT_ADMIN_ROLE, user) || 
               hasRole(MODERATOR_ROLE, user) || 
               hasRole(VERIFIED_USER_ROLE, user);
    }
}
