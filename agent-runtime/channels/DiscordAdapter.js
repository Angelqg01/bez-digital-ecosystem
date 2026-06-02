/**
 * DiscordAdapter.js — Connects the UnifiedAgent to a Discord bot.
 *
 * Uses discord.js (peer dependency) for gateway events.
 * The bot listens for messages in allowed guilds/channels and routes
 * them through the UnifiedAgent for processing.
 */
const eventBus = require('../core/RuntimeEventBus');

class DiscordAdapter {
    /** @type {import('../core/UnifiedAgent')} */
    #agent = null;
    #client = null;
    #token = '';
    #allowedGuildIds = new Set();
    #prefix = '!bez'; // Discord command prefix (slash commands via /bez also supported)

    /**
     * @param {import('../core/UnifiedAgent')} agent
     * @param {{ botToken: string, allowedGuildIds?: string }} config
     */
    constructor(agent, config) {
        this.#agent = agent;
        this.#token = config.botToken;
        if (config.allowedGuildIds) {
            for (const id of config.allowedGuildIds.split(',')) {
                const trimmed = id.trim();
                if (trimmed) this.#allowedGuildIds.add(trimmed);
            }
        }
    }

    /** Start the Discord bot. */
    async start() {
        if (!this.#token) {
            console.warn('[Discord] No bot token configured — skipping.');
            return;
        }

        let Discord;
        try {
            Discord = require('discord.js');
        } catch {
            console.warn('[Discord] discord.js not installed — run: npm install discord.js');
            return;
        }

        const { Client, GatewayIntentBits } = Discord;
        this.#client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
        });

        this.#client.once('ready', () => {
            console.log(`[Discord] Bot ready as ${this.#client.user.tag}`);
            eventBus.publish('channel:discord:started', { tag: this.#client.user.tag });
        });

        this.#client.on('messageCreate', (msg) => this._handleMessage(msg));

        try {
            await this.#client.login(this.#token);
        } catch (err) {
            console.error('[Discord] Login failed:', err.message);
        }
    }

    /** Stop the Discord bot. */
    async stop() {
        if (this.#client) {
            this.#client.destroy();
            this.#client = null;
            console.log('[Discord] Bot disconnected.');
            eventBus.publish('channel:discord:stopped', {});
        }
    }

    async _handleMessage(msg) {
        // Ignore bots
        if (msg.author.bot) return;

        // Access control
        if (this.#allowedGuildIds.size > 0 && msg.guild && !this.#allowedGuildIds.has(msg.guild.id)) {
            return;
        }

        const content = msg.content.trim();

        // Only respond to messages starting with prefix, mentions, or DMs
        const isMention = msg.mentions.has(this.#client.user);
        const hasPrefix = content.toLowerCase().startsWith(this.#prefix);
        const isDM = !msg.guild;

        if (!isMention && !hasPrefix && !isDM) return;

        // Strip prefix
        let input = content;
        if (hasPrefix) input = content.slice(this.#prefix.length).trim();
        if (isMention) input = content.replace(/<@!?\d+>/g, '').trim();

        if (!input) {
            await msg.reply('Envía un comando o pregunta. Usa `/help` para ver opciones.');
            return;
        }

        eventBus.publish('channel:discord:message', {
            userId: msg.author.id,
            guildId: msg.guild?.id,
            text: input.slice(0, 200),
        });

        const response = await this.#agent.processMessage(input, {
            userId: `discord:${msg.author.id}`,
            role: 'operator',
            channel: 'discord',
            address: null,
        });

        // Discord max message is 2000 chars
        const chunks = this._chunk(response.text, 1900);
        for (const chunk of chunks) {
            await msg.reply(chunk);
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

module.exports = DiscordAdapter;
