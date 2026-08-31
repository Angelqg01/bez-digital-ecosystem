'use strict';

const BaseChannel = require('./BaseChannel');

/**
 * WebChannel — widget de chat embebido (HTTP/JSON).
 *
 * Entrada cruda esperada: { text, customerId?, sessionId?, meta? }.
 * Salida: { reply, escalated, taskId, status }.
 */
class WebChannel extends BaseChannel {
  constructor({ apiKey } = {}) {
    super({ name: 'web' });
    this.apiKey = apiKey; // si está definido, exige x-api-key
  }

  verify(req) {
    if (!this.apiKey) return true;
    return req?.headers?.['x-api-key'] === this.apiKey;
  }

  parseInbound(raw = {}) {
    const text = (raw.text || '').toString().trim();
    if (!text) throw new Error('web: falta "text"');
    return {
      text,
      customerId: raw.customerId || raw.sessionId || 'web-anon',
      channel: 'web',
      meta: raw.meta || {},
    };
  }

  formatOutbound(task) {
    const result = task?.result || {};
    return {
      taskId: task?.id,
      status: task?.status,
      reply: BaseChannel.replyText(task),
      escalated: result.outcome === 'escalated',
    };
  }
}

module.exports = WebChannel;
