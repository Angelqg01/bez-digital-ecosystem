'use strict';

/**
 * fxService — live EUR→USD reference rate for fiat settlements.
 *
 * Source of truth: the European Central Bank daily reference rates
 * (https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml). For a company
 * settling EUR under MiCA/AEAT this is the authoritative feed — free, no API key,
 * and the rate accountants/tax authorities expect. The ECB publishes once per
 * working day (~16:00 CET), so a 12h cache is plenty.
 *
 * Degrades gracefully: on any fetch/parse failure it returns the caller's
 * `fallback` (the static EUR_USD_RATE) instead of throwing, so settlement never
 * blocks on the feed being momentarily unreachable.
 */

const ECB_DAILY_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
const CACHE_TTL_MS = parseInt(process.env.FX_CACHE_TTL_MS || String(12 * 60 * 60 * 1000), 10);
const FETCH_TIMEOUT_MS = parseInt(process.env.FX_FETCH_TIMEOUT_MS || '5000', 10);

let _cache = null; // { rate, source, ts }

/** Parse "1 EUR = X USD" out of the ECB daily XML. */
function parseEurUsd(xml) {
  const m = /currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/i.exec(xml)
    || /rate=['"]([\d.]+)['"]\s+currency=['"]USD['"]/i.exec(xml);
  const rate = m ? Number(m[1]) : NaN;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Resolve the current EUR→USD rate.
 * @param {object} [opts]
 * @param {number} opts.fallback  Static rate to use if the live feed is unavailable.
 * @param {typeof fetch} [opts.fetchImpl]  Injectable for tests.
 * @returns {Promise<{ rate: number, source: 'ecb'|'cache'|'fallback', asOf: string }>}
 */
async function getEurUsdRate({ fallback, fetchImpl } = {}) {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
    return { rate: _cache.rate, source: 'cache', asOf: new Date(_cache.ts).toISOString() };
  }

  const doFetch = fetchImpl || globalThis.fetch;
  try {
    const res = await doFetch(ECB_DAILY_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`ECB ${res.status}`);
    const rate = parseEurUsd(await res.text());
    if (!rate) throw new Error('USD rate not found in ECB feed');
    _cache = { rate, source: 'ecb', ts: Date.now() };
    return { rate, source: 'ecb', asOf: new Date(_cache.ts).toISOString() };
  } catch (err) {
    // Stale cache beats a static guess if we have one.
    if (_cache) {
      return { rate: _cache.rate, source: 'cache', asOf: new Date(_cache.ts).toISOString() };
    }
    if (Number.isFinite(fallback) && fallback > 0) {
      return { rate: fallback, source: 'fallback', asOf: new Date().toISOString() };
    }
    throw err;
  }
}

/** Test/maintenance helper — clears the in-memory cache. */
function _resetCache() { _cache = null; }

module.exports = { getEurUsdRate, parseEurUsd, _resetCache };
