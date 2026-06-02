/**
 * BeZhas Universal Bridge - Core Module
 * 
 * This is the centralized bridge controller that manages all external platform
 * integrations through a standardized adapter pattern.
 * 
 * Architecture:
 * - Bridge Core: Handles routing, validation, and logging
 * - Adapters: Platform-specific translators (Vinted, Maersk, etc.)
 * - Webhooks: Inbound event receivers from external platforms
 * - Sync Jobs: Scheduled background synchronization tasks
 */

const EventEmitter = require('events');
const BridgeOrder = require('../../models/BridgeOrder.model');
const feedbackLoopService = require('../../services/feedback-loop.service');
const aegisSafetyService = require('../../services/aegis-safety.service');
const logger = require('../../utils/logger');
const unifiedAI = require('../../services/unified-ai.service');

// Bridge event types
const BRIDGE_EVENTS = {
    INVENTORY_SYNCED: 'inventory:synced',
    INVENTORY_SYNC_FAILED: 'inventory:sync_failed',
    ORDER_CREATED: 'order:created',
    ORDER_UPDATED: 'order:updated',
    SHIPMENT_UPDATED: 'shipment:updated',
    PAYMENT_RECEIVED: 'payment:received',
    PAYMENT_FAILED: 'payment:failed',
    WEBHOOK_RECEIVED: 'webhook:received',
    ADAPTER_CONNECTED: 'adapter:connected',
    ADAPTER_DISCONNECTED: 'adapter:disconnected',
    ERROR: 'error',
};

// Bridge status codes
const BRIDGE_STATUS = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    SYNCING: 'syncing',
    ERROR: 'error',
    RATE_LIMITED: 'rate_limited',
};

/**
 * Universal Bridge Core Controller
 * 
 * Manages all platform adapters and provides a unified interface
 * for external integrations.
 */
class UniversalBridgeCore extends EventEmitter {
    constructor() {
        super();
        this.adapters = new Map();
        this.webhookHandlers = new Map();
        this.syncJobs = new Map();
        this.stats = {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            lastSyncTime: null,
            activeConnections: 0,
        };
        this.initialized = false;
    }

    /**
     * Initialize the bridge core
     */
    async initialize() {
        if (this.initialized) {
            logger.warn('Bridge Core already initialized');
            return;
        }

        logger.info('🌉 Initializing Universal Bridge Core...');

        // Setup error handling
        this.on(BRIDGE_EVENTS.ERROR, (error, context) => {
            logger.error({ error, context }, 'Bridge Core Error');
            this.stats.failedSyncs++;
        });

        this.initialized = true;
        logger.info('✅ Universal Bridge Core initialized');
    }

    /**
     * Register a platform adapter
     * @param {string} platformId - Unique platform identifier
     * @param {BaseAdapter} adapter - Adapter instance
     */
    registerAdapter(platformId, adapter) {
        if (this.adapters.has(platformId)) {
            logger.warn({ platformId }, 'Adapter already registered, replacing...');
        }

        this.adapters.set(platformId, adapter);
        this.stats.activeConnections = this.adapters.size;

        // Bind adapter events to bridge events
        adapter.on('sync_complete', (data) => {
            this.emit(BRIDGE_EVENTS.INVENTORY_SYNCED, { platformId, ...data });
            this.stats.successfulSyncs++;
            this.stats.totalSyncs++;
            this.stats.lastSyncTime = new Date();
        });

        adapter.on('sync_error', (error) => {
            this.emit(BRIDGE_EVENTS.INVENTORY_SYNC_FAILED, { platformId, error });
            this.stats.failedSyncs++;
            this.stats.totalSyncs++;
        });

        adapter.on('order_created', (data) => {
            this.emit(BRIDGE_EVENTS.ORDER_CREATED, { platformId, ...data });
        });

        adapter.on('shipment_updated', (data) => {
            this.emit(BRIDGE_EVENTS.SHIPMENT_UPDATED, { platformId, ...data });
        });

        adapter.on('payment_received', (data) => {
            this.emit(BRIDGE_EVENTS.PAYMENT_RECEIVED, { platformId, ...data });
        });

        this.emit(BRIDGE_EVENTS.ADAPTER_CONNECTED, { platformId });
        logger.info({ platformId }, '🔌 Adapter registered');
    }

    /**
     * Unregister a platform adapter
     * @param {string} platformId - Platform identifier
     */
    unregisterAdapter(platformId) {
        if (this.adapters.has(platformId)) {
            const adapter = this.adapters.get(platformId);
            adapter.disconnect?.();
            this.adapters.delete(platformId);
            this.stats.activeConnections = this.adapters.size;
            this.emit(BRIDGE_EVENTS.ADAPTER_DISCONNECTED, { platformId });
            logger.info({ platformId }, '🔌 Adapter unregistered');
        }
    }

    /**
     * Get an adapter by platform ID
     * @param {string} platformId - Platform identifier
     * @returns {BaseAdapter|null}
     */
    getAdapter(platformId) {
        return this.adapters.get(platformId) || null;
    }

    /**
     * Get all registered adapters
     * @returns {Map}
     */
    getAllAdapters() {
        return this.adapters;
    }

    /**
     * Sync inventory from a specific platform
     * @param {string} platformId - Platform identifier
     * @param {object} options - Sync options
     */
    async syncInventory(platformId, options = {}) {
        const adapter = this.getAdapter(platformId);
        if (!adapter) {
            throw new Error(`Adapter not found for platform: ${platformId}`);
        }

        logger.info({ platformId, options }, '📦 Starting inventory sync');
        return adapter.syncInventory(options);
    }

    /**
     * Sync inventory from all registered platforms
     * @param {object} options - Sync options
     */
    async syncAllInventory(options = {}) {
        const results = [];

        for (const [platformId, adapter] of this.adapters) {
            try {
                const result = await adapter.syncInventory(options);
                results.push({ platformId, success: true, result });
            } catch (error) {
                results.push({ platformId, success: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * Process an incoming webhook
     * @param {string} platformId - Platform identifier
     * @param {string} eventType - Event type
     * @param {object} payload - Webhook payload
     */
    async processWebhook(platformId, eventType, payload) {
        const adapter = this.getAdapter(platformId);
        
        if (!adapter) {
            logger.info({ platformId }, '⚠️ Platform not registered. Using Dynamic AI Analysis...');
            return this.processDynamicWebhook(payload, platformId);
        }

        this.emit(BRIDGE_EVENTS.WEBHOOK_RECEIVED, { platformId, eventType });
        return adapter.handleWebhook(eventType, payload);
    }

    /**
     * Procesa un webhook de forma dinámica usando IA (para plataformas no registradas)
     */
    async processDynamicWebhook(payload, platformHint = 'unknown') {
        try {
            // EVALUACIÓN DE SALUD PREVENTIVA (AEGIS)
            await aegisSafetyService.evaluateSystemHealth();
            const aegisStatus = aegisSafetyService.getStatus();

            if (aegisStatus === 'alert' || aegisStatus === 'lockdown') {
                logger.warn('🛡️ [AEGIS_ENFORCEMENT] System alert! Forcing heuristic bypass to avoid AI failures.');
                const heuristic = this._heuristicWebhookAnalysis(payload);
                if (heuristic) {
                    return { success: true, mode: 'dynamic_heuristic_safe', analysis: heuristic };
                }
            }

            const prompt = `Analiza este JSON de un Webhook de la plataforma "${platformHint}". 
            Determina si representa una venta exitosa o un pago confirmado.
            Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin explicaciones).
            Ejemplo de respuesta: {"isPayment": true, "amount": 150.50, "currency": "ARS", "orderId": "55667788", "confidence": 0.95}
            Si no es un pago, pon "isPayment": false.`;

            // DETECCIÓN NATIVA BEZ-PAY (Skill: bezpay.md)
            if (payload.source === 'bezpay' || payload.bridge_type === 'native' || payload.txHash?.startsWith('0x')) {
                logger.info('💎 [BEZ-PAY] Native payment detected. Applying triple reputation bonus.');
                const result = {
                    isPayment: true,
                    amount: parseFloat(payload.amount || payload.total || 0),
                    currency: payload.currency || 'BEZ',
                    orderId: payload.order_id || payload.txHash,
                    confidence: 1.0,
                    mode: 'native_blockchain'
                };
                return { success: true, mode: 'native_bezpay', analysis: result };
            }

            const aiResult = await unifiedAI.process('CHAT', {
                message: prompt + "\n\nPAYLOAD:\n" + JSON.stringify(payload),
                context: { systemRole: 'developer' }
            });

            console.log('DEBUG AI RESPONSE:', aiResult.text);

            // Extraer JSON de la respuesta de la IA
            const match = aiResult.text.match(/\{[\s\S]*\}/);
            if (!match) return { processed: false, reason: 'AI could not parse payload' };
            
            const analysis = JSON.parse(match[0]);

            if (analysis.isPayment && analysis.confidence > 0.8) {
                logger.info({ platformId: platformHint, analysis }, '🎯 Dynamic Payment Detected by AI');
                
                const eventData = {
                    platformId: platformHint,
                    payment: {
                        id: analysis.orderId,
                        amount: analysis.amount,
                        currency: analysis.currency,
                        dynamic: true
                    }
                };

                this.emit(BRIDGE_EVENTS.PAYMENT_RECEIVED, eventData);

                // PERSISTIR: Guardar la orden dinámica en la DB para que aparezca en el panel de ingresos
                try {
                    await BridgeOrder.create({
                        beZhasOrderId: `BZH-DYN-${Date.now()}`,
                        externalOrderId: analysis.orderId,
                        platform: 'other',
                        totalAmount: analysis.amount,
                        currency: analysis.currency,
                        status: 'confirmed',
                        paymentStatus: 'paid',
                        paidAt: new Date(),
                        metadata: { dynamic: true, analysisMode: 'ai', platformHint },
                        seller: { externalId: 'AUTONOMOUS_SELLER', beZhasId: `USER_${process.env.TREASURY_WALLET_ADDRESS}` },
                        apiKey: "65f1a2b3c4d5e6f7a8b9c0d1" // Fictitious ID for dynamic
                    });
                    logger.info(`💾 Dynamic Order persisted for platform: ${platformHint}`);
                    
                    // FEEDBACK LOOP: Nutrir la IA con este éxito
                    await feedbackLoopService.log({
                        type: 'bridge',
                        action: 'DYNAMIC_WEBHOOK_DETECTION',
                        status: 'success',
                        result: `Identified payment in ${platformHint} via AI`,
                        solution: `Use AI regex for ${platformHint} schema`,
                        metadata: { platform: platformHint, orderId: analysis.orderId, amount: analysis.amount }
                    });
                } catch (persistError) {
                    logger.error({ persistError }, 'Failed to persist dynamic order');
                }

                return { success: true, mode: 'dynamic_ai', analysis };
            }

            // FALLBACK: Heurística si la IA falla o tiene baja confianza
            const heuristic = this._heuristicWebhookAnalysis(payload);
            if (heuristic) {
                logger.info({ platformId: platformHint, heuristic }, '🛠️ Dynamic Payment Detected by Heuristic (AI Fallback)');
                
                const eventData = {
                    platformId: platformHint,
                    payment: {
                        id: heuristic.orderId,
                        amount: heuristic.amount,
                        currency: heuristic.currency,
                        dynamic: true
                    }
                };

                this.emit(BRIDGE_EVENTS.PAYMENT_RECEIVED, eventData);

                // PERSISTIR: Guardar la orden heurística en la DB
                try {
                    await BridgeOrder.create({
                        beZhasOrderId: `BZH-HEU-${Date.now()}`,
                        externalOrderId: heuristic.orderId,
                        platform: 'other',
                        totalAmount: heuristic.amount,
                        currency: heuristic.currency,
                        status: 'confirmed',
                        paymentStatus: 'paid',
                        paidAt: new Date(),
                        metadata: { dynamic: true, analysisMode: 'heuristic', platformHint },
                        seller: { externalId: 'AUTONOMOUS_SELLER', beZhasId: `USER_${process.env.TREASURY_WALLET_ADDRESS}` },
                        apiKey: "65f1a2b3c4d5e6f7a8b9c0d1"
                    });
                    logger.info(`💾 Dynamic Order (Heuristic) persisted for platform: ${platformHint}`);

                    // FEEDBACK LOOP: Notar fallo de IA pero éxito de Heurística para mejorar el prompt
                    await feedbackLoopService.log({
                        type: 'bridge',
                        action: 'HEURISTIC_OVERRIDE',
                        status: 'success',
                        result: `Identified payment in ${platformHint} via Heuristic (AI failed)`,
                        solution: `Update AI prompt to include pattern: ${JSON.stringify(payload).substring(0, 50)}...`,
                        metadata: { platform: platformHint, orderId: heuristic.orderId }
                    });
                } catch (persistError) {
                    logger.error({ persistError }, 'Failed to persist heuristic order');
                }

                return { success: true, mode: 'dynamic_heuristic', analysis: heuristic };
            }

            return { success: false, mode: 'dynamic_ai', reason: 'AI low confidence and heuristic failed' };

        } catch (error) {
            logger.error({ error }, 'Error in dynamic webhook analysis');
            
            // Intento final por heurística ante error fatal de IA
            const heuristic = this._heuristicWebhookAnalysis(payload);
            if (heuristic) {
                const eventData = {
                    platformId: platformHint,
                    payment: { id: heuristic.orderId, amount: heuristic.amount, currency: heuristic.currency, dynamic: true }
                };
                this.emit(BRIDGE_EVENTS.PAYMENT_RECEIVED, eventData);
                return { success: true, mode: 'dynamic_heuristic_emergency', analysis: heuristic };
            }
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Análisis heurístico basado en patrones comunes de webhooks
     */
    _heuristicWebhookAnalysis(payload) {
        try {
            const str = JSON.stringify(payload).toLowerCase();
            
            // Patrones universales de pago exitoso
            // MercadoLibre usa 'approved' | Airbnb 'confirmed' | Others: 'success', 'paid', 'completed'
            const isSuccess = str.includes('approved') || str.includes('confirmed') || str.includes('completed') || str.includes('paid') || str.includes('success');
            const hasPaymentTerm = str.includes('payment') || str.includes('transaction') || str.includes('order') || str.includes('billing') || str.includes('amount');

            if (isSuccess && hasPaymentTerm) {
                // Extraer monto
                const amountMatch = str.match(/amount":\s*(\d+(\.\d+)?)/) || str.match(/total":\s*(\d+(\.\d+)?)/) || str.match(/price":\s*(\d+(\.\d+)?)/);
                const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
                
                // Extraer moneda
                const currencyMatch = str.match(/currency_id":\s*"([a-z]{3})"/i) || str.match(/currency":\s*"([a-z]{3})"/i);
                const currency = currencyMatch ? currencyMatch[1].toUpperCase() : 'USD';

                // Extraer ID
                const idMatch = str.match(/id":\s*"([^"]+)"/) || str.match(/id":\s*(\d+)/);
                const orderId = idMatch ? idMatch[1] : 'unknown_' + Date.now();

                return {
                    isPayment: true,
                    amount,
                    currency,
                    orderId,
                    confidence: 0.7
                };
            }
        } catch (e) {
            return null;
        }
        return null;
    }

    /**
     * Create an order across platforms
     * @param {string} platformId - Target platform
     * @param {object} orderData - Order data in BeZhas format
     */
    async createOrder(platformId, orderData) {
        const adapter = this.getAdapter(platformId);
        if (!adapter) {
            throw new Error(`Adapter not found for platform: ${platformId}`);
        }

        return adapter.createOrder(orderData);
    }

    /**
     * Update shipment status
     * @param {string} platformId - Platform identifier
     * @param {string} trackingNumber - Tracking number
     * @param {object} statusData - Status update data
     */
    async updateShipment(platformId, trackingNumber, statusData) {
        const adapter = this.getAdapter(platformId);
        if (!adapter) {
            throw new Error(`Adapter not found for platform: ${platformId}`);
        }

        return adapter.updateShipment(trackingNumber, statusData);
    }

    /**
     * Get bridge statistics
     */
    getStats() {
        const adapterStats = {};
        for (const [platformId, adapter] of this.adapters) {
            adapterStats[platformId] = {
                status: adapter.getStatus?.() || BRIDGE_STATUS.CONNECTED,
                lastSync: adapter.getLastSyncTime?.() || null,
            };
        }

        return {
            ...this.stats,
            adapters: adapterStats,
            timestamp: new Date(),
        };
    }

    /**
     * Health check for all adapters
     */
    async healthCheck() {
        const results = {};

        for (const [platformId, adapter] of this.adapters) {
            try {
                const healthy = await adapter.healthCheck?.();
                results[platformId] = { healthy: healthy !== false, status: BRIDGE_STATUS.CONNECTED };
            } catch (error) {
                results[platformId] = { healthy: false, status: BRIDGE_STATUS.ERROR, error: error.message };
            }
        }

        return results;
    }
}

// Export singleton instance
const bridgeCore = new UniversalBridgeCore();

module.exports = {
    bridgeCore,
    UniversalBridgeCore,
    BRIDGE_EVENTS,
    BRIDGE_STATUS,
};
