'use strict';

/**
 * energyFeedService — real wholesale market feeds for the VPP Energy Agent.
 *
 *   • OMIE  (Mercado Diario)  → day-ahead marginal price (marginalpdbc file)
 *   • ESIOS (Red Eléctrica)   → grid indicators (spot price, demand, mix)
 *
 * Design:
 *   - Pure parser `parseMarginalPdbc()` is unit-testable offline.
 *   - All network calls degrade gracefully: on failure they return the last
 *     known-good value, or null so callers fall back to the simulated builders.
 *   - Day-ahead prices for the *whole day* are published in advance, so the
 *     1h/6h "predictions" are the actual day-ahead prices for later hours
 *     (real forward signal, not a guess).
 */

const axios = require('axios');
const logger = require('../utils/logger');

let cache = null;
try { cache = require('../cache/redis'); } catch { /* cache optional */ }

const OMIE_TTL = 300;          // 5 min
const REQUEST_TIMEOUT = 8000;

// Arbitrage thresholds (€/MWh) — kept in sync with routes/energy.js.
const TH = { CHARGE_BELOW: 30, DISCHARGE_ABOVE: 80, NEGATIVE: -5 };

let _lastOmie = null;          // in-process last-known-good

// ─────────────────────────────────────────────────────────────
// OMIE marginalpdbc parser  (pure, deterministic)
// ─────────────────────────────────────────────────────────────

/**
 * Parse an OMIE `marginalpdbc` file body into hourly price rows.
 * Format: `year;month;day;hour;pricePT;priceES;` (one row per hour 1..24),
 * with a `MARGINALPDBC;` header and a trailing `*`.
 *
 * @param {string} text
 * @returns {Array<{ hour:number, price_pt:number, price_es:number, date:{year,month,day} }>}
 */
function parseMarginalPdbc(text) {
  const out = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('MARGINALPDBC') || line === '*') continue;

    const cols = line.split(';').map((s) => s.trim()).filter((s) => s !== '');
    if (cols.length < 5) continue;

    const year = Number(cols[0]);
    const month = Number(cols[1]);
    const day = Number(cols[2]);
    const hour = Number(cols[3]);
    if (![year, month, day, hour].every(Number.isFinite)) continue;

    const prices = cols.slice(4).map(Number).filter(Number.isFinite);
    if (prices.length === 0) continue;

    const price_pt = prices[0];
    const price_es = prices.length >= 2 ? prices[1] : prices[0];
    out.push({ hour, price_pt, price_es, date: { year, month, day } });
  }
  return out;
}

/**
 * Fecha y hora en España peninsular. OMIE publica sus períodos en hora local de Madrid; el contenedor corre en UTC, así que
 * usar getHours() elegía el precio de 1-2 h antes y, entre las 22:00 y las 24:00 UTC, el fichero del día equivocado.
 */
function madridParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(date).reduce((a, p) => ({ ...a, [p.type]: p.value }), {});
  return { year: Number(parts.year), month: parts.month, day: parts.day, hour: Number(parts.hour), minute: Number(parts.minute) };
}

function omieFileUrl(date = new Date()) {
  const { year: y, month: m, day: d } = madridParts(date);
  return `https://www.omie.es/es/file-download?parents%5B0%5D=marginalpdbc&filename=marginalpdbc_${y}${m}${d}.1`;
}

function recommendation(price) {
  if (price < TH.NEGATIVE) return { ai_recommendation: 'CHARGE_BATTERY', signal_strength: 'CRITICAL_CHARGE' };
  if (price < TH.CHARGE_BELOW) return { ai_recommendation: 'CHARGE_BATTERY', signal_strength: 'NORMAL' };
  if (price > TH.DISCHARGE_ABOVE) return { ai_recommendation: 'DISCHARGE_SELL', signal_strength: 'NORMAL' };
  return { ai_recommendation: 'HOLD', signal_strength: 'NORMAL' };
}

/**
 * Build the /market/omie response shape from parsed hourly rows.
 * @param {Array} rows  output of parseMarginalPdbc
 * @param {Date} [now]
 */
function buildOmieResponse(rows, now = new Date()) {
  if (!rows || rows.length === 0) return null;

  // OMIE may publish 24 hourly or 96 quarter-hourly periods per day.
  const periodsPerHour = Math.max(1, Math.round(rows.length / 24)); // 1 or 4
  const t = madridParts(now);
  const period = t.hour * periodsPerHour + Math.floor(t.minute / (60 / periodsPerHour)) + 1;

  const byPeriod = new Map(rows.map((r) => [r.hour, r.price_es]));
  const at = (p) => (byPeriod.has(p) ? byPeriod.get(p) : null);

  const current = at(period) ?? rows[rows.length - 1].price_es;
  const p1 = at(period + periodsPerHour);     // +1 hour
  const p6 = at(period + 6 * periodsPerHour);  // +6 hours
  const rec = recommendation(current);

  return {
    timestamp: now.toISOString(),
    price_eur_mwh: parseFloat(current.toFixed(2)),
    unit: 'EUR/MWh',
    market: 'OMIE Mercado Diario',
    source: 'OMIE marginalpdbc',
    predictions: {
      in_1h: { price: p1 != null ? parseFloat(p1.toFixed(2)) : null, confidence: 1, model: 'day-ahead' },
      in_6h: { price: p6 != null ? parseFloat(p6.toFixed(2)) : null, confidence: 1, model: 'day-ahead' },
    },
    curve: rows.map((r) => ({ hour: r.hour, price_es: r.price_es })),
    ...rec,
  };
}

/**
 * Fetch + parse today's OMIE day-ahead price. Returns the /market/omie shape,
 * or the last known-good value, or null (caller falls back to simulated data).
 */
async function getOmiePrice() {
  if (cache) {
    try {
      const cached = await cache.cacheGet('bezhas:energy:omie:feed');
      if (cached) return cached;
    } catch { /* degraded */ }
  }

  try {
    const url = omieFileUrl();
    const { data } = await axios.get(url, { timeout: REQUEST_TIMEOUT, responseType: 'text' });
    const rows = parseMarginalPdbc(data);
    const response = buildOmieResponse(rows);
    if (response) {
      _lastOmie = response;
      if (cache) { try { await cache.cacheSet('bezhas:energy:omie:feed', response, OMIE_TTL); } catch { /* ignore */ } }
      return response;
    }
  } catch (err) {
    logger.warn('[ENERGY][OMIE] live fetch failed: %s', err.message);
  }

  return _lastOmie; // null until first success → route falls back to simulator
}

/** Startup pre-cache helper (called from index.js). Returns price or null. */
async function prefetchOmiePrice() {
  const omie = await getOmiePrice();
  return omie ? omie.price_eur_mwh : null;
}

// ─────────────────────────────────────────────────────────────
// ESIOS (Red Eléctrica) — requires ESIOS_API_KEY; falls back otherwise
// ─────────────────────────────────────────────────────────────

/**
 * Fetch ESIOS indicator 600 (spot price). Returns null when no API key is set
 * or the request fails (caller falls back to the simulated indicators).
 */
async function getEsiosIndicators() {
  const apiKey = process.env.ESIOS_API_KEY;
  if (!apiKey) return null;

  try {
    const now = new Date();
    const iso = now.toISOString();
    const { data } = await axios.get('https://api.esios.ree.es/indicators/600', {
      params: { start_date: iso, end_date: iso },
      headers: { 'x-api-key': apiKey, Accept: 'application/json; application/vnd.esios-api-v1+json' },
      timeout: REQUEST_TIMEOUT,
    });
    const values = data?.indicator?.values || [];
    const latest = values[values.length - 1];
    return {
      timestamp: now.toISOString(),
      source: 'REE ESIOS',
      indicator: 'spot_price',
      price_eur_mwh: latest ? latest.value : null,
      raw_count: values.length,
    };
  } catch (err) {
    logger.warn('[ENERGY][ESIOS] live fetch failed: %s', err.message);
    return null;
  }
}


// ─────────────────────────────────────────────────────────────
// REE apidatos (público, sin clave): demanda real y mix de generación
// ─────────────────────────────────────────────────────────────

const REE_BASE = 'https://apidatos.ree.es/es/datos';
const REE_TTL = 120; // 2 min
const REE_TIMEOUT = 15000; // apidatos tarda a veces 5-10 s
const REE_GROUPS = {
  solar: ['Solar fotovoltaica', 'Solar térmica'],
  wind: ['Eólica'],
  hydro: ['Hidráulica'],
  nuclear: ['Nuclear'],
  gas: ['Ciclo combinado', 'Turbina de gas'],
};
let _lastRee = null;


/** Último valor de la serie «Real» de demanda-tiempo-real (MW) o null. Puro. */
function parseReeDemand(json) {
  const series = (json && json.included || []).find((i) => i.type === 'Real');
  const values = series && series.attributes && series.attributes.values;
  if (!values || values.length === 0) return null;
  const last = values[values.length - 1];
  return Number.isFinite(Number(last.value)) ? { demand_mw: Math.round(Number(last.value)), at: last.datetime } : null;
}

/** Mix de generación (% sobre el total) desde estructura-generacion. Puro. */
function parseReeMix(json) {
  const items = (json && json.included) || [];
  const pct = new Map();
  let renewable = 0;
  for (const i of items) {
    const v = i.attributes && i.attributes.values && i.attributes.values[0];
    if (!v || i.type === 'Generación total') continue;
    const p = Number(v.percentage) * 100;
    if (!Number.isFinite(p)) continue;
    pct.set(i.type, p);
    if (i.attributes.type === 'Renovable') renewable += p;
  }
  if (pct.size === 0) return null;
  const group = (names) => parseFloat(names.reduce((a, n) => a + (pct.get(n) || 0), 0).toFixed(1));
  return {
    renewable_pct: parseFloat(renewable.toFixed(1)),
    mix: Object.fromEntries(Object.entries(REE_GROUPS).map(([k, names]) => [`${k}_pct`, group(names)])),
  };
}

/**
 * Indicadores reales de la red española (demanda y mix) desde apidatos.ree.es. No publica frecuencia ni balance
 * en tiempo real, así que van a null (no se inventan). Devuelve null si falla (el caller marca el simulado).
 */
let _reeInFlight = null;
let _reeAt = 0;

async function fetchReeGrid(now) {
  const day = (d) => d.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86_400_000);
  const opts = { timeout: REE_TIMEOUT };
  try {
    const [dem, mix] = await Promise.all([
      axios.get(`${REE_BASE}/demanda/demanda-tiempo-real`, { ...opts, params: { start_date: `${day(now)}T00:00`, end_date: `${day(now)}T23:59`, time_trunc: 'hour' } }),
      axios.get(`${REE_BASE}/generacion/estructura-generacion`, { ...opts, params: { start_date: `${day(yesterday)}T00:00`, end_date: `${day(yesterday)}T23:59`, time_trunc: 'day' } }),
    ]);
    const demand = parseReeDemand(dem.data);
    const structure = parseReeMix(mix.data);
    if (!demand && !structure) return null;
    const out = {
      timestamp: now.toISOString(),
      source: 'REE apidatos',
      simulated: false,
      demand_mw: demand ? demand.demand_mw : null,
      demand_at: demand ? demand.at : null,
      frequency_hz: null,
      grid_balance_mw: null,
      renewable_pct: structure ? structure.renewable_pct : null,
      mix: structure ? structure.mix : null,
      mix_period: `${day(yesterday)} (último día completo)`,
      notes: 'REE no publica frecuencia ni balance en tiempo real en su API abierta.',
    };
    _lastRee = out;
    _reeAt = Date.now();
    if (cache) { try { await cache.cacheSet('bezhas:energy:ree:grid', out, REE_TTL); } catch { /* ignore */ } }
    return out;
  } catch (err) {
    logger.warn('[ENERGY][REE] live fetch failed: %s', err.message);
    return null;
  }
}

/**
 * Indicadores reales de la red española (demanda y mix) desde apidatos.ree.es. No publica frecuencia ni balance en tiempo
 * real, así que van a null (no se inventan). La API de REE tarda a veces 5-10 s: se sirve el último valor bueno mientras se
 * refresca en segundo plano (una sola petición a la vez) y sólo la primera llamada espera. Sin dato → null (el caller marca el simulado).
 */
async function getReeGrid(now = new Date()) {
  if (_lastRee && Date.now() - _reeAt < REE_TTL * 1000) return _lastRee;
  if (!_reeInFlight) _reeInFlight = fetchReeGrid(now).finally(() => { _reeInFlight = null; });
  if (_lastRee) return _lastRee;          // valor viejo ahora, fresco en la próxima
  return _reeInFlight;
}

module.exports = {
  madridParts,
  parseReeDemand,
  parseReeMix,
  getReeGrid,
  __resetReeForTests: () => { _lastRee = null; _reeAt = 0; _reeInFlight = null; },
  parseMarginalPdbc,
  buildOmieResponse,
  omieFileUrl,
  getOmiePrice,
  prefetchOmiePrice,
  getEsiosIndicators,
};
