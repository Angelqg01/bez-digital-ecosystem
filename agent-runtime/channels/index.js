/**
 * channels/index.js — Channel manager for the UnifiedAgent.
 *
 * Initializes and manages channel adapters (Telegram, Discord, WhatsApp)
 * based on the agent configuration from the admin panel.
 */
const TelegramAdapter = require('./TelegramAdapter');
const DiscordAdapter = require('./DiscordAdapter');
const WhatsAppAdapter = require('./WhatsAppAdapter');
const eventBus = require('../core/RuntimeEventBus');

class ChannelManager {
    /** @type {TelegramAdapter|null} */
    telegram = null;
    /** @type {DiscordAdapter|null} */
    discord = null;
    /** @type {WhatsAppAdapter|null} */
    whatsapp = null;

    /**
     * Initialize all enabled channels.
     * @param {import('../core/UnifiedAgent')} agent
     * @param {object} channelsConfig — from agent config
     */
    async init(agent, channelsConfig) {
        console.log('[ChannelManager] Initializing channels...');

        // Telegram
        if (channelsConfig.telegram?.enabled && channelsConfig.telegram?.botToken) {
            this.telegram = new TelegramAdapter(agent, channelsConfig.telegram);
            await this.telegram.start();
        }

        // Discord
        if (channelsConfig.discord?.enabled && channelsConfig.discord?.botToken) {
            this.discord = new DiscordAdapter(agent, channelsConfig.discord);
            await this.discord.start();
        }

        // WhatsApp — creates router, needs to be mounted by Express
        if (channelsConfig.whatsapp?.enabled && channelsConfig.whatsapp?.phoneNumberId) {
            this.whatsapp = new WhatsAppAdapter(agent, channelsConfig.whatsapp);
            console.log('[ChannelManager] WhatsApp adapter ready (mount webhook router).');
        }

        const active = [
            this.telegram ? 'telegram' : null,
            this.discord ? 'discord' : null,
            this.whatsapp ? 'whatsapp' : null,
        ].filter(Boolean);

        console.log(`[ChannelManager] Active channels: ${active.join(', ') || 'none'}`);
        eventBus.publish('channels:initialized', { active });
    }

    /** Restart channels after config change. */
    async restart(agent, channelsConfig) {
        await this.shutdown();
        await this.init(agent, channelsConfig);
    }

    /** Stop all channels. */
    async shutdown() {
        if (this.telegram) { this.telegram.stop(); this.telegram = null; }
        if (this.discord) { await this.discord.stop(); this.discord = null; }
        this.whatsapp = null;
        console.log('[ChannelManager] All channels stopped.');
    }

    /** Get status summary. */
    getStatus() {
        return {
            telegram: this.telegram ? 'running' : 'disabled',
            discord: this.discord ? 'running' : 'disabled',
            whatsapp: this.whatsapp ? 'ready' : 'disabled',
        };
    }
}

module.exports = ChannelManager;
