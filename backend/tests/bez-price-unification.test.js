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
