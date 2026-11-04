'use strict';
const fs = require('fs');
const path = require('path');
const BaseConnector = require('./BaseConnector');

/**
 * TreasuryPositionsConnector — fuente de posiciones y precios para el runway
 * multi-divisa de TreasuryRunwayAgent. SOLO LECTURA: ni mueve fondos ni firma.
 *
 * Posiciones (`positions`), dos orígenes que se suman:
 *  1. Fichero JSON (TREASURY_POSITIONS_FILE, por defecto data/treasury-positions.json,
 *     que está en .gitignore): saldos de los bancos (Dubái, Miami, Róterdam,
 *     Algeciras…). No hay API bancaria integrada, así que los saldos entran
 *     por fichero (export/CSV convertido) y cada posición lleva su fecha
 *     `asOf`: una posición con más de `maxAgeHours` se marca OBSOLETA y el
 *     agente no puede tratarla como dato real.
 *  2. On-chain: entradas `source: "onchain"` (stablecoins en una wallet) leídas
 *     con ERC-20 `balanceOf` por el RPC configurado.
 *
 * Mercado (`market`): tipos de cambio USD→divisa (open.er-api.com, sin clave) y
 * precio de las stablecoins (CoinGecko simple/price, sin clave). Si el
 * proveedor no responde: `simulated: true` y se asume peg 1 / sin fx, y el
 * agente no dispara alertas críticas con ese dato (mismo contrato que
 * BeZhasCoreConnector).
 *
 * Formato del fichero:
 *  { "positions": [
 *      { "bank": "Dubai", "asset": "AED", "kind": "fiat", "amount": 1200000, "asOf": "2026-11-03" },
 *      { "asset": "USDC", "kind": "stable", "source": "onchain", "chain": "polygon",
 *        "token": "0x…", "address": "0x…" } ] }
 */
const COINGECKO_IDS = { USDC: 'usd-coin', USDT: 'tether', DAI: 'dai', EURC: 'euro-coin' };
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];

class TreasuryPositionsConnector extends BaseConnector {
  constructor({ tenantId, config = {} } = {}) {
    super({ tenantId, config });
    this.name = 'treasury-positions';
    this.file = config.file || process.env.TREASURY_POSITIONS_FILE || path.join(__dirname, '../../data/treasury-positions.json');
    this.maxAgeHours = Number(config.maxAgeHours || process.env.TREASURY_POSITIONS_MAX_AGE_HOURS || 72);
    this.rpcUrl = config.rpcUrl || process.env.POLYGON_RPC_URL || process.env.RPC_URL || '';
    this.timeoutMs = Number(config.timeoutMs || 4000);
    this._fetch = config.fetch || globalThis.fetch;
    this._readErc20 = config.readErc20 || ((e) => this._readErc20Onchain(e));
    this._now = config.now || (() => Date.now());
  }

  async execute(method) {
    switch (method) {
      case 'positions': return this.positions();
      case 'market': return this.market();
      default: throw new Error(`treasury-positions: método desconocido ${method}`);
    }
  }

  async positions() {
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (err) {
      return { holdings: [], stale: [], warnings: [`Sin fichero de posiciones (${this.file}): ${err.code || err.message}`], simulated: true };
    }
    const holdings = [];
    const stale = [];
    const warnings = [];
    for (const p of Array.isArray(raw.positions) ? raw.positions : []) {
      if (!p?.asset || !['fiat', 'stable', 'volatile'].includes(p.kind)) {
        warnings.push(`Posición ignorada por formato inválido: ${JSON.stringify(p)?.slice(0, 80)}`);
        continue;
      }
      let amount = Number(p.amount);
      let asOf = p.asOf;
      if (p.source === 'onchain') {
        try {
          amount = Number(await this._readErc20(p));
          asOf = new Date(this._now()).toISOString();
        } catch (err) {
          warnings.push(`No se pudo leer ${p.asset} on-chain (${p.address}): ${err.message}`);
          continue;
        }
      }
      if (!Number.isFinite(amount)) { warnings.push(`Importe inválido en ${p.asset}${p.bank ? ' (' + p.bank + ')' : ''}.`); continue; }
      const ageH = asOf ? (this._now() - Date.parse(asOf)) / 3.6e6 : Infinity;
      const entry = { asset: p.asset, kind: p.kind, amount, bank: p.bank || null, source: p.source || 'file', asOf: asOf || null };
      if (ageH > this.maxAgeHours) stale.push(entry);
      holdings.push(entry);
    }
    if (stale.length) warnings.push(`${stale.length} posición(es) con más de ${this.maxAgeHours} h sin actualizar: ${stale.map((s) => s.bank || s.asset).join(', ')}.`);
    return { holdings, stale, warnings, simulated: false };
  }

  async market() {
    const assets = ['USD', 'EUR', 'AED'];
    const fx = { USD: 1 };
    const pegs = {};
    let simulated = false;
    try {
      const rates = await this._getJson('https://open.er-api.com/v6/latest/USD');
      for (const a of assets) if (a !== 'USD' && rates?.rates?.[a]) fx[a] = 1 / rates.rates[a];
      const ids = Object.values(COINGECKO_IDS).join(',');
      const prices = await this._getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      for (const [sym, id] of Object.entries(COINGECKO_IDS)) if (prices?.[id]?.usd) pegs[sym] = prices[id].usd;
      if (Object.keys(fx).length < 2 || !Object.keys(pegs).length) simulated = true;
    } catch {
      simulated = true;
    }
    return { fx, pegs, prices: {}, simulated, asOf: new Date(this._now()).toISOString() };
  }

  async _getJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this._fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally { clearTimeout(timer); }
  }

  async _readErc20Onchain({ token, address }) {
    if (!this.rpcUrl) throw new Error('sin RPC configurado (POLYGON_RPC_URL)');
    const { ethers } = require('ethers');
    const provider = new ethers.JsonRpcProvider(this.rpcUrl);
    const c = new ethers.Contract(token, ERC20_ABI, provider);
    const [raw, dec] = await Promise.all([c.balanceOf(address), c.decimals()]);
    return ethers.formatUnits(raw, dec);
  }
}
module.exports = TreasuryPositionsConnector;
