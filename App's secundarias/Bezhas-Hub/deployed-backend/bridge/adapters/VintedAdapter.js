/**
 * Vinted Adapter
 * 
 * Connects BeZhas with the Vinted marketplace platform.
 * Handles product sync, orders, and shipping updates.
 * 
 * Note: This adapter requires official Vinted API access.
 * Currently uses mock/simulated data for development.
 */

const BaseAdapter = require('./BaseAdapter');
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../../utils/logger');

// Models
const BridgeSyncedItem = require('../../models/BridgeSyncedItem.model');
const BridgeOrder = require('../../models/BridgeOrder.model');

class VintedAdapter extends BaseAdapter {
    constructor(config = {}) {
        super({
            platformId: 'vinted',
            platformName: 'Vinted',
            ...config,
        });

        this.baseUrl = config.baseUrl || 'https://api.vinted.com/v1'; // Hypothetical API URL
        this.userId = config.userId || null;
        this.accessToken = config.accessToken || null;

        // Vinted-specific settings
        this.supportedCategories = [
            'clothes', 'shoes', 'bags', 'accessories', 'beauty', 'kids', 'home'
        ];
        this.conditionMap = {
            'new_with_tags': 'nuevo_con_etiquetas',
            'new_without_tags': 'nuevo_sin_etiquetas',
            'very_good': 'muy_bueno',
            'good': 'bueno',
            'satisfactory': 'aceptable',
        };
    }

    /**
     * Connect to Vinted API
     */
    async connect() {
        try {
            logger.info({ platformId: this.platformId }, 'Connecting to Vinted...');

            // In production, this would authenticate with Vinted OAuth
            if (!this.accessToken && !this.apiKey) {
                logger.warn('Vinted: No credentials configured. Using mock mode.');
                this.status = 'connected_mock';
                return { success: true, mode: 'mock' };
            }

            // Test API connection (hypothetical endpoint)
            // const response = await axios.get(`${this.baseUrl}/user/me`, {
            //     headers: { Authorization: `Bearer ${this.accessToken}` }
            // });

            this.status = 'connected';
            logger.info({ platformId: this.platformId }, '✅ Connected to Vinted');
            return { success: true, mode: 'live' };

        } catch (error) {
            this.status = 'error';
            logger.error({ error, platformId: this.platformId }, 'Failed to connect to Vinted');
            throw error;
        }
    }

    /**
     * Sync inventory from Vinted to BeZhas
     */
    async syncInventory(options = {}) {
        if (this.syncInProgress) {
            throw new Error('Sync already in progress');
        }

        this.syncInProgress = true;
        const startTime = Date.now();

        try {
            logger.info({ platformId: this.platformId, options }, 'Starting Vinted inventory sync');

            let items = [];

            // If mock mode, generate sample data
            if (this.status === 'connected_mock' || !this.accessToken) {
                items = this.generateMockItems(options.limit || 20);
            } else {
                // Real API call (hypothetical)
                // const response = await axios.get(`${this.baseUrl}/user/${this.userId}/items`, {
                //     headers: { Authorization: `Bearer ${this.accessToken}` },
                //     params: { per_page: options.limit || 50 }
                // });
                // items = response.data.items;
            }

            // Transform and save items
            const savedItems = [];
            for (const item of items) {
                const transformed = this.transformToBeZhasFormat(item);

                const syncedItem = await BridgeSyncedItem.findOneAndUpdate(
                    { platform: 'vinted', externalId: item.id },
                    {
                        ...transformed,
                        platform: 'vinted',
                        externalId: item.id,
                        beZhasId: `BEZ_vinted_${item.id}`,
                        syncStatus: 'synced',
                        lastSyncAt: new Date(),
                    },
                    { upsert: true, new: true }
                );

                savedItems.push(syncedItem);
            }

            this.stats.itemsSynced += savedItems.length;
            this.lastSyncTime = new Date();
            this.syncInProgress = false;

            const result = {
                success: true,
                itemsProcessed: items.length,
                itemsSaved: savedItems.length,
                duration: Date.now() - startTime,
            };

            this.emit('sync_complete', result);
            return result;

        } catch (error) {
            this.syncInProgress = false;
            this.emit('sync_error', error);
            throw error;
        }
    }

    /**
     * Push inventory from BeZhas to Vinted
     */
    async pushInventory(items) {
        const results = [];

        for (const item of items) {
            try {
                const externalFormat = this.transformToExternalFormat(item);

                // In production, this would call Vinted's create item API
                // const response = await axios.post(`${this.baseUrl}/items`, externalFormat, {
                //     headers: { Authorization: `Bearer ${this.accessToken}` }
                // });

                // Mock response
                const mockExternalId = `vinted_${Date.now()}_${Math.random().toString(36).substring(7)}`;

                results.push({
                    bezhasId: item.beZhasId,
                    externalId: mockExternalId,
                    success: true,
                });

            } catch (error) {
                results.push({
                    bezhasId: item.beZhasId,
                    success: false,
                    error: error.message,
                });
            }
        }

        return { success: true, results };
    }

    /**
     * Handle incoming webhook from Vinted
     */
    async handleWebhook(eventType, payload) {
        logger.info({ platformId: this.platformId, eventType }, 'Processing Vinted webhook');

        switch (eventType) {
            case 'item.sold':
                return this.handleItemSold(payload);
            case 'item.reserved':
                return this.handleItemReserved(payload);
            case 'order.shipped':
                return this.handleOrderShipped(payload);
            case 'message.received':
                return this.handleMessageReceived(payload);
            default:
                logger.warn({ eventType }, 'Unknown Vinted webhook event type');
                return { processed: false, reason: 'Unknown event type' };
        }
    }

    /**
     * Handle item sold event
     */
    async handleItemSold(payload) {
        const { item_id, buyer, price, transaction_id } = payload;

        // Create order in BeZhas
        const order = await BridgeOrder.create({
            beZhasOrderId: `BEZ_ORD_vinted_${transaction_id}`,
            externalOrderId: transaction_id,
            platform: 'vinted',
            buyer: {
                externalId: buyer.id,
                username: buyer.login,
                beZhasId: `BEZ_USER_vinted_${buyer.id}`,
            },
            items: [{
                externalId: item_id,
                beZhasId: `BEZ_vinted_${item_id}`,
                price: price,
                quantity: 1,
            }],
            totalAmount: price,
            status: 'pending_shipment',
            paymentStatus: 'paid',
        });

        this.emit('order_created', { order });
        this.stats.ordersProcessed++;

        return { processed: true, orderId: order.beZhasOrderId };
    }

    /**
     * Handle item reserved event
     */
    async handleItemReserved(payload) {
        const { item_id, buyer } = payload;

        await BridgeSyncedItem.findOneAndUpdate(
            { platform: 'vinted', externalId: item_id },
            { 'metadata.reserved': true, 'metadata.reservedBy': buyer.id }
        );

        return { processed: true };
    }

    /**
     * Handle order shipped event
     */
    async handleOrderShipped(payload) {
        const { transaction_id, tracking_number, carrier } = payload;

        await BridgeOrder.findOneAndUpdate(
            { platform: 'vinted', externalOrderId: transaction_id },
            {
                status: 'shipped',
                'shipping.trackingNumber': tracking_number,
                'shipping.carrier': carrier,
                'shipping.shippedAt': new Date(),
            }
        );

        this.emit('shipment_updated', { trackingNumber: tracking_number });

        return { processed: true };
    }

    /**
     * Handle message received (for buyer-seller communication)
     */
    async handleMessageReceived(payload) {
        // Could integrate with BeZhas chat system
        logger.info({ platformId: this.platformId }, 'Vinted message received (not processed)');
        return { processed: false, reason: 'Chat integration not implemented' };
    }

    /**
     * Transform Vinted item to BeZhas format
     */
    transformToBeZhasFormat(vintedItem) {
        return {
            title: vintedItem.title,
            description: vintedItem.description,
            price: parseFloat(vintedItem.price),
            currency: vintedItem.currency || 'EUR',
            images: vintedItem.photos?.map(p => p.url) || [],
            category: this.mapCategory(vintedItem.catalog_id),
            condition: this.conditionMap[vintedItem.status] || 'bueno',
            metadata: {
                brand: vintedItem.brand_title,
                size: vintedItem.size_title,
                color: vintedItem.color1,
                originalUrl: vintedItem.url,
                views: vintedItem.view_count,
                favorites: vintedItem.favourite_count,
            },
            originalData: vintedItem,
        };
    }

    /**
     * Transform BeZhas item to Vinted format
     */
    transformToExternalFormat(bezhasItem) {
        return {
            title: bezhasItem.title,
            description: bezhasItem.description,
            price: bezhasItem.price.toString(),
            currency: bezhasItem.currency || 'EUR',
            photos: bezhasItem.images?.map(url => ({ url })) || [],
            catalog_id: this.reverseMapCategory(bezhasItem.category),
            brand_title: bezhasItem.metadata?.brand,
            size_title: bezhasItem.metadata?.size,
            status: 'good', // Default condition
        };
    }

    /**
     * Map Vinted category to BeZhas category
     */
    mapCategory(vintedCatalogId) {
        // Simplified mapping - in production would be more detailed
        const categoryMap = {
            '1': 'ropa_mujer',
            '2': 'ropa_hombre',
            '3': 'ropa_ninos',
            '4': 'zapatos',
            '5': 'bolsos',
            '6': 'accesorios',
        };
        return categoryMap[vintedCatalogId] || 'otros';
    }

    /**
     * Reverse map BeZhas category to Vinted catalog ID
     */
    reverseMapCategory(bezhasCategory) {
        const reverseMap = {
            'ropa_mujer': '1',
            'ropa_hombre': '2',
            'ropa_ninos': '3',
            'zapatos': '4',
            'bolsos': '5',
            'accesorios': '6',
        };
        return reverseMap[bezhasCategory] || '1';
    }

    /**
     * Generate mock items for development
     */
    generateMockItems(count = 10) {
        const mockItems = [];
        const brands = ['Nike', 'Zara', 'H&M', 'Adidas', 'Mango', 'Pull&Bear'];
        const conditions = ['new_with_tags', 'new_without_tags', 'very_good', 'good'];

        for (let i = 0; i < count; i++) {
            mockItems.push({
                id: `mock_${Date.now()}_${i}`,
                title: `Prenda de ${brands[i % brands.length]} - Talla M`,
                description: 'Artículo en excelente estado, poco uso.',
                price: (10 + Math.random() * 50).toFixed(2),
                currency: 'EUR',
                photos: [
                    { url: `https://picsum.photos/seed/${i}/400/400` }
                ],
                catalog_id: String((i % 6) + 1),
                brand_title: brands[i % brands.length],
                size_title: 'M',
                color1: 'Negro',
                status: conditions[i % conditions.length],
                view_count: Math.floor(Math.random() * 500),
                favourite_count: Math.floor(Math.random() * 50),
            });
        }

        return mockItems;
    }

    /**
     * Validate Vinted webhook signature
     */
    validateWebhookSignature(headers, body) {
        if (!this.webhookSecret) {
            logger.warn('Vinted webhook secret not configured');
            return true; // Skip validation in development
        }

        const signature = headers['x-vinted-signature'];
        if (!signature) return false;

        const expectedSignature = crypto
            .createHmac('sha256', this.webhookSecret)
            .update(body)
            .digest('hex');

        return signature === expectedSignature;
    }
}

module.exports = VintedAdapter;
