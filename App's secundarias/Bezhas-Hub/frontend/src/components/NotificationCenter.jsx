import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const NotificationCenter = ({ wsConnection, contracts }) => {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [settings, setSettings] = useState({
    enableMessages: true,
    enableMentions: true,
    enableLikes: true,
    enableComments: true,
    enableFollows: true,
    enableTransactions: true,
    enableShares: true,
    enableFriendRequests: true,
    enableGroupInvites: true,
    enableVerification: true,
    enableSystem: true,
    enablePushNotifications: true,
    enableEmailNotifications: false,
    quietHoursStart: 22,
    quietHoursEnd: 8,
    enableQuietHours: false
  });
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState({
    totalNotifications: 0,
    unreadNotifications: 0,
    todayNotifications: 0
  });
  const notificationRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated && wsConnection) {
      loadNotifications();
      setupWebSocketListeners();
    }
  }, [isAuthenticated, wsConnection]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const setupWebSocketListeners = () => {
    if (!wsConnection) return;

    wsConnection.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'notification') {
        handleNewNotification(data.data);
      } else if (data.type === 'social_update') {
        handleSocialUpdate(data);
      }
    });
  };

  const loadNotifications = async () => {
    try {
      // This would typically fetch from your backend/contract
      const mockNotifications = [
        {
          id: 1,
          type: 'like',
          message: 'John liked your post',
          timestamp: Date.now() - 300000,
          isRead: false,
          sender: '0x1234...5678'
        },
        {
          id: 2,
          type: 'comment',
          message: 'Alice commented on your post',
          timestamp: Date.now() - 600000,
          isRead: false,
          sender: '0x8765...4321'
        }
      ];

      setNotifications(mockNotifications);
      setUnreadCount(mockNotifications.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const handleNewNotification = (notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Show browser notification if permission granted
    if (Notification.permission === 'granted') {
      new Notification('BeZhas', {
        body: notification.message,
        icon: '/favicon.ico'
      });
    }
  };

  const handleSocialUpdate = (update) => {
    // Handle real-time social updates
    console.log('Social update received:', update);

    // You could update UI state here based on the update type
    switch (update.updateType) {
      case 'new_post':
        // Refresh feed or add new post to state
        break;
      case 'post_liked':
        // Update like count in UI
        break;
      case 'post_commented':
        // Update comment count in UI
        break;
      default:
        break;
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      setSettings(newSettings);
      // Here you would typically save to contract or backend
      console.log('Notification settings updated:', newSettings);
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like': return '❤️';
      case 'comment': return '💬';
      case 'share': return '🔄';
      case 'follow': return '👤';
      case 'message': return '✉️';
      case 'mention': return '@';
      case 'nft_sale': return '🖼️';
      case 'token_transfer': return '💰';
      case 'moderation': return '⚠️';
      case 'system': return '🔔';
      default: return '📢';
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (!isAuthenticated) return null;

  return (
    <div className="notification-center" ref={notificationRef}>
      <button
        className="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            <div className="notification-actions">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="settings-btn"
              >
                ⚙️
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="mark-all-read-btn"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {showSettings && (
            <div className="notification-settings">
              <h4>Notification Settings</h4>
              <div className="settings-grid">
                {Object.entries(settings).map(([key, value]) => (
                  <label key={key} className="setting-item">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => updateSettings({
                        ...settings,
                        [key]: e.target.checked
                      })}
                    />
                    <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).replace('Enabled', '')}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={requestNotificationPermission}
                className="permission-btn"
              >
                Enable Browser Notifications
              </button>
            </div>
          )}

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                  onClick={() => !notification.isRead && markAsRead(notification.id)}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="notification-content">
                    <p className="notification-message">{notification.message}</p>
                    <span className="notification-time">
                      {formatTimestamp(notification.timestamp)}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    className="delete-notification-btn"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
