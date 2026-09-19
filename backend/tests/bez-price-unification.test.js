/**
 * Precio del BEZ: fuente única.
 *
 * El precio definitivo del BEZ V1 es 0,0075 $. Antes de unificarlo convivían
 * siete valores escritos a mano (0,00075 · 0,0075 · 0,10 · 0,50 · 0,55 · 1,24
 * USD y 0,46 · 1,14 EUR) repartidos por rutas, servicios y configuración, así
 * que lo que se cobraba dependía de qué ruta atendiera la petición.
 *
 * Estas pruebas fijan las tres cosas que impiden que vuelva a pasar:
 *   1. el valor y su derivado en EUR,
 *   2. que el resto del código lea de la fuente en vez de duplicarla,
 *   3. que el cobro por Stripe sea correcto a una escala sub-céntimo.
 */
const fs = require('fs');
const path = require('path');

const tokenomics = require('../config/tokenomics.config');

const RAIZ = path.join(__dirname, '..');
const PRECIO_ESPERADO_USD = 0.0075;

// ─── Mocks mínimos para poder cargar stripe.service ──────────────────────────
//
// El prefijo `mock` es obligatorio: jest.mock() no deja que su fábrica
// referencie variables de fuera del ámbito si no lo llevan. Y como el
// jest.config lleva `resetMocks: true`, la implementación se borra antes de
// cada prueba, así que se reinstala en el beforeEach.
const mockSesionesCreadas = [];
const mockCrearSesion = jest.fn();

jest.mock('stripe', () => jest.fn().mockImplementation(() => ({
    checkout: {
        sessions: { create: mockCrearSesion, retrieve: jest.fn() },
    },
    paymentIntents: { create: jest.fn() },
    subscriptions: { list: jest.fn(), cancel: jest.fn() },
    customers: { list: jest.fn() },
    refunds: { create: jest.fn() },
    webhooks: { constructEvent: jest.fn() },
})));

jest.mock('../middleware/auditLogger', () => ({
    audit: { admin: jest.fn(), security: jest.fn(), payment: jest.fn() },
}));
jest.mock('../middleware/discordNotifier', () => ({
    notifyPaymentFailed: jest.fn(),
    notifyStripeWebhookError: jest.fn(),
    notifyHigh: jest.fn(),
}));
jest.mock('../middleware/telegramNotifier', () => ({
    notifyPaymentFailed: jest.fn(),
    notifyHigh: jest.fn(),
    send: jest.fn(),
}));

const stripeService = require('../services/stripe.service');

describe('precio del BEZ · fuente única', () => {
    it('vale 0,0075 $ y deriva el EUR del mismo número', () => {
        expect(tokenomics.price.usd).toBe(PRECIO_ESPERADO_USD);
        expect(tokenomics.price.eur).toBeCloseTo(PRECIO_ESPERADO_USD / tokenomics.price.eurUsdRate, 8);
    });

    it('el fallback del oráculo no duplica el valor, lo reutiliza', () => {
        expect(tokenomics.priceOracle.fallbackPriceUSD).toBe(tokenomics.price.usd);
        expect(tokenomics.priceOracle.fallbackPriceEUR).toBe(tokenomics.price.eur);
    });
});

describe('precio del BEZ · sin valores escritos a mano', () => {
    // Ficheros de producción que antes llevaban el precio a mano.
    const FICHEROS = [
        'config/tokenomics.config.js',
        'routes/bezpay.routes.js',
        'routes/bezcoin.routes.js',
        'routes/bezcoin-moonpay.routes.js',
        'routes/payment.routes.js',
        'routes/billing.routes.js',
        'services/bezpay.service.js',
        'services/crypto-payment.service.js',
        'services/stripe.service.js',
        'services/aiGateway.service.js',
        'services/automation/rewardSystem.service.js',
    ];

    // Los precios antiguos. `0.0075` NO está en la lista: tokenomics.config.js
    // es justamente el sitio donde debe aparecer una vez.
    const PRECIOS_ANTIGUOS = [
        { valor: '1.24', etiqueta: '1,24 $ (caché de bezpay.service)' },
        { valor: '1.14', etiqueta: '1,14 € (fallback de bezpay.routes)' },
        { valor: '0.00075', etiqueta: '0,00075 $ (fallback del oráculo)' },
        { valor: '0.00070', etiqueta: '0,00070 € (fallback del oráculo)' },
    ];

    it.each(FICHEROS)('%s no contiene ningún precio antiguo del BEZ', (relativo) => {
        const texto = fs.readFileSync(path.join(RAIZ, relativo), 'utf8');
        // Se ignoran los comentarios: documentan de dónde venimos.
        const codigo = texto
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n')
            .filter((linea) => !linea.trimStart().startsWith('//'))
            .join('\n');

        for (const { valor, etiqueta } of PRECIOS_ANTIGUOS) {
            const suelto = new RegExp(`(?<![\\d.])${valor.replace('.', '\\.')}(?![\\d])`);
            expect({ fichero: relativo, precio: etiqueta, encontrado: suelto.test(codigo) })
                .toEqual({ fichero: relativo, precio: etiqueta, encontrado: false });
        }
    });

    it('tokenomics.config.js declara el precio una sola vez', () => {
        const texto = fs.readFileSync(path.join(RAIZ, 'config/tokenomics.config.js'), 'utf8');
        const codigo = texto
            .split('\n')
            .filter((linea) => !linea.trimStart().startsWith('//'))
            .join('\n');
        const apariciones = codigo.match(/(?<![\d.])0\.0075(?![\d])/g) || [];
        expect(apariciones).toHaveLength(1);
    });
});

describe('Stripe · compra de tokens a escala sub-céntimo', () => {
    beforeEach(() => {
        mockSesionesCreadas.length = 0;
        mockCrearSesion.mockImplementation(async (payload) => {
            mockSesionesCreadas.push(payload);
            return { id: 'cs_test_unificacion', url: 'https://stripe.test/cs_test_unificacion' };
        });
    });

    const usuario = {
        userId: 'user123',
        email: 'test@example.com',
        walletAddress: '0x1234567890123456789012345678901234567890',
    };

    it('cobra el total exacto en una sola línea, no un unit_amount redondeado', async () => {
        const tokens = 1000; // 1000 × 0,0075 $ = 7,50 $ = 750 céntimos

        const resultado = await stripeService.createTokenPurchaseSession(tokens, usuario);

        expect(resultado.success).toBe(true);
        expect(mockSesionesCreadas).toHaveLength(1);

        const [linea] = mockSesionesCreadas[0].line_items;
        expect(linea.price_data.unit_amount).toBe(750);
        expect(linea.quantity).toBe(1);

        // Un unit_amount por token habría sido Math.round(0,75) = 1 céntimo,
        // es decir 1000 céntimos: un 33 % de sobrecoste.
        expect(linea.price_data.unit_amount * linea.quantity).toBe(
            Math.round(tokens * tokenomics.price.usd * 100)
        );
    });

    it('redondea el total una sola vez, no por token', async () => {
        // 333 × 0,0075 $ = 2,4975 $ -> 250 céntimos.
        // Redondeando por token serían 333 céntimos (un 33 % de más).
        await stripeService.createTokenPurchaseSession(333, usuario);
        expect(mockSesionesCreadas[0].line_items[0].price_data.unit_amount).toBe(250);
    });

    it('rechaza importes por debajo del mínimo que acepta Stripe', async () => {
        // 10 × 0,0075 $ = 7,5 céntimos, por debajo de los 50 de Stripe.
        const resultado = await stripeService.createTokenPurchaseSession(10, usuario);

        expect(resultado.success).toBe(false);
        expect(resultado.error).toMatch(/mínimo que acepta Stripe/);
        expect(mockSesionesCreadas).toHaveLength(0);
    });
});


// ════════════════════════════════════════════════════════════
// TASAS DE REFERENCIA
// ════════════════════════════════════════════════════════════
describe('tasas de referencia · fuente única', () => {
    it('declara todas las divisas que usan los servicios', () => {
        for (const simbolo of ['USD', 'USDT', 'USDC', 'EUR', 'GBP', 'MXN', 'MATIC', 'ETH', 'BTC', 'BNB']) {
            const tasa = tokenomics.rates.usdPerUnit[simbolo];
            expect({ simbolo, valida: Number.isFinite(tasa) && tasa > 0 })
                .toEqual({ simbolo, valida: true });
        }
    });

    it('mantiene las stablecoins a la par con el dólar', () => {
        expect(tokenomics.rates.usdPerUnit.USD).toBe(1);
        expect(tokenomics.rates.usdPerUnit.USDT).toBe(1);
        expect(tokenomics.rates.usdPerUnit.USDC).toBe(1);
    });

    it('el tipo EUR del precio y el de la tabla son el mismo número', () => {
        expect(tokenomics.rates.usdPerUnit.EUR).toBe(tokenomics.price.eurUsdRate);
    });

    it('toUsd convierte, y devuelve null en vez de NaN si no conoce el símbolo', () => {
        expect(tokenomics.rates.toUsd(10, 'MATIC')).toBeCloseTo(10 * tokenomics.rates.usdPerUnit.MATIC, 10);
        expect(tokenomics.rates.toUsd(10, 'matic')).toBeCloseTo(10 * tokenomics.rates.usdPerUnit.MATIC, 10);
        expect(tokenomics.rates.toUsd(10, 'DOGE')).toBeNull();
        expect(tokenomics.rates.toUsd(NaN, 'MATIC')).toBeNull();
    });
});

describe('tesorería DeFi · valorada con la fuente única', () => {
    it('suma cada activo a su precio de la tabla, no a una tabla propia', () => {
        const defi = require('../services/defi-integration.service');
        const saldos = defi.treasuryBalance;

        const esperado = Object.entries(saldos).reduce((total, [token, cantidad]) => {
            const simbolo = token.toUpperCase();
            const precio = simbolo === 'BEZ'
                ? tokenomics.price.usd
                : tokenomics.rates.usdPerUnit[simbolo];
            return Number.isFinite(precio) ? total + cantidad * precio : total;
        }, 0);

        expect(defi.calculateTotalValueUSD()).toBeCloseTo(esperado, 6);
        // Con la tabla vieja (BEZ 0,50 $ · ETH 2000 $) el millón de BEZ valía
        // 500.000 $; al precio real vale 7.500.
        expect(defi.calculateTotalValueUSD()).not.toBeCloseTo(600000, 0);
    });

    it('ignora un activo sin precio en vez de sumarle NaN', () => {
        const defi = require('../services/defi-integration.service');
        const original = { ...defi.treasuryBalance };
        try {
            defi.treasuryBalance.DOGE = 1_000_000;
            expect(Number.isFinite(defi.calculateTotalValueUSD())).toBe(true);
        } finally {
            defi.treasuryBalance = original;
        }
    });
});

describe('tasas de referencia · sin valores escritos a mano', () => {
    // Ficheros de producción que antes llevaban su propia tasa.
    const FICHEROS = [
        'services/crypto-payment.service.js',
        'services/tokenomics.service.js',
        'services/bezpay.service.js',
        'routes/bezcoin.routes.js',
        'routes/bezcoin-moonpay.routes.js',
        'services/defi-integration.service.js',
    ];

    const TASAS_ANTIGUAS = [
        { patron: /maticPriceUSD\s*=\s*0\.80\b/, etiqueta: 'MATIC a 0,80 $' },
        { patron: /maticPriceUSD\s*=\s*1\.0\b/, etiqueta: 'MATIC a 1,00 $' },
        { patron: /\bMATIC\s*:\s*0\.[0-9]/, etiqueta: 'tabla propia con MATIC' },
        { patron: /\bETH\s*:\s*[0-9]{4}\b/, etiqueta: 'tabla propia con ETH' },
    ];

    it.each(FICHEROS)('%s no escribe ninguna tasa a mano', (relativo) => {
        const texto = fs.readFileSync(path.join(RAIZ, relativo), 'utf8');
        const codigo = texto
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n')
            .filter((linea) => !linea.trimStart().startsWith('//'))
            .join('\n');

        for (const { patron, etiqueta } of TASAS_ANTIGUAS) {
            expect({ fichero: relativo, tasa: etiqueta, encontrado: patron.test(codigo) })
                .toEqual({ fichero: relativo, tasa: etiqueta, encontrado: false });
        }
    });
});
