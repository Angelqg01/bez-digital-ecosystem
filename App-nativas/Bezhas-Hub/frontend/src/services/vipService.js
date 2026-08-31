/**
 * VIP Subscription Service
 * Gestiona suscripciones VIP con Stripe, Crypto y Transferencia Bancaria
 */

import axios from 'axios';
import {
    buildBankTransferInstructions,
    getVipStripeLink
} from '../config/bezhasPaymentConfig';

const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
});

// Interceptor para añadir token JWT
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/**
 * Configuración de tiers VIP (sincronizado con backend)
 */
export const VIP_TIERS = {
    STARTER: { priceId: null, price: 0 },
    CREATOR: {
        priceId: 'price_creator_monthly',
        price: 19.99,
        yearlyPrice: 199.99,
        bezPrice: 400,
        tokenLock: 5000
    },
    BUSINESS: {
        priceId: 'price_business_monthly',
        price: 99.99,
        yearlyPrice: 999.99,
        bezPrice: 2000,
        tokenLock: 25000
    },
    ENTERPRISE: {
        priceId: 'price_enterprise_monthly',
        price: 299.99,
        yearlyPrice: 2999.99,
        bezPrice: 6000,
        tokenLock: 100000
    }
};

/**
 * Crear sesión de Stripe para suscripción VIP
 * @param {string} tierId - ID del tier (creator, business, enterprise)
 * @param {string} billingPeriod - 'monthly' | 'yearly' | 'lifetime'
 * @param {string} email - Email del usuario
 * @param {string} walletAddress - Dirección de wallet
 */
export async function createVIPSubscriptionSession(tierId, billingPeriod = 'monthly', email, walletAddress) {
    try {
        // Usar la ruta de VIP del backend
        const response = await api.post('/vip/create-subscription-session', {
            tier: tierId.toLowerCase(),
            email,
            walletAddress,
            billingPeriod
        });

        if (response.data.success && response.data.url) {
            // Redirigir a Stripe Checkout
            window.location.href = response.data.url;
            return response.data;
        }

        throw new Error(response.data.message || 'Error al crear sesión de pago');
    } catch (error) {
        console.error('VIP Subscription Error:', error);
        const fallbackUrl = getVipStripeLink(tierId);
        window.location.href = fallbackUrl;
        return {
            success: true,
            url: fallbackUrl,
            provider: 'stripe_payment_link',
            fallback: true
        };
    }
}

/**
 * Crear sesión de Stripe para suscripción (ruta alternativa stripe.routes)
 */
export async function createStripeSubscriptionSession(plan, email) {
    try {
        const response = await api.post('/stripe/create-subscription-session', {
            plan,
            email
        });

        if (response.data.success && response.data.url) {
            window.location.href = response.data.url;
            return response.data;
        }

        throw new Error(response.data.error || 'Error al crear sesión');
    } catch (error) {
        console.error('Stripe Subscription Error:', error);
        throw error;
    }
}

/**
 * Obtener configuración de Stripe (publishable key)
 */
export async function getStripeConfig() {
    try {
        const response = await api.get('/stripe/config');
        return response.data;
    } catch (error) {
        console.error('Error getting Stripe config:', error);
        throw error;
    }
}

/**
 * Obtener estado VIP del usuario
 */
export async function getVIPStatus() {
    try {
        const response = await api.get('/vip/status');
        return response.data;
    } catch (error) {
        console.error('Error getting VIP status:', error);
        return { isVIP: false, tier: 'STARTER' };
    }
}

/**
 * Obtener suscripciones del usuario
 */
export async function getUserSubscriptions() {
    try {
        const response = await api.get('/vip/my-subscriptions');
        return response.data;
    } catch (error) {
        console.error('Error getting subscriptions:', error);
        return { subscriptions: [] };
    }
}

/**
 * Cancelar suscripción VIP
 */
export async function cancelSubscription(subscriptionId, immediate = false) {
    try {
        const response = await api.post('/vip/cancel-subscription', {
            subscriptionId,
            immediate
        });
        return response.data;
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        throw error;
    }
}

/**
 * Obtener detalles de cuenta bancaria para transferencia
 */
export async function getBankDetails() {
    try {
        const response = await api.get('/fiat/bank-details');
        return response.data;
    } catch (error) {
        console.error('Error getting bank details:', error);
        const reference = 'VIP-{walletAddress}';
        return {
            success: true,
            bankDetails: buildBankTransferInstructions(reference)
        };
    }
}

/**
 * Crear payment intent para pago con crypto (BEZ)
 * @param {number} bezAmount - Cantidad de BEZ
 * @param {string} walletAddress - Dirección de wallet
 * @param {string} tierId - ID del tier
 */
export async function createCryptoPayment(bezAmount, walletAddress, tierId) {
    try {
        const response = await api.post('/payment/crypto/vip-subscription', {
            bezAmount,
            walletAddress,
            tier: tierId.toLowerCase()
        });
        return response.data;
    } catch (error) {
        console.error('Error creating crypto payment:', error);
        throw error;
    }
}

/**
 * Verificar estado de sesión de Stripe
 */
export async function checkSessionStatus(sessionId) {
    try {
        const response = await api.get(`/payment/session-status/${sessionId}`);
        return response.data;
    } catch (error) {
        console.error('Error checking session status:', error);
        throw error;
    }
}

export default {
    VIP_TIERS,
    createVIPSubscriptionSession,
    createStripeSubscriptionSession,
    getStripeConfig,
    getVIPStatus,
    getUserSubscriptions,
    cancelSubscription,
    getBankDetails,
    createCryptoPayment,
    checkSessionStatus
};
