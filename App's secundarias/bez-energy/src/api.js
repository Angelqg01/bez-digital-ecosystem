/**
 * bez-energy API Client — Unified backend + blockchain integration.
 *
 * Combines:
 *   1. REST API calls to the BeZhas API Gateway (/api/energy/)
 *   2. Direct blockchain reads via BeZhasClient (sector: energy, lazy-loaded)
 *
 * Responses from the gateway use snake_case + UPPERCASE enums; the UI pages
 * expect camelCase + capitalized status. This module normalizes every payload
 * into the exact shape the pages consume, so the two sides never drift again.
 *
 * When the gateway is unreachable or unauthenticated, a local simulated dataset
 * (in the same normalized shape) keeps the dashboard fully navigable for demos.
 *
 * Energy sector contracts (resolved on-chain when wallet features are used):
 *   - CarbonCreditToken — Carbon credit ERC-20
 *   - P2PEnergyMarket   — Peer-to-peer energy trading
 *   - SolarFarmToken    — Solar farm tokenization (RWA)
 *   - ESGScoreOracle    — ESG scoring oracle
 */

// ── Configuration ──
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const ENERGY_API = `${API_BASE_URL}/energy`;
const REQUEST_TIMEOUT_MS = 8000;

// ═══════════════════════════════════════════════════════════════
//  FETCH HELPERS (native fetch — no axios dependency)
// ═══════════════════════════════════════════════════════════════

/** Bearer token for authenticated gateway routes (in-memory / session only). */
function authHeaders() {
  if (typeof localStorage === 'undefined') return {};
  const token = localStorage.getItem('bezhas_access_token') || localStorage.getItem('bezhas-jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet(path) {
  const res = await fetch(`${ENERGY_API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${ENERGY_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `POST ${path} → ${res.status}`);
  return data;
}

// ═══════════════════════════════════════════════════════════════
//  NORMALIZERS (gateway shape → UI shape)
// ═══════════════════════════════════════════════════════════════

const STATUS_MAP = { ONLINE: 'Online', ACTIVE: 'Online', MAINTENANCE: 'Maintenance', OFFLINE: 'Offline' };
const mapStatus = (s) => STATUS_MAP[String(s || '').toUpperCase()] || 'Offline';

const SEVERITY_LEVEL = { HIGH: 'Critical', CRITICAL: 'Critical', WARNING: 'Warning', INFO: 'Info' };

const humanize = (s) =>
  String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function timeLeft(expires) {
  if (!expires) return '';
  const ms = new Date(expires).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return 'expired';
  const minutes = Math.round(ms / 60000);
  return minutes >= 60 ? `${(minutes / 60).toFixed(1)} h left` : `${minutes} min left`;
}

/** Build the per-node diagnostics object the SCADA page renders. */
function buildDiagnostics(node) {
  const d = {};
  if (node.voltage_v != null) d.voltage = `${node.voltage_v} V`;
  if (node.irradiance != null) d.irradiance = `${node.irradiance} W/m²`;
  if (node.wind_speed != null) d.wind = `${node.wind_speed} m/s`;
  if (node.rpm != null) d.rpm = `${node.rpm}`;
  if (node.flow_m3h != null) d.flow = `${node.flow_m3h} m³/h`;
  if (node.head_m != null) d.head = `${node.head_m} m`;
  if (node.soc_pct != null) d.soc = `${node.soc_pct} %`;
  if (node.temp_c != null) d.temp = `${node.temp_c} °C`;
  if (node.cycles != null) d.cycles = `${node.cycles}`;
  if (node.efficiency != null) d.efficiency = `${node.efficiency} %`;
  if (node.protocol) d.protocol = node.protocol;
  return d;
}

function normalizeTelemetry(raw) {
  if (!raw || !raw.global || !Array.isArray(raw.nodes)) return null;

  const nodes = raw.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    type: n.type,
    output: Number(n.output_kw ?? n.consumption_kw ?? 0),
    unit: 'kW',
    status: mapStatus(n.status),
    protocol: n.protocol,
    diagnostics: buildDiagnostics(n),
  }));

  const effs = raw.nodes.map((n) => n.efficiency).filter((e) => e != null);
  const efficiency = effs.length
    ? +(effs.reduce((a, b) => a + b, 0) / effs.length).toFixed(1)
    : (raw.global.self_sufficiency_pct ?? 0);

  const totalOutput = Number(raw.global.total_output_kw ?? 0);

  return {
    timestamp: raw.timestamp,
    global: {
      netFlow: Number(raw.global.net_flow_kw ?? 0),
      totalOutput,
      gridFrequency: raw.global.grid_frequency,
      selfSufficiency: raw.global.self_sufficiency_pct,
      efficiency,
      carbonOffset: +(totalOutput * 0.0004).toFixed(2),
    },
    nodes,
  };
}

function normalizeAlerts(raw) {
  const arr = Array.isArray(raw) ? raw : raw && Array.isArray(raw.alerts) ? raw.alerts : [];
  return arr.map((a) => ({
    id: a.id,
    level: SEVERITY_LEVEL[String(a.severity || '').toUpperCase()] || 'Info',
    title: a.title || humanize(a.type),
    diagnosis: a.diagnosis || a.message,
    timeRemaining: timeLeft(a.expires),
    source: a.source,
    action: a.action,
  }));
}

function normalizeWalletStats(raw) {
  if (!raw) return null;
  return {
    address: raw.address,
    balance: parseFloat(raw.balance_bzhs ?? raw.balance ?? 0),
    yieldPercentage: raw.yield_percentage ?? raw.yieldPercentage ?? '0',
    reputation: raw.reputation_score ?? raw.reputation ?? 0,
    selfSufficiency: raw.self_sufficiency_pct,
    staking: raw.staking,
    energyCredits: raw.energy_credits,
    contracts: raw.contracts,
  };
}

// ═══════════════════════════════════════════════════════════════
//  SIMULATED FALLBACK (same normalized shape — keeps demo navigable)
// ═══════════════════════════════════════════════════════════════

const rnd = (min, max, decimals = 2) =>
  +(Math.random() * (max - min) + min).toFixed(decimals);

function mockTelemetry() {
  const nodes = [
    { id: 'n1', name: 'Array Alpha', type: 'SOLAR', output: rnd(5, 25), unit: 'kW', status: 'Online', protocol: 'MQTT/Modbus', diagnostics: { voltage: `${rnd(220, 230, 1)} V`, irradiance: `${rnd(600, 1000, 0)} W/m²`, efficiency: `${rnd(94, 99, 1)} %` } },
    { id: 'n2', name: 'Turbine V1', type: 'WIND', output: rnd(2, 17), unit: 'kW', status: 'Online', protocol: 'MQTT', diagnostics: { wind: `${rnd(4, 16, 1)} m/s`, rpm: `${rnd(800, 1200, 0)}` } },
    { id: 'n3', name: 'Pumped Hydro', type: 'HYDRO', output: rnd(5, 35), unit: 'kW', status: 'Online', protocol: 'Modbus', diagnostics: { flow: `${rnd(100, 150, 1)} m³/h`, head: `${rnd(20, 30, 1)} m` } },
    { id: 'n4', name: 'BESS Unit 1', type: 'BATTERY', output: rnd(-5, 5), unit: 'kW', status: 'Online', protocol: 'CAN/MQTT', diagnostics: { soc: `${rnd(40, 90, 1)} %`, temp: `${rnd(25, 40, 1)} °C`, cycles: `${Math.floor(rnd(200, 1000, 0))}` } },
    { id: 'n5', name: 'Industrial HVAC', type: 'LOAD', output: rnd(10, 30), unit: 'kW', status: 'Online', protocol: 'Modbus', diagnostics: { 'demand response': 'eligible' } },
  ];
  const totalOutput = +nodes.filter((n) => n.type !== 'LOAD').reduce((s, n) => s + n.output, 0).toFixed(2);
  return {
    timestamp: new Date().toISOString(),
    global: {
      netFlow: rnd(-2, 10),
      totalOutput,
      gridFrequency: rnd(49.95, 50.05, 3),
      selfSufficiency: rnd(85, 95, 1),
      efficiency: rnd(94, 99, 1),
      carbonOffset: +(totalOutput * 0.0004).toFixed(2),
    },
    nodes,
    simulated: true,
  };
}

function mockAlerts() {
  return [
    { id: 'a1', level: 'Critical', title: 'Arbitrage Opportunity', diagnosis: '95% solar yield predicted. Recommend battery charge prior to 18:00 UTC grid spike.', timeRemaining: '60 min left', source: 'BeZhasEnergyAgent/XGBoost', action: { command: 'CHARGE_BATTERY', nodeId: 'n4' } },
    { id: 'a2', level: 'Warning', title: 'Negative Price Imminent', diagnosis: 'OMIE pool price dropping below zero in 2 hours. Activating max-charge protocol.', timeRemaining: '2.0 h left', source: 'BeZhasEnergyAgent/OMIE', action: { command: 'CHARGE_BATTERY', nodeId: 'n4' } },
    { id: 'a3', level: 'Info', title: 'Demand Response Eligible', diagnosis: 'Peak demand 20:00–22:00. Load curtailment on n5 yields €42 DR incentive.', timeRemaining: '3.0 h left', source: 'BeZhasEnergyAgent/LightGBM', action: { command: 'SHED_LOAD', nodeId: 'n5' } },
  ];
}

// ═══════════════════════════════════════════════════════════════
//  REST API CALLS (normalized, with graceful simulated fallback)
// ═══════════════════════════════════════════════════════════════

export const getTelemetry = async () => {
  try {
    return normalizeTelemetry(await apiGet('/telemetry')) || mockTelemetry();
  } catch (error) {
    console.warn('[energy] telemetry → simulated fallback:', error.message);
    return mockTelemetry();
  }
};

export const getAlerts = async () => {
  try {
    return normalizeAlerts(await apiGet('/alerts'));
  } catch (error) {
    console.warn('[energy] alerts → simulated fallback:', error.message);
    return mockAlerts();
  }
};

export const getWalletStats = async () => {
  try {
    return normalizeWalletStats(await apiGet('/wallet/stats'));
  } catch (error) {
    console.warn('[energy] wallet stats unavailable:', error.message);
    return null; // Wallet.jsx renders its own offline fallback.
  }
};

export const sendControlCommand = async (nodeId, command, params = {}) => {
  try {
    return await apiPost('/control', { nodeId, command, params });
  } catch (error) {
    // Demo-friendly: surface as a simulated dispatch instead of a hard error.
    console.warn('[energy] control → simulated dispatch:', error.message);
    return { success: true, simulated: true, nodeId, command, params };
  }
};

export const buyEnergyCredit = async (amountBzhs, txHash) => {
  try {
    const data = await apiPost('/wallet/buy-credit', { amountBzhs, txHash });
    return { ...data, newBalance: parseFloat(data.new_balance_bzhs ?? data.newBalance ?? amountBzhs) };
  } catch (error) {
    console.error('Error buying energy credit:', error.message);
    return { success: false, error: error.message };
  }
};

// ═══════════════════════════════════════════════════════════════
//  BLOCKCHAIN OPERATIONS (lazy-loaded — ethers only pulled in on use)
// ═══════════════════════════════════════════════════════════════

let _blockchainClient = null;

async function getBlockchainClient() {
  if (!_blockchainClient) {
    const { createEnergyClient } = await import('../../_shared/bezhas-blockchain-client.js');
    _blockchainClient = createEnergyClient({
      apiBaseUrl: API_BASE_URL,
      rpcUrl: import.meta.env.VITE_RPC_URL || 'http://localhost:8545',
    });
  }
  return _blockchainClient;
}

/** Load all energy sector smart contracts (ABI + addresses). */
export const loadEnergyContracts = async () => {
  return (await getBlockchainClient()).loadSectorContracts('energy');
};

/** Get carbon credit balance for an address. */
export const getCarbonCreditBalance = async (address) => {
  try {
    const client = await getBlockchainClient();
    const balance = await client.read('CarbonCreditToken', 'balanceOf', [address]);
    return { balance: balance.toString(), formatted: (Number(balance) / 1e18).toFixed(4) };
  } catch (error) {
    console.warn('CarbonCreditToken read failed:', error.message);
    return { balance: '0', formatted: '0.0000' };
  }
};

/** Get ESG score for a facility. */
export const getESGScore = async (facilityId) => {
  try {
    const client = await getBlockchainClient();
    const score = await client.read('ESGScoreOracle', 'getScore', [facilityId]);
    return { score: Number(score), facilityId };
  } catch (error) {
    console.warn('ESGScoreOracle read failed:', error.message);
    return { score: 0, facilityId, error: error.message };
  }
};

/** Get BEZ token balance (for energy credit purchases). */
export const getBEZBalance = async (address) => {
  try {
    return await (await getBlockchainClient()).getBEZBalance(address);
  } catch {
    return '0';
  }
};

/** Connect wallet and return address. */
export const connectWallet = async () => {
  return (await getBlockchainClient()).connectWallet();
};

/** Purchase energy credits by sending BEZ tokens. */
export const purchaseCreditsOnChain = async (amount) => {
  const client = await getBlockchainClient();
  const { address: marketAddress } = await client.getContractInfo('P2PEnergyMarket');
  await client.approveBEZ(marketAddress, amount);
  return client.write('P2PEnergyMarket', 'buyCredits', [
    await client.getAddress(),
    BigInt(Math.floor(Number(amount) * 1e18)).toString(),
  ]);
};

/** Check blockchain connectivity. */
export const pingBlockchain = async () => {
  return (await getBlockchainClient()).ping();
};

export default {
  // REST API
  getTelemetry,
  getAlerts,
  getWalletStats,
  sendControlCommand,
  buyEnergyCredit,
  // Blockchain
  loadEnergyContracts,
  getCarbonCreditBalance,
  getESGScore,
  getBEZBalance,
  connectWallet,
  purchaseCreditsOnChain,
  pingBlockchain,
};
