/**
 * Pruebas de las herramientas de pago.
 *
 * Cada bloque de abajo fija un fallo concreto que estas herramientas tenían y
 * que ninguna prueba veía, porque hasta ahora el fichero no tenía ninguna.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult } from '../helpers/mockMcpServer.js';

const PRECIO_BEZ = 0.5;

vi.mock('../../config.js', () => ({
    config: {
        token: { address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8', priceUSD: 0.5, decimals: 18 },
        network: { mode: 'amoy', activeRpc: 'https://rpc-amoy.polygon.technology', rpc: {} },
        integrations: {},
        // Espeja la forma de config.rates: las herramientas leen la tabla
        // única de tasas en vez de llevar la suya.
        rates: {
            usdPerUnit: {
                USD: 1, USDT: 1, USDC: 1,
                EUR: 1.08, GBP: 1.27, MXN: 0.0583,
                MATIC: 0.8, ETH: 2400, BTC: 45000, BNB: 430,
            } as Record<string, number>,
            disclaimer: 'Constantes del servidor, no cotizaciones de mercado.',
        },
    },
}));

/**
 * El oráculo de tasas se simula: estas pruebas comprueban la conversión y el
 * arrastre de la procedencia, no la red. `cotizacionSimulada` permite a cada
 * prueba decidir si el cambio es fresco, viejo o inexistente.
 */
const TASAS_SIMULADAS: Record<string, number> = {
    USD: 1, USDT: 1, USDC: 1, EUR: 1.08, MATIC: 0.8, ETH: 2400, BTC: 45000,
};

let cotizacionSimulada = {
    source: 'market' as string,
    asOf: new Date().toISOString() as string | null,
    ageMs: 1000 as number | null,
    stale: false,
    disclaimer: 'Cotización de mercado (CoinGecko), refrescada cada 30 minutos.',
};

vi.mock('../../rates.js', () => ({
    toUsd: vi.fn(async (cantidad: number, divisa: string) => {
        const rate = TASAS_SIMULADAS[String(divisa || '').toUpperCase()];
        const tiene = Number.isFinite(rate);
        return {
            usd: tiene && Number.isFinite(cantidad) ? cantidad * rate : null,
            rate: tiene ? rate : null,
            ...cotizacionSimulada,
        };
    }),
    getUsdPerUnit: vi.fn(async (divisa: string) => {
        const rate = TASAS_SIMULADAS[String(divisa || '').toUpperCase()];
        return { rate: Number.isFinite(rate) ? rate : null, ...cotizacionSimulada };
    }),
}));

vi.mock('axios', () => ({
    default: { post: vi.fn(), get: vi.fn() },
}));

import axios from 'axios';
import { registerPaymentTools } from '../../tools/payment-tools.js';

const post = axios.post as unknown as ReturnType<typeof vi.fn>;
const get = axios.get as unknown as ReturnType<typeof vi.fn>;

let handlers: Map<string, Function>;

const COTIZACION_FRESCA = {
    source: 'market',
    asOf: new Date().toISOString(),
    ageMs: 1000,
    stale: false,
    disclaimer: 'Cotización de mercado (CoinGecko), refrescada cada 30 minutos.',
};

beforeEach(() => {
    // Cada prueba arranca con un cambio fresco; la que necesite uno caducado
    // lo dice explícitamente.
    cotizacionSimulada = { ...COTIZACION_FRESCA };

    const { server, getHandler, getToolNames } = createMockMcpServer();
    registerPaymentTools(server as any);
    handlers = new Map(getToolNames().map((n) => [n, getHandler(n)!]));
});

const llamar = async <T = any>(tool: string, args: any): Promise<T> =>
    parseToolResult<T>(await (handlers.get(tool) as any)(args));

describe('get_payment_quote', () => {
    it('cotiza con el precio de config, no con una constante propia', async () => {
        // El fichero declaraba su propio BEZ_PRICE_USD con reserva 1,24 mientras
        // `config` usaba 0,50: el mismo servidor daba dos precios distintos para
        // el mismo token según la herramienta que se llamase.
        const r = await llamar('get_payment_quote', { amount: 100, fromCurrency: 'USD', toCurrency: 'BEZ' });

        expect(r.success).toBe(true);
        expect(r.quote.pricePerBEZ).toBe(PRECIO_BEZ);
        expect(r.quote.toAmount).toBe(100 / PRECIO_BEZ);
    });

    it('aplica la tasa de la divisa antes de convertir a BEZ', async () => {
        const r = await llamar('get_payment_quote', { amount: 100, fromCurrency: 'MATIC', toCurrency: 'BEZ' });

        expect(r.quote.amountInUSD).toBe(80);
        expect(r.quote.toAmount).toBe(80 / PRECIO_BEZ);
    });

    it('declara de dónde sale el cambio y de cuándo es', async () => {
        // Sin esto el modelo presenta un BTC de hace meses como si fuera la
        // cotización de ahora mismo.
        const r = await llamar('get_payment_quote', { amount: 1, fromCurrency: 'BTC', toCurrency: 'BEZ' });

        expect(r.quote.rateSource).toBe('market');
        expect(r.quote.rateStale).toBe(false);
        expect(r.quote.rateAsOf).toBeTruthy();
        expect(r.quote.rateAgeSeconds).toBeGreaterThanOrEqual(0);
        expect(r.quote.rateUsdPerUnit).toBe(45000);
    });

    it('arrastra el aviso cuando el cambio está caducado, sin negarse a estimar', async () => {
        // Una cotización sirve para orientar aunque esté vieja; lo que no
        // puede es presentarse como fresca.
        cotizacionSimulada = {
            source: 'stale', asOf: new Date(Date.now() - 7_200_000).toISOString(),
            ageMs: 7_200_000, stale: true,
            disclaimer: 'Cotización de hace 120 minutos; supera la edad máxima aceptada.',
        };

        const r = await llamar('get_payment_quote', { amount: 100, fromCurrency: 'MATIC', toCurrency: 'BEZ' });

        expect(r.success).toBe(true);
        expect(r.quote.rateStale).toBe(true);
        expect(r.quote.rateSource).toBe('stale');
    });

    it('rechaza una divisa que no esté en la tabla en vez de devolver NaN', async () => {
        // JPY no está ni en el enum ni en la tabla de tasas. Antes esta
        // prueba usaba GBP, que sí entró en la tabla al unificarla: la
        // prueba habría seguido en verde comprobando otra cosa.
        const r = await llamar('get_payment_quote', { amount: 10, fromCurrency: 'JPY', toCurrency: 'BEZ' });

        expect(r.success).toBe(false);
        expect(r.error).toMatch(/no soportada/i);
    });

    it('cotiza todas las divisas que su enum admite', async () => {
        // Si alguien añade una divisa al enum sin darle tasa, la herramienta
        // devuelve un error en vez de cotizar. Esto lo detecta.
        for (const divisa of ['USD', 'EUR', 'ETH', 'USDT', 'USDC', 'BTC', 'MATIC']) {
            const r = await llamar('get_payment_quote', { amount: 10, fromCurrency: divisa, toCurrency: 'BEZ' });
            expect({ divisa, success: r.success }).toEqual({ divisa, success: true });
            expect(Number.isFinite(r.quote.toAmount)).toBe(true);
        }
    });
});

describe('initiate_crypto_payment', () => {
    it('cotiza MATIC igual que get_payment_quote', async () => {
        // Aquí estaba el agujero: esta herramienta daba por hecho «1:1 por ser
        // stablecoin», pero su enum acepta MATIC, que no lo es. 100 MATIC
        // salían por 200 BEZ en vez de por 160: un 25 % de más.
        const cripto = await llamar('initiate_crypto_payment', {
            walletAddress: '0x' + 'a'.repeat(40),
            amount: 100,
            currency: 'MATIC',
        });
        const cotizacion = await llamar('get_payment_quote', {
            amount: 100,
            fromCurrency: 'MATIC',
            toCurrency: 'BEZ',
        });

        expect(cripto.tokenAmount).toBe(cotizacion.quote.toAmount);
        expect(cripto.amountInUSD).toBe(80);
    });

    it('se niega a preparar la operación con un cambio caducado', async () => {
        // Preparar un pago con el precio de ayer le da al usuario los BEZ
        // equivocados. Estimar sí, liquidar no.
        cotizacionSimulada = {
            source: 'stale', asOf: new Date(Date.now() - 7_200_000).toISOString(),
            ageMs: 7_200_000, stale: true,
            disclaimer: 'Cotización de hace 120 minutos; supera la edad máxima aceptada.',
        };

        const r = await llamar('initiate_crypto_payment', {
            walletAddress: '0x' + 'c'.repeat(40),
            amount: 100,
            currency: 'MATIC',
        });

        expect(r.success).toBe(false);
        expect(r.error).toMatch(/no hay cotización reciente/i);
    });

    it('mantiene la paridad 1:1 de las stablecoins', async () => {
        const r = await llamar('initiate_crypto_payment', {
            walletAddress: '0x' + 'b'.repeat(40),
            amount: 100,
            currency: 'USDT',
        });

        expect(r.amountInUSD).toBe(100);
        expect(r.tokenAmount).toBe(100 / PRECIO_BEZ);
    });

    it('deja claro que no ha ejecutado ninguna transacción', async () => {
        const r = await llamar('initiate_crypto_payment', {
            walletAddress: '0x' + 'c'.repeat(40),
            amount: 5,
            currency: 'USDC',
        });

        expect(r.success).toBe(true);
        expect(r.executed).toBe(false);
        expect(r.instructions).toBeDefined();
    });
});

describe('process_stripe_payment', () => {
    it('manda el token del usuario en la cabecera Authorization', async () => {
        // El backend protege la ruta con verifyTokenMiddleware. Sin cabecera la
        // llamada se iba en un 401 siempre, en cualquier despliegue.
        post.mockResolvedValueOnce({ data: { success: true, url: 'https://checkout', sessionId: 'cs_1' } });

        const r = await llamar('process_stripe_payment', { userToken: 'jwt-de-prueba', amountFiat: 50 });

        expect(r.success).toBe(true);
        const [, , opciones] = post.mock.calls[0];
        expect(opciones.headers.Authorization).toBe('Bearer jwt-de-prueba');
    });

    it('no acepta una wallet de destino: la pone el backend desde la sesión', async () => {
        // Antes la pedía, no la enviaba y la devolvía en la respuesta, con lo
        // que aparentaba haber dirigido los tokens a una wallet que el backend
        // no llegó a ver nunca.
        const { server, getSchema } = createMockMcpServer();
        registerPaymentTools(server as any);

        expect(Object.keys(getSchema('process_stripe_payment')!)).not.toContain('walletAddress');
    });

    it('pone un plazo a la llamada al backend', async () => {
        post.mockResolvedValueOnce({ data: { success: true, url: 'u', sessionId: 's' } });

        await llamar('process_stripe_payment', { userToken: 't', amountFiat: 50 });

        expect(post.mock.calls[0][2].timeout).toBeGreaterThan(0);
    });

    it('explica un 401 en vez de devolver el mensaje crudo de axios', async () => {
        post.mockRejectedValueOnce({ response: { status: 401 }, message: 'Request failed with status code 401' });

        const r = await llamar('process_stripe_payment', { userToken: 'caducado', amountFiat: 50 });

        expect(r.success).toBe(false);
        expect(r.error).toMatch(/autenticaci/i);
        expect(r.error).toMatch(/caducado|falta|permiso/i);
    });

    it('para la compra por debajo del mínimo sin llamar al backend', async () => {
        const r = await llamar('process_stripe_payment', { userToken: 't', amountFiat: 0.1 });

        expect(r.success).toBe(false);
        expect(r.error).toMatch(/mínimo/i);
        expect(post).not.toHaveBeenCalled();
    });
});

describe('check_payment_status', () => {
    it('manda el token y escapa el sessionId en la URL', async () => {
        get.mockResolvedValueOnce({
            data: { success: true, session: { status: 'complete', amountTotal: 5000, currency: 'usd' } },
        });

        const r = await llamar('check_payment_status', { sessionId: 'cs/../admin', userToken: 'jwt' });

        expect(r.success).toBe(true);
        const [url, opciones] = get.mock.calls[0];
        expect(url).not.toContain('cs/../admin');
        expect(url).toContain(encodeURIComponent('cs/../admin'));
        expect(opciones.headers.Authorization).toBe('Bearer jwt');
    });
});

describe('precio mal configurado', () => {
    it('falla con un motivo en vez de cotizar null', async () => {
        // `parseFloat('abc')` da NaN, JSON.stringify(NaN) da null, y antes eso
        // salía como una cotización correcta con la cantidad vacía al lado.
        vi.resetModules();
        vi.doMock('../../config.js', () => ({
            config: {
                token: { address: '0x' + '0'.repeat(40), priceUSD: NaN, decimals: 18 },
                network: { mode: 'amoy', activeRpc: 'http://localhost:8545', rpc: {} },
                integrations: {},
                rates: {
                    usdPerUnit: { USD: 1, USDT: 1, USDC: 1, MATIC: 0.8 } as Record<string, number>,
                    disclaimer: 'Constantes del servidor, no cotizaciones de mercado.',
                },
            },
        }));

        const { registerPaymentTools: registrar } = await import('../../tools/payment-tools.js');
        const { server, getHandler } = createMockMcpServer();
        registrar(server as any);

        const r = parseToolResult<any>(
            await (getHandler('get_payment_quote') as any)({ amount: 10, fromCurrency: 'USD', toCurrency: 'BEZ' }),
        );

        expect(r.success).toBe(false);
        expect(r.error).toMatch(/BEZ_PRICE_USD/);

        vi.doUnmock('../../config.js');
        vi.resetModules();
    });
});
