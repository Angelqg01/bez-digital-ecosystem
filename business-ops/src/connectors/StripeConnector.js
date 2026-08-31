'use strict';
const BaseConnector = require('./BaseConnector');

/**
 * StripeConnector — cobros con Stripe (o ERP local).
 *
 * MODO REAL con STRIPE_API_KEY: llamadas HTTP a la API de Stripe
 * (application/x-www-form-urlencoded, como exige Stripe). Sin clave → simulado.
 *
 * LÍNEA ROJA: este conector NUNCA mueve fondos. Solo emite enlaces de cobro
 * (el cliente paga por su cuenta) y consulta facturas/suscripciones. Cualquier
 * transferencia/pago saliente está bloqueado por RedLines (money_movement) y no
 * se implementa aquí a propósito.
 */
const STRIPE_BASE = 'https://api.stripe.com/v1';

class StripeConnector extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'stripe';
    this.apiKey = config.apiKey || process.env.STRIPE_API_KEY || process.env.STRIPE_SECRET_KEY || '';
    this.currency = (config.currency || process.env.STRIPE_CURRENCY || 'eur').toLowerCase();
    this._fetch = config.fetch || globalThis.fetch;
    this.simulated = !this.apiKey;
    this._invoices = new Map();
  }

  async execute(method, args = {}) {
    switch (method) {
      case 'createPaymentLink': return this.createPaymentLink(args);
      case 'getInvoice': return this.getInvoice(args);
      case 'checkSubscription': return this.checkSubscription(args);
      default: throw new Error(`stripe: método desconocido ${method}`);
    }
  }

  /** Enlace de cobro reutilizable. Crea el precio ad-hoc y el payment link. */
  async createPaymentLink({ amount, customerId, description = 'Pago de servicios', currency } = {}) {
    if (!amount) throw new Error('stripe: amount requerido');
    if (this.simulated) {
      const id = `pl_${Math.random().toString(36).slice(2, 9)}`;
      return { paymentLinkId: id, url: `https://checkout.stripe.com/pay/sim_${id}`, amount, customerId, description, status: 'active', simulated: true };
    }
    const cur = (currency || this.currency).toLowerCase();
    const unitAmount = Math.round(Number(amount) * 100); // Stripe usa la unidad mínima
    const price = await this._post('/prices', {
      currency: cur,
      unit_amount: String(unitAmount),
      'product_data[name]': description,
    });
    const link = await this._post('/payment_links', {
      'line_items[0][price]': price.id,
      'line_items[0][quantity]': '1',
    });
    return { paymentLinkId: link.id, url: link.url, amount, currency: cur, customerId, description, status: link.active ? 'active' : 'inactive' };
  }

  async getInvoice({ invoiceId } = {}) {
    if (!invoiceId) throw new Error('stripe: invoiceId requerido');
    if (this.simulated) {
      return this._invoices.get(invoiceId) || { invoiceId, amount: 250.0, currency: 'eur', status: 'paid', created: 0, simulated: true };
    }
    const inv = await this._get(`/invoices/${invoiceId}`);
    return { invoiceId: inv.id, amount: (inv.amount_due || 0) / 100, currency: inv.currency, status: inv.status, created: inv.created };
  }

  async checkSubscription({ customerId } = {}) {
    if (this.simulated) {
      return { customerId, status: 'active', plan: 'pro', currentPeriodEnd: 0, simulated: true };
    }
    const res = await this._get(`/subscriptions?customer=${encodeURIComponent(customerId)}&limit=1`);
    const sub = (res.data || [])[0];
    if (!sub) return { customerId, status: 'none' };
    return { customerId, subscriptionId: sub.id, status: sub.status, currentPeriodEnd: sub.current_period_end };
  }

  // ── HTTP (form-urlencoded, autenticación Bearer) ──
  async _req(path, method, body) {
    const opts = {
      method,
      headers: { Authorization: `Bearer ${this.apiKey}` },
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      opts.body = new URLSearchParams(body).toString();
    }
    const resp = await this._fetch(`${STRIPE_BASE}${path}`, opts);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const err = new Error(`stripe: HTTP ${resp.status} ${data?.error?.message || ''}`.trim());
      err.status = resp.status;
      throw err;
    }
    return data;
  }
  _get(p) { return this._req(p, 'GET'); }
  _post(p, b) { return this._req(p, 'POST', b); }
}

module.exports = StripeConnector;
