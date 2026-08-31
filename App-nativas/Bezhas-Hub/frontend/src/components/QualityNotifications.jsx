import React from 'react';
import { Bell, X, Check, CheckCheck, Trash2, ExternalLink } from 'lucide-react';
import { useQualityNotifications } from '../hooks/useQualityNotifications';
import '../styles/QualityNotifications.css';

/**
 * Quality Oracle Notification Center
 * Real-time notification display and management
 */
export default function QualityNotifications() {
    const {
        notifications,
        unreadCount,
        hasUnread,
        isConnected,
        stats,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAll
    } = useQualityNotifications();

    const [isOpen, setIsOpen] = React.useState(false);

    /**
     * Get icon for notification type
     */
    const getNotificationIcon = (type) => {
        const iconMap = {
            'quality_oracle:service_created': '🎯',
            'quality_oracle:service_finalized': '✅',
            'quality_oracle:dispute_opened': '⚡',
            'quality_oracle:dispute_resolved': '✅',
            'quality_oracle:quality_warning': '⚠️',
            'quality_oracle:collateral_released': '💰',
            'quality_oracle:penalty_applied': '⚠️',
            'quality_oracle:daily_summary': '📊'
        };
        return iconMap[type] || '🔔';
    };

    /**
     * Get priority color
     */
    const getPriorityColor = (priority) => {
        const colorMap = {
            critical: '#ef4444',
            high: '#f59e0b',
            medium: '#3b82f6',
            low: '#6b7280'
        };
        return colorMap[priority] || '#6b7280';
    };

    /**
     * Format timestamp
     */
    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    /**
     * Handle notification click
     */
    const handleNotificationClick = (notification) => {
        if (!notification.read) {
            markAsRead(notification.id);
        }

        // Navigate to action URL if provided
        if (notification.actionUrl) {
            window.location.href = notification.actionUrl;
        }
    };

    return (
        <div className="quality-notifications">
            {/* Notification Bell Button */}
            <button
                className={`notification-bell ${hasUnread ? 'has-unread' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                title="Quality Oracle Notifications"
            >
                <Bell size={20} />
                {hasUnread && (
                    <span className="notification-badge">{unreadCount}</span>
                )}
                <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`} />
            </button>

            {/* Notification Panel */}
            {isOpen && (
                <div className="notification-panel">
                    {/* Header */}
                    <div className="notification-header">
                        <div className="header-title">
                            <h3>Quality Oracle</h3>
                            <span className={`status-indicator ${isConnected ? 'online' : 'offline'}`}>
                                {isConnected ? '● Live' : '○ Offline'}
                            </span>
                        </div>
                        <div className="header-actions">
                            {notifications.length > 0 && (
                                <>
                                    {hasUnread && (
                                        <button
                                            className="icon-btn"
                                            onClick={markAllAsRead}
                                            title="Mark all as read"
                                        >
                                            <CheckCheck size={16} />
                                        </button>
                                    )}
                                    <button
                                        className="icon-btn"
                                        onClick={clearAll}
                                        title="Clear all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            )}
                            <button
                                className="icon-btn"
                                onClick={() => setIsOpen(false)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Stats Summary */}
                    {stats && (
                        <div className="notification-stats">
                            <div className="stat-item">
                                <span className="stat-label">Active</span>
                                <span className="stat-value">{stats.activeServices || 0}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Avg Quality</span>
                                <span className="stat-value">{stats.averageQuality || 0}%</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Disputes</span>
                                <span className="stat-value">{stats.disputedServices || 0}</span>
                            </div>
                        </div>
                    )}

                    {/* Notification List */}
                    <div className="notification-list">
                        {notifications.length === 0 ? (
                            <div className="empty-state">
                                <Bell size={48} opacity={0.3} />
                                <p>No notifications yet</p>
                                <span>You'll be notified about quality services</span>
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                                    style={{ borderLeftColor: getPriorityColor(notification.priority) }}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="notification-icon">
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                    <div className="notification-content">
                                        <div className="notification-title">
                                            {notification.title}
                                            {!notification.read && (
                                                <span className="unread-dot" />
                                            )}
                                        </div>
                                        <div className="notification-message">
                                            {notification.message}
                                        </div>
                                        <div className="notification-meta">
                                            <span className="notification-time">
                                                {formatTime(notification.timestamp)}
                                            </span>
                                            {notification.actionUrl && (
                                                <span className="notification-action">
                                                    <ExternalLink size={12} />
                                                    View
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="notification-actions">
                                        {!notification.read && (
                                            <button
                                                className="icon-btn-small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    markAsRead(notification.id);
                                                }}
                                                title="Mark as read"
                                            >
                                                <Check size={14} />
                                            </button>
                                        )}
                                        <button
                                            className="icon-btn-small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                clearNotification(notification.id);
                                            }}
                                            title="Clear"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="notification-footer">
                            <span className="notification-count">
                                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                            </span>
                            {unreadCount > 0 && (
                                <span className="unread-count">
                                    {unreadCount} unread
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
