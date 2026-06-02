import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Replace with real auth context/user
const getCurrentUser = () => {
    // TODO: Replace with real user from auth context
    return '0x1234567890abcdef1234567890abcdef12345678';
};

export function useNotifications() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const currentUser = getCurrentUser();

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            // Usar ruta relativa - el proxy de Vite lo dirigirá al backend
            const response = await axios.get(`/api/notifications/${currentUser}`, {
                timeout: 3000
            });
            // Asegurar que siempre sea un array
            const data = response.data;
            setNotifications(Array.isArray(data) ? data : []);
        } catch (error) {
            // Silently fail - no backend available or no notifications
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const markAsRead = async (notificationId) => {
        try {
            await axios.patch(`/api/notifications/${notificationId}/read`, {}, {
                timeout: 3000
            });
            setNotifications(prev =>
                prev.map(notif =>
                    notif.id === notificationId ? { ...notif, read: true } : notif
                )
            );
        } catch (error) {
            // Optimistic update even if request fails
            setNotifications(prev =>
                prev.map(notif =>
                    notif.id === notificationId ? { ...notif, read: true } : notif
                )
            );
        }
    };

    const markAllAsRead = async () => {
        try {
            await axios.post(`${API_URL}/notifications/${currentUser}/read-all`);
            setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
        } catch (error) {
            setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
        }
    };

    const deleteNotification = async (notificationId) => {
        try {
            await axios.delete(`${API_URL}/notifications/${notificationId}`);
            setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        } catch (error) {
            setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
        }
    };

    return {
        notifications: Array.isArray(notifications) ? notifications : [],
        loading,
        unreadCount: Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
    };
}
