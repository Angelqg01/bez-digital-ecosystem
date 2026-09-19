/**
 * @fileoverview Oráculo de tasas de referencia — dólares por unidad, en vivo.
 *
 * El precio de cada cripto y divisa se consulta al mercado y se refresca cada
 * media hora, de modo que una compra o una venta de BEZ se cotiza contra el
 * precio vigente del MATIC, del ETH o del euro en ese momento, no contra una
 * constante escrita en el repositorio.
 *
 * Las constantes de `tokenomics.config.js` siguen existiendo, pero bajan de
 * rango: ya no son «el precio», son el último recurso cuando el mercado no
 * responde y nunca ha respondido en este proceso.
 *
 * ─── Lo que este módulo se toma en serio ──────────────────────────────────
 *
 *  1. UNA COTIZACIÓN VIEJA NUNCA SE PRESENTA COMO NUEVA. Cada respuesta dice
 *     de dónde sale (`source`), de cuándo es (`asOf`) y cuánto ha envejecido
 *     (`ageMs`). Quien cobra dinero con ella puede exigir que sea fresca.
 *
 *  2. UN FALLO DE RED NO BORRA EL ÚLTIMO PRECIO BUENO. Si la consulta falla,
 *     se sirve el último valor conocido marcado como `stale`, con su edad. Se
 *     cae a las constantes solo si nunca hubo un precio de mercado.
 *
 *  3. UNA LECTURA ABSURDA NO SE ACEPTA. Un `0` o un `NaN` del proveedor
 *     acreditaría al usuario una cantidad disparatada de BEZ. Cada tasa se
 *     valida antes de entrar en la caché, y las stablecoins se comprueban
 *     contra una banda alrededor del dólar.
 *
 *  4. UNA RÁFAGA DE PETICIONES NO SON N LLAMADAS. Las peticiones simultáneas
 *     comparten la consulta en vuelo.
 */
const tokenomics = require('../config/tokenomics.config');
const logger = require('../utils/logger');

// ─── Parámetros ─────────────────────────────────────────────────────────────

/** Cada cuánto se refresca: media hora. */
const TTL_MS = Number(process.env.REFERENCE_RATES_TTL_MS) > 0
    ? Number(process.env.REFERENCE_RATES_TTL_MS)
    : 30 * 60 * 1000;

/**
 * Edad máxima que se acepta para cotizar una operación con dinero.
 * Más allá de esto la tasa se marca `stale` y quien cobra debe negarse.
 */
const EDAD_MAXIMA_MS = Number(process.env.REFERENCE_RATES_MAX_AGE_MS) > 0
    ? Number(process.env.REFERENCE_RATES_MAX_AGE_MS)
    : 2 * TTL_MS;

const TIMEOUT_MS = Number(process.env.REFERENCE_RATES_TIMEOUT_MS) > 0
    ? Number(process.env.REFERENCE_RATES_TIMEOUT_MS)
    : 8000;

const API_BASE = process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';

/** Símbolo → identificador de CoinGecko. */
const ID_POR_SIMBOLO = {
    MATIC: 'matic-network',
    ETH: 'ethereum',
    BTC: 'bitcoin',
    BNB: 'binancecoin',
    USDT: 'tether',
    USDC: 'usd-coin',
};

/** Divisas fiat que se derivan de la misma llamada. USD es la unidad de cuenta. */
const FIAT = ['EUR', 'GBP', 'MXN'];

/** Una stablecoin fuera de esta banda es una lectura que no nos creemos. */
const BANDA_STABLECOIN = { min: 0.9, max: 1.1 };
const STABLECOINS = ['USDT', 'USDC'];

// ─── Estado ─────────────────────────────────────────────────────────────────

let cache = null;          // { usdPerUnit, asOf, source }
let consultaEnVuelo = null;

// ─── Validación ─────────────────────────────────────────────────────────────

function tasaValida(simbolo, valor) {
    if (!Number.isFinite(valor) || valor <= 0) return false;
    if (STABLECOINS.includes(simbolo)) {
        return valor >= BANDA_STABLECOIN.min && valor <= BANDA_STABLECOIN.max;
    }
    return true;
}

/**
 * Dólares por unidad de cada divisa fiat.
 *
 * CoinGecko no cotiza «EUR en dólares», pero sí cotiza el mismo activo en
 * ambas monedas: si un ETH vale 2400 USD y 2222 EUR, un euro vale 1,08 USD.
 * Se toma la mediana de todos los activos disponibles para que una lectura
 * rara de uno solo no arrastre el tipo de cambio.
 */
function fiatDesdeCotizaciones(datos) {
    const salida = {};

    for (const divisa of FIAT) {
        const clave = divisa.toLowerCase();
        const candidatos = Object.values(datos)
            .map((cotizacion) => {
                const usd = Number(cotizacion?.usd);
                const otra = Number(cotizacion?.[clave]);
                return Number.isFinite(usd) && Number.isFinite(otra) && otra > 0
                    ? usd / otra
                    : null;
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

// ─── Consulta ───────────────────────────────────────────────────────────────

async function consultarMercado() {
    const ids = Object.values(ID_POR_SIMBOLO).join(',');
    const vs = ['usd', ...FIAT.map((d) => d.toLowerCase())].join(',');
    const url = `${API_BASE}/simple/price?ids=${ids}&vs_currencies=${vs}`;

    const respuesta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!respuesta.ok) {
        throw new Error(`CoinGecko respondió ${respuesta.status}`);
    }

    const datos = await respuesta.json();
    if (!datos || typeof datos !== 'object') {
        throw new Error('CoinGecko devolvió una respuesta que no es un objeto');
    }

    const usdPerUnit = { USD: 1 };
    const descartadas = [];

    for (const [simbolo, id] of Object.entries(ID_POR_SIMBOLO)) {
        const valor = Number(datos[id]?.usd);
        if (tasaValida(simbolo, valor)) {
            usdPerUnit[simbolo] = valor;
        } else {
            descartadas.push(simbolo);
        }
    }

    for (const [divisa, valor] of Object.entries(fiatDesdeCotizaciones(datos))) {
        if (tasaValida(divisa, valor)) {
            usdPerUnit[divisa] = valor;
        } else {
            descartadas.push(divisa);
        }
    }

    // Una respuesta que no trae ni una cripto no es una cotización: es ruido.
    const cripto = Object.keys(ID_POR_SIMBOLO).filter((s) => usdPerUnit[s] !== undefined);
    if (cripto.length === 0) {
        throw new Error('CoinGecko no devolvió ninguna cotización utilizable');
    }

    if (descartadas.length > 0) {
        logger.warn({ descartadas }, 'Tasas descartadas por no superar la validación');
    }

    // Lo que el proveedor no dio se completa con la constante, marcado aparte
    // para que la respuesta no aparente ser toda de mercado.
    const completadas = [];
    for (const [simbolo, constante] of Object.entries(tokenomics.rates.usdPerUnit)) {
        if (usdPerUnit[simbolo] === undefined) {
            usdPerUnit[simbolo] = constante;
            completadas.push(simbolo);
        }
    }

    return { usdPerUnit, completadas };
}

// ─── API ────────────────────────────────────────────────────────────────────

/**
 * Devuelve la tabla de dólares por unidad, refrescándola si ha caducado.
 *
 * @param {{ forzar?: boolean }} [opciones]
 * @returns {Promise<{
 *   usdPerUnit: Record<string, number>,
 *   source: 'market'|'stale'|'fallback',
 *   asOf: string|null,
 *   ageMs: number|null,
 *   stale: boolean,
 *   completadas: string[],
 *   disclaimer: string,
 * }>}
 */
async function getRates({ forzar = false } = {}) {
    const ahora = Date.now();

    if (!forzar && cache && ahora - cache.asOf < TTL_MS) {
        return instantanea(cache, ahora);
    }

    if (!consultaEnVuelo) {
        consultaEnVuelo = consultarMercado()
            .then(({ usdPerUnit, completadas }) => {
                cache = { usdPerUnit, asOf: Date.now(), source: 'market', completadas };
                return cache;
            })
            .catch((error) => {
                logger.warn({ error: error.message }, 'No se pudo refrescar las tasas de referencia');
                return null;
            })
            .finally(() => { consultaEnVuelo = null; });
    }

    const resultado = await consultaEnVuelo;
    if (resultado) return instantanea(resultado, Date.now());

    // La consulta falló. Si alguna vez hubo mercado, se sirve eso, envejecido.
    if (cache) return instantanea(cache, Date.now());

    return {
        usdPerUnit: { ...tokenomics.rates.usdPerUnit },
        source: 'fallback',
        asOf: null,
        ageMs: null,
        stale: true,
        completadas: Object.keys(tokenomics.rates.usdPerUnit),
        disclaimer:
            'Constantes del servidor: el mercado no ha respondido en este proceso. ' +
            'No son cotizaciones actuales.',
    };
}

function instantanea(entrada, ahora) {
    const ageMs = ahora - entrada.asOf;
    const stale = ageMs > EDAD_MAXIMA_MS;

    return {
        usdPerUnit: { ...entrada.usdPerUnit },
        source: stale ? 'stale' : entrada.source,
        asOf: new Date(entrada.asOf).toISOString(),
        ageMs,
        stale,
        completadas: entrada.completadas || [],
        disclaimer: stale
            ? `Cotización de hace ${Math.round(ageMs / 60000)} minutos; supera la edad máxima aceptada.`
            : 'Cotización de mercado (CoinGecko), refrescada cada 30 minutos.',
    };
}

/**
 * Dólares por unidad de un símbolo, con los metadatos de la cotización.
 *
 * @param {string} simbolo
 * @returns {Promise<{ rate: number|null, source: string, asOf: string|null, ageMs: number|null, stale: boolean, disclaimer: string }>}
 */
async function getUsdPerUnit(simbolo) {
    const tasas = await getRates();
    const clave = String(simbolo || '').toUpperCase();
    const rate = tasas.usdPerUnit[clave];

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
 * Convierte una cantidad a dólares al cambio vigente.
 * `usd` es null si no hay tasa para ese símbolo, para que quien llame decida
 * en vez de propagar un NaN hasta el importe que se cobra.
 *
 * @param {number} cantidad
 * @param {string} simbolo
 */
async function toUsd(cantidad, simbolo) {
    const tasa = await getUsdPerUnit(simbolo);
    const usd = Number.isFinite(tasa.rate) && Number.isFinite(cantidad)
        ? cantidad * tasa.rate
        : null;

    return { usd, ...tasa };
}

/**
 * La última tabla conocida, sin tocar la red.
 *
 * Para los sitios que no pueden esperar (un cálculo síncrono). Devuelve las
 * constantes mientras no haya habido ninguna consulta, y siempre dice de qué
 * se trata: quien la use para cobrar debe usar `getRates()`.
 */
function snapshot() {
    if (!cache) {
        return {
            usdPerUnit: { ...tokenomics.rates.usdPerUnit },
            source: 'fallback',
            asOf: null,
            ageMs: null,
            stale: true,
        };
    }
    return instantanea(cache, Date.now());
}

/** Vacía la caché. Para las pruebas y para forzar un refresco tras un cambio. */
function clearCache() {
    cache = null;
    consultaEnVuelo = null;
}

module.exports = {
    getRates,
    getUsdPerUnit,
    toUsd,
    snapshot,
    clearCache,
    TTL_MS,
    EDAD_MAXIMA_MS,
    ID_POR_SIMBOLO,
    FIAT,
};
