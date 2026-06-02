const express = require('express');
const router = express.Router();

// Safe import of db
let db;
try {
    db = require('../database/inMemoryDB');
} catch (error) {
    console.warn('InMemoryDB not available, using fallback');
    db = null;
}

// In-memory notifications storage (extend InMemoryDB later)
const notifications = new Map();
let notificationIdCounter = 1;

// Get user notifications
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Return empty array if no notifications
        if (notifications.size === 0) {
            return res.json([]);
        }

        const userNotifications = Array.from(notifications.values())
            .filter(n => n.userId === userId.toLowerCase())
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json(userNotifications);
    } catch (error) {
        console.error('Error getting notifications:', error);
        // Return empty array instead of 500 error
        res.json([]);
    }
});

// Mark notification as read
router.patch('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const notification = notifications.get(parseInt(id));

        if (!notification) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }

        notification.read = true;
        notifications.set(parseInt(id), notification);

        res.json(notification);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Error al marcar notificación' });
    }
});

// Mark all notifications as read
router.post('/:userId/read-all', async (req, res) => {
    try {
        const { userId } = req.params;

        notifications.forEach((notification, key) => {
            if (notification.userId === userId.toLowerCase()) {
                notification.read = true;
                notifications.set(key, notification);
            }
        });

        res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ error: 'Error al marcar notificaciones' });
    }
});

// Delete notification
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = notifications.delete(parseInt(id));

        if (!deleted) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }

        res.json({ success: true, message: 'Notificación eliminada' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: 'Error al eliminar notificación' });
    }
});

// Create notification (used internally by other services)
router.post('/', async (req, res) => {
    try {
        const { userId, type, title, message, link } = req.body;

        const notification = {
            id: notificationIdCounter++,
            userId: userId.toLowerCase(),
            type,
            title,
            message,
            link: link || '/',
            read: false,
            timestamp: new Date().toISOString()
        };

        notifications.set(notification.id, notification);

        res.status(201).json(notification);
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ error: 'Error al crear notificación' });
    }
});

// Get unread count
router.get('/:userId/unread-count', async (req, res) => {
    try {
        const { userId } = req.params;
        const unreadCount = Array.from(notifications.values())
            .filter(n => n.userId === userId.toLowerCase() && !n.read)
            .length;

        res.json({ count: unreadCount });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ error: 'Error al obtener contador' });
    }
});

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

// In-memory storage for notification preferences
const notificationPreferences = new Map();

// Default preferences
const DEFAULT_PREFERENCES = {
    email: {
        marketing: true,
        security: true,
        transactions: true,
        vipUpdates: true,
        daoProposals: true,
        newsletter: false
    },
    push: {
        enabled: true,
        transactions: true,
        security: true,
        vipUpdates: true,
        daoProposals: true,
        newFollowers: true,
        mentions: true
    },
    inApp: {
        enabled: true,
        transactions: true,
        security: true,
        vipUpdates: true,
        daoProposals: true,
        newFollowers: true,
        mentions: true,
        likes: true,
        comments: true
    }
};

/**
 * GET /api/notifications/preferences/:userId
 * Get user notification preferences
 */
router.get('/preferences/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const userPrefs = notificationPreferences.get(userId.toLowerCase());

        res.json({
            success: true,
            preferences: userPrefs || DEFAULT_PREFERENCES
        });
    } catch (error) {
        console.error('Error getting notification preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener preferencias'
        });
    }
});

/**
 * PUT /api/notifications/preferences/:userId
 * Update user notification preferences
 */
router.put('/preferences/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { email, push, inApp } = req.body;

        // Get current or default preferences
        const currentPrefs = notificationPreferences.get(userId.toLowerCase()) || { ...DEFAULT_PREFERENCES };

        // Merge updates
        const updatedPrefs = {
            email: email ? { ...currentPrefs.email, ...email } : currentPrefs.email,
            push: push ? { ...currentPrefs.push, ...push } : currentPrefs.push,
            inApp: inApp ? { ...currentPrefs.inApp, ...inApp } : currentPrefs.inApp,
            updatedAt: new Date().toISOString()
        };

        notificationPreferences.set(userId.toLowerCase(), updatedPrefs);

        res.json({
            success: true,
            preferences: updatedPrefs,
            message: 'Preferencias actualizadas'
        });
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar preferencias'
        });
    }
});

/**
 * POST /api/notifications/subscribe-push/:userId
 * Subscribe to push notifications (save push subscription)
 */
router.post('/subscribe-push/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { subscription } = req.body;

        if (!subscription) {
            return res.status(400).json({
                success: false,
                error: 'Push subscription required'
            });
        }

        // Store push subscription (in production, save to DB)
        const userPrefs = notificationPreferences.get(userId.toLowerCase()) || { ...DEFAULT_PREFERENCES };
        userPrefs.pushSubscription = subscription;
        notificationPreferences.set(userId.toLowerCase(), userPrefs);

        res.json({
            success: true,
            message: 'Push notifications enabled'
        });
    } catch (error) {
        console.error('Error subscribing to push:', error);
        res.status(500).json({
            success: false,
            error: 'Error al suscribirse a notificaciones push'
        });
    }
});

/**
 * DELETE /api/notifications/subscribe-push/:userId
 * Unsubscribe from push notifications
 */
router.delete('/subscribe-push/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const userPrefs = notificationPreferences.get(userId.toLowerCase());
        if (userPrefs) {
            delete userPrefs.pushSubscription;
            userPrefs.push = { ...userPrefs.push, enabled: false };
            notificationPreferences.set(userId.toLowerCase(), userPrefs);
        }

        res.json({
            success: true,
            message: 'Push notifications disabled'
        });
    } catch (error) {
        console.error('Error unsubscribing from push:', error);
        res.status(500).json({
            success: false,
            error: 'Error al desuscribirse'
        });
    }
});

// Helper function to check if user wants notification type
function shouldSendNotification(userId, channel, type) {
    const prefs = notificationPreferences.get(userId.toLowerCase()) || DEFAULT_PREFERENCES;
    return prefs[channel]?.[type] ?? true;
}

// Export helper function for other services
module.exports = router;
module.exports.shouldSendNotification = shouldSendNotification;
module.exports.DEFAULT_PREFERENCES = DEFAULT_PREFERENCES;
