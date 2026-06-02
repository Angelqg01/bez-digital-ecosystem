const { ethers } = require('ethers');
const logger = require('../utils/logger');
const ContentValidatorABI = require('../contracts/ContentValidator.json');

class BlockchainEventListener {
    constructor() {
        this.provider = null;
        this.contract = null;
        this.isListening = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000; // 5 segundos
    }

    /**
     * Inicializar listener
     */
    async initialize() {
        try {
            const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL;
            const CONTENT_VALIDATOR_ADDRESS = process.env.CONTENT_VALIDATOR_ADDRESS;

            if (!POLYGON_RPC_URL || !CONTENT_VALIDATOR_ADDRESS) {
                throw new Error('Missing required environment variables');
            }

            // Crear provider con WebSocket para eventos en tiempo real
            this.provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);

            this.contract = new ethers.Contract(
                CONTENT_VALIDATOR_ADDRESS,
                ContentValidatorABI.abi,
                this.provider
            );

            logger.info({
                contractAddress: CONTENT_VALIDATOR_ADDRESS,
                rpcUrl: POLYGON_RPC_URL
            }, 'Blockchain event listener initialized');

            // Verificar conexión
            const blockNumber = await this.provider.getBlockNumber();
            logger.info({ blockNumber }, 'Connected to blockchain');

            return true;

        } catch (error) {
            logger.error({ error: error.message }, 'Error initializing blockchain listener');
            throw error;
        }
    }

    /**
     * Empezar a escuchar eventos
     */
    async startListening() {
        if (this.isListening) {
            logger.warn('Event listener is already running');
            return;
        }

        try {
            await this.initialize();

            logger.info('🔊 Starting blockchain event listener...');

            // Procesar eventos históricos (últimas 24 horas)
            await this.processHistoricalEvents();

            // Escuchar eventos futuros
            this.listenToEvents();

            this.isListening = true;
            this.reconnectAttempts = 0;

            logger.info('✅ Blockchain event listener started successfully');

        } catch (error) {
            logger.error({ error: error.message }, 'Error starting event listener');
            await this.handleReconnect();
        }
    }

    /**
     * Procesar eventos históricos
     */
    async processHistoricalEvents() {
        try {
            const currentBlock = await this.provider.getBlockNumber();
            const blocksPerDay = 43200; // ~2 segundos por bloque en Polygon
            const fromBlock = Math.max(0, currentBlock - blocksPerDay);

            logger.info({ fromBlock, currentBlock }, 'Fetching historical events');

            // Obtener eventos ContentValidated
            const validatedEvents = await this.contract.queryFilter(
                'ContentValidated',
                fromBlock,
                currentBlock
            );

            logger.info({
                count: validatedEvents.length
            }, 'Historical ContentValidated events found');

            // Procesar cada evento
            for (const event of validatedEvents) {
                await this.processValidationEvent(event);
            }

            // Obtener eventos ValidationRevoked
            const revokedEvents = await this.contract.queryFilter(
                'ValidationRevoked',
                fromBlock,
                currentBlock
            );

            logger.info({
                count: revokedEvents.length
            }, 'Historical ValidationRevoked events found');

            for (const event of revokedEvents) {
                await this.processRevocationEvent(event);
            }

        } catch (error) {
            logger.error({ error: error.message }, 'Error processing historical events');
        }
    }

    /**
     * Escuchar eventos en tiempo real
     */
    listenToEvents() {
        // Evento: ContentValidated
        this.contract.on('ContentValidated', async (
            contentHash,
            author,
            timestamp,
            contentUri,
            contentType,
            validationId,
            paymentMethod,
            event
        ) => {
            logger.info({
                contentHash,
                author,
                validationId: validationId.toString(),
                txHash: event.log.transactionHash
            }, '📩 ContentValidated event received');

            await this.processValidationEvent(event.log, {
                contentHash,
                author,
                timestamp: timestamp.toString(),
                contentUri,
                contentType,
                validationId: validationId.toString(),
                paymentMethod: Number(paymentMethod)
            });
        });

        // Evento: ValidationRevoked
        this.contract.on('ValidationRevoked', async (
            contentHash,
            revokedBy,
            reason,
            event
        ) => {
            logger.warn({
                contentHash,
                revokedBy,
                reason,
                txHash: event.log.transactionHash
            }, '⚠️ ValidationRevoked event received');

            await this.processRevocationEvent(event.log, {
                contentHash,
                revokedBy,
                reason
            });
        });

        // Evento: ValidationFeeUpdated
        this.contract.on('ValidationFeeUpdated', async (
            feeType,
            newFee,
            event
        ) => {
            logger.info({
                feeType,
                newFee: ethers.formatEther(newFee),
                txHash: event.log.transactionHash
            }, '💰 ValidationFeeUpdated event received');
        });

        // Evento: ValidatorAuthorizationChanged
        this.contract.on('ValidatorAuthorizationChanged', async (
            validator,
            isAuthorized,
            event
        ) => {
            logger.info({
                validator,
                isAuthorized,
                txHash: event.log.transactionHash
            }, '🔐 ValidatorAuthorizationChanged event received');
        });

        // Manejar errores de eventos
        this.contract.on('error', (error) => {
            logger.error({ error: error.message }, 'Event listener error');
            this.handleReconnect();
        });

        // Manejar desconexión del provider
        this.provider.on('error', (error) => {
            logger.error({ error: error.message }, 'Provider error');
            this.handleReconnect();
        });
    }

    /**
     * Procesar evento ContentValidated
     */
    async processValidationEvent(event, parsedData = null) {
        try {
            // Si no hay datos parseados, parsear del evento
            const data = parsedData || this.parseValidationEvent(event);

            logger.info({
                contentHash: data.contentHash,
                author: data.author,
                validationId: data.validationId
            }, 'Processing ContentValidated event');

            // TODO: Actualizar base de datos PostgreSQL
            // await db.validations.upsert({
            //     where: { contentHash: data.contentHash },
            //     update: {
            //         isValidated: true,
            //         transactionHash: event.transactionHash,
            //         blockNumber: event.blockNumber,
            //         timestamp: new Date(Number(data.timestamp) * 1000),
            //         validationId: Number(data.validationId),
            //         paymentMethod: this.getPaymentMethodString(data.paymentMethod),
            //         updatedAt: new Date()
            //     },
            //     create: {
            //         contentHash: data.contentHash,
            //         author: data.author,
            //         contentUri: data.contentUri,
            //         contentType: data.contentType,
            //         isValidated: true,
            //         transactionHash: event.transactionHash,
            //         blockNumber: event.blockNumber,
            //         timestamp: new Date(Number(data.timestamp) * 1000),
            //         validationId: Number(data.validationId),
            //         paymentMethod: this.getPaymentMethodString(data.paymentMethod),
            //         isActive: true
            //     }
            // });

            // TODO: Emitir evento WebSocket al usuario
            // const io = require('../websocket-server').io;
            // io.to(`user_${data.author}`).emit('content-validated', {
            //     contentHash: data.contentHash,
            //     transactionHash: event.transactionHash,
            //     validationId: data.validationId,
            //     timestamp: data.timestamp
            // });

            // TODO: Crear notificación in-app
            // await db.notifications.create({
            //     userId: data.author,
            //     type: 'CONTENT_VALIDATED',
            //     title: 'Contenido Certificado en Blockchain',
            //     message: 'Tu contenido ha sido validado y registrado permanentemente',
            //     data: {
            //         contentHash: data.contentHash,
            //         transactionHash: event.transactionHash
            //     },
            //     read: false,
            //     createdAt: new Date()
            // });

            logger.info({
                contentHash: data.contentHash
            }, '✅ Validation event processed successfully');

        } catch (error) {
            logger.error({
                error: error.message,
                event
            }, 'Error processing validation event');
        }
    }

    /**
     * Procesar evento ValidationRevoked
     */
    async processRevocationEvent(event, parsedData = null) {
        try {
            const data = parsedData || this.parseRevocationEvent(event);

            logger.warn({
                contentHash: data.contentHash,
                reason: data.reason
            }, 'Processing ValidationRevoked event');

            // TODO: Actualizar base de datos
            // await db.validations.update({
            //     where: { contentHash: data.contentHash },
            //     data: {
            //         isActive: false,
            //         revokedBy: data.revokedBy,
            //         revocationReason: data.reason,
            //         revokedAt: new Date(),
            //         revocationTxHash: event.transactionHash
            //     }
            // });

            // TODO: Notificar al autor
            // const validation = await db.validations.findUnique({
            //     where: { contentHash: data.contentHash }
            // });
            // io.to(`user_${validation.author}`).emit('validation-revoked', {
            //     contentHash: data.contentHash,
            //     reason: data.reason
            // });

            logger.info({
                contentHash: data.contentHash
            }, '✅ Revocation event processed successfully');

        } catch (error) {
            logger.error({
                error: error.message,
                event
            }, 'Error processing revocation event');
        }
    }

    /**
     * Parsear evento ContentValidated
     */
    parseValidationEvent(event) {
        const iface = new ethers.Interface(ContentValidatorABI.abi);
        const parsed = iface.parseLog({
            topics: event.topics,
            data: event.data
        });

        return {
            contentHash: parsed.args[0],
            author: parsed.args[1],
            timestamp: parsed.args[2].toString(),
            contentUri: parsed.args[3],
            contentType: parsed.args[4],
            validationId: parsed.args[5].toString(),
            paymentMethod: Number(parsed.args[6])
        };
    }

    /**
     * Parsear evento ValidationRevoked
     */
    parseRevocationEvent(event) {
        const iface = new ethers.Interface(ContentValidatorABI.abi);
        const parsed = iface.parseLog({
            topics: event.topics,
            data: event.data
        });

        return {
            contentHash: parsed.args[0],
            revokedBy: parsed.args[1],
            reason: parsed.args[2]
        };
    }

    /**
     * Convertir PaymentMethod enum a string
     */
    getPaymentMethodString(method) {
        const methods = ['BezCoin', 'NativeCurrency', 'FiatDelegated'];
        return methods[method] || 'Unknown';
    }

    /**
     * Manejar reconexión
     */
    async handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Max reconnection attempts reached, giving up');
            return;
        }

        this.reconnectAttempts++;
        this.isListening = false;

        logger.info({
            attempt: this.reconnectAttempts,
            delay: this.reconnectDelay
        }, 'Attempting to reconnect...');

        // Limpiar listeners anteriores
        if (this.contract) {
            this.contract.removeAllListeners();
        }

        // Esperar antes de reconectar
        await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));

        // Reintentar
        await this.startListening();
    }

    /**
     * Detener listener
     */
    async stop() {
        logger.info('Stopping blockchain event listener...');

        if (this.contract) {
            this.contract.removeAllListeners();
        }

        if (this.provider) {
            this.provider.removeAllListeners();
        }

        this.isListening = false;

        logger.info('✅ Blockchain event listener stopped');
    }

    /**
     * Obtener estado del listener
     */
    getStatus() {
        return {
            isListening: this.isListening,
            reconnectAttempts: this.reconnectAttempts,
            contractAddress: this.contract?.target,
            providerUrl: this.provider?._getConnection()?.url
        };
    }
}

// Singleton instance
const blockchainListener = new BlockchainEventListener();

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, stopping blockchain listener...');
    await blockchainListener.stop();
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, stopping blockchain listener...');
    await blockchainListener.stop();
    process.exit(0);
});

module.exports = blockchainListener;
