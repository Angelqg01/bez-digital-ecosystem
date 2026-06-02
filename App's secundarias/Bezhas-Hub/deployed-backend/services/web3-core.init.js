/**
 * Web3 Core Services Initialization
 * Initializes and orchestrates all critical Web3 services
 * 
 * @module services/web3-core.init
 */

const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Import all core services
const cacheService = require('./cache.service');
const blockchainIndexer = require('./blockchain-indexer.service');
const blockchainQueue = require('./blockchain-queue.service');
const accountAbstraction = require('./account-abstraction.service');
const wsHub = require('./websocket-hub.service');
const decentralizedStorage = require('./decentralized-storage.service');
const didService = require('./did.service');

/**
 * Service initialization order (dependencies matter)
 */
const SERVICES = [
    { name: 'Cache', service: cacheService, init: null }, // Auto-initializes
    { name: 'BlockchainQueue', service: blockchainQueue, init: 'initialize' },
    { name: 'BlockchainIndexer', service: blockchainIndexer, init: 'start' },
    { name: 'AccountAbstraction', service: accountAbstraction, init: 'initialize' },
    { name: 'DecentralizedStorage', service: decentralizedStorage, init: 'initialize' },
    { name: 'DID', service: didService, init: 'initialize' }
];

class Web3CoreInitializer {
    constructor() {
        this.initialized = false;
        this.serviceStatus = new Map();
        this.httpServer = null;
    }

    /**
     * Initialize all Web3 core services
     */
    async initialize(httpServer = null) {
        logger.info('🚀 Initializing Web3 Core Services...');
        const startTime = Date.now();

        this.httpServer = httpServer;

        for (const { name, service, init } of SERVICES) {
            try {
                if (init && typeof service[init] === 'function') {
                    await service[init]();
                }
                this.serviceStatus.set(name, { status: 'active', error: null });
                logger.info(`✅ ${name} service initialized`);
            } catch (error) {
                this.serviceStatus.set(name, { status: 'failed', error: error.message });
                logger.error({ service: name, error: error.message }, `❌ ${name} service failed`);
            }
        }

        // Initialize WebSocket Hub separately (needs HTTP server)
        if (httpServer) {
            try {
                await wsHub.initialize(httpServer);
                this.serviceStatus.set('WebSocketHub', { status: 'active', error: null });
                logger.info('✅ WebSocketHub service initialized');
            } catch (error) {
                this.serviceStatus.set('WebSocketHub', { status: 'failed', error: error.message });
                logger.error({ error: error.message }, '❌ WebSocketHub service failed');
            }
        }

        // Setup cross-service event listeners
        this.setupEventListeners();

        this.initialized = true;
        const duration = Date.now() - startTime;

        logger.info({
            duration: `${duration}ms`,
            services: this.getStatusSummary()
        }, '🎉 Web3 Core Services initialization complete');

        return this.getStatus();
    }

    /**
     * Setup cross-service event listeners
     */
    setupEventListeners() {
        // Blockchain Indexer -> WebSocket Hub
        blockchainIndexer.on('newEvent', async (event) => {
            try {
                // Emit to relevant WebSocket rooms
                if (event.decodedArgs?.user) {
                    wsHub.emitToUser(event.decodedArgs.user, 'blockchain:event', event);
                }
                if (event.decodedArgs?.from) {
                    wsHub.emitToUser(event.decodedArgs.from, 'blockchain:event', event);
                }
                if (event.decodedArgs?.to) {
                    wsHub.emitToUser(event.decodedArgs.to, 'blockchain:event', event);
                }

                // Emit to contract-specific rooms
                wsHub.emitToRoom(`contract:${event.contractName}`, 'blockchain:event', event);

                // Special handling for specific event types
                switch (event.eventName) {
                    case 'Transfer':
                        wsHub.emitBalanceUpdate(event.decodedArgs.from, { type: 'sent' });
                        wsHub.emitBalanceUpdate(event.decodedArgs.to, { type: 'received' });
                        break;
                    case 'PostCreated':
                        wsHub.emitNewPost(event.args);
                        break;
                    case 'ProposalCreated':
                        wsHub.emitDAOEvent(event.args.daoId, 'dao:newProposal', event.args);
                        break;
                }
            } catch (error) {
                logger.error({ error: error.message }, 'Error handling blockchain event');
            }
        });

        // Blockchain Indexer started/stopped events
        blockchainIndexer.on('started', () => {
            wsHub.broadcast('system:indexer', { status: 'started' });
        });

        blockchainIndexer.on('stopped', () => {
            wsHub.broadcast('system:indexer', { status: 'stopped' });
        });

        logger.info('Cross-service event listeners configured');
    }

    /**
     * Get service status
     */
    getStatus() {
        const status = {
            initialized: this.initialized,
            services: {}
        };

        for (const [name, data] of this.serviceStatus) {
            status.services[name] = data;
        }

        return status;
    }

    /**
     * Get status summary for logging
     */
    getStatusSummary() {
        const summary = { active: 0, failed: 0 };
        for (const [, data] of this.serviceStatus) {
            if (data.status === 'active') summary.active++;
            else summary.failed++;
        }
        return summary;
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        logger.info('Shutting down Web3 Core Services...');

        // Stop services in reverse order
        const shutdownOrder = ['WebSocketHub', 'BlockchainIndexer', 'BlockchainQueue'];

        for (const name of shutdownOrder) {
            try {
                switch (name) {
                    case 'WebSocketHub':
                        await wsHub.shutdown();
                        break;
                    case 'BlockchainIndexer':
                        await blockchainIndexer.stop();
                        break;
                    case 'BlockchainQueue':
                        await blockchainQueue.shutdown();
                        break;
                }
                logger.info(`${name} shut down`);
            } catch (error) {
                logger.error({ service: name, error: error.message }, 'Shutdown error');
            }
        }

        this.initialized = false;
        logger.info('Web3 Core Services shut down complete');
    }

    /**
     * Health check for all services
     */
    async healthCheck() {
        const health = {
            status: 'healthy',
            services: {},
            timestamp: new Date().toISOString()
        };

        // Cache health
        try {
            const cacheStats = cacheService.getStats();
            health.services.cache = {
                status: 'healthy',
                hitRate: cacheStats.totals.hitRate + '%'
            };
        } catch {
            health.services.cache = { status: 'unhealthy' };
            health.status = 'degraded';
        }

        // Blockchain Indexer health
        try {
            const indexerStats = await blockchainIndexer.getStats();
            health.services.indexer = {
                status: indexerStats.isRunning ? 'healthy' : 'stopped',
                currentBlock: indexerStats.currentBlock,
                contractsIndexed: indexerStats.contractsIndexed
            };
        } catch {
            health.services.indexer = { status: 'unhealthy' };
            health.status = 'degraded';
        }

        // Queue health
        try {
            const queueStats = await blockchainQueue.getQueueStats();
            const totalPending = Object.values(queueStats).reduce((sum, q) => sum + q.waiting + q.active, 0);
            health.services.queue = {
                status: 'healthy',
                pendingJobs: totalPending
            };
        } catch {
            health.services.queue = { status: 'unhealthy' };
            health.status = 'degraded';
        }

        // WebSocket health
        try {
            const wsStats = wsHub.getStats();
            health.services.websocket = {
                status: 'healthy',
                connections: wsStats.totalConnections,
                authenticatedUsers: wsStats.authenticatedUsers
            };
        } catch {
            health.services.websocket = { status: 'unhealthy' };
            health.status = 'degraded';
        }

        // Account Abstraction health
        health.services.accountAbstraction = {
            status: accountAbstraction.isInitialized ? 'healthy' : 'disabled',
            ...accountAbstraction.getStatus()
        };

        // Storage health
        health.services.storage = {
            status: 'healthy',
            ...decentralizedStorage.getStatus()
        };

        // DID health
        health.services.did = {
            status: didService.isInitialized ? 'healthy' : 'disabled',
            issuerDID: didService.issuerDID
        };

        return health;
    }
}

// Export services for direct access
module.exports.cacheService = cacheService;
module.exports.blockchainIndexer = blockchainIndexer;
module.exports.blockchainQueue = blockchainQueue;
module.exports.accountAbstraction = accountAbstraction;
module.exports.wsHub = wsHub;
module.exports.decentralizedStorage = decentralizedStorage;
module.exports.didService = didService;

// Singleton initializer
const web3Core = new Web3CoreInitializer();
module.exports = web3Core;
