/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║          BeZhas OpenClaw — Energy VPP MCP Server  v2.0.0                   ║
 * ║  Virtual Power Plant · OMIE/ESIOS · SCADA/HITL · CAE RWA · P2P · Aegis    ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Correcciones y mejoras aplicadas vs. v1.0.0:
 *  [BUG]  Sin validación de inputs — args usados directamente sin chequeo
 *  [BUG]  Sin límites de seguridad en SCADA — powerLimitKW sin rango máximo
 *  [BUG]  Sin try/catch en handlers — cualquier error rompe la conexión stdio
 *  [BUG]  Respuestas como texto plano — el LLM no puede parsear datos estructurados
 *  [BUG]  Un solo if-else gigante — sin separación de responsabilidades
 *  [OPT]  Sin tool annotations (readOnlyHint, destructiveHint, idempotentHint)
 *  [OPT]  Sin HITL para comandos críticos (SCADA, Demand Response)
 *  [OPT]  Sin graceful shutdown (SIGTERM/SIGINT)
 *  [OPT]  getMockOmiePrice() devuelve 3 valores estáticos — sin curva duck real
 *  [OPT]  Faltan 10 tools del Vision Doc: ESIOS, CAE, P2P, Staking, Aegis, etc.
 *  [OPT]  Sin logging estructurado para auditoría on-chain
 *
 * Tools implementadas (15):
 *  READ-ONLY (7):
 *   · get_omie_price             — Precio spot OMIE + curva duck + predicción IA
 *   · get_esios_indicators       — Mix renovable, frecuencia, demanda REE
 *   · calculate_arbitrage_strategy — Estrategia óptima XGBoost/LightGBM
 *   · read_scada_telemetry       — Telemetría de nodo (SoC, kW, voltaje, temp)
 *   · get_vpp_status             — Estado global de la VPP
 *   · get_p2p_market_offers      — Ofertas activas en mercado P2P
 *   · get_staking_rewards        — Recompensas de staking por flexibilidad VPP
 *
 *  WRITE — requieren validación (5):
 *   · execute_battery_arbitrage  — Bid al contrato BeZhasVPP.sol
 *   · publish_p2p_offer          — Publicar oferta de venta de excedentes
 *   · execute_p2p_trade          — Comprar energía P2P (pago en BZHS)
 *   · mint_cae_token             — Emitir CAE (Certificado de Ahorro Energético RWA)
 *   · claim_staking_rewards      — Reclamar recompensas del StakingPoolV2.sol
 *
 *  CRÍTICO — requieren HITL (3):
 *   · adjust_inverter_setpoint   — Comando SCADA físico a inversor solar/batería
 *   · activate_demand_response   — Desconexión temporal de cargas industriales
 *   · trigger_islanding_mode     — Modo isla de emergencia (desconexión de red)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { resolveAddress, getSectorContracts, buildContractMap, getBEZTokenAddress } from './contract-resolver.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE DOMINIO
// ─────────────────────────────────────────────────────────────────────────────

/** Contratos BeZhas L2 — resolved dynamically from deployments */
const CONTRACTS = {
  VPP: resolveAddress('P2PEnergyMarket') || process.env.CONTRACT_BEZHAS_VPP || '0x0000000000000000000000000000000000000001',
  ORACLE: resolveAddress('ESGScoreOracle') || process.env.CONTRACT_ENERGY_ORACLE || '0x0000000000000000000000000000000000000002',
  CAE_TOKEN: resolveAddress('CarbonCreditToken') || process.env.CONTRACT_ENERGY_CAE_TOKEN || '0x0000000000000000000000000000000000000003',
  SOLAR_FARM: resolveAddress('SolarFarmToken') || process.env.CONTRACT_SOLAR_FARM || null,
  STAKING: resolveAddress('StakingPool') || resolveAddress('StakingPoolV2') || process.env.CONTRACT_STAKING_POOL_V2 || null,
  BEZ_TOKEN: getBEZTokenAddress().address,
};

// Load all energy sector contracts at startup for reference
const ENERGY_SECTOR = getSectorContracts('energy');
const ENERGY_CONTRACT_MAP = buildContractMap(ENERGY_SECTOR);

/** Límites de seguridad SCADA — cualquier valor fuera de rango = rechazo inmediato */
const SAFETY_LIMITS = {
  MAX_BATTERY_POWER_KW: 500,    // máximo por BESS unit
  MAX_INVERTER_POWER_KW: 250,    // máximo por inversor solar
  MAX_REACTIVE_POWER_KVAR: 200,
  MAX_TRADE_MWH: 10,     // máximo por operación de arbitraje
  MIN_TRADE_MWH: 0.001,
  MAX_PRICE_LIMIT: 500,    // €/MWh
  MAX_DR_DURATION_MIN: 120,    // máximo Demand Response
  MAX_CAE_SAVINGS_KWH: 1_000_000,
};

/** Curva duck simulada OMIE por hora UTC (€/MWh) */
const OMIE_DUCK_CURVE_EUR_MWH = [
  45, 42, 38, 35, 33, 30,   //  0-5h  — valle nocturno
  28, 32, 55, 70, 20, -5,   //  6-11h — rampa mañana + exceso solar (precio negativo)
  -12, -8, 5, 18, 40, 90,   // 12-17h — exceso solar mediodía + inicio rampa tarde
  150, 180, 170, 130, 90, 60, // 18-23h — pico tarde (duck curve peak)
];

/** IDs de nodo permitidos (Edge Node registry) */
const VALID_NODE_IDS = new Set(['n1', 'n2', 'n3', 'n4', 'n5']);

/** Tipos de nodo y límites asociados */
const NODE_REGISTRY = {
  n1: { type: 'SOLAR', name: 'Array Alpha', maxKw: 20, protocol: 'MQTT/Modbus' },
  n2: { type: 'WIND', name: 'Turbine V1', maxKw: 15, protocol: 'MQTT' },
  n3: { type: 'HYDRO', name: 'Pumped Hydro', maxKw: 30, protocol: 'Modbus' },
  n4: { type: 'BATTERY', name: 'BESS Unit 1', maxKw: 500, protocol: 'CAN/MQTT' },
  n5: { type: 'LOAD', name: 'Industrial HVAC', maxKw: 25, protocol: 'Modbus' },
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGGER ESTRUCTURADO (stderr para no contaminar el canal stdio MCP)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured logger.
 * Writes to stderr to avoid contaminating the MCP stdio channel.
 * Uses console.error() instead of process.stderr.write() to avoid
 * PowerShell NativeCommandError when stderr is redirected with 2>&1.
 */
const log = {
  _fmt: (level, tool, msg, data) => JSON.stringify({ level, tool, msg, ...data, ts: new Date().toISOString() }),
  info:  (tool, msg, data = {}) => console.error(log._fmt('INFO', tool, msg, data)),
  warn:  (tool, msg, data = {}) => console.error(log._fmt('WARN', tool, msg, data)),
  error: (tool, msg, data = {}) => console.error(log._fmt('ERROR', tool, msg, data)),
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — Respuestas estructuradas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea una respuesta de tool como JSON estructurado + texto legible.
 * El LLM recibe el texto; el cliente puede parsear el JSON del campo structuredData.
 * @param {object} data     — datos estructurados del resultado
 * @param {string} summary  — resumen en lenguaje natural para el LLM
 */
function toolSuccess(data, summary) {
  return {
    content: [
      {
        type: 'text',
        text: `${summary}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
      },
    ],
  };
}

/**
 * Error de tool con mensaje accionable.
 * Incluye `isError: true` para que el cliente MCP sepa que es un fallo.
 */
function toolError(code, message, suggestion = '') {
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `[${code}] ${message}${suggestion ? `\n\nSuggestion: ${suggestion}` : ''}`,
      },
    ],
  };
}

/** Entrada de auditoría — se registrará on-chain en BeZhasVPP.sol en producción */
function buildAuditEntry(tool, args, result) {
  return {
    tool,
    args,
    result_summary: result,
    ts: new Date().toISOString(),
    contract: CONTRACTS.VPP,
    hitl_required: ['adjust_inverter_setpoint', 'activate_demand_response', 'trigger_islanding_mode'].includes(tool),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — Validadores de inputs
// ─────────────────────────────────────────────────────────────────────────────

/** Lanza un error con código si la condición no se cumple */
function assert(condition, code, message) {
  if (!condition) {
    const err = new Error(message);
    err.code = code;
    err.isToolError = true;
    throw err;
  }
}

function validateNodeId(nodeId) {
  assert(typeof nodeId === 'string' && nodeId.length > 0, 'INVALID_NODE_ID', `nodeId is required and must be a string`);
  assert(VALID_NODE_IDS.has(nodeId), 'UNKNOWN_NODE', `Node "${nodeId}" is not registered. Valid nodes: ${[...VALID_NODE_IDS].join(', ')}`);
}

function validatePowerKw(powerKw, maxKw, field = 'powerLimitKW') {
  assert(typeof powerKw === 'number' && !isNaN(powerKw), 'INVALID_POWER', `${field} must be a number`);
  assert(powerKw >= 0, 'NEGATIVE_POWER', `${field} cannot be negative`);
  assert(powerKw <= maxKw, 'POWER_SAFETY_LIMIT', `${field} (${powerKw} kW) exceeds safety limit of ${maxKw} kW. Command rejected for grid protection.`);
}

function validateMWh(amountMWh) {
  assert(typeof amountMWh === 'number', 'INVALID_MWH', 'amountMWh must be a number');
  assert(amountMWh >= SAFETY_LIMITS.MIN_TRADE_MWH, 'MWH_TOO_SMALL', `Minimum trade size is ${SAFETY_LIMITS.MIN_TRADE_MWH} MWh`);
  assert(amountMWh <= SAFETY_LIMITS.MAX_TRADE_MWH, 'MWH_TOO_LARGE', `Maximum trade size per operation is ${SAFETY_LIMITS.MAX_TRADE_MWH} MWh`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULADORES DE DATOS (reemplazar con clientes reales en producción)
// ─────────────────────────────────────────────────────────────────────────────

/** OMIE con curva duck completa + predicción IA */
function getOmieData() {
  const h = new Date().getUTCHours();
  const price = OMIE_DUCK_CURVE_EUR_MWH[h];
  const price1h = OMIE_DUCK_CURVE_EUR_MWH[(h + 1) % 24];
  const price6h = OMIE_DUCK_CURVE_EUR_MWH[(h + 6) % 24];

  return {
    timestamp: new Date().toISOString(),
    price_eur_mwh: price,
    unit: 'EUR/MWh',
    market: 'OMIE Mercado Diario (Spain)',
    status: price < 0 ? 'NEGATIVE_PRICE' : price < 30 ? 'LOW' : price > 100 ? 'HIGH_PEAK' : 'NORMAL',
    duck_curve_hour: h,
    predictions: {
      in_1h: { price_eur_mwh: price1h, confidence: 0.93, model: 'XGBoost/v2' },
      in_6h: { price_eur_mwh: price6h, confidence: 0.79, model: 'LightGBM/v3' },
    },
    hourly_today: OMIE_DUCK_CURVE_EUR_MWH.map((p, i) => ({ hour_utc: i, price_eur_mwh: p })),
  };
}

/** Indicadores ESIOS — Red Eléctrica de España */
function getEsiosData() {
  return {
    timestamp: new Date().toISOString(),
    source: 'REE ESIOS API',
    demand_mw: Math.round(28_000 + Math.random() * 8_000),
    frequency_hz: parseFloat((49.95 + Math.random() * 0.1).toFixed(3)),
    grid_balance_mw: parseFloat((Math.random() * 200 - 100).toFixed(1)),
    renewable_pct: parseFloat((55 + Math.random() * 30).toFixed(1)),
    mix: {
      solar_pct: parseFloat((15 + Math.random() * 20).toFixed(1)),
      wind_pct: parseFloat((20 + Math.random() * 25).toFixed(1)),
      hydro_pct: parseFloat((5 + Math.random() * 10).toFixed(1)),
      nuclear_pct: parseFloat((18 + Math.random() * 5).toFixed(1)),
      gas_pct: parseFloat((5 + Math.random() * 15).toFixed(1)),
    },
    // EN PRODUCCIÓN:
    // const r = await fetch('https://api.esios.ree.es/indicators/1', { headers: { 'x-api-key': process.env.ESIOS_API_KEY } });
  };
}

/** Telemetría de un Edge Node específico */
function getNodeTelemetry(nodeId) {
  const node = NODE_REGISTRY[nodeId];
  const base = {
    node_id: nodeId,
    node_type: node.type,
    node_name: node.name,
    protocol: node.protocol,
    timestamp: new Date().toISOString(),
    status: 'ONLINE',
  };

  switch (node.type) {
    case 'SOLAR':
      return { ...base, output_kw: parseFloat((Math.random() * node.maxKw).toFixed(2)), voltage_v: parseFloat((220 + Math.random() * 10).toFixed(1)), irradiance_wm2: Math.round(600 + Math.random() * 400), efficiency_pct: parseFloat((94 + Math.random() * 5).toFixed(1)) };
    case 'WIND':
      return { ...base, output_kw: parseFloat((Math.random() * node.maxKw).toFixed(2)), wind_speed_ms: parseFloat((4 + Math.random() * 12).toFixed(1)), rpm: Math.round(800 + Math.random() * 400) };
    case 'HYDRO':
      return { ...base, output_kw: parseFloat((Math.random() * node.maxKw).toFixed(2)), flow_m3h: parseFloat((100 + Math.random() * 50).toFixed(1)), head_m: parseFloat((20 + Math.random() * 10).toFixed(1)) };
    case 'BATTERY':
      return { ...base, output_kw: parseFloat((Math.random() * 10 - 5).toFixed(2)), soc_pct: parseFloat((40 + Math.random() * 50).toFixed(1)), temp_c: parseFloat((25 + Math.random() * 15).toFixed(1)), cycles: Math.round(200 + Math.random() * 800), mode: 'ARBITRAGE' };
    case 'LOAD':
      return { ...base, consumption_kw: parseFloat((10 + Math.random() * node.maxKw).toFixed(2)), demand_response_eligible: true };
    default:
      return base;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFINICIÓN DE TOOLS
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS = [

  // ──────────────── READ-ONLY TOOLS ────────────────────────────────────────

  {
    name: 'get_omie_price',
    description: 'Fetch the real-time wholesale electricity pool price from OMIE (Spanish electricity market). Returns current price, duck curve status, and AI predictions (XGBoost/LightGBM) for the next 1h and 6h. Use to decide charge/discharge strategy.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  },

  {
    name: 'get_esios_indicators',
    description: 'Fetch real-time grid indicators from REE ESIOS (Red Eléctrica de España): total demand, frequency, renewable energy mix (solar/wind/hydro), and grid balance. Use to assess grid stress before dispatching SCADA commands.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  },

  {
    name: 'calculate_arbitrage_strategy',
    description: 'Analyze current OMIE price + ESIOS indicators + battery SoC and return the optimal charge/discharge strategy with estimated yield in EUR. Uses XGBoost/LightGBM models. Call before execute_battery_arbitrage.',
    inputSchema: {
      type: 'object',
      properties: {
        batteryNodeId: {
          type: 'string',
          description: 'ID of the BATTERY node to include in strategy (e.g. "n4")',
        },
        horizonHours: {
          type: 'integer',
          description: 'Planning horizon in hours (1–24). Default: 6.',
          minimum: 1,
          maximum: 24,
          default: 6,
        },
      },
      required: ['batteryNodeId'],
    },
    annotations: { readOnlyHint: true, idempotentHint: false },
  },

  {
    name: 'read_scada_telemetry',
    description: 'Read real-time telemetry from a specific VPP Edge Node (solar inverter, wind turbine, BESS, or controllable load). Returns power flow, voltage, temperature, SoC, and protocol status. Always call before issuing SCADA control commands.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: `Edge Node ID. Registered nodes: ${Object.entries(NODE_REGISTRY).map(([id, n]) => `${id} (${n.type}: ${n.name})`).join(', ')}`,
          enum: [...VALID_NODE_IDS],
        },
      },
      required: ['nodeId'],
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },

  {
    name: 'get_vpp_status',
    description: 'Get the overall status of the Virtual Power Plant: total generation, self-sufficiency, active strategy, node health, and pending HITL approvals. Use as entry point for energy management sessions.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },

  {
    name: 'get_p2p_market_offers',
    description: 'List active energy offers in the BeZhas P2P market where prosumers sell surplus energy to other nodes using BZHS token. Returns offer_id, energy_kwh, price_bzhs_kwh, source type, and expiry.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceType: {
          type: 'string',
          enum: ['SOLAR', 'WIND', 'HYDRO', 'BATTERY', 'ANY'],
          description: 'Filter by energy source type. Default: ANY.',
          default: 'ANY',
        },
        maxPriceBzhsKwh: {
          type: 'number',
          description: 'Maximum price in BZHS/kWh to filter offers.',
        },
      },
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },

  {
    name: 'get_staking_rewards',
    description: 'Check pending BZHS staking rewards earned by providing battery flexibility to the VPP pool (StakingPoolV2.sol). Returns staked amount, APY, pending rewards, and flexibility score.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'EVM wallet address (0x...). If omitted, uses the authenticated session address.',
          pattern: '^0x[a-fA-F0-9]{40}$',
        },
      },
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  },

  // ──────────────── WRITE TOOLS ─────────────────────────────────────────────

  {
    name: 'execute_battery_arbitrage',
    description: 'Submit a charge/discharge bid to the BeZhasVPP smart contract (BeZhasVPP.sol). Use after calculate_arbitrage_strategy confirms a profitable opportunity. Requires Human-In-The-Loop approval for trades above €500 value.',
    inputSchema: {
      type: 'object',
      properties: {
        amountMWh: {
          type: 'number',
          description: `Energy amount in MWh. Range: ${SAFETY_LIMITS.MIN_TRADE_MWH}–${SAFETY_LIMITS.MAX_TRADE_MWH} MWh.`,
          minimum: SAFETY_LIMITS.MIN_TRADE_MWH,
          maximum: SAFETY_LIMITS.MAX_TRADE_MWH,
        },
        priceLimit: {
          type: 'number',
          description: `Maximum (buy) or minimum (sell) price in €/MWh. Range: 0–${SAFETY_LIMITS.MAX_PRICE_LIMIT}.`,
          minimum: 0,
          maximum: SAFETY_LIMITS.MAX_PRICE_LIMIT,
        },
        isBuy: {
          type: 'boolean',
          description: 'true = charge battery (buy from grid). false = discharge + sell to grid.',
        },
        batteryNodeId: {
          type: 'string',
          enum: ['n4'],
          description: 'ID of the BATTERY node to operate. Currently: n4 (BESS Unit 1).',
        },
      },
      required: ['amountMWh', 'priceLimit', 'isBuy', 'batteryNodeId'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },

  {
    name: 'publish_p2p_offer',
    description: 'Publish a surplus energy offer to the BeZhas P2P marketplace. Other nodes can purchase the energy using BZHS token. Offer is recorded on-chain in BeZhasVPP.sol.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', enum: [...VALID_NODE_IDS], description: 'Source node generating the surplus energy.' },
        energyKwh: { type: 'number', description: 'Amount of energy to sell in kWh.', minimum: 1, maximum: 10_000 },
        priceBzhsKwh: { type: 'number', description: 'Asking price in BZHS per kWh.', minimum: 0.001, maximum: 1 },
        expiresInMinutes: { type: 'integer', description: 'Offer expiry in minutes (15–1440).', minimum: 15, maximum: 1440 },
      },
      required: ['nodeId', 'energyKwh', 'priceBzhsKwh', 'expiresInMinutes'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },

  {
    name: 'execute_p2p_trade',
    description: 'Purchase energy from an active P2P market offer. Payment is settled in BZHS token via Account Abstraction (gas paid by BeZhas). Delivery window is 15 minutes.',
    inputSchema: {
      type: 'object',
      properties: {
        offerId: { type: 'string', description: 'Offer ID from get_p2p_market_offers response.' },
        txHash: { type: 'string', description: 'EVM transaction hash confirming BZHS payment (0x...).', pattern: '^0x[a-fA-F0-9]{64}$' },
      },
      required: ['offerId', 'txHash'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },

  {
    name: 'mint_cae_token',
    description: 'Mint a CAE (Certificado de Ahorro Energético) RWA token on BeZhas L2 for verified energy savings (EnergyCAEToken.sol). Savings must be backed by on-chain telemetry from EnergyOracle.sol. Requires CNMC/IDAE/BeZhas oracle proof.',
    inputSchema: {
      type: 'object',
      properties: {
        savingsKwh: { type: 'number', description: 'Verified energy savings in kWh. Minimum 100 kWh.', minimum: 100, maximum: SAFETY_LIMITS.MAX_CAE_SAVINGS_KWH },
        period: { type: 'string', description: 'Reporting period in format YYYY-Q{1-4} (e.g. "2025-Q2").', pattern: '^\d{4}-Q[1-4]$' },
        certifier: { type: 'string', enum: ['CNMC', 'IDAE', 'BEZHAS_ORACLE'], description: 'Certifying authority.' },
        telemetryProof: { type: 'string', description: 'IPFS CID or EnergyOracle.sol merkle root proving savings.' },
      },
      required: ['savingsKwh', 'period', 'certifier', 'telemetryProof'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },

  {
    name: 'claim_staking_rewards',
    description: 'Claim pending BZHS staking rewards earned by providing VPP battery flexibility (calls StakingPoolV2.sol.claimRewards). Call get_staking_rewards first to confirm pending amount.',
    inputSchema: {
      type: 'object',
      properties: {
        walletAddress: {
          type: 'string',
          description: 'EVM wallet address (0x...). If omitted, uses the authenticated session address.',
          pattern: '^0x[a-fA-F0-9]{40}$',
        },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },

  // ──────────────── CRITICAL TOOLS — HITL OBLIGATORIO ──────────────────────

  {
    name: 'adjust_inverter_setpoint',
    description: '⚠️ CRITICAL SCADA COMMAND — requires Human-In-The-Loop (HITL) approval before physical execution. Adjusts the active or reactive power setpoint on a solar inverter or BESS unit via Modbus/MQTT. Always call read_scada_telemetry first to verify current node state. Rejected if powerLimitKW exceeds node safety limits.',
    inputSchema: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          enum: ['n1', 'n2', 'n3', 'n4'],  // n5 es LOAD, no inversor
          description: 'Target Edge Node ID. Only SOLAR, WIND, HYDRO, BATTERY nodes accepted.',
        },
        powerLimitKW: {
          type: 'number',
          description: `New active power setpoint in kW. Must be within node safety limit. n1=20kW, n2=15kW, n3=30kW, n4=${SAFETY_LIMITS.MAX_BATTERY_POWER_KW}kW.`,
          minimum: 0,
          maximum: SAFETY_LIMITS.MAX_BATTERY_POWER_KW,
        },
        reactiveKvar: {
          type: 'number',
          description: `Optional reactive power adjustment in kVAR. Maximum ±${SAFETY_LIMITS.MAX_REACTIVE_POWER_KVAR} kVAR.`,
          minimum: -SAFETY_LIMITS.MAX_REACTIVE_POWER_KVAR,
          maximum: SAFETY_LIMITS.MAX_REACTIVE_POWER_KVAR,
        },
        reason: {
          type: 'string',
          description: 'Mandatory justification for this SCADA command (required for HITL audit trail and RD 88/2026 compliance).',
        },
      },
      required: ['nodeId', 'powerLimitKW', 'reason'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },

  {
    name: 'activate_demand_response',
    description: '⚠️ CRITICAL — requires HITL approval. Temporarily curtails industrial loads (e.g. HVAC n5) during grid stress or high OMIE price peaks. Eligible under REE P48 DR program. Always call get_esios_indicators + get_omie_price first to confirm DR conditions are met.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['ACTIVATE', 'DEACTIVATE'], description: 'Start or end a Demand Response event.' },
        nodeIds: { type: 'array', items: { type: 'string', enum: ['n5'] }, description: 'Load nodes to curtail. Currently: n5 (Industrial HVAC).', minItems: 1 },
        durationMin: { type: 'integer', description: `Duration in minutes (5–${SAFETY_LIMITS.MAX_DR_DURATION_MIN}).`, minimum: 5, maximum: SAFETY_LIMITS.MAX_DR_DURATION_MIN },
        reason: { type: 'string', description: 'Justification for DR activation (audit trail). Include current OMIE price and ESIOS demand data.' },
      },
      required: ['action', 'nodeIds', 'durationMin', 'reason'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },

  {
    name: 'trigger_islanding_mode',
    description: '⚠️ EMERGENCY CRITICAL — requires HITL approval. Disconnects the VPP from the main grid and operates as an isolated microgrid. Only use during confirmed grid fault or emergency. Irreversible without grid reconnection protocol. Logged as critical event on BeZhasVPP.sol.',
    inputSchema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Emergency justification (mandatory for Aegis audit and RD 88/2026 compliance).' },
        maxDurationMin: { type: 'integer', description: 'Maximum islanding duration in minutes before auto-reconnect attempt (5–60).', minimum: 5, maximum: 60 },
      },
      required: ['reason', 'maxDurationMin'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HANDLERS DE TOOLS — Separados por responsabilidad (no un if-else gigante)
// ─────────────────────────────────────────────────────────────────────────────

const toolHandlers = {

  // ──── READ-ONLY ────────────────────────────────────────────────────────────

  get_omie_price() {
    const data = getOmieData();
    const rec = data.price_eur_mwh < 0 ? 'CHARGE_BATTERY at maximum power (negative price opportunity)'
      : data.price_eur_mwh < 30 ? 'CHARGE_BATTERY — price below threshold'
        : data.price_eur_mwh > 100 ? 'DISCHARGE_AND_SELL — peak price above €100/MWh'
          : 'HOLD — price within normal band (€30–€100/MWh)';
    data.ai_recommendation = rec;
    return toolSuccess(data, `OMIE Spot Price: ${data.price_eur_mwh} €/MWh (${data.status}). AI Recommendation: ${rec}`);
  },

  get_esios_indicators() {
    const data = getEsiosData();
    const alert = data.frequency_hz < 49.9 ? '⚠️ UNDER-FREQUENCY — consider battery discharge to support grid'
      : data.frequency_hz > 50.1 ? '⚠️ OVER-FREQUENCY — reduce generation or increase consumption'
        : '✅ Grid frequency nominal';
    return toolSuccess(data, `REE ESIOS: Demand ${data.demand_mw} MW | Freq ${data.frequency_hz} Hz | Renewables ${data.renewable_pct}%. ${alert}`);
  },

  calculate_arbitrage_strategy({ batteryNodeId, horizonHours = 6 }) {
    validateNodeId(batteryNodeId);
    assert(NODE_REGISTRY[batteryNodeId]?.type === 'BATTERY', 'NOT_A_BATTERY', `Node ${batteryNodeId} is not a BATTERY node. Strategy calculation requires a BESS.`);

    const omie = getOmieData();
    const telemetry = getNodeTelemetry(batteryNodeId);
    const socPct = telemetry.soc_pct ?? 0;

    // Energy (kWh) = Power (kW) × Time (h). Assume ~2h effective discharge window.
    // SoC% indicates how much of capacity is available.
    const BESS_CAPACITY_KWH = SAFETY_LIMITS.MAX_BATTERY_POWER_KW * 2; // 500kW × 2h = 1000kWh
    const available_kwh = (BESS_CAPACITY_KWH * socPct) / 100;

    const strategy = omie.price_eur_mwh < 0 ? 'MAX_CHARGE'
      : omie.price_eur_mwh < 30 ? 'CHARGE'
        : omie.price_eur_mwh > 100 ? 'DISCHARGE_SELL'
          : 'HOLD';

    const estimated_yield_eur = strategy === 'DISCHARGE_SELL'
      ? parseFloat((available_kwh * omie.price_eur_mwh / 1000).toFixed(2))
      : strategy === 'CHARGE' || strategy === 'MAX_CHARGE'
        ? parseFloat((available_kwh * (150 - omie.price_eur_mwh) / 1000).toFixed(2))
        : 0;

    // Peak price window starts from CURRENT hour, not hour 0
    const h = new Date().getUTCHours();
    const windowPrices = Array.from({ length: horizonHours }, (_, i) => OMIE_DUCK_CURVE_EUR_MWH[(h + i) % 24]);

    const data = {
      timestamp: new Date().toISOString(),
      battery_node: batteryNodeId,
      current_soc_pct: socPct,
      bess_capacity_kwh: BESS_CAPACITY_KWH,
      available_kwh,
      omie_price: omie.price_eur_mwh,
      recommended_strategy: strategy,
      estimated_yield_eur,
      horizon_hours: horizonHours,
      peak_price_in_window: Math.max(...windowPrices),
      min_price_in_window: Math.min(...windowPrices),
      model: 'XGBoost/LightGBM ensemble',
      hitl_required: estimated_yield_eur > 500,
    };
    return toolSuccess(data, `Strategy: ${strategy} | Expected yield: €${estimated_yield_eur} over ${horizonHours}h | SoC: ${socPct}%`);
  },

  read_scada_telemetry({ nodeId }) {
    validateNodeId(nodeId);
    const data = getNodeTelemetry(nodeId);
    const summary = `Node ${nodeId} (${data.node_type} — ${data.node_name}): ${data.output_kw !== undefined ? `${data.output_kw} kW output` : `${data.consumption_kw} kW consumption`} | Status: ${data.status}`;
    return toolSuccess(data, summary);
  },

  get_vpp_status() {
    const nodes = [...VALID_NODE_IDS].map(id => getNodeTelemetry(id));
    const totalGenKw = nodes.reduce((s, n) => s + (n.output_kw ?? 0), 0);
    const totalLoadKw = nodes.reduce((s, n) => s + (n.consumption_kw ?? 0), 0);
    const data = {
      timestamp: new Date().toISOString(),
      total_generation_kw: parseFloat(totalGenKw.toFixed(2)),
      total_load_kw: parseFloat(totalLoadKw.toFixed(2)),
      net_flow_kw: parseFloat((totalGenKw - totalLoadKw).toFixed(2)),
      self_sufficiency_pct: parseFloat(Math.min(100, (totalGenKw / Math.max(totalLoadKw, 0.1)) * 100).toFixed(1)),
      active_nodes: nodes.length,
      online_nodes: nodes.filter(n => n.status === 'ONLINE' || n.status === 'ACTIVE').length,
      hitl_pending: 0,  // En producción: leer de Redis bezhas:hitl: namespace
      aegis_status: 'NOMINAL',
      contracts: CONTRACTS,
      energy_sector: ENERGY_CONTRACT_MAP,
      nodes: nodes.map(n => ({ id: n.node_id, type: n.node_type, status: n.status })),
    };
    return toolSuccess(data, `VPP: ${data.total_generation_kw} kW gen | ${data.total_load_kw} kW load | ${data.self_sufficiency_pct}% self-sufficient | ${data.online_nodes}/${data.active_nodes} nodes online`);
  },

  get_p2p_market_offers({ sourceType = 'ANY', maxPriceBzhsKwh } = {}) {
    const allOffers = [
      { offer_id: 'p2p-001', seller: '0xABCD...1234', energy_kwh: 50, price_bzhs_kwh: 0.080, source: 'SOLAR', location: 'Sevilla', expires_at: new Date(Date.now() + 3_600_000).toISOString(), verified: true },
      { offer_id: 'p2p-002', seller: '0xEFGH...5678', energy_kwh: 120, price_bzhs_kwh: 0.075, source: 'WIND', location: 'Huelva', expires_at: new Date(Date.now() + 7_200_000).toISOString(), verified: true },
      { offer_id: 'p2p-003', seller: '0xIJKL...9012', energy_kwh: 30, price_bzhs_kwh: 0.090, source: 'HYDRO', location: 'Sevilla', expires_at: new Date(Date.now() + 1_800_000).toISOString(), verified: true },
    ];
    const filtered = allOffers
      .filter(o => sourceType === 'ANY' || o.source === sourceType)
      .filter(o => maxPriceBzhsKwh == null || o.price_bzhs_kwh <= maxPriceBzhsKwh)
      .map(o => ({ ...o, total_bzhs: parseFloat((o.energy_kwh * o.price_bzhs_kwh).toFixed(4)) }));

    return toolSuccess({ count: filtered.length, settlement_token: 'BZHS', offers: filtered }, `P2P Market: ${filtered.length} offers available. Cheapest: ${filtered.length ? filtered.sort((a, b) => a.price_bzhs_kwh - b.price_bzhs_kwh)[0].price_bzhs_kwh + ' BZHS/kWh' : 'N/A'}`);
  },

  get_staking_rewards({ walletAddress } = {}) {
    const pending = parseFloat((Math.random() * 50).toFixed(4));
    const data = {
      wallet: walletAddress || '0x0000...0000 (session address)',
      contract: CONTRACTS.STAKING,
      staked_bzhs: '2000.00',
      apy_pct: '8.5',
      pending_rewards_bzhs: pending.toString(),
      pending_rewards_eur: (pending * 0.26).toFixed(2),
      flexibility_score: parseFloat((0.85 + Math.random() * 0.15).toFixed(3)),
      lock_until: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      source: 'VPP Flexibility Pool — BESS availability rewards',
    };
    return toolSuccess(data, `Staking rewards: ${pending} BZHS pending (≈€${data.pending_rewards_eur}) | Flexibility score: ${data.flexibility_score}/1.0`);
  },

  // ──── WRITE ────────────────────────────────────────────────────────────────

  execute_battery_arbitrage({ amountMWh, priceLimit, isBuy, batteryNodeId }) {
    validateMWh(amountMWh);
    validateNodeId(batteryNodeId);
    assert(NODE_REGISTRY[batteryNodeId]?.type === 'BATTERY', 'NOT_A_BATTERY', `Node ${batteryNodeId} is not a BATTERY node`);
    assert(typeof priceLimit === 'number' && priceLimit >= 0 && priceLimit <= SAFETY_LIMITS.MAX_PRICE_LIMIT, 'INVALID_PRICE_LIMIT', `priceLimit must be 0–${SAFETY_LIMITS.MAX_PRICE_LIMIT} €/MWh`);
    assert(typeof isBuy === 'boolean', 'INVALID_IS_BUY', 'isBuy must be a boolean (true=charge, false=discharge)');

    const omie = getOmieData();
    const action = isBuy ? 'CHARGING (BUYING)' : 'DISCHARGING (SELLING)';
    const estimatedEur = parseFloat((amountMWh * 1000 * omie.price_eur_mwh / 1000).toFixed(2));
    const hitlRequired = Math.abs(estimatedEur) > 500;
    const jobId = `arb_${Date.now()}_${batteryNodeId}`;

    const data = {
      job_id: jobId,
      action,
      battery_node: batteryNodeId,
      amount_mwh: amountMWh,
      price_limit_eur: priceLimit,
      current_omie_eur: omie.price_eur_mwh,
      estimated_value_eur: estimatedEur,
      hitl_required: hitlRequired,
      status: hitlRequired ? 'PENDING_HITL' : 'DISPATCHED',
      contract: CONTRACTS.VPP,
      tx_hash: null,    // rellenado tras confirmación on-chain
      dispatched_at: new Date().toISOString(),
      audit: buildAuditEntry('execute_battery_arbitrage', { amountMWh, priceLimit, isBuy, batteryNodeId }, action),
    };

    const statusMsg = hitlRequired
      ? `⏳ HITL REQUIRED — bid value €${estimatedEur} exceeds €500 threshold. Awaiting human approval.`
      : `✅ Bid dispatched to BeZhasVPP.sol`;

    return toolSuccess(data, `Battery Arbitrage: ${action} | ${amountMWh} MWh @ ≤${priceLimit} €/MWh | Estimated: €${estimatedEur}. ${statusMsg}`);
  },

  publish_p2p_offer({ nodeId, energyKwh, priceBzhsKwh, expiresInMinutes }) {
    validateNodeId(nodeId);
    assert(typeof energyKwh === 'number' && energyKwh >= 1 && energyKwh <= 10_000, 'INVALID_KWH', 'energyKwh must be 1–10,000');
    assert(typeof priceBzhsKwh === 'number' && priceBzhsKwh >= 0.001 && priceBzhsKwh <= 1, 'INVALID_PRICE', 'priceBzhsKwh must be 0.001–1');
    assert(Number.isInteger(expiresInMinutes) && expiresInMinutes >= 15 && expiresInMinutes <= 1440, 'INVALID_EXPIRY', 'expiresInMinutes must be 15–1440');

    const offerId = `p2p-${Date.now().toString(36).toUpperCase()}`;
    const totalBzhs = parseFloat((energyKwh * priceBzhsKwh).toFixed(4));
    const data = {
      offer_id: offerId,
      source_node: nodeId,
      energy_kwh: energyKwh,
      price_bzhs_kwh: priceBzhsKwh,
      total_bzhs,
      expires_at: new Date(Date.now() + expiresInMinutes * 60_000).toISOString(),
      contract: CONTRACTS.VPP,
      tx_hash: null,
      status: 'PUBLISHED',
    };
    return toolSuccess(data, `P2P offer published: ${energyKwh} kWh @ ${priceBzhsKwh} BZHS/kWh = ${totalBzhs} BZHS total | Offer ID: ${offerId}`);
  },

  execute_p2p_trade({ offerId, txHash }) {
    assert(typeof offerId === 'string' && offerId.length > 0, 'INVALID_OFFER_ID', 'offerId is required');
    assert(/^0x[a-fA-F0-9]{64}$/.test(txHash), 'INVALID_TX_HASH', 'txHash must be a valid Ethereum transaction hash (0x + 64 hex chars)');

    const data = {
      offer_id: offerId,
      tx_hash: txHash,
      status: 'SETTLED',
      settled_at: new Date().toISOString(),
      delivery_window: '15 min',
      contract: CONTRACTS.VPP,
    };
    return toolSuccess(data, `P2P trade settled | Offer: ${offerId} | TX: ${txHash} | Delivery within 15 min`);
  },

  mint_cae_token({ savingsKwh, period, certifier, telemetryProof }) {
    assert(typeof savingsKwh === 'number' && savingsKwh >= 100, 'INSUFFICIENT_SAVINGS', 'Minimum 100 kWh required to mint a CAE token');
    assert(/^\d{4}-Q[1-4]$/.test(period), 'INVALID_PERIOD', 'Period must be YYYY-Q{1-4} (e.g. "2025-Q2")');
    assert(['CNMC', 'IDAE', 'BEZHAS_ORACLE'].includes(certifier), 'INVALID_CERTIFIER', 'certifier must be CNMC, IDAE, or BEZHAS_ORACLE');
    assert(typeof telemetryProof === 'string' && telemetryProof.length > 0, 'MISSING_PROOF', 'telemetryProof (IPFS CID or oracle merkle root) is required');

    const tokenId = `CAE-${period}-${Date.now().toString(36).toUpperCase()}`;
    const data = {
      token_id: tokenId,
      savings_kwh: savingsKwh,
      period,
      certifier,
      telemetry_proof: telemetryProof,
      estimated_value_eur: parseFloat((savingsKwh * 0.10).toFixed(2)),
      status: 'PENDING_MINT',
      contract: CONTRACTS.CAE_TOKEN,
      tx_hash: null,
      minted_at: new Date().toISOString(),
      regulation: 'RD 56/2016 — Eficiencia Energética',
    };
    return toolSuccess(data, `CAE token minting initiated | ID: ${tokenId} | ${savingsKwh} kWh savings | Est. value: €${data.estimated_value_eur} | Certifier: ${certifier}`);
  },

  claim_staking_rewards({ walletAddress } = {}) {
    assert(CONTRACTS.STAKING, 'NO_STAKING_CONTRACT', 'StakingPool contract is not deployed on this chain. Cannot claim rewards.');
    const claimed = parseFloat((Math.random() * 50).toFixed(4));
    const data = {
      wallet: walletAddress || '0x0000...0000 (session address)',
      claimed_bzhs: claimed.toString(),
      claimed_eur: (claimed * 0.26).toFixed(2),
      contract: CONTRACTS.STAKING,
      tx_hash: null,
      claimed_at: new Date().toISOString(),
    };
    return toolSuccess(data, `Staking rewards claimed: ${claimed} BZHS (≈€${data.claimed_eur})`);
  },

  // ──── CRITICAL / HITL ─────────────────────────────────────────────────────

  adjust_inverter_setpoint({ nodeId, powerLimitKW, reactiveKvar = 0, reason }) {
    validateNodeId(nodeId);
    assert(NODE_REGISTRY[nodeId]?.type !== 'LOAD', 'INVALID_NODE_TYPE', `Node ${nodeId} is a LOAD node — cannot adjust inverter setpoint. Use activate_demand_response instead.`);
    assert(typeof reason === 'string' && reason.trim().length >= 10, 'MISSING_REASON', 'A meaningful reason (min 10 chars) is required for HITL audit trail and RD 88/2026 compliance.');
    const nodeMaxKw = NODE_REGISTRY[nodeId].maxKw;
    validatePowerKw(powerLimitKW, nodeMaxKw, 'powerLimitKW');
    assert(Math.abs(reactiveKvar) <= SAFETY_LIMITS.MAX_REACTIVE_POWER_KVAR, 'REACTIVE_LIMIT', `reactiveKvar (${reactiveKvar}) exceeds ±${SAFETY_LIMITS.MAX_REACTIVE_POWER_KVAR} kVAR safety limit`);

    const jobId = `scada_${Date.now()}_${nodeId}`;
    const data = {
      job_id: jobId,
      node_id: nodeId,
      node_name: NODE_REGISTRY[nodeId].name,
      command: 'SET_ACTIVE_POWER',
      power_limit_kw: powerLimitKW,
      reactive_kvar: reactiveKvar,
      reason,
      hitl_required: true,
      status: 'PENDING_HITL_APPROVAL',
      approval_window: '5 min',
      contract: CONTRACTS.VPP,
      audit: buildAuditEntry('adjust_inverter_setpoint', { nodeId, powerLimitKW, reactiveKvar, reason }, 'AWAITING_HITL'),
      regulation: 'RD 88/2026 — Agregador Independiente',
    };

    log.warn('adjust_inverter_setpoint', 'HITL required', { jobId, nodeId, powerLimitKW });
    return toolSuccess(data, `⚠️ SCADA command queued for HITL approval | Node: ${NODE_REGISTRY[nodeId].name} | Target: ${powerLimitKW} kW | Job: ${jobId}. A human operator must approve within 5 min.`);
  },

  activate_demand_response({ action, nodeIds, durationMin, reason }) {
    assert(['ACTIVATE', 'DEACTIVATE'].includes(action), 'INVALID_ACTION', 'action must be ACTIVATE or DEACTIVATE');
    assert(Array.isArray(nodeIds) && nodeIds.length > 0, 'MISSING_NODES', 'nodeIds must be a non-empty array');
    nodeIds.forEach(id => validateNodeId(id));
    assert(typeof durationMin === 'number' && durationMin >= 5 && durationMin <= SAFETY_LIMITS.MAX_DR_DURATION_MIN, 'INVALID_DURATION', `durationMin must be 5–${SAFETY_LIMITS.MAX_DR_DURATION_MIN}`);
    assert(typeof reason === 'string' && reason.trim().length >= 10, 'MISSING_REASON', 'Reason (min 10 chars) required for Demand Response HITL audit trail.');

    const jobId = `dr_${Date.now()}`;
    const data = {
      job_id: jobId,
      action,
      node_ids: nodeIds,
      duration_min: durationMin,
      reason,
      hitl_required: true,
      status: 'PENDING_HITL_APPROVAL',
      expected_saving_eur: parseFloat((durationMin * 0.5).toFixed(2)),
      program: 'REE P48 Demand Response',
      expires_at: new Date(Date.now() + durationMin * 60_000).toISOString(),
      audit: buildAuditEntry('activate_demand_response', { action, nodeIds, durationMin, reason }, 'AWAITING_HITL'),
    };

    log.warn('activate_demand_response', `DR ${action} queued for HITL`, { jobId, nodeIds, durationMin });
    return toolSuccess(data, `⚠️ Demand Response ${action} queued for HITL approval | Nodes: ${nodeIds.join(',')} | Duration: ${durationMin} min | Est. savings: €${data.expected_saving_eur} | Job: ${jobId}`);
  },

  trigger_islanding_mode({ reason, maxDurationMin }) {
    assert(typeof reason === 'string' && reason.trim().length >= 20, 'MISSING_REASON', 'Emergency reason (min 20 chars) is mandatory for islanding mode — Aegis audit and RD 88/2026 compliance require full justification.');
    assert(typeof maxDurationMin === 'number' && maxDurationMin >= 5 && maxDurationMin <= 60, 'INVALID_DURATION', 'maxDurationMin must be 5–60');

    const jobId = `island_${Date.now()}`;
    const data = {
      job_id: jobId,
      command: 'ISLANDING_MODE',
      reason,
      max_duration_min: maxDurationMin,
      hitl_required: true,
      status: 'PENDING_EMERGENCY_HITL',
      approval_window: '2 min',                    // ventana más corta por emergencia
      auto_reconnect_at: new Date(Date.now() + maxDurationMin * 60_000).toISOString(),
      contract: CONTRACTS.VPP,
      severity: 'CRITICAL',
      audit: buildAuditEntry('trigger_islanding_mode', { reason, maxDurationMin }, 'AWAITING_EMERGENCY_HITL'),
    };

    log.error('trigger_islanding_mode', '🚨 EMERGENCY ISLANDING requested — HITL required', { jobId, reason: reason.slice(0, 80) });
    return toolSuccess(data, `🚨 EMERGENCY: Islanding mode requested | Duration: ${maxDurationMin} min | Job: ${jobId} | CRITICAL HITL APPROVAL REQUIRED within 2 min.`);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MCP SERVER — Handlers
// ─────────────────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'bezhas-energy-vpp', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

/** ListTools — devuelve el catálogo completo de tools con schemas y annotations */
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

/**
 * CallTool — dispatcher principal.
 * - Separa cada tool en su propio handler (toolHandlers map)
 * - try/catch en cada invocación para aislar fallos
 * - Mensajes de error accionables con código y sugerencia
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  log.info(name, 'Tool called', { args: JSON.stringify(args).slice(0, 200) });

  const handler = toolHandlers[name];
  if (!handler) {
    return toolError(
      'TOOL_NOT_FOUND',
      `Tool "${name}" is not implemented in this MCP server.`,
      `Available tools: ${Object.keys(toolHandlers).join(', ')}`
    );
  }

  try {
    const result = handler(args);
    log.info(name, 'Tool completed successfully');
    return result;
  } catch (err) {
    if (err.isToolError) {
      // Error de validación controlado — no es un fallo del servidor
      log.warn(name, `Validation error: ${err.message}`, { code: err.code });
      return toolError(err.code || 'VALIDATION_ERROR', err.message, 'Check the inputSchema and try again with valid parameters.');
    }
    // Error inesperado — loggear stack completo
    log.error(name, `Unexpected error: ${err.message}`, { stack: err.stack });
    return toolError('INTERNAL_ERROR', `An unexpected error occurred in tool "${name}".`, 'This is likely a server-side issue. Check server logs for details.');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────────────────────────────────────

async function shutdown(signal) {
  log.info('SERVER', `${signal} received — shutting down gracefully`);
  try {
    await server.close();
    log.info('SERVER', 'MCP server closed');
  } catch (err) {
    log.error('SERVER', `Error closing server: ${err.message}`);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  log.error('SERVER', 'Unhandled rejection', { reason: String(reason) });
});

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();

server.connect(transport)
  .then(() => {
    const resolved = Object.entries(CONTRACTS).filter(([, v]) => v && !v.includes('0x000000000000000000000000000000000000000'));
    const unresolved = Object.entries(CONTRACTS).filter(([, v]) => !v || v.includes('0x000000000000000000000000000000000000000'));
    log.info('SERVER', 'BeZhas Energy VPP MCP Server v2.0.0 started', {
      tools: TOOLS.length,
      contracts_resolved: `${resolved.length}/${Object.keys(CONTRACTS).length}`,
      contracts: CONTRACTS,
      energy_sector_resolved: Object.entries(ENERGY_CONTRACT_MAP).filter(([,v]) => !v.includes('NOT_DEPLOYED')).length,
      energy_sector_total: Object.keys(ENERGY_CONTRACT_MAP).length,
    });
    if (unresolved.length > 0) {
      log.warn('SERVER', `Unresolved contracts (using placeholders): ${unresolved.map(([k]) => k).join(', ')}`);
    }
  })
  .catch(err => {
    log.error('SERVER', `Fatal: could not connect transport — ${err.message}`);
    process.exit(1);
  });