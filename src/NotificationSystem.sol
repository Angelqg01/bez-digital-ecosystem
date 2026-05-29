// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NotificationSystem
 * @dev Manages notifications for social interactions and platform events
 */
contract NotificationSystem is AccessControl, ReentrancyGuard {
    bytes32 public constant NOTIFIER_ROLE = keccak256("NOTIFIER_ROLE");
    
    enum NotificationType { 
        LIKE, 
        COMMENT, 
        SHARE, 
        FOLLOW, 
        MESSAGE, 
        MENTION, 
        NFT_SALE, 
        TOKEN_TRANSFER, 
        MODERATION_ACTION,
        SYSTEM_ANNOUNCEMENT
    }
    
    struct Notification {
        uint256 id;
        address recipient;
        address sender;
        NotificationType notificationType;
        uint256 relatedId; // Post ID, Comment ID, etc.
        string message;
        uint256 timestamp;
        bool isRead;
        bool isDeleted;
    }
    
    struct NotificationSettings {
        bool likesEnabled;
        bool commentsEnabled;
        bool sharesEnabled;
        bool followsEnabled;
        bool messagesEnabled;
        bool mentionsEnabled;
        bool nftSalesEnabled;
        bool tokenTransfersEnabled;
        bool moderationEnabled;
        bool systemAnnouncementsEnabled;
    }
    
    // Storage
    mapping(uint256 => Notification) public notifications;
    mapping(address => uint256[]) public userNotifications;
    mapping(address => NotificationSettings) public userSettings;
    mapping(address => uint256) public unreadCounts;
    
    uint256 public totalNotifications;
    
    // Events for real-time updates
    event NotificationCreated(
        uint256 indexed notificationId,
        address indexed recipient,
        address indexed sender,
        NotificationType notificationType,
        uint256 relatedId,
        string message
    );
    
    event NotificationRead(uint256 indexed notificationId, address indexed recipient);
    event NotificationDeleted(uint256 indexed notificationId, address indexed recipient);
    event NotificationSettingsUpdated(address indexed user);
    event BulkNotificationsRead(address indexed user, uint256 count);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(NOTIFIER_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new notification
     */
    function createNotification(
        address recipient,
        address sender,
        NotificationType notificationType,
        uint256 relatedId,
        string memory message
    ) external onlyRole(NOTIFIER_ROLE) returns (uint256) {
        return _createNotification(recipient, sender, notificationType, relatedId, message);
    }

    function _createNotification(
        address recipient,
        address sender,
        NotificationType notificationType,
        uint256 relatedId,
        string memory message
    ) internal returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        require(sender != address(0), "Invalid sender");
        require(recipient != sender, "Cannot notify yourself");
        require(bytes(message).length > 0, "Message cannot be empty");
        require(bytes(message).length <= 500, "Message too long");
        
        // Check if user has this notification type enabled
        if (!_isNotificationEnabled(recipient, notificationType)) {
            return 0; // Notification not created
        }
        
        totalNotifications++;
        
        notifications[totalNotifications] = Notification({
            id: totalNotifications,
            recipient: recipient,
            sender: sender,
            notificationType: notificationType,
            relatedId: relatedId,
            message: message,
            timestamp: block.timestamp,
            isRead: false,
            isDeleted: false
        });
        
        userNotifications[recipient].push(totalNotifications);
        unreadCounts[recipient]++;
        
        emit NotificationCreated(
            totalNotifications,
            recipient,
            sender,
            notificationType,
            relatedId,
            message
        );
        
        return totalNotifications;
    }
    
    /**
     * @dev Mark notification as read
     */
    function markAsRead(uint256 notificationId) external nonReentrant {
        require(notificationId > 0 && notificationId <= totalNotifications, "Invalid notification ID");
        require(notifications[notificationId].recipient == msg.sender, "Not your notification");
        require(!notifications[notificationId].isRead, "Already read");
        require(!notifications[notificationId].isDeleted, "Notification deleted");
        
        notifications[notificationId].isRead = true;
        if (unreadCounts[msg.sender] > 0) {
            unreadCounts[msg.sender]--;
        }
        
        emit NotificationRead(notificationId, msg.sender);
    }
    
    /**
     * @dev Mark all notifications as read
     */
    function markAllAsRead() external nonReentrant {
        uint256[] memory userNotifs = userNotifications[msg.sender];
        uint256 markedCount = 0;
        
        for (uint256 i = 0; i < userNotifs.length; i++) {
            uint256 notifId = userNotifs[i];
            if (!notifications[notifId].isRead && !notifications[notifId].isDeleted) {
                notifications[notifId].isRead = true;
                markedCount++;
            }
        }
        
        unreadCounts[msg.sender] = 0;
        
        if (markedCount > 0) {
            emit BulkNotificationsRead(msg.sender, markedCount);
        }
    }
    
    /**
     * @dev Delete notification
     */
    function deleteNotification(uint256 notificationId) external nonReentrant {
        require(notificationId > 0 && notificationId <= totalNotifications, "Invalid notification ID");
        require(notifications[notificationId].recipient == msg.sender, "Not your notification");
        require(!notifications[notificationId].isDeleted, "Already deleted");
        
        notifications[notificationId].isDeleted = true;
        
        // Decrease unread count if notification was unread
        if (!notifications[notificationId].isRead && unreadCounts[msg.sender] > 0) {
            unreadCounts[msg.sender]--;
        }
        
        emit NotificationDeleted(notificationId, msg.sender);
    }
    
    /**
     * @dev Update notification settings
     */
    function updateNotificationSettings(
        bool likesEnabled,
        bool commentsEnabled,
        bool sharesEnabled,
        bool followsEnabled,
        bool messagesEnabled,
        bool mentionsEnabled,
        bool nftSalesEnabled,
        bool tokenTransfersEnabled,
        bool moderationEnabled,
        bool systemAnnouncementsEnabled
    ) external {
        userSettings[msg.sender] = NotificationSettings({
            likesEnabled: likesEnabled,
            commentsEnabled: commentsEnabled,
            sharesEnabled: sharesEnabled,
            followsEnabled: followsEnabled,
            messagesEnabled: messagesEnabled,
            mentionsEnabled: mentionsEnabled,
            nftSalesEnabled: nftSalesEnabled,
            tokenTransfersEnabled: tokenTransfersEnabled,
            moderationEnabled: moderationEnabled,
            systemAnnouncementsEnabled: systemAnnouncementsEnabled
        });
        
        emit NotificationSettingsUpdated(msg.sender);
    }
    
    /**
     * @dev Get user notifications (paginated)
     */
    function getUserNotifications(
        address user,
        uint256 offset,
        uint256 limit,
        bool unreadOnly
    ) external view returns (Notification[] memory) {
        require(limit <= 50, "Limit too high");
        
        uint256[] memory userNotifs = userNotifications[user];
        if (offset >= userNotifs.length) {
            return new Notification[](0);
        }
        
        // Count valid notifications
        uint256 validCount = 0;
        uint256 checked = 0;
        
        for (uint256 i = userNotifs.length; i > 0 && validCount < limit; i--) {
            if (checked < offset) {
                checked++;
                continue;
            }
            
            uint256 notifId = userNotifs[i - 1];
            Notification memory notif = notifications[notifId];
            
            if (!notif.isDeleted && (!unreadOnly || !notif.isRead)) {
                validCount++;
            }
            checked++;
        }
        
        // Fill result array
        Notification[] memory result = new Notification[](validCount);
        uint256 resultIndex = 0;
        checked = 0;
        
        for (uint256 i = userNotifs.length; i > 0 && resultIndex < validCount; i--) {
            if (checked < offset) {
                checked++;
                continue;
            }
            
            uint256 notifId = userNotifs[i - 1];
            Notification memory notif = notifications[notifId];
            
            if (!notif.isDeleted && (!unreadOnly || !notif.isRead)) {
                result[resultIndex] = notif;
                resultIndex++;
            }
            checked++;
        }
        
        return result;
    }
    
    /**
     * @dev Get unread notification count
     */
    function getUnreadCount(address user) external view returns (uint256) {
        return unreadCounts[user];
    }
    
    /**
     * @dev Get notification settings
     */
    function getNotificationSettings(address user) external view returns (NotificationSettings memory) {
        // Return default settings if not set
        if (!_hasCustomSettings(user)) {
            return NotificationSettings({
                likesEnabled: true,
                commentsEnabled: true,
                sharesEnabled: true,
                followsEnabled: true,
                messagesEnabled: true,
                mentionsEnabled: true,
                nftSalesEnabled: true,
                tokenTransfersEnabled: true,
                moderationEnabled: true,
                systemAnnouncementsEnabled: true
            });
        }
        
        return userSettings[user];
    }
    
    /**
     * @dev Create system announcement (admin only)
     */
    function createSystemAnnouncement(string memory message) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bytes(message).length > 0, "Message cannot be empty");
        require(bytes(message).length <= 1000, "Message too long");
        
        // This would typically be sent to all users or a subset
        // For now, we'll emit an event that the frontend can listen to
        emit NotificationCreated(
            0, // Special ID for system announcements
            address(0), // No specific recipient
            msg.sender,
            NotificationType.SYSTEM_ANNOUNCEMENT,
            0,
            message
        );
    }
    
    /**
     * @dev Batch create notifications (for efficiency)
     */
    function batchCreateNotifications(
        address[] memory recipients,
        address sender,
        NotificationType notificationType,
        uint256 relatedId,
        string memory message
    ) external onlyRole(NOTIFIER_ROLE) {
        require(recipients.length > 0, "No recipients");
        require(recipients.length <= 100, "Too many recipients");
        require(sender != address(0), "Invalid sender");
        require(bytes(message).length > 0, "Message cannot be empty");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] != address(0) && recipients[i] != sender) {
                _createNotification(recipients[i], sender, notificationType, relatedId, message);
            }
        }
    }
    
    /**
     * @dev Check if notification type is enabled for user
     */
    function _isNotificationEnabled(address user, NotificationType notificationType) internal view returns (bool) {
        if (!_hasCustomSettings(user)) {
            return true; // Default: all enabled
        }
        
        NotificationSettings memory settings = userSettings[user];
        
        if (notificationType == NotificationType.LIKE) return settings.likesEnabled;
        if (notificationType == NotificationType.COMMENT) return settings.commentsEnabled;
        if (notificationType == NotificationType.SHARE) return settings.sharesEnabled;
        if (notificationType == NotificationType.FOLLOW) return settings.followsEnabled;
        if (notificationType == NotificationType.MESSAGE) return settings.messagesEnabled;
        if (notificationType == NotificationType.MENTION) return settings.mentionsEnabled;
        if (notificationType == NotificationType.NFT_SALE) return settings.nftSalesEnabled;
        if (notificationType == NotificationType.TOKEN_TRANSFER) return settings.tokenTransfersEnabled;
        if (notificationType == NotificationType.MODERATION_ACTION) return settings.moderationEnabled;
        if (notificationType == NotificationType.SYSTEM_ANNOUNCEMENT) return settings.systemAnnouncementsEnabled;
        
        return true;
    }
    
    /**
     * @dev Check if user has custom settings
     */
    function _hasCustomSettings(address user) internal view returns (bool) {
        // Simple check - in a real implementation you might track this differently
        NotificationSettings memory settings = userSettings[user];
        return settings.likesEnabled || settings.commentsEnabled || 
               settings.sharesEnabled || settings.followsEnabled ||
               settings.messagesEnabled || settings.mentionsEnabled ||
               settings.nftSalesEnabled || settings.tokenTransfersEnabled ||
               settings.moderationEnabled || settings.systemAnnouncementsEnabled;
    }
    
    /**
     * @dev Get notification statistics
     */
    function getNotificationStats() external view returns (
        uint256 totalNotificationsCount,
        uint256 totalUnreadCount
    ) {
        // Note: totalUnreadCount would need to be calculated differently in production
        return (totalNotifications, 0);
    }
}
