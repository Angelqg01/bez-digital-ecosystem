import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Filter, Users, Heart, MessageCircle, TrendingUp, Award } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const NotificationsPage = () => {
    const [notifications, setNotifications] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    // Mock user - replace with real auth
    const currentUser = '0x1234567890abcdef1234567890abcdef12345678';

    useEffect(() => {
        fetchNotifications();
    }, []);

    async function fetchNotifications() {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/notifications/${currentUser}`);
            setNotifications(response.data || []);
        } catch (error) {
            console.error('Error fetching notifications:', error);

            // Fallback to mock data
            setNotifications([
                {
                    id: 1,
                    type: 'like',
                    title: 'Nueva reacción',
                    message: 'A amiyoe le gustó tu publicación',
                    timestamp: new Date(Date.now() - 3600000).toISOString(),
                    read: false,
                    link: '/feed'
                },
                {
                    id: 2,
                    type: 'comment',
                    title: 'Nuevo comentario',
                    message: 'CryptoGuru comentó en tu post',
                    timestamp: new Date(Date.now() - 7200000).toISOString(),
                    read: false,
                    link: '/feed'
                },
                {
                    id: 3,
                    type: 'follow',
                    title: 'Nuevo seguidor',
                    message: 'DefiMaster ahora te sigue',
                    timestamp: new Date(Date.now() - 86400000).toISOString(),
                    read: true,
                    link: '/profile'
                },
                // Removed quest and group notifications
            ]);
        } finally {
            setLoading(false);
        }
    }

    async function markAsRead(notificationId) {
        try {
            await axios.patch(`${API_URL}/notifications/${notificationId}/read`);
            setNotifications(prev =>
                prev.map(notif =>
                    notif.id === notificationId ? { ...notif, read: true } : notif
                )
            );
            toast.success('Marcada como leída');
        } catch (error) {
            console.error('Error marking as read:', error);
            // Still update UI optimistically
            setNotifications(prev =>
                prev.map(notif =>
                    notif.id === notificationId ? { ...notif, read: true } : notif
                )
            );
        }
    }

    async function markAllAsRead() {
        try {
            await axios.post(`${API_URL}/notifications/${currentUser}/read-all`);
            setNotifications(prev =>
                prev.map(notif => ({ ...notif, read: true }))
            );
            toast.success('Todas las notificaciones marcadas como leídas');
        } catch (error) {
            console.error('Error marking all as read:', error);
            setNotifications(prev =>
                prev.map(notif => ({ ...notif, read: true }))
            );
        }
    }

    async function deleteNotification(notificationId) {
        try {
            await axios.delete(`${API_URL}/notifications/${notificationId}`);
            setNotifications(prev =>
                prev.filter(notif => notif.id !== notificationId)
            );
            toast.success('Notificación eliminada');
        } catch (error) {
            console.error('Error deleting notification:', error);
            setNotifications(prev =>
                prev.filter(notif => notif.id !== notificationId)
            );
        }
    }

    function getNotificationIcon(type) {
        switch (type) {
            case 'like':
                return <Heart className="w-5 h-5 text-red-500" />;
            case 'comment':
                return <MessageCircle className="w-5 h-5 text-blue-500" />;
            case 'follow':
                return <Users className="w-5 h-5 text-purple-500" />;
            case 'reward':
                return <Award className="w-5 h-5 text-yellow-500" />;
            case 'group':
                return <Users className="w-5 h-5 text-green-500" />;
            default:
                return <Bell className="w-5 h-5 text-gray-500" />;
        }
    }

    function formatTimestamp(timestamp) {
        const now = new Date();
        const notifDate = new Date(timestamp);
        const diffMs = now - notifDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours}h`;
        if (diffDays < 7) return `Hace ${diffDays}d`;
        return notifDate.toLocaleDateString();
    }

    const filteredNotifications = filter === 'all'
        ? notifications
        : filter === 'unread'
            ? notifications.filter(n => !n.read)
            : notifications.filter(n => n.type === filter);

    const unreadCount = notifications.filter(n => !n.read).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <Bell className="w-16 h-16 mx-auto mb-4 animate-pulse text-purple-600" />
                    <p className="text-lg text-gray-600 dark:text-gray-300">Cargando notificaciones...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white p-4 md:p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600 flex items-center gap-3">
                            <Bell className="w-8 h-8 text-purple-600" />
                            Notificaciones
                            {unreadCount > 0 && (
                                <span className="bg-red-500 text-white text-sm px-2 py-0.5 rounded-full">
                                    {unreadCount}
                                </span>
                            )}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Mantente al día con todas las actualizaciones
                        </p>
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors text-sm font-medium text-gray-700 dark:text-gray-200"
                        >
                            <Check className="w-4 h-4" />
                            Marcar todas como leídas
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    <Filter className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filter === 'all'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        Todas
                    </button>
                    <button
                        onClick={() => setFilter('unread')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filter === 'unread'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        No leídas {unreadCount > 0 && `(${unreadCount})`}
                    </button>
                    <button
                        onClick={() => setFilter('like')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filter === 'like'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        Me gusta
                    </button>
                    <button
                        onClick={() => setFilter('comment')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${filter === 'comment'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                    >
                        Comentarios
                    </button>
                </div>

                {/* Notifications List */}
                {filteredNotifications.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                        <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">No hay notificaciones</h3>
                        <p className="text-gray-500 dark:text-gray-400">Cuando recibas notificaciones, aparecerán aquí</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                        {filteredNotifications.map(notification => (
                            <div
                                key={notification.id}
                                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!notification.read ? 'bg-purple-50 dark:bg-purple-900/10' : ''
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`p-2 rounded-xl flex-shrink-0 ${!notification.read ? 'bg-white dark:bg-gray-800 shadow-sm' : 'bg-gray-100 dark:bg-gray-700'
                                        }`}>
                                        {getNotificationIcon(notification.type)}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h3 className={`font-semibold text-sm md:text-base truncate ${!notification.read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {notification.title}
                                            </h3>
                                            <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                                                {formatTimestamp(notification.timestamp)}
                                            </span>
                                        </div>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 line-clamp-2">{notification.message}</p>
                                        <div className="flex items-center gap-4">
                                            {!notification.read && (
                                                <button
                                                    onClick={() => markAsRead(notification.id)}
                                                    className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                                                >
                                                    <Check className="w-3 h-3" />
                                                    Marcar como leída
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteNotification(notification.id)}
                                                className="text-xs font-medium text-red-500 hover:underline flex items-center gap-1"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;
