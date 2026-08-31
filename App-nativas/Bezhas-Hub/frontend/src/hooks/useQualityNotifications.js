import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

/**
 * Hook for Quality Oracle real-time notifications
 * 
 * Connects to WebSocket server and listens for Quality Oracle events
 * Automatically handles connection, reconnection, and cleanup
 */
export function useQualityNotifications() {
    const { address } = useAccount();
    const [notifications, setNotifications] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [stats, setStats] = useState(null);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);

    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 3000;

    /**
     * Add notification to state
     */
    const addNotification = useCallback((notification) => {
        setNotifications(prev => [
            {
                ...notification,
                id: `${Date.now()}-${Math.random()}`,
                read: false,
                receivedAt: new Date().toISOString()
            },
            ...prev
        ].slice(0, 50)); // Keep last 50 notifications
    }, []);

    /**
     * Connect to WebSocket
     */
    const connect = useCallback(() => {
        if (!address) {
            console.log('[Quality WS] No wallet connected, skipping');
            return;
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log('[Quality WS] Already connected');
            return;
        }

        try {
            console.log('[Quality WS] Connecting to', WS_URL);
            const ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                console.log('[Quality WS] Connected');
                setIsConnected(true);
                reconnectAttemptsRef.current = 0;

                // Authenticate
                ws.send(JSON.stringify({
                    type: 'auth',
                    address: address
                }));

                // Subscribe to Quality Oracle events
                ws.send(JSON.stringify({
                    type: 'subscribe',
                    channel: 'quality_oracle'
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('[Quality WS] Message:', message.type);

                    switch (message.type) {
                        case 'authenticated':
                            console.log('[Quality WS] Authenticated');
                            break;

                        case 'quality_oracle_update':
                            // Broadcast message to all users
                            if (message.data) {
                                addNotification(message.data);
                            }
                            break;

                        case 'notification':
                            // Personal notification
                            if (message.category === 'quality_oracle') {
                                addNotification(message);
                            }
                            break;

                        case 'quality_oracle:service_created':
                        case 'quality_oracle:service_finalized':
                        case 'quality_oracle:dispute_opened':
                        case 'quality_oracle:dispute_resolved':
                        case 'quality_oracle:quality_warning':
                        case 'quality_oracle:collateral_released':
                        case 'quality_oracle:penalty_applied':
                        case 'quality_oracle:daily_summary':
                            addNotification(message);
                            break;

                        case 'quality_oracle:stats_update':
                            if (message.data) {
                                setStats(message.data);
                            }
                            break;

                        default:
                            console.log('[Quality WS] Unknown message type:', message.type);
                    }
                } catch (error) {
                    console.error('[Quality WS] Error parsing message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('[Quality WS] Error:', error);
            };

            ws.onclose = (event) => {
                console.log('[Quality WS] Disconnected:', event.code, event.reason);
                setIsConnected(false);
                wsRef.current = null;

                // Attempt reconnection
                if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttemptsRef.current++;
                    console.log(
                        `[Quality WS] Reconnecting (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`
                    );
                    reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
                } else {
                    console.log('[Quality WS] Max reconnection attempts reached');
                }
            };

            wsRef.current = ws;
        } catch (error) {
            console.error('[Quality WS] Connection error:', error);
        }
    }, [address, addNotification]);

    /**
     * Disconnect from WebSocket
     */
    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (wsRef.current) {
            console.log('[Quality WS] Disconnecting');
            wsRef.current.close();
            wsRef.current = null;
        }

        setIsConnected(false);
    }, []);

    /**
     * Mark notification as read
     */
    const markAsRead = useCallback((notificationId) => {
        setNotifications(prev =>
            prev.map(notif =>
                notif.id === notificationId
                    ? { ...notif, read: true }
                    : notif
            )
        );
    }, []);

    /**
     * Mark all as read
     */
    const markAllAsRead = useCallback(() => {
        setNotifications(prev =>
            prev.map(notif => ({ ...notif, read: true }))
        );
    }, []);

    /**
     * Clear notification
     */
    const clearNotification = useCallback((notificationId) => {
        setNotifications(prev =>
            prev.filter(notif => notif.id !== notificationId)
        );
    }, []);

    /**
     * Clear all notifications
     */
    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    /**
     * Connect on mount and address change
     */
    useEffect(() => {
        if (address) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [address, connect, disconnect]);

    // Computed values
    const unreadCount = notifications.filter(n => !n.read).length;
    const hasUnread = unreadCount > 0;

    return {
        notifications,
        unreadCount,
        hasUnread,
        isConnected,
        stats,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAll,
        reconnect: connect
    };
}
