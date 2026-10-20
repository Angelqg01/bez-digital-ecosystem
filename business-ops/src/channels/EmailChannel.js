'use strict';

const BaseChannel = require('./BaseChannel');

/**
 * EmailChannel — email entrante (webhook de Inbound Parse: SendGrid, Mailgun…)
 * y respuesta saliente por SMTP (buzón de Hostinger, vía EmailConnector).
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
    return {
      text, customerId: `email:${from}`, channel: 'email',
      meta: { from, subject: raw.subject || '', alias: raw.alias || null, messageId: raw.messageId || null, references: raw.references || [] },
    };
  }

  async deliver({ input, task }) {
    const m = input.meta || {};
    return this.send({
      tenantId: task?.tenantId, to: m.from, text: BaseChannel.replyText(task),
      meta: {
        subject: m.subject,
        // Se contesta desde la dirección a la que escribieron (Hostinger sólo deja el buzón y sus alias).
        from: m.alias || undefined,
        headers: {
          'Auto-Submitted': 'auto-replied', 'X-Auto-Response-Suppress': 'All',
          ...(m.messageId ? { 'In-Reply-To': m.messageId, References: [...(m.references || []), m.messageId].join(' ') } : {}),
        },
      },
    });
  }
}

module.exports = EmailChannel;
