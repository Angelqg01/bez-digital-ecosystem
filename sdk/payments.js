/**
 * ============================================================================
 * BEZHAS SDK - PAYMENTS MODULE
 * ============================================================================
 * 
 * Módulo para gestionar pagos con criptomonedas y Stripe
 * Integra con el servicio de pagos crypto del backend
 */

const axios = require('axios');
const {
    STRIPE_PAYMENT_LINKS,
    getStripePaymentLink,
} = require('./stripe-payment-links');
const {
    BANK_TRANSFER_DETAILS,
    buildBankTransferInstructions,
} = require('./bank-transfer-details');

class PaymentsManager {
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
     * Devuelve el catálogo local de Stripe Payment Links usado por BeZhas Pay.
     * @returns {Object} Catálogo de enlaces Stripe por situación de uso
     */
    getStripePaymentLinks() {
        return STRIPE_PAYMENT_LINKS;
    }

    /**
     * Obtiene un Stripe Payment Link por caso de uso.
     * @param {string} useCase - starter, pro, enterprise, token_purchase, be_vip, etc.
     * @returns {Object} Link configurado
     */
    getStripePaymentLink(useCase = 'token_purchase') {
        return getStripePaymentLink(useCase);
    }

    /**
     * Devuelve la cuenta bancaria receptora de BeZhas para transferencias FIAT.
     * @param {string} [reference] - Referencia de pago generada por el backend.
     * @returns {Object} Datos bancarios o instrucciones con referencia.
     */
    getBankTransferDetails(reference) {
        return reference ? buildBankTransferInstructions(reference) : BANK_TRANSFER_DETAILS;
    }

    /**
     * Obtiene cotización para compra de BEZ-Coins
     * @param {number} amount - Cantidad a convertir
     * @param {string} fromCurrency - Moneda de origen (USD, USDT, USDC, MATIC, etc.)
     * @param {string} toCurrency - Moneda de destino (BEZ)
     * @returns {Promise<Object>} Cotización
     */
    async getQuote(amount, fromCurrency, toCurrency = 'BEZ') {
        try {
            const response = await this.axios.post('/api/crypto/quote', {
                amount,
                currency: fromCurrency
            });

            return {
                success: true,
                quote: response.data.quote
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Procesa pago con Stripe
     * @param {string} userId - ID del usuario
     * @param {string} walletAddress - Dirección de wallet
     * @param {number} amountFiat - Cantidad en fiat (USD)
     * @param {string} email - Email del usuario
     * @returns {Promise<Object>} URL de checkout
     */
    async processStripePayment(userId, walletAddress, amountFiat, email, useCase = 'token_purchase') {
        try {
            const response = await this.axios.post('/api/gateway/v1/payments/buy', {
                walletAddress,
                amountUSD: amountFiat,
                paymentMethod: 'card',
                stripeUseCase: useCase,
                email,
            });

            return {
                success: true,
                paymentId: response.data.paymentId,
                checkoutUrl: response.data.checkoutUrl,
                provider: response.data.provider,
                stripeUseCase: response.data.stripeUseCase,
                stripeLabel: response.data.stripeLabel,
                nextAction: response.data.nextAction,
                userId
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Inicia una compra FIAT por la pasarela propia de BeZhas usando Stripe Links.
     * @param {Object} params
     * @param {string} params.walletAddress
     * @param {number} params.amountUSD
     * @param {string} [params.useCase] - token_purchase, starter, pro, enterprise, be_vip...
     * @param {string} [params.email]
     * @returns {Promise<Object>} Orden interna + checkoutUrl Stripe
     */
    async initiateFiatPayment({ walletAddress, amountUSD, useCase = 'token_purchase', email }) {
        try {
            const response = await this.axios.post('/api/gateway/v1/payments/buy', {
                walletAddress,
                amountUSD,
                paymentMethod: 'card',
                stripeUseCase: useCase,
                email
            });

            return {
                success: true,
                paymentId: response.data.paymentId,
                status: response.data.status,
                checkoutUrl: response.data.checkoutUrl,
                provider: response.data.provider,
                stripeUseCase: response.data.stripeUseCase,
                stripeLabel: response.data.stripeLabel,
                nextAction: response.data.nextAction
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Inicia una compra FIAT manual por transferencia bancaria.
     * @param {Object} params
     * @param {string} params.walletAddress
     * @param {number} params.amountUSD
     * @returns {Promise<Object>} Orden interna + instrucciones bancarias.
     */
    async initiateBankTransferPayment({ walletAddress, amountUSD }) {
        try {
            const response = await this.axios.post('/api/gateway/v1/payments/buy', {
                walletAddress,
                amountUSD,
                paymentMethod: 'bank'
            });

            return {
                success: true,
                paymentId: response.data.paymentId,
                status: response.data.status,
                provider: response.data.provider,
                bankTransfer: response.data.bankTransfer,
                nextAction: response.data.nextAction
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Registra una compra BEZ cripto en la pasarela propia BeZhas Gateway.
     * Útil para apps que quieren el mismo workflow de orden interna que FIAT/banco.
     * @param {Object} params
     * @param {string} params.walletAddress
     * @param {number} params.amountUSD
     * @returns {Promise<Object>} Orden interna pendiente de confirmación on-chain.
     */
    async initiateGatewayCryptoPayment({ walletAddress, amountUSD }) {
        try {
            const response = await this.axios.post('/api/gateway/v1/payments/buy', {
                walletAddress,
                amountUSD,
                paymentMethod: 'crypto'
            });

            return {
                success: true,
                paymentId: response.data.paymentId,
                status: response.data.status,
                provider: response.data.provider,
                nextAction: response.data.nextAction
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Verifica el estado de un pago
     * @param {string} sessionId - ID de la sesión de Stripe
     * @returns {Promise<Object>} Estado del pago
     */
    async checkPaymentStatus(sessionId) {
        try {
            const response = await this.axios.get(`/api/stripe/session/${sessionId}`);

            return {
                success: true,
                status: response.data.session.status,
                amount: response.data.session.amountTotal,
                currency: response.data.session.currency
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Obtiene balance de wallet
     * @param {string} walletAddress - Dirección de wallet
     * @returns {Promise<Object>} Balance de BEZ
     */
    async getWalletBalance(walletAddress) {
        try {
            const response = await this.axios.get(`/api/crypto/balance/${walletAddress}`);

            return {
                success: true,
                balance: response.data.balance,
                walletAddress: response.data.walletAddress
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Inicia pago con criptomonedas
     * @param {string} walletAddress - Dirección de wallet del usuario
     * @param {number} amount - Cantidad de crypto a pagar
     * @param {string} currency - Criptomoneda (USDT, USDC, MATIC)
     * @returns {Promise<Object>} Instrucciones de pago
     */
    async initiateCryptoPayment(walletAddress, amount, currency) {
        try {
            const response = await this.axios.post('/api/crypto/initiate', {
                walletAddress,
                amount,
                currency
            });

            return {
                success: true,
                paymentType: 'crypto',
                currency,
                amount,
                tokenAmount: response.data.tokenAmount,
                instructions: response.data.instructions || {},
                requiresApproval: response.data.requiresApproval || false,
                approvalData: response.data.approvalData
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Verifica estado de transacción crypto
     * @param {string} txHash - Hash de la transacción
     * @returns {Promise<Object>} Estado de la transacción
     */
    async checkTransactionStatus(txHash) {
        try {
            const response = await this.axios.get(`/api/crypto/status/${txHash}`);

            return {
                success: true,
                status: response.data.status,
                blockNumber: response.data.blockNumber,
                transactionHash: response.data.transactionHash
            };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.message
            };
        }
    }

    /**
     * Obtiene historial de pagos
     * @returns {Promise<Object>} Historial de pagos
     */
    async getPaymentHistory() {
        try {
            const response = await this.axios.get('/api/payments/history');

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

    /**
     * Obtiene metadata del Core blockchain que respalda BEZ-Coin.
     * Útil para que cualquier SubApp confirme chainId, contrato BEZ y endpoints unificados.
     */
    async getBillingCoreMetadata() {
        try {
            const response = await this.axios.get('/api/billing/core');
            return { success: true, ...response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Lee el balance BEZ directamente desde BeZhas-Blockchain Core.
     * @param {string} walletAddress
     */
    async getCoreBEZBalance(walletAddress) {
        try {
            const response = await this.axios.get(`/api/billing/core/balance/${walletAddress}`);
            return { success: true, ...response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Obtiene paquetes oficiales de creditos BEZ-Coin para todas las SubApp's.
     */
    async getBEZCreditPackages() {
        try {
            const response = await this.axios.get('/api/billing/packages');
            return { success: true, ...response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Inicia checkout de un paquete oficial de creditos BEZ-Coin.
     * @param {string} packageId starter, growth, pro, agency
     */
    async checkoutBEZCreditPackage(packageId) {
        try {
            const response = await this.axios.post(`/api/billing/packages/${packageId}/checkout`);
            return { success: true, ...response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Obtiene saldo interno unificado para FIAT/BEZ credits.
     */
    async getUnifiedBillingBalance() {
        try {
            const response = await this.axios.get('/api/billing/balance');
            return { success: true, ...response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Estima el coste de una operación IA en créditos BEZ-Coin antes de ejecutarla.
     * @param {string} model
     * @param {Object} usage
     */
    async estimateAIUsage(model, usage) {
        try {
            const response = await this.axios.post('/api/billing/ai/estimate', { model, usage });
            return { success: true, ...response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Cobra consumo IA real contra el saldo BEZ interno y registra auditoría.
     * @param {Object} params
     * @param {string} params.model
     * @param {Object} params.usage
     * @param {string} [params.feature]
     * @param {string} [params.projectId]
     */
    async chargeAIUsage(params) {
        try {
            const response = await this.axios.post('/api/billing/ai/charge', params);
            return { success: true, ...response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Resumen de consumo IA para dashboard de usuarios/SubApp's.
     */
    async getAIUsageSummary() {
        try {
            const response = await this.axios.get('/api/billing/ai/summary');
            return { success: true, ...response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Obtiene el manifiesto del motor M-TFC conectado a BeZhas Core/API.
     */
    async getMTFCManifest() {
        try {
            const response = await this.axios.get('/api/mtfc/manifest');
            return { success: true, ...response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Evalúa una muestra del Motor Adimensional de Transición de Fase.
     * @param {Object} payload
     */
    async evaluateMTFC(payload) {
        try {
            const response = await this.axios.post('/api/mtfc/evaluate', payload);
            return { success: true, ...response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Evalúa un lote de muestras M-TFC para dashboards o automatizaciones.
     * @param {Array<Object>} samples
     */
    async evaluateMTFCBatch(samples) {
        try {
            const response = await this.axios.post('/api/mtfc/batch', { samples });
            return { success: true, ...response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error || error.message
            };
        }
    }

    /**
     * Estima el coste en BEZ-Coin de una ejecución M-TFC antes de lanzarla.
     * @param {Object} payload
     * @param {number} payload.operations
     * @param {'bulk'|'standard'|'realtime'} [payload.priority]
     */
    async estimateMTFCCompute(payload) {
        try {
            const response = await this.axios.post('/api/mtfc/estimate', payload);
            return { success: true, ...response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.message || error.response?.data?.error || error.message
            };
        }
    }
}

module.exports = PaymentsManager;
