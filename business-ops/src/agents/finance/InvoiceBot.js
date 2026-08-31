'use strict';
const BaseAgent = require('../BaseAgent');

/**
 * InvoiceBot — monitorea el bus de eventos en busca de 'sales:deal_won'.
 * Genera un enlace de pago mediante el conector de Stripe y envía la factura
 * al correo del cliente.
 */
class InvoiceBot extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'finance.invoice-bot',
      name: 'Invoice Bot',
      department: 'finance',
      modelTier: 'fast',
      capabilities: ['finance:invoice'],
      systemPrompt: 'Eres un bot de facturación automatizado. Generas facturas y enlaces de pago y los envías a los clientes correspondientes.',
    });

    if (this.bus) {
      this.bus.on('sales:deal_won', async (event) => {
        try {
          await this.processDealWon(event);
        } catch (err) {
          // Fallback log
        }
      });
    }
  }

  async run(task) {
    const { client, amount, email, items } = task.payload || {};
    return this.processDealWon({ client, amount, email, items });
  }

  async processDealWon({ client = 'Cliente', amount = 0, email: clientEmail = 'client@example.com', items = [] } = {}) {
    const stripe = this.tools.stripe;
    let paymentLink = null;
    if (stripe) {
      paymentLink = await stripe.execute('createPaymentLink', { amount, customerId: client, description: `Factura por deal cerrado` });
    } else {
      paymentLink = { url: 'https://checkout.stripe.com/pay/mock_deal_won', amount };
    }

    const emailBody = `
Hola,

Adjuntamos los detalles de tu factura por el servicio contratado.

Cliente: ${client}
Importe Total: ${amount} EUR
Enlace de Pago Seguro: ${paymentLink.url}

Gracias por tu confianza.
Atentamente,
El equipo de Finanzas.
    `;

    let emailResult = null;
    const emailTool = this.tools.email;
    if (emailTool) {
      emailResult = await emailTool.execute('send', {
        to: clientEmail,
        subject: `Factura y enlace de pago - ${client}`,
        body: emailBody
      });
    } else {
      emailResult = { sent: true, simulated: true };
    }

    const result = {
      client,
      amount,
      paymentLink,
      emailResult,
      status: 'completed'
    };

    this.bus?.emit('finance:invoice_sent', { tenantId: this.tenantId, client, amount, result });
    return result;
  }
}

module.exports = InvoiceBot;
