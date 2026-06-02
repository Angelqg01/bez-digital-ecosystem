console.log('🔌 Loading WebSocketServer dependencies...');
const WebSocket = require('ws');
console.log('🔌 ws loaded');
const jwt = require('jsonwebtoken');
console.log('🔌 jwt loaded');
const { ethers } = require('ethers');
console.log('🔌 ethers loaded');
const pino = require('pino');
console.log('🔌 pino loaded');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

class WebSocketServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Map(); // address -> WebSocket
        this.rooms = new Map(); // roomId -> Set of addresses
        this.heartbeatInterval = null;
        this.HEARTBEAT_INTERVAL = 30000; // 30 seconds
        this.CONNECTION_TIMEOUT = 35000; // 35 seconds (slightly more than heartbeat)

        this.setupWebSocketServer();
        this.startHeartbeat();
    }

    /**
     * Start heartbeat mechanism to detect dead connections
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    logger.warn({ address: ws.userAddress }, 'Terminating dead connection');
                    this.handleDisconnection(ws);
                    return ws.terminate();
                }

                ws.isAlive = false;
                ws.ping();
            });

            // Clean up empty rooms
            this.rooms.forEach((addresses, roomId) => {
                if (addresses.size === 0) {
                    this.rooms.delete(roomId);
                    logger.info({ roomId }, 'Removed empty room');
                }
            });

        }, this.HEARTBEAT_INTERVAL);

        logger.info('WebSocket heartbeat started');
    }

    setupWebSocketServer() {
        this.wss.on('connection', (ws, req) => {
            logger.info('New WebSocket connection');

            // Initialize connection state
            ws.isAlive = true;
            ws.connectionTime = Date.now();

            // Pong handler
            ws.on('pong', () => {
                ws.isAlive = true;
            });

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleMessage(ws, data);
                } catch (error) {
                    logger.error({ error: error.message }, 'WebSocket message error');
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format'
                    }));
                }
            });

            ws.on('close', () => {
                this.handleDisconnection(ws);
            });

            ws.on('error', (error) => {
                logger.error({ error: error.message }, 'WebSocket error');
            });
        });

        // Handle server shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }

    async handleMessage(ws, data) {
        const { type, payload } = data;

        switch (type) {
            case 'authenticate':
                await this.handleAuthentication(ws, payload);
                break;

            case 'join_room':
                this.handleJoinRoom(ws, payload);
                break;

            case 'leave_room':
                this.handleLeaveRoom(ws, payload);
                break;

            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;

            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Unknown message type'
                }));
        }
    }

    async handleAuthentication(ws, payload) {
        try {
            const { address, signature, message } = payload;

            // Verify the signature
            const recoveredAddress = ethers.verifyMessage(message, signature);

            if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
                ws.send(JSON.stringify({
                    type: 'auth_error',
                    message: 'Invalid signature'
                }));
                return;
            }

            // Store the authenticated connection
            ws.userAddress = address.toLowerCase();
            this.clients.set(address.toLowerCase(), ws);

            ws.send(JSON.stringify({
                type: 'authenticated',
                address: address.toLowerCase()
            }));

            // Broadcast user online status to all connected clients
            this.broadcast({
                type: 'user:online',
                user: {
                    address: address.toLowerCase(),
                    timestamp: Date.now()
                }
            }, address.toLowerCase());

            logger.info({ address }, 'User authenticated');

        } catch (error) {
            logger.error({ error: error.message }, 'Authentication error');
            ws.send(JSON.stringify({
                type: 'auth_error',
                message: 'Authentication failed'
            }));
        }
    }

    handleDisconnection(ws) {
        if (ws.userAddress) {
            logger.info({ address: ws.userAddress }, 'User disconnected');

            // Broadcast user offline status
            this.broadcast({
                type: 'user:offline',
                user: {
                    address: ws.userAddress,
                    timestamp: Date.now()
                }
            }, ws.userAddress);

            // Remove from clients map
            this.clients.delete(ws.userAddress);

            // Remove from all rooms
            this.rooms.forEach((addresses, roomId) => {
                addresses.delete(ws.userAddress);
            });
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        logger.info('Shutting down WebSocket server...');

        // Clear heartbeat interval
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        // Close all client connections
        this.wss.clients.forEach((ws) => {
            ws.send(JSON.stringify({
                type: 'server_shutdown',
                message: 'Server is shutting down'
            }));
            ws.close(1000, 'Server shutdown');
        });

        // Close server
        return new Promise((resolve) => {
            this.wss.close(() => {
                logger.info('WebSocket server closed');
                resolve();
            });
        });
    }

    /**
     * Get connection statistics
     */
    getStats() {
        return {
            totalConnections: this.wss.clients.size,
            authenticatedClients: this.clients.size,
            totalRooms: this.rooms.size,
            uptime: process.uptime()
        };
    }

    handleJoinRoom(ws, payload) {
        if (!ws.userAddress) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Not authenticated'
            }));
            return;
        }

        const { roomId } = payload;

        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }

        this.rooms.get(roomId).add(ws.userAddress);
        ws.currentRoom = roomId;

        ws.send(JSON.stringify({
            type: 'joined_room',
            roomId
        }));
    }

    handleLeaveRoom(ws, payload) {
        if (!ws.userAddress || !ws.currentRoom) return;

        const room = this.rooms.get(ws.currentRoom);
        if (room) {
            room.delete(ws.userAddress);
            if (room.size === 0) {
                this.rooms.delete(ws.currentRoom);
            }
        }

        ws.currentRoom = null;
        ws.send(JSON.stringify({
            type: 'left_room'
        }));
    }

    handleDisconnection(ws) {
        if (ws.userAddress) {
            this.clients.delete(ws.userAddress);

            // Remove from rooms
            if (ws.currentRoom) {
                const room = this.rooms.get(ws.currentRoom);
                if (room) {
                    room.delete(ws.userAddress);
                    if (room.size === 0) {
                        this.rooms.delete(ws.currentRoom);
                    }
                }
            }

            console.log(`User disconnected: ${ws.userAddress}`);
        }
    }

    // Send notification to specific user
    sendNotificationToUser(address, notification) {
        const client = this.clients.get(address.toLowerCase());
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'notification',
                data: notification
            }));
            return true;
        }
        return false;
    }

    // Send message to room
    sendToRoom(roomId, message, excludeAddress = null) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.forEach(address => {
            if (excludeAddress && address === excludeAddress.toLowerCase()) return;

            const client = this.clients.get(address);
            if (client && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }

    // Broadcast to all connected users
    broadcast(message, excludeAddress = null) {
        this.clients.forEach((client, address) => {
            if (excludeAddress && address === excludeAddress.toLowerCase()) return;

            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }

    // Send real-time update for social interactions
    sendSocialUpdate(type, data) {
        const message = {
            type: 'social_update',
            updateType: type,
            data: data,
            timestamp: Date.now()
        };

        // Send to relevant users based on update type
        switch (type) {
            case 'new_post':
                this.broadcast(message);
                break;

            case 'post_liked':
            case 'post_commented':
                // Send to post author
                if (data.postAuthor) {
                    this.sendNotificationToUser(data.postAuthor, {
                        type: type,
                        ...data
                    });
                }
                break;

            case 'user_followed':
                // Send to followed user
                if (data.followedUser) {
                    this.sendNotificationToUser(data.followedUser, {
                        type: type,
                        ...data
                    });
                }
                break;

            default:
                this.broadcast(message);
        }
    }

    // --- Eventos de campañas para panel de anuncios ---
    broadcastAdEvent(event) {
        const data = JSON.stringify(event);
        if (global.wss && global.wss.clients) {
            global.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            });
        }
    }
}

// Función global para broadcast de eventos de anuncios
let wsServerInstance = null;
let adEventInterval = null;

function setWebSocketServerInstance(instance) {
    wsServerInstance = instance;
}

function broadcastAdEvent(event) {
    if (wsServerInstance) {
        wsServerInstance.broadcastAdEvent(event);
    }
}

/**
 * Start ad event simulation (only if needed)
 */
function startAdEventSimulation() {
    if (adEventInterval) {
        return; // Already running
    }

    if (process.env.ENABLE_AD_SIMULATION !== 'true') {
        logger.info('Ad event simulation disabled');
        return;
    }

    adEventInterval = setInterval(() => {
        try {
            broadcastAdEvent({
                type: 'Impresión',
                message: 'Nueva impresión registrada en campaña DeFi',
                timestamp: Date.now()
            });
        } catch (error) {
            logger.error({ error: error.message }, 'Error broadcasting ad event');
        }
    }, 10000);

    logger.info('Ad event simulation started');
}

/**
 * Stop ad event simulation
 */
function stopAdEventSimulation() {
    if (adEventInterval) {
        clearInterval(adEventInterval);
        adEventInterval = null;
        logger.info('Ad event simulation stopped');
    }
}

/**
 * Broadcast message to a specific user by address or userId
 * This is the main function used by other services for notifications
 * @param {string} userIdentifier - Wallet address or user ID
 * @param {string} eventType - Type of event (e.g., 'validation-success', 'vip-activated')
 * @param {object} data - Event data payload
 */
function broadcastToUser(userIdentifier, eventType, data) {
    if (!wsServerInstance) {
        logger.warn({ userIdentifier, eventType }, 'WebSocket server not initialized, notification skipped');
        return false;
    }

    try {
        const identifier = String(userIdentifier).toLowerCase();
        const message = {
            type: eventType,
            data: data,
            timestamp: Date.now()
        };

        // Try to find client by wallet address
        const client = wsServerInstance.clients.get(identifier);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
            logger.info({ userIdentifier, eventType }, 'WebSocket notification sent');
            return true;
        }

        // If not found, try userId lookup (iterate through clients)
        for (const [addr, ws] of wsServerInstance.clients.entries()) {
            if (ws.userId === userIdentifier || ws.userAddress === identifier) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(message));
                    logger.info({ userIdentifier, eventType }, 'WebSocket notification sent via userId');
                    return true;
                }
            }
        }

        logger.debug({ userIdentifier, eventType }, 'User not connected, notification not delivered');
        return false;
    } catch (error) {
        logger.error({ error: error.message, userIdentifier, eventType }, 'Error sending WebSocket notification');
        return false;
    }
}

/**
 * Broadcast message to a room
 */
function broadcastToRoom(roomId, eventType, data) {
    if (!wsServerInstance) {
        logger.warn({ roomId, eventType }, 'WebSocket server not initialized');
        return false;
    }

    try {
        wsServerInstance.sendToRoom(roomId, {
            type: eventType,
            data: data,
            timestamp: Date.now()
        });
        return true;
    } catch (error) {
        logger.error({ error: error.message, roomId, eventType }, 'Error broadcasting to room');
        return false;
    }
}

/**
 * Broadcast to all connected clients
 */
function broadcastToAll(eventType, data, excludeAddress = null) {
    if (!wsServerInstance) {
        return false;
    }

    try {
        wsServerInstance.broadcast({
            type: eventType,
            data: data,
            timestamp: Date.now()
        }, excludeAddress);
        return true;
    } catch (error) {
        logger.error({ error: error.message, eventType }, 'Error broadcasting to all');
        return false;
    }
}

/**
 * Get WebSocket server statistics
 */
function getWebSocketStats() {
    if (!wsServerInstance) {
        return { totalConnections: 0, authenticatedClients: 0, totalRooms: 0, uptime: 0 };
    }
    return wsServerInstance.getStats();
}

module.exports = {
    WebSocketServer,
    broadcastAdEvent,
    setWebSocketServerInstance,
    startAdEventSimulation,
    stopAdEventSimulation,
    // Notification functions for other services
    broadcastToUser,
    broadcastToRoom,
    broadcastToAll,
    getWebSocketStats
};

console.log('🔌 WebSocketServer module fully loaded');
