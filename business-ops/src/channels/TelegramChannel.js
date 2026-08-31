'use strict';

const BaseChannel = require('./BaseChannel');

/**
 * TelegramChannel — bot de Telegram.
 * Entrada: update de Telegram (webhook). Salida: sendMessage al chat de origen.
 */
class TelegramChannel extends BaseChannel {
  constructor({ send, secret } = {}) {
    super({ name: 'telegram' });
    this.send = send || (async () => ({ sent: false }));
    this.secret = secret; // X-Telegram-Bot-Api-Secret-Token (opcional)
  }

  verify(req) {
    if (!this.secret) return true;
    return req?.headers?.['x-telegram-bot-api-secret-token'] === this.secret;
  }

  parseInbound(raw = {}) {
    const msg = raw.message || raw.edited_message;
    const text = (msg?.text || '').trim();
    if (!text) throw new Error('telegram: update sin texto');
    const chatId = msg.chat?.id;
    return { text, customerId: `tg:${msg.from?.id ?? chatId}`, channel: 'telegram', meta: { chatId } };
  }

  async deliver({ input, task }) {
    return this.send({ tenantId: task?.tenantId, to: input.meta.chatId, text: BaseChannel.replyText(task), meta: input.meta });
  }
}

module.exports = TelegramChannel;
