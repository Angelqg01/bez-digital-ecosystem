// Precio de BEZ para mostrar en Pay. Sale del oráculo PÚBLICO (no pide sesión, plan ni permisos): antes se pedía a
// /gateway/v1/token/price, que exige api-key con plan, y sin sesión la pantalla decía «Inicia sesión para verlo».
// Es solo para mostrar: el importe real de cada pedido lo calcula la API al crearlo, con config/bez-price.js.

export const ORACLE_PATH = '/api/gateway/v1/oracle/token-prices';

/** USD por BEZ de la respuesta del oráculo, o null si no trae un precio válido. */
export function parseOraclePrice(body) {
  const candidates = [body?.tokens?.BEZ?.priceUSD, body?.price, body?.bezCoinPriceUSD];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Pide el precio al oráculo. Devuelve { priceUSD, seed } o null si falla; la pantalla enseña «—», nunca un precio inventado. */
export async function fetchBezPrice(apiBase = '', fetchFn = globalThis.fetch, { signal } = {}) {
  try {
    const res = await fetchFn(`${apiBase}${ORACLE_PATH}`, { signal });
    if (!res.ok) return null;
    const body = await res.json();
    const priceUSD = parseOraclePrice(body);
    return priceUSD ? { priceUSD, seed: body.source === 'seed' || body.updatedAt == null } : null;
  } catch {
    return null;
  }
}
