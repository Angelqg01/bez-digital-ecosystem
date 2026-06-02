/**
 * ============================================================================
 * CREDIT SERVICE - BEZ-COIN INTEGRATION
 * ============================================================================
 * 
 * PROPÓSITO:
 * Servicio centralizado para gestionar el sistema de créditos BEZ-Coin.
 * Conecta con el smart contract para operaciones ON-CHAIN y con la base de
 * datos para operaciones OFF-CHAIN (optimización de rendimiento).
 * 
 * ARQUITECTURA:
 * - OFF-CHAIN: Consulta rápida de saldos desde base de datos (cache)
 * - ON-CHAIN: Transacciones críticas en blockchain (compras, transferencias)
 * - SYNC: Proceso periódico de sincronización DB ↔ Blockchain
 * 
 * MODELO DE CRÉDITOS:
 * 1 Credit = 1 BEZ-Coin
 * 1 Credit = 1000 palabras de chat
 * 
 * FLUJO DE COMPRA:
 * Usuario → Compra BEZ-Coin (blockchain) → Actualiza DB → Chat habilitado
 * 
 * @module creditService
 * @requires ethers
 * @requires ioredis
 * @author BeZhas DevOps Team
 * @version 1.0.0
 */

const { ethers } = require('ethers');
const axios = require('axios');
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CREDIT_CONFIG = {
    // Blockchain
    PROVIDER_URL: process.env.BLOCKCHAIN_PROVIDER_URL || 'https://polygon-rpc.com',
    CONTRACT_ADDRESS: process.env.BEZ_COIN_CONTRACT_ADDRESS || '',
    CONTRACT_ABI: [
        // ABI mínimo para consultar balance
        'function balanceOf(address owner) view returns (uint256)',
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)'
    ],

    // Redis cache
    CACHE_TTL: parseInt(process.env.CREDIT_CACHE_TTL) || 60, // 60 segundos
    CACHE_PREFIX: 'credit:balance:',

    // Conversión
    WORDS_PER_CREDIT: 1000,
    DECIMALS: 18, // BEZ-Coin tiene 18 decimales (estándar ERC20)

    // API interna (si existe un microservicio de créditos)
    CREDIT_API_URL: process.env.CREDIT_API_URL || 'http://localhost:3003/api/credits',
    CREDIT_API_TIMEOUT: parseInt(process.env.CREDIT_API_TIMEOUT) || 5000,
};

logger.info({ config: CREDIT_CONFIG }, 'Credit Service initialized');

// ============================================================================
// CONEXIÓN A BLOCKCHAIN
// ============================================================================

let provider = null;
let bezCoinContract = null;

/**
 * Inicializar conexión con blockchain
 */
function initBlockchain() {
    try {
        if (!CREDIT_CONFIG.CONTRACT_ADDRESS) {
            logger.warn('BEZ-Coin contract address not configured - blockchain features disabled');
            return false;
        }

        provider = new ethers.JsonRpcProvider(CREDIT_CONFIG.PROVIDER_URL);
        bezCoinContract = new ethers.Contract(
            CREDIT_CONFIG.CONTRACT_ADDRESS,
            CREDIT_CONFIG.CONTRACT_ABI,
            provider
        );

        logger.info({
            contract: CREDIT_CONFIG.CONTRACT_ADDRESS,
            provider: CREDIT_CONFIG.PROVIDER_URL
        }, 'Blockchain connection established');

        return true;
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to initialize blockchain connection');
        return false;
    }
}

// Intentar conexión al iniciar
initBlockchain();

// ============================================================================
// REDIS CACHE (OPCIONAL)
// ============================================================================

let redisClient = null;

try {
    const Redis = require('ioredis');

    // Use REDIS_URL if available (Upstash, cloud Redis)
    if (process.env.REDIS_URL) {
        const redisUrl = process.env.REDIS_URL;
        const connectionOptions = {
            retryStrategy: (times) => Math.min(times * 50, 2000),
            family: 0
        };

        // Enable TLS for rediss:// protocol
        if (redisUrl.startsWith('rediss://')) {
            connectionOptions.tls = { rejectUnauthorized: false };
        }

        redisClient = new Redis(redisUrl, connectionOptions);
    } else {
        redisClient = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DB) || 0,
            retryStrategy: (times) => Math.min(times * 50, 2000)
        });
    }

    redisClient.on('connect', () => {
        logger.info('Credit Service - Redis cache connected');
    });

    redisClient.on('error', (err) => {
        logger.error({ error: err.message }, 'Credit Service - Redis error');
    });

} catch (error) {
    logger.warn('Redis not available for credit caching - using direct blockchain queries');
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Obtener el saldo de créditos de un usuario
 * 
 * ESTRATEGIA:
 * 1. Intentar obtener desde cache Redis (rápido)
 * 2. Si no hay cache, consultar API de créditos (medio)
 * 3. Si no hay API, consultar blockchain directamente (lento)
 * 
 * @param {string} userId - ID del usuario o wallet address
 * @returns {Promise<Object>} { success, balance, source, timestamp }
 */
async function getCreditBalance(userId) {
    try {
        // Validar entrada
        if (!userId) {
            return {
                success: false,
                error: 'User ID is required',
                balance: 0
            };
        }

        // 1. Intentar cache de Redis
        if (redisClient) {
            const cacheKey = `${CREDIT_CONFIG.CACHE_PREFIX}${userId}`;
            const cached = await redisClient.get(cacheKey);

            if (cached) {
                const data = JSON.parse(cached);
                logger.debug({ userId, source: 'cache' }, 'Credit balance from cache');

                return {
                    success: true,
                    balance: data.balance,
                    source: 'cache',
                    timestamp: data.timestamp,
                    cached: true
                };
            }
        }

        // 2. Intentar API de créditos (microservicio)
        try {
            const response = await axios.get(
                `${CREDIT_CONFIG.CREDIT_API_URL}/balance/${userId}`,
                { timeout: CREDIT_CONFIG.CREDIT_API_TIMEOUT }
            );

            if (response.data && response.data.success) {
                const balance = parseFloat(response.data.data.balance) || 0;

                // Guardar en cache
                if (redisClient) {
                    const cacheKey = `${CREDIT_CONFIG.CACHE_PREFIX}${userId}`;
                    await redisClient.setex(
                        cacheKey,
                        CREDIT_CONFIG.CACHE_TTL,
                        JSON.stringify({ balance, timestamp: Date.now() })
                    );
                }

                logger.debug({ userId, balance, source: 'api' }, 'Credit balance from API');

                return {
                    success: true,
                    balance,
                    source: 'api',
                    timestamp: Date.now()
                };
            }
        } catch (apiError) {
            logger.warn({ error: apiError.message }, 'Credit API unavailable, falling back to blockchain');
        }

        // 3. Fallback: Consultar blockchain directamente
        if (bezCoinContract && ethers.isAddress(userId)) {
            const balanceWei = await bezCoinContract.balanceOf(userId);
            const balance = parseFloat(ethers.formatUnits(balanceWei, CREDIT_CONFIG.DECIMALS));

            // Guardar en cache
            if (redisClient) {
                const cacheKey = `${CREDIT_CONFIG.CACHE_PREFIX}${userId}`;
                await redisClient.setex(
                    cacheKey,
                    CREDIT_CONFIG.CACHE_TTL,
                    JSON.stringify({ balance, timestamp: Date.now() })
                );
            }

            logger.debug({ userId, balance, source: 'blockchain' }, 'Credit balance from blockchain');

            return {
                success: true,
                balance,
                source: 'blockchain',
                timestamp: Date.now()
            };
        }

        // Si llegamos aquí, no hay forma de consultar el saldo
        logger.error({ userId }, 'No credit source available');

        return {
            success: false,
            error: 'Unable to fetch credit balance',
            balance: 0
        };

    } catch (error) {
        logger.error({ error: error.message, userId }, 'Error fetching credit balance');

        return {
            success: false,
            error: error.message,
            balance: 0
        };
    }
}

/**
 * Cobrar créditos a un usuario
 * 
 * ESTRATEGIA:
 * - Envía solicitud al Credit API para registrar el cobro
 * - Invalida cache de Redis
 * - Registra en audit log
 * 
 * NOTA: Este método NO realiza transacciones blockchain directamente.
 * El cobro se registra en la base de datos y se sincroniza periódicamente
 * con el blockchain mediante un proceso batch (optimización de gas fees).
 * 
 * @param {string} userId - ID del usuario
 * @param {number} amount - Cantidad de créditos a cobrar
 * @param {string} reason - Razón del cobro (ej: 'chat_words')
 * @returns {Promise<Object>} { success, newBalance, transactionId }
 */
async function chargeCredits(userId, amount, reason = 'chat_words') {
    try {
        // Validar entrada
        if (!userId || amount <= 0) {
            return {
                success: false,
                error: 'Invalid parameters'
            };
        }

        // Llamar a Credit API
        const response = await axios.post(
            `${CREDIT_CONFIG.CREDIT_API_URL}/charge`,
            {
                userId,
                amount,
                reason,
                timestamp: Date.now()
            },
            { timeout: CREDIT_CONFIG.CREDIT_API_TIMEOUT }
        );

        if (response.data && response.data.success) {
            // Invalidar cache
            if (redisClient) {
                const cacheKey = `${CREDIT_CONFIG.CACHE_PREFIX}${userId}`;
                await redisClient.del(cacheKey);
            }

            logger.info({
                userId,
                amount,
                reason,
                transactionId: response.data.data.transactionId
            }, 'Credits charged successfully');

            return {
                success: true,
                newBalance: response.data.data.newBalance,
                transactionId: response.data.data.transactionId,
                timestamp: Date.now()
            };
        }

        return {
            success: false,
            error: 'Failed to charge credits'
        };

    } catch (error) {
        logger.error({ error: error.message, userId, amount }, 'Error charging credits');

        // TODO: PRODUCCIÓN - Implementar queue de retry para cobros fallidos
        // Ejemplo: await queueService.add('failed_charges', { userId, amount, reason });

        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Agregar créditos a un usuario (para admin o recargas)
 * 
 * @param {string} userId - ID del usuario
 * @param {number} amount - Cantidad de créditos a agregar
 * @param {string} reason - Razón (ej: 'purchase', 'promotion', 'refund')
 * @returns {Promise<Object>} { success, newBalance, transactionId }
 */
async function addCredits(userId, amount, reason = 'purchase') {
    try {
        if (!userId || amount <= 0) {
            return {
                success: false,
                error: 'Invalid parameters'
            };
        }

        const response = await axios.post(
            `${CREDIT_CONFIG.CREDIT_API_URL}/add`,
            {
                userId,
                amount,
                reason,
                timestamp: Date.now()
            },
            { timeout: CREDIT_CONFIG.CREDIT_API_TIMEOUT }
        );

        if (response.data && response.data.success) {
            // Invalidar cache
            if (redisClient) {
                const cacheKey = `${CREDIT_CONFIG.CACHE_PREFIX}${userId}`;
                await redisClient.del(cacheKey);
            }

            logger.info({
                userId,
                amount,
                reason,
                transactionId: response.data.data.transactionId
            }, 'Credits added successfully');

            return {
                success: true,
                newBalance: response.data.data.newBalance,
                transactionId: response.data.data.transactionId
            };
        }

        return {
            success: false,
            error: 'Failed to add credits'
        };

    } catch (error) {
        logger.error({ error: error.message, userId, amount }, 'Error adding credits');

        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Verificar si un usuario tiene créditos suficientes
 * 
 * @param {string} userId - ID del usuario
 * @param {number} requiredCredits - Cantidad necesaria
 * @returns {Promise<Object>} { hasEnough, currentBalance, required }
 */
async function hasEnoughCredits(userId, requiredCredits) {
    try {
        const result = await getCreditBalance(userId);

        if (!result.success) {
            return {
                hasEnough: false,
                currentBalance: 0,
                required: requiredCredits,
                error: result.error
            };
        }

        return {
            hasEnough: result.balance >= requiredCredits,
            currentBalance: result.balance,
            required: requiredCredits,
            deficit: Math.max(0, requiredCredits - result.balance)
        };

    } catch (error) {
        logger.error({ error: error.message, userId }, 'Error checking credit sufficiency');

        return {
            hasEnough: false,
            currentBalance: 0,
            required: requiredCredits,
            error: error.message
        };
    }
}

/**
 * Convertir palabras a créditos necesarios
 * 
 * @param {number} wordCount - Cantidad de palabras
 * @returns {number} Créditos necesarios (redondeado hacia arriba)
 */
function wordsToCredits(wordCount) {
    return Math.ceil(wordCount / CREDIT_CONFIG.WORDS_PER_CREDIT);
}

/**
 * Convertir créditos a palabras disponibles
 * 
 * @param {number} credits - Cantidad de créditos
 * @returns {number} Palabras disponibles
 */
function creditsToWords(credits) {
    return Math.floor(credits * CREDIT_CONFIG.WORDS_PER_CREDIT);
}

/**
 * Invalidar cache de un usuario
 * 
 * @param {string} userId - ID del usuario
 * @returns {Promise<boolean>}
 */
async function invalidateCache(userId) {
    try {
        if (!redisClient) return false;

        const cacheKey = `${CREDIT_CONFIG.CACHE_PREFIX}${userId}`;
        await redisClient.del(cacheKey);

        logger.debug({ userId }, 'Credit cache invalidated');
        return true;
    } catch (error) {
        logger.error({ error: error.message, userId }, 'Error invalidating cache');
        return false;
    }
}

/**
 * Obtener historial de transacciones de un usuario
 * 
 * @param {string} userId - ID del usuario
 * @param {number} limit - Límite de resultados (default: 50)
 * @returns {Promise<Object>} { success, transactions }
 */
async function getTransactionHistory(userId, limit = 50) {
    try {
        const response = await axios.get(
            `${CREDIT_CONFIG.CREDIT_API_URL}/history/${userId}`,
            {
                params: { limit },
                timeout: CREDIT_CONFIG.CREDIT_API_TIMEOUT
            }
        );

        if (response.data && response.data.success) {
            return {
                success: true,
                transactions: response.data.data.transactions
            };
        }

        return {
            success: false,
            error: 'Failed to fetch transaction history',
            transactions: []
        };

    } catch (error) {
        logger.error({ error: error.message, userId }, 'Error fetching transaction history');

        return {
            success: false,
            error: error.message,
            transactions: []
        };
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Core functions
    getCreditBalance,
    chargeCredits,
    addCredits,
    hasEnoughCredits,

    // Utilities
    wordsToCredits,
    creditsToWords,
    invalidateCache,
    getTransactionHistory,

    // Configuration
    CREDIT_CONFIG
};
