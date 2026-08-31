/**
 * confirmBankTransfer — el paso que faltaba en el flujo de transferencia.
 *
 * La transferencia bancaria no tiene webhook: nadie avisa cuando el dinero
 * entra. Este endpoint es la única puerta por la que ese pago pasa de
 * 'pending' a liquidable, así que sus garantías son las que importan aquí:
 *
 *   - sin bankReference no hay confirmación posible ("porque sí" no vale)
 *   - una orden que no es fiat (cripto, o sin términos) no se puede confirmar
 *   - la misma referencia bancaria no acredita dos órdenes
 *   - confirmar RETIENE, nunca entrega directamente
 *
 * ⚠️ jest.config.js: `transform: {}` (sin hoisting de jest.mock → orden del
 * fichero manda) y `resetMocks: true` (implementaciones en el beforeEach).
 */

jest.mock('../models/pg/Payment', () => ({
  findByPaymentIntent: jest.fn(),
}));
jest.mock('../services/bezpayFiatSettlement', () => ({
  recordFiatPayment: jest.fn(),
}));

const PaymentPG = require('../models/pg/Payment');
const fiatSettlement = require('../services/bezpayFiatSettlement');
const bezpay = require('../services/bezpay.service');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
  };
}
const req = (body) => ({ body, headers: {} });

function fiatOrder(overrides = {}) {
  return {
    payment_intent_id: 'BEZ-TEST-0001',
    wallet_address: '0x1111111111111111111111111111111111111111',
    metadata: { type: 'buy_bez', settlement: { payToken: 'USD' } },
    ...overrides,
  };
}

beforeEach(() => {
  fiatSettlement.recordFiatPayment.mockResolvedValue({ held: true });
});

describe('validaciones', () => {
  it('sin paymentId → 400', async () => {
    const res = mockRes();
    await bezpay.confirmBankTransfer(req({ bankReference: 'REF-1' }), res);
    expect(res.statusCode).toBe(400);
    expect(fiatSettlement.recordFiatPayment).not.toHaveBeenCalled();
  });

  it('sin bankReference → 400', async () => {
    const res = mockRes();
    await bezpay.confirmBankTransfer(req({ paymentId: 'BEZ-TEST-0001' }), res);
    expect(res.statusCode).toBe(400);
    expect(fiatSettlement.recordFiatPayment).not.toHaveBeenCalled();
  });

  it('orden inexistente → 404', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(null);
    const res = mockRes();
    await bezpay.confirmBankTransfer(req({ paymentId: 'BEZ-NO-EXISTE', bankReference: 'REF-1' }), res);
    expect(res.statusCode).toBe(404);
  });

  it('orden cripto (no fiat) → 409, no se confirma', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(fiatOrder({
      metadata: { type: 'buy_bez', settlement: { payToken: 'USDT' } },
    }));
    const res = mockRes();
    await bezpay.confirmBankTransfer(req({ paymentId: 'BEZ-TEST-0001', bankReference: 'REF-1' }), res);
    expect(res.statusCode).toBe(409);
    expect(fiatSettlement.recordFiatPayment).not.toHaveBeenCalled();
  });

  it('orden sin términos de liquidación → 409', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(fiatOrder({ metadata: {} }));
    const res = mockRes();
    await bezpay.confirmBankTransfer(req({ paymentId: 'BEZ-TEST-0001', bankReference: 'REF-1' }), res);
    expect(res.statusCode).toBe(409);
    expect(fiatSettlement.recordFiatPayment).not.toHaveBeenCalled();
  });
});

describe('confirmación válida', () => {
  beforeEach(() => PaymentPG.findByPaymentIntent.mockResolvedValue(fiatOrder()));

  it('retiene — no entrega directamente', async () => {
    const res = mockRes();
    await bezpay.confirmBankTransfer(req({ paymentId: 'BEZ-TEST-0001', bankReference: 'ING-000123' }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.held).toBe(true);
    expect(fiatSettlement.recordFiatPayment).toHaveBeenCalledWith({
      paymentId: 'BEZ-TEST-0001',
      providerReference: 'ING-000123',
      methodKind: 'bank_transfer',
    });
  });

  it('funciona igual para EUR', async () => {
    PaymentPG.findByPaymentIntent.mockResolvedValue(fiatOrder({
      metadata: { type: 'buy_bez', settlement: { payToken: 'EUR' } },
    }));
    const res = mockRes();
    await bezpay.confirmBankTransfer(req({ paymentId: 'BEZ-TEST-0001', bankReference: 'ING-000456' }), res);
    expect(res.body.success).toBe(true);
  });

  it('la misma referencia dos veces → 409, sin duplicar', async () => {
    fiatSettlement.recordFiatPayment.mockResolvedValue({ held: false, duplicate: true });
    const res = mockRes();
    await bezpay.confirmBankTransfer(req({ paymentId: 'BEZ-TEST-0001', bankReference: 'ING-000123' }), res);
    expect(res.statusCode).toBe(409);
  });

  it('confirmar una orden ya retenida responde ok sin re-retener', async () => {
    fiatSettlement.recordFiatPayment.mockResolvedValue({ held: false, alreadyHeld: true });
    const res = mockRes();
    await bezpay.confirmBankTransfer(req({ paymentId: 'BEZ-TEST-0001', bankReference: 'ING-000123' }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.alreadyHeld).toBe(true);
  });
});
