/**
 * ⛓️ Blockchain Service - Ejecutor de Decisiones On-Chain
 * 
 * Interactúa con contratos inteligentes para:
 * - Ajustar APY dinámicamente
 * - Ejecutar Halving automático
 * - Escuchar eventos del blockchain
 * - Publicar eventos al EventBus
 * 
 * @security Requiere AUTOMATION_ROLE en el contrato
 */

const { ethers } = require('ethers');
const pino = require('pino');
const eventBus = require('../events/EventBus');

const logger = pino({ name: 'BlockchainService' });

// ABI simplificado del contrato BeZhasCore
const BEZHAS_CORE_ABI = [
    'function setStakingAPY(uint256 newAPY) external',
    'function executeHalving() external returns (bool)',
    'function currentAPY() external view returns (uint256)',
    'function hasRole(bytes32 role, address account) external view returns (bool)',
    'function AUTOMATION_ROLE() external view returns (bytes32)',
    'event APYUpdated(uint256 oldAPY, uint256 newAPY, uint256 timestamp)',
    'event HalvingExecuted(uint256 newEmissionRate, uint256 timestamp)',
    'event EmergencyPause(address indexed pauser, string reason)'
];

class BlockchainService {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.contract = null;
        this.isInitialized = false;

        // Circuit breaker para proteger contra fallos
        this.circuitBreaker = {
            failures: 0,
            threshold: 5,
            resetTimeout: 60000, // 1 minuto
            isOpen: false,
            lastFailure: null
        };

        // Retry config
        this.retryConfig = {
            maxAttempts: 3,
            backoffMs: 2000
        };
    }

    /**
     * 🚀 Inicializar conexión con blockchain
     */
    async initialize() {
        if (this.isInitialized) {
            logger.info('✅ BlockchainService ya inicializado');
            return;
        }

        try {
            const rpcUrl = process.env.RPC_URL || process.env.ETHEREUM_RPC_URL;
            const privateKey = process.env.AUTOMATION_PRIVATE_KEY;
            const contractAddress = process.env.BEZHAS_CORE_ADDRESS;

            if (!rpcUrl || !privateKey || !contractAddress) {
                console.warn('⚠️ Blockchain service disabled - RPC_URL not configured');
                return;
            }

            // Conectar con provider
            this.provider = new ethers.JsonRpcProvider(rpcUrl);

            // Crear wallet con la private key de automatización
            this.wallet = new ethers.Wallet(privateKey, this.provider);

            // Instanciar contrato
            this.contract = new ethers.Contract(contractAddress, BEZHAS_CORE_ABI, this.wallet);

            // Verificar que la wallet tiene el rol AUTOMATION_ROLE
            await this._verifyAutomationRole();

            // Iniciar listener de eventos
            this._startEventListeners();

            this.isInitialized = true;
            logger.info({
                wallet: this.wallet.address,
                contract: contractAddress,
                network: (await this.provider.getNetwork()).name
            }, '✅ BlockchainService inicializado');

        } catch (error) {
            logger.error({ error: error.message }, '❌ Error inicializando BlockchainService');
            throw error;
        }
    }

    /**
     * 📊 Ajustar APY del staking dinámicamente
     */
    async setStakingAPY(newAPY, reason = '') {
        await this._ensureInitialized();

        if (this.circuitBreaker.isOpen) {
            throw new Error('Circuit breaker abierto. Servicio temporalmente deshabilitado');
        }

        logger.info({ newAPY, reason }, '⚙️ Ajustando APY en blockchain...');

        try {
            // Validación de entrada
            if (newAPY < 500 || newAPY > 5000) {
                throw new Error(`APY fuera de rango permitido: ${newAPY} (debe estar entre 500-5000)`);
            }

            // Obtener APY actual
            const currentAPY = await this.contract.currentAPY();
            const currentAPYNumber = Number(currentAPY);

            if (currentAPYNumber === newAPY) {
                logger.info('ℹ️ APY ya está en el valor deseado');
                return { success: true, unchanged: true };
            }

            // Ejecutar transacción con retry
            const tx = await this._executeWithRetry(async () => {
                return await this.contract.setStakingAPY(newAPY, {
                    gasLimit: 150000
                });
            });

            logger.info({ txHash: tx.hash }, '⏳ Transacción enviada, esperando confirmación...');

            // Esperar confirmación
            const receipt = await tx.wait();

            logger.info({
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                oldAPY: currentAPYNumber,
                newAPY
            }, '✅ APY actualizado exitosamente');

            // Publicar evento
            eventBus.publish(eventBus.EVENTS.BLOCKCHAIN_APY_UPDATED, {
                oldAPY: currentAPYNumber,
                newAPY,
                reason,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                timestamp: new Date().toISOString()
            });

            // Reset circuit breaker en caso de éxito
            this._resetCircuitBreaker();

            return {
                success: true,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                oldAPY: currentAPYNumber,
                newAPY
            };

        } catch (error) {
            this._handleTransactionError(error, 'setStakingAPY');
            throw error;
        }
    }

    /**
     * 🔪 Ejecutar Halving automático
     */
    async executeHalving(reason = '') {
        await this._ensureInitialized();

        if (this.circuitBreaker.isOpen) {
            throw new Error('Circuit breaker abierto. No se puede ejecutar halving');
        }

        logger.warn({ reason }, '⚠️ Ejecutando HALVING en blockchain...');

        try {
            // Ejecutar con retry y gas alto
            const tx = await this._executeWithRetry(async () => {
                return await this.contract.executeHalving({
                    gasLimit: 300000
                });
            });

            logger.info({ txHash: tx.hash }, '⏳ Halving enviado, esperando confirmación...');

            const receipt = await tx.wait();

            logger.info({
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString()
            }, '✅ HALVING ejecutado exitosamente');

            // Publicar evento crítico
            eventBus.publish(eventBus.EVENTS.BLOCKCHAIN_HALVING_EXECUTED, {
                reason,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                timestamp: new Date().toISOString(),
                severity: 'CRITICAL'
            });

            this._resetCircuitBreaker();

            return {
                success: true,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber
            };

        } catch (error) {
            this._handleTransactionError(error, 'executeHalving');
            throw error;
        }
    }

    /**
     * 📡 Obtener APY actual del contrato
     */
    async getCurrentAPY() {
        await this._ensureInitialized();

        try {
            const apy = await this.contract.currentAPY();
            return Number(apy);
        } catch (error) {
            logger.error({ error: error.message }, '❌ Error obteniendo APY actual');
            return null;
        }
    }

    /**
     * 🎧 Escuchar eventos del contrato
     */
    _startEventListeners() {
        // Listener: APYUpdated
        this.contract.on('APYUpdated', (oldAPY, newAPY, timestamp, event) => {
            logger.info({
                oldAPY: Number(oldAPY),
                newAPY: Number(newAPY),
                timestamp: Number(timestamp)
            }, '📡 Evento APYUpdated detectado');

            eventBus.publish(eventBus.EVENTS.BLOCKCHAIN_TX_CONFIRMED, {
                eventName: 'APYUpdated',
                oldAPY: Number(oldAPY),
                newAPY: Number(newAPY),
                txHash: event.log.transactionHash,
                blockNumber: event.log.blockNumber
            });
        });

        // Listener: HalvingExecuted
        this.contract.on('HalvingExecuted', (newEmissionRate, timestamp, event) => {
            logger.warn({
                newEmissionRate: newEmissionRate.toString(),
                timestamp: Number(timestamp)
            }, '🔪 Evento HalvingExecuted detectado');

            eventBus.publish(eventBus.EVENTS.BLOCKCHAIN_TX_CONFIRMED, {
                eventName: 'HalvingExecuted',
                newEmissionRate: newEmissionRate.toString(),
                txHash: event.log.transactionHash,
                blockNumber: event.log.blockNumber
            });
        });

        // Listener: EmergencyPause
        this.contract.on('EmergencyPause', (pauser, reason, event) => {
            logger.error({
                pauser,
                reason
            }, '🚨 PAUSA DE EMERGENCIA ACTIVADA');

            eventBus.publish(eventBus.EVENTS.SYSTEM_EMERGENCY_PAUSE, {
                pauser,
                reason,
                txHash: event.log.transactionHash,
                blockNumber: event.log.blockNumber
            });
        });

        logger.info('👂 Event listeners iniciados para contrato BeZhasCore');
    }

    // --- MÉTODOS PRIVADOS ---

    async _ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    async _verifyAutomationRole() {
        const roleBytes = await this.contract.AUTOMATION_ROLE();
        const hasRole = await this.contract.hasRole(roleBytes, this.wallet.address);

        if (!hasRole) {
            throw new Error(
                `Wallet ${this.wallet.address} no tiene AUTOMATION_ROLE. ` +
                `Otorgar rol desde admin del contrato.`
            );
        }

        logger.info({ wallet: this.wallet.address }, '✅ AUTOMATION_ROLE verificado');
    }

    async _executeWithRetry(txFunction) {
        let lastError;

        for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
            try {
                return await txFunction();
            } catch (error) {
                lastError = error;
                logger.warn({
                    attempt,
                    maxAttempts: this.retryConfig.maxAttempts,
                    error: error.message
                }, `⚠️ Intento ${attempt} falló, reintentando...`);

                if (attempt < this.retryConfig.maxAttempts) {
                    await this._sleep(this.retryConfig.backoffMs * attempt);
                }
            }
        }

        throw lastError;
    }

    _handleTransactionError(error, method) {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailure = Date.now();

        logger.error({
            method,
            error: error.message,
            failures: this.circuitBreaker.failures
        }, '❌ Error en transacción blockchain');

        // Abrir circuit breaker si se alcanza el threshold
        if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
            this.circuitBreaker.isOpen = true;
            logger.error('🚨 Circuit breaker ABIERTO. Pausando transacciones...');

            eventBus.publish(eventBus.EVENTS.AUTOMATION_HANDLER_FAILED, {
                service: 'BlockchainService',
                method,
                error: error.message,
                circuitBreakerStatus: 'OPEN'
            });

            // Auto-reset después de timeout
            setTimeout(() => {
                this._resetCircuitBreaker();
                logger.info('🔄 Circuit breaker CERRADO. Reanudando operaciones');
            }, this.circuitBreaker.resetTimeout);
        }
    }

    _resetCircuitBreaker() {
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.lastFailure = null;
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new BlockchainService();
