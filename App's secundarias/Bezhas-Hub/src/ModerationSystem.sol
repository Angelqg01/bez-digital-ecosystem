// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ModerationSystem
 * @dev Handles content moderation, user reports, and platform safety
 */
contract ModerationSystem is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant AUTO_MOD_ROLE = keccak256("AUTO_MOD_ROLE");
    
    enum ContentType { POST, COMMENT, MESSAGE, PROFILE, NFT }
    enum ReportReason { SPAM, HARASSMENT, HATE_SPEECH, INAPPROPRIATE_CONTENT, SCAM, COPYRIGHT, OTHER }
    enum ReportStatus { PENDING, UNDER_REVIEW, RESOLVED, DISMISSED }
    enum ActionType { WARNING, CONTENT_REMOVAL, TEMPORARY_BAN, PERMANENT_BAN, ACCOUNT_RESTRICTION }
    
    struct Report {
        uint256 id;
        address reporter;
        address reportedUser;
        ContentType contentType;
        uint256 contentId;
        ReportReason reason;
        string description;
        uint256 timestamp;
        ReportStatus status;
        address assignedModerator;
        string moderatorNotes;
        uint256 resolvedTimestamp;
    }
    
    struct ModerationAction {
        uint256 id;
        uint256 reportId;
        address moderator;
        address targetUser;
        ActionType actionType;
        string reason;
        uint256 timestamp;
        uint256 expiryTimestamp; // For temporary actions
        bool isActive;
    }
    
    struct UserRestriction {
        bool isRestricted;
        uint256 restrictionExpiry;
        ActionType restrictionType;
        string reason;
        uint256 warningCount;
        uint256 lastWarningTime;
    }
    
    // Storage
    mapping(uint256 => Report) public reports;
    mapping(uint256 => ModerationAction) public moderationActions;
    mapping(address => UserRestriction) public userRestrictions;
    mapping(address => uint256[]) public userReports; // Reports made by user
    mapping(address => uint256[]) public reportsAgainstUser; // Reports against user
    mapping(ContentType => mapping(uint256 => bool)) public hiddenContent;
    mapping(address => mapping(address => bool)) public userBlocks; // user => blocked user => true
    
    uint256 public totalReports;
    uint256 public totalActions;
    uint256 public pendingReports;
    
    // Configuration
    uint256 public constant MAX_WARNINGS = 3;
    uint256 public constant WARNING_COOLDOWN = 7 days;
    uint256 public constant AUTO_BAN_THRESHOLD = 5; // Auto ban after 5 reports
    
    // Events
    event ReportSubmitted(uint256 indexed reportId, address indexed reporter, address indexed reportedUser, ContentType contentType, uint256 contentId);
    event ReportAssigned(uint256 indexed reportId, address indexed moderator);
    event ReportResolved(uint256 indexed reportId, ReportStatus status, address indexed moderator);
    event ModerationActionTaken(uint256 indexed actionId, address indexed moderator, address indexed targetUser, ActionType actionType);
    event UserBlocked(address indexed blocker, address indexed blocked);
    event UserUnblocked(address indexed blocker, address indexed blocked);
    event ContentHidden(ContentType contentType, uint256 contentId, address indexed moderator);
    event ContentRestored(ContentType contentType, uint256 contentId, address indexed moderator);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MODERATOR_ROLE, msg.sender);
    }
    
    /**
     * @dev Submit a report against content or user
     */
    function submitReport(
        address reportedUser,
        ContentType contentType,
        uint256 contentId,
        ReportReason reason,
        string memory description
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(reportedUser != address(0), "Invalid reported user");
        require(reportedUser != msg.sender, "Cannot report yourself");
        require(bytes(description).length > 0, "Description required");
        require(bytes(description).length <= 1000, "Description too long");
        
        totalReports++;
        pendingReports++;
        
        reports[totalReports] = Report({
            id: totalReports,
            reporter: msg.sender,
            reportedUser: reportedUser,
            contentType: contentType,
            contentId: contentId,
            reason: reason,
            description: description,
            timestamp: block.timestamp,
            status: ReportStatus.PENDING,
            assignedModerator: address(0),
            moderatorNotes: "",
            resolvedTimestamp: 0
        });
        
        userReports[msg.sender].push(totalReports);
        reportsAgainstUser[reportedUser].push(totalReports);
        
        emit ReportSubmitted(totalReports, msg.sender, reportedUser, contentType, contentId);
        
        // Auto-moderation check
        _checkAutoModeration(reportedUser);
        
        return totalReports;
    }
    
    /**
     * @dev Assign report to moderator
     */
    function assignReport(uint256 reportId) external onlyRole(MODERATOR_ROLE) {
        require(reportId > 0 && reportId <= totalReports, "Invalid report ID");
        require(reports[reportId].status == ReportStatus.PENDING, "Report not pending");
        require(reports[reportId].assignedModerator == address(0), "Report already assigned");
        
        reports[reportId].assignedModerator = msg.sender;
        reports[reportId].status = ReportStatus.UNDER_REVIEW;
        
        emit ReportAssigned(reportId, msg.sender);
    }
    
    /**
     * @dev Resolve a report
     */
    function resolveReport(
        uint256 reportId,
        ReportStatus status,
        string memory moderatorNotes,
        ActionType actionType,
        uint256 actionDuration
    ) external onlyRole(MODERATOR_ROLE) {
        require(reportId > 0 && reportId <= totalReports, "Invalid report ID");
        require(reports[reportId].assignedModerator == msg.sender, "Not assigned to you");
        require(reports[reportId].status == ReportStatus.UNDER_REVIEW, "Report not under review");
        require(status == ReportStatus.RESOLVED || status == ReportStatus.DISMISSED, "Invalid status");
        
        reports[reportId].status = status;
        reports[reportId].moderatorNotes = moderatorNotes;
        reports[reportId].resolvedTimestamp = block.timestamp;
        pendingReports--;
        
        if (status == ReportStatus.RESOLVED) {
            _takeModerationAction(reportId, reports[reportId].reportedUser, actionType, actionDuration, moderatorNotes);
        }
        
        emit ReportResolved(reportId, status, msg.sender);
    }
    
    /**
     * @dev Take moderation action
     */
    function _takeModerationAction(
        uint256 reportId,
        address targetUser,
        ActionType actionType,
        uint256 duration,
        string memory reason
    ) internal {
        totalActions++;
        uint256 expiryTime = actionType == ActionType.TEMPORARY_BAN ? block.timestamp + duration : 0;
        
        moderationActions[totalActions] = ModerationAction({
            id: totalActions,
            reportId: reportId,
            moderator: msg.sender,
            targetUser: targetUser,
            actionType: actionType,
            reason: reason,
            timestamp: block.timestamp,
            expiryTimestamp: expiryTime,
            isActive: true
        });
        
        // Apply the action
        if (actionType == ActionType.WARNING) {
            userRestrictions[targetUser].warningCount++;
            userRestrictions[targetUser].lastWarningTime = block.timestamp;
        } else if (actionType == ActionType.TEMPORARY_BAN || actionType == ActionType.ACCOUNT_RESTRICTION) {
            userRestrictions[targetUser].isRestricted = true;
            userRestrictions[targetUser].restrictionExpiry = expiryTime;
            userRestrictions[targetUser].restrictionType = actionType;
            userRestrictions[targetUser].reason = reason;
        } else if (actionType == ActionType.PERMANENT_BAN) {
            userRestrictions[targetUser].isRestricted = true;
            userRestrictions[targetUser].restrictionExpiry = type(uint256).max;
            userRestrictions[targetUser].restrictionType = actionType;
            userRestrictions[targetUser].reason = reason;
        }
        
        emit ModerationActionTaken(totalActions, msg.sender, targetUser, actionType);
    }
    
    /**
     * @dev Hide content
     */
    function hideContent(ContentType contentType, uint256 contentId) external onlyRole(MODERATOR_ROLE) {
        hiddenContent[contentType][contentId] = true;
        emit ContentHidden(contentType, contentId, msg.sender);
    }
    
    /**
     * @dev Restore hidden content
     */
    function restoreContent(ContentType contentType, uint256 contentId) external onlyRole(MODERATOR_ROLE) {
        hiddenContent[contentType][contentId] = false;
        emit ContentRestored(contentType, contentId, msg.sender);
    }
    
    /**
     * @dev Block another user
     */
    function blockUser(address userToBlock) external nonReentrant {
        require(userToBlock != address(0), "Invalid user address");
        require(userToBlock != msg.sender, "Cannot block yourself");
        require(!userBlocks[msg.sender][userToBlock], "User already blocked");
        
        userBlocks[msg.sender][userToBlock] = true;
        emit UserBlocked(msg.sender, userToBlock);
    }
    
    /**
     * @dev Unblock a user
     */
    function unblockUser(address userToUnblock) external nonReentrant {
        require(userToUnblock != address(0), "Invalid user address");
        require(userBlocks[msg.sender][userToUnblock], "User not blocked");
        
        userBlocks[msg.sender][userToUnblock] = false;
        emit UserUnblocked(msg.sender, userToUnblock);
    }
    
    /**
     * @dev Check if user is restricted
     */
    function isUserRestricted(address user) external view returns (bool, ActionType, uint256) {
        UserRestriction memory restriction = userRestrictions[user];
        
        if (!restriction.isRestricted) {
            return (false, ActionType.WARNING, 0);
        }
        
        if (restriction.restrictionExpiry != type(uint256).max && 
            block.timestamp > restriction.restrictionExpiry) {
            return (false, ActionType.WARNING, 0);
        }
        
        return (true, restriction.restrictionType, restriction.restrictionExpiry);
    }
    
    /**
     * @dev Check if content is hidden
     */
    function isContentHidden(ContentType contentType, uint256 contentId) external view returns (bool) {
        return hiddenContent[contentType][contentId];
    }
    
    /**
     * @dev Check if user is blocked by another user
     */
    function isUserBlocked(address blocker, address blocked) external view returns (bool) {
        return userBlocks[blocker][blocked];
    }
    
    /**
     * @dev Get pending reports for moderator
     */
    function getPendingReports(uint256 offset, uint256 limit) external view onlyRole(MODERATOR_ROLE) returns (uint256[] memory) {
        require(limit <= 50, "Limit too high");
        
        uint256[] memory pendingIds = new uint256[](limit);
        uint256 count = 0;
        uint256 skipped = 0;
        
        for (uint256 i = 1; i <= totalReports && count < limit; i++) {
            if (reports[i].status == ReportStatus.PENDING) {
                if (skipped >= offset) {
                    pendingIds[count] = i;
                    count++;
                } else {
                    skipped++;
                }
            }
        }
        
        // Resize array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = pendingIds[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get user's report history
     */
    function getUserReports(address user) external view returns (uint256[] memory) {
        return userReports[user];
    }
    
    /**
     * @dev Get reports against user
     */
    function getReportsAgainstUser(address user) external view onlyRole(MODERATOR_ROLE) returns (uint256[] memory) {
        return reportsAgainstUser[user];
    }
    
    /**
     * @dev Auto-moderation check
     */
    function _checkAutoModeration(address user) internal {
        uint256 recentReports = 0;
        uint256 timeWindow = block.timestamp - 24 hours;
        
        uint256[] memory userReportIds = reportsAgainstUser[user];
        for (uint256 i = 0; i < userReportIds.length; i++) {
            if (reports[userReportIds[i]].timestamp > timeWindow) {
                recentReports++;
            }
        }
        
        // Auto-restrict if threshold exceeded
        if (recentReports >= AUTO_BAN_THRESHOLD && !userRestrictions[user].isRestricted) {
            userRestrictions[user].isRestricted = true;
            userRestrictions[user].restrictionExpiry = block.timestamp + 24 hours;
            userRestrictions[user].restrictionType = ActionType.TEMPORARY_BAN;
            userRestrictions[user].reason = "Auto-moderation: Multiple reports";
        }
    }
    
    /**
     * @dev Get moderation statistics
     */
    function getModerationStats() external view returns (
        uint256 totalReportsCount,
        uint256 pendingReportsCount,
        uint256 totalActionsCount,
        uint256 activeRestrictions
    ) {
        // Count active restrictions
        uint256 activeCount = 0;
        // Note: In a real implementation, you'd need to track this more efficiently
        
        return (totalReports, pendingReports, totalActions, activeCount);
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
}
