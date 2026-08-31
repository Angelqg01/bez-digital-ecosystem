const { broadcastAdEvent } = require('../websocket-server');
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Quality Oracle Notification Service
 * Sends real-time notifications for Quality Oracle events
 */
class QualityNotificationService {
    constructor(wsServer) {
        this.wsServer = wsServer;
        this.eventTypes = {
            SERVICE_CREATED: 'quality_oracle:service_created',
            SERVICE_FINALIZED: 'quality_oracle:service_finalized',
            DISPUTE_OPENED: 'quality_oracle:dispute_opened',
            DISPUTE_RESOLVED: 'quality_oracle:dispute_resolved',
            QUALITY_THRESHOLD_WARNING: 'quality_oracle:quality_warning',
            COLLATERAL_RELEASED: 'quality_oracle:collateral_released',
            PENALTY_APPLIED: 'quality_oracle:penalty_applied'
        };
    }

    /**
     * Send notification to specific user
     */
    sendToUser(address, notification) {
        if (!this.wsServer) {
            logger.warn('WebSocket server not initialized');
            return false;
        }

        try {
            return this.wsServer.sendNotificationToUser(address, {
                ...notification,
                timestamp: Date.now(),
                category: 'quality_oracle'
            });
        } catch (error) {
            logger.error({ error: error.message, address }, 'Error sending notification to user');
            return false;
        }
    }

    /**
     * Broadcast to all connected users
     */
    broadcast(notification) {
        if (!this.wsServer) {
            logger.warn('WebSocket server not initialized');
            return;
        }

        try {
            this.wsServer.broadcast({
                type: 'quality_oracle_update',
                data: {
                    ...notification,
                    timestamp: Date.now()
                }
            });
        } catch (error) {
            logger.error({ error: error.message }, 'Error broadcasting notification');
        }
    }

    /**
     * Service Created Notification
     */
    notifyServiceCreated(serviceData) {
        const { serviceId, client, provider, collateral, initialQuality } = serviceData;

        // Notify provider
        this.sendToUser(provider, {
            type: this.eventTypes.SERVICE_CREATED,
            title: '🎯 New Quality Service',
            message: `You've been assigned service #${serviceId} with ${collateral} BEZ collateral`,
            data: {
                serviceId,
                collateral,
                initialQuality,
                client
            },
            priority: 'high',
            actionUrl: `/admin/quality-oracle?service=${serviceId}`
        });

        // Notify client
        this.sendToUser(client, {
            type: this.eventTypes.SERVICE_CREATED,
            title: '✅ Service Created',
            message: `Service #${serviceId} created with ${initialQuality}% initial quality`,
            data: {
                serviceId,
                provider,
                collateral,
                initialQuality
            },
            priority: 'medium',
            actionUrl: `/admin/quality-oracle?service=${serviceId}`
        });

        // Broadcast to admins
        this.broadcast({
            type: this.eventTypes.SERVICE_CREATED,
            title: 'New Quality Service',
            message: `Service #${serviceId} created`,
            data: serviceData
        });

        logger.info({ serviceId, provider, client }, 'Service created notification sent');
    }

    /**
     * Service Finalized Notification
     */
    notifyServiceFinalized(serviceData) {
        const { serviceId, provider, finalQuality, collateralReturned, penaltyApplied } = serviceData;

        const emoji = finalQuality >= 85 ? '🌟' : finalQuality >= 70 ? '✅' : '⚠️';
        const status = finalQuality >= 85 ? 'Excellent' : finalQuality >= 70 ? 'Good' : 'Below threshold';

        // Notify provider
        this.sendToUser(provider, {
            type: this.eventTypes.SERVICE_FINALIZED,
            title: `${emoji} Service Finalized`,
            message: `Service #${serviceId} completed with ${finalQuality}% quality (${status})`,
            data: {
                serviceId,
                finalQuality,
                collateralReturned,
                penaltyApplied,
                status
            },
            priority: penaltyApplied > 0 ? 'high' : 'medium',
            actionUrl: `/admin/quality-oracle?service=${serviceId}`
        });

        // Additional penalty warning
        if (penaltyApplied > 0) {
            this.sendToUser(provider, {
                type: this.eventTypes.PENALTY_APPLIED,
                title: '⚠️ Quality Penalty Applied',
                message: `${penaltyApplied} BEZ penalty for quality ${finalQuality}% (below 85%)`,
                data: {
                    serviceId,
                    penaltyApplied,
                    finalQuality
                },
                priority: 'high',
                actionUrl: `/admin/quality-oracle?service=${serviceId}`
            });
        }

        logger.info({ serviceId, finalQuality, penaltyApplied }, 'Service finalized notification sent');
    }

    /**
     * Dispute Opened Notification
     */
    notifyDisputeOpened(disputeData) {
        const { serviceId, provider, client, reason } = disputeData;

        // Notify provider
        this.sendToUser(provider, {
            type: this.eventTypes.DISPUTE_OPENED,
            title: '⚡ Dispute Opened',
            message: `Client opened dispute for service #${serviceId}: ${reason}`,
            data: {
                serviceId,
                reason,
                client
            },
            priority: 'critical',
            actionUrl: `/admin/quality-oracle?service=${serviceId}`
        });

        // Notify admins (broadcast)
        this.broadcast({
            type: this.eventTypes.DISPUTE_OPENED,
            title: 'Quality Dispute Requires Review',
            message: `Service #${serviceId} - ${reason}`,
            data: disputeData
        });

        logger.warn({ serviceId, provider, client }, 'Dispute opened notification sent');
    }

    /**
     * Dispute Resolved Notification
     */
    notifyDisputeResolved(disputeData) {
        const { serviceId, provider, client, resolution, refundAmount } = disputeData;

        // Notify both parties
        const parties = [provider, client];
        parties.forEach(address => {
            this.sendToUser(address, {
                type: this.eventTypes.DISPUTE_RESOLVED,
                title: '✅ Dispute Resolved',
                message: `Service #${serviceId} dispute resolved: ${resolution}`,
                data: {
                    serviceId,
                    resolution,
                    refundAmount
                },
                priority: 'high',
                actionUrl: `/admin/quality-oracle?service=${serviceId}`
            });
        });

        logger.info({ serviceId, resolution }, 'Dispute resolved notification sent');
    }

    /**
     * Quality Threshold Warning
     */
    notifyQualityWarning(warningData) {
        const { serviceId, provider, currentQuality, threshold } = warningData;

        this.sendToUser(provider, {
            type: this.eventTypes.QUALITY_THRESHOLD_WARNING,
            title: '⚠️ Quality Below Threshold',
            message: `Service #${serviceId}: Quality ${currentQuality}% is below ${threshold}%`,
            data: {
                serviceId,
                currentQuality,
                threshold,
                riskLevel: currentQuality < 70 ? 'high' : 'medium'
            },
            priority: 'high',
            actionUrl: `/admin/quality-oracle?service=${serviceId}`
        });

        logger.warn({ serviceId, currentQuality, threshold }, 'Quality warning notification sent');
    }

    /**
     * Collateral Released Notification
     */
    notifyCollateralReleased(releaseData) {
        const { serviceId, provider, amount, finalQuality } = releaseData;

        this.sendToUser(provider, {
            type: this.eventTypes.COLLATERAL_RELEASED,
            title: '💰 Collateral Released',
            message: `${amount} BEZ collateral returned for service #${serviceId}`,
            data: {
                serviceId,
                amount,
                finalQuality
            },
            priority: 'medium',
            actionUrl: `/admin/quality-oracle?service=${serviceId}`
        });

        logger.info({ serviceId, amount }, 'Collateral released notification sent');
    }

    /**
     * Daily Summary for Provider
     */
    notifyDailySummary(provider, summaryData) {
        const { totalServices, avgQuality, totalEarned, totalPenalties } = summaryData;

        this.sendToUser(provider, {
            type: 'quality_oracle:daily_summary',
            title: '📊 Daily Quality Summary',
            message: `${totalServices} services | Avg: ${avgQuality}% | Earned: ${totalEarned} BEZ`,
            data: {
                totalServices,
                avgQuality,
                totalEarned,
                totalPenalties,
                date: new Date().toISOString().split('T')[0]
            },
            priority: 'low',
            actionUrl: '/admin/quality-oracle'
        });

        logger.info({ provider, totalServices, avgQuality }, 'Daily summary notification sent');
    }

    /**
     * System-wide Statistics Update
     */
    broadcastStats(stats) {
        this.broadcast({
            type: 'quality_oracle:stats_update',
            title: 'Quality Oracle Stats',
            data: stats
        });
    }
}

module.exports = QualityNotificationService;
