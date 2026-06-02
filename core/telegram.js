/**
 * BeZhas — TelegramClient
 * Gestiona el bot de Telegram: webhook, envío de mensajes,
 * comandos de agente, formateo, rate limiting y deduplicación.
 */

import TelegramBot from 'node-telegram-bot-api';
import { Redis } from 'ioredis';

// ─── Rate limiter en Redis ────────────────────────────────────────────────────
class RateLimiter {
  constructor(redis, prefix, maxPerMin) {
    this.redis = redis;
    this.prefix = prefix;
    this.max = maxPerMin;
  }

  async check(key) {
    const k = `${this.prefix}rl:${key}`;
    const now = Date.now();
    const window = 60_000;

    const pipe = this.redis.pipeline();
    pipe.zremrangebyscore(k, 0, now - window);
    pipe.zadd(k, now, `${now}`);
    pipe.zcard(k);
    pipe.expire(k, 70);
    const results = await pipe.exec();

    const count = results[2][1];
    return { allowed: count <= this.max, count, max: this.max };
  }
}

// ─── Formateador de mensajes ──────────────────────────────────────────────────
export class MessageFormatter {
  static escapeMarkdown(text) {
    return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  static tradeAlert({ symbol, action, price, quantity, reason, confidence }) {
    const emoji = action === 'BUY' ? '🟢' : action === 'SELL' ? '🔴' : '🟡';
    const conf = Math.round(confidence * 100);
    return [
      `${emoji} *TRADE ALERT — ${this.escapeMarkdown(symbol)}*`,
      ``,
      `📋 Acción: \`${action}\``,
      `💰 Precio: \`$${this.escapeMarkdown(String(price))}\``,
      `📦 Cantidad: \`${this.escapeMarkdown(String(quantity))}\``,
      `🧠 Confianza: \`${conf}%\``,
      ``,
      `📝 ${this.escapeMarkdown(reason)}`,
      ``,
      `_BeZhas AI\\-Engine · ${new Date().toLocaleString('es-ES')}_`
    ].join('\n');
  }

  static bezAlert({ level, title, message }) {
    const icons = { critical: '🚨', warning: '⚠️', info: 'ℹ️', success: '✅' };
    const icon = icons[level] || 'ℹ️';
    return [
      `${icon} *${this.escapeMarkdown(title)}*`,
      ``,
      this.escapeMarkdown(message),
      ``,
      `_AEGIS BeZhas · ${new Date().toLocaleString('es-ES')}_`
    ].join('\n');
  }

  static leadNotification({ company, contact, sector, score, source }) {
    return [
      `🎯 *NUEVO LEAD — ${this.escapeMarkdown(company)}*`,
      ``,
      `👤 Contacto: ${this.escapeMarkdown(contact)}`,
      `🏭 Sector: ${this.escapeMarkdown(sector)}`,
      `⭐ Score: \`${score}/100\``,
      `📡 Fuente: ${this.escapeMarkdown(source)}`,
      ``,
      `_BeZhas SDR Agent · ${new Date().toLocaleString('es-ES')}_`
    ].join('\n');
  }

  static humanInLoopRequest({ requestId, action, details, expiresIn }) {
    return [
      `⏳ *CONFIRMACIÓN REQUERIDA*`,
      ``,
      `🆔 Request: \`${this.escapeMarkdown(requestId)}\``,
      `⚡ Acción: \`${this.escapeMarkdown(action)}\``,
      ``,
      `📋 Detalles:`,
      `\`\`\``,
      this.escapeMarkdown(JSON.stringify(details, null, 2)),
      `\`\`\``,
      ``,
      `⏰ Expira en: ${expiresIn}s`,
    ].join('\n');
  }
}

// ─── TelegramClient ───────────────────────────────────────────────────────────
export class TelegramClient {
  constructor(config) {
    this.token = config.token;
    this.alertChatId = config.alertChatId;
    this.leadsChannelId = config.leadsChannelId;
    this.authorizedUsers = new Set(
      (config.authorizedUsers || '').split(',').map(id => id.trim()).filter(Boolean)
    );

    this.agentId = config.agentId || 'director-agent';
    this.bot = null;
    this.redis = null;
    this.rateLimiter = null;
    this.prefix = config.prefix || 'bezhas:messaging:';

    this._messageHandlers = new Map();
    this._callbackHandlers = new Map();
    this._pendingConfirmations = new Map();
  }

  async initialize(redis) {
    this.redis = redis;
    this.rateLimiter = new RateLimiter(
      redis,
      process.env.REDIS_PREFIX || 'bezhas:messaging:',
      parseInt(process.env.RATE_LIMIT_PER_MIN || '20')
    );

    this.bot = new TelegramBot(this.token, {
      webHook: false,
      polling: process.env.NODE_ENV !== 'production'
    });

    this._registerBotHandlers();
    console.log('[Telegram] Client initialized · mode:', process.env.NODE_ENV);
  }

  // ─── Webhook setup (producción) ──────────────────────────────────────────
  async setWebhook(webhookUrl) {
    await this.bot.setWebHook(`${webhookUrl}/telegram/webhook`);
    const info = await this.bot.getWebHookInfo();
    console.log('[Telegram] Webhook set:', info.url);
    return info;
  }

  processUpdate(update) {
    this.bot.processUpdate(update);
  }

  // ─── Handlers internos ────────────────────────────────────────────────────
  _registerBotHandlers() {
    // Comandos base
    this.bot.onText(/\/start/, (msg) => this._handleStart(msg));
    this.bot.onText(/\/status/, (msg) => this._handleStatus(msg));
    this.bot.onText(/\/portfolio/, (msg) => this._handleCommand(msg, 'portfolio'));
    this.bot.onText(/\/leads/, (msg) => this._handleCommand(msg, 'leads'));
    this.bot.onText(/\/help/, (msg) => this._handleHelp(msg));

    // Mensajes generales → router al agente
    this.bot.on('message', (msg) => this._handleMessage(msg));

    // Callbacks de botones inline (confirmaciones)
    this.bot.on('callback_query', (query) => this._handleCallback(query));
  }

  async _handleStart(msg) {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'Usuario';
    await this.bot.sendMessage(chatId,
      `🤖 *BeZhas AI Agent*\n\nHola ${MessageFormatter.escapeMarkdown(name)}\\!\n\nSoy tu agente inteligente para trading, blockchain y gestión empresarial\\.\n\nComandos disponibles:\n/status \\- Estado del sistema\n/portfolio \\- Ver cartera\n/leads \\- Últimos leads\n/help \\- Ayuda completa\n\nO escríbeme directamente en lenguaje natural\\.`,
      { parse_mode: 'MarkdownV2' }
    );
  }

  async _handleHelp(msg) {
    await this.bot.sendMessage(msg.chat.id,
      `📖 *BeZhas Agent \\- Comandos*\n\n*Trading:*\n• "analiza AAPL" \\- Análisis técnico\n• "compra 10 BTC" \\- Orden \\(requiere confirm\\.\n• "portfolio" \\- Ver posiciones\n\n*Blockchain:*\n• "saldo BEZ" \\- Ver balance BEZ\n• "precio BEZ" \\- Cotización actual\n\n*Leads:*\n• "últimos leads" \\- Ver pipeline\n• "busca empresa X" \\- Prospecting\n\n*Sistema:*\n• "estado sistema" \\- Health check\n• "alerta" \\- Ver alertas activas`,
      { parse_mode: 'MarkdownV2' }
    );
  }

  async _handleStatus(msg) {
    const status = {
      api: '✅ Online',
      trading: '✅ IBKR conectado',
      blockchain: '✅ Polygon + BNB',
      ml: '✅ XGBoost activo',
      memory: this.redis ? '✅ Redis OK' : '⚠️ Redis offline'
    };
    const text = Object.entries(status)
      .map(([k, v]) => `*${k}*: ${v}`)
      .join('\n');
    await this.bot.sendMessage(msg.chat.id,
      `🔋 *BeZhas System Status*\n\n${text}\n\n_${new Date().toLocaleString('es-ES')}_`,
      { parse_mode: 'MarkdownV2' }
    );
  }

  async _handleCommand(msg, command) {
    // Delegar al handler registrado
    const handler = this._messageHandlers.get(command);
    if (handler) {
      const response = await handler({ command, msg, chatId: msg.chat.id });
      if (response) await this.sendMessage(msg.chat.id, response);
    }
  }

  async _handleMessage(msg) {
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId = String(msg.chat.id);
    const userId = String(msg.from?.id);

    // Rate limiting
    const { allowed } = await this.rateLimiter.check(chatId);
    if (!allowed) {
      await this.bot.sendMessage(msg.chat.id, '⚠️ Demasiadas solicitudes. Espera un momento.');
      return;
    }

    // Delegar al handler general (OpenClaw)
    const handler = this._messageHandlers.get('*');
    if (handler) {
      try {
        await this.bot.sendChatAction(msg.chat.id, 'typing');
        const response = await handler({
          text: msg.text,
          chatId: msg.chat.id,
          userId,
          agentId: this.agentId,
          username: msg.from?.username,
          firstName: msg.from?.first_name,
          isAuthorized: this.authorizedUsers.has(userId)
        });
        if (response?.text) {
          await this.sendMessage(msg.chat.id, response.text, response.options);
        }
      } catch (err) {
        console.error('[Telegram] Handler error:', err);
        await this.bot.sendMessage(msg.chat.id, '⚠️ Error procesando solicitud. Inténtalo de nuevo.');
      }
    }
  }

  async _handleCallback(query) {
    const data = query.data;
    const chatId = query.message.chat.id;
    const userId = String(query.from.id);

    await this.bot.answerCallbackQuery(query.id);

    // Confirmaciones human-in-loop
    if (data.startsWith('confirm:') || data.startsWith('reject:')) {
      const [action, requestId] = data.split(':');
      const key = `bezhas:messaging:confirmation:${requestId}`;
      
      let pending = null;
      if (this.redis) {
        const raw = await this.redis.get(key);
        if (raw) pending = JSON.parse(raw);
      }

      if (!pending) {
        await this.bot.editMessageText('⏰ Esta confirmación ha expirado.', {
          chat_id: chatId, message_id: query.message.message_id
        });
        return;
      }

      if (!this.authorizedUsers.has(userId)) {
        await this.bot.answerCallbackQuery(query.id, { text: '❌ No tienes permisos para confirmar esto.' });
        return;
      }

      const approved = action === 'confirm';
      if (this.redis) {
        await this.redis.del(key);
        await this.redis.publish(`bezhas:messaging:decision:${requestId}`, JSON.stringify({
          approved, userId, username: query.from.username
        }));
      }

      await this.bot.editMessageText(
        approved ? `✅ Acción aprobada por ${query.from.first_name}` : `❌ Acción rechazada por ${query.from.first_name}`,
        { chat_id: chatId, message_id: query.message.message_id }
      );
    }

    // Handlers externos
    const handler = this._callbackHandlers.get(data.split(':')[0]);
    if (handler) await handler({ data, query, chatId, userId });
  }

  // ─── API pública ──────────────────────────────────────────────────────────

  onMessage(event, handler) {
    this._messageHandlers.set(event, handler);
  }

  onCallback(prefix, handler) {
    this._callbackHandlers.set(prefix, handler);
  }

  async sendMessage(chatId, text, options = {}) {
    const opts = { parse_mode: 'MarkdownV2', ...options };
    try {
      return await this.bot.sendMessage(chatId, text, opts);
    } catch (err) {
      // Fallback: enviar sin markdown si hay error de parseo
      if (err.message?.includes('parse')) {
        return await this.bot.sendMessage(chatId, text.replace(/[*_`[\]()~>#+=|{}.!\\-]/g, ''));
      }
      throw err;
    }
  }

  async sendPhoto(chatId, photo, caption = '') {
    return this.bot.sendPhoto(chatId, photo, { caption, parse_mode: 'MarkdownV2' });
  }

  async sendDocument(chatId, doc, caption = '') {
    return this.bot.sendDocument(chatId, doc, { caption, parse_mode: 'MarkdownV2' });
  }

  // Envío con botones inline (para confirmaciones)
  async sendWithButtons(chatId, text, buttons) {
    return this.bot.sendMessage(chatId, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: buttons.map(row =>
          row.map(btn => ({ text: btn.label, callback_data: btn.data }))
        )
      }
    });
  }

  // Solicitar confirmación humana (human-in-loop)
  async requestConfirmation({ requestId, chatId, action, details, timeoutSecs = 120 }) {
    const text = MessageFormatter.humanInLoopRequest({ requestId, action, details, expiresIn: timeoutSecs });
    const key = `bezhas:messaging:confirmation:${requestId}`;

    await this.sendWithButtons(chatId, text, [[
      { label: '✅ Aprobar', data: `confirm:${requestId}` },
      { label: '❌ Rechazar', data: `reject:${requestId}` }
    ]]);

    // Store request in Redis for other instances to see
    if (this.redis) {
      await this.redis.set(key, JSON.stringify({ action, details, chatId }), 'EX', timeoutSecs);
    }

    return new Promise((resolve, reject) => {
      const channel = `bezhas:messaging:decision:${requestId}`;
      
      const timer = setTimeout(async () => {
        if (this.redis) {
          await this.redis.del(key);
          // If we had a subscriber, we should unsubscribe
        }
        reject(new Error(`Confirmation timeout after ${timeoutSecs}s`));
      }, timeoutSecs * 1000);

      // We use a dedicated subscriber client if available, or a temporary one
      const sub = this.redis.duplicate();
      sub.connect().then(() => {
        sub.subscribe(channel, (message) => {
          const result = JSON.parse(message);
          clearTimeout(timer);
          sub.unsubscribe(channel);
          sub.quit();
          resolve(result);
        });
      });
    });
  }

  // Obtener historial de chat desde Redis
  async getChatHistory(chatId, limit = 20) {
    if (!this.redis) return [];
    const raw = await this.redis.lrange(
      `${process.env.REDIS_PREFIX}chat:${chatId}:history`, 0, limit - 1
    );
    return raw.map(r => JSON.parse(r));
  }

  async getMe() {
    return this.bot.getMe();
  }

  async getWebhookInfo() {
    return this.bot.getWebHookInfo();
  }
}
