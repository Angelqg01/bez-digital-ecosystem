/**
 * confirmBankTransferBatch — un wire de tesorería cubre varias facturas.
 *
 * Garantías que importan aquí (ver services/bezpay.service.js):
 *   - se cargan y validan TODAS las órdenes antes de tocar nada (todo o nada)
 *   - cada orden debe ser fiat (USD/EUR), igual que confirmBankTransfer
 *   - la suma de lo esperado no puede superar lo recibido (tolerancia 0.01)
 *   - cada orden queda con su propia providerReference derivada del mismo
 *     wire (`${bankReference}#${paymentId}`), trazable pero no colisionante
 *   - un fallo de recordFiatPayment en una orden no aborta las demás — se
 *     reporta por orden, no se revienta el lote entero
 *
 * Verificado además contra Postgres real (no sólo mocks): las 3 órdenes se
 * retienen, cada una libera con dispense por separado sin chocar con
 * idx_payments_tx_hash_unique (cada entrega real tiene su propio txHash), el
 * mismo lote reenviado es idempotente, y un wire insuficiente rechaza las 3
 * sin dejar ninguna a medias.
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

function fiatOrder(id, fiatAmount, overrides = {}) {
  return {
    payment_intent_id: id,
    wallet_address: '0x1111111111111111111111111111111111111111',
    fiat_amount: fiatAmount,
    metadata: { type: 'buy_bez', settlement: { payToken: 'USD' } },
    ...overrides,
  };
}

beforeEach(() => {
  fiatSettlement.recordFiatPayment.mockResolvedValue({ held: true });
});

describe('validaciones de forma', () => {
  it('sin bankReference → 400', async () => {
    const res = mockRes();
    await bezpay.confirmBankTransferBatch(req({ totalAmountReceived: 100, paymentIds: ['A'] }), res);
    expect(res.statusCode).toBe(400);
    expect(fiatSettlement.recordFiatPayment).not.toHaveBeenCalled();
  });

  it('paymentIds vacío → 400', async () => {
    const res = mockRes();
    await bezpay.confirmBankTransferBatch(req({ bankReference: 'REF-1', totalAmountReceived: 100, paymentIds: [] }), res);
    expect(res.statusCode).toBe(400);
  });

  it('totalAmountReceived no numérico o no positivo → 400', async () => {
    const res = mockRes();
    await bezpay.confirmBankTransferBatch(req({ bankReference: 'REF-1', totalAmountReceived: -5, paymentIds: ['A'] }), res);
    expect(res.statusCode).toBe(400);
    expect(fiatSettlement.recordFiatPayment).not.toHaveBeenCalled();
  });
});

describe('carga y validación de cada orden — todo o nada antes de tocar nada', () => {
  it('una orden inexistente → 404, ninguna se confirma', async () => {
    PaymentPG.findByPaymentIntent
      .mockResolvedValueOnce(fiatOrder('A', 100))
      .mockResolvedValueOnce(null);
    const res = mockRes();
    await bezpay.confirmBankTransferBatch(req({ bankReference: 'REF-1', totalAmountReceived: 200, paymentIds: ['A', 'B'] }), res);
    expect(res.statusCode).toBe(404);
    expect(fiatSettlement.recordFiatPayment).not.toHaveBeenCalled();
  });

  it('una orden no-fiat (cripto) en el lote → 409, ninguna se confirma', async () => {
    PaymentPG.findByPaymentIntent
      .mockResolvedValueOnce(fiatOrder('A', 100))
      .mockResolvedValueOnce(fiatOrder('B', 100, { metadata: { type: 'buy_bez', settlement: { payToken: 'USDT' } } }));
    const res = mockRes();
    await bezpay.confirmBankTransferBatch(req({ bankReference: 'REF-1', totalAmountReceived: 200, paymentIds: ['A', 'B'] }), res);
    expect(res.statusCode).toBe(409);
    expect(fiatSettlement.recordFiatPayment).not.toHaveBeenCalled();
  });
});

describe('salvaguarda de suma — todo o nada', () => {
  it('la suma esperada supera lo recibido → 409, rechaza el lote entero', async () => {
    PaymentPG.findByPaymentIntent
      .mockResolvedValueOnce(fiatOrder('A', 1000))
      .mockResolvedValueOnce(fiatOrder('B', 1000))
      .mockResolvedValueOnce(fiatOrder('C', 1000));
    const res = mockRes();
    await bezpay.confirmBankTransferBatch(req({ bankReference: 'REF-1', totalAmountReceived: 2000, paymentIds: ['A', 'B', 'C'] }), res);
    expect(res.statusCode).toBe(409);
    expect(fiatSettlement.recordFiatPayment).not.toHaveBeenCalled();
    expect(res.body.totalExpected).toBe(3000);
  });

  it('tolera redondeo hasta 0.01 sin rechazar', async () => {
    PaymentPG.findByPaymentIntent
      .mockResolvedValueOnce(fiatOrder('A', 100.005))
      .mockResolvedValueOnce(fiatOrder('B', 100));
    const res = mockRes();
    await bezpay.confirmBankTransferBatch(req({ bankReference: 'REF-1', totalAmountReceived: 200.01, paymentIds: ['A', 'B'] }), res);
    expect(res.body.success).toBe(true);
  });
});

describe('confirmación válida del lote', () => {
  beforeEach(() => {
    PaymentPG.findByPaymentIntent
      .mockResolvedValueOnce(fiatOrder('A', 1000))
      .mockResolvedValueOnce(fiatOrder('B', 1500))
      .mockResolvedValueOnce(fiatOrder('C', 800));
  });

  it('confirma las 3 órdenes con providerReference derivada del mismo wire', async () => {
    const res = mockRes();
    await bezpay.confirmBankTransferBatch(req({ bankReference: 'ING-BATCH-001', totalAmountReceived: 3300, paymentIds: ['A', 'B', 'C'] }), res);

    expect(res.body.success).toBe(true);
    expect(fiatSettlement.recordFiatPayment).toHaveBeenCalledTimes(3);
    expect(fiatSettlement.recordFiatPayment).toHaveBeenCalledWith({ paymentId: 'A', providerReference: 'ING-BATCH-001#A', methodKind: 'bank_transfer' });
    expect(fiatSettlement.recordFiatPayment).toHaveBeenCalledWith({ paymentId: 'B', providerReference: 'ING-BATCH-001#B', methodKind: 'bank_transfer' });
    expect(fiatSettlement.recordFiatPayment).toHaveBeenCalledWith({ paymentId: 'C', providerReference: 'ING-BATCH-001#C', methodKind: 'bank_transfer' });
  });

  it('reporta el remainder (sobrante del wire tras cubrir lo esperado)', async () => {
    const res = mockRes();
    await bezpay.confirmBankTransferBatch(req({ bankReference: 'ING-BATCH-001', totalAmountReceived: 3305, paymentIds: ['A', 'B', 'C'] }), res);
    expect(res.body.remainder).toBeCloseTo(5, 2);
  });

  it('un fallo de recordFiatPayment en UNA orden no aborta las demás — se reporta por orden', async () => {
    fiatSettlement.recordFiatPayment
      .mockResolvedValueOnce({ held: true })
      .mockRejectedValueOnce(new Error('referencia ya usada'))
      .mockResolvedValueOnce({ held: true });
    const res = mockRes();
    await bezpay.confirmBankTransferBatch(req({ bankReference: 'ING-BATCH-001', totalAmountReceived: 3300, paymentIds: ['A', 'B', 'C'] }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.results[0].held).toBe(true);
    expect(res.body.results[1].held).toBe(false);
    expect(res.body.results[1].error).toBe('referencia ya usada');
    expect(res.body.results[2].held).toBe(true);
  });
});
