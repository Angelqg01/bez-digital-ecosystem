const { Queue, Worker } = require('bullmq');
const { ethers } = require('ethers');
const logger = require('../utils/logger');
const ContentValidatorABI = require('../contracts/ContentValidator.json');
const Validation = require('../models/validation.model');

// Import WebSocket server for real-time notifications
let wsServer = null;
try {
    const wsModule = require('../websocket-server');
    wsServer = wsModule.broadcastToUser || null;
} catch (error) {
    logger.warn('WebSocket server not available, notifications disabled');
}

// Feature flag and connection availability checks
const DISABLE_QUEUE = String(process.env.DISABLE_QUEUE_WORKER || 'true').toLowerCase() === 'true';
const QUEUE_ENABLED_ENV = String(process.env.QUEUE_ENABLED || 'false').toLowerCase() === 'true';
const HAS_REDIS = !!(process.env.REDIS_URL || process.env.REDIS_HOST || process.env.REDIS_PORT);
const QUEUE_ENABLED = QUEUE_ENABLED_ENV && !DISABLE_QUEUE && HAS_REDIS;

if (!QUEUE_ENABLED) {
    logger.info('Queue system disabled - validations will be processed synchronously');
}

// Configuración de Redis (solo si está habilitado)
const connection = QUEUE_ENABLED ? {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null
} : null;

// Crear cola de validaciones (condicional)
const validationQueue = QUEUE_ENABLED ? new Queue('content-validation', { connection }) : null;

// Configuración del contrato
const CONTENT_VALIDATOR_ADDRESS = process.env.CONTENT_VALIDATOR_ADDRESS;
const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY;
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;

/**
 * Worker: Procesa validaciones delegadas
 */
const validationWorker = QUEUE_ENABLED ? new Worker('content-validation', async (job) => {
    const {
        contentHash,
        authorAddress,
        contentUri,
        contentType,
        paymentSessionId,
        paymentAmount,
        paymentCurrency
    } = job.data;

    logger.info({
        jobId: job.id,
        contentHash,
        authorAddress
    }, 'Processing validation job');

    try {
        // Conectar con wallet del backend
        const provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
        const wallet = new ethers.Wallet(BACKEND_PRIVATE_KEY, provider);

        // Verificar balance de gas
        const balance = await provider.getBalance(wallet.address);
        logger.info({
            walletAddress: wallet.address,
            balance: ethers.formatEther(balance)
        }, 'Backend wallet balance');

        if (balance < ethers.parseEther('0.01')) {
            throw new Error('Insufficient gas balance in backend wallet');
        }

        const contract = new ethers.Contract(
            CONTENT_VALIDATOR_ADDRESS,
            ContentValidatorABI.abi,
            wallet
        );

        // Llamar a validateDelegated
        logger.info({ contentHash }, 'Calling validateDelegated on smart contract');

        const tx = await contract.validateDelegated(
            contentHash,
            authorAddress,
            contentUri,
            contentType,
            {
                gasLimit: 500000 // Límite de gas explícito
            }
        );

        logger.info({
            txHash: tx.hash,
            contentHash
        }, 'Transaction sent, waiting for confirmation');

        // Esperar confirmación (3 bloques para seguridad)
        const receipt = await tx.wait(3);

        logger.info({
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            contentHash
        }, 'Validation confirmed on blockchain');

        // ✅ Guardar validación en base de datos
        try {
            const validation = await Validation.create({
                contentHash,
                authorAddress,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                paymentMethod: 'fiat',
                paymentSessionId,
                paymentAmount,
                paymentCurrency,
                status: 'confirmed',
                validationType: contentType || 'post',
                gasUsed: receipt.gasUsed.toString(),
                confirmedAt: new Date().toISOString()
            });

            logger.info({
                validationId: validation._id,
                contentHash
            }, 'Validation saved to database');
        } catch (dbError) {
            logger.error({
                error: dbError.message,
                contentHash
            }, 'Error saving validation to database');
            // No lanzar error, ya que la validación blockchain fue exitosa
        }

        // Retornar resultado exitoso
        return {
            success: true,
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            contentHash
        };

    } catch (error) {
        logger.error({
            error: error.message,
            jobId: job.id,
            contentHash
        }, 'Error processing validation job');

        // Lanzar error para que Bull reintente
        throw error;
    }
}, {
    connection,
    concurrency: 5, // Procesar hasta 5 validaciones en paralelo
    limiter: {
        max: 10,
        duration: 1000 // Máximo 10 validaciones por segundo
    }
}) : null;

// Emitir evento WebSocket al usuario cuando la validación fue exitosa
if (validationWorker) validationWorker.on('completed', (job, result) => {
    if (wsServer && job.data.authorAddress && result) {
        try {
            wsServer(job.data.authorAddress, 'validation-success', {
                contentHash: result.contentHash,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                timestamp: new Date().toISOString()
            });
            logger.info({
                authorAddress: job.data.authorAddress,
                contentHash: result.contentHash
            }, 'WebSocket notification sent to user');
        } catch (wsError) {
            logger.error({
                error: wsError.message,
                authorAddress: job.data.authorAddress
            }, 'Error sending WebSocket notification');
        }
    }
});

if (validationWorker) validationWorker.on('failed', (job, error) => {
    logger.error({
        jobId: job.id,
        error: error.message,
        attemptsMade: job.attemptsMade,
        attemptsRemaining: job.opts.attempts - job.attemptsMade
    }, 'Validation job failed');

    // Si ya se agotaron los reintentos, notificar al usuario
    if (job.attemptsMade >= job.opts.attempts) {
        // ✅ Emitir evento WebSocket al usuario
        if (wsServer && job.data.authorAddress) {
            try {
                wsServer(job.data.authorAddress, 'validation-failed', {
                    contentHash: job.data.contentHash,
                    error: 'Failed to process validation after multiple attempts',
                    timestamp: new Date().toISOString()
                });
                logger.info({
                    authorAddress: job.data.authorAddress,
                    contentHash: job.data.contentHash
                }, 'Failure notification sent to user via WebSocket');
            } catch (wsError) {
                logger.error({
                    error: wsError.message,
                    authorAddress: job.data.authorAddress
                }, 'Error sending WebSocket failure notification');
            }
        }
    }
});

if (validationWorker) validationWorker.on('progress', (job, progress) => {
    logger.debug({
        jobId: job.id,
        progress
    }, 'Validation job progress');
});

/**
 * Añadir validación a la cola o procesarla directamente
 */
async function queueValidation(validationData) {
    try {
        if (!QUEUE_ENABLED || !validationQueue) {
            logger.info({ validationData }, 'Queue disabled - processing validation directly');

            // Procesar directamente sin cola
            try {
                // Guardar validación en DB con estado pending
                const validation = await Validation.create({
                    contentHash: validationData.contentHash,
                    authorAddress: validationData.authorAddress,
                    contentType: validationData.contentType,
                    contentUri: validationData.contentUri,
                    status: 'pending',
                    validatedBy: 'backend-direct',
                    metadata: {
                        processedDirectly: true,
                        queueDisabled: true,
                        timestamp: new Date().toISOString()
                    }
                });

                logger.info({
                    contentHash: validationData.contentHash,
                    validationId: validation._id
                }, 'Validation created in pending state (queue disabled)');

                return {
                    id: `direct-${Date.now()}`,
                    data: validationData,
                    skipped: true,
                    validation,
                    message: 'Validation queued for manual processing (queue disabled)'
                };
            } catch (dbError) {
                logger.error({ error: dbError.message }, 'Error creating validation record');
                return {
                    id: 'disabled',
                    data: validationData,
                    skipped: true,
                    error: dbError.message
                };
            }
        }

        const job = await validationQueue.add('validate-content', validationData, {
            attempts: 3, // Reintentar hasta 3 veces
            backoff: {
                type: 'exponential',
                delay: 5000 // Espera exponencial: 5s, 25s, 125s
            },
            removeOnComplete: 100, // Mantener últimas 100 jobs completadas
            removeOnFail: 500 // Mantener últimas 500 jobs fallidas
        });

        logger.info({
            jobId: job.id,
            contentHash: validationData.contentHash
        }, 'Validation job added to queue');

        return job;

    } catch (error) {
        logger.error({
            error: error.message,
            validationData
        }, 'Error queuing validation');
        throw error;
    }
}

/**
 * Obtener estado de un job
 */
async function getJobStatus(jobId) {
    try {
        if (!QUEUE_ENABLED || !validationQueue) return { found: false };
        const job = await validationQueue.getJob(jobId);

        if (!job) {
            return { found: false };
        }

        const state = await job.getState();
        const progress = job.progress;

        return {
            found: true,
            id: job.id,
            state,
            progress,
            data: job.data,
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp
        };

    } catch (error) {
        logger.error({ error: error.message, jobId }, 'Error getting job status');
        throw error;
    }
}

/**
 * Obtener estadísticas de la cola
 */
async function getQueueStats() {
    try {
        if (!QUEUE_ENABLED || !validationQueue) {
            return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0 };
        }
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            validationQueue.getWaitingCount(),
            validationQueue.getActiveCount(),
            validationQueue.getCompletedCount(),
            validationQueue.getFailedCount(),
            validationQueue.getDelayedCount()
        ]);

        return {
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + completed + failed + delayed
        };

    } catch (error) {
        logger.error({ error: error.message }, 'Error getting queue stats');
        throw error;
    }
}

/**
 * Limpiar jobs antiguos
 */
async function cleanQueue(graceTime = 24 * 3600 * 1000) { // 24 horas por defecto
    try {
        if (!QUEUE_ENABLED || !validationQueue) return { cleaned: false };
        await validationQueue.clean(graceTime, 100, 'completed');
        await validationQueue.clean(graceTime, 100, 'failed');

        logger.info({ graceTime }, 'Queue cleaned successfully');
    } catch (error) {
        logger.error({ error: error.message }, 'Error cleaning queue');
        throw error;
    }
}

/**
 * Pausar/reanudar cola
 */
async function pauseQueue() {
    if (!QUEUE_ENABLED || !validationQueue) return;
    await validationQueue.pause();
    logger.info('Queue paused');
}

async function resumeQueue() {
    if (!QUEUE_ENABLED || !validationQueue) return;
    await validationQueue.resume();
    logger.info('Queue resumed');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing validation worker...');
    if (validationWorker) await validationWorker.close();
    if (validationQueue) await validationQueue.close();
});

module.exports = {
    validationQueue,
    validationWorker,
    queueValidation,
    getJobStatus,
    getQueueStats,
    cleanQueue,
    pauseQueue,
    resumeQueue
};
