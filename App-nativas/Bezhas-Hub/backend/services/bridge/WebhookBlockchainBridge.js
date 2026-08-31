const { bridgeCore, BRIDGE_EVENTS } = require('../../bridge/core/bridgeCore');
const blockchainService = require('../blockchain.service');
const User = require('../../models/pg/User');
const logger = require('../../utils/logger');
const skillAutomator = require('../automation/skillAutomator.service');
const rwaDistributionService = require('../rwa-distribution.service');

/**
 * Webhook Blockchain Bridge - BeZhas
 * 
 * Este servicio vincula los eventos del Puente Universal con acciones en la Blockchain.
 * Automatiza el pago de regalías, recompensas por ventas y registro de transacciones RWA
 * basándose en los webhooks entrantes de plataformas externas (Airbnb, Vinted, etc).
 */
class WebhookBlockchainBridge {
    constructor() {
        this.initialized = false;
    }

    /**
     * Inicia la escucha de eventos del Bridge Core
     */
    init() {
        if (this.initialized) return;

        logger.info('🔗 Iniciando Webhook-Blockchain Bridge...');

        // Escuchar cuando se crea un pedido en cualquier plataforma del bridge
        bridgeCore.on(BRIDGE_EVENTS.ORDER_CREATED, async (data) => {
            await this.handleOrderCreated(data);
        });

        // Escuchar cuando se recibe un pago verificado
        bridgeCore.on(BRIDGE_EVENTS.PAYMENT_RECEIVED, async (data) => {
            await this.handlePaymentReceived(data);
        });

        this.initialized = true;
    }

    /**
     * Maneja la creación de un pedido (Order Created)
     * Registra la intención de venta en el Audit Log y prepara el reward.
     */
    async handleOrderCreated({ platformId, order }) {
        try {
            logger.info({ platformId, orderId: order.beZhasOrderId }, '📦 Pedido externo detectado por el Bridge');

            // 1. Identificar al usuario dueño del bridge (basado en metadatos o API Key)
            // Para el MVP, buscamos al usuario por el seller info si está disponible
            const sellerWallet = order.seller?.walletAddress || process.env.TREASURY_WALLET_ADDRESS;
            
            if (sellerWallet) {
                logger.info(`💰 Preparando recompensa para el vendedor: ${sellerWallet}`);
                
                // 2. Ejecutar acción en Blockchain: Mint Reputation o Registrar Venta
                // En BeZhas, una venta externa exitosa otorga "Puntos de Reputación" on-chain
                const tx = await blockchainService.mintReputation(sellerWallet, 10); 
                
                logger.info({ txHash: tx.hash }, '✅ Reputación otorgada on-chain por venta externa');

                // 3. Registrar optimización en SkillAutomator
                await skillAutomator.registerOptimization({
                    area: 'bridge',
                    before: `Venta en ${platformId} sin registro on-chain`,
                    after: `Venta ${order.beZhasOrderId} vinculada a wallet ${sellerWallet} y recompensada`,
                    impact: 'Sincronización total entre ventas off-chain y activos on-chain'
                });
            }
        } catch (error) {
            logger.error({ error }, '❌ Error procesando orden en el Webhook-Blockchain Bridge');
        }
    }

    /**
     * Maneja la recepción de un pago confirmado
     * Realiza el settlement real en la blockchain (Transferencia de BEZ o RWA Dividends)
     */
    async handlePaymentReceived({ platformId, payment }) {
        try {
            logger.info({ platformId, paymentId: payment.id }, '💳 Pago confirmado en plataforma externa');

            // Si es un pago de Airbnb, podríamos distribuir dividendos a los holders del RWA
            if (platformId === 'airbnb' || payment.dynamic && platformId === 'airbnb') {
                logger.info(`🏠 Iniciando distribución de dividendos RWA para la propiedad ${payment.listingId || payment.id}`);
                
                // Llamada al servicio de distribución real
                const res = await rwaDistributionService.distributeDividends(payment.listingId || payment.id, payment.amount);
                
                if (res.success) {
                    logger.info(`✅ Dividendos distribuidos exitosamente: ${payment.amount} BEZ`);
                }
            }
        } catch (error) {
            logger.error({ error }, '❌ Error procesando pago en el Webhook-Blockchain Bridge');
        }
    }
}

module.exports = new WebhookBlockchainBridge();
