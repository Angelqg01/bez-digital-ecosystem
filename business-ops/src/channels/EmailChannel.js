'use strict';

const BaseChannel = require('./BaseChannel');

/**
 * EmailChannel — email entrante (webhook de Inbound Parse: SendGrid, Mailgun…)
 * y respuesta saliente (Resend/SendGrid API).
 * Espera campos { from, subject, text } del webhook del proveedor.
 */
class EmailChannel extends BaseChannel {
  constructor({ send } = {}) {
    super({ name: 'email' });
    this.send = send || (async () => ({ sent: false }));
  }

  parseInbound(raw = {}) {
    const from = raw.from || raw.sender;
    const text = (raw.text || raw.body || '').trim();
    if (!from || !text) throw new Error('email: faltan "from" o "text"');
    return { text, customerId: `email:${from}`, channel: 'email', meta: { from, subject: raw.subject || '' } };
  }

  async deliver({ input, task }) {
    return this.send({ tenantId: task?.tenantId, to: input.meta.from, text: BaseChannel.replyText(task), meta: { subject: input.meta.subject } });
  }
}

module.exports = EmailChannel;
