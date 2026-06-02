/**
 * Sistema de Alertas - BeZhas
 * Envía notificaciones críticas a Discord/Slack cuando health < 60
 */

const axios = require('axios');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

class AlertSystemService {
    constructor() {
        this.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
        this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
        this.alertThreshold = parseInt(process.env.ALERT_THRESHOLD || '60');
        this.cooldownPeriod = 15 * 60 * 1000; // 15 minutos entre alertas similares
        this.lastAlerts = new Map(); // Track last alert times
    }

    /**
     * Envía alerta de health score bajo
     */
    async sendHealthAlert(healthScore, details) {
        const alertKey = `health_${Math.floor(healthScore / 10)}`;

        // Check cooldown
        if (this.isInCooldown(alertKey)) {
            logger.info(`Alert cooldown active for ${alertKey}, skipping`);
            return;
        }

        const severity = this.getSeverity(healthScore);
        const color = this.getColorCode(severity);

        const message = {
            embeds: [{
                title: `⚠️ Sistema BeZhas - Health Score Crítico`,
                description: `El sistema tiene un health score de **${healthScore}/100**`,
                color: color,
                fields: [
                    { name: 'Severidad', value: severity, inline: true },
                    { name: 'Timestamp', value: new Date().toISOString(), inline: true },
                    { name: 'Database', value: details.database ? '✅ OK' : '❌ Error', inline: true },
                    { name: 'Redis', value: details.redis ? '✅ OK' : '❌ Error', inline: true },
                    { name: 'Blockchain', value: details.blockchain ? '✅ OK' : '❌ Error', inline: true },
                    { name: 'API', value: details.api ? '✅ OK' : '❌ Error', inline: true }
                ],
                footer: { text: 'BeZhas Diagnostic System' },
                timestamp: new Date().toISOString()
            }]
        };

        if (details.recommendations && details.recommendations.length > 0) {
            message.embeds[0].fields.push({
                name: '📋 Recomendaciones',
                value: details.recommendations.slice(0, 3).join('\n'),
                inline: false
            });
        }

        await this.sendToChannels(message);
        this.updateLastAlert(alertKey);
    }

    /**
     * Envía alerta de error crítico
     */
    async sendCriticalError(category, error, affectedEntity) {
        const alertKey = `critical_${category}`;

        if (this.isInCooldown(alertKey)) {
            logger.info(`Alert cooldown active for ${alertKey}, skipping`);
            return;
        }

        const message = {
            embeds: [{
                title: `🚨 Error Crítico en ${category}`,
                description: error.message || error,
                color: 15158332, // Rojo
                fields: [
                    { name: 'Categoría', value: category, inline: true },
                    { name: 'Timestamp', value: new Date().toISOString(), inline: true }
                ],
                footer: { text: 'BeZhas Diagnostic System' },
                timestamp: new Date().toISOString()
            }]
        };

        if (affectedEntity) {
            message.embeds[0].fields.push({
                name: 'Entidad Afectada',
                value: `${affectedEntity.entityType}: ${affectedEntity.entityId}`,
                inline: false
            });
        }

        if (error.stack) {
            message.embeds[0].fields.push({
                name: 'Stack Trace',
                value: '```' + error.stack.substring(0, 500) + '```',
                inline: false
            });
        }

        await this.sendToChannels(message);
        this.updateLastAlert(alertKey);
    }

    /**
     * Envía alerta de sincronización exitosa
     */
    async sendSyncSuccess(userId, syncedBalance) {
        const message = {
            embeds: [{
                title: '✅ Auto-Recuperación Exitosa',
                description: `Balance sincronizado correctamente para usuario ${userId}`,
                color: 3066993, // Verde
                fields: [
                    { name: 'Usuario ID', value: userId.toString(), inline: true },
                    { name: 'Balance Actualizado', value: `${syncedBalance} BEZ`, inline: true },
                    { name: 'Timestamp', value: new Date().toISOString(), inline: true }
                ],
                footer: { text: 'BeZhas Auto-Recovery System' },
                timestamp: new Date().toISOString()
            }]
        };

        await this.sendToChannels(message);
    }

    /**
     * Envía alerta de transacción fallida
     */
    async sendTransactionFailure(txHash, reason, retryCount) {
        const alertKey = `tx_${txHash}`;

        if (this.isInCooldown(alertKey)) {
            return;
        }

        const message = {
            embeds: [{
                title: '⚠️ Transacción Blockchain Fallida',
                description: `Transacción ${txHash} ha fallado`,
                color: 16776960, // Amarillo
                fields: [
                    { name: 'TX Hash', value: txHash, inline: false },
                    { name: 'Razón', value: reason || 'Desconocida', inline: true },
                    { name: 'Reintentos', value: retryCount.toString(), inline: true },
                    { name: 'Timestamp', value: new Date().toISOString(), inline: true }
                ],
                footer: { text: 'BeZhas Blockchain Monitor' },
                timestamp: new Date().toISOString()
            }]
        };

        await this.sendToChannels(message);
        this.updateLastAlert(alertKey);
    }

    /**
     * Envía resumen diario de mantenimiento
     */
    async sendMaintenanceSummary(report) {
        const message = {
            embeds: [{
                title: '📊 Resumen de Mantenimiento Nocturno',
                description: report.aiSummary || 'Mantenimiento completado',
                color: 3447003, // Azul
                fields: [
                    { name: 'Usuarios Sincronizados', value: report.usersSynced?.toString() || '0', inline: true },
                    { name: 'Errores Resueltos', value: report.errorsFixed?.toString() || '0', inline: true },
                    { name: 'Health Score', value: `${report.finalHealthScore}/100`, inline: true }
                ],
                footer: { text: 'BeZhas Maintenance System' },
                timestamp: new Date().toISOString()
            }]
        };

        if (report.warnings && report.warnings.length > 0) {
            message.embeds[0].fields.push({
                name: '⚠️ Advertencias',
                value: report.warnings.slice(0, 5).join('\n'),
                inline: false
            });
        }

        await this.sendToChannels(message);
    }

    /**
     * Envía mensaje a todos los canales configurados
     */
    async sendToChannels(message) {
        const promises = [];

        // Discord
        if (this.discordWebhookUrl) {
            promises.push(
                axios.post(this.discordWebhookUrl, message)
                    .then(() => logger.info('Discord alert sent successfully'))
                    .catch(err => logger.error('Failed to send Discord alert:', err.message))
            );
        }

        // Slack (formato diferente)
        if (this.slackWebhookUrl) {
            const slackMessage = this.convertToSlackFormat(message);
            promises.push(
                axios.post(this.slackWebhookUrl, slackMessage)
                    .then(() => logger.info('Slack alert sent successfully'))
                    .catch(err => logger.error('Failed to send Slack alert:', err.message))
            );
        }

        if (promises.length === 0) {
            logger.warn('No webhook URLs configured, alerts not sent');
            return;
        }

        await Promise.allSettled(promises);
    }

    /**
     * Convierte formato Discord a Slack
     */
    convertToSlackFormat(discordMessage) {
        const embed = discordMessage.embeds[0];
        return {
            text: embed.title,
            attachments: [{
                color: this.getSlackColor(embed.color),
                title: embed.title,
                text: embed.description,
                fields: embed.fields.map(f => ({
                    title: f.name,
                    value: f.value,
                    short: f.inline || false
                })),
                footer: embed.footer?.text,
                ts: Math.floor(new Date(embed.timestamp).getTime() / 1000)
            }]
        };
    }

    /**
     * Check if alert is in cooldown period
     */
    isInCooldown(alertKey) {
        const lastAlert = this.lastAlerts.get(alertKey);
        if (!lastAlert) return false;
        return (Date.now() - lastAlert) < this.cooldownPeriod;
    }

    /**
     * Update last alert timestamp
     */
    updateLastAlert(alertKey) {
        this.lastAlerts.set(alertKey, Date.now());
    }

    /**
     * Determina severidad basada en health score
     */
    getSeverity(healthScore) {
        if (healthScore >= 80) return 'Bajo';
        if (healthScore >= 60) return 'Medio';
        if (healthScore >= 40) return 'Alto';
        return 'Crítico';
    }

    /**
     * Obtiene código de color Discord basado en severidad
     */
    getColorCode(severity) {
        const colors = {
            'Bajo': 3066993,     // Verde
            'Medio': 16776960,   // Amarillo
            'Alto': 16744192,    // Naranja
            'Crítico': 15158332  // Rojo
        };
        return colors[severity] || 8421504; // Gris por defecto
    }

    /**
     * Convierte color Discord a Slack
     */
    getSlackColor(discordColor) {
        const colorMap = {
            3066993: 'good',
            16776960: 'warning',
            16744192: 'warning',
            15158332: 'danger'
        };
        return colorMap[discordColor] || '#808080';
    }

    /**
     * Limpia alertas antiguas del cache
     */
    cleanupOldAlerts() {
        const now = Date.now();
        for (const [key, timestamp] of this.lastAlerts.entries()) {
            if (now - timestamp > this.cooldownPeriod * 2) {
                this.lastAlerts.delete(key);
            }
        }
    }
}

// Singleton instance
const alertSystem = new AlertSystemService();

// Cleanup old alerts every hour
setInterval(() => {
    alertSystem.cleanupOldAlerts();
}, 60 * 60 * 1000);

module.exports = alertSystem;
