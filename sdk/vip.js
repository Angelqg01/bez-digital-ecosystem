/**
 * ============================================================================
 * BEZHAS SDK - VIP SUBSCRIPTIONS MODULE
 * ============================================================================
 * 
 * Módulo para gestionar suscripciones VIP de BeZhas
 * Integra con Stripe para pagos recurrentes
 */

const axios = require('axios');

class VIPSubscriptionManager {
    /**
     * @param {Object} config - Configuración del SDK
     * @param {string} config.apiUrl - URL del backend API
     * @param {string} config.apiKey - API Key para autenticación
     */
    constructor(config) {
        this.apiUrl = config.apiUrl || 'http://localhost:3001';
        this.apiKey = config.apiKey;
        this.axios = axios.create({
            baseURL: this.apiUrl,
            headers: {
                'Content-Type': 'application/json',
                ...(this.apiKey && { 'X-API-Key': this.apiKey })
            }
        });
    }

    /**
     * Obtiene información de todos los tiers VIP disponibles
     * @returns {Promise<Object>} Información de tiers
     */
    async getTiers() {
        try {
            const response = await this.axios.get('/api/vip/tiers');
            return {
                success: true,
                tiers: response.data.tiers
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Crea una sesión de suscripción VIP
     * @param {string} tier - Tier de suscripción (bronze, silver, gold, platinum)
     * @param {string} userEmail - Email del usuario
     * @param {Object} metadata - Metadata adicional
     * @returns {Promise<Object>} URL de checkout de Stripe
     */
    async createSubscription(tier, userEmail, metadata = {}) {
        try {
            const response = await this.axios.post('/api/vip/create-subscription-session', {
                tier,
                email: userEmail,
                metadata
            });

            return {
                success: true,
                checkoutUrl: response.data.url,
                sessionId: response.data.sessionId,
                tier
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Cancela una suscripción VIP
     * @param {string} subscriptionId - ID de la suscripción de Stripe
     * @param {boolean} immediate - Si cancelar inmediatamente o al final del periodo
     * @returns {Promise<Object>} Resultado de la cancelación
     */
    async cancelSubscription(subscriptionId, immediate = false) {
        try {
            const response = await this.axios.post('/api/vip/cancel-subscription', {
                subscriptionId,
                immediate
            });

            return {
                success: true,
                subscription: response.data.subscription,
                message: immediate
                    ? 'Subscription cancelled immediately'
                    : 'Subscription will cancel at period end'
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Actualiza (upgrade/downgrade) una suscripción VIP
     * @param {string} subscriptionId - ID de la suscripción actual
     * @param {string} newTier - Nuevo tier
     * @returns {Promise<Object>} Resultado del upgrade
     */
    async upgradeSubscription(subscriptionId, newTier) {
        try {
            const response = await this.axios.post('/api/vip/upgrade-subscription', {
                subscriptionId,
                newTier
            });

            return {
                success: true,
                subscription: response.data.subscription,
                prorated: response.data.prorated,
                message: `Subscription upgraded to ${newTier}`
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Obtiene las suscripciones del usuario actual
     * @returns {Promise<Object>} Lista de suscripciones
     */
    async getMySubscriptions() {
        try {
            const response = await this.axios.get('/api/vip/my-subscriptions');

            return {
                success: true,
                subscriptions: response.data.subscriptions
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Verifica el estado VIP del usuario
     * @returns {Promise<Object>} Estado VIP
     */
    async checkVIPStatus() {
        try {
            const response = await this.axios.get('/api/vip/status');

            return {
                success: true,
                isVIP: response.data.isVIP,
                tier: response.data.tier,
                expiresAt: response.data.expiresAt,
                benefits: response.data.benefits
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Verifica una sesión de checkout después del pago
     * @param {string} sessionId - ID de la sesión de Stripe
     * @returns {Promise<Object>} Información de la sesión
     */
    async verifySession(sessionId) {
        try {
            const response = await this.axios.get(`/api/vip/verify-session/${sessionId}`);

            return {
                success: true,
                session: response.data.session,
                subscriptionActivated: response.data.subscriptionActivated
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Obtiene el historial de pagos VIP
     * @returns {Promise<Object>} Historial de pagos
     */
    async getPaymentHistory() {
        try {
            const response = await this.axios.get('/api/vip/payment-history');

            return {
                success: true,
                payments: response.data.payments
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }
}

module.exports = VIPSubscriptionManager;
