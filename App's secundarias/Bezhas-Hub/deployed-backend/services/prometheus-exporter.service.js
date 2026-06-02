/**
 * Prometheus Metrics Exporter
 * 
 * Expone métricas en formato Prometheus para Grafana
 */

const client = require('prom-client');
const { getDatabaseService } = require('./databaseService');

class PrometheusExporter {
    constructor() {
        // Create a Registry
        this.register = new client.Registry();

        // Add default metrics
        client.collectDefaultMetrics({ register: this.register });

        // Custom metrics
        this.setupMetrics();
    }

    setupMetrics() {
        // ━━━ Revenue Metrics ━━━
        this.totalRevenueGauge = new client.Gauge({
            name: 'bezhas_total_revenue_usd',
            help: 'Total revenue collected in USD',
            registers: [this.register]
        });

        this.totalVolumeGauge = new client.Gauge({
            name: 'bezhas_total_volume_usd',
            help: 'Total transaction volume in USD',
            registers: [this.register]
        });

        this.totalSwapsCounter = new client.Counter({
            name: 'bezhas_total_swaps',
            help: 'Total number of swaps processed',
            registers: [this.register]
        });

        // ━━━ User Metrics ━━━
        this.uniqueUsersGauge = new client.Gauge({
            name: 'bezhas_unique_users_total',
            help: 'Total number of unique users',
            registers: [this.register]
        });

        this.newUsersGauge = new client.Gauge({
            name: 'bezhas_new_users_24h',
            help: 'New users in last 24 hours',
            registers: [this.register]
        });

        // ━━━ Service Metrics ━━━
        this.swapsByService = new client.Gauge({
            name: 'bezhas_swaps_by_service',
            help: 'Number of swaps by service type',
            labelNames: ['service_id'],
            registers: [this.register]
        });

        this.volumeByService = new client.Gauge({
            name: 'bezhas_volume_by_service_usd',
            help: 'Volume by service type in USD',
            labelNames: ['service_id'],
            registers: [this.register]
        });

        // ━━━ Risk Metrics ━━━
        this.avgRiskScoreGauge = new client.Gauge({
            name: 'bezhas_avg_risk_score',
            help: 'Average risk score of transactions',
            registers: [this.register]
        });

        this.blockedSwapsCounter = new client.Counter({
            name: 'bezhas_blocked_swaps_total',
            help: 'Total number of blocked swaps',
            registers: [this.register]
        });

        this.highRiskSwapsGauge = new client.Gauge({
            name: 'bezhas_high_risk_swaps_24h',
            help: 'High risk swaps in last 24 hours',
            registers: [this.register]
        });

        // ━━━ System Metrics ━━━
        this.systemUptimeGauge = new client.Gauge({
            name: 'bezhas_system_uptime_seconds',
            help: 'System uptime in seconds',
            registers: [this.register]
        });

        this.eventProcessingLatency = new client.Histogram({
            name: 'bezhas_event_processing_duration_seconds',
            help: 'Event processing latency in seconds',
            buckets: [0.1, 0.5, 1, 2, 5, 10],
            registers: [this.register]
        });

        // ━━━ Service Delivery Metrics ━━━
        this.pendingDeliveriesGauge = new client.Gauge({
            name: 'bezhas_pending_deliveries',
            help: 'Number of pending service deliveries',
            registers: [this.register]
        });

        this.failedDeliveriesCounter = new client.Counter({
            name: 'bezhas_failed_deliveries_total',
            help: 'Total number of failed deliveries',
            registers: [this.register]
        });

        // ━━━ Health Metrics ━━━
        this.healthStatusGauge = new client.Gauge({
            name: 'bezhas_health_status',
            help: 'System health status (1=healthy, 0.5=degraded, 0=unhealthy)',
            registers: [this.register]
        });
    }

    async updateMetrics() {
        try {
            const db = getDatabaseService();

            // Get last 24 hours stats
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const dailyStats = await db.getDailyStats(yesterday, new Date());

            if (dailyStats.length > 0) {
                const latest = dailyStats[dailyStats.length - 1];

                // Update revenue metrics
                this.totalRevenueGauge.set(parseFloat(latest.totalFees));
                this.totalVolumeGauge.set(parseFloat(latest.totalVolume));

                // Update user metrics
                this.uniqueUsersGauge.set(latest.uniqueUsers);
                this.newUsersGauge.set(latest.newUsers);

                // Update risk metrics
                if (latest.avgRiskScore) {
                    this.avgRiskScoreGauge.set(latest.avgRiskScore);
                }
                this.highRiskSwapsGauge.set(latest.highRiskSwaps);
            }

            // Get pending deliveries
            const pendingDeliveries = await db.getPendingDeliveries();
            this.pendingDeliveriesGauge.set(pendingDeliveries.length);

            // System uptime
            this.systemUptimeGauge.set(process.uptime());

            // Get service breakdown (if available in serviceStats)
            if (dailyStats.length > 0 && dailyStats[0].serviceStats) {
                const services = dailyStats[0].serviceStats;
                for (const [serviceId, stats] of Object.entries(services)) {
                    this.swapsByService.set({ service_id: serviceId }, stats.count || 0);
                    this.volumeByService.set({ service_id: serviceId }, stats.volume || 0);
                }
            }

        } catch (error) {
            console.error('Error updating Prometheus metrics:', error);
        }
    }

    async getMetrics() {
        await this.updateMetrics();
        return this.register.metrics();
    }

    // Record event processing time
    recordEventLatency(durationSeconds) {
        this.eventProcessingLatency.observe(durationSeconds);
    }

    // Increment counters
    incrementSwaps() {
        this.totalSwapsCounter.inc();
    }

    incrementBlockedSwaps() {
        this.blockedSwapsCounter.inc();
    }

    incrementFailedDeliveries() {
        this.failedDeliveriesCounter.inc();
    }

    // Update health status
    setHealthStatus(status) {
        const statusMap = {
            healthy: 1,
            degraded: 0.5,
            unhealthy: 0
        };
        this.healthStatusGauge.set(statusMap[status] || 0);
    }
}

// Singleton instance
let exporter = null;

function getPrometheusExporter() {
    if (!exporter) {
        exporter = new PrometheusExporter();
    }
    return exporter;
}

module.exports = { PrometheusExporter, getPrometheusExporter };
