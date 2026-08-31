/**
 * El cambio central del flujo fiat: `checkout.session.completed` RETIENE,
 * no entrega.
 *
 * Antes, handleCheckoutCompleted dispensaba BEZ desde el hot wallet en el
 * mismo instante del cobro. Como cobrar con tarjeta es reversible y entregar
 * tokens no lo es, quien pagara y metiera después un contracargo se quedaba
 * con los tokens gratis.
 *
 * Lo que se afirma aquí es una sola cosa, y es la que importa:
 *   con una orden de BezPay, del hot wallet NO sale nada al cobrar.
 *
 * ⚠️ jest.config.js: `transform: {}` (los jest.mock NO se hoistean → el orden
 * del fichero manda) y `resetMocks: true` (implementaciones en el beforeEach).
 */

// Se moquea el dispensador fiat ANTES de cargar nada: si el código real se
// colara, este doble es la única barrera entre el test y una transferencia.
jest.mock('../services/fiat-gateway.service', () => ({
  processFiatPayment: jest.fn(),
  isFiatEnabled: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('../services/bezpayFiatSettlement', () => ({
  recordFiatPayment: jest.fn(),
  cancelFiatSettlement: jest.fn(),
}));
jest.mock('../middleware/auditLogger', () => ({ audit: { admin: jest.fn() } }));
jest.mock('../middleware/discordNotifier', () => ({
  notifyPaymentFailed: jest.fn(() => Promise.resolve()),
  notifyStripeWebhookError: jest.fn(() => Promise.resolve()),
  notifyHigh: jest.fn(() => Promise.resolve()),
}));
jest.mock('../middleware/telegramNotifier', () => ({
  notifyPaymentSuccess: jest.fn(() => Promise.resolve()),
}));

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';

const fiatGateway = require('../services/fiat-gateway.service');
const fiatSettlement = require('../services/bezpayFiatSettlement');
const discord = require('../middleware/discordNotifier');
const telegram = require('../middleware/telegramNotifier');
const stripeService = require('../services/stripe.service');

const WALLET = '0x1111111111111111111111111111111111111111';
const PI = 'pi_3QabcTEST0001';

function session(metadata, extra = {}) {
  return {
    id: 'cs_test_1',
    payment_intent: PI,
    amount_total: 10000,      // 100,00 €
    customer_email: 'cliente@example.com',
    metadata,
    ...extra,
  };
}

beforeEach(() => {
  fiatSettlement.recordFiatPayment.mockResolvedValue({
    held: true, holdUntil: new Date(Date.now() + 72 * 3600_000),
  });
  fiatGateway.processFiatPayment.mockResolvedValue({ transactionHash: '0xdeadbeef' });

  // `resetMocks: true` vacía estas implementaciones antes de cada test, y el
  // código encadena `.catch()` sobre lo que devuelven: sin reinstalarlas, un
  // mock que devuelve undefined revienta la ruta heredada.
  discord.notifyHigh.mockResolvedValue(undefined);
  discord.notifyPaymentFailed.mockResolvedValue(undefined);
  discord.notifyStripeWebhookError.mockResolvedValue(undefined);
  telegram.notifyPaymentSuccess.mockResolvedValue(undefined);
});

// ═══════════════════════════════════════════════════════════════════════════
describe('orden de BezPay', () => {
  const meta = {
    type: 'token_purchase',
    bezpayPaymentId: 'BEZ-TEST-0001',
    walletAddress: WALLET,
    tokenAmount: '79.435483',
  };

  it('el cobro NO dispensa nada del hot wallet', async () => {
    await stripeService.handleCheckoutCompleted(session(meta));

    // La afirmación que da sentido a todo el trabajo:
    expect(fiatGateway.processFiatPayment).not.toHaveBeenCalled();
  });

  it('el cobro queda retenido con su referencia de Stripe', async () => {
    await stripeService.handleCheckoutCompleted(session(meta));

    expect(fiatSettlement.recordFiatPayment).toHaveBeenCalledWith({
      paymentId: 'BEZ-TEST-0001',
      providerReference: PI,
      methodKind: 'card',
    });
  });

  it('sin payment_intent cae al id de la sesión como referencia', async () => {
    await stripeService.handleCheckoutCompleted(session(meta, { payment_intent: null }));

    expect(fiatSettlement.recordFiatPayment).toHaveBeenCalledWith(
      expect.objectContaining({ providerReference: 'cs_test_1' })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('sesiones ajenas a BezPay', () => {
  it('sin bezpayPaymentId sigue el camino heredado (entrega directa)', async () => {
    // Integraciones anteriores que crean sesiones sin orden BezPay: se
    // mantienen funcionando, sin retención. Documentado, no accidental.
    await stripeService.handleCheckoutCompleted(session({
      type: 'token_purchase', walletAddress: WALLET, tokenAmount: '100',
    }));

    expect(fiatSettlement.recordFiatPayment).not.toHaveBeenCalled();
    expect(fiatGateway.processFiatPayment).toHaveBeenCalled();
  });
});
