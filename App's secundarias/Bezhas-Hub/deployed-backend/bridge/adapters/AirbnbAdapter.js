/**
 * Airbnb Adapter
 * 
 * Connects BeZhas with Airbnb for property rentals tokenization.
 * Handles listing sync, reservations, and revenue distribution.
 * 
 * Note: Airbnb API requires partner program approval.
 * Currently uses mock/simulated data for development.
 */

const BaseAdapter = require('./BaseAdapter');
const axios = require('axios');
const logger = require('../../utils/logger');

// Models
const BridgeSyncedItem = require('../../models/BridgeSyncedItem.model');
const BridgeOrder = require('../../models/BridgeOrder.model');

class AirbnbAdapter extends BaseAdapter {
    constructor(config = {}) {
        super({
            platformId: 'airbnb',
            platformName: 'Airbnb',
            ...config,
        });

        this.baseUrl = config.baseUrl || 'https://api.airbnb.com/v2';
        this.clientId = config.clientId || process.env.AIRBNB_CLIENT_ID;
        this.clientSecret = config.clientSecret || process.env.AIRBNB_CLIENT_SECRET;
    }

    /**
     * Connect to Airbnb API
     */
    async connect() {
        try {
            logger.info({ platformId: this.platformId }, 'Connecting to Airbnb...');

            if (!this.clientId) {
                logger.warn('Airbnb: No API credentials configured. Using mock mode.');
                this.status = 'connected_mock';
                return { success: true, mode: 'mock' };
            }

            this.status = 'connected';
            logger.info({ platformId: this.platformId }, '✅ Connected to Airbnb');
            return { success: true, mode: 'live' };

        } catch (error) {
            this.status = 'error';
            logger.error({ error, platformId: this.platformId }, 'Failed to connect to Airbnb');
            throw error;
        }
    }

    /**
     * Sync listings from Airbnb to BeZhas
     */
    async syncInventory(options = {}) {
        if (this.syncInProgress) {
            throw new Error('Sync already in progress');
        }

        this.syncInProgress = true;
        const startTime = Date.now();

        try {
            logger.info({ platformId: this.platformId }, 'Starting Airbnb listings sync');

            let listings = [];

            if (this.status === 'connected_mock') {
                listings = this.generateMockListings(options.limit || 10);
            }

            const savedItems = [];
            for (const listing of listings) {
                const transformed = this.transformToBeZhasFormat(listing);

                const syncedItem = await BridgeSyncedItem.findOneAndUpdate(
                    { platform: 'airbnb', externalId: listing.id },
                    {
                        ...transformed,
                        platform: 'airbnb',
                        externalId: listing.id,
                        beZhasId: `BEZ_airbnb_${listing.id}`,
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
                itemsProcessed: listings.length,
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
     * Push inventory is not directly supported
     */
    async pushInventory(items) {
        logger.warn('Airbnb: Direct listing creation via API is restricted');
        return { success: false, message: 'Airbnb listings must be created on airbnb.com' };
    }

    /**
     * Handle incoming webhook from Airbnb
     */
    async handleWebhook(eventType, payload) {
        logger.info({ platformId: this.platformId, eventType }, 'Processing Airbnb webhook');

        switch (eventType) {
            case 'reservation.created':
                return this.handleReservationCreated(payload);
            case 'reservation.confirmed':
                return this.handleReservationConfirmed(payload);
            case 'reservation.cancelled':
                return this.handleReservationCancelled(payload);
            case 'payout.completed':
                return this.handlePayoutCompleted(payload);
            default:
                logger.warn({ eventType }, 'Unknown Airbnb webhook event type');
                return { processed: false, reason: 'Unknown event type' };
        }
    }

    /**
     * Handle reservation created
     */
    async handleReservationCreated(payload) {
        const { confirmation_code, listing, guest, start_date, end_date, total_price } = payload;

        const order = await BridgeOrder.create({
            beZhasOrderId: `BEZ_ORD_airbnb_${confirmation_code}`,
            externalOrderId: confirmation_code,
            platform: 'airbnb',
            buyer: {
                externalId: guest.id,
                name: guest.first_name,
                beZhasId: `BEZ_USER_airbnb_${guest.id}`,
            },
            items: [{
                externalId: listing.id,
                beZhasId: `BEZ_airbnb_${listing.id}`,
                title: listing.name,
                price: total_price,
                quantity: 1,
                metadata: {
                    checkIn: start_date,
                    checkOut: end_date,
                    nights: this.calculateNights(start_date, end_date),
                },
            }],
            totalAmount: total_price,
            status: 'pending',
            paymentStatus: 'pending',
        });

        this.emit('order_created', { order });
        return { processed: true, orderId: order.beZhasOrderId };
    }

    /**
     * Handle reservation confirmed
     */
    async handleReservationConfirmed(payload) {
        const { confirmation_code } = payload;

        await BridgeOrder.findOneAndUpdate(
            { platform: 'airbnb', externalOrderId: confirmation_code },
            { status: 'confirmed', paymentStatus: 'paid' }
        );

        return { processed: true };
    }

    /**
     * Handle reservation cancelled
     */
    async handleReservationCancelled(payload) {
        const { confirmation_code, refund_amount } = payload;

        await BridgeOrder.findOneAndUpdate(
            { platform: 'airbnb', externalOrderId: confirmation_code },
            {
                status: 'cancelled',
                paymentStatus: refund_amount > 0 ? 'refunded' : 'cancelled',
                'refund.amount': refund_amount,
                'refund.processedAt': new Date(),
            }
        );

        return { processed: true };
    }

    /**
     * Handle payout completed - Important for RWA dividend distribution
     */
    async handlePayoutCompleted(payload) {
        const { listing_id, payout_amount, payout_date, reservations } = payload;

        logger.info({
            listingId: listing_id,
            amount: payout_amount,
            reservations: reservations?.length,
        }, 'Airbnb payout received - Ready for RWA dividend distribution');

        // TODO: Trigger RWA dividend distribution
        // This would call the RWA Vault contract to distribute dividends
        // to all token holders of this property

        return {
            processed: true,
            payoutAmount: payout_amount,
            readyForDistribution: true,
        };
    }

    /**
     * Create order (not applicable - reservations are made on Airbnb)
     */
    async createOrder(orderData) {
        return { success: false, message: 'Reservations must be made on airbnb.com' };
    }

    /**
     * Update shipment (not applicable)
     */
    async updateShipment(trackingNumber, statusData) {
        return { success: false, message: 'Not applicable for accommodation' };
    }

    /**
     * Transform Airbnb listing to BeZhas format
     */
    transformToBeZhasFormat(listing) {
        return {
            title: listing.name,
            description: listing.description,
            price: listing.price?.amount,
            currency: listing.price?.currency || 'EUR',
            images: listing.photos?.map(p => p.large) || [],
            category: 'accommodation',
            metadata: {
                propertyType: listing.property_type,
                roomType: listing.room_type,
                bedrooms: listing.bedrooms,
                bathrooms: listing.bathrooms,
                maxGuests: listing.person_capacity,
                amenities: listing.amenities,
                location: {
                    city: listing.city,
                    country: listing.country,
                    coordinates: listing.lat && listing.lng ? {
                        lat: listing.lat,
                        lng: listing.lng,
                    } : null,
                },
                rating: listing.star_rating,
                reviewCount: listing.reviews_count,
            },
            originalData: listing,
        };
    }

    /**
     * Transform BeZhas format to Airbnb format
     */
    transformToExternalFormat(bezhasItem) {
        // Not directly applicable as Airbnb doesn't allow API listing creation
        return bezhasItem;
    }

    /**
     * Calculate number of nights between dates
     */
    calculateNights(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }

    /**
     * Generate mock listings
     */
    generateMockListings(count = 5) {
        const propertyTypes = ['Apartment', 'House', 'Villa', 'Loft', 'Condo'];
        const cities = ['Barcelona', 'Madrid', 'Valencia', 'Sevilla', 'Mallorca'];

        const listings = [];
        for (let i = 0; i < count; i++) {
            listings.push({
                id: `airbnb_mock_${i}`,
                name: `${propertyTypes[i % propertyTypes.length]} en ${cities[i % cities.length]}`,
                description: 'Hermoso alojamiento con todas las comodidades.',
                property_type: propertyTypes[i % propertyTypes.length],
                room_type: 'entire_home',
                price: { amount: 80 + (i * 20), currency: 'EUR' },
                bedrooms: 1 + (i % 3),
                bathrooms: 1 + (i % 2),
                person_capacity: 2 + (i * 2),
                city: cities[i % cities.length],
                country: 'Spain',
                photos: [
                    { large: `https://picsum.photos/seed/airbnb${i}/800/600` }
                ],
                star_rating: 4 + (Math.random() * 0.9),
                reviews_count: Math.floor(Math.random() * 200),
                amenities: ['WiFi', 'Kitchen', 'Air Conditioning', 'Washing Machine'],
            });
        }

        return listings;
    }
}

module.exports = AirbnbAdapter;
