/**
 * TelegramAdapter.js — Connects the UnifiedAgent to Telegram Bot API.
 *
 * Uses long-polling (no webhook server needed for dev).
 * In production, switch to webhook mode via setWebhook.
 */
const axios = require('axios');
const eventBus = require('../core/RuntimeEventBus');

const TELEGRAM_API = 'https://api.telegram.org/bot';

class TelegramAdapter {
    /** @type {import('../core/UnifiedAgent')} */
    #agent = null;
    #token = '';
    #role = 'admin';
    #allowedChatIds = new Set();
    #polling = false;
    #offset = 0;
    #pollTimer = null;

    /**
     * @param {import('../core/UnifiedAgent')} agent
     * @param {{ botToken: string, allowedChatIds?: string, role?: string }} config
     */
    constructor(agent, config) {
        this.#agent = agent;
        this.#token = config.botToken;
        this.#role = config.role || 'admin';
        if (config.allowedChatIds) {
            for (const id of config.allowedChatIds.split(',')) {
                const trimmed = id.trim();
                if (trimmed) this.#allowedChatIds.add(trimmed);
            }
        }
    }

    /** Start long-polling for updates. */
    async start() {
        if (!this.#token) {
            console.warn('[Telegram] No bot token configured — skipping.');
            return;
        }
        this.#polling = true;
        console.log('[Telegram] Bot started polling...');
        eventBus.publish('channel:telegram:started', {});
        this._poll();
    }

    /** Stop polling. */
    stop() {
        this.#polling = false;
        if (this.#pollTimer) clearTimeout(this.#pollTimer);
        console.log('[Telegram] Bot stopped.');
        eventBus.publish('channel:telegram:stopped', {});
    }

    async _poll() {
        if (!this.#polling) return;

        try {
            const res = await axios.get(`${TELEGRAM_API}${this.#token}/getUpdates`, {
                params: { offset: this.#offset, timeout: 30, allowed_updates: ['message'] },
                timeout: 35000,
            });

            const updates = res.data?.result || [];
            for (const update of updates) {
                this.#offset = update.update_id + 1;
                await this._handleUpdate(update);
            }
        } catch (err) {
            console.error('[Telegram] Poll error:', err.message);
        }

        // Schedule next poll
        this.#pollTimer = setTimeout(() => this._poll(), 1000);
    }

    async _handleUpdate(update) {
        const msg = update.message;
        if (!msg || !msg.text) return;

        const chatId = String(msg.chat.id);
        const userId = String(msg.from.id);
        const username = msg.from.username || msg.from.first_name || userId;

        // Access control
        if (this.#allowedChatIds.size > 0 && !this.#allowedChatIds.has(chatId)) {
            await this._send(chatId, '⛔ Este chat no está autorizado para usar el agente BeZhas.');
            return;
        }

        eventBus.publish('channel:telegram:message', { userId, chatId, text: msg.text.slice(0, 200) });

        // Process through UnifiedAgent
        const response = await this.#agent.processMessage(msg.text, {
            userId: `telegram:${userId}`,
            role: this.#role,
            channel: 'telegram',
            address: null,
        });

        await this._send(chatId, response.text);
    }

    async _send(chatId, text) {
        try {
            // Telegram max message length is 4096
            const chunks = this._chunk(text, 4000);
            for (const chunk of chunks) {
                await axios.post(`${TELEGRAM_API}${this.#token}/sendMessage`, {
                    chat_id: chatId,
                    text: chunk,
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                });
            }
        } catch (err) {
            // Retry without Markdown if parse fails
            if (err.response?.data?.description?.includes('parse')) {
                try {
                    await axios.post(`${TELEGRAM_API}${this.#token}/sendMessage`, {
                        chat_id: chatId,
                        text,
                    });
                } catch (retryErr) {
                    console.error('[Telegram] Send error:', retryErr.message);
                }
            } else {
                console.error('[Telegram] Send error:', err.message);
            }
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
}

module.exports = TelegramAdapter;
