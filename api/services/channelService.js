/**
 * channelService.js — Multichannel communication: email, WhatsApp, Telegram, Discord, Slack, webhook.
 *
 * Architecture:
 *  - Channels registered per user (with verification flow)
 *  - Messages sent through a unified dispatch interface
 *  - Template system for common notifications
 *  - Notification preferences per event type
 *  - All messages logged for audit
 *
 * Security:
 *  - Channel verification via random code
 *  - Parameterized SQL queries
 *  - Rate limiting at route level
 */
const crypto = require('crypto');
const { query } = require('../db/pool');
const { cacheGet, cacheSet, cacheDelete, publish } = require('../cache/redis');

// ── Message Templates ──

const TEMPLATES = {
    transaction_confirmed: {
        subject: 'Transaction Confirmed',
        body: 'Your transaction {{txHash}} has been confirmed on block {{blockNumber}}.',
    },
    payment_received: {
        subject: 'Payment Received',
        body: 'You received {{amount}} BEZ from {{sender}}. TX: {{txHash}}',
    },
    document_approved: {
        subject: 'Document Approved',
        body: 'Your document "{{title}}" has been approved by validator {{validator}}.',
    },
    document_rejected: {
        subject: 'Document Rejected',
        body: 'Your document "{{title}}" was rejected. Reason: {{reason}}',
    },
    validator_reward: {
        subject: 'Validator Reward Claimed',
        body: 'You earned {{amount}} BEZ as validator reward. Tier: {{tier}}.',
    },
    qr_scanned: {
        subject: 'QR Code Scanned',
        body: 'Your QR code ({{qrType}}) was scanned. Remaining scans: {{remaining}}.',
    },
    security_alert: {
        subject: 'Security Alert',
        body: '{{message}}',
    },
    shipment_update: {
        subject: 'Shipment Update',
        body: 'Shipment {{shipmentId}} status updated to: {{status}}. Location: {{location}}.',
    },
};

function renderTemplate(templateName, vars) {
    const tmpl = TEMPLATES[templateName];
    if (!tmpl) return null;

    let subject = tmpl.subject;
    let body = tmpl.body;

    for (const [key, value] of Object.entries(vars || {})) {
        const placeholder = `{{${key}}}`;
        subject = subject.replaceAll(placeholder, String(value));
        body = body.replaceAll(placeholder, String(value));
    }

    return { subject, body };
}

// ── Channel Management ──

function generateVerificationCode() {
    return crypto.randomInt(100000, 999999).toString();
}

async function registerChannel(userId, channelType, channelId, displayName) {
    const verificationCode = generateVerificationCode();

    const { rows } = await query(
        `INSERT INTO channels (user_id, channel_type, channel_id, display_name, verification_code)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, channel_type, channel_id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            verification_code = EXCLUDED.verification_code,
            is_verified = FALSE,
            updated_at = NOW()
         RETURNING id, channel_type, channel_id, display_name, is_verified, created_at`,
        [userId, channelType, channelId, displayName || null, verificationCode]
    );

    // In production: send verification code through the channel
    // For now, return it in dev mode for testing
    const result = rows[0];
    if (process.env.NODE_ENV !== 'production') {
        result._verificationCode = verificationCode;
    }

    return result;
}

async function verifyChannel(userId, channelType, channelId, code) {
    const { rows } = await query(
        `UPDATE channels SET 
            is_verified = TRUE, 
            verified_at = NOW(), 
            verification_code = NULL,
            updated_at = NOW()
         WHERE user_id = $1 AND channel_type = $2 AND channel_id = $3 
            AND verification_code = $4 AND is_verified = FALSE
         RETURNING id, channel_type, channel_id, is_verified`,
        [userId, channelType, channelId, code]
    );

    if (rows.length === 0) return { success: false, error: 'Invalid verification code or channel' };
    return { success: true, channel: rows[0] };
}

async function getUserChannels(userId) {
    const cacheKey = `channels:${userId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    const { rows } = await query(
        `SELECT id, channel_type, channel_id, display_name, is_verified, is_active, verified_at, created_at
         FROM channels WHERE user_id = $1 AND is_active = TRUE
         ORDER BY channel_type, created_at`,
        [userId]
    );

    await cacheSet(cacheKey, rows, 60);
    return rows;
}

async function removeChannel(userId, channelId) {
    const { rowCount } = await query(
        'UPDATE channels SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND user_id = $2',
        [channelId, userId]
    );
    await cacheDelete(`channels:${userId}`);
    return rowCount > 0;
}

// ── Send Message ──

async function sendMessage({ userId, channelType, recipient, template, templateVars, subject, body }) {
    let finalSubject = subject;
    let finalBody = body;

    if (template) {
        const rendered = renderTemplate(template, templateVars);
        if (rendered) {
            finalSubject = rendered.subject;
            finalBody = rendered.body;
        }
    }

    if (!finalBody) throw new Error('Message body is required');

    // Log the message
    const { rows } = await query(
        `INSERT INTO messages (user_id, channel_type, recipient, template, subject, body, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'queued')
         RETURNING id, channel_type, recipient, subject, status, created_at`,
        [userId || null, channelType, recipient, template || null, finalSubject || null, finalBody]
    );

    const message = rows[0];

    // Dispatch to channel adapter (async, non-blocking)
    dispatchMessage(message.id, channelType, recipient, finalSubject, finalBody).catch(err => {
        console.error(`[CHANNEL] Dispatch failed for ${message.id}:`, err.message);
    });

    return message;
}

async function dispatchMessage(messageId, channelType, recipient, subject, body) {
    try {
        let externalId = null;

        switch (channelType) {
            case 'email':
                externalId = await sendEmail(recipient, subject, body);
                break;
            case 'webhook':
                externalId = await sendWebhook(recipient, { subject, body });
                break;
            case 'whatsapp':
            case 'telegram':
            case 'discord':
            case 'slack':
            case 'sms':
                // Queue for external adapter processing
                await publish('channel:dispatch', { messageId, channelType, recipient, subject, body });
                await query(
                    "UPDATE messages SET status = 'queued', sent_at = NOW() WHERE id = $1",
                    [messageId]
                );
                return;
            default:
                throw new Error(`Unsupported channel type: ${channelType}`);
        }

        await query(
            "UPDATE messages SET status = 'sent', external_id = $1, sent_at = NOW() WHERE id = $2",
            [externalId, messageId]
        );
    } catch (err) {
        await query(
            "UPDATE messages SET status = 'failed', error_message = $1 WHERE id = $2",
            [err.message, messageId]
        );
    }
}

// ── Channel Adapters ──

async function sendEmail(to, subject, body) {
    // Nodemailer integration point
    if (process.env.SMTP_HOST) {
        const nodemailer = require('nodemailer');
        const transport = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT, 10) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });

        const result = await transport.sendMail({
            from: process.env.SMTP_FROM || 'noreply@bez.digital',
            to,
            subject,
            text: body,
            html: `<div style="font-family:sans-serif;padding:20px;"><p>${body.replace(/\n/g, '<br>')}</p><hr><p style="color:#888;font-size:12px;">BeZhas Blockchain Platform</p></div>`,
        });

        return result.messageId;
    }

    console.log(`[EMAIL] (dev) To: ${to} | Subject: ${subject} | Body: ${body}`);
    return `dev-email-${Date.now()}`;
}

async function sendWebhook(url, payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'bezhas', timestamp: new Date().toISOString(), ...payload }),
            signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
        return `webhook-${res.status}-${Date.now()}`;
    } finally {
        clearTimeout(timeout);
    }
}

// ── Notification Dispatch (event-driven) ──

async function notifyUser(userId, eventType, templateVars) {
    // Get user notification preferences
    const { rows: prefs } = await query(
        `SELECT channel_types FROM notification_preferences
         WHERE user_id = $1 AND event_type = $2 AND is_enabled = TRUE`,
        [userId, eventType]
    );

    // Default: send to all verified channels if no preferences set
    let targetChannelTypes;
    if (prefs.length > 0 && prefs[0].channel_types?.length > 0) {
        targetChannelTypes = prefs[0].channel_types;
    } else {
        const channels = await getUserChannels(userId);
        targetChannelTypes = [...new Set(channels.filter(c => c.is_verified).map(c => c.channel_type))];
    }

    if (targetChannelTypes.length === 0) return [];

    // Get verified channels for these types
    const { rows: channels } = await query(
        `SELECT id, channel_type, channel_id FROM channels
         WHERE user_id = $1 AND channel_type = ANY($2) AND is_verified = TRUE AND is_active = TRUE`,
        [userId, targetChannelTypes]
    );

    const results = [];
    for (const ch of channels) {
        try {
            const msg = await sendMessage({
                userId,
                channelType: ch.channel_type,
                recipient: ch.channel_id,
                template: eventType,
                templateVars,
            });
            results.push({ channel: ch.channel_type, messageId: msg.id, status: 'queued' });
        } catch (err) {
            results.push({ channel: ch.channel_type, error: err.message });
        }
    }

    // Also create an in-app notification
    const rendered = renderTemplate(eventType, templateVars);
    if (rendered) {
        await query(
            `INSERT INTO notifications (user_id, type, title, message, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, eventType, rendered.subject, rendered.body, JSON.stringify(templateVars)]
        );
        await publish('notification:new', { userId, type: eventType, title: rendered.subject });
    }

    return results;
}

// ── Preferences ──

async function getNotificationPreferences(userId) {
    const { rows } = await query(
        'SELECT * FROM notification_preferences WHERE user_id = $1 ORDER BY event_type',
        [userId]
    );
    return rows;
}

async function setNotificationPreference(userId, eventType, channelTypes, isEnabled = true) {
    const { rows } = await query(
        `INSERT INTO notification_preferences (user_id, event_type, channel_types, is_enabled)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, event_type) DO UPDATE SET
            channel_types = EXCLUDED.channel_types,
            is_enabled = EXCLUDED.is_enabled,
            updated_at = NOW()
         RETURNING *`,
        [userId, eventType, channelTypes, isEnabled]
    );
    return rows[0];
}

// ── Message History ──

async function getMessageHistory(userId, { channelType, status, limit = 50 } = {}) {
    let sql = 'SELECT * FROM messages WHERE user_id = $1';
    const params = [userId];
    let idx = 2;

    if (channelType) { sql += ` AND channel_type = $${idx++}`; params.push(channelType); }
    if (status) { sql += ` AND status = $${idx++}`; params.push(status); }

    sql += ` ORDER BY created_at DESC LIMIT $${idx++}`;
    params.push(limit);

    const { rows } = await query(sql, params);
    return rows;
}

module.exports = {
    TEMPLATES,
    renderTemplate,
    registerChannel,
    verifyChannel,
    getUserChannels,
    removeChannel,
    sendMessage,
    notifyUser,
    getNotificationPreferences,
    setNotificationPreference,
    getMessageHistory,
};
