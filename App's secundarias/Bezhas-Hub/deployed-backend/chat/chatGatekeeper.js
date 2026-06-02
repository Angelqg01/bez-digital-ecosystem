/**
 * ============================================================================
 * BEZHAS - CHAT GATEKEEPER (Credit Management System)
 * ============================================================================
 * 
 * PROPÓSITO:
 * Este módulo es el corazón del sistema de monetización por palabras de BeZhas.
 * Gestiona el conteo de palabras, verificación de créditos y cobro automático
 * antes de permitir que un mensaje sea enviado.
 * 
 * LÓGICA DE NEGOCIO:
 * - 1 Crédito = 1000 palabras de chat
 * - El conteo es acumulativo por usuario
 * - El cobro es OFF-CHAIN para garantizar instantaneidad
 * - Si el usuario no tiene crédito suficiente, el mensaje se bloquea
 * 
 * ESCALABILIDAD:
 * - En producción, los contadores deben migrarse a Redis (TTL automático)
 * - El Credit Service debe ser un microservicio independiente
 * - Considerar implementar un sistema de prepago/postpago híbrido
 * 
 * INTEGRACIÓN:
 * - Conecta con Credit Service (BEZ-Coin balance)
 * - Usado por Socket.IO handlers antes de emitir mensajes
 * - Genera eventos de auditoría para análisis de negocio
 * 
 * @module chatGatekeeper
 * @author BeZhas DevOps Team
 * @version 1.0.0
 */

const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// CONFIGURACIÓN DEL GATEKEEPER
// ============================================================================

const GATEKEEPER_CONFIG = {
    WORDS_PER_CREDIT: parseInt(process.env.WORDS_PER_CREDIT) || 1000,
    CREDIT_CHECK_THRESHOLD: 0.95, // Verificar crédito al 95% del límite
    GRACE_WORDS: 50, // Palabras de gracia antes del bloqueo duro
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 horas
    CREDIT_SERVICE_URL: process.env.CREDIT_SERVICE_URL || 'http://localhost:3001/api/credits',
    ENABLE_AUDIT_LOG: process.env.ENABLE_CREDIT_AUDIT === 'true',
};

// ============================================================================
// ALMACENAMIENTO TEMPORAL DE CONTADORES
// ============================================================================
// 
// ⚠️ NOTA DE PRODUCCIÓN:
// Este objeto global debe ser reemplazado por Redis en producción para:
// 1. Persistencia entre reinicios del servidor
// 2. Compartir estado entre múltiples instancias (horizontal scaling)
// 3. TTL automático para limpiar sesiones inactivas
// 4. Backup y recuperación ante fallos
//
// Estructura de migración a Redis:
// - Key: `chat:wordcount:${userId}`
// - Value: JSON.stringify({ count, lastCharged, sessionStart, totalCharged })
// - TTL: GATEKEEPER_CONFIG.SESSION_TIMEOUT
//
const wordCounters = new Map();

// Estructura de cada contador:
// {
//   count: number,              // Palabras acumuladas desde último cobro
//   lastCharged: timestamp,     // Última vez que se cobró
//   sessionStart: timestamp,    // Inicio de la sesión
//   totalCharged: number,       // Total de créditos cobrados en la sesión
//   lastMessage: string,        // Último mensaje enviado (para detección de spam)
//   warningsSent: number        // Veces que se envió advertencia de crédito bajo
// }

// ============================================================================
// SIMULACIÓN DEL CREDIT SERVICE (BEZ-Coin Balance)
// ============================================================================

/**
 * Obtiene el saldo de créditos del usuario desde el Credit Service
 * 
 * 🔗 INTEGRACIÓN: En producción, esto debe hacer una llamada HTTP al
 * microservicio de créditos que consulta el balance de BEZ-Coin del usuario.
 * 
 * @param {string} userId - ID único del usuario (wallet address o user ID)
 * @returns {Promise<number>} - Saldo de créditos disponibles
 * @throws {Error} - Si el Credit Service no responde
 */
async function fetchUserCreditBalance(userId) {
    try {
        // TODO: PRODUCCIÓN - Implementar llamada HTTP al Credit Service
        // const response = await fetch(`${GATEKEEPER_CONFIG.CREDIT_SERVICE_URL}/balance/${userId}`);
        // const data = await response.json();
        // return data.balance;

        // SIMULACIÓN: Retorna un saldo aleatorio entre 5-50 créditos
        // En producción, esto vendría de la blockchain o base de datos
        const simulatedBalance = Math.floor(Math.random() * 46) + 5;

        logger.debug({ userId, balance: simulatedBalance }, 'Fetched user credit balance');
        return simulatedBalance;

    } catch (error) {
        logger.error({ error: error.message, userId }, 'Error fetching credit balance');
        throw new Error('Credit Service unavailable');
    }
}

/**
 * Cobra créditos al usuario
 * 
 * 🔗 INTEGRACIÓN: En producción, esto debe:
 * 1. Registrar la transacción en base de datos
 * 2. Actualizar el balance del usuario
 * 3. Emitir evento de auditoría
 * 4. Notificar al usuario vía WebSocket si el saldo es bajo
 * 
 * @param {string} userId - ID del usuario
 * @param {number} amount - Cantidad de créditos a cobrar
 * @returns {Promise<boolean>} - true si el cobro fue exitoso
 */
async function chargeCredit(userId, amount) {
    try {
        // TODO: PRODUCCIÓN - Implementar llamada HTTP al Credit Service
        // const response = await fetch(`${GATEKEEPER_CONFIG.CREDIT_SERVICE_URL}/charge`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ userId, amount, reason: 'chat_usage' })
        // });
        // return response.ok;

        // SIMULACIÓN: Siempre retorna éxito
        logger.info({ userId, amount, reason: 'chat_usage' }, 'Credit charged successfully');

        // Emitir evento de auditoría si está habilitado
        if (GATEKEEPER_CONFIG.ENABLE_AUDIT_LOG) {
            auditLog('credit_charged', {
                userId,
                amount,
                timestamp: Date.now(),
                service: 'chat'
            });
        }

        return true;

    } catch (error) {
        logger.error({ error: error.message, userId, amount }, 'Error charging credit');
        return false;
    }
}

// ============================================================================
// UTILIDADES DE CONTEO DE PALABRAS
// ============================================================================

/**
 * Cuenta las palabras de un mensaje
 * Excluye emojis, URLs y menciones de la cuenta
 * 
 * @param {string} message - Mensaje a contar
 * @returns {number} - Número de palabras
 */
function countWords(message) {
    if (!message || typeof message !== 'string') return 0;

    // Remover URLs
    const withoutUrls = message.replace(/https?:\/\/[^\s]+/g, '');

    // Remover emojis (no contabilizan como palabras)
    const withoutEmojis = withoutUrls.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    // Contar palabras (split por espacios y filtrar vacíos)
    const words = withoutEmojis.trim().split(/\s+/).filter(w => w.length > 0);

    return words.length;
}

/**
 * Inicializa o recupera el contador de un usuario
 * 
 * @param {string} userId - ID del usuario
 * @returns {object} - Objeto contador del usuario
 */
function getOrCreateCounter(userId) {
    if (!wordCounters.has(userId)) {
        wordCounters.set(userId, {
            count: 0,
            lastCharged: Date.now(),
            sessionStart: Date.now(),
            totalCharged: 0,
            lastMessage: '',
            warningsSent: 0
        });
    }
    return wordCounters.get(userId);
}

// ============================================================================
// LÓGICA PRINCIPAL DEL GATEKEEPER
// ============================================================================

/**
 * Verifica y cobra crédito por un mensaje
 * 
 * FLUJO DE NEGOCIO:
 * 1. Contar palabras del mensaje
 * 2. Sumar al contador acumulado del usuario
 * 3. Si supera umbral (1000 palabras):
 *    a. Verificar saldo de créditos
 *    b. Si tiene saldo: cobrar 1 crédito
 *    c. Si no tiene saldo: bloquear mensaje
 *    d. Reiniciar contador con palabras remanentes
 * 4. Retornar true/false para permitir/bloquear el mensaje
 * 
 * @param {string} userId - ID del usuario que envía el mensaje
 * @param {string} message - Contenido del mensaje
 * @returns {Promise<object>} - { allowed: boolean, reason?: string, remainingWords?: number }
 */
async function checkAndChargeCredit(userId, message) {
    try {
        // Validación de entrada
        if (!userId || !message) {
            return { allowed: false, reason: 'Invalid input' };
        }

        // Contar palabras del mensaje
        const messageWords = countWords(message);
        if (messageWords === 0) {
            return { allowed: true, reason: 'Empty message' }; // Permitir mensajes vacíos/emojis
        }

        // Obtener contador del usuario
        const counter = getOrCreateCounter(userId);

        // Sumar palabras al contador acumulado
        const totalWords = counter.count + messageWords;

        logger.debug({
            userId,
            messageWords,
            currentCount: counter.count,
            totalWords
        }, 'Word count updated');

        // ====================================================================
        // VERIFICACIÓN DE CRÉDITO: ¿Supera el umbral de 1000 palabras?
        // ====================================================================

        if (totalWords >= GATEKEEPER_CONFIG.WORDS_PER_CREDIT) {
            logger.info({ userId, totalWords }, 'Credit threshold reached, checking balance...');

            // Consultar saldo del usuario
            const balance = await fetchUserCreditBalance(userId);

            if (balance <= 0) {
                // SIN CRÉDITO: Bloquear mensaje
                logger.warn({ userId, balance, totalWords }, 'Insufficient credit - message blocked');

                return {
                    allowed: false,
                    reason: 'insufficient_credit',
                    message: '⚠️ Crédito insuficiente. Recarga BEZ-Coin para continuar chateando.',
                    wordsUsed: totalWords,
                    creditsNeeded: 1
                };
            }

            // CON CRÉDITO: Cobrar y permitir mensaje
            const chargeSuccess = await chargeCredit(userId, 1);

            if (!chargeSuccess) {
                logger.error({ userId }, 'Failed to charge credit - allowing message as fallback');
                // En caso de error del Credit Service, permitir mensaje (gracia temporal)
                // TODO: PRODUCCIÓN - Implementar lógica de reintentos y compensación
                return { allowed: true, reason: 'service_error_grace' };
            }

            // Cobro exitoso: Reiniciar contador con palabras remanentes
            const remainingWords = totalWords - GATEKEEPER_CONFIG.WORDS_PER_CREDIT;
            counter.count = remainingWords;
            counter.lastCharged = Date.now();
            counter.totalCharged += 1;

            logger.info({
                userId,
                charged: 1,
                remainingWords,
                totalCharged: counter.totalCharged
            }, 'Credit charged successfully');

            return {
                allowed: true,
                reason: 'credit_charged',
                creditsCharged: 1,
                remainingWords,
                newBalance: balance - 1
            };
        }

        // ====================================================================
        // NO SUPERA UMBRAL: Permitir mensaje y actualizar contador
        // ====================================================================

        counter.count = totalWords;
        counter.lastMessage = message;

        // Enviar advertencia si está cerca del límite (95% del umbral)
        const threshold = GATEKEEPER_CONFIG.WORDS_PER_CREDIT * GATEKEEPER_CONFIG.CREDIT_CHECK_THRESHOLD;

        if (totalWords >= threshold && counter.warningsSent === 0) {
            counter.warningsSent = 1;
            logger.info({ userId, totalWords }, 'Near credit threshold - warning should be sent');

            return {
                allowed: true,
                reason: 'near_threshold',
                warning: `⚠️ Te quedan ~${GATEKEEPER_CONFIG.WORDS_PER_CREDIT - totalWords} palabras antes del próximo cobro`,
                wordsRemaining: GATEKEEPER_CONFIG.WORDS_PER_CREDIT - totalWords
            };
        }

        return {
            allowed: true,
            reason: 'within_limit',
            wordsUsed: totalWords,
            wordsRemaining: GATEKEEPER_CONFIG.WORDS_PER_CREDIT - totalWords
        };

    } catch (error) {
        logger.error({ error: error.message, userId }, 'Error in checkAndChargeCredit');

        // En caso de error, permitir mensaje (fail-safe para no interrumpir el servicio)
        // TODO: PRODUCCIÓN - Implementar circuit breaker y fallback más robusto
        return { allowed: true, reason: 'error_fallback' };
    }
}

// ============================================================================
// FUNCIONES DE ADMINISTRACIÓN Y MONITOREO
// ============================================================================

/**
 * Resetea el contador de un usuario (uso administrativo)
 * 
 * @param {string} userId - ID del usuario
 */
function resetUserCounter(userId) {
    if (wordCounters.has(userId)) {
        const counter = wordCounters.get(userId);
        logger.info({
            userId,
            previousCount: counter.count,
            totalCharged: counter.totalCharged
        }, 'User counter reset');

        wordCounters.delete(userId);
    }
}

/**
 * Obtiene estadísticas del contador de un usuario
 * 
 * @param {string} userId - ID del usuario
 * @returns {object|null} - Estadísticas del usuario o null si no existe
 */
function getUserStats(userId) {
    const counter = wordCounters.get(userId);
    if (!counter) return null;

    return {
        currentWords: counter.count,
        wordsRemaining: GATEKEEPER_CONFIG.WORDS_PER_CREDIT - counter.count,
        sessionDuration: Date.now() - counter.sessionStart,
        totalCharged: counter.totalCharged,
        lastActivity: counter.lastCharged,
        percentageUsed: (counter.count / GATEKEEPER_CONFIG.WORDS_PER_CREDIT) * 100
    };
}

/**
 * Limpia contadores inactivos (cron job)
 * Debe ejecutarse periódicamente para liberar memoria
 */
function cleanupInactiveCounters() {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, counter] of wordCounters.entries()) {
        const inactive = now - counter.lastCharged > GATEKEEPER_CONFIG.SESSION_TIMEOUT;
        if (inactive) {
            wordCounters.delete(userId);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        logger.info({ cleaned, total: wordCounters.size }, 'Inactive counters cleaned up');
    }
}

// Ejecutar limpieza cada hora
setInterval(cleanupInactiveCounters, 60 * 60 * 1000);

/**
 * Sistema de auditoría para análisis de negocio
 * 
 * @param {string} event - Tipo de evento
 * @param {object} data - Datos del evento
 */
function auditLog(event, data) {
    // TODO: PRODUCCIÓN - Enviar a sistema de logging centralizado (ELK, Datadog, etc.)
    logger.info({
        audit: true,
        event,
        ...data
    }, 'Credit audit event');
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Función principal
    checkAndChargeCredit,

    // Utilidades
    countWords,

    // Administración
    resetUserCounter,
    getUserStats,
    cleanupInactiveCounters,

    // Configuración (para testing)
    GATEKEEPER_CONFIG,

    // Simulaciones (para desarrollo)
    fetchUserCreditBalance,
    chargeCredit
};
