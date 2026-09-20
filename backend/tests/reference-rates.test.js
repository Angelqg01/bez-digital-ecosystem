/**
 * Oráculo de tasas de referencia.
 *
 * Lo que se comprueba aquí es justo lo que distingue un precio en vivo de una
 * constante disfrazada: que se refresca, que envejece de forma visible, que un
 * fallo de red no borra el último precio bueno y que una lectura absurda del
 * proveedor no llega a convertirse en dinero.
 */
const tokenomics = require('../config/tokenomics.config');

// El servicio usa `fetch` global; cada prueba instala el suyo.
let oraculo;

const RESPUESTA_OK = {
    'matic-network': { usd: 0.2431, eur: 0.2251, gbp: 0.1914, mxn: 4.17 },
    ethereum: { usd: 3120.55, eur: 2889.4, gbp: 2457.1, mxn: 53_520 },
    bitcoin: { usd: 97_340, eur: 90_129, gbp: 76_645, mxn: 1_669_600 },
    binancecoin: { usd: 612.8, eur: 567.4, gbp: 482.5, mxn: 10_511 },
    tether: { usd: 1.0, eur: 0.926, gbp: 0.7875, mxn: 17.15 },
    'usd-coin': { usd: 0.9998, eur: 0.9258, gbp: 0.7873, mxn: 17.147 },
};

function respuesta(cuerpo, ok = true, status = 200) {
    return { ok, status, json: async () => cuerpo };
}

beforeEach(() => {
    jest.resetModules();
    oraculo = require('../services/reference-rates.service');
    oraculo.clearCache();
});

afterEach(() => {
    delete global.fetch;
    jest.useRealTimers();
});

describe('cotización de mercado', () => {
    it('devuelve el precio en vivo de cada cripto, no la constante', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta(RESPUESTA_OK));

        const r = await oraculo.getRates();

        expect(r.source).toBe('market');
        expect(r.stale).toBe(false);
        expect(r.usdPerUnit.MATIC).toBeCloseTo(0.2431, 6);
        expect(r.usdPerUnit.ETH).toBeCloseTo(3120.55, 4);
        // La constante del repositorio decía otra cosa: si saliera esa, el
        // precio no sería de mercado.
        expect(r.usdPerUnit.MATIC).not.toBeCloseTo(tokenomics.rates.usdPerUnit.MATIC, 6);
    });

    it('deriva el tipo fiat del mismo activo cotizado en dos monedas', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta(RESPUESTA_OK));

        const r = await oraculo.getRates();

        // 3120,55 USD / 2889,40 EUR = 1,08 USD por euro.
        expect(r.usdPerUnit.EUR).toBeCloseTo(3120.55 / 2889.4, 3);
        expect(r.usdPerUnit.GBP).toBeCloseTo(3120.55 / 2457.1, 3);
        expect(r.usdPerUnit.MXN).toBeCloseTo(3120.55 / 53_520, 4);
    });

    it('una lectura rara de un solo activo no arrastra el tipo fiat', async () => {
        // El BTC viene con un EUR disparatado; la mediana de los demás manda.
        global.fetch = jest.fn().mockResolvedValue(respuesta({
            ...RESPUESTA_OK,
            bitcoin: { usd: 97_340, eur: 1, gbp: 76_645, mxn: 1_669_600 },
        }));

        const r = await oraculo.getRates();

        expect(r.usdPerUnit.EUR).toBeCloseTo(1.08, 1);
    });

    it('dice cuándo se tomó la cotización', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta(RESPUESTA_OK));

        const r = await oraculo.getRates();

        expect(Date.parse(r.asOf)).toBeLessThanOrEqual(Date.now());
        expect(r.ageMs).toBeGreaterThanOrEqual(0);
        expect(r.disclaimer).toMatch(/mercado/i);
    });

    it('el USD es la unidad de cuenta y vale exactamente uno', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta(RESPUESTA_OK));
        expect((await oraculo.getRates()).usdPerUnit.USD).toBe(1);
    });
});

describe('refresco cada media hora', () => {
    it('reutiliza la cotización mientras no caduca', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta(RESPUESTA_OK));

        await oraculo.getRates();
        await oraculo.getRates();
        await oraculo.getRates();

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('vuelve a consultar cuando pasa la media hora', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta(RESPUESTA_OK));
        const ahora = Date.now();
        const reloj = jest.spyOn(Date, 'now');

        reloj.mockReturnValue(ahora);
        await oraculo.getRates();

        reloj.mockReturnValue(ahora + oraculo.TTL_MS + 1);
        await oraculo.getRates();

        expect(global.fetch).toHaveBeenCalledTimes(2);
        reloj.mockRestore();
    });

    it('una ráfaga simultánea es una sola llamada, no una por petición', async () => {
        let resolver;
        global.fetch = jest.fn().mockReturnValue(new Promise((r) => { resolver = r; }));

        const peticiones = Promise.all([
            oraculo.getRates(), oraculo.getRates(), oraculo.getRates(),
            oraculo.getRates(), oraculo.getRates(),
        ]);
        resolver(respuesta(RESPUESTA_OK));
        const resultados = await peticiones;

        expect(global.fetch).toHaveBeenCalledTimes(1);
        for (const r of resultados) expect(r.usdPerUnit.MATIC).toBeCloseTo(0.2431, 6);
    });
});

describe('cuando el mercado no responde', () => {
    it('conserva el último precio bueno en vez de volver a la constante', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta(RESPUESTA_OK));
        const ahora = Date.now();
        const reloj = jest.spyOn(Date, 'now').mockReturnValue(ahora);

        await oraculo.getRates();

        global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
        reloj.mockReturnValue(ahora + oraculo.TTL_MS + 1);
        const r = await oraculo.getRates();

        expect(r.usdPerUnit.MATIC).toBeCloseTo(0.2431, 6);
        expect(r.ageMs).toBeGreaterThan(oraculo.TTL_MS);
        reloj.mockRestore();
    });

    it('marca stale en cuanto se pasa de la edad máxima, y lo dice', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta(RESPUESTA_OK));
        const ahora = Date.now();
        const reloj = jest.spyOn(Date, 'now').mockReturnValue(ahora);

        await oraculo.getRates();

        global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
        reloj.mockReturnValue(ahora + oraculo.EDAD_MAXIMA_MS + 1);
        const r = await oraculo.getRates();

        expect(r.stale).toBe(true);
        expect(r.source).toBe('stale');
        expect(r.disclaimer).toMatch(/edad máxima/i);
        reloj.mockRestore();
    });

    it('cae a las constantes solo si nunca hubo mercado, y lo declara', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('sin red'));

        const r = await oraculo.getRates();

        expect(r.source).toBe('fallback');
        expect(r.stale).toBe(true);
        expect(r.asOf).toBeNull();
        expect(r.usdPerUnit.MATIC).toBe(tokenomics.rates.usdPerUnit.MATIC);
        expect(r.disclaimer).toMatch(/no son cotizaciones actuales/i);
    });

    it('un 429 de CoinGecko no se trata como una cotización', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta({}, false, 429));

        const r = await oraculo.getRates();

        expect(r.source).toBe('fallback');
    });
});

describe('lecturas que no nos creemos', () => {
    it('descarta un cero y completa con la constante', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta({
            ...RESPUESTA_OK,
            'matic-network': { usd: 0, eur: 0, gbp: 0, mxn: 0 },
        }));

        const r = await oraculo.getRates();

        expect(r.usdPerUnit.MATIC).toBe(tokenomics.rates.usdPerUnit.MATIC);
        expect(r.completadas).toContain('MATIC');
    });

    it('descarta una stablecoin fuera de la banda del dólar', async () => {
        // Un USDT a 0,0001 $ acreditaría diez mil veces más BEZ de la cuenta.
        global.fetch = jest.fn().mockResolvedValue(respuesta({
            ...RESPUESTA_OK,
            tether: { usd: 0.0001, eur: 0.0001, gbp: 0.0001, mxn: 0.0017 },
        }));

        const r = await oraculo.getRates();

        expect(r.usdPerUnit.USDT).toBe(tokenomics.rates.usdPerUnit.USDT);
        expect(r.completadas).toContain('USDT');
    });

    it('acepta una stablecoin dentro de la banda', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta(RESPUESTA_OK));
        expect((await oraculo.getRates()).usdPerUnit.USDC).toBeCloseTo(0.9998, 6);
    });

    it('una respuesta sin ninguna cripto utilizable no es una cotización', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta({ ruido: { usd: 1 } }));

        expect((await oraculo.getRates()).source).toBe('fallback');
    });

    it('una respuesta que no es un objeto no revienta el proceso', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta(null));

        expect((await oraculo.getRates()).source).toBe('fallback');
    });
});

describe('conversión', () => {
    beforeEach(() => {
        global.fetch = jest.fn().mockResolvedValue(respuesta(RESPUESTA_OK));
    });

    it('convierte al cambio vigente y arrastra la procedencia', async () => {
        const r = await oraculo.toUsd(100, 'MATIC');

        expect(r.usd).toBeCloseTo(100 * 0.2431, 6);
        expect(r.source).toBe('market');
        expect(r.stale).toBe(false);
    });

    it('acepta el símbolo en minúsculas', async () => {
        expect((await oraculo.toUsd(1, 'eth')).usd).toBeCloseTo(3120.55, 4);
    });

    it('devuelve null en vez de NaN ante un símbolo desconocido', async () => {
        const r = await oraculo.toUsd(100, 'DOGE');

        expect(r.usd).toBeNull();
        expect(r.rate).toBeNull();
    });

    it('devuelve null si la cantidad no es un número', async () => {
        expect((await oraculo.toUsd(NaN, 'MATIC')).usd).toBeNull();
    });
});

describe('snapshot síncrono', () => {
    it('sin consulta previa devuelve las constantes y lo declara', () => {
        const s = oraculo.snapshot();

        expect(s.source).toBe('fallback');
        expect(s.stale).toBe(true);
        expect(s.usdPerUnit.MATIC).toBe(tokenomics.rates.usdPerUnit.MATIC);
    });

    it('tras una consulta devuelve el precio de mercado sin tocar la red', async () => {
        global.fetch = jest.fn().mockResolvedValue(respuesta(RESPUESTA_OK));
        await oraculo.getRates();
        global.fetch = jest.fn();

        const s = oraculo.snapshot();

        expect(s.usdPerUnit.MATIC).toBeCloseTo(0.2431, 6);
        expect(s.source).toBe('market');
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
