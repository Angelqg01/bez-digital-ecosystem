/**
 * Notification Service
 * 
 * Sends alerts via multiple channels:
 * - Discord webhooks
 * - Slack webhooks
 * - Email (SMTP)
 * - SMS (Twilio) - optional
 * 
 * Usage:
 * await sendDiscordAlert({ title: 'Revenue!', description: '$5.00 collected' });
 * await sendSlackAlert({ text: 'New swap executed' });
 * await sendEmailAlert({ to: 'admin@bezhas.com', subject: 'Alert', body: '...' });
 */

const axios = require('axios');

class NotificationService {
    constructor(config = {}) {
        this.config = {
            discordWebhook: config.discordWebhook || process.env.DISCORD_WEBHOOK_URL,
            slackWebhook: config.slackWebhook || process.env.SLACK_WEBHOOK_URL,
            emailFrom: config.emailFrom || process.env.ALERT_EMAIL_FROM || 'noreply@bezhas.com',
            emailTo: config.emailTo || process.env.ALERT_EMAIL_TO,
            smtpHost: config.smtpHost || process.env.SMTP_HOST,
            smtpPort: config.smtpPort || process.env.SMTP_PORT || 587,
            smtpUser: config.smtpUser || process.env.SMTP_USER,
            smtpPass: config.smtpPass || process.env.SMTP_PASS,
            ...config
        };
    }

    /**
     * Send Discord webhook notification
     */
    async sendDiscord(options) {
        if (!this.config.discordWebhook) {
            console.warn('Discord webhook not configured');
            return { success: false, error: 'No webhook configured' };
        }

        try {
            const payload = this.formatDiscordPayload(options);

            await axios.post(this.config.discordWebhook, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });

            console.log('✅ Discord notification sent');
            return { success: true };
        } catch (error) {
            console.error('❌ Discord notification failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Format Discord embed payload
     */
    formatDiscordPayload(options) {
        const {
            title,
            description,
            color,
            fields = [],
            footer,
            thumbnail,
            url
        } = options;

        // Convert hex color to decimal
        const colorDecimal = typeof color === 'string'
            ? parseInt(color.replace('#', ''), 16)
            : color || 0x3b82f6; // Default blue

        return {
            embeds: [{
                title,
                description,
                color: colorDecimal,
                fields: fields.map(f => ({
                    name: f.name,
                    value: f.value,
                    inline: f.inline !== false
                })),
                footer: footer ? { text: footer } : { text: 'BeZhas Platform' },
                timestamp: new Date().toISOString(),
                thumbnail: thumbnail ? { url: thumbnail } : undefined,
                url: url || undefined
            }]
        };
    }

    /**
     * Send Slack webhook notification
     */
    async sendSlack(options) {
        if (!this.config.slackWebhook) {
            console.warn('Slack webhook not configured');
            return { success: false, error: 'No webhook configured' };
        }

        try {
            const payload = this.formatSlackPayload(options);

            await axios.post(this.config.slackWebhook, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });

            console.log('✅ Slack notification sent');
            return { success: true };
        } catch (error) {
            console.error('❌ Slack notification failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Format Slack message payload
     */
    formatSlackPayload(options) {
        const { text, blocks, attachments } = options;

        if (blocks) {
            return { blocks };
        }

        if (attachments) {
            return {
                text: text || 'BeZhas Platform Alert',
                attachments: attachments.map(a => ({
                    color: a.color || 'good',
                    title: a.title,
                    text: a.text,
                    fields: a.fields,
                    footer: a.footer || 'BeZhas Platform',
                    ts: Math.floor(Date.now() / 1000)
                }))
            };
        }

        return { text: text || 'BeZhas Platform Alert' };
    }

    /**
     * Send email notification (requires nodemailer)
     */
    async sendEmail(options) {
        if (!this.config.smtpHost || !this.config.emailTo) {
            console.warn('Email not configured');
            return { success: false, error: 'Email not configured' };
        }

        try {
            // Lazy load nodemailer
            const nodemailer = require('nodemailer');

            const transporter = nodemailer.createTransport({
                host: this.config.smtpHost,
                port: this.config.smtpPort,
                secure: this.config.smtpPort === 465,
                auth: {
                    user: this.config.smtpUser,
                    pass: this.config.smtpPass
                }
            });

            const mailOptions = {
                from: this.config.emailFrom,
                to: options.to || this.config.emailTo,
                subject: options.subject || 'BeZhas Platform Alert',
                text: options.body || options.text,
                html: options.html
            };

            await transporter.sendMail(mailOptions);

            console.log('✅ Email sent to', mailOptions.to);
            return { success: true };
        } catch (error) {
            console.error('❌ Email sending failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send multi-channel alert
     */
    async sendAlert(message, channels = ['discord', 'slack']) {
        const results = {};

        if (channels.includes('discord')) {
            results.discord = await this.sendDiscord({
                title: message.title || 'Platform Alert',
                description: message.description || message.text,
                color: message.color || 0x3b82f6,
                fields: message.fields
            });
        }

        if (channels.includes('slack')) {
            results.slack = await this.sendSlack({
                text: message.text || message.description,
                attachments: message.attachments
            });
        }

        if (channels.includes('email')) {
            results.email = await this.sendEmail({
                subject: message.subject || message.title,
                body: message.body || message.text || message.description
            });
        }

        return results;
    }
}

// ============================================================================
// Convenience Functions
// ============================================================================

const notificationService = new NotificationService();

/**
 * Send revenue alert (fee collected)
 */
async function sendRevenueAlert(data) {
    const { feeUSDC, user, serviceId, transactionHash } = data;

    return notificationService.sendAlert({
        title: '💰 Platform Revenue',
        description: `Fee collected: $${feeUSDC.toFixed(2)} USDC`,
        color: 0x10b981, // Green
        fields: [
            { name: 'User', value: `\`${user.slice(0, 6)}...${user.slice(-4)}\`` },
            { name: 'Service', value: serviceId },
            { name: 'Transaction', value: `[View on Polygonscan](https://polygonscan.com/tx/${transactionHash})` }
        ]
    });
}

/**
 * Send high-value transaction alert
 */
async function sendHighValueAlert(data) {
    const { amountUSDC, user, serviceId } = data;

    return notificationService.sendAlert({
        title: '🚨 High-Value Transaction',
        description: `Large swap detected: $${amountUSDC.toLocaleString()} USDC`,
        color: 0xf59e0b, // Orange
        fields: [
            { name: 'Amount', value: `$${amountUSDC.toLocaleString()} USDC` },
            { name: 'User', value: `\`${user}\`` },
            { name: 'Service', value: serviceId }
        ]
    });
}

/**
 * Send risk alert (high-risk transaction attempt)
 */
async function sendRiskAlert(data) {
    const { user, riskScore, riskFlags, amountUSDC } = data;

    return notificationService.sendAlert({
        title: '⚠️ High-Risk Transaction Blocked',
        description: `Risk score: ${riskScore}/100`,
        color: 0xef4444, // Red
        fields: [
            { name: 'User', value: `\`${user}\`` },
            { name: 'Amount', value: `$${amountUSDC} USDC` },
            { name: 'Risk Flags', value: riskFlags.join(', ') }
        ]
    });
}

/**
 * Send service delivery alert
 */
async function sendServiceDeliveryAlert(data) {
    const { serviceId, user, status, error } = data;

    const color = status === 'success' ? 0x10b981 : 0xef4444;
    const icon = status === 'success' ? '✅' : '❌';

    return notificationService.sendAlert({
        title: `${icon} Service Delivery ${status === 'success' ? 'Success' : 'Failed'}`,
        description: `Service: ${serviceId}`,
        color,
        fields: [
            { name: 'User', value: `\`${user}\`` },
            { name: 'Status', value: status },
            ...(error ? [{ name: 'Error', value: error }] : [])
        ]
    });
}

/**
 * Send daily revenue report
 */
async function sendDailyReport(data) {
    const {
        totalFees,
        totalVolume,
        transactions,
        topUser,
        date
    } = data;

    return notificationService.sendAlert({
        title: '📊 Daily Revenue Report',
        description: `Report for ${date}`,
        color: 0x3b82f6, // Blue
        fields: [
            { name: 'Total Revenue', value: `$${totalFees.toFixed(2)}` },
            { name: 'Total Volume', value: `$${totalVolume.toFixed(2)}` },
            { name: 'Transactions', value: transactions.toString() },
            { name: 'Avg Fee', value: `$${(totalFees / transactions).toFixed(2)}` },
            ...(topUser ? [{ name: 'Top User', value: `\`${topUser}\`` }] : [])
        ]
    }, ['discord', 'slack', 'email']);
}

/**
 * Send system error alert
 */
async function sendErrorAlert(error, context = {}) {
    return notificationService.sendAlert({
        title: '🔴 System Error',
        description: error.message || 'An error occurred',
        color: 0xef4444, // Red
        fields: [
            { name: 'Error Type', value: error.name || 'Unknown' },
            { name: 'Stack', value: `\`\`\`${error.stack?.slice(0, 500) || 'N/A'}\`\`\`` },
            ...(context.service ? [{ name: 'Service', value: context.service }] : []),
            ...(context.user ? [{ name: 'User', value: context.user }] : [])
        ]
    }, ['discord', 'slack']);
}

/**
 * Test all notification channels
 */
async function testNotifications() {
    console.log('🧪 Testing notification channels...\n');

    // Test Discord
    console.log('Testing Discord...');
    const discordResult = await notificationService.sendDiscord({
        title: '🧪 Test Notification',
        description: 'This is a test notification from BeZhas Revenue Stream Native',
        color: 0x3b82f6,
        fields: [
            { name: 'Status', value: 'Testing' },
            { name: 'Timestamp', value: new Date().toISOString() }
        ]
    });
    console.log('Discord result:', discordResult);

    // Test Slack
    console.log('\nTesting Slack...');
    const slackResult = await notificationService.sendSlack({
        text: '🧪 Test notification from BeZhas Revenue Stream Native',
        attachments: [{
            color: 'good',
            title: 'Test Notification',
            text: 'All systems operational',
            fields: [
                { title: 'Status', value: 'Testing', short: true },
                { title: 'Time', value: new Date().toISOString(), short: true }
            ]
        }]
    });
    console.log('Slack result:', slackResult);

    // Test Email
    console.log('\nTesting Email...');
    const emailResult = await notificationService.sendEmail({
        subject: '🧪 Test Email - BeZhas Revenue Stream',
        body: 'This is a test email from the BeZhas Revenue Stream Native notification system.',
        html: `
      <h2>🧪 Test Email</h2>
      <p>This is a test email from the <strong>BeZhas Revenue Stream Native</strong> notification system.</p>
      <p>If you received this, the email system is working correctly!</p>
      <hr>
      <small>Sent at: ${new Date().toISOString()}</small>
    `
    });
    console.log('Email result:', emailResult);

    console.log('\n✅ Notification tests completed');
}

// CLI usage
if (require.main === module) {
    testNotifications().catch(console.error);
}

module.exports = {
    NotificationService,
    notificationService,
    sendRevenueAlert,
    sendHighValueAlert,
    sendRiskAlert,
    sendServiceDeliveryAlert,
    sendDailyReport,
    sendErrorAlert,
    testNotifications
};
