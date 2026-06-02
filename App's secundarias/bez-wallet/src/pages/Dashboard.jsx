/**
 * BeZhas API Service Layer
 * ─────────────────────────────────────────────────────────
 * Centraliza toda la comunicación con el backend Express y la blockchain.
 * Todos los hooks consumen este módulo — nunca fetch() directo en componentes.
 *
 * Estructura:
 *   bezhasApi.wallet.*     → balance, portfolio, RWA
 *   bezhasApi.gas.*        → gas tank
 *   bezhasApi.validator.*  → nodos validadores
 *   bezhasApi.agri.*       → escaneo agroindustrial
 *   bezhasApi.events.*     → eventos on-chain (REST + WS)
 *   bezhasApi.token.*      → precio BEZ, staking, APY
 */

'use strict';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

// ─────────────────────────────────────────────
// HTTP CLIENT — centraliza auth header y errores
// ─────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('bezhas_jwt');
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status} on ${path}`);
  }

  return res.json();
}

// ─────────────────────────────────────────────
// ABI MÍNIMOS — sólo lo que el frontend necesita
// Para operaciones de escritura el backend firma;
// el frontend sólo hace lecturas directas (view/pure).
// ─────────────────────────────────────────────
export const BEZ_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function stakedBalanceOf(address) view returns (uint256)',
];

export const STAKING_ABI = [
  'function stakedAmount(address) view returns (uint256)',
  'function pendingRewards(address) view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function apr() view returns (uint256)',        // base-points (e.g. 1800 = 18%)
];

export const VALIDATOR_REGISTRY_ABI = [
  'function getNodeInfo(address) view returns (tuple(string nodeId, uint256 blocksValidated, uint256 proofsAnchored, bool active, uint256 reputation))',
  'function totalNodes() view returns (uint256)',
  'function slashingEvents(address) view returns (uint256)',
];

export const CONTRACT_ADDRESSES = {
  BEZ_POLYGON: import.meta.env.VITE_BEZ_POLYGON || '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
  BEZ_BNB: import.meta.env.VITE_BEZ_BNB || '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55',
  STAKING: import.meta.env.VITE_STAKING_ADDR || '',
  VALIDATOR_REGISTRY: import.meta.env.VITE_VALIDATOR_ADDR || '',
  TREASURY_DAO: import.meta.env.VITE_TREASURY_ADDR || '0x89c23890c742d710265dD61be789C71dC8999b12',
};

// ─────────────────────────────────────────────
// WALLET / BALANCE
// ─────────────────────────────────────────────
export const walletApi = {
  /**
   * Retorna balance BEZ on-chain + valoración USD del backend.
   * El backend combina: balance del contrato + precio CoinGecko/oracle.
   */
  getBalance: (address) =>
    apiFetch(`/wallet/balance?address=${address}`),
  // Respuesta esperada: { bez: "12345.67", usd: "864.00", chain: "polygon" }

  /**
   * Portfolio completo: RWA tokens, NFTs de calidad, LP positions.
   */
  getPortfolio: (address) =>
    apiFetch(`/wallet/portfolio?address=${address}`),
  // Respuesta: { rwa: [], nfts: [], lp_positions: [], total_usd: "..." }

  /**
   * Staking position actual.
   */
  getStaking: (address) =>
    apiFetch(`/wallet/staking?address=${address}`),
  // Respuesta: { staked: "5000", pending_rewards: "45.20", apr: "18.00", unlock_date: null }

  /**
   * Score de reputación en la red BeZhas.
   */
  getReputation: (address) =>
    apiFetch(`/wallet/reputation?address=${address}`),
  // Respuesta: { score: 847, tier: "GOLD", badges: [...] }
};

// ─────────────────────────────────────────────
// GAS TANK
// ─────────────────────────────────────────────
export const gasApi = {
  getStatus: (address) =>
    apiFetch(`/gas/status?address=${address}`),
  // Respuesta: { balance_usd: "25.00", estimated_txs_remaining: 312, low_balance: false }

  topUp: (amountUsd) =>
    apiFetch('/gas/topup', { method: 'POST', body: JSON.stringify({ amount_usd: amountUsd }) }),
};

// ─────────────────────────────────────────────
// VALIDATOR NODE
// ─────────────────────────────────────────────
export const validatorApi = {
  getMyNode: (address) =>
    apiFetch(`/validator/node?address=${address}`),
  // Respuesta: { node_id: "EU-2708", health: 99.98, blocks_validated: 128440,
  //             proofs_anchored: 42919, risk_score: "low", slashing_events: 0,
  //             uptime_24h: 99.97, rewards_pending: "45.20" }

  getNetworkStats: () =>
    apiFetch('/validator/network'),
  // Respuesta: { total_nodes: 128, active_nodes: 126, tps: 847, finality_ms: 320,
  //             total_staked: "42000000", network_apr: "18.00" }

  getRewardHistory: (address, days = 30) =>
    apiFetch(`/validator/rewards?address=${address}&days=${days}`),
};

// ─────────────────────────────────────────────
// AGRO-INDUSTRIAL SCAN
// ─────────────────────────────────────────────
export const agriApi = {
  getQualityStats: (orgId) =>
    apiFetch(`/agri/quality?org=${orgId}`),
  // Respuesta: { fungi_pct: 3.8, quality_grade: "A-", quality_score: 91.4,
  //             lots_traced: 1284, ai_alerts: 17, alerts_requiring_human: 5 }

  getRecentScans: (orgId, limit = 10) =>
    apiFetch(`/agri/scans?org=${orgId}&limit=${limit}`),

  getScanDetail: (scanId) =>
    apiFetch(`/agri/scans/${scanId}`),

  triggerScan: (payload) =>
    apiFetch('/agri/scan', { method: 'POST', body: JSON.stringify(payload) }),
};

// ─────────────────────────────────────────────
// CHAIN EVENTS (REST + WebSocket)
// ─────────────────────────────────────────────
export const eventsApi = {
  getRecent: (address, limit = 20) =>
    apiFetch(`/events/recent?address=${address}&limit=${limit}`),
  // Respuesta: { events: [{ id, type, asset, amount, usd, time, dir, status, txHash }] }

  /**
   * Abre un WebSocket autenticado para recibir eventos en tiempo real.
   * Retorna un objeto { ws, close() } para que el hook gestione el ciclo de vida.
   *
   * @param {string} address  - Wallet address a suscribir
   * @param {function} onEvent  - Callback(event) por cada mensaje
   * @param {function} onError  - Callback(error)
   */
  subscribe: (address, onEvent, onError) => {
    const token = localStorage.getItem('bezhas_jwt');
    const ws = new WebSocket(`${WS_URL}/events?address=${address}&token=${token}`);

    ws.onopen = () => console.log('[WS Events] Connected');

    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        if (parsed.type === 'event') onEvent(parsed.payload);
      } catch (e) {
        console.error('[WS Events] Parse error', e);
      }
    };

    ws.onerror = (err) => {
      console.error('[WS Events] Error', err);
      if (onError) onError(err);
    };

    ws.onclose = (ev) => {
      if (!ev.wasClean) {
        console.warn('[WS Events] Disconnected unexpectedly — reconnect in 5s');
        // El hook usará esto para programar reconexión
      }
    };

    return {
      ws,
      close: () => ws.close(1000, 'component unmounted'),
    };
  },
};

// ─────────────────────────────────────────────
// TOKEN PRICE & MARKET
// ─────────────────────────────────────────────
export const tokenApi = {
  getPrice: () =>
    apiFetch('/token/price'),
  // Respuesta: { usd: "0.07", change_24h: "+2.4", volume_24h_usd: "142000",
  //             market_cap_usd: "7000000", circulating_supply: "100000000" }

  getDaoProposals: () =>
    apiFetch('/dao/proposals?status=active'),

  getStakingPools: () =>
    apiFetch('/staking/pools'),
};

export default {
  wallet: walletApi,
  gas: gasApi,
  validator: validatorApi,
  agri: agriApi,
  events: eventsApi,
  token: tokenApi,
  CONTRACT_ADDRESSES,
  BEZ_ABI,
  STAKING_ABI,
  VALIDATOR_REGISTRY_ABI,
};