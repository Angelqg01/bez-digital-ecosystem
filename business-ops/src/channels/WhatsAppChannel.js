'use strict';

const BaseChannel = require('./BaseChannel');

/**
 * WhatsAppChannel — WhatsApp Business Cloud API (Meta).
 * Entrada: webhook de Meta. Salida: /messages al número de origen.
 * Incluye el handshake de verificación (GET hub.challenge) que exige Meta.
 */
class WhatsAppChannel extends BaseChannel {
  constructor({ send, verifyToken } = {}) {
    super({ name: 'whatsapp' });
    this.send = send || (async () => ({ sent: false }));
    this.verifyToken = verifyToken; // WHATSAPP_VERIFY_TOKEN
  }

  /** Handshake GET de Meta: devuelve hub.challenge si el token coincide. */
  handleVerification(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token && token === this.verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }

  parseInbound(raw = {}) {
    const value = raw.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];
    const text = (msg?.text?.body || '').trim();
    if (!text) throw new Error('whatsapp: webhook sin mensaje de texto');
    return { text, customerId: `wa:${msg.from}`, channel: 'whatsapp', meta: { from: msg.from } };
  }

  async deliver({ input, task }) {
    return this.send({ tenantId: task?.tenantId, to: input.meta.from, text: BaseChannel.replyText(task), meta: input.meta });
  }
}

module.exports = WhatsAppChannel;
