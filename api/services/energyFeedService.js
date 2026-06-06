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

function omieFileUrl(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
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
  const period = now.getHours() * periodsPerHour
    + Math.floor(now.getMinutes() / (60 / periodsPerHour)) + 1;

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

module.exports = {
  parseMarginalPdbc,
  buildOmieResponse,
  omieFileUrl,
  getOmiePrice,
  prefetchOmiePrice,
  getEsiosIndicators,
};
