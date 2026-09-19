/**
 * Oráculo de tasas de referencia para el servidor MCP.
 *
 * Mismo contrato que `backend/services/reference-rates.service.js`: dólares
 * por unidad, consultados al mercado y refrescados cada media hora, de modo
 * que una cotización de BEZ se calcula contra el precio vigente del MATIC o
 * del ETH y no contra una constante del repositorio.
 *
 * Lo que este módulo se toma en serio, igual que su gemelo del backend:
 *
 *  1. Una cotización vieja nunca se presenta como nueva: cada respuesta dice
 *     de dónde sale, de cuándo es y cuánto ha envejecido.
 *  2. Un fallo de red no borra el último precio bueno.
 *  3. Una lectura absurda del proveedor no llega a convertirse en dinero.
 *  4. Una ráfaga de peticiones comparte la consulta en vuelo.
 */
import { config } from './config.js';

export type OrigenTasa = 'market' | 'stale' | 'fallback';

export interface Cotizacion {
    usdPerUnit: Record<string, number>;
    source: OrigenTasa;
    asOf: string | null;
    ageMs: number | null;
    stale: boolean;
    /** Símbolos que el mercado no dio y se completaron con la constante. */
    completadas: string[];
    disclaimer: string;
}

export interface TasaUnitaria {
    rate: number | null;
    source: OrigenTasa;
    asOf: string | null;
    ageMs: number | null;
    stale: boolean;
    disclaimer: string;
}

function envNumero(nombre: string, porDefecto: number): number {
    const n = Number(process.env[nombre]);
    return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

/** Cada cuánto se refresca: media hora. */
export const TTL_MS = envNumero('REFERENCE_RATES_TTL_MS', 30 * 60 * 1000);

/** Edad máxima aceptable para cotizar una operación con dinero. */
export const EDAD_MAXIMA_MS = envNumero('REFERENCE_RATES_MAX_AGE_MS', 2 * TTL_MS);

const TIMEOUT_MS = envNumero('REFERENCE_RATES_TIMEOUT_MS', 8000);
const API_BASE = process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';

export const ID_POR_SIMBOLO: Record<string, string> = {
    MATIC: 'matic-network',
    ETH: 'ethereum',
    BTC: 'bitcoin',
    BNB: 'binancecoin',
    USDT: 'tether',
    USDC: 'usd-coin',
};

export const FIAT = ['EUR', 'GBP', 'MXN'] as const;

const STABLECOINS = ['USDT', 'USDC'];
const BANDA_STABLECOIN = { min: 0.9, max: 1.1 };

interface Entrada {
    usdPerUnit: Record<string, number>;
    asOf: number;
    source: OrigenTasa;
    completadas: string[];
}

let cache: Entrada | null = null;
let consultaEnVuelo: Promise<Entrada | null> | null = null;

function tasaValida(simbolo: string, valor: number): boolean {
    if (!Number.isFinite(valor) || valor <= 0) return false;
    if (STABLECOINS.includes(simbolo)) {
        return valor >= BANDA_STABLECOIN.min && valor <= BANDA_STABLECOIN.max;
    }
    return true;
}

/**
 * Dólares por unidad de cada divisa fiat.
 *
 * El proveedor no cotiza «el euro en dólares», pero sí el mismo activo en
 * ambas monedas: si un ETH vale 2400 USD y 2222 EUR, el euro vale 1,08 USD.
 * Se toma la mediana de todos los activos para que una lectura rara de uno
 * solo no arrastre el tipo de cambio.
 */
function fiatDesdeCotizaciones(datos: Record<string, Record<string, number>>): Record<string, number> {
    const salida: Record<string, number> = {};

    for (const divisa of FIAT) {
        const clave = divisa.toLowerCase();
        const candidatos = Object.values(datos)
            .map((cotizacion) => {
                const usd = Number(cotizacion?.usd);
                const otra = Number(cotizacion?.[clave]);
                return Number.isFinite(usd) && Number.isFinite(otra) && otra > 0 ? usd / otra : NaN;
            })
            .filter((v) => Number.isFinite(v) && v > 0)
            .sort((a, b) => a - b);

        if (candidatos.length === 0) continue;

        const medio = Math.floor(candidatos.length / 2);
        salida[divisa] = candidatos.length % 2
            ? candidatos[medio]
            : (candidatos[medio - 1] + candidatos[medio]) / 2;
    }

    return salida;
}

async function consultarMercado(): Promise<Entrada> {
    const ids = Object.values(ID_POR_SIMBOLO).join(',');
    const vs = ['usd', ...FIAT.map((d) => d.toLowerCase())].join(',');

    const respuesta = await fetch(`${API_BASE}/simple/price?ids=${ids}&vs_currencies=${vs}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!respuesta.ok) throw new Error(`CoinGecko respondió ${respuesta.status}`);

    const datos = await respuesta.json() as Record<string, Record<string, number>>;
    if (!datos || typeof datos !== 'object') {
        throw new Error('CoinGecko devolvió una respuesta que no es un objeto');
    }

    const usdPerUnit: Record<string, number> = { USD: 1 };

    for (const [simbolo, id] of Object.entries(ID_POR_SIMBOLO)) {
        const valor = Number(datos[id]?.usd);
        if (tasaValida(simbolo, valor)) usdPerUnit[simbolo] = valor;
    }

    for (const [divisa, valor] of Object.entries(fiatDesdeCotizaciones(datos))) {
        if (tasaValida(divisa, valor)) usdPerUnit[divisa] = valor;
    }

    const cripto = Object.keys(ID_POR_SIMBOLO).filter((s) => usdPerUnit[s] !== undefined);
    if (cripto.length === 0) {
        throw new Error('CoinGecko no devolvió ninguna cotización utilizable');
    }

    const completadas: string[] = [];
    for (const [simbolo, constante] of Object.entries(config.rates.usdPerUnit)) {
        if (usdPerUnit[simbolo] === undefined) {
            usdPerUnit[simbolo] = constante;
            completadas.push(simbolo);
        }
    }

    return { usdPerUnit, asOf: Date.now(), source: 'market', completadas };
}

function instantanea(entrada: Entrada, ahora: number): Cotizacion {
    const ageMs = ahora - entrada.asOf;
    const stale = ageMs > EDAD_MAXIMA_MS;

    return {
        usdPerUnit: { ...entrada.usdPerUnit },
        source: stale ? 'stale' : entrada.source,
        asOf: new Date(entrada.asOf).toISOString(),
        ageMs,
        stale,
        completadas: entrada.completadas,
        disclaimer: stale
            ? `Cotización de hace ${Math.round(ageMs / 60000)} minutos; supera la edad máxima aceptada.`
            : 'Cotización de mercado (CoinGecko), refrescada cada 30 minutos.',
    };
}

/** La tabla de dólares por unidad, refrescada si ha caducado. */
export async function getRates({ forzar = false } = {}): Promise<Cotizacion> {
    const ahora = Date.now();

    if (!forzar && cache && ahora - cache.asOf < TTL_MS) {
        return instantanea(cache, ahora);
    }

    if (!consultaEnVuelo) {
        consultaEnVuelo = consultarMercado()
            .then((entrada) => { cache = entrada; return entrada; })
            .catch(() => null)
            .finally(() => { consultaEnVuelo = null; });
    }

    const resultado = await consultaEnVuelo;
    if (resultado) return instantanea(resultado, Date.now());
    if (cache) return instantanea(cache, Date.now());

    return {
        usdPerUnit: { ...config.rates.usdPerUnit },
        source: 'fallback',
        asOf: null,
        ageMs: null,
        stale: true,
        completadas: Object.keys(config.rates.usdPerUnit),
        disclaimer:
            'Constantes del servidor: el mercado no ha respondido en este proceso. ' +
            'No son cotizaciones actuales.',
    };
}

/** Dólares por unidad de un símbolo, con la procedencia de la cotización. */
export async function getUsdPerUnit(simbolo: string): Promise<TasaUnitaria> {
    const tasas = await getRates();
    const rate = tasas.usdPerUnit[String(simbolo || '').toUpperCase()];

    return {
        rate: Number.isFinite(rate) ? rate : null,
        source: tasas.source,
        asOf: tasas.asOf,
        ageMs: tasas.ageMs,
        stale: tasas.stale,
        disclaimer: tasas.disclaimer,
    };
}

/**
 * Convierte a dólares al cambio vigente. `usd` es null si no hay tasa para
 * ese símbolo, para que quien llame decida en vez de propagar un NaN hasta
 * el importe que se cobra.
 */
export async function toUsd(cantidad: number, simbolo: string): Promise<TasaUnitaria & { usd: number | null }> {
    const tasa = await getUsdPerUnit(simbolo);
    const usd = Number.isFinite(tasa.rate as number) && Number.isFinite(cantidad)
        ? cantidad * (tasa.rate as number)
        : null;

    return { usd, ...tasa };
}

/**
 * La última tabla conocida, sin tocar la red. Para cálculos que no pueden
 * esperar; quien cobre dinero debe usar `getRates()`.
 */
export function snapshot(): Cotizacion {
    if (!cache) {
        return {
            usdPerUnit: { ...config.rates.usdPerUnit },
            source: 'fallback',
            asOf: null,
            ageMs: null,
            stale: true,
            completadas: Object.keys(config.rates.usdPerUnit),
            disclaimer: 'Constantes del servidor: todavía no se ha consultado el mercado.',
        };
    }
    return instantanea(cache, Date.now());
}

/** Unidades de cada divisa fiat por dólar, al cambio vigente. */
export async function unidadesPorUsdVivo(): Promise<Record<string, number>> {
    const { usdPerUnit } = await getRates();
    const salida: Record<string, number> = {};

    for (const divisa of ['USD', ...FIAT]) {
        const usd = usdPerUnit[divisa];
        if (Number.isFinite(usd) && usd > 0) {
            salida[divisa] = Number((1 / usd).toPrecision(8));
        }
    }
    return salida;
}

/** Vacía la caché. Para las pruebas y para forzar un refresco. */
export function clearCache(): void {
    cache = null;
    consultaEnVuelo = null;
}
