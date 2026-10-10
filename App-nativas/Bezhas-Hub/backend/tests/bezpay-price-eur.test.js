/**
 * Precio BEZ en BezPay (services/bezpay.service.js).
 *
 * El precio es el real de la fase semilla (BEZ_PRICE_USD, 0,0075 USD). El feed
 * de CoinGecko sólo se consulta si se configura BEZ_COINGECKO_ID a propósito:
 * antes se consultaba `bez-coin`, que es OTRO token, y su precio decidía
 * cuánto BEZ se entregaba.
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

const PRECIO_REAL = 0.0075;
const EUR_PER_USD_FALLBACK = 0.92;

function cargar(env = {}) {
  let mod;
  const previo = { ...process.env };
  Object.assign(process.env, env);
  jest.isolateModules(() => { mod = require('../services/bezpay.service'); });
  process.env = previo;
  return mod;
}

beforeEach(() => {
  delete process.env.HOT_WALLET_PRIVATE_KEY;
  delete process.env.BEZ_COINGECKO_ID;
  delete process.env.BEZ_PRICE_USD;
});

describe('precio de BEZ', () => {
  it('sin feed configurado usa el precio real y NO consulta ningún feed externo', async () => {
    global.fetch = jest.fn();
    const bezpay = cargar();
    expect(await bezpay.getBezPriceUSD()).toBe(PRECIO_REAL);
    expect(await bezpay.getBezPriceEUR()).toBeCloseTo(PRECIO_REAL * EUR_PER_USD_FALLBACK, 8);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('BEZ_PRICE_USD fija el precio', async () => {
    global.fetch = jest.fn();
    const bezpay = cargar({ BEZ_PRICE_USD: '0.01' });
    expect(await bezpay.getBezPriceUSD()).toBe(0.01);
  });

  it('con BEZ_COINGECKO_ID configurado usa ESE id, y el EUR real del feed', async () => {
    global.fetch = jest.fn(() => Promise.resolve({
      json: () => Promise.resolve({ 'bezhas-propio': { usd: 0.008, eur: 0.0074 } }),
    }));
    const bezpay = cargar({ BEZ_COINGECKO_ID: 'bezhas-propio' });
    expect(await bezpay.getBezPriceEUR()).toBe(0.0074);
    expect(await bezpay.getBezPriceUSD()).toBe(0.008);
    expect(global.fetch.mock.calls[0][0]).toContain('ids=bezhas-propio');

    // Cache de 60s: una segunda lectura no re-consulta el feed.
    const llamadas = global.fetch.mock.calls.length;
    await bezpay.getBezPriceEUR();
    expect(global.fetch.mock.calls.length).toBe(llamadas);
  });

  it('si el feed configurado no responde, se queda con el precio real', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('network disabled')));
    const bezpay = cargar({ BEZ_COINGECKO_ID: 'bezhas-propio' });
    expect(await bezpay.getBezPriceUSD()).toBe(PRECIO_REAL);
  });
});
