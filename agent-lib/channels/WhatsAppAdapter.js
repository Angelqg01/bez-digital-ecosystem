/**
 * WhatsAppAdapter.js — Connects the UnifiedAgent to WhatsApp Cloud API.
 *
 * Implements webhook verification and incoming message handling
 * for the Meta WhatsApp Business Cloud API.
 *
 * Requires an Express router to be mounted for webhook endpoints.
 */
const axios = require('axios');
const crypto = require('crypto');
const eventBus = require('../core/RuntimeEventBus');

const WA_API = 'https://graph.facebook.com/v19.0';

class WhatsAppAdapter {
    /** @type {import('../core/UnifiedAgent')} */
    #agent = null;
    #phoneNumberId = '';
    #accessToken = '';
    #verifyToken = '';

    /**
     * @param {import('../core/UnifiedAgent')} agent
     * @param {{ phoneNumberId: string, accessToken: string, verifyToken: string }} config
     */
    constructor(agent, config) {
        this.#agent = agent;
        this.#phoneNumberId = config.phoneNumberId;
        this.#accessToken = config.accessToken;
        this.#verifyToken = config.verifyToken || crypto.randomBytes(16).toString('hex');
    }

    /**
     * Returns an Express router to mount at /api/agent/webhook/whatsapp
     */
    createRouter() {
        const { Router } = require('express');
        const router = Router();

        // Webhook verification (GET)
        router.get('/', (req, res) => {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];

            if (mode === 'subscribe' && token === this.#verifyToken) {
                console.log('[WhatsApp] Webhook verified.');
                return res.status(200).send(challenge);
            }
            res.status(403).send('Forbidden');
        });

        // Incoming messages (POST)
        router.post('/', async (req, res) => {
            // Respond 200 immediately to avoid retries
            res.sendStatus(200);

            try {
                const body = req.body;
                const entry = body?.entry?.[0];
                const changes = entry?.changes?.[0];
                const value = changes?.value;

                if (!value?.messages?.[0]) return;

                const msg = value.messages[0];
                if (msg.type !== 'text') return;

                const from = msg.from; // phone number
                const text = msg.text.body;

                eventBus.publish('channel:whatsapp:message', {
                    from,
                    text: text.slice(0, 200),
                });

                const response = await this.#agent.processMessage(text, {
                    userId: `whatsapp:${from}`,
                    role: 'operator',
                    channel: 'whatsapp',
                    address: null,
                });

                await this._send(from, response.text);
            } catch (err) {
                console.error('[WhatsApp] Message handling error:', err.message);
            }
        });

        return router;
    }

    async _send(to, text) {
        if (!this.#phoneNumberId || !this.#accessToken) {
            console.warn('[WhatsApp] Not configured — cannot send message.');
            return;
        }

        try {
            // WhatsApp max is ~4096 chars per message
            const chunks = this._chunk(text, 4000);
            for (const chunk of chunks) {
                await axios.post(
                    `${WA_API}/${this.#phoneNumberId}/messages`,
                    {
                        messaging_product: 'whatsapp',
                        to,
                        type: 'text',
                        text: { body: chunk },
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${this.#accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        timeout: 10000,
                    },
                );
            }
        } catch (err) {
            console.error('[WhatsApp] Send error:', err.response?.data || err.message);
        }
    }

    _chunk(text, maxLen) {
        if (text.length <= maxLen) return [text];
        const chunks = [];
        let remaining = text;
        while (remaining.length > 0) {
            chunks.push(remaining.slice(0, maxLen));
            remaining = remaining.slice(maxLen);
        }
        return chunks;
    }

    /** Get the verify token for webhook setup. */
    getVerifyToken() {
        return this.#verifyToken;
    }
}

module.exports = WhatsAppAdapter;
