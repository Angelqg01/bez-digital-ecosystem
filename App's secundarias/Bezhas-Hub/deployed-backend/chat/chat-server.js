/**
 * ============================================================================
 * BEZHAS - CHAT SERVER WITH SOCKET.IO & REDIS
 * ============================================================================
 * 
 * PROPÓSITO:
 * Servidor principal de Socket.IO para el sistema de chat en tiempo real.
 * Integra Redis Pub/Sub para escalado horizontal (múltiples instancias).
 * 
 * ARQUITECTURA:
 * - Express: API REST para consultas HTTP
 * - Socket.IO: Comunicación bidireccional en tiempo real
 * - Redis Adapter: Sincronización entre múltiples instancias de Node.js
 * - Gatekeeper: Sistema de créditos y monetización
 * 
 * ESCALABILIDAD:
 * Este servidor puede ejecutarse en múltiples instancias (PM2, Kubernetes, etc.)
 * gracias al Redis Adapter que sincroniza eventos entre todas las instancias.
 * 
 * DEPLOYMENT:
 * - Development: node chat-server.js
 * - Production: pm2 start chat-server.js -i max (cluster mode)
 * 
 * INTEGRACIÓN:
 * - Conecta con Credit Service para verificación de saldo
 * - Conecta con AI Service para respuestas del agente IA
 * - Conecta con Main Backend para autenticación y datos de usuario
 * 
 * @module chatServer
 * @requires express
 * @requires socket.io
 * @requires ioredis
 * @author BeZhas DevOps Team
 * @version 1.0.0
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

// Importar módulos del sistema de chat
const { setupSocketHandlers, getChatSystemStats, broadcastSystemMessage } = require('./socketHandlers');
const { getUserStats, resetUserCounter, GATEKEEPER_CONFIG } = require('./chatGatekeeper');
const ConnectionRateLimiter = require('./connectionRateLimiter');

// ============================================================================
// CONFIGURACIÓN DEL SERVIDOR
// ============================================================================

const SERVER_CONFIG = {
    PORT: parseInt(process.env.CHAT_SERVER_PORT) || 3002,
    CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: parseInt(process.env.REDIS_PORT) || 6379,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
    REDIS_DB: parseInt(process.env.REDIS_DB) || 0,
    ENABLE_REDIS_ADAPTER: process.env.ENABLE_REDIS_ADAPTER !== 'false', // true por defecto
    MAX_CONNECTIONS: parseInt(process.env.MAX_CONNECTIONS) || 10000,
    PING_TIMEOUT: parseInt(process.env.SOCKET_PING_TIMEOUT) || 60000,
    PING_INTERVAL: parseInt(process.env.SOCKET_PING_INTERVAL) || 25000,
    // ✅ NEW: Rate limiting para conexiones
    CONNECTION_RATE_LIMIT: parseInt(process.env.CONNECTION_RATE_LIMIT) || 10, // conexiones por minuto por IP
    CONNECTION_RATE_WINDOW: parseInt(process.env.CONNECTION_RATE_WINDOW) || 60000, // 1 minuto
};

logger.info({ config: SERVER_CONFIG }, 'Chat server configuration loaded');

// ============================================================================
// INICIALIZACIÓN DE EXPRESS
// ============================================================================

const app = express();
const server = http.createServer(app);

// Middleware de seguridad
app.use(helmet({
    contentSecurityPolicy: false, // Permitir WebSocket
    crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
    origin: SERVER_CONFIG.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting para API REST
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // 100 requests por IP
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', apiLimiter);

// ============================================================================
// INICIALIZACIÓN DE SOCKET.IO
// ============================================================================

const io = new Server(server, {
    cors: {
        origin: SERVER_CONFIG.CORS_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true
    },
    maxHttpBufferSize: 1e6, // 1MB max message size
    pingTimeout: SERVER_CONFIG.PING_TIMEOUT,
    pingInterval: SERVER_CONFIG.PING_INTERVAL,
    transports: ['websocket', 'polling'],
    allowEIO3: true, // Compatibilidad con clientes antiguos
});

logger.info('Socket.IO server initialized');

// ✅ Aplicar rate limiter de conexiones
const connectionRateLimiter = new ConnectionRateLimiter({
    maxConnections: SERVER_CONFIG.CONNECTION_RATE_LIMIT,
    windowMs: SERVER_CONFIG.CONNECTION_RATE_WINDOW,
    enabled: process.env.NODE_ENV === 'production' || process.env.ENABLE_CONNECTION_RATE_LIMIT === 'true'
});

io.use(connectionRateLimiter.middleware());
logger.info({
    maxConnections: SERVER_CONFIG.CONNECTION_RATE_LIMIT,
    windowMs: SERVER_CONFIG.CONNECTION_RATE_WINDOW
}, 'Connection rate limiter enabled');

// ============================================================================
// CONFIGURACIÓN DE REDIS ADAPTER (ESCALADO HORIZONTAL)
// ============================================================================

if (SERVER_CONFIG.ENABLE_REDIS_ADAPTER) {
    try {
        // Crear clientes Redis para Pub/Sub
        const pubClient = new Redis({
            host: SERVER_CONFIG.REDIS_HOST,
            port: SERVER_CONFIG.REDIS_PORT,
            password: SERVER_CONFIG.REDIS_PASSWORD || undefined,
            db: SERVER_CONFIG.REDIS_DB,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                logger.warn({ attempt: times, delay }, 'Retrying Redis connection');
                return delay;
            }
        });

        const subClient = pubClient.duplicate();

        // Configurar adapter de Redis
        io.adapter(createAdapter(pubClient, subClient));

        pubClient.on('connect', () => {
            logger.info('Redis Pub client connected successfully');
        });

        subClient.on('connect', () => {
            logger.info('Redis Sub client connected successfully');
        });

        pubClient.on('error', (err) => {
            logger.error({ error: err.message }, 'Redis Pub client error');
        });

        subClient.on('error', (err) => {
            logger.error({ error: err.message }, 'Redis Sub client error');
        });

        logger.info({
            host: SERVER_CONFIG.REDIS_HOST,
            port: SERVER_CONFIG.REDIS_PORT,
            db: SERVER_CONFIG.REDIS_DB
        }, 'Redis Adapter configured - Horizontal scaling enabled');

    } catch (error) {
        logger.error({ error: error.message }, 'Failed to configure Redis Adapter - Running in single-instance mode');
    }
} else {
    logger.warn('Redis Adapter disabled - Running in single-instance mode');
}

// ============================================================================
// CONFIGURAR SOCKET.IO EVENT HANDLERS
// ============================================================================

setupSocketHandlers(io);

// ============================================================================
// API REST ENDPOINTS
// ============================================================================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'bezhas-chat-server',
        timestamp: Date.now(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

/**
 * Sistema de estadísticas del chat
 */
app.get('/api/chat/stats', (req, res) => {
    try {
        const stats = getChatSystemStats(io);
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error({ error: error.message }, 'Error fetching chat stats');
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stats'
        });
    }
});

/**
 * Obtener estadísticas de crédito de un usuario
 * 
 * GET /api/credits/stats/:userId
 */
app.get('/api/credits/stats/:userId', (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const stats = getUserStats(userId);

        if (!stats) {
            return res.json({
                success: true,
                data: {
                    currentWords: 0,
                    wordsRemaining: GATEKEEPER_CONFIG.WORDS_PER_CREDIT,
                    percentageUsed: 0,
                    message: 'No active session'
                }
            });
        }

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        logger.error({ error: error.message }, 'Error fetching user credit stats');
        res.status(500).json({
            success: false,
            error: 'Failed to fetch credit stats'
        });
    }
});

/**
 * Resetear contador de palabras de un usuario (Admin only)
 * 
 * POST /api/credits/reset/:userId
 * Headers: { "x-admin-token": "..." }
 */
app.post('/api/credits/reset/:userId', (req, res) => {
    try {
        // TODO: PRODUCCIÓN - Verificar token de administrador
        const adminToken = req.headers['x-admin-token'];
        if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        resetUserCounter(userId);

        logger.info({ userId, admin: true }, 'User counter reset by admin');

        res.json({
            success: true,
            message: `Counter reset for user ${userId}`
        });

    } catch (error) {
        logger.error({ error: error.message }, 'Error resetting user counter');
        res.status(500).json({
            success: false,
            error: 'Failed to reset counter'
        });
    }
});

/**
 * Enviar mensaje de sistema a todos los usuarios (Admin only)
 * 
 * POST /api/chat/broadcast
 * Body: { message: string, type: 'info' | 'warning' | 'error' }
 * Headers: { "x-admin-token": "..." }
 */
app.post('/api/chat/broadcast', (req, res) => {
    try {
        // Verificar token de administrador
        const adminToken = req.headers['x-admin-token'];
        if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const { message, type = 'info' } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        broadcastSystemMessage(io, message, type);

        res.json({
            success: true,
            message: 'Broadcast sent successfully'
        });

    } catch (error) {
        logger.error({ error: error.message }, 'Error broadcasting message');
        res.status(500).json({
            success: false,
            error: 'Failed to broadcast message'
        });
    }
});

/**
 * Configuración del Gatekeeper (información pública)
 * 
 * GET /api/credits/config
 */
app.get('/api/credits/config', (req, res) => {
    res.json({
        success: true,
        data: {
            wordsPerCredit: GATEKEEPER_CONFIG.WORDS_PER_CREDIT,
            graceWords: GATEKEEPER_CONFIG.GRACE_WORDS,
            sessionTimeout: GATEKEEPER_CONFIG.SESSION_TIMEOUT
        }
    });
});

/**
 * Endpoint de prueba para simular consulta de saldo
 * (Solo para desarrollo - ELIMINAR EN PRODUCCIÓN)
 * 
 * GET /api/credits/balance/:userId
 */
if (process.env.NODE_ENV !== 'production') {
    app.get('/api/credits/balance/:userId', (req, res) => {
        const { userId } = req.params;
        const simulatedBalance = Math.floor(Math.random() * 100);

        res.json({
            success: true,
            data: {
                userId,
                balance: simulatedBalance,
                currency: 'BEZ-Coin',
                note: 'This is a simulated balance for development'
            }
        });
    });
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Error handler global
app.use((err, req, res, next) => {
    logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');

    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// ============================================================================
// MONITOREO Y MÉTRICAS
// ============================================================================

/**
 * Log de métricas cada 5 minutos
 */
setInterval(() => {
    const stats = getChatSystemStats(io);
    logger.info({ metrics: stats }, 'Chat server metrics');
}, 5 * 60 * 1000);

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
    logger.info('Received shutdown signal, closing server gracefully...');

    // Cerrar Socket.IO
    io.close(() => {
        logger.info('Socket.IO server closed');
    });

    // Cerrar servidor HTTP
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });

    // Forzar cierre después de 10 segundos
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================

server.listen(SERVER_CONFIG.PORT, () => {
    logger.info({
        port: SERVER_CONFIG.PORT,
        env: process.env.NODE_ENV || 'development',
        redisEnabled: SERVER_CONFIG.ENABLE_REDIS_ADAPTER,
        maxConnections: SERVER_CONFIG.MAX_CONNECTIONS,
        wordsPerCredit: GATEKEEPER_CONFIG.WORDS_PER_CREDIT
    }, 'BeZhas Chat Server started successfully');

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           🚀 BEZHAS CHAT SERVER - RUNNING                    ║
║                                                              ║
║  Port:              ${SERVER_CONFIG.PORT.toString().padEnd(41)}║
║  Redis Adapter:     ${(SERVER_CONFIG.ENABLE_REDIS_ADAPTER ? 'Enabled ✅' : 'Disabled ❌').padEnd(41)}║
║  Words per Credit:  ${GATEKEEPER_CONFIG.WORDS_PER_CREDIT.toString().padEnd(41)}║
║                                                              ║
║  API Endpoints:                                              ║
║  • GET  /health                                              ║
║  • GET  /api/chat/stats                                      ║
║  • GET  /api/credits/stats/:userId                           ║
║  • GET  /api/credits/config                                  ║
║  • POST /api/credits/reset/:userId (Admin)                   ║
║  • POST /api/chat/broadcast (Admin)                          ║
║                                                              ║
║  Socket.IO Namespace: /                                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
});

// ============================================================================
// EXPORTS (para testing)
// ============================================================================

module.exports = {
    app,
    server,
    io,
    SERVER_CONFIG
};
