/**
 * WebSocket Hub Service
 * Enhanced real-time communication hub for Web3 events
 * Integrates with blockchain indexer and queue system
 * 
 * @module services/websocket-hub.service
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const pino = require('pino');
const redisService = require('./redis.service');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Room types for subscription management
 */
const ROOM_TYPES = {
    USER: 'user',           // User-specific updates
    FEED: 'feed',           // Feed updates
    DAO: 'dao',             // DAO proposal updates
    TRANSACTION: 'tx',      // Transaction status
    NFT: 'nft',             // NFT updates
    STAKING: 'staking',     // Staking rewards
    MARKETPLACE: 'market',  // Marketplace listings
    GLOBAL: 'global'        // Global announcements
};

/**
 * Event types for real-time updates
 */
const EVENT_TYPES = {
    // Transaction events
    TX_PENDING: 'tx:pending',
    TX_CONFIRMED: 'tx:confirmed',
    TX_FAILED: 'tx:failed',

    // User events
    USER_ONLINE: 'user:online',
    USER_OFFLINE: 'user:offline',
    USER_NOTIFICATION: 'user:notification',
    USER_BALANCE_UPDATE: 'user:balance',

    // Feed events
    FEED_NEW_POST: 'feed:newPost',
    FEED_POST_LIKED: 'feed:postLiked',
    FEED_POST_SHARED: 'feed:postShared',
    FEED_POST_VALIDATED: 'feed:postValidated',

    // DAO events
    DAO_NEW_PROPOSAL: 'dao:newProposal',
    DAO_VOTE_CAST: 'dao:voteCast',
    DAO_PROPOSAL_EXECUTED: 'dao:executed',

    // NFT events
    NFT_MINTED: 'nft:minted',
    NFT_TRANSFERRED: 'nft:transferred',
    NFT_LISTED: 'nft:listed',
    NFT_SOLD: 'nft:sold',

    // Staking events
    STAKING_REWARD: 'staking:reward',
    STAKING_UPDATE: 'staking:update',

    // System events
    SYSTEM_ANNOUNCEMENT: 'system:announcement',
    SYSTEM_MAINTENANCE: 'system:maintenance'
};

class WebSocketHub {
    constructor() {
        this.wss = null;
        this.clients = new Map();          // userId/address -> Set of WebSocket connections
        this.rooms = new Map();            // roomId -> Set of client identifiers
        this.subscriptions = new Map();    // clientId -> Set of room subscriptions
        this.redisPublisher = null;
        this.redisSubscriber = null;
        this.isInitialized = false;
        this.heartbeatInterval = null;

        // Configuration
        this.config = {
            heartbeatInterval: 30000,      // 30 seconds
            connectionTimeout: 35000,
            maxConnectionsPerUser: 5,
            maxRoomsPerClient: 50
        };
    }

    /**
     * Initialize the WebSocket hub
     */
    async initialize(server) {
        try {
            // Create WebSocket server
            this.wss = new WebSocket.Server({
                server,
                path: '/ws',
                maxPayload: 1024 * 64 // 64KB max message size
            });

            // Setup Redis pub/sub for horizontal scaling
            await this.setupRedisPubSub();

            // Setup WebSocket handlers
            this.setupWebSocketHandlers();

            // Start heartbeat
            this.startHeartbeat();

            this.isInitialized = true;
            logger.info('✅ WebSocket Hub initialized');

            return true;
        } catch (error) {
            logger.error({ error: error.message }, '❌ WebSocket Hub initialization failed');
            return false;
        }
    }

    /**
     * Setup Redis pub/sub for multi-instance support
     */
    async setupRedisPubSub() {
        try {
            const connection = await redisService.getConnection();
            if (!connection) {
                logger.warn('Redis not available - WebSocket Hub running in single-instance mode');
                return;
            }

            // Create separate connections for pub/sub
            const IORedis = require('ioredis');

            this.redisPublisher = connection.duplicate();
            this.redisSubscriber = connection.duplicate();

            // Subscribe to WebSocket channel
            await this.redisSubscriber.subscribe('ws:broadcast', 'ws:room', 'ws:user');

            this.redisSubscriber.on('message', (channel, message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleRedisMessage(channel, data);
                } catch (error) {
                    logger.error({ error: error.message }, 'Redis message parse error');
                }
            });

            logger.info('Redis pub/sub initialized for WebSocket Hub');
        } catch (error) {
            logger.warn({ error: error.message }, 'Redis pub/sub setup failed');
        }
    }

    /**
     * Handle messages from Redis (other instances)
     */
    handleRedisMessage(channel, data) {
        switch (channel) {
            case 'ws:broadcast':
                this.localBroadcast(data.event, data.payload, data.exclude);
                break;
            case 'ws:room':
                this.localEmitToRoom(data.room, data.event, data.payload);
                break;
            case 'ws:user':
                this.localEmitToUser(data.userId, data.event, data.payload);
                break;
        }
    }

    /**
     * Setup WebSocket connection handlers
     */
    setupWebSocketHandlers() {
        this.wss.on('connection', (ws, req) => {
            // Initialize connection
            const clientId = this.generateClientId();
            ws.clientId = clientId;
            ws.isAlive = true;
            ws.userId = null;
            ws.address = null;
            ws.connectedAt = Date.now();
            ws.subscriptions = new Set();

            logger.debug({ clientId }, 'New WebSocket connection');

            // Pong handler for heartbeat
            ws.on('pong', () => {
                ws.isAlive = true;
            });

            // Message handler
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    await this.handleMessage(ws, data);
                } catch (error) {
                    this.sendError(ws, 'Invalid message format');
                }
            });

            // Close handler
            ws.on('close', () => {
                this.handleDisconnect(ws);
            });

            // Error handler
            ws.on('error', (error) => {
                logger.error({ clientId, error: error.message }, 'WebSocket error');
            });

            // Send welcome message
            this.send(ws, 'connected', {
                clientId,
                serverTime: Date.now()
            });
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    async handleMessage(ws, data) {
        const { type, payload = {} } = data;

        switch (type) {
            case 'authenticate':
                await this.handleAuthenticate(ws, payload);
                break;

            case 'authenticate:wallet':
                await this.handleWalletAuth(ws, payload);
                break;

            case 'subscribe':
                this.handleSubscribe(ws, payload);
                break;

            case 'unsubscribe':
                this.handleUnsubscribe(ws, payload);
                break;

            case 'subscribe:tx':
                this.handleSubscribeTransaction(ws, payload);
                break;

            case 'ping':
                this.send(ws, 'pong', { timestamp: Date.now() });
                break;

            default:
                this.sendError(ws, `Unknown message type: ${type}`);
        }
    }

    /**
     * Handle JWT authentication
     */
    async handleAuthenticate(ws, payload) {
        const { token } = payload;

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            ws.userId = decoded.userId || decoded.id;
            ws.userRole = decoded.role;

            // Track connection
            this.addClientToUser(ws.userId, ws);

            // Auto-subscribe to user room
            this.joinRoom(ws, `${ROOM_TYPES.USER}:${ws.userId}`);

            this.send(ws, 'authenticated', {
                userId: ws.userId,
                role: ws.userRole
            });

            // Emit online status
            this.emitToRoom(
                ROOM_TYPES.GLOBAL,
                EVENT_TYPES.USER_ONLINE,
                { userId: ws.userId, timestamp: Date.now() }
            );

            logger.info({ userId: ws.userId, clientId: ws.clientId }, 'User authenticated via JWT');
        } catch (error) {
            this.sendError(ws, 'Authentication failed');
        }
    }

    /**
     * Handle wallet signature authentication
     */
    async handleWalletAuth(ws, payload) {
        const { address, signature, message } = payload;

        try {
            const recoveredAddress = ethers.verifyMessage(message, signature);

            if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
                this.sendError(ws, 'Invalid signature');
                return;
            }

            ws.address = address.toLowerCase();
            ws.userId = address.toLowerCase();

            // Track connection
            this.addClientToUser(ws.address, ws);

            // Auto-subscribe to user room
            this.joinRoom(ws, `${ROOM_TYPES.USER}:${ws.address}`);

            this.send(ws, 'authenticated', {
                address: ws.address,
                method: 'wallet'
            });

            logger.info({ address: ws.address, clientId: ws.clientId }, 'User authenticated via wallet');
        } catch (error) {
            this.sendError(ws, 'Wallet authentication failed');
        }
    }

    /**
     * Handle room subscription
     */
    handleSubscribe(ws, payload) {
        const { room, rooms } = payload;

        const roomsToJoin = rooms || (room ? [room] : []);

        if (roomsToJoin.length === 0) {
            this.sendError(ws, 'No room specified');
            return;
        }

        // Check subscription limit
        if (ws.subscriptions.size + roomsToJoin.length > this.config.maxRoomsPerClient) {
            this.sendError(ws, 'Maximum room subscriptions exceeded');
            return;
        }

        const joined = [];
        for (const r of roomsToJoin) {
            if (this.joinRoom(ws, r)) {
                joined.push(r);
            }
        }

        this.send(ws, 'subscribed', { rooms: joined });
    }

    /**
     * Handle room unsubscription
     */
    handleUnsubscribe(ws, payload) {
        const { room, rooms } = payload;

        const roomsToLeave = rooms || (room ? [room] : []);

        for (const r of roomsToLeave) {
            this.leaveRoom(ws, r);
        }

        this.send(ws, 'unsubscribed', { rooms: roomsToLeave });
    }

    /**
     * Handle transaction subscription
     */
    handleSubscribeTransaction(ws, payload) {
        const { txHash, userOpHash } = payload;
        const hash = txHash || userOpHash;

        if (!hash) {
            this.sendError(ws, 'Transaction hash required');
            return;
        }

        const room = `${ROOM_TYPES.TRANSACTION}:${hash}`;
        this.joinRoom(ws, room);

        this.send(ws, 'subscribed:tx', { hash, room });
    }

    /**
     * Join a room
     */
    joinRoom(ws, roomId) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }

        this.rooms.get(roomId).add(ws.clientId);
        ws.subscriptions.add(roomId);

        logger.debug({ clientId: ws.clientId, room: roomId }, 'Joined room');
        return true;
    }

    /**
     * Leave a room
     */
    leaveRoom(ws, roomId) {
        if (this.rooms.has(roomId)) {
            this.rooms.get(roomId).delete(ws.clientId);

            // Clean up empty rooms
            if (this.rooms.get(roomId).size === 0) {
                this.rooms.delete(roomId);
            }
        }

        ws.subscriptions.delete(roomId);
        logger.debug({ clientId: ws.clientId, room: roomId }, 'Left room');
    }

    /**
     * Handle client disconnect
     */
    handleDisconnect(ws) {
        // Leave all rooms
        for (const room of ws.subscriptions) {
            this.leaveRoom(ws, room);
        }

        // Remove from user's connections
        if (ws.userId) {
            this.removeClientFromUser(ws.userId, ws);

            // Emit offline if no more connections for this user
            if (!this.clients.has(ws.userId) || this.clients.get(ws.userId).size === 0) {
                this.emitToRoom(
                    ROOM_TYPES.GLOBAL,
                    EVENT_TYPES.USER_OFFLINE,
                    { userId: ws.userId, timestamp: Date.now() }
                );
            }
        }

        logger.debug({ clientId: ws.clientId, userId: ws.userId }, 'Client disconnected');
    }

    /**
     * Track client connection for a user
     */
    addClientToUser(userId, ws) {
        if (!this.clients.has(userId)) {
            this.clients.set(userId, new Set());
        }

        const userConnections = this.clients.get(userId);

        // Enforce max connections per user
        if (userConnections.size >= this.config.maxConnectionsPerUser) {
            // Close oldest connection
            const oldest = userConnections.values().next().value;
            if (oldest) {
                oldest.close(1000, 'Too many connections');
                userConnections.delete(oldest);
            }
        }

        userConnections.add(ws);
    }

    /**
     * Remove client from user tracking
     */
    removeClientFromUser(userId, ws) {
        if (this.clients.has(userId)) {
            this.clients.get(userId).delete(ws);

            if (this.clients.get(userId).size === 0) {
                this.clients.delete(userId);
            }
        }
    }

    // ============ PUBLIC EMIT METHODS ============

    /**
     * Emit event to a specific room
     */
    emitToRoom(room, event, payload) {
        // Local emit
        this.localEmitToRoom(room, event, payload);

        // Publish to Redis for other instances
        if (this.redisPublisher) {
            this.redisPublisher.publish('ws:room', JSON.stringify({ room, event, payload }));
        }
    }

    /**
     * Local room emit (for this instance only)
     */
    localEmitToRoom(room, event, payload) {
        const roomId = room.includes(':') ? room : `${ROOM_TYPES.GLOBAL}:${room}`;
        const clientIds = this.rooms.get(roomId);

        if (!clientIds || clientIds.size === 0) return;

        const message = JSON.stringify({ type: event, payload, room: roomId, timestamp: Date.now() });

        this.wss.clients.forEach((ws) => {
            if (clientIds.has(ws.clientId) && ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }

    /**
     * Emit event to a specific user (all their connections)
     */
    emitToUser(userId, event, payload) {
        // Local emit
        this.localEmitToUser(userId, event, payload);

        // Publish to Redis
        if (this.redisPublisher) {
            this.redisPublisher.publish('ws:user', JSON.stringify({ userId, event, payload }));
        }
    }

    /**
     * Local user emit
     */
    localEmitToUser(userId, event, payload) {
        const connections = this.clients.get(userId);
        if (!connections) return;

        const message = JSON.stringify({ type: event, payload, timestamp: Date.now() });

        connections.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }

    /**
     * Broadcast to all connected clients
     */
    broadcast(event, payload, excludeUserId = null) {
        // Local broadcast
        this.localBroadcast(event, payload, excludeUserId);

        // Publish to Redis
        if (this.redisPublisher) {
            this.redisPublisher.publish('ws:broadcast', JSON.stringify({ event, payload, exclude: excludeUserId }));
        }
    }

    /**
     * Local broadcast
     */
    localBroadcast(event, payload, excludeUserId = null) {
        const message = JSON.stringify({ type: event, payload, timestamp: Date.now() });

        this.wss.clients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN && ws.userId !== excludeUserId) {
                ws.send(message);
            }
        });
    }

    // ============ BLOCKCHAIN EVENT EMITTERS ============

    /**
     * Emit transaction update
     */
    emitTransactionUpdate(txHash, status, data = {}) {
        const room = `${ROOM_TYPES.TRANSACTION}:${txHash}`;
        const eventType = status === 'confirmed' ? EVENT_TYPES.TX_CONFIRMED :
            status === 'failed' ? EVENT_TYPES.TX_FAILED :
                EVENT_TYPES.TX_PENDING;

        this.emitToRoom(room, eventType, { txHash, status, ...data });
    }

    /**
     * Emit new post event
     */
    emitNewPost(post, targetUserIds = []) {
        // Emit to global feed
        this.emitToRoom(ROOM_TYPES.FEED, EVENT_TYPES.FEED_NEW_POST, post);

        // Emit to specific users (followers)
        targetUserIds.forEach(userId => {
            this.emitToUser(userId, EVENT_TYPES.FEED_NEW_POST, post);
        });
    }

    /**
     * Emit DAO event
     */
    emitDAOEvent(daoId, eventType, data) {
        const room = `${ROOM_TYPES.DAO}:${daoId}`;
        this.emitToRoom(room, eventType, data);
    }

    /**
     * Emit NFT event
     */
    emitNFTEvent(eventType, data) {
        // Emit to NFT room
        this.emitToRoom(ROOM_TYPES.NFT, eventType, data);

        // Emit to involved users
        if (data.from) this.emitToUser(data.from, eventType, data);
        if (data.to) this.emitToUser(data.to, eventType, data);
    }

    /**
     * Emit balance update
     */
    emitBalanceUpdate(userId, balanceData) {
        this.emitToUser(userId, EVENT_TYPES.USER_BALANCE_UPDATE, balanceData);
    }

    /**
     * Emit notification
     */
    emitNotification(userId, notification) {
        this.emitToUser(userId, EVENT_TYPES.USER_NOTIFICATION, notification);
    }

    // ============ UTILITY METHODS ============

    /**
     * Send message to specific client
     */
    send(ws, type, payload) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
        }
    }

    /**
     * Send error to client
     */
    sendError(ws, message, code = 'ERROR') {
        this.send(ws, 'error', { code, message });
    }

    /**
     * Generate unique client ID
     */
    generateClientId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Start heartbeat to detect dead connections
     */
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    return ws.terminate();
                }

                ws.isAlive = false;
                ws.ping();
            });

            // Clean up empty rooms periodically
            this.rooms.forEach((clients, roomId) => {
                if (clients.size === 0) {
                    this.rooms.delete(roomId);
                }
            });
        }, this.config.heartbeatInterval);
    }

    /**
     * Get connection statistics
     */
    getStats() {
        let authenticated = 0;
        let anonymous = 0;

        this.wss.clients.forEach((ws) => {
            if (ws.userId) authenticated++;
            else anonymous++;
        });

        return {
            totalConnections: this.wss.clients.size,
            authenticatedUsers: this.clients.size,
            authenticatedConnections: authenticated,
            anonymousConnections: anonymous,
            rooms: this.rooms.size,
            isRedisEnabled: !!this.redisPublisher
        };
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        // Close all connections
        this.wss.clients.forEach((ws) => {
            ws.close(1001, 'Server shutting down');
        });

        // Close Redis connections
        if (this.redisPublisher) {
            await this.redisPublisher.quit();
        }
        if (this.redisSubscriber) {
            await this.redisSubscriber.quit();
        }

        logger.info('WebSocket Hub shut down');
    }
}

// Export constants
module.exports.ROOM_TYPES = ROOM_TYPES;
module.exports.EVENT_TYPES = EVENT_TYPES;

// Singleton instance
const wsHub = new WebSocketHub();
module.exports = wsHub;
