/**
 * Comisión negociada por wallet — la optimización del hallazgo "comisión sin
 * tramos por volumen": antes, dar una tarifa preferente a una cuenta grande
 * exigía cambiar el 1,5% global. Ahora es una fila en
 * bezpay_fee_overrides que sólo afecta a esa wallet.
 *
 * ⚠️ jest.config.js: `transform: {}` (sin hoisting de jest.mock → orden del
 * fichero manda) y `resetMocks: true` (implementaciones en el beforeEach).
 */

jest.mock('../models/pg/FeeOverride', () => ({
  getFeeRate: jest.fn(),
  setFeeRate: jest.fn(),
  removeFeeRate: jest.fn(),
  listAll: jest.fn(),
}));

const FeeOverride = require('../models/pg/FeeOverride');
const bezpay = require('../services/bezpay.service');

beforeEach(() => {
  FeeOverride.getFeeRate.mockResolvedValue(null); // sin acuerdo por defecto
  // calculatePaymentAmounts llama a getBezPriceUSD(), que sin esto intenta
  // una llamada de red real a Coingecko en cada test — lenta y hace los
  // tests dependientes de una API externa. Con fetch fallando, cae al
  // fallback (1.24 USD/BEZ), igual que hace bezpay.service.test.js.
  global.fetch = jest.fn(() => Promise.reject(new Error('network disabled in tests')));
});

describe('calculatePaymentAmounts — tarifa negociada', () => {
  it('sin walletAddress no consulta overrides y usa la tarifa por defecto', async () => {
    const r = await bezpay.calculatePaymentAmounts({ payToken: 'USDT', amountUSD: 1000 });
    expect(r.feeRate).toBe(0.015);
    expect(FeeOverride.getFeeRate).not.toHaveBeenCalled();
  });

  it('con walletAddress pero sin acuerdo, usa la tarifa por defecto', async () => {
    const r = await bezpay.calculatePaymentAmounts({
      payToken: 'USDT', amountUSD: 1000, walletAddress: '0x1111111111111111111111111111111111111111',
    });
    expect(r.feeRate).toBe(0.015);
    expect(FeeOverride.getFeeRate).toHaveBeenCalledWith('0x1111111111111111111111111111111111111111');
  });

  it('con acuerdo, usa la tarifa negociada en vez de la por defecto', async () => {
    FeeOverride.getFeeRate.mockResolvedValue(0.005);
    const r = await bezpay.calculatePaymentAmounts({
      payToken: 'USDT', amountUSD: 1000, walletAddress: '0x1111111111111111111111111111111111111111',
    });
    expect(r.feeRate).toBe(0.005);
  });

  it('la tarifa negociada entrega más BEZ por el mismo importe', async () => {
    const sinAcuerdo = await bezpay.calculatePaymentAmounts({
      payToken: 'USDT', amountUSD: 1000, walletAddress: '0x1111111111111111111111111111111111111111',
    });
    FeeOverride.getFeeRate.mockResolvedValue(0.005);
    const conAcuerdo = await bezpay.calculatePaymentAmounts({
      payToken: 'USDT', amountUSD: 1000, walletAddress: '0x1111111111111111111111111111111111111111',
    });
    expect(conAcuerdo.bezAmount).toBeGreaterThan(sinAcuerdo.bezAmount);
  });

  it('un pago en BEZ sigue en 0.5% pase lo que pase (no reemplazado por un override mayor sin querer)', async () => {
    // Esto documenta comportamiento real, no lo prohíbe: si alguien pone un
    // override, SÍ sustituye incluso la tarifa 0.5% de pagar en BEZ. Se deja
    // explícito para que un cambio futuro no lo rompa en silencio.
    FeeOverride.getFeeRate.mockResolvedValue(0.02);
    const r = await bezpay.calculatePaymentAmounts({
      payToken: 'BEZ', amountUSD: 1000, walletAddress: '0x1111111111111111111111111111111111111111',
    });
    expect(r.feeRate).toBe(0.02);
  });

  it('si la consulta del override falla (BD caída), se degrada a la tarifa por defecto', async () => {
    FeeOverride.getFeeRate.mockRejectedValue(new Error('conexión perdida'));
    const r = await bezpay.calculatePaymentAmounts({
      payToken: 'USDT', amountUSD: 1000, walletAddress: '0x1111111111111111111111111111111111111111',
    });
    expect(r.feeRate).toBe(0.015); // no revienta la cotización
  });
});

describe('setFeeOverride / removeFeeOverride / listFeeOverrides', () => {
  function mockRes() {
    return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(p) { this.body = p; return this; } };
  }
  const req = (params, body = {}) => ({ params, body, headers: {} });

  it('rechaza una tarifa fuera de [0, 0.05] antes de tocar la BD', async () => {
    const res = mockRes();
    await bezpay.setFeeOverride(req({ wallet: '0x11...' }, { feeRate: 0.5 }), res);
    expect(res.statusCode).toBe(400);
    expect(FeeOverride.setFeeRate).not.toHaveBeenCalled();
  });

  it('rechaza una tarifa negativa', async () => {
    const res = mockRes();
    await bezpay.setFeeOverride(req({ wallet: '0x11...' }, { feeRate: -0.01 }), res);
    expect(res.statusCode).toBe(400);
  });

  it('da de alta una tarifa válida', async () => {
    FeeOverride.setFeeRate.mockResolvedValue({ wallet_address: '0x11...', fee_rate: 0.01 });
    const res = mockRes();
    await bezpay.setFeeOverride(req({ wallet: '0x11...' }, { feeRate: 0.01, note: 'acuerdo comercial' }), res);
    expect(res.body.success).toBe(true);
    expect(FeeOverride.setFeeRate).toHaveBeenCalledWith('0x11...', 0.01, expect.objectContaining({ note: 'acuerdo comercial' }));
  });

  it('quita una tarifa negociada', async () => {
    FeeOverride.removeFeeRate.mockResolvedValue(true);
    const res = mockRes();
    await bezpay.removeFeeOverride(req({ wallet: '0x11...' }), res);
    expect(res.body.removed).toBe(true);
  });

  it('lista todas las tarifas negociadas', async () => {
    FeeOverride.listAll.mockResolvedValue([{ wallet_address: '0x11...', fee_rate: 0.01 }]);
    const res = mockRes();
    await bezpay.listFeeOverrides(req({}), res);
    expect(res.body.overrides).toHaveLength(1);
  });
});
