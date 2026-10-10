/**
 * BeZhas Universal Bridge SDK v1.0
 * 
 * Permite conectar CUALQUIER plataforma (E-commerce, Logistica, ERP, Marketplaces)
 * con BeZhas Web3 sin necesidad de integraciones especificas.
 * 
 * Principio de Diseño: "No nos adaptamos a tu API, tu te adaptas a nuestro Estandar"
 * 
 * @author BeZhas Team
 * @license MIT
 */

// Import Sector Modules
const RealEstateModule = require('./modules/RealEstateModule');
const HealthcareModule = require('./modules/HealthcareModule');
const AutomotiveModule = require('./modules/AutomotiveModule');
const ManufacturingModule = require('./modules/ManufacturingModule');
const EnergyModule = require('./modules/EnergyModule');
const AgricultureModule = require('./modules/AgricultureModule');
const {
    EducationModule,
    InsuranceModule,
    EntertainmentModule,
    LegalModule
} = require('./modules/Tier2Modules');
const {
    SupplyChainModule,
    GovernmentModule,
    CarbonModule
} = require('./modules/Tier3Modules');

class BeZhasUniversal {
    constructor(config) {
        this.config = config;
        this.apiKey = config.apiKey;
        this.endpoint = config.endpoint || 'https://api.bezhas.com/v1/bridge';
        this.provider = config.provider; // Web3 Provider opcional
        this.debug = config.debug || false;

        // Initialize Sector Modules (Lazy Loading based on permissions)
        this.realestate = new RealEstateModule({ ...config, baseURL: config.endpoint });
        this.healthcare = new HealthcareModule({ ...config, baseURL: config.endpoint });
        this.automotive = new AutomotiveModule({ ...config, baseURL: config.endpoint });
        this.manufacturing = new ManufacturingModule({ ...config, baseURL: config.endpoint });
        this.energy = new EnergyModule({ ...config, baseURL: config.endpoint });
        this.agriculture = new AgricultureModule({ ...config, baseURL: config.endpoint });
        this.education = new EducationModule({ ...config, baseURL: config.endpoint });
        this.insurance = new InsuranceModule({ ...config, baseURL: config.endpoint });
        this.entertainment = new EntertainmentModule({ ...config, baseURL: config.endpoint });
        this.legal = new LegalModule({ ...config, baseURL: config.endpoint });
        this.supply = new SupplyChainModule({ ...config, baseURL: config.endpoint });
        this.government = new GovernmentModule({ ...config, baseURL: config.endpoint });
        this.carbon = new CarbonModule({ ...config, baseURL: config.endpoint });
    }

    /**
     * 1. UNIVERSAL INVENTORY SYNC
     * Convierte productos de cualquier plataforma a formato BeZhas NFT
     * 
     * Soporta: Vinted, Shopify, Amazon, Wallapop, ERPs, etc.
     * 
     * @param {Array} items - Array de productos en formato variable
     * @returns {Promise} Resultado de la sincronizacion
     */
    async syncInventory(items) {
        if (!Array.isArray(items)) {
            throw new Error('syncInventory expects an array of items');
        }

        // Estandarizacion automatica de datos
        const standardizedItems = items.map(item => this._standardizeProduct(item));

        if (this.debug) {
            console.log('📦 BeZhas SDK: Syncing', standardizedItems.length, 'items');
        }

        return this._request('/inventory/sync', 'POST', { items: standardizedItems });
    }

    /**
     * 2. UNIVERSAL LOGISTICS TRACKING
     * Recibe actualizaciones de Maersk, TNT, Correos, FedEx, DHL en formato unico
     * 
     * @param {Object} update - Actualizacion de envio
     * @returns {Promise} Confirmacion de actualizacion
     */
    async updateShipmentStatus(update) {
        const standardizedUpdate = {
            trackingNumber: update.trackingId || update.tracking_number || update.id,
            status: this._normalizeStatus(update.status),
            location: update.currentLocation || update.location || 'Unknown',
            timestamp: update.timestamp || new Date().toISOString(),
            carrier: update.carrier || 'UNKNOWN',
            estimatedDelivery: update.estimatedDelivery || null,
            proofOfDelivery: update.signature || update.pod || null
        };

        if (this.debug) {
            console.log('🚚 BeZhas SDK: Updating shipment', standardizedUpdate.trackingNumber);
        }

        return this._request('/logistics/update', 'POST', standardizedUpdate);
    }

    /**
     * 3. UNIVERSAL PAYMENT GATEWAY
     * Registra pagos de Stripe, PayPal, MoonPay, Bancos, Crypto
     * 
     * @param {Object} payment - Datos de pago
     * @returns {Promise} Confirmacion de pago
     */
    async registerPayment(payment) {
        const standardizedPayment = {
            transactionId: payment.txId || payment.transaction_id || payment.id,
            amount: parseFloat(payment.amount),
            currency: payment.currency || 'USD',
            status: payment.status === 'succeeded' || payment.status === 'completed' ? 'COMPLETED' : 'PENDING',
            paymentMethod: payment.method || payment.payment_method || 'UNKNOWN',
            payer: payment.userId || payment.customer_id || payment.from,
            timestamp: payment.timestamp || new Date().toISOString(),
            metadata: payment.metadata || {}
        };

        if (this.debug) {
            console.log('💰 BeZhas SDK: Registering payment', standardizedPayment.transactionId);
        }

        return this._request('/payments/webhook', 'POST', standardizedPayment);
    }

    /**
     * 4. UNIVERSAL ORDER MANAGEMENT
     * Crea ordenes desde cualquier sistema
     * 
     * @param {Object} order - Datos de la orden
     * @returns {Promise} Orden creada en BeZhas
     */
    async createOrder(order) {
        const standardizedOrder = {
            externalId: order.id || order.order_id,
            buyer: order.buyer || order.customer,
            seller: order.seller || order.vendor,
            items: Array.isArray(order.items) ? order.items : [order.item],
            totalAmount: order.total || order.amount,
            currency: order.currency || 'USD',
            shippingAddress: order.shipping_address || order.address,
            status: 'PENDING',
            source: order.source || 'EXTERNAL'
        };

        return this._request('/orders/create', 'POST', standardizedOrder);
    }

    /**
     * 5. WEBHOOK HANDLER
     * Procesa webhooks de cualquier plataforma externa.
     * Requiere suscripción professional o enterprise.
     * 
     * @param {Object} webhook - Payload del webhook
     * @param {String} source - Plataforma origen (vinted, maersk, stripe, etc)
     * @returns {Promise} Resultado del procesamiento
     */
    async processWebhook(webhook, source) {
        // Pre-flight: verify the caller's tier is eligible for webhook access
        const tierCheck = await this._request('/config/webhooks/tier-check', 'GET');
        if (tierCheck && !tierCheck.allowed) {
            throw new Error(
                `Webhook access denied: your plan (${tierCheck.current_tier || 'unknown'}) ` +
                'does not include webhook access. Upgrade to professional or enterprise.'
            );
        }

        return this._request('/webhooks/process', 'POST', {
            source: source.toLowerCase(),
            payload: webhook,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * 6. VIP SUBSCRIPTION MANAGEMENT
     * Gestiona suscripciones VIP con cualquier método de pago
     * 
     * @param {Object} subscription - Datos de suscripción
     * @returns {Promise} Resultado de la suscripción
     */
    async createVIPSubscription(subscription) {
        const standardizedSub = {
            tier: subscription.tier?.toUpperCase() || 'CREATOR',
            userId: subscription.userId || subscription.user_id,
            walletAddress: subscription.walletAddress || subscription.wallet,
            paymentMethod: subscription.paymentMethod || 'stripe', // stripe, crypto, bank
            billingPeriod: subscription.billingPeriod || 'monthly',
            metadata: subscription.metadata || {}
        };

        if (this.debug) {
            console.log('👑 BeZhas SDK: Creating VIP subscription', standardizedSub.tier);
        }

        return this._request('/vip/subscribe', 'POST', standardizedSub);
    }

    /**
     * 7. BEZ-COIN OPERATIONS
     * Operaciones con token BEZ-Coin
     * 
     * @param {Object} operation - Tipo de operación
     * @returns {Promise} Resultado de la operación
     */
    async bezCoinOperation(operation) {
        // ... (existing code skipped for brevity in replace, will keep original logic)
        const ops = {
            TRANSFER: '/bezcoin/transfer',
            STAKE: '/bezcoin/stake',
            UNSTAKE: '/bezcoin/unstake',
            BALANCE: '/bezcoin/balance',
            PRICE: '/bezcoin/price'
        };

        const endpoint = ops[operation.type?.toUpperCase()] || '/bezcoin/balance';

        if (this.debug) {
            console.log('🪙 BeZhas SDK: BEZ-Coin operation', operation.type);
        }

        return this._request(endpoint, operation.type === 'BALANCE' || operation.type === 'PRICE' ? 'GET' : 'POST', {
            walletAddress: operation.walletAddress || operation.from,
            amount: operation.amount,
            to: operation.to,
            metadata: operation.metadata || {}
        });
    }

    /**
     * 7b. L2 NETWORK TELEMETRY
     * Obtiene el estado en tiempo real de la blockchain BeZhas.
     */
    async getL2Stats() {
        if (this.debug) {
            console.log('📡 BeZhas SDK: Fetching L2 Network Stats');
        }
        return this._request('/network/stats', 'GET');
    }

    /**
     * 8. AI SERVICES INTEGRATION
     * Acceso a servicios de IA de BeZhas
     * 
     * @param {Object} request - Solicitud de IA
     * @returns {Promise} Respuesta de IA
     */
    async aiService(request) {
        const aiRequest = {
            service: request.service || 'chat', // chat, moderation, analysis, oracle
            prompt: request.prompt || request.message,
            context: request.context || {},
            userId: request.userId,
            tier: request.tier || 'free', // free, creator, business, enterprise
            maxTokens: request.maxTokens || 1000
        };

        if (this.debug) {
            console.log('🤖 BeZhas SDK: AI service request', aiRequest.service);
        }

        return this._request('/ai/process', 'POST', aiRequest);
    }

    /**
     * 9. MARKETPLACE OPERATIONS
     * Operaciones en el marketplace de BeZhas
     * 
     * @param {Object} listing - Datos del listado
     * @returns {Promise} Resultado de la operación
     */
    async marketplaceOperation(listing) {
        const endpoint = listing.action === 'create' ? '/marketplace/list' :
            listing.action === 'update' ? '/marketplace/update' :
                listing.action === 'delete' ? '/marketplace/remove' :
                    '/marketplace/list';

        return this._request(endpoint, 'POST', {
            productId: listing.productId || listing.id,
            title: listing.title,
            price: listing.price,
            currency: listing.currency || 'BEZ',
            category: listing.category,
            condition: listing.condition || 'new',
            sellerWallet: listing.sellerWallet || listing.seller,
            images: listing.images || [],
            metadata: listing.metadata || {}
        });
    }

    // ==================== HELPERS INTERNOS ====================

    /**
     * Estandariza un producto de cualquier formato a BeZhas Standard
     * @private
     */
    _standardizeProduct(item) {
        return {
            externalId: item.id || item.product_id || item.sku,
            sourcePlatform: item.platform || item.source || 'UNKNOWN',
            title: item.title || item.name || item.description,
            description: item.description || item.details || '',
            price: {
                amount: parseFloat(item.price || item.amount || 0),
                currency: item.currency || 'USD'
            },
            category: item.category || item.type || 'General',
            condition: item.condition || 'NEW',
            images: Array.isArray(item.images) ? item.images : (item.image ? [item.image] : []),
            metadata: {
                brand: item.brand || null,
                size: item.size || null,
                color: item.color || null,
                weight: item.weight || null,
                location: item.location || null,
                ...item.metadata
            },
            // Campos especiales para logistica
            logistics: item.isContainer || item.type === 'container' ? {
                containerId: item.containerId || item.container_id,
                weight: item.weight,
                dimensions: item.dimensions,
                type: item.containerType || 'STANDARD'
            } : null,
            stock: item.stock || item.quantity || 1,
            status: 'ACTIVE'
        };
    }

    /**
     * Normaliza estados de envio a estandar BeZhas
     * @private
     */
    _normalizeStatus(status) {
        const statusMap = {
            // Estados de envio
            'created': 'PENDING',
            'pending': 'PENDING',
            'processing': 'PENDING',
            'shipped': 'IN_TRANSIT',
            'in_transit': 'IN_TRANSIT',
            'sailing': 'IN_TRANSIT',
            'on_the_way': 'IN_TRANSIT',
            'out_for_delivery': 'OUT_FOR_DELIVERY',
            'delivered': 'DELIVERED',
            'arrived': 'DELIVERED',
            'completed': 'DELIVERED',
            'cancelled': 'CANCELLED',
            'returned': 'RETURNED',
            'failed': 'FAILED'
        };

        const normalized = statusMap[status?.toLowerCase()];
        return normalized || 'UNKNOWN';
    }

    /**
     * Realiza peticiones HTTP al Bridge API
     * @private
     */
    async _request(path, method, body) {
        try {
            const url = `${this.endpoint}${path}`;

            if (this.debug) {
                console.log(`📡 BeZhas SDK Request: ${method} ${url}`);
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey,
                    'X-SDK-Version': '1.0.0'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(`BeZhas Bridge API Error: ${data.error || response.statusText}`);
            }

            return data;

        } catch (error) {
            console.error(`❌ BeZhas SDK Error [${path}]:`, error.message);
            throw error;
        }
    }

    /**
     * Verifica la salud del Bridge API
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.endpoint}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }
}

// Export para Node.js y Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BeZhasUniversal;
}

if (typeof window !== 'undefined') {
    window.BeZhasUniversal = BeZhasUniversal;
}
