/**
 * ============================================================================
 * BEZHAS - SOCKET.IO EVENT HANDLERS (Chat Real-Time)
 * ============================================================================
 * 
 * PROPÓSITO:
 * Maneja todos los eventos de Socket.IO para el sistema de chat en tiempo real.
 * Integra el Gatekeeper para verificar créditos antes de permitir mensajes.
 * 
 * ARQUITECTURA:
 * - Rooms: Cada chat (privado/grupo/IA) tiene su propia room
 * - Namespaces: /chat para mensajería general
 * - Middleware: Autenticación y rate limiting
 * 
 * ESCALABILIDAD:
 * - Redis Adapter: Permite múltiples instancias de Node.js compartiendo estado
 * - Room isolation: Previene broadcast masivos innecesarios
 * - Message queue: Para procesamiento asíncrono de mensajes
 * 
 * SEGURIDAD:
 * - Autenticación: Verificación de token JWT en handshake
 * - Sanitización: Limpieza de mensajes para prevenir XSS
 * - Rate limiting: Protección contra spam
 * 
 * @module socketHandlers
 * @requires socket.io
 * @requires chatGatekeeper
 * @author BeZhas DevOps Team
 * @version 1.0.0
 */

const { checkAndChargeCredit, getUserStats } = require('./chatGatekeeper');
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });
const validator = require('validator');
const MessageRateLimiter = require('../middleware/messageRateLimiter');

// Inicializar Message Rate Limiter
const messageRateLimiter = new MessageRateLimiter({
    enabled: process.env.ENABLE_MESSAGE_RATE_LIMIT !== 'false',
    baseLimit: parseInt(process.env.MESSAGE_BASE_LIMIT) || 5,
    burstLimit: parseInt(process.env.MESSAGE_BURST_LIMIT) || 15,
    hourlyLimit: parseInt(process.env.MESSAGE_HOURLY_LIMIT) || 500
});

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const SOCKET_CONFIG = {
    MAX_MESSAGE_LENGTH: parseInt(process.env.MAX_MESSAGE_LENGTH) || 5000,
    MAX_ROOM_SIZE: parseInt(process.env.MAX_ROOM_SIZE) || 100,
    MESSAGE_RATE_LIMIT: 5, // Mensajes por segundo
    AI_AGENT_MENTION: '@AgenteIA',
    AI_AGENT_ENDPOINT: process.env.AI_AGENT_ENDPOINT || 'http://localhost:3001/api/ai/chat',
    ENABLE_MESSAGE_HISTORY: process.env.ENABLE_MESSAGE_HISTORY === 'true',
};

// ============================================================================
// ALMACENAMIENTO TEMPORAL DE SESIONES
// ============================================================================
// 
// ⚠️ NOTA DE PRODUCCIÓN:
// Este Map debe ser reemplazado por Redis en producción para:
// 1. Persistir sesiones entre reinicios
// 2. Compartir estado entre múltiples instancias
// 3. Implementar TTL automático
//
const activeSessions = new Map();
const messageRateLimits = new Map();

// Estructura de sesión:
// {
//   userId: string,
//   socketId: string,
//   rooms: Set<string>,
//   connectedAt: timestamp,
//   lastMessage: timestamp,
//   messageCount: number
// }

// ============================================================================
// MIDDLEWARE DE AUTENTICACIÓN
// ============================================================================

/**
 * Middleware para autenticar conexiones Socket.IO
 * Verifica el token JWT en el handshake
 * 
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Function} next - Callback para continuar o rechazar
 */
function authenticationMiddleware(socket, next) {
    try {
        // Extraer token del handshake
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
            logger.warn({ socketId: socket.id }, 'Connection rejected: No token provided');
            return next(new Error('Authentication required'));
        }

        // ✅ PRODUCCIÓN: Verificar token JWT
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'bezhas_super_secret_key_change_in_production';

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.userId = decoded.id || decoded.userId;
            socket.walletAddress = decoded.walletAddress || decoded.address;
            socket.username = decoded.username || `User_${socket.userId.substring(0, 8)}`;

            logger.info({ socketId: socket.id, userId: socket.userId }, 'Socket authenticated successfully');
        } catch (jwtError) {
            logger.warn({ socketId: socket.id, error: jwtError.message }, 'JWT verification failed');
            return next(new Error('Invalid or expired token'));
        }

        // Fallback para desarrollo (solo si JWT_DEV_MODE está habilitado)
        if (process.env.JWT_DEV_MODE === 'true' && !socket.userId) {
            socket.userId = socket.handshake.auth.userId || `dev_user_${Math.random().toString(36).substr(2, 9)}`;
            logger.warn({ socketId: socket.id, userId: socket.userId }, 'Using DEV MODE authentication');
        }

        logger.info({ socketId: socket.id, userId: socket.userId }, 'Socket authenticated');
        next();

    } catch (error) {
        logger.error({ error: error.message, socketId: socket.id }, 'Authentication failed');
        next(new Error('Invalid token'));
    }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Verifica si el usuario puede enviar un mensaje (rate limiting)
 * 
 * @param {string} userId - ID del usuario
 * @returns {boolean} - true si puede enviar, false si excede el límite
 */
function checkRateLimit(userId) {
    const now = Date.now();
    const userLimits = messageRateLimits.get(userId) || { messages: [], lastReset: now };

    // Limpiar mensajes antiguos (ventana de 1 segundo)
    userLimits.messages = userLimits.messages.filter(ts => now - ts < 1000);

    // Verificar límite
    if (userLimits.messages.length >= SOCKET_CONFIG.MESSAGE_RATE_LIMIT) {
        logger.warn({ userId, count: userLimits.messages.length }, 'Rate limit exceeded');
        return false;
    }

    // Registrar nuevo mensaje
    userLimits.messages.push(now);
    messageRateLimits.set(userId, userLimits);

    return true;
}

// ============================================================================
// SANITIZACIÓN DE MENSAJES
// ============================================================================

/**
 * Sanitiza el contenido del mensaje para prevenir XSS
 * 
 * @param {string} message - Mensaje a sanitizar
 * @returns {string} - Mensaje sanitizado
 */
function sanitizeMessage(message) {
    if (!message || typeof message !== 'string') return '';

    // Escape HTML entities
    let sanitized = validator.escape(message);

    // Limitar longitud
    sanitized = sanitized.substring(0, SOCKET_CONFIG.MAX_MESSAGE_LENGTH);

    return sanitized.trim();
}

// ============================================================================
// HANDLERS DE EVENTOS DE SOCKET.IO
// ============================================================================

/**
 * Configura todos los event handlers para un socket
 * 
 * @param {Server} io - Socket.IO server instance
 */
function setupSocketHandlers(io) {

    // Aplicar middleware de autenticación
    io.use(authenticationMiddleware);

    // ========================================================================
    // EVENTO: CONNECTION
    // ========================================================================

    io.on('connection', (socket) => {
        const { userId, id: socketId } = socket;

        logger.info({ socketId, userId }, 'New socket connection established');

        // Crear sesión del usuario
        activeSessions.set(userId, {
            userId,
            socketId,
            rooms: new Set(),
            connectedAt: Date.now(),
            lastMessage: null,
            messageCount: 0
        });

        // Enviar estadísticas de crédito al conectarse
        const stats = getUserStats(userId);
        if (stats) {
            socket.emit('creditStats', stats);
        }

        // ====================================================================
        // EVENTO: JOIN_ROOM (Unirse a un chat/sala)
        // ====================================================================

        socket.on('joinRoom', async (data) => {
            try {
                const { roomId, roomType } = data;

                // Validación
                if (!roomId || !roomType) {
                    return socket.emit('error', { message: 'Invalid room data' });
                }

                // Tipos de room: 'private', 'group', 'admin', 'vendor', 'ai'
                const validRoomTypes = ['private', 'group', 'admin', 'vendor', 'ai'];
                if (!validRoomTypes.includes(roomType)) {
                    return socket.emit('error', { message: 'Invalid room type' });
                }

                // Verificar tamaño de la sala
                const room = io.sockets.adapter.rooms.get(roomId);
                if (room && room.size >= SOCKET_CONFIG.MAX_ROOM_SIZE) {
                    return socket.emit('error', { message: 'Room is full' });
                }

                // Unirse a la room
                socket.join(roomId);

                // Actualizar sesión
                const session = activeSessions.get(userId);
                if (session) {
                    session.rooms.add(roomId);
                }

                logger.info({ userId, roomId, roomType }, 'User joined room');

                // Notificar a otros usuarios de la sala
                socket.to(roomId).emit('userJoined', {
                    userId,
                    roomId,
                    timestamp: Date.now()
                });

                // Confirmar al usuario
                socket.emit('roomJoined', {
                    roomId,
                    roomType,
                    memberCount: room ? room.size : 1
                });

                // TODO: PRODUCCIÓN - Cargar historial de mensajes desde DB
                if (SOCKET_CONFIG.ENABLE_MESSAGE_HISTORY) {
                    // const history = await loadMessageHistory(roomId, 50);
                    // socket.emit('messageHistory', history);
                }

            } catch (error) {
                logger.error({ error: error.message, userId }, 'Error joining room');
                socket.emit('error', { message: 'Failed to join room' });
            }
        });

        // ====================================================================
        // EVENTO: SEND_MESSAGE (Enviar mensaje a la sala)
        // ====================================================================

        socket.on('sendMessage', async (data) => {
            try {
                const { roomId, message, metadata } = data;

                // ================================================================
                // VALIDACIONES INICIALES
                // ================================================================

                if (!roomId || !message) {
                    return socket.emit('error', { message: 'Invalid message data' });
                }

                // Verificar que el usuario está en la room
                if (!socket.rooms.has(roomId)) {
                    return socket.emit('error', { message: 'Not in room' });
                }

                // Advanced Rate Limiting
                const modelName = metadata?.modelName || 'default';
                const creditsEstimate = Math.ceil(sanitizedMessage.length / 1000);

                const rateLimitCheck = await messageRateLimiter.canSendMessage(
                    userId,
                    modelName,
                    creditsEstimate
                );

                if (!rateLimitCheck.allowed) {
                    return socket.emit('error', {
                        message: rateLimitCheck.message,
                        type: 'rate_limit',
                        reason: rateLimitCheck.reason,
                        retryAfter: rateLimitCheck.retryAfter
                    });
                }

                // Sanitizar mensaje
                const sanitizedMessage = sanitizeMessage(message);
                if (!sanitizedMessage) {
                    return socket.emit('error', { message: 'Empty message' });
                }

                // ================================================================
                // INTEGRACIÓN CON GATEKEEPER (VERIFICACIÓN DE CRÉDITO)
                // ================================================================

                logger.debug({ userId, roomId, messageLength: sanitizedMessage.length }, 'Processing message through Gatekeeper');

                const creditCheck = await checkAndChargeCredit(userId, sanitizedMessage);

                if (!creditCheck.allowed) {
                    // ❌ CRÉDITO INSUFICIENTE - BLOQUEAR MENSAJE
                    logger.warn({ userId, reason: creditCheck.reason }, 'Message blocked by Gatekeeper');

                    return socket.emit('creditError', {
                        message: creditCheck.message || '⚠️ Crédito insuficiente. Recarga BEZ-Coin para continuar chateando.',
                        wordsUsed: creditCheck.wordsUsed,
                        creditsNeeded: creditCheck.creditsNeeded,
                        rechargeUrl: '/dashboard/credits'
                    });
                }

                // ✅ CRÉDITO OK - PERMITIR MENSAJE
                logger.info({
                    userId,
                    roomId,
                    creditReason: creditCheck.reason,
                    charged: creditCheck.creditsCharged || 0
                }, 'Message allowed by Gatekeeper');

                // ================================================================
                // PREPARAR DATOS DEL MENSAJE
                // ================================================================

                const messageData = {
                    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    userId,
                    roomId,
                    content: sanitizedMessage,
                    timestamp: Date.now(),
                    metadata: metadata || {},
                    creditInfo: {
                        charged: creditCheck.creditsCharged || 0,
                        remainingWords: creditCheck.wordsRemaining
                    }
                };

                // ================================================================
                // DETECCIÓN DE MENCIÓN AL AGENTE IA
                // ================================================================

                if (sanitizedMessage.includes(SOCKET_CONFIG.AI_AGENT_MENTION)) {
                    logger.info({ userId, roomId }, 'AI Agent mentioned in message');

                    // LÓGICA DE INTEGRACIÓN ACTIVADA
                    const aiPrompt = sanitizedMessage.replace(SOCKET_CONFIG.AI_AGENT_MENTION, '').trim();

                    // Ejecutar asíncronamente para no bloquear el hilo principal
                    (async () => {
                        try {
                            logger.debug({ endpoint: SOCKET_CONFIG.AI_AGENT_ENDPOINT }, 'Calling AI Service');

                            const aiResponse = await fetch(SOCKET_CONFIG.AI_AGENT_ENDPOINT, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    userId,
                                    roomId,
                                    prompt: aiPrompt,
                                    context: metadata?.context || {}
                                })
                            });

                            if (!aiResponse.ok) {
                                throw new Error(`AI Service responded with status: ${aiResponse.status}`);
                            }

                            const aiData = await aiResponse.json();

                            // Emitir respuesta del IA a la room después de un delay simulado para naturalidad
                            setTimeout(() => {
                                io.to(roomId).emit('newMessage', {
                                    id: `ai_${Date.now()}`,
                                    userId: 'ai_agent',
                                    roomId,
                                    content: aiData.response || aiData.message || "Procesado por BeZhas AI.",
                                    timestamp: Date.now(),
                                    metadata: { type: 'ai_response', model: aiData.model || 'unknown' },
                                    isAI: true
                                });
                            }, 1000);

                        } catch (aiError) {
                            logger.error({ error: aiError.message, userId }, 'AI Agent error');

                            // Fallback en caso de error (para que el usuario vea algo)
                            socket.emit('aiError', {
                                message: 'El Agente IA no está disponible en este momento. Intenta más tarde.'
                            });
                        }
                    })();

                    // Marcar mensaje como que mencionó a la IA
                    messageData.metadata.aiMentioned = true;
                }

                // ================================================================
                // EMITIR MENSAJE A LA ROOM
                // ================================================================

                io.to(roomId).emit('newMessage', messageData);

                // Actualizar sesión
                const session = activeSessions.get(userId);
                if (session) {
                    session.lastMessage = Date.now();
                    session.messageCount++;
                }

                // ================================================================
                // ENVIAR ADVERTENCIA SI ESTÁ CERCA DEL LÍMITE
                // ================================================================

                if (creditCheck.warning) {
                    socket.emit('creditWarning', {
                        message: creditCheck.warning,
                        wordsRemaining: creditCheck.wordsRemaining
                    });
                }

                // TODO: PRODUCCIÓN - Guardar mensaje en base de datos
                // await saveMessageToDatabase(messageData);

                logger.debug({ messageId: messageData.id, userId, roomId }, 'Message sent successfully');

            } catch (error) {
                logger.error({ error: error.message, userId }, 'Error sending message');
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // ====================================================================
        // EVENTO: LEAVE_ROOM (Salir de una sala)
        // ====================================================================

        socket.on('leaveRoom', (data) => {
            try {
                const { roomId } = data;

                if (!roomId) {
                    return socket.emit('error', { message: 'Invalid room ID' });
                }

                socket.leave(roomId);

                // Actualizar sesión
                const session = activeSessions.get(userId);
                if (session) {
                    session.rooms.delete(roomId);
                }

                // Notificar a la sala
                socket.to(roomId).emit('userLeft', {
                    userId,
                    roomId,
                    timestamp: Date.now()
                });

                logger.info({ userId, roomId }, 'User left room');

            } catch (error) {
                logger.error({ error: error.message, userId }, 'Error leaving room');
            }
        });

        // ====================================================================
        // EVENTO: TYPING (Usuario está escribiendo)
        // ====================================================================

        socket.on('typing', (data) => {
            const { roomId, isTyping } = data;

            if (roomId && socket.rooms.has(roomId)) {
                socket.to(roomId).emit('userTyping', {
                    userId,
                    roomId,
                    isTyping: !!isTyping,
                    timestamp: Date.now()
                });
            }
        });

        // ====================================================================
        // EVENTO: GET_CREDIT_STATS (Obtener estadísticas de crédito)
        // ====================================================================

        socket.on('getCreditStats', () => {
            const stats = getUserStats(userId);
            socket.emit('creditStats', stats || {
                currentWords: 0,
                wordsRemaining: 1000,
                percentageUsed: 0
            });
        });

        // ====================================================================
        // EVENTO: DISCONNECT (Usuario desconectado)
        // ====================================================================

        socket.on('disconnect', (reason) => {
            logger.info({ userId, socketId, reason }, 'Socket disconnected');

            // Limpiar sesión
            const session = activeSessions.get(userId);
            if (session) {
                // Notificar a todas las rooms que el usuario estaba
                session.rooms.forEach(roomId => {
                    socket.to(roomId).emit('userLeft', {
                        userId,
                        roomId,
                        timestamp: Date.now(),
                        reason: 'disconnect'
                    });
                });

                activeSessions.delete(userId);
            }
        });

        // ====================================================================
        // EVENTO: ERROR (Manejo de errores del socket)
        // ====================================================================

        socket.on('error', (error) => {
            logger.error({ error: error.message, userId, socketId }, 'Socket error');
        });
    });

    logger.info('Socket.IO handlers configured successfully');
}

// ============================================================================
// FUNCIONES DE ADMINISTRACIÓN
// ============================================================================

/**
 * Obtiene estadísticas globales del sistema de chat
 * 
 * @param {Server} io - Socket.IO server instance
 * @returns {object} - Estadísticas del sistema
 */
function getChatSystemStats(io) {
    return {
        connectedSockets: io.engine.clientsCount,
        activeSessions: activeSessions.size,
        totalRooms: io.sockets.adapter.rooms.size,
        timestamp: Date.now()
    };
}

/**
 * Envía un mensaje de broadcast a todos los usuarios conectados
 * (Uso administrativo)
 * 
 * @param {Server} io - Socket.IO server instance
 * @param {string} message - Mensaje a enviar
 * @param {string} type - Tipo de mensaje (info, warning, error)
 */
function broadcastSystemMessage(io, message, type = 'info') {
    io.emit('systemMessage', {
        message,
        type,
        timestamp: Date.now()
    });

    logger.info({ message, type }, 'System message broadcast');
}

// ============================================================================
// LIMPIEZA DE RECURSOS
// ============================================================================

/**
 * Limpia sesiones inactivas y rate limits antiguos
 * Debe ejecutarse periódicamente
 */
function cleanupResources() {
    const now = Date.now();
    let cleanedSessions = 0;
    let cleanedLimits = 0;

    // Limpiar sesiones inactivas (más de 1 hora sin actividad)
    for (const [userId, session] of activeSessions.entries()) {
        const inactive = now - (session.lastMessage || session.connectedAt) > 60 * 60 * 1000;
        if (inactive) {
            activeSessions.delete(userId);
            cleanedSessions++;
        }
    }

    // Limpiar rate limits antiguos
    for (const [userId, limits] of messageRateLimits.entries()) {
        if (now - limits.lastReset > 5 * 60 * 1000) { // 5 minutos
            messageRateLimits.delete(userId);
            cleanedLimits++;
        }
    }

    if (cleanedSessions > 0 || cleanedLimits > 0) {
        logger.info({ cleanedSessions, cleanedLimits }, 'Resources cleaned up');
    }
}

// Ejecutar limpieza cada 15 minutos
setInterval(cleanupResources, 15 * 60 * 1000);

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    setupSocketHandlers,
    getChatSystemStats,
    broadcastSystemMessage,
    authenticationMiddleware,
    cleanupResources,
    SOCKET_CONFIG
};
