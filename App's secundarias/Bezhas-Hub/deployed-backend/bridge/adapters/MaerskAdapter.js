/**
 * Maersk Adapter
 * 
 * Connects BeZhas with Maersk logistics services.
 * Handles shipment tracking, booking, and status updates.
 * 
 * API Documentation: https://developer.maersk.com/
 */

const BaseAdapter = require('./BaseAdapter');
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../../utils/logger');

// Models
const BridgeShipment = require('../../models/BridgeShipment.model');
const LogisticsShipment = require('../../models/LogisticsShipment.model');

class MaerskAdapter extends BaseAdapter {
    constructor(config = {}) {
        super({
            platformId: 'maersk',
            platformName: 'Maersk Line',
            ...config,
        });

        this.baseUrl = config.baseUrl || 'https://api.maersk.com';
        this.consumerKey = config.consumerKey || process.env.MAERSK_CONSUMER_KEY;
        this.consumerSecret = config.consumerSecret || process.env.MAERSK_CONSUMER_SECRET;

        // Maersk-specific settings
        this.trackingUrl = 'https://api.maersk.com/track-and-trace/';
        this.bookingUrl = 'https://api.maersk.com/booking/';
    }

    /**
     * Connect to Maersk API
     */
    async connect() {
        try {
            logger.info({ platformId: this.platformId }, 'Connecting to Maersk...');

            if (!this.consumerKey) {
                logger.warn('Maersk: No API credentials configured. Using mock mode.');
                this.status = 'connected_mock';
                return { success: true, mode: 'mock' };
            }

            // Get OAuth token (real implementation)
            // const tokenResponse = await axios.post(`${this.baseUrl}/oauth/token`, {
            //     grant_type: 'client_credentials',
            // }, {
            //     auth: { username: this.consumerKey, password: this.consumerSecret }
            // });
            // this.accessToken = tokenResponse.data.access_token;

            this.status = 'connected';
            logger.info({ platformId: this.platformId }, '✅ Connected to Maersk');
            return { success: true, mode: 'live' };

        } catch (error) {
            this.status = 'error';
            logger.error({ error, platformId: this.platformId }, 'Failed to connect to Maersk');
            throw error;
        }
    }

    /**
     * Track a shipment by tracking number
     * @param {string} trackingNumber - Container or booking number
     */
    async trackShipment(trackingNumber) {
        try {
            logger.info({ trackingNumber }, 'Tracking Maersk shipment');

            if (this.status === 'connected_mock') {
                return this.generateMockTracking(trackingNumber);
            }

            // Real API call
            // const response = await axios.get(`${this.trackingUrl}${trackingNumber}`, {
            //     headers: { Authorization: `Bearer ${this.accessToken}` }
            // });
            // return this.transformTrackingData(response.data);

            return this.generateMockTracking(trackingNumber);

        } catch (error) {
            logger.error({ error, trackingNumber }, 'Failed to track Maersk shipment');
            throw error;
        }
    }

    /**
     * Create a booking request
     * @param {object} bookingData - Booking details
     */
    async createBooking(bookingData) {
        try {
            logger.info({ bookingData }, 'Creating Maersk booking');

            if (this.status === 'connected_mock') {
                return this.generateMockBooking(bookingData);
            }

            // Real API call would go here

            return this.generateMockBooking(bookingData);

        } catch (error) {
            logger.error({ error }, 'Failed to create Maersk booking');
            throw error;
        }
    }

    /**
     * Sync inventory is not applicable for logistics
     * @override
     */
    async syncInventory(options = {}) {
        logger.info('Maersk adapter: syncInventory is not applicable for logistics');
        return { success: true, message: 'Not applicable for logistics provider' };
    }

    /**
     * Push inventory is not applicable for logistics
     * @override
     */
    async pushInventory(items) {
        logger.info('Maersk adapter: pushInventory is not applicable for logistics');
        return { success: true, message: 'Not applicable for logistics provider' };
    }

    /**
     * Handle incoming webhook from Maersk
     */
    async handleWebhook(eventType, payload) {
        logger.info({ platformId: this.platformId, eventType }, 'Processing Maersk webhook');

        switch (eventType) {
            case 'shipment.status.changed':
                return this.handleShipmentStatusChange(payload);
            case 'shipment.departed':
                return this.handleShipmentDeparted(payload);
            case 'shipment.arrived':
                return this.handleShipmentArrived(payload);
            case 'shipment.delivered':
                return this.handleShipmentDelivered(payload);
            case 'shipment.exception':
                return this.handleShipmentException(payload);
            default:
                logger.warn({ eventType }, 'Unknown Maersk webhook event type');
                return { processed: false, reason: 'Unknown event type' };
        }
    }

    /**
     * Handle shipment status change
     */
    async handleShipmentStatusChange(payload) {
        const { trackingNumber, status, location, timestamp, estimatedArrival } = payload;

        await BridgeShipment.findOneAndUpdate(
            { trackingNumber },
            {
                status: this.mapStatus(status),
                currentLocation: location,
                estimatedDelivery: estimatedArrival,
                $push: {
                    statusHistory: {
                        status: this.mapStatus(status),
                        timestamp: new Date(timestamp),
                        location: location?.city || location?.name,
                    },
                    events: {
                        type: 'status_change',
                        description: `Status changed to ${status}`,
                        timestamp: new Date(timestamp),
                        location: location?.city,
                    }
                }
            },
            { upsert: true }
        );

        this.emit('shipment_updated', { trackingNumber, status });

        return { processed: true };
    }

    /**
     * Handle shipment departed
     */
    async handleShipmentDeparted(payload) {
        return this.handleShipmentStatusChange({
            ...payload,
            status: 'in_transit',
        });
    }

    /**
     * Handle shipment arrived
     */
    async handleShipmentArrived(payload) {
        return this.handleShipmentStatusChange({
            ...payload,
            status: 'arrived_at_port',
        });
    }

    /**
     * Handle shipment delivered
     */
    async handleShipmentDelivered(payload) {
        const result = await this.handleShipmentStatusChange({
            ...payload,
            status: 'delivered',
        });

        // Also update the LogisticsShipment model if exists
        await LogisticsShipment.findOneAndUpdate(
            { 'tracking.trackingNumber': payload.trackingNumber },
            {
                status: 'delivered',
                'timeline.deliveredAt': new Date(),
            }
        );

        return result;
    }

    /**
     * Handle shipment exception
     */
    async handleShipmentException(payload) {
        const { trackingNumber, exception } = payload;

        await BridgeShipment.findOneAndUpdate(
            { trackingNumber },
            {
                status: 'exception',
                'exception.code': exception.code,
                'exception.message': exception.message,
                'exception.timestamp': new Date(),
            }
        );

        // TODO: Notify relevant parties
        logger.warn({ trackingNumber, exception }, 'Shipment exception');

        return { processed: true };
    }

    /**
     * Update shipment status in BeZhas
     * @override
     */
    async updateShipment(trackingNumber, statusData) {
        return this.handleShipmentStatusChange({
            trackingNumber,
            ...statusData,
        });
    }

    /**
     * Create order is not applicable for logistics
     * @override
     */
    async createOrder(orderData) {
        // For logistics, we create a booking instead
        return this.createBooking(orderData);
    }

    /**
     * Map Maersk status to BeZhas status
     */
    mapStatus(maerskStatus) {
        const statusMap = {
            'Gate in (Out)': 'picked_up',
            'Loaded': 'in_transit',
            'Departed': 'in_transit',
            'Arrived': 'arrived_at_port',
            'Discharged': 'out_for_delivery',
            'Gate out': 'out_for_delivery',
            'Delivered': 'delivered',
            'Hold': 'exception',
            'Lost': 'exception',
        };

        return statusMap[maerskStatus] || 'in_transit';
    }

    /**
     * Generate mock tracking data
     */
    generateMockTracking(trackingNumber) {
        const now = new Date();
        const departureDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        const arrivalDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now

        return {
            trackingNumber,
            carrier: 'Maersk',
            status: 'in_transit',
            vessel: {
                name: 'Maersk Madrid',
                voyageNumber: 'MV2601',
            },
            route: {
                origin: {
                    port: 'ESVAL',
                    name: 'Valencia, Spain',
                    country: 'ES',
                },
                destination: {
                    port: 'CNSHA',
                    name: 'Shanghai, China',
                    country: 'CN',
                },
            },
            currentLocation: {
                coordinates: { lat: 29.8, lng: 32.5 },
                name: 'Suez Canal',
            },
            timeline: {
                departedAt: departureDate,
                estimatedArrival: arrivalDate,
            },
            events: [
                {
                    timestamp: departureDate,
                    status: 'Gate in',
                    location: 'Valencia, Spain',
                },
                {
                    timestamp: new Date(departureDate.getTime() + 1 * 24 * 60 * 60 * 1000),
                    status: 'Loaded',
                    location: 'Valencia Port',
                },
                {
                    timestamp: new Date(departureDate.getTime() + 2 * 24 * 60 * 60 * 1000),
                    status: 'Departed',
                    location: 'Valencia Port',
                },
                {
                    timestamp: now,
                    status: 'In Transit',
                    location: 'Suez Canal',
                },
            ],
            container: {
                number: trackingNumber,
                type: '40HC',
                sealNumber: `SEAL${Math.random().toString(36).substring(7).toUpperCase()}`,
            },
        };
    }

    /**
     * Generate mock booking confirmation
     */
    generateMockBooking(bookingData) {
        const bookingNumber = `MAEU${Date.now().toString().substring(5)}`;

        return {
            success: true,
            booking: {
                bookingNumber,
                status: 'confirmed',
                origin: bookingData.origin,
                destination: bookingData.destination,
                containerType: bookingData.containerType || '40HC',
                estimatedDeparture: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                estimatedArrival: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
                createdAt: new Date(),
            },
        };
    }

    /**
     * Transform Maersk tracking data to BeZhas format
     */
    transformToBeZhasFormat(maerskData) {
        return {
            trackingNumber: maerskData.trackingNumber || maerskData.containerNumber,
            carrier: 'Maersk',
            status: this.mapStatus(maerskData.latestEvent?.activityType),
            currentLocation: {
                city: maerskData.latestEvent?.location?.cityName,
                country: maerskData.latestEvent?.location?.countryCode,
                coordinates: maerskData.latestEvent?.location?.geo,
            },
            estimatedDelivery: maerskData.scheduledArrivalDateTimeLocal,
            events: maerskData.events?.map(e => ({
                timestamp: e.eventDateTime,
                status: e.activityType,
                location: e.location?.cityName,
                description: e.eventDescription,
            })) || [],
        };
    }

    /**
     * Transform BeZhas format to Maersk format (for bookings)
     */
    transformToExternalFormat(bezhasData) {
        return {
            originLocation: {
                UNLocationCode: bezhasData.origin?.portCode,
            },
            destinationLocation: {
                UNLocationCode: bezhasData.destination?.portCode,
            },
            commodity: bezhasData.commodity || 'General Cargo',
            containerType: bezhasData.containerType || '22G1',
            weight: bezhasData.weight,
            volume: bezhasData.volume,
        };
    }
}

module.exports = MaerskAdapter;
