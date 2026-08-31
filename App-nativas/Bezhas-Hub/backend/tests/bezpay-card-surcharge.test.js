/**
 * Recargo de tarjeta — la optimización que sale de los tres backtests de
 * naviera: con comisión plana del 1,5%, el tramo de tarjeta pierde dinero
 * con cualquier procesador. Aquí se verifica que el recargo cubre el coste
 * SIN tocar el BEZ que recibe el cliente.
 *
 * ⚠️ jest.config.js: `transform: {}` (sin hoisting de jest.mock → orden del
 * fichero manda) y `resetMocks: true` (implementaciones en el beforeEach).
 */

jest.mock('stripe', () => {
  const sessionsCreate = jest.fn();
  const factory = jest.fn(() => ({ checkout: { sessions: { create: sessionsCreate } } }));
  factory.__sessionsCreate = sessionsCreate;
  return factory;
});
jest.mock('../middleware/auditLogger', () => ({ audit: { admin: jest.fn() } }));

process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

const stripeFactory = require('stripe');
const stripeService = require('../services/stripe.service');

beforeEach(() => {
  delete process.env.BEZPAY_CARD_SURCHARGE_PCT;
  delete process.env.BEZPAY_CARD_SURCHARGE_FIXED_EUR;
  stripeFactory.__sessionsCreate.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/cs_test_1' });
});

describe('createBezPayCheckoutSession — recargo de tarjeta', () => {
  it('añade una segunda línea de recargo, sin tocar la línea del BEZ', async () => {
    await stripeService.createBezPayCheckoutSession({
      paymentId: 'BEZ-TEST-0001', walletAddress: '0x1111111111111111111111111111111111111111',
      bezAmount: 79.43, amountFiat: 100, currency: 'eur',
    });

    const call = stripeFactory.__sessionsCreate.mock.calls[0][0];
    expect(call.line_items).toHaveLength(2);

    const [bezLine, surchargeLine] = call.line_items;
    expect(bezLine.price_data.unit_amount).toBe(10000); // 100€ en céntimos, SIN recargo
    expect(bezLine.price_data.product_data.name).toBe('79.43 BEZ');

    // 3,5% de 100€ + 0,30€ = 3,80€ = 380 céntimos
    expect(surchargeLine.price_data.unit_amount).toBe(380);
    expect(surchargeLine.price_data.product_data.name).toMatch(/recargo/i);
  });

  it('el recargo es configurable por env, con el mismo cálculo', async () => {
    process.env.BEZPAY_CARD_SURCHARGE_PCT = '0.05';
    process.env.BEZPAY_CARD_SURCHARGE_FIXED_EUR = '1.00';
    jest.resetModules();
    // jest.resetModules() también reevalúa la factory de jest.mock('stripe'),
    // así que el mock de sessionsCreate configurado en beforeEach queda
    // huérfano — hay que releerlo del módulo recién requerido, no del
    // `stripeFactory` capturado al principio del fichero.
    const freshStripeFactory = require('stripe');
    freshStripeFactory.__sessionsCreate.mockResolvedValue({ id: 'cs_test_2', url: 'https://checkout.stripe.com/cs_test_2' });
    const freshService = require('../services/stripe.service');

    await freshService.createBezPayCheckoutSession({
      paymentId: 'BEZ-TEST-0002', walletAddress: '0x1111111111111111111111111111111111111111',
      bezAmount: 10, amountFiat: 200, currency: 'eur',
    });

    const call = freshStripeFactory.__sessionsCreate.mock.calls[0][0];
    // 5% de 200€ + 1,00€ = 11,00€ = 1100 céntimos
    expect(call.line_items[1].price_data.unit_amount).toBe(1100);
  });

  it('sin recargo configurado a cero, no añade la segunda línea', async () => {
    process.env.BEZPAY_CARD_SURCHARGE_PCT = '0';
    process.env.BEZPAY_CARD_SURCHARGE_FIXED_EUR = '0';
    jest.resetModules();
    const freshStripeFactory = require('stripe');
    freshStripeFactory.__sessionsCreate.mockResolvedValue({ id: 'cs_test_3', url: 'https://checkout.stripe.com/cs_test_3' });
    const freshService = require('../services/stripe.service');

    await freshService.createBezPayCheckoutSession({
      paymentId: 'BEZ-TEST-0003', walletAddress: '0x1111111111111111111111111111111111111111',
      bezAmount: 10, amountFiat: 200, currency: 'eur',
    });

    const call = freshStripeFactory.__sessionsCreate.mock.calls[0][0];
    expect(call.line_items).toHaveLength(1);
  });
});
