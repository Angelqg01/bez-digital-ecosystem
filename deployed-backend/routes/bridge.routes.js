/**
 * BeZhas Universal Bridge - API Routes
 * Endpoints para integración con plataformas externas (Vinted, Amazon, Maersk, etc.)
 * 
 * Estas rutas permiten que plataformas externas se sincronicen con BeZhas
 * siguiendo NUESTRO estándar (ellas se adaptan a nosotros)
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { verifyToken } = require('../middleware/auth.middleware');

// Modelos
const BridgeApiKey = require('../models/BridgeApiKey.model');
const BridgeSyncedItem = require('../models/BridgeSyncedItem.model');
const BridgeShipment = require('../models/BridgeShipment.model');
const BridgeOrder = require('../models/BridgeOrder.model');

// Rate limiting específico para Bridge API
const rateLimit = require('express-rate-limit');
const bridgeLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // 100 requests por minuto
    message: { error: 'Too many bridge requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware de validación de API Key
const validateApiKey = async (req, res, next) => {
    try {
        const apiKeyString = req.headers['x-api-key'] || req.query.apiKey;

        if (!apiKeyString) {
            return res.status(401).json({
                success: false,
                error: 'API key required',
                message: 'Include X-API-Key header or apiKey query parameter'
            });
        }

        // Validar formato
        if (!BridgeApiKey.isValidKeyFormat(apiKeyString)) {
            return res.status(401).json({
                success: false,
                error: 'Invalid API key format',
                message: 'API key must start with "bez_" and be at least 32 characters'
            });
        }

        // Buscar en base de datos
        const apiKey = await BridgeApiKey.findOne({ key: apiKeyString });

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'Invalid API key',
                message: 'API key not found'
            });
        }

        // Verificar si está activa
        if (!apiKey.isActive()) {
            return res.status(403).json({
                success: false,
                error: 'API key inactive or expired',
                message: apiKey.isExpired() ? 'API key has expired' : 'API key is disabled'
            });
        }

        // Guardar en request
        req.apiKey = apiKey;
        req.apiKeyString = apiKeyString;
        req.externalPlatform = req.headers['x-platform-name'] || apiKey.platform;

        next();
    } catch (error) {
        logger.error({ err: error }, 'Bridge: API key validation error');
        res.status(500).json({
            success: false,
            error: 'API key validation failed',
            message: error.message
        });
    }
};

/**
 * POST /api/v1/bridge/inventory/sync
 * Sincronizar inventario desde plataforma externa
 * 
 * Body:
 * {
 *   "items": [
 *     {
 *       "externalId": "vinted_123456",
 *       "title": "Nike Air Max",
 *       "description": "Zapatillas usadas en buen estado",
 *       "price": 45.00,
 *       "currency": "EUR",
 *       "images": ["url1", "url2"],
 *       "category": "shoes",
 *       "condition": "used_good",
 *       "metadata": {
 *         "brand": "Nike",
 *         "size": "42",
 *         "color": "black"
 *       }
 *     }
 *   ]
 * }
 */
router.post('/inventory/sync', bridgeLimiter, validateApiKey, async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request',
                message: 'items array is required and must not be empty'
            });
        }

        // Validar estructura de cada item
        const invalidItems = [];
        const validItems = [];

        items.forEach((item, index) => {
            const { externalId, title, price, currency } = item;

            if (!externalId || !title || !price || !currency) {
                invalidItems.push({
                    index,
                    item: externalId || `item_${index}`,
                    error: 'Missing required fields: externalId, title, price, currency'
                });
            } else {
                validItems.push({
                    ...item,
                    platform: req.externalPlatform,
                    syncedAt: new Date(),
                    beZhasId: `BEZ_${req.externalPlatform}_${externalId}` // ID interno BeZhas
                });
            }
        });

        // Guardar items válidos en MongoDB
        const savedItems = [];
        const saveErrors = [];

        for (const item of validItems) {
            try {
                // Intentar actualizar o crear
                const syncedItem = await BridgeSyncedItem.findOneAndUpdate(
                    {
                        platform: req.externalPlatform,
                        externalId: item.externalId
                    },
                    {
                        ...item,
                        apiKey: req.apiKey._id,
                        syncedBy: req.apiKey.userId,
                        syncStatus: 'synced',
                        lastSyncAt: new Date()
                    },
                    {
                        upsert: true,
                        new: true,
                        setDefaultsOnInsert: true
                    }
                );

                savedItems.push({
                    externalId: syncedItem.externalId,
                    beZhasId: syncedItem.beZhasId,
                    _id: syncedItem._id
                });
            } catch (saveError) {
                saveErrors.push({
                    externalId: item.externalId,
                    error: saveError.message
                });
            }
        }

        // Incrementar estadísticas de API key
        await req.apiKey.incrementStats(true);

        logger.info({
            platform: req.externalPlatform,
            totalItems: items.length,
            validItems: validItems.length,
            savedItems: savedItems.length,
            invalidItems: invalidItems.length,
            saveErrors: saveErrors.length
        }, 'Bridge: Inventory sync request processed');

        res.status(200).json({
            success: true,
            message: 'Inventory sync completed',
            data: {
                processed: items.length,
                synced: savedItems.length,
                failed: invalidItems.length + saveErrors.length,
                invalidItems: invalidItems.length > 0 ? invalidItems : undefined,
                saveErrors: saveErrors.length > 0 ? saveErrors : undefined,
                syncedItems: savedItems
            }
        });

    } catch (error) {
        // Incrementar estadísticas de error
        if (req.apiKey) {
            await req.apiKey.incrementStats(false);
            req.apiKey.stats.lastError = error.message;
            await req.apiKey.save();
        }

        logger.error({ err: error, platform: req.externalPlatform }, 'Bridge: Inventory sync error');
        res.status(500).json({
            success: false,
            error: 'Inventory sync failed',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/bridge/logistics/update
 * Actualizar estado de envío desde proveedor logístico
 * 
 * Body:
 * {
 *   "trackingNumber": "MAERSK-123456789",
 *   "status": "in_transit",
 *   "location": {
 *     "city": "Rotterdam",
 *     "country": "Netherlands",
 *     "latitude": 51.9225,
 *     "longitude": 4.47917
 *   },
 *   "estimatedDelivery": "2026-01-10T14:00:00Z",
 *   "events": [
 *     {
 *       "timestamp": "2026-01-04T10:30:00Z",
 *       "status": "departed",
 *       "location": "Hamburg Port",
 *       "description": "Container departed from port"
 *     }
 *   ]
 * }
 */
router.post('/logistics/update', bridgeLimiter, validateApiKey, async (req, res) => {
    try {
        const { trackingNumber, status, location, estimatedDelivery, events } = req.body;

        if (!trackingNumber || !status) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request',
                message: 'trackingNumber and status are required'
            });
        }

        const validStatuses = ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status',
                message: `Status must be one of: ${validStatuses.join(', ')}`
            });
        }

        const shipmentUpdate = {
            trackingNumber: trackingNumber.toUpperCase(),
            status,
            currentLocation: location,
            estimatedDelivery,
            events: events || [],
            provider: req.externalPlatform,
            apiKey: req.apiKey._id,
            updatedAt: new Date()
        };

        // Buscar o crear el shipment
        let shipment = await BridgeShipment.findOne({ trackingNumber: trackingNumber.toUpperCase() });

        if (shipment) {
            // Actualizar existente
            await shipment.updateStatus(status, location?.city || location?.country,
                `Status updated from ${req.externalPlatform}`);

            if (location) {
                shipment.currentLocation = location;
            }
            if (estimatedDelivery) {
                shipment.estimatedDelivery = estimatedDelivery;
            }
            if (events && events.length > 0) {
                shipment.events.push(...events);
            }
            await shipment.save();
        } else {
            // Crear nuevo
            shipment = await BridgeShipment.create({
                ...shipmentUpdate,
                statusHistory: [{ status, timestamp: new Date() }]
            });
        }

        // TODO: Notificar al comprador/vendedor vía WebSocket si está conectado
        // wss.notifyShipmentUpdate(trackingNumber, shipment);

        // Incrementar estadísticas de API key
        await req.apiKey.incrementStats(true);

        logger.info({
            trackingNumber,
            status,
            provider: req.externalPlatform,
            shipmentId: shipment._id
        }, 'Bridge: Logistics update processed');

        res.status(200).json({
            success: true,
            message: 'Shipment status updated',
            data: {
                trackingNumber: shipment.trackingNumber,
                status: shipment.status,
                currentLocation: shipment.currentLocation,
                estimatedDelivery: shipment.estimatedDelivery,
                updatedAt: shipment.updatedAt
            }
        });

    } catch (error) {
        // Incrementar estadísticas de error
        if (req.apiKey) {
            await req.apiKey.incrementStats(false);
            req.apiKey.stats.lastError = error.message;
            await req.apiKey.save();
        }

        logger.error({ err: error, platform: req.externalPlatform }, 'Bridge: Logistics update error');
        res.status(500).json({
            success: false,
            error: 'Logistics update failed',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/bridge/payments/webhook
 * Webhook para notificaciones de pagos (Stripe, PayPal, etc.)
 * 
 * Body:
 * {
 *   "eventType": "payment.succeeded",
 *   "paymentId": "pi_1234567890",
 *   "orderId": "ORDER-123",
 *   "amount": 45.00,
 *   "currency": "EUR",
 *   "paymentMethod": "card",
 *   "customer": {
 *     "email": "buyer@example.com",
 *     "name": "John Doe"
 *   },
 *   "metadata": {
 *     "productId": "BEZ_vinted_123456",
 *     "platform": "vinted"
 *   }
 * }
 */
router.post('/payments/webhook', bridgeLimiter, validateApiKey, async (req, res) => {
    try {
        const { eventType, paymentId, orderId, amount, currency, paymentMethod, customer, metadata } = req.body;

        if (!eventType || !paymentId || !amount || !currency) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request',
                message: 'eventType, paymentId, amount, and currency are required'
            });
        }

        const validEvents = [
            'payment.succeeded',
            'payment.failed',
            'payment.pending',
            'payment.refunded',
            'payment.cancelled'
        ];

        if (!validEvents.includes(eventType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid event type',
                message: `eventType must be one of: ${validEvents.join(', ')}`
            });
        }

        const paymentData = {
            eventType,
            paymentId,
            orderId,
            amount,
            currency,
            paymentMethod,
            customer,
            metadata,
            provider: req.externalPlatform,
            receivedAt: new Date()
        };

        // TODO: Procesar el pago según el tipo de evento
        // if (eventType === 'payment.succeeded') {
        //     await Order.findOneAndUpdate(
        //         { orderId },
        //         { $set: { paymentStatus: 'paid', paidAt: new Date() } }
        //     );
        //     // Liberar fondos del escrow, notificar vendedor, etc.
        // }

        logger.info({
            eventType,
            paymentId,
            orderId,
            amount,
            currency,
            provider: req.externalPlatform
        }, 'Bridge: Payment webhook processed');

        res.status(200).json({
            success: true,
            message: 'Payment webhook processed',
            data: {
                paymentId,
                eventType,
                processedAt: paymentData.receivedAt
            }
        });

    } catch (error) {
        logger.error({ err: error, platform: req.externalPlatform }, 'Bridge: Payment webhook error');
        res.status(500).json({
            success: false,
            error: 'Payment webhook processing failed',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/bridge/orders/create
 * Crear orden desde plataforma externa
 * 
 * Body:
 * {
 *   "externalOrderId": "VINTED-ORD-123456",
 *   "buyer": {
 *     "externalId": "vinted_buyer_789",
 *     "email": "buyer@example.com",
 *     "username": "johndoe"
 *   },
 *   "seller": {
 *     "externalId": "vinted_seller_456",
 *     "email": "seller@example.com",
 *     "username": "janedoe"
 *   },
 *   "items": [
 *     {
 *       "externalId": "vinted_123456",
 *       "title": "Nike Air Max",
 *       "quantity": 1,
 *       "price": 45.00,
 *       "currency": "EUR"
 *     }
 *   ],
 *   "shippingAddress": {
 *     "street": "123 Main St",
 *     "city": "Madrid",
 *     "postalCode": "28001",
 *     "country": "Spain"
 *   },
 *   "totalAmount": 50.00,
 *   "shippingCost": 5.00
 * }
 */
router.post('/orders/create', bridgeLimiter, validateApiKey, async (req, res) => {
    try {
        const { externalOrderId, buyer, seller, items, shippingAddress, totalAmount, shippingCost } = req.body;

        if (!externalOrderId || !buyer || !seller || !items || !totalAmount) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request',
                message: 'externalOrderId, buyer, seller, items, and totalAmount are required'
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid items',
                message: 'items must be a non-empty array'
            });
        }

        const beZhasOrderId = `BEZ_ORD_${req.externalPlatform}_${Date.now()}`;

        const orderData = {
            beZhasOrderId,
            externalOrderId,
            platform: req.externalPlatform,
            buyer: {
                ...buyer,
                beZhasId: `BEZ_USER_${req.externalPlatform}_${buyer.externalId}`
            },
            seller: {
                ...seller,
                beZhasId: `BEZ_USER_${req.externalPlatform}_${seller.externalId}`
            },
            items: items.map(item => ({
                ...item,
                beZhasId: `BEZ_${req.externalPlatform}_${item.externalId}`,
                currency: item.currency || 'EUR'
            })),
            shippingAddress,
            totalAmount,
            shippingCost: shippingCost || 0,
            currency: items[0]?.currency || 'EUR',
            status: 'pending',
            paymentStatus: 'pending',
            apiKey: req.apiKey._id,
            escrowStatus: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Guardar orden en base de datos
        const savedOrder = await BridgeOrder.create(orderData);

        // TODO: Crear escrow para la transacción
        // const escrow = await createEscrow({
        //     orderId: beZhasOrderId,
        //     amount: totalAmount,
        //     buyer: orderData.buyer.beZhasId,
        //     seller: orderData.seller.beZhasId
        // });
        // savedOrder.escrowId = escrow._id;
        // await savedOrder.save();

        // Incrementar estadísticas de API key
        await req.apiKey.incrementStats(true);

        logger.info({
            beZhasOrderId,
            externalOrderId,
            platform: req.externalPlatform,
            totalAmount,
            orderId: savedOrder._id
        }, 'Bridge: Order created');

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: {
                beZhasOrderId: savedOrder.beZhasOrderId,
                externalOrderId: savedOrder.externalOrderId,
                status: savedOrder.status,
                paymentStatus: savedOrder.paymentStatus,
                escrowStatus: savedOrder.escrowStatus,
                totalAmount: savedOrder.getTotalWithShipping(),
                currency: savedOrder.currency,
                createdAt: savedOrder.createdAt
            }
        });

    } catch (error) {
        // Incrementar estadísticas de error
        if (req.apiKey) {
            await req.apiKey.incrementStats(false);
            req.apiKey.stats.lastError = error.message;
            await req.apiKey.save();
        }

        logger.error({ err: error, platform: req.externalPlatform }, 'Bridge: Order creation error');
        res.status(500).json({
            success: false,
            error: 'Order creation failed',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/bridge/status
 * Health check del Bridge API
 */
router.get('/status', (req, res) => {
    res.status(200).json({
        success: true,
        service: 'BeZhas Universal Bridge',
        version: '1.0.0',
        status: 'operational',
        endpoints: {
            inventorySync: 'POST /api/v1/bridge/inventory/sync',
            logisticsUpdate: 'POST /api/v1/bridge/logistics/update',
            paymentWebhook: 'POST /api/v1/bridge/payments/webhook',
            orderCreate: 'POST /api/v1/bridge/orders/create'
        },
        documentation: 'https://docs.bezhas.com/bridge-api',
        timestamp: new Date()
    });
});

/**
 * GET /api/v1/bridge/platforms
 * Lista de plataformas soportadas
 */
router.get('/platforms', (req, res) => {
    res.status(200).json({
        success: true,
        platforms: [
            {
                name: 'vinted',
                displayName: 'Vinted',
                category: 'marketplace',
                supported: true,
                features: ['inventory', 'orders', 'payments']
            },
            {
                name: 'amazon',
                displayName: 'Amazon Marketplace',
                category: 'marketplace',
                supported: true,
                features: ['inventory', 'orders', 'payments', 'logistics']
            },
            {
                name: 'ebay',
                displayName: 'eBay',
                category: 'marketplace',
                supported: true,
                features: ['inventory', 'orders', 'payments']
            },
            {
                name: 'maersk',
                displayName: 'Maersk Line',
                category: 'logistics',
                supported: true,
                features: ['logistics', 'tracking']
            },
            {
                name: 'fedex',
                displayName: 'FedEx',
                category: 'logistics',
                supported: true,
                features: ['logistics', 'tracking']
            },
            {
                name: 'dhl',
                displayName: 'DHL',
                category: 'logistics',
                supported: true,
                features: ['logistics', 'tracking']
            },
            {
                name: 'stripe',
                displayName: 'Stripe',
                category: 'payment',
                supported: true,
                features: ['payments', 'webhooks']
            },
            {
                name: 'paypal',
                displayName: 'PayPal',
                category: 'payment',
                supported: true,
                features: ['payments', 'webhooks']
            }
        ],
        totalPlatforms: 8,
        timestamp: new Date()
    });
});

module.exports = router;
