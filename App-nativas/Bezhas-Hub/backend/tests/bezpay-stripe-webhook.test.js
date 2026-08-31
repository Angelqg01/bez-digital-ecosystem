/**
 * Webhook de Stripe → retención de BezPay, extremo a extremo.
 *
 * Aquí NO se simula la verificación de firma: se genera una firma real con el
 * helper de la propia librería de Stripe y se mete por la ruta de verdad. Así
 * se cubre lo que los tests del servicio no tocaban:
 *
 *   firma válida → constructEvent → dispatchEvent → bezpayFiatSettlement
 *
 * Lo más frágil de todo esto es de dónde sale el `payment_intent` en cada
 * evento, porque los tres traen una forma distinta:
 *
 *   charge.dispute.created   → objeto Dispute       → .payment_intent
 *   charge.refunded          → objeto Charge        → .payment_intent
 *   payment_intent.canceled  → objeto PaymentIntent → .id  (¡no .payment_intent!)
 *
 * Si esa extracción falla, el bloqueo se aplica a una referencia que no existe
 * y la entrega sigue adelante pese a la disputa. De ahí esta suite.
 *
 * ⚠️ jest.config.js: `transform: {}` (sin hoisting de jest.mock → el orden del
 * fichero manda) y `resetMocks: true` (implementaciones en el beforeEach).
 */

const WEBHOOK_SECRET = 'whsec_test_secret_para_esta_suite';

jest.mock('../services/bezpayFiatSettlement', () => ({
  cancelFiatSettlement: jest.fn(),
  recordFiatPayment: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const stripeLib = require('stripe');
const fiatSettlement = require('../services/bezpayFiatSettlement');

const PI = 'pi_3QabcTEST0001';

function buildApp() {
  const app = express();
  // Igual que en server.js: el router va ANTES de express.json(), porque la
  // verificación de firma necesita el cuerpo crudo.
  app.use('/api/stripe', require('../routes/stripe-webhook.routes'));
  return app;
}

/** Firma el payload como lo haría Stripe. */
function signed(payload) {
  const stripe = stripeLib('sk_test_dummy');
  return stripe.webhooks.generateTestHeaderString({
    payload: JSON.stringify(payload),
    secret: WEBHOOK_SECRET,
  });
}

function post(app, payload, header) {
  return request(app)
    .post('/api/stripe/webhook')
    .set('stripe-signature', header !== undefined ? header : signed(payload))
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(payload));
}

const evt = (type, object) => ({ id: 'evt_test_1', type, data: { object } });

let app;

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  fiatSettlement.cancelFiatSettlement.mockResolvedValue({ blocked: true });
  fiatSettlement.recordFiatPayment.mockResolvedValue({ held: true });
  app = buildApp();
});

// ═══════════════════════════════════════════════════════════════════════════
describe('la firma se verifica de verdad', () => {
  it('rechaza una petición sin cabecera de firma', async () => {
    const res = await post(app, evt('charge.refunded', { id: 'ch_1', payment_intent: PI }), '');
    expect(res.status).toBe(400);
    expect(fiatSettlement.cancelFiatSettlement).not.toHaveBeenCalled();
  });

  it('rechaza una firma inventada', async () => {
    const res = await post(app, evt('charge.refunded', { id: 'ch_1', payment_intent: PI }),
      't=123,v1=firmafalsa');
    expect(res.status).toBe(400);
    expect(fiatSettlement.cancelFiatSettlement).not.toHaveBeenCalled();
  });

  it('rechaza una firma válida pero de OTRO secreto', async () => {
    const payload = evt('charge.refunded', { id: 'ch_1', payment_intent: PI });
    const otro = stripeLib('sk_test_dummy').webhooks.generateTestHeaderString({
      payload: JSON.stringify(payload), secret: 'whsec_otro_distinto',
    });
    const res = await post(app, payload, otro);
    expect(res.status).toBe(400);
    expect(fiatSettlement.cancelFiatSettlement).not.toHaveBeenCalled();
  });

  it('sin STRIPE_WEBHOOK_SECRET configurado no procesa nada', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await post(app, evt('charge.refunded', { id: 'ch_1', payment_intent: PI }));
    expect(res.status).toBe(500);
    expect(fiatSettlement.cancelFiatSettlement).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('cada evento bloquea con la referencia correcta', () => {
  it('charge.dispute.created → usa el payment_intent de la disputa', async () => {
    const res = await post(app, evt('charge.dispute.created', {
      id: 'dp_1', charge: 'ch_1', payment_intent: PI, reason: 'fraudulent',
    }));

    expect(res.status).toBe(200);
    expect(fiatSettlement.cancelFiatSettlement).toHaveBeenCalledWith({
      providerReference: PI, reason: 'charge.dispute.created',
    });
  });

  it('charge.refunded → usa el payment_intent del cargo', async () => {
    const res = await post(app, evt('charge.refunded', {
      id: 'ch_1', payment_intent: PI, refunded: true, amount_refunded: 5000,
    }));

    expect(res.status).toBe(200);
    expect(fiatSettlement.cancelFiatSettlement).toHaveBeenCalledWith({
      providerReference: PI, reason: 'charge.refunded',
    });
  });

  it('payment_intent.canceled → usa el id, porque el objeto YA es el PaymentIntent', async () => {
    const res = await post(app, evt('payment_intent.canceled', {
      id: PI, status: 'canceled',   // ojo: sin campo payment_intent
    }));

    expect(res.status).toBe(200);
    expect(fiatSettlement.cancelFiatSettlement).toHaveBeenCalledWith({
      providerReference: PI, reason: 'payment_intent.canceled',
    });
    // El fallo silencioso que esto vigila: bloquear con `undefined`.
    const arg = fiatSettlement.cancelFiatSettlement.mock.calls[0][0];
    expect(arg.providerReference).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('eventos ajenos', () => {
  it('un evento no relacionado no bloquea ningún cobro', async () => {
    const res = await post(app, evt('customer.created', { id: 'cus_1' }));
    expect(res.status).toBe(200);
    expect(fiatSettlement.cancelFiatSettlement).not.toHaveBeenCalled();
  });
});
