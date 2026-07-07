/**
 * Feed de precio BEZ en EUR (services/bezpay.service.js).
 *
 * getBezPriceEUR usa el feed real de CoinGecko (vs_currencies=usd,eur) con
 * cache compartida de 60s; si el feed no trae EUR (o no responde), deriva del
 * USD con EUR_PER_USD_FALLBACK (def. 0.92). Sustituye la aproximación EUR≈USD
 * que usaba plugin-bridge para cotizar planes.
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

const bezpay = require('../services/bezpay.service');

// Fallbacks deterministas del servicio (ver _bezPriceCache inicial).
const USD_FALLBACK = 1.24;
const EUR_PER_USD_FALLBACK = 0.92;

beforeEach(() => {
  delete process.env.HOT_WALLET_PRIVATE_KEY;
});

describe('getBezPriceEUR', () => {
  it('deriva del USD de fallback cuando el feed no responde', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('network disabled')));
    const eur = await bezpay.getBezPriceEUR();
    expect(eur).toBeCloseTo(USD_FALLBACK * EUR_PER_USD_FALLBACK, 6);
  });

  it('usa el EUR real del feed cuando está disponible (y lo cachea junto al USD)', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      json: () => Promise.resolve({ 'bez-coin': { usd: 2.0, eur: 1.8 } }),
    }));
    const eur = await bezpay.getBezPriceEUR();
    expect(eur).toBe(1.8);
    expect(await bezpay.getBezPriceUSD()).toBe(2.0);

    // Cache de 60s: una segunda lectura no re-consulta el feed.
    const calls = global.fetch.mock.calls.length;
    await bezpay.getBezPriceEUR();
    expect(global.fetch.mock.calls.length).toBe(calls);
  });
});
