/**
 * Oráculo de tasas del servidor MCP.
 *
 * Lo que se comprueba es lo que separa un precio en vivo de una constante
 * disfrazada: que se refresca, que envejece de forma visible, que un fallo
 * de red no borra el último precio bueno y que una lectura absurda del
 * proveedor no llega a convertirse en dinero.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { config } from '../config.js';
import {
    getRates, getUsdPerUnit, toUsd, snapshot, clearCache,
    unidadesPorUsdVivo, TTL_MS, EDAD_MAXIMA_MS,
} from '../rates.js';

const RESPUESTA_OK: Record<string, Record<string, number>> = {
    'matic-network': { usd: 0.2431, eur: 0.2251, gbp: 0.1914, mxn: 4.17 },
    ethereum: { usd: 3120.55, eur: 2889.4, gbp: 2457.1, mxn: 53_520 },
    bitcoin: { usd: 97_340, eur: 90_129, gbp: 76_645, mxn: 1_669_600 },
    binancecoin: { usd: 612.8, eur: 567.4, gbp: 482.5, mxn: 10_511 },
    tether: { usd: 1.0, eur: 0.926, gbp: 0.7875, mxn: 17.15 },
    'usd-coin': { usd: 0.9998, eur: 0.9258, gbp: 0.7873, mxn: 17.147 },
};

function respuesta(cuerpo: unknown, ok = true, status = 200) {
    return { ok, status, json: async () => cuerpo } as unknown as Response;
}

beforeEach(() => {
    clearCache();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('cotización de mercado', () => {
    it('devuelve el precio en vivo, no la constante del repositorio', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(RESPUESTA_OK)));

        const r = await getRates();

        expect(r.source).toBe('market');
        expect(r.stale).toBe(false);
        expect(r.usdPerUnit.MATIC).toBeCloseTo(0.2431, 6);
        expect(r.usdPerUnit.MATIC).not.toBeCloseTo(config.rates.usdPerUnit.MATIC, 6);
    });

    it('deriva el tipo fiat del mismo activo cotizado en dos monedas', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(RESPUESTA_OK)));

        const r = await getRates();

        expect(r.usdPerUnit.EUR).toBeCloseTo(3120.55 / 2889.4, 3);
        expect(r.usdPerUnit.GBP).toBeCloseTo(3120.55 / 2457.1, 3);
    });

    it('una lectura rara de un solo activo no arrastra el tipo fiat', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({
            ...RESPUESTA_OK,
            bitcoin: { usd: 97_340, eur: 1, gbp: 76_645, mxn: 1_669_600 },
        })));

        expect((await getRates()).usdPerUnit.EUR).toBeCloseTo(1.08, 1);
    });

    it('dice de cuándo es la cotización', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(RESPUESTA_OK)));

        const r = await getRates();

        expect(Date.parse(r.asOf as string)).toBeLessThanOrEqual(Date.now());
        expect(r.disclaimer).toMatch(/mercado/i);
    });
});

describe('refresco cada media hora', () => {
    it('reutiliza la cotización mientras no caduca', async () => {
        const f = vi.fn().mockResolvedValue(respuesta(RESPUESTA_OK));
        vi.stubGlobal('fetch', f);

        await getRates();
        await getRates();
        await getRates();

        expect(f).toHaveBeenCalledTimes(1);
    });

    it('vuelve a consultar cuando pasa la media hora', async () => {
        const f = vi.fn().mockResolvedValue(respuesta(RESPUESTA_OK));
        vi.stubGlobal('fetch', f);
        const ahora = Date.now();
        const reloj = vi.spyOn(Date, 'now');

        reloj.mockReturnValue(ahora);
        await getRates();
        reloj.mockReturnValue(ahora + TTL_MS + 1);
        await getRates();

        expect(f).toHaveBeenCalledTimes(2);
    });

    it('una ráfaga simultánea es una sola llamada', async () => {
        let resolver: (r: Response) => void = () => {};
        const f = vi.fn().mockReturnValue(new Promise<Response>((r) => { resolver = r; }));
        vi.stubGlobal('fetch', f);

        const peticiones = Promise.all([getRates(), getRates(), getRates(), getRates()]);
        resolver(respuesta(RESPUESTA_OK));
        const resultados = await peticiones;

        expect(f).toHaveBeenCalledTimes(1);
        for (const r of resultados) expect(r.usdPerUnit.MATIC).toBeCloseTo(0.2431, 6);
    });
});

describe('cuando el mercado no responde', () => {
    it('conserva el último precio bueno en vez de volver a la constante', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(RESPUESTA_OK)));
        const ahora = Date.now();
        const reloj = vi.spyOn(Date, 'now').mockReturnValue(ahora);

        await getRates();

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
        reloj.mockReturnValue(ahora + TTL_MS + 1);
        const r = await getRates();

        expect(r.usdPerUnit.MATIC).toBeCloseTo(0.2431, 6);
        expect(r.ageMs).toBeGreaterThan(TTL_MS);
    });

    it('marca stale al pasar de la edad máxima, y lo dice', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(RESPUESTA_OK)));
        const ahora = Date.now();
        const reloj = vi.spyOn(Date, 'now').mockReturnValue(ahora);

        await getRates();

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
        reloj.mockReturnValue(ahora + EDAD_MAXIMA_MS + 1);
        const r = await getRates();

        expect(r.stale).toBe(true);
        expect(r.source).toBe('stale');
        expect(r.disclaimer).toMatch(/edad máxima/i);
    });

    it('cae a las constantes solo si nunca hubo mercado, y lo declara', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));

        const r = await getRates();

        expect(r.source).toBe('fallback');
        expect(r.stale).toBe(true);
        expect(r.asOf).toBeNull();
        expect(r.usdPerUnit.MATIC).toBe(config.rates.usdPerUnit.MATIC);
        expect(r.disclaimer).toMatch(/no son cotizaciones actuales/i);
    });

    it('un 429 no se trata como una cotización', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({}, false, 429)));

        expect((await getRates()).source).toBe('fallback');
    });
});

describe('lecturas que no nos creemos', () => {
    it('descarta un cero y completa con la constante', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({
            ...RESPUESTA_OK,
            'matic-network': { usd: 0, eur: 0, gbp: 0, mxn: 0 },
        })));

        const r = await getRates();

        expect(r.usdPerUnit.MATIC).toBe(config.rates.usdPerUnit.MATIC);
        expect(r.completadas).toContain('MATIC');
    });

    it('descarta una stablecoin fuera de la banda del dólar', async () => {
        // Un USDT a 0,0001 $ acreditaría diez mil veces más BEZ de la cuenta.
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({
            ...RESPUESTA_OK,
            tether: { usd: 0.0001, eur: 0.0001, gbp: 0.0001, mxn: 0.0017 },
        })));

        const r = await getRates();

        expect(r.usdPerUnit.USDT).toBe(config.rates.usdPerUnit.USDT);
        expect(r.completadas).toContain('USDT');
    });

    it('una respuesta sin ninguna cripto utilizable no es una cotización', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ ruido: { usd: 1 } })));

        expect((await getRates()).source).toBe('fallback');
    });
});

describe('conversión', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(RESPUESTA_OK)));
    });

    it('convierte al cambio vigente y arrastra la procedencia', async () => {
        const r = await toUsd(100, 'MATIC');

        expect(r.usd).toBeCloseTo(100 * 0.2431, 6);
        expect(r.source).toBe('market');
        expect(r.stale).toBe(false);
    });

    it('acepta el símbolo en minúsculas', async () => {
        expect((await getUsdPerUnit('eth')).rate).toBeCloseTo(3120.55, 4);
    });

    it('devuelve null en vez de NaN ante un símbolo desconocido', async () => {
        const r = await toUsd(100, 'DOGE');

        expect(r.usd).toBeNull();
        expect(r.rate).toBeNull();
    });

    it('unidadesPorUsdVivo invierte la tabla y solo cubre fiat', async () => {
        const inverso = await unidadesPorUsdVivo();

        expect(Object.keys(inverso).sort()).toEqual(['EUR', 'GBP', 'MXN', 'USD']);
        expect(inverso.USD).toBe(1);
        expect(inverso.EUR * (3120.55 / 2889.4)).toBeCloseTo(1, 4);
        expect(inverso.ETH).toBeUndefined();
    });
});

describe('snapshot síncrono', () => {
    it('sin consulta previa devuelve las constantes y lo declara', () => {
        const s = snapshot();

        expect(s.source).toBe('fallback');
        expect(s.stale).toBe(true);
        expect(s.usdPerUnit.MATIC).toBe(config.rates.usdPerUnit.MATIC);
    });

    it('tras una consulta devuelve el mercado sin tocar la red', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(RESPUESTA_OK)));
        await getRates();

        const f = vi.fn();
        vi.stubGlobal('fetch', f);
        const s = snapshot();

        expect(s.usdPerUnit.MATIC).toBeCloseTo(0.2431, 6);
        expect(s.source).toBe('market');
        expect(f).not.toHaveBeenCalled();
    });
});
