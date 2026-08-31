const NotificationPG = require('../models/pg/Notification');

exports.getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const notifications = await NotificationPG.getByUserId(userId, limit, offset);
        res.status(200).json({ success: true, count: notifications.length, data: notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, error: 'Server error retrieving notifications' });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await NotificationPG.getUnreadCount(userId);
        res.status(200).json({ success: true, unreadCount: count });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ success: false, error: 'Server error retrieving unread count' });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const notification = await NotificationPG.markAsRead(id, userId);
        if (!notification) {
            return res.status(404).json({ success: false, error: 'Notification not found' });
        }
        res.status(200).json({ success: true, data: notification });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        await NotificationPG.markAllAsRead(userId);
        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        await NotificationPG.delete(id, userId);
        res.status(200).json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};
