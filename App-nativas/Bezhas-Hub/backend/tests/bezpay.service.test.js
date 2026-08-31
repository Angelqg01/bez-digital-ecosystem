/**
 * Suite autónoma de BEZ-Pay (services/bezpay.service.js).
 *
 * Verifica la lógica PURA del procesador de pagos nativo sin tocar cadena,
 * base de datos ni GCP: cálculo de montos, quote, flujo fiat (IBAN + refCode),
 * flujo crypto (Treasury + red + contrato) y validaciones de entrada.
 *
 * Todo lo externo está mockeado:
 *  - models/pg/Payment  → in-memory
 *  - bridge             → adapter nulo
 *  - payment-openclaw-bridge → no-op
 *  - global.fetch       → falla → getBezPriceUSD cae al fallback (1.24 USD/BEZ)
 *
 * Sin HOT_WALLET_PRIVATE_KEY, el hot wallet queda deshabilitado y no hay RPC.
 */

jest.mock('../models/pg/Payment', () => ({
  create: jest.fn(),
  findByPaymentIntent: jest.fn(),
  updateByPaymentIntent: jest.fn(),
}));
jest.mock('../bridge', () => ({
  bridgeCore: { getAdapter: jest.fn(() => null) },
}));
jest.mock('../services/payment-openclaw-bridge', () => ({
  onPaymentCompleted: jest.fn(() => Promise.resolve()),
}), { virtual: true });

const PaymentPG = require('../models/pg/Payment');
const bezpay = require('../services/bezpay.service');

// Precio BEZ de fallback cuando fetch falla (ver _bezPriceCache inicial).
const BEZ_PRICE_FALLBACK = 1.24;
const TREASURY_DEFAULT = '0x89c23890c742d710265dD61be789C71dC8999b12';
const USDT_POLYGON = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

beforeEach(() => {
  // Asegura hot wallet deshabilitado → sin RPC/cadena en los tests.
  delete process.env.HOT_WALLET_PRIVATE_KEY;
  // fetch siempre falla → getBezPriceUSD usa el fallback determinista.
  global.fetch = jest.fn(() => Promise.reject(new Error('network disabled in tests')));
  PaymentPG.create.mockImplementation(async (doc) => ({ ...doc, _id: 'pay_test_1' }));
  PaymentPG.updateByPaymentIntent.mockResolvedValue(undefined);
  PaymentPG.findByPaymentIntent.mockResolvedValue(null);
});

describe('getQuote — cálculo de montos', () => {
  it('buy_bez con USDT aplica fee 1.5% y convierte a BEZ al precio fallback', async () => {
    const res = mockRes();
    await bezpay.getQuote({ query: { payToken: 'USDT', amountUSD: 100, type: 'buy_bez' } }, res);

    expect(res.body.success).toBe(true);
    expect(res.body.feeRate).toBe(0.015);
    expect(res.body.bezPriceUSD).toBe(BEZ_PRICE_FALLBACK);
    // bezAmount = (100 * (1 - 0.015)) / 1.24
    const expectedBez = parseFloat(((100 * (1 - 0.015)) / BEZ_PRICE_FALLBACK).toFixed(6));
    expect(res.body.bezAmount).toBeCloseTo(expectedBez, 5);
    // 100 USD en USDT (1:1) → envías 100 USDT
    expect(res.body.tokenAmountFloat).toBeCloseTo(100, 6);
    expect(res.body.feeUSD).toBeCloseTo(1.5, 6);
  });

  it('pagar en BEZ aplica el fee reducido (0.5%)', async () => {
    const res = mockRes();
    await bezpay.getQuote({ query: { payToken: 'BEZ', amountUSD: 100, type: 'buy_bez' } }, res);
    expect(res.body.feeRate).toBe(0.005);
  });

  it('subscription usa el BEZ fijo y el precio del plan (pro = 2500 BEZ / 199 USD)', async () => {
    const res = mockRes();
    await bezpay.getQuote({ query: { payToken: 'USDT', amountUSD: 0, type: 'subscription', planId: 'pro' } }, res);
    expect(res.body.bezAmount).toBe(2500);
    expect(res.body.amountUSD).toBe(199);
  });
});

describe('createPayment — flujo FIAT (transferencia bancaria)', () => {
  it('EUR devuelve el IBAN real de ING y el refCode = paymentId', async () => {
    const res = mockRes();
    await bezpay.createPayment(
      { body: { payToken: 'EUR', amountUSD: 250, type: 'buy_bez' } },
      res
    );
    expect(res.body.success).toBe(true);
    expect(res.body.fiat).toBe(true);
    expect(res.body.currency).toBe('EUR');
    expect(res.body.bankDetails.iban).toMatch(/ES77 1465 0100 91 1766376210/);
    expect(res.body.refCode).toBe(res.body.paymentId);
    expect(res.body.paymentId).toMatch(/^BEZ-/);
  });
});

describe('createPayment — flujo CRYPTO', () => {
  it('USDT devuelve Treasury como paymentAddress, red polygon y contrato USDT', async () => {
    const res = mockRes();
    await bezpay.createPayment(
      { body: { payToken: 'USDT', amountUSD: 100, walletAddress: '0x1111111111111111111111111111111111111111', type: 'buy_bez' } },
      res
    );
    expect(res.body.success).toBe(true);
    expect(res.body.paymentAddress).toBe(process.env.TREASURY_WALLET || TREASURY_DEFAULT);
    expect(res.body.network).toBe('polygon');
    expect(res.body.contractAddress).toBe(USDT_POLYGON);
    expect(typeof res.body.expiresAt).toBe('string');
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(PaymentPG.create).toHaveBeenCalledTimes(1);
  });

  it('sin payToken responde 400', async () => {
    const res = mockRes();
    await bezpay.createPayment({ body: { amountUSD: 100 } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('crypto sin walletAddress responde 400', async () => {
    const res = mockRes();
    await bezpay.createPayment({ body: { payToken: 'USDT', amountUSD: 100 } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('getHotWalletStatus — sin clave configurada', () => {
  it('reporta configured=false y balances 0 sin llamar a la cadena', async () => {
    const res = mockRes();
    await bezpay.getHotWalletStatus({}, res);
    expect(res.body.success).toBe(true);
    expect(res.body.configured).toBe(false);
    expect(res.body.bezBalance).toBe(0);
  });
});
