/**
 * BeZhas Enterprise SDK
 * Integraciones con empresas de logística, marketplaces y hotelería
 * @version 2.0.0
 */

import axios from 'axios';
import { ethers } from 'ethers';

export class BeZhasEnterpriseSDK {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl || process.env.REACT_APP_API_URL || 'http://localhost:5000';
        this.token = config.token || null;
        this.chainId = config.chainId || 80002; // Amoy testnet
        this.contracts = config.contracts || {};

        // Configuración de APIs externas
        this.maerskApiKey = config.maerskApiKey || process.env.MAERSK_API_KEY;
        this.tntApiKey = config.tntApiKey || process.env.TNT_API_KEY;
        this.vintedApiKey = config.vintedApiKey || process.env.VINTED_API_KEY;
        this.moonpayApiKey = config.moonpayApiKey || process.env.MOONPAY_API_KEY;

        // Cliente HTTP configurado
        this.client = axios.create({
            baseURL: this.apiUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.token ? `Bearer ${this.token}` : ''
            }
        });
    }

    // ==========================================
    // 1. LOGÍSTICA DE CONTAINERS - MAERSK
    // ==========================================

    maersk = {
        /**
         * Rastrear contenedor Maersk
         * @param {string} containerNumber - Número de contenedor
         */
        trackContainer: async (containerNumber) => {
            try {
                const response = await this.client.post('/api/logistics/maersk/track', {
                    containerNumber,
                    includeEvents: true,
                    includeLocation: true
                });

                return {
                    success: true,
                    container: response.data.container,
                    status: response.data.status,
                    location: response.data.location,
                    events: response.data.events,
                    eta: response.data.estimatedArrival
                };
            } catch (error) {
                return this._handleError('Maersk Track Container', error);
            }
        },

        /**
         * Reservar envío con Maersk
         * @param {Object} shipmentData - Datos del envío
         */
        bookShipment: async (shipmentData) => {
            try {
                const response = await this.client.post('/api/logistics/maersk/book', {
                    origin: shipmentData.origin,
                    destination: shipmentData.destination,
                    containerType: shipmentData.containerType, // 20ft, 40ft, 40HC
                    cargo: {
                        description: shipmentData.cargo.description,
                        weight: shipmentData.cargo.weight,
                        value: shipmentData.cargo.value,
                        hsCode: shipmentData.cargo.hsCode
                    },
                    pickupDate: shipmentData.pickupDate,
                    deliveryDate: shipmentData.deliveryDate,
                    incoterms: shipmentData.incoterms || 'FOB'
                });

                return {
                    success: true,
                    bookingNumber: response.data.bookingNumber,
                    containerNumber: response.data.containerNumber,
                    price: response.data.price,
                    currency: response.data.currency,
                    route: response.data.route,
                    estimatedTransitTime: response.data.transitTime,
                    documents: response.data.documents
                };
            } catch (error) {
                return this._handleError('Maersk Book Shipment', error);
            }
        },

        /**
         * Obtener cotización de envío
         * @param {Object} route - Ruta del envío
         */
        getQuote: async (route) => {
            try {
                const response = await this.client.post('/api/logistics/maersk/quote', {
                    origin: route.origin,
                    destination: route.destination,
                    containerType: route.containerType,
                    weight: route.weight,
                    volume: route.volume
                });

                return {
                    success: true,
                    quote: response.data.price,
                    currency: response.data.currency,
                    validUntil: response.data.validUntil,
                    transitTime: response.data.transitTime,
                    services: response.data.includedServices
                };
            } catch (error) {
                return this._handleError('Maersk Get Quote', error);
            }
        },

        /**
         * Obtener horarios de navegación
         * @param {Object} route - Origen y destino
         */
        getSchedule: async (route) => {
            try {
                const response = await this.client.post('/api/logistics/maersk/schedule', {
                    fromPort: route.origin,
                    toPort: route.destination,
                    departureDate: route.date
                });

                return {
                    success: true,
                    schedules: response.data.schedules
                };
            } catch (error) {
                return this._handleError('Maersk Get Schedule', error);
            }
        }
    };

    // ==========================================
    // 2. LOGÍSTICA EXPRESS - TNT
    // ==========================================

    tnt = {
        /**
         * Crear envío TNT Express
         * @param {Object} shipmentData - Datos del envío
         */
        createShipment: async (shipmentData) => {
            try {
                const response = await this.client.post('/api/logistics/tnt/create', {
                    sender: {
                        name: shipmentData.sender.name,
                        company: shipmentData.sender.company,
                        address: shipmentData.sender.address,
                        city: shipmentData.sender.city,
                        country: shipmentData.sender.country,
                        postalCode: shipmentData.sender.postalCode,
                        phone: shipmentData.sender.phone,
                        email: shipmentData.sender.email
                    },
                    receiver: {
                        name: shipmentData.receiver.name,
                        company: shipmentData.receiver.company,
                        address: shipmentData.receiver.address,
                        city: shipmentData.receiver.city,
                        country: shipmentData.receiver.country,
                        postalCode: shipmentData.receiver.postalCode,
                        phone: shipmentData.receiver.phone,
                        email: shipmentData.receiver.email
                    },
                    package: {
                        weight: shipmentData.package.weight,
                        length: shipmentData.package.length,
                        width: shipmentData.package.width,
                        height: shipmentData.package.height,
                        description: shipmentData.package.description,
                        value: shipmentData.package.value
                    },
                    service: shipmentData.service || 'express', // express, economy, overnight
                    insurance: shipmentData.insurance || false
                });

                return {
                    success: true,
                    trackingNumber: response.data.trackingNumber,
                    label: response.data.labelUrl,
                    price: response.data.price,
                    currency: response.data.currency,
                    estimatedDelivery: response.data.estimatedDelivery
                };
            } catch (error) {
                return this._handleError('TNT Create Shipment', error);
            }
        },

        /**
         * Rastrear paquete TNT
         * @param {string} trackingNumber - Número de seguimiento
         */
        trackPackage: async (trackingNumber) => {
            try {
                const response = await this.client.post('/api/logistics/tnt/track', {
                    trackingNumber
                });

                return {
                    success: true,
                    status: response.data.status,
                    location: response.data.currentLocation,
                    events: response.data.trackingEvents,
                    estimatedDelivery: response.data.estimatedDelivery,
                    delivered: response.data.delivered,
                    deliveryDate: response.data.deliveryDate,
                    signature: response.data.signature
                };
            } catch (error) {
                return this._handleError('TNT Track Package', error);
            }
        },

        /**
         * Generar etiqueta de envío
         * @param {string} shipmentId - ID del envío
         */
        generateLabel: async (shipmentId) => {
            try {
                const response = await this.client.post('/api/logistics/tnt/label', {
                    shipmentId,
                    format: 'PDF' // PDF, PNG, ZPL
                });

                return {
                    success: true,
                    labelUrl: response.data.labelUrl,
                    labelData: response.data.labelData
                };
            } catch (error) {
                return this._handleError('TNT Generate Label', error);
            }
        }
    };

    // ==========================================
    // 3. MARKETPLACE - VINTED INTEGRATION
    // ==========================================

    vinted = {
        /**
         * Publicar artículo en Vinted
         * @param {Object} item - Datos del artículo
         */
        listItem: async (item) => {
            try {
                const response = await this.client.post('/api/marketplace/vinted/list', {
                    title: item.title,
                    description: item.description,
                    price: item.price,
                    currency: item.currency || 'EUR',
                    category: item.category,
                    brand: item.brand,
                    size: item.size,
                    condition: item.condition, // new, excellent, good, satisfactory
                    color: item.color,
                    photos: item.photos, // Array de URLs
                    shipping: {
                        method: item.shipping?.method || 'custom',
                        price: item.shipping?.price || 0
                    },
                    autoAcceptEnabled: item.autoAccept || false,
                    bezhasIntegration: true
                });

                return {
                    success: true,
                    vintedId: response.data.vintedItemId,
                    bezhasId: response.data.bezhasItemId,
                    url: response.data.vintedUrl,
                    status: response.data.status
                };
            } catch (error) {
                return this._handleError('Vinted List Item', error);
            }
        },

        /**
         * Sincronizar inventario con Vinted
         */
        syncInventory: async () => {
            try {
                const response = await this.client.post('/api/marketplace/vinted/sync');

                return {
                    success: true,
                    itemsSynced: response.data.itemsSynced,
                    newItems: response.data.newItems,
                    updatedItems: response.data.updatedItems,
                    soldItems: response.data.soldItems
                };
            } catch (error) {
                return this._handleError('Vinted Sync Inventory', error);
            }
        },

        /**
         * Procesar venta de Vinted con envío automático
         * @param {string} saleId - ID de la venta
         */
        handleSale: async (saleId) => {
            try {
                const response = await this.client.post('/api/marketplace/vinted/sale', {
                    saleId,
                    autoShip: true,
                    generateLabel: true,
                    notifyBuyer: true
                });

                return {
                    success: true,
                    orderId: response.data.orderId,
                    trackingNumber: response.data.trackingNumber,
                    shippingLabel: response.data.labelUrl,
                    buyerNotified: response.data.buyerNotified,
                    estimatedDelivery: response.data.estimatedDelivery
                };
            } catch (error) {
                return this._handleError('Vinted Handle Sale', error);
            }
        },

        /**
         * Configurar envío automático para Vinted
         * @param {Object} config - Configuración de envío
         */
        configureAutoShipping: async (config) => {
            try {
                const response = await this.client.post('/api/marketplace/vinted/auto-shipping', {
                    enabled: config.enabled,
                    defaultCarrier: config.carrier || 'tnt', // tnt, gls, mrw
                    autoGenerateLabel: config.autoLabel !== false,
                    autoNotifyBuyer: config.autoNotify !== false,
                    defaultPackaging: config.packaging || 'envelope',
                    insuranceDefault: config.insurance || false
                });

                return {
                    success: true,
                    configuration: response.data.config
                };
            } catch (error) {
                return this._handleError('Vinted Configure Auto Shipping', error);
            }
        }
    };

    // ==========================================
    // 4. SISTEMA VIP COMPLETO
    // ==========================================

    vip = {
        /**
         * Suscribirse al sistema VIP
         * @param {Object} plan - Plan de suscripción
         */
        subscribe: async (plan) => {
            try {
                const response = await this.client.post('/api/vip/subscribe', {
                    tier: plan.tier, // bronze, silver, gold, platinum
                    duration: plan.duration, // meses
                    paymentMethod: plan.paymentMethod, // stripe, bezcoin
                    autoRenew: plan.autoRenew !== false
                });

                return {
                    success: true,
                    subscriptionId: response.data.subscriptionId,
                    tier: response.data.tier,
                    startDate: response.data.startDate,
                    endDate: response.data.endDate,
                    benefits: response.data.benefits,
                    nftBadge: response.data.nftBadgeId
                };
            } catch (error) {
                return this._handleError('VIP Subscribe', error);
            }
        },

        /**
         * Mejorar nivel VIP
         * @param {string} newTier - Nuevo nivel
         */
        upgrade: async (newTier) => {
            try {
                const response = await this.client.post('/api/vip/upgrade', {
                    tier: newTier
                });

                return {
                    success: true,
                    newTier: response.data.tier,
                    benefits: response.data.benefits,
                    proRatedCost: response.data.proRatedCost
                };
            } catch (error) {
                return this._handleError('VIP Upgrade', error);
            }
        },

        /**
         * Obtener beneficios del nivel VIP
         * @param {string} tier - Nivel VIP
         */
        getBenefits: async (tier) => {
            const benefits = {
                bronze: {
                    discount: 5,
                    shippingDiscount: 10,
                    prioritySupport: false,
                    earlyAccess: false,
                    nftBonus: 0,
                    freeShipping: 'none',
                    monthlyPrice: 9.99,
                    features: [
                        '5% descuento en todas las compras',
                        '10% descuento en envíos',
                        'Badge NFT exclusivo'
                    ]
                },
                silver: {
                    discount: 10,
                    shippingDiscount: 20,
                    prioritySupport: true,
                    earlyAccess: true,
                    nftBonus: 5,
                    freeShipping: 'national',
                    monthlyPrice: 19.99,
                    features: [
                        '10% descuento en todas las compras',
                        '20% descuento en envíos',
                        'Envío gratis nacional',
                        'Soporte prioritario',
                        'Acceso anticipado a nuevos productos',
                        '5% bonus en compra de BEZ-Coin',
                        'Badge NFT Silver exclusivo'
                    ]
                },
                gold: {
                    discount: 20,
                    shippingDiscount: 30,
                    prioritySupport: true,
                    earlyAccess: true,
                    nftBonus: 15,
                    freeShipping: 'international',
                    concierge: true,
                    loungeAccess: true,
                    monthlyPrice: 49.99,
                    features: [
                        '20% descuento en todas las compras',
                        '30% descuento en envíos',
                        'Envío gratis internacional',
                        'Soporte prioritario 24/7',
                        'Concierge service',
                        'Acceso a lounges exclusivos',
                        'Acceso anticipado VIP',
                        '15% bonus en compra de BEZ-Coin',
                        'Descuentos exclusivos en hoteles',
                        'Badge NFT Gold exclusivo'
                    ]
                },
                platinum: {
                    discount: 30,
                    shippingDiscount: 50,
                    prioritySupport: true,
                    earlyAccess: true,
                    nftBonus: 25,
                    freeShipping: 'worldwide',
                    concierge: true,
                    loungeAccess: true,
                    personalShopper: true,
                    exclusiveEvents: true,
                    monthlyPrice: 99.99,
                    features: [
                        '30% descuento en todas las compras',
                        '50% descuento en envíos',
                        'Envío gratis mundial',
                        'Soporte prioritario dedicado 24/7',
                        'Concierge service premium',
                        'Personal shopper dedicado',
                        'Acceso a eventos exclusivos',
                        'Acceso a lounges VIP worldwide',
                        '25% bonus en compra de BEZ-Coin',
                        'Descuentos premium en hoteles y viajes',
                        'Regalos mensuales exclusivos',
                        'Badge NFT Platinum exclusivo',
                        'Invitaciones a eventos BeZhas'
                    ]
                }
            };

            return {
                success: true,
                tier: tier,
                benefits: benefits[tier] || benefits.bronze
            };
        },

        /**
         * Obtener estado VIP del usuario
         */
        getStatus: async () => {
            try {
                const response = await this.client.get('/api/vip/status');

                return {
                    success: true,
                    tier: response.data.tier,
                    isActive: response.data.isActive,
                    startDate: response.data.startDate,
                    endDate: response.data.endDate,
                    benefits: response.data.benefits,
                    savings: response.data.totalSavings,
                    nftBadge: response.data.nftBadge
                };
            } catch (error) {
                return this._handleError('VIP Get Status', error);
            }
        },

        /**
         * Reclamar recompensas VIP
         */
        claimRewards: async () => {
            try {
                const response = await this.client.post('/api/vip/claim-rewards');

                return {
                    success: true,
                    rewards: response.data.rewards,
                    bezCoins: response.data.bezCoins,
                    nfts: response.data.nfts
                };
            } catch (error) {
                return this._handleError('VIP Claim Rewards', error);
            }
        },

        /**
         * Obtener historial de ahorros VIP
         */
        getSavingsHistory: async () => {
            try {
                const response = await this.client.get('/api/vip/savings');

                return {
                    success: true,
                    totalSavings: response.data.totalSavings,
                    monthlyBreakdown: response.data.monthlyBreakdown,
                    savingsByCategory: response.data.byCategory
                };
            } catch (error) {
                return this._handleError('VIP Get Savings', error);
            }
        }
    };

    // ==========================================
    // 5. BEZ-COIN CON MOONPAY
    // ==========================================

    bezcoin = {
        /**
         * Comprar BEZ-Coin con fiat usando MoonPay
         * @param {Object} purchase - Datos de compra
         */
        buyWithMoonPay: async (purchase) => {
            try {
                const vipStatus = await this.vip.getStatus();
                const vipBonus = vipStatus.success ? vipStatus.benefits?.nftBonus || 0 : 0;

                const response = await this.client.post('/api/bezcoin/buy/moonpay', {
                    amount: purchase.amount,
                    currency: purchase.currency || 'USD',
                    paymentMethod: purchase.paymentMethod || 'credit_card', // credit_card, debit_card, bank_transfer
                    vipBonus: vipBonus,
                    returnUrl: purchase.returnUrl || window.location.href
                });

                return {
                    success: true,
                    moonpayUrl: response.data.moonpayUrl,
                    transactionId: response.data.transactionId,
                    bezAmount: response.data.bezAmount,
                    bonusAmount: response.data.bonusAmount,
                    totalBez: response.data.totalBez
                };
            } catch (error) {
                return this._handleError('MoonPay Buy BEZ', error);
            }
        },

        /**
         * Comprar BEZ-Coin con Stripe
         * @param {Object} purchase - Datos de compra
         */
        buyWithStripe: async (purchase) => {
            try {
                const vipStatus = await this.vip.getStatus();
                const vipBonus = vipStatus.success ? vipStatus.benefits?.nftBonus || 0 : 0;

                const response = await this.client.post('/api/bezcoin/buy/stripe', {
                    amount: purchase.amount,
                    currency: purchase.currency || 'USD',
                    vipBonus: vipBonus
                });

                return {
                    success: true,
                    sessionId: response.data.sessionId,
                    checkoutUrl: response.data.checkoutUrl,
                    bezAmount: response.data.bezAmount,
                    bonusAmount: response.data.bonusAmount,
                    totalBez: response.data.totalBez
                };
            } catch (error) {
                return this._handleError('Stripe Buy BEZ', error);
            }
        },

        /**
         * Intercambiar crypto por BEZ-Coin
         * @param {Object} swap - Datos del intercambio
         */
        swap: async (swap) => {
            try {
                const response = await this.client.post('/api/bezcoin/swap', {
                    fromToken: swap.fromToken,
                    toToken: 'BEZ',
                    amount: swap.amount,
                    slippage: swap.slippage || 0.5,
                    deadline: swap.deadline || 20 // minutos
                });

                return {
                    success: true,
                    amountOut: response.data.amountOut,
                    priceImpact: response.data.priceImpact,
                    route: response.data.route,
                    txHash: response.data.transactionHash
                };
            } catch (error) {
                return this._handleError('BEZ Swap', error);
            }
        },

        /**
         * Obtener precio actual de BEZ-Coin
         */
        getPrice: async () => {
            try {
                const response = await this.client.get('/api/bezcoin/price');

                return {
                    success: true,
                    price: response.data.priceUSD,
                    priceEUR: response.data.priceEUR,
                    change24h: response.data.change24h,
                    volume24h: response.data.volume24h,
                    marketCap: response.data.marketCap
                };
            } catch (error) {
                return this._handleError('Get BEZ Price', error);
            }
        },

        /**
         * Obtener historial de precios
         * @param {string} period - Período (1h, 24h, 7d, 30d, 1y)
         */
        getPriceHistory: async (period = '24h') => {
            try {
                const response = await this.client.get(`/api/bezcoin/history/${period}`);

                return {
                    success: true,
                    period: period,
                    prices: response.data.prices,
                    high: response.data.high,
                    low: response.data.low,
                    average: response.data.average
                };
            } catch (error) {
                return this._handleError('Get BEZ Price History', error);
            }
        },

        /**
         * Hacer staking de BEZ-Coin
         * @param {number} amount - Cantidad a stakear
         * @param {number} duration - Duración en días
         */
        stake: async (amount, duration) => {
            try {
                const response = await this.client.post('/api/bezcoin/stake', {
                    amount,
                    duration, // 30, 90, 180, 365 días
                    autoCompound: true
                });

                return {
                    success: true,
                    stakeId: response.data.stakeId,
                    amount: response.data.amount,
                    apy: response.data.apy,
                    endDate: response.data.endDate,
                    estimatedRewards: response.data.estimatedRewards
                };
            } catch (error) {
                return this._handleError('BEZ Stake', error);
            }
        },

        /**
         * Obtener recompensas de staking
         */
        getStakingRewards: async () => {
            try {
                const response = await this.client.get('/api/bezcoin/rewards');

                return {
                    success: true,
                    totalStaked: response.data.totalStaked,
                    totalRewards: response.data.totalRewards,
                    claimableRewards: response.data.claimableRewards,
                    stakes: response.data.stakes
                };
            } catch (error) {
                return this._handleError('Get Staking Rewards', error);
            }
        },

        /**
         * Transferir BEZ-Coin
         * @param {string} to - Dirección destino
         * @param {number} amount - Cantidad
         */
        transfer: async (to, amount) => {
            try {
                const response = await this.client.post('/api/bezcoin/transfer', {
                    to,
                    amount,
                    memo: 'Transfer via BeZhas SDK'
                });

                return {
                    success: true,
                    txHash: response.data.transactionHash,
                    from: response.data.from,
                    to: response.data.to,
                    amount: response.data.amount
                };
            } catch (error) {
                return this._handleError('BEZ Transfer', error);
            }
        }
    };

    // ==========================================
    // MÉTODOS AUXILIARES
    // ==========================================

    /**
     * Realizar llamada a la API
     * @private
     */
    async _callAPI(endpoint, data, method = 'POST') {
        try {
            const response = await this.client({
                method,
                url: endpoint,
                data: method !== 'GET' ? data : undefined,
                params: method === 'GET' ? data : undefined
            });

            return response.data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Manejar errores
     * @private
     */
    _handleError(operation, error) {
        console.error(`[BeZhas SDK] ${operation} failed:`, error);

        return {
            success: false,
            error: error.response?.data?.message || error.message || 'Unknown error',
            code: error.response?.status || 500,
            operation
        };
    }

    /**
     * Obtener descuento VIP del usuario
     * @private
     */
    async _getVIPDiscount() {
        try {
            const status = await this.vip.getStatus();
            return status.success && status.benefits ? status.benefits.discount : 0;
        } catch {
            return 0;
        }
    }

    /**
     * Configurar token de autenticación
     */
    setToken(token) {
        this.token = token;
        this.client.defaults.headers.Authorization = `Bearer ${token}`;
    }

    /**
     * Obtener información de la sesión
     */
    async getSession() {
        try {
            const response = await this.client.get('/api/auth/session');
            return {
                success: true,
                user: response.data.user,
                vipStatus: response.data.vipStatus
            };
        } catch (error) {
            return this._handleError('Get Session', error);
        }
    }
}

// Exportar instancia singleton
let sdkInstance = null;

export function initBeZhasSDK(config) {
    sdkInstance = new BeZhasEnterpriseSDK(config);
    return sdkInstance;
}

export function getBeZhasSDK() {
    if (!sdkInstance) {
        throw new Error('BeZhas SDK not initialized. Call initBeZhasSDK first.');
    }
    return sdkInstance;
}

// Método getInstance para compatibilidad
BeZhasEnterpriseSDK.getInstance = function (config) {
    if (!sdkInstance) {
        sdkInstance = new BeZhasEnterpriseSDK(config);
    }
    return sdkInstance;
};

export default BeZhasEnterpriseSDK;
