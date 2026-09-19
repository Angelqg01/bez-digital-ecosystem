/**
 * Cotizaciones al cambio vigente.
 *
 * El precio de cada cripto ya no es una constante del repositorio: sale del
 * oráculo, que refresca el mercado cada media hora. Estas pruebas fijan lo
 * que eso tiene que significar en las rutas que mueven dinero — que se cobra
 * al cambio de ahora, y que con un cambio caducado no se cobra.
 */
jest.mock('../services/reference-rates.service');
jest.mock('../utils/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const referenceRates = require('../services/reference-rates.service');
const tokenomics = require('../config/tokenomics.config');

// Se cargan una sola vez: `jest.resetModules()` daría a cada servicio una
// instancia distinta del mock, y las implementaciones que instala cada prueba
// no llegarían al módulo que se está probando.
const cryptoPayment = require('../services/crypto-payment.service');
const tokenomicsService = require('../services/tokenomics.service');

const FRESCA = {
    source: 'market',
    asOf: new Date().toISOString(),
    ageMs: 60_000,
    stale: false,
    disclaimer: 'Cotización de mercado (CoinGecko), refrescada cada 30 minutos.',
};

const CADUCADA = {
    source: 'stale',
    asOf: new Date(Date.now() - 7_200_000).toISOString(),
    ageMs: 7_200_000,
    stale: true,
    disclaimer: 'Cotización de hace 120 minutos; supera la edad máxima aceptada.',
};

/** Precio del MATIC muy distinto del de la constante, para que se note cuál sale. */
const MATIC_MERCADO = 0.2431;

function conCotizacion(estado, tasas = { MATIC: MATIC_MERCADO, USDT: 1, USDC: 1 }) {
    referenceRates.getUsdPerUnit.mockImplementation(async (simbolo) => {
        const rate = tasas[String(simbolo || '').toUpperCase()];
        return { rate: Number.isFinite(rate) ? rate : null, ...estado };
    });
    referenceRates.toUsd.mockImplementation(async (cantidad, simbolo) => {
        const rate = tasas[String(simbolo || '').toUpperCase()];
        const tiene = Number.isFinite(rate) && Number.isFinite(cantidad);
        return { usd: tiene ? cantidad * rate : null, rate: Number.isFinite(rate) ? rate : null, ...estado };
    });
}

describe('crypto-payment · cotización de compra', () => {
    const servicio = cryptoPayment;

    beforeEach(() => {
        conCotizacion(FRESCA);
    });

    it('cotiza el MATIC al precio de mercado, no al de la constante', async () => {
        const r = await servicio.getQuote(100, 'MATIC');

        expect(r.success).toBe(true);
        // 100 MATIC × 0,2431 $ = 24,31 $, y a 0,0075 $/BEZ son 3241,33 BEZ.
        expect(r.quote.toAmount).toBeCloseTo((100 * MATIC_MERCADO) / tokenomics.price.usd, 6);
        expect(r.quote.rateUsdPerUnit).toBe(MATIC_MERCADO);
        // Con la constante habrían salido 80 $ en vez de 24,31 $.
        expect(r.quote.toAmount).not.toBeCloseTo(
            (100 * tokenomics.rates.usdPerUnit.MATIC) / tokenomics.price.usd, 2,
        );
    });

    it('dice de dónde sale el cambio y de cuándo es', async () => {
        const r = await servicio.getQuote(100, 'MATIC');

        expect(r.quote.rateSource).toBe('market');
        expect(r.quote.rateAsOf).toBe(FRESCA.asOf);
        expect(r.quote.rateAgeSeconds).toBe(60);
        expect(r.quote.rateDisclaimer).toMatch(/mercado/i);
    });

    it('tampoco da por hecho que una stablecoin vale un dólar', async () => {
        // Un USDT despegado a 0,97 $ tiene que cotizar a 0,97, no a 1.
        conCotizacion(FRESCA, { USDT: 0.97 });

        const r = await servicio.getQuote(100, 'USDT');

        expect(r.quote.toAmount).toBeCloseTo(97 / tokenomics.price.usd, 6);
    });

    it('se niega a cotizar con un cambio caducado', async () => {
        conCotizacion(CADUCADA);

        const r = await servicio.getQuote(100, 'MATIC');

        expect(r.success).toBe(false);
        expect(r.error).toMatch(/no hay cotización reciente/i);
    });

    it('rechaza una divisa sin tasa en vez de cobrar cero', async () => {
        const r = await servicio.getQuote(100, 'DOGE');

        expect(r.success).toBe(false);
        expect(r.error).toMatch(/unsupported currency/i);
    });
});

describe('tokenomics · coste de gas', () => {
    const servicio = tokenomicsService;

    beforeEach(() => {
        conCotizacion(FRESCA);
        jest.spyOn(servicio, 'getGasPrice').mockResolvedValue(30);
    });

    it('valora el gas al precio vigente del MATIC', async () => {
        const r = await servicio.estimateGasCost(100_000, 'STARTER');

        // 100 000 × 30 gwei = 0,003 MATIC, a 0,2431 $ son 0,00072930 $.
        expect(r.gasCostMatic).toBeCloseTo(0.003, 6);
        expect(r.maticPriceUSD).toBe(MATIC_MERCADO);
        expect(r.gasCostUSD).toBeCloseTo(0.003 * MATIC_MERCADO, 4);
    });

    it('declara la procedencia para que una estimación vieja no parezca fresca', async () => {
        conCotizacion(CADUCADA);

        const r = await servicio.estimateGasCost(100_000, 'STARTER');

        expect(r.rateSource).toBe('stale');
        expect(r.rateStale).toBe(true);
        expect(r.rateAgeSeconds).toBe(7200);
    });
});
