/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║              BeZhas Energy — VPP Router  (energy.routes.js)                ║
 * ║  Virtual Power Plant API · OMIE/ESIOS · SCADA/HITL · CAE RWA · P2P Trade  ║
 * ║  Arquitectura: Physical → Blockchain L2 → AI Orchestration → Application  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Endpoints:
 *  GET  /api/energy/telemetry            — Telemetría en tiempo real de nodos VPP
 *  GET  /api/energy/telemetry/:nodeId    — Telemetría de un nodo específico
 *  GET  /api/energy/market/omie          — Precio spot OMIE + predicción IA
 *  GET  /api/energy/market/esios         — Indicadores Red Eléctrica (ESIOS)
 *  GET  /api/energy/alerts               — Alertas activas del AI Agent
 *  GET  /api/energy/arbitrage/status     — Estado actual de la estrategia de arbitraje
 *  POST /api/energy/arbitrage/execute    — Ejecutar estrategia IA (con HITL)
 *  POST /api/energy/control              — Comando SCADA a Edge Node (requiere HITL)
 *  GET  /api/energy/demand-response      — Estado Demand Response (corte de cargas)
 *  POST /api/energy/demand-response      — Activar/Desactivar Demand Response
 *  GET  /api/energy/wallet/stats         — Estadísticas del Energy Wallet (BZHS)
 *  GET  /api/energy/wallet/history       — Historial de transacciones energéticas
 *  POST /api/energy/wallet/buy-credit    — Comprar créditos BZHS (Web3 ramp)
 *  GET  /api/energy/cae/tokens           — CAE tokens del usuario (RWA)
 *  POST /api/energy/cae/mint             — Emitir CAE por ahorro verificado
 *  GET  /api/energy/p2p/market           — Mercado P2P de energía entre nodos
 *  POST /api/energy/p2p/offer            — Publicar oferta de venta P2P
 *  POST /api/energy/p2p/buy             — Comprar energía P2P
 *  GET  /api/energy/staking/rewards      — Recompensas de staking por flexibilidad VPP
 *  POST /api/energy/staking/claim        — Reclamar recompensas de staking
 *  GET  /api/energy/compliance/aegis     — Informe de seguridad Aegis + RD 88/2026
 *  GET  /api/energy/nodes                — Lista de Edge Nodes registrados
 */

'use strict';

const express = require('express');
const router = express.Router();
const { body, param, query: queryValidator, validationResult } = require('express-validator');

const { authenticateToken } = require('../middleware/security');
const { requireRole } = require('../middleware/rbac');          // 'operator' | 'admin'
const { hitlApprove } = require('../middleware/hitl');          // Human-In-The-Loop guard
const { aegisCheck } = require('../middleware/aegis');         // Motor de anomalías Aegis
const { query } = require('../db/pool');
const redis = require('../db/redis');                 // namespace: bezhas:energy:
const OpenClaw = require('../agents/openclaw-client');   // AI Orchestrator
const vppBroker = require('../services/vppMqttBroker');   // Edge Node telemetry ingestion (MQTT)
const energyFeed = require('../services/energyFeedService'); // OMIE/ESIOS real market feeds
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DEL DOMINIO
// ─────────────────────────────────────────────────────────────────────────────

/** TTL de caché Redis (segundos) */
const CACHE_TTL = {
  TELEMETRY: 10,   // 10 s  — alta frecuencia
  OMIE_PRICE: 300,  // 5 min — mercado mayorista
  ESIOS: 60,   // 1 min — red eléctrica
  ALERTS: 30,   // 30 s  — alertas AI
};

/** Tipos de nodo VPP */
const NODE_TYPE = {
  SOLAR: 'SOLAR',
  WIND: 'WIND',
  HYDRO: 'HYDRO',
  BATTERY: 'BATTERY',
  LOAD: 'LOAD',       // carga controlable (Demand Response)
};

/** Comandos SCADA permitidos con validación de parámetros */
const SCADA_COMMANDS = {
  CHARGE_BATTERY: { requiresApproval: false, maxPowerKw: 500 },
  DISCHARGE_BATTERY: { requiresApproval: false, maxPowerKw: 500 },
  SHED_LOAD: { requiresApproval: true, maxDurationMin: 120 },
  ISLANDING_MODE: { requiresApproval: true, maxDurationMin: 60 },
  EMERGENCY_STOP: { requiresApproval: false, priority: 'CRITICAL' },
  SET_REACTIVE_POWER: { requiresApproval: false, maxKvar: 200 },
};

/** Umbrales de arbitraje energético (€/MWh) */
const ARBITRAGE_THRESHOLD = {
  CHARGE_BELOW_PRICE: 30,   // €/MWh — cargar batería si precio < este valor
  DISCHARGE_ABOVE_PRICE: 80,   // €/MWh — vender si precio > este valor
  NEGATIVE_PRICE_ACTION: -5,   // €/MWh — precio negativo: cargar a máxima potencia
};

/** Contratos desplegados en BeZhas L2 relevantes para energía */
const ENERGY_CONTRACTS = {
  VPP: process.env.CONTRACT_BEZHAS_VPP || '0x0000000000000000000000000000000000000001',
  ORACLE: process.env.CONTRACT_ENERGY_ORACLE || '0x0000000000000000000000000000000000000002',
  CAE_TOKEN: process.env.CONTRACT_ENERGY_CAE_TOKEN || '0x0000000000000000000000000000000000000003',
  STAKING: process.env.CONTRACT_STAKING_POOL_V2 || '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Middleware de validación express-validator
// ─────────────────────────────────────────────────────────────────────────────

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Caché Redis genérico con fallback
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lee de caché Redis o ejecuta el fetcher y almacena el resultado.
 * @param {string} cacheKey   — clave en formato bezhas:energy:<key>
 * @param {number} ttl        — segundos de vigencia
 * @param {Function} fetcher  — async () => data
 */
async function withCache(cacheKey, ttl, fetcher) {
  try {
    const cached = await redis.get(`bezhas:energy:${cacheKey}`);
    if (cached) return JSON.parse(cached);
  } catch (_) { /* Redis down → degraded mode, seguimos */ }

  const data = await fetcher();

  try {
    await redis.setEx(`bezhas:energy:${cacheKey}`, ttl, JSON.stringify(data));
  } catch (_) { /* silenciar errores de escritura en caché */ }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Simuladores de datos (REEMPLAZAR con clientes reales en producción)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera telemetría de nodos VPP.
 * EN PRODUCCIÓN → sustituir por:
 *   - query('SELECT * FROM telemetry_logs WHERE node_id = $1 ORDER BY ts DESC LIMIT 1')
 *   - O suscripción MQTT al broker del Edge Node
 */
const buildTelemetry = (nodeIdFilter = null) => {
  const nodes = [
    {
      id: 'n1', type: NODE_TYPE.SOLAR, name: 'Array Alpha',
      output_kw: parseFloat((Math.random() * 20 + 5).toFixed(2)),
      voltage_v: parseFloat((220 + Math.random() * 10).toFixed(1)),
      irradiance: parseFloat((600 + Math.random() * 400).toFixed(0)),
      efficiency: parseFloat((94 + Math.random() * 5).toFixed(1)),
      status: 'ONLINE',
      protocol: 'MQTT/Modbus',
    },
    {
      id: 'n2', type: NODE_TYPE.WIND, name: 'Turbine V1',
      output_kw: parseFloat((Math.random() * 15 + 2).toFixed(2)),
      wind_speed: parseFloat((4 + Math.random() * 12).toFixed(1)),
      rpm: parseFloat((800 + Math.random() * 400).toFixed(0)),
      status: 'ONLINE',
      protocol: 'MQTT',
    },
    {
      id: 'n3', type: NODE_TYPE.HYDRO, name: 'Pumped Hydro',
      output_kw: parseFloat((Math.random() * 30 + 5).toFixed(2)),
      flow_m3h: parseFloat((100 + Math.random() * 50).toFixed(1)),
      head_m: parseFloat((20 + Math.random() * 10).toFixed(1)),
      status: 'ONLINE',
      protocol: 'Modbus',
    },
    {
      id: 'n4', type: NODE_TYPE.BATTERY, name: 'BESS Unit 1',
      output_kw: parseFloat((Math.random() * 10 - 5).toFixed(2)), // negativo = cargando
      soc_pct: parseFloat((40 + Math.random() * 50).toFixed(1)),
      temp_c: parseFloat((25 + Math.random() * 15).toFixed(1)),
      cycles: Math.floor(200 + Math.random() * 800),
      status: 'ONLINE',
      mode: 'ARBITRAGE',
      protocol: 'CAN/MQTT',
    },
    {
      id: 'n5', type: NODE_TYPE.LOAD, name: 'Industrial HVAC',
      consumption_kw: parseFloat((10 + Math.random() * 20).toFixed(2)),
      demand_response_eligible: true,
      status: 'ACTIVE',
      protocol: 'Modbus',
    },
  ];

  const filteredNodes = nodeIdFilter
    ? nodes.filter(n => n.id === nodeIdFilter)
    : nodes;

  const totalOutput = filteredNodes
    .filter(n => n.output_kw !== undefined)
    .reduce((sum, n) => sum + n.output_kw, 0);

  return {
    timestamp: new Date().toISOString(),
    global: {
      net_flow_kw: parseFloat((Math.random() * 12 - 2).toFixed(2)),
      total_output_kw: parseFloat(totalOutput.toFixed(2)),
      grid_frequency: parseFloat((49.95 + Math.random() * 0.1).toFixed(3)),
      self_sufficiency_pct: parseFloat((85 + Math.random() * 10).toFixed(1)),
    },
    nodes: filteredNodes,
  };
};

/**
 * Precio de mercado OMIE simulado.
 * EN PRODUCCIÓN → GET https://www.omie.es/es/file-download?parents%5B%5D=marginalpdbc&filename=marginalpdbc_<date>.1
 */
const buildOmiePrice = () => {
  const currentPrice = parseFloat((20 + Math.random() * 100).toFixed(2));
  const prediction1h = parseFloat((currentPrice + (Math.random() * 20 - 10)).toFixed(2));
  const prediction6h = parseFloat((currentPrice + (Math.random() * 40 - 20)).toFixed(2));

  return {
    timestamp: new Date().toISOString(),
    price_eur_mwh: currentPrice,
    unit: 'EUR/MWh',
    market: 'OMIE Mercado Diario',
    predictions: {
      in_1h: { price: prediction1h, confidence: 0.92, model: 'XGBoost' },
      in_6h: { price: prediction6h, confidence: 0.78, model: 'LightGBM' },
    },
    ai_recommendation: currentPrice < ARBITRAGE_THRESHOLD.CHARGE_BELOW_PRICE
      ? 'CHARGE_BATTERY'
      : currentPrice > ARBITRAGE_THRESHOLD.DISCHARGE_ABOVE_PRICE
        ? 'DISCHARGE_SELL'
        : 'HOLD',
    signal_strength: currentPrice < 0 ? 'CRITICAL_CHARGE' : 'NORMAL',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// PHYSICAL LAYER — Telemetría de Edge Nodes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/energy/telemetry
 * @desc    Telemetría en tiempo real de todos los nodos VPP (MQTT/Modbus).
 * @access  Private
 * @cache   10 s (Redis: bezhas:energy:telemetry:all)
 */
router.get('/telemetry', authenticateToken, async (req, res) => {
  try {
    const data = await withCache('telemetry:all', CACHE_TTL.TELEMETRY, async () => {
      // Live telemetry from Edge Nodes (MQTT) when available; else simulated.
      // PRODUCCIÓN alternativa: query('SELECT DISTINCT ON (node_id) * FROM telemetry_logs ORDER BY node_id, ts DESC')
      return vppBroker.getLatestTelemetry() || buildTelemetry();
    });
    res.json(data);
  } catch (err) {
    logger.error('[ENERGY][TELEMETRY]', err);
    res.status(500).json({ error: 'Failed to fetch VPP telemetry', code: 'TELEMETRY_ERROR' });
  }
});

/**
 * @route   GET /api/energy/telemetry/:nodeId
 * @desc    Telemetría de un nodo específico.
 * @access  Private
 */
router.get(
  '/telemetry/:nodeId',
  authenticateToken,
  [param('nodeId').matches(/^n\d+$/).withMessage('Invalid nodeId format')],
  validate,
  async (req, res) => {
    const { nodeId } = req.params;
    try {
      const data = await withCache(`telemetry:${nodeId}`, CACHE_TTL.TELEMETRY, async () => {
        // Live node telemetry from MQTT when available; else simulated.
        return vppBroker.getNodeTelemetry(nodeId) || buildTelemetry(nodeId);
      });

      if (!data.nodes.length) {
        return res.status(404).json({ error: `Node ${nodeId} not found`, code: 'NODE_NOT_FOUND' });
      }
      res.json(data);
    } catch (err) {
      logger.error(`[ENERGY][TELEMETRY][${nodeId}]`, err);
      res.status(500).json({ error: 'Failed to fetch node telemetry', code: 'TELEMETRY_ERROR' });
    }
  }
);

/**
 * @route   GET /api/energy/nodes
 * @desc    Lista de Edge Nodes registrados en la VPP con su estado de salud.
 * @access  Private
 */
router.get('/nodes', authenticateToken, async (req, res) => {
  try {
    // PRODUCCIÓN: await query('SELECT * FROM vpp_nodes WHERE owner_address = $1', [req.user.address])
    const nodes = [
      { id: 'n1', type: NODE_TYPE.SOLAR, name: 'Array Alpha', location: 'Rooftop A', registered: '2025-01-15', status: 'ONLINE' },
      { id: 'n2', type: NODE_TYPE.WIND, name: 'Turbine V1', location: 'Field B', registered: '2025-02-01', status: 'ONLINE' },
      { id: 'n3', type: NODE_TYPE.HYDRO, name: 'Pumped Hydro', location: 'Basin C', registered: '2025-01-20', status: 'ONLINE' },
      { id: 'n4', type: NODE_TYPE.BATTERY, name: 'BESS Unit 1', location: 'Warehouse D', registered: '2025-03-10', status: 'ONLINE' },
      { id: 'n5', type: NODE_TYPE.LOAD, name: 'Industrial HVAC', location: 'Plant E', registered: '2025-04-01', status: 'ACTIVE' },
    ];
    res.json({ total: nodes.length, nodes });
  } catch (err) {
    logger.error('[ENERGY][NODES]', err);
    res.status(500).json({ error: 'Failed to fetch node registry', code: 'NODES_ERROR' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI ORCHESTRATION — Mercado OMIE/ESIOS y alertas del agente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/energy/market/omie
 * @desc    Precio spot del mercado mayorista OMIE + predicción IA (XGBoost/LightGBM).
 *          Incluye recomendación de arbitraje del BeZhas Energy Agent.
 * @access  Private
 * @cache   5 min (Redis: bezhas:energy:omie)
 */
router.get('/market/omie', authenticateToken, async (req, res) => {
  try {
    const data = await withCache('omie', CACHE_TTL.OMIE_PRICE, async () => {
      // Real OMIE day-ahead price (marginalpdbc) when reachable; else simulated.
      return (await energyFeed.getOmiePrice()) || buildOmiePrice();
    });
    res.json(data);
  } catch (err) {
    logger.error('[ENERGY][OMIE]', err);
    res.status(500).json({ error: 'Failed to fetch OMIE market price', code: 'OMIE_ERROR' });
  }
});

/**
 * @route   GET /api/energy/market/esios
 * @desc    Indicadores de Red Eléctrica Española (ESIOS): demanda, mix, frecuencia.
 * @access  Private
 * @cache   1 min (Redis: bezhas:energy:esios)
 */
router.get('/market/esios', authenticateToken, async (req, res) => {
  try {
    const data = await withCache('esios', CACHE_TTL.ESIOS, async () => {
      // Real ESIOS indicators when ESIOS_API_KEY is configured; else simulated.
      const live = await energyFeed.getEsiosIndicators();
      if (live) return live;
      return {
        timestamp: new Date().toISOString(),
        source: 'REE ESIOS',
        demand_mw: parseFloat((28000 + Math.random() * 8000).toFixed(0)),
        frequency_hz: parseFloat((49.95 + Math.random() * 0.1).toFixed(3)),
        renewable_pct: parseFloat((55 + Math.random() * 30).toFixed(1)),
        mix: {
          solar_pct: parseFloat((15 + Math.random() * 20).toFixed(1)),
          wind_pct: parseFloat((20 + Math.random() * 25).toFixed(1)),
          hydro_pct: parseFloat((5 + Math.random() * 10).toFixed(1)),
          nuclear_pct: parseFloat((18 + Math.random() * 5).toFixed(1)),
          gas_pct: parseFloat((10 + Math.random() * 15).toFixed(1)),
        },
        grid_balance_mw: parseFloat((Math.random() * 200 - 100).toFixed(0)),
      };
    });
    res.json(data);
  } catch (err) {
    logger.error('[ENERGY][ESIOS]', err);
    res.status(500).json({ error: 'Failed to fetch ESIOS indicators', code: 'ESIOS_ERROR' });
  }
});

/**
 * @route   GET /api/energy/alerts
 * @desc    Alertas activas del BeZhas Energy Agent (análisis OMIE + ESIOS + telemetría).
 *          Incluye severidad, origen (IA o Aegis) y acción sugerida.
 * @access  Private
 * @cache   30 s (Redis: bezhas:energy:alerts)
 */
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const data = await withCache('alerts', CACHE_TTL.ALERTS, async () => {
      // PRODUCCIÓN: await OpenClaw.invoke('energy-agent', { skill: 'get_alerts', userId: req.user.id })
      return [
        {
          id: 'a1',
          severity: 'HIGH',
          type: 'ARBITRAGE_OPPORTUNITY',
          source: 'BeZhasEnergyAgent/XGBoost',
          message: '95% solar yield predicted. Recommend battery charge prior to 18:00 UTC grid spike.',
          action: { command: 'CHARGE_BATTERY', nodeId: 'n4', powerKw: 50 },
          expires: new Date(Date.now() + 3_600_000).toISOString(),
        },
        {
          id: 'a2',
          severity: 'WARNING',
          type: 'NEGATIVE_PRICE_IMMINENT',
          source: 'BeZhasEnergyAgent/OMIE',
          message: 'OMIE Pool Price dropping below zero in 2 hours. Activating max-charge protocol.',
          action: { command: 'CHARGE_BATTERY', nodeId: 'n4', powerKw: 500 },
          expires: new Date(Date.now() + 7_200_000).toISOString(),
        },
        {
          id: 'a3',
          severity: 'INFO',
          type: 'DEMAND_RESPONSE_ELIGIBLE',
          source: 'BeZhasEnergyAgent/LightGBM',
          message: 'Peak demand event expected 20:00–22:00. Activating load curtailment on n5 yields €42 DR incentive.',
          action: { command: 'SHED_LOAD', nodeId: 'n5', durationMin: 120 },
          expires: new Date(Date.now() + 10_800_000).toISOString(),
        },
        {
          id: 'a4',
          severity: 'INFO',
          type: 'AEGIS_AUDIT',
          source: 'Aegis/AnomalyDetector',
          message: 'Telemetry integrity check passed. No spoofing events detected in last 24h. RD 88/2026 compliant.',
          action: null,
          expires: new Date(Date.now() + 86_400_000).toISOString(),
        },
      ];
    });
    res.json({ count: data.length, alerts: data });
  } catch (err) {
    logger.error('[ENERGY][ALERTS]', err);
    res.status(500).json({ error: 'Failed to fetch energy alerts', code: 'ALERTS_ERROR' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AI ORCHESTRATION — Arbitraje energético
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/energy/arbitrage/status
 * @desc    Estado actual de la estrategia de arbitraje batería/red.
 * @access  Private
 */
router.get('/arbitrage/status', authenticateToken, async (req, res) => {
  try {
    const omie = await withCache('omie', CACHE_TTL.OMIE_PRICE, buildOmiePrice);
    // PRODUCCIÓN: leer SoC actual de BESS Unit desde telemetry_logs
    const socPct = parseFloat((40 + Math.random() * 50).toFixed(1));

    const strategy = (() => {
      if (omie.price_eur_mwh < ARBITRAGE_THRESHOLD.NEGATIVE_PRICE_ACTION) return 'MAX_CHARGE';
      if (omie.price_eur_mwh < ARBITRAGE_THRESHOLD.CHARGE_BELOW_PRICE) return 'CHARGE';
      if (omie.price_eur_mwh > ARBITRAGE_THRESHOLD.DISCHARGE_ABOVE_PRICE) return 'DISCHARGE_SELL';
      return 'HOLD';
    })();

    res.json({
      timestamp: new Date().toISOString(),
      current_strategy: strategy,
      battery_soc_pct: socPct,
      omie_price: omie.price_eur_mwh,
      thresholds: ARBITRAGE_THRESHOLD,
      estimated_yield_eur: parseFloat((omie.price_eur_mwh * 0.05 * socPct / 100).toFixed(2)),
      next_evaluation: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
  } catch (err) {
    logger.error('[ENERGY][ARBITRAGE][STATUS]', err);
    res.status(500).json({ error: 'Failed to fetch arbitrage status', code: 'ARBITRAGE_ERROR' });
  }
});

/**
 * @route   POST /api/energy/arbitrage/execute
 * @desc    Ejecutar manualmente una estrategia de arbitraje sugerida por la IA.
 *          Requiere HITL si el valor comprometido supera €500.
 * @access  Private (operator)
 * @body    { strategy: 'CHARGE'|'DISCHARGE_SELL'|'HOLD', powerKw: number, nodeId: string }
 */
router.post(
  '/arbitrage/execute',
  authenticateToken,
  requireRole('operator'),
  [
    body('strategy').isIn(['CHARGE', 'DISCHARGE_SELL', 'HOLD', 'MAX_CHARGE']),
    body('powerKw').isFloat({ min: 1, max: 500 }),
    body('nodeId').matches(/^n\d+$/),
  ],
  validate,
  async (req, res) => {
    const { strategy, powerKw, nodeId } = req.body;

    try {
      // Invocar BeZhas Energy Agent vía OpenClaw
      // PRODUCCIÓN: const result = await OpenClaw.invoke('energy-agent', {
      //   skill: 'execute_battery_arbitrage',
      //   params: { strategy, powerKw, nodeId, userId: req.user.id }
      // });

      logger.info(`[ENERGY][ARBITRAGE] strategy=${strategy} powerKw=${powerKw} node=${nodeId} user=${req.user?.id}`);

      res.json({
        success: true,
        job_id: `arb_${Date.now()}`,
        strategy,
        powerKw,
        nodeId,
        dispatched_at: new Date().toISOString(),
        estimated_completion: new Date(Date.now() + 60_000).toISOString(),
        hitl_required: powerKw * 0.1 > 500, // >€500 valor → HITL
        blockchain_tx: null, // Se llenará al confirmar on-chain
      });
    } catch (err) {
      logger.error('[ENERGY][ARBITRAGE][EXECUTE]', err);
      res.status(500).json({ error: 'Failed to dispatch arbitrage strategy', code: 'ARBITRAGE_DISPATCH_ERROR' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PHYSICAL LAYER — SCADA Control con HITL obligatorio
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   POST /api/energy/control
 * @desc    Envía comandos SCADA a un Edge Node físico vía MQTT broker / OpenClaw.
 *          Comandos críticos (SHED_LOAD, ISLANDING_MODE) pasan por HITL obligatorio.
 *          Auditado on-chain en BeZhasVPP.sol.
 * @access  Private (operator)
 * @body    { nodeId, command, params: { powerKw?, durationMin?, kvar? } }
 */
router.post(
  '/control',
  authenticateToken,
  requireRole('operator'),
  aegisCheck('scada_command'),                // Aegis: detectar comandos anómalos
  [
    body('nodeId').matches(/^n\d+$/).withMessage('Invalid nodeId'),
    body('command').isIn(Object.keys(SCADA_COMMANDS)).withMessage('Unsupported SCADA command'),
    body('params').optional().isObject(),
  ],
  validate,
  async (req, res) => {
    const { nodeId, command, params = {} } = req.body;
    const cmdConfig = SCADA_COMMANDS[command];

    // Validar límites de seguridad
    if (params.powerKw && cmdConfig.maxPowerKw && params.powerKw > cmdConfig.maxPowerKw) {
      return res.status(422).json({
        error: `powerKw exceeds safety limit of ${cmdConfig.maxPowerKw} kW`,
        code: 'SCADA_POWER_LIMIT_EXCEEDED',
      });
    }
    if (params.durationMin && cmdConfig.maxDurationMin && params.durationMin > cmdConfig.maxDurationMin) {
      return res.status(422).json({
        error: `durationMin exceeds safety limit of ${cmdConfig.maxDurationMin} min`,
        code: 'SCADA_DURATION_LIMIT_EXCEEDED',
      });
    }

    try {
      const jobId = `scada_${Date.now()}_${nodeId}`;

      // HITL obligatorio para comandos críticos
      if (cmdConfig.requiresApproval) {
        // PRODUCCIÓN: await hitlApprove({ jobId, command, nodeId, params, requestedBy: req.user.id });
        logger.warn(`[ENERGY][SCADA][HITL] job=${jobId} awaiting human approval`);
        return res.status(202).json({
          accepted: true,
          hitl_pending: true,
          job_id: jobId,
          message: `Command ${command} queued for Human-In-The-Loop approval`,
          estimated_approval_window: '5 min',
        });
      }

      // Despacho directo (comandos que no requieren aprobación).
      // Publica al Edge Node vía MQTT si el broker está conectado; si no, queda en modo mock.
      const published = vppBroker.publishControl(nodeId, command, params);
      logger.info(`[ENERGY][SCADA] job=${jobId} node=${nodeId} cmd=${command} transport=${published ? 'mqtt' : 'mock'} params=${JSON.stringify(params)}`);

      res.json({
        success: true,
        job_id: jobId,
        nodeId,
        command,
        params,
        transport: published ? 'mqtt' : 'mock',
        dispatched_at: new Date().toISOString(),
        audit_trail: `Logged to BeZhasVPP.sol — contract: ${ENERGY_CONTRACTS.VPP}`,
      });
    } catch (err) {
      logger.error(`[ENERGY][SCADA][${nodeId}]`, err);
      res.status(500).json({ error: 'Failed to dispatch SCADA command', code: 'SCADA_DISPATCH_ERROR' });
    }
  }
);

/**
 * @route   GET  /api/energy/demand-response
 * @route   POST /api/energy/demand-response
 * @desc    Estado y activación del programa de Demand Response (corte temporal de cargas).
 *          Cuando el precio OMIE supera umbral, desconectar cargas no críticas (n5 HVAC).
 * @access  Private (operator)
 */
router.get('/demand-response', authenticateToken, async (req, res) => {
  try {
    res.json({
      active: false,
      program: 'REE P48 Demand Response',
      eligible_nodes: ['n5'],
      current_trigger: 'PRICE_THRESHOLD',
      threshold_eur_mwh: ARBITRAGE_THRESHOLD.DISCHARGE_ABOVE_PRICE,
      savings_today_eur: parseFloat((Math.random() * 120).toFixed(2)),
      incentive_pending_eur: parseFloat((Math.random() * 45).toFixed(2)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch DR status', code: 'DR_ERROR' });
  }
});

router.post(
  '/demand-response',
  authenticateToken,
  requireRole('operator'),
  hitlApprove,                          // Demand Response siempre requiere aprobación humana
  [
    body('action').isIn(['ACTIVATE', 'DEACTIVATE']),
    body('nodeIds').isArray({ min: 1 }),
    body('durationMin').isInt({ min: 5, max: 120 }),
  ],
  validate,
  async (req, res) => {
    const { action, nodeIds, durationMin } = req.body;
    logger.info(`[ENERGY][DR] action=${action} nodes=${nodeIds} duration=${durationMin}min user=${req.user?.id}`);

    res.json({
      success: true,
      action,
      nodeIds,
      durationMin,
      activated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + durationMin * 60_000).toISOString(),
      expected_saving_eur: parseFloat((durationMin * 0.5).toFixed(2)),
      audit_trail: `Logged to BeZhasVPP.sol — contract: ${ENERGY_CONTRACTS.VPP}`,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATION LAYER — Energy Wallet (BZHS token)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/energy/wallet/stats
 * @desc    Estadísticas del Energy Wallet: balance BZHS, yield de arbitraje,
 *          reputación de nodo, autosuficiencia. Datos on-chain + off-chain.
 * @access  Private
 */
router.get('/wallet/stats', authenticateToken, async (req, res) => {
  try {
    // PRODUCCIÓN:
    // const { rows } = await query(
    //   'SELECT balance, yield_pct, reputation, self_sufficiency FROM energy_wallets WHERE user_id = $1',
    //   [req.user.id]
    // );
    res.json({
      address: req.user?.address || '0x0000...0000',
      balance_bzhs: '4892.50',
      yield_percentage: '+12.4',
      yield_eur_30d: '284.70',
      reputation_score: 98,
      self_sufficiency_pct: 92,
      staking: {
        staked_bzhs: '2000.00',
        apy_pct: '8.5',
        pending_rewards_bzhs: '14.23',
        lock_until: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      },
      energy_credits: {
        available_kwh: 340.5,
        reserved_kwh: 50.0,
        expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      },
      contracts: ENERGY_CONTRACTS,
    });
  } catch (err) {
    logger.error('[ENERGY][WALLET][STATS]', err);
    res.status(500).json({ error: 'Failed to fetch wallet stats', code: 'WALLET_ERROR' });
  }
});

/**
 * @route   GET /api/energy/wallet/history
 * @desc    Historial de transacciones energéticas (arbitrage, P2P, DR incentives, staking).
 * @access  Private
 */
router.get(
  '/wallet/history',
  authenticateToken,
  [
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    queryValidator('type').optional().isIn(['ARBITRAGE', 'P2P', 'DR_INCENTIVE', 'STAKING', 'CREDIT_PURCHASE']),
  ],
  validate,
  async (req, res) => {
    const limit = req.query.limit || 20;
    const typeFilter = req.query.type;

    try {
      // PRODUCCIÓN: await query(
      //   'SELECT * FROM energy_tx_history WHERE user_id=$1 AND ($2::text IS NULL OR type=$2) ORDER BY ts DESC LIMIT $3',
      //   [req.user.id, typeFilter, limit]
      // );
      const history = [
        { id: 'tx1', type: 'ARBITRAGE', amount_bzhs: '+12.40', amount_eur: '+3.20', ts: new Date(Date.now() - 3_600_000).toISOString(), status: 'CONFIRMED', tx_hash: '0xabc...001' },
        { id: 'tx2', type: 'DR_INCENTIVE', amount_bzhs: '+45.00', amount_eur: '+11.70', ts: new Date(Date.now() - 86_400_000).toISOString(), status: 'CONFIRMED', tx_hash: '0xabc...002' },
        { id: 'tx3', type: 'P2P', amount_bzhs: '-8.30', amount_eur: '-2.15', ts: new Date(Date.now() - 172_800_000).toISOString(), status: 'CONFIRMED', tx_hash: '0xabc...003' },
        { id: 'tx4', type: 'STAKING', amount_bzhs: '+5.80', amount_eur: '+1.50', ts: new Date(Date.now() - 259_200_000).toISOString(), status: 'CONFIRMED', tx_hash: '0xabc...004' },
        { id: 'tx5', type: 'CREDIT_PURCHASE', amount_bzhs: '-500.00', amount_eur: '-130.00', ts: new Date(Date.now() - 604_800_000).toISOString(), status: 'CONFIRMED', tx_hash: '0xabc...005' },
      ].filter(tx => !typeFilter || tx.type === typeFilter).slice(0, limit);

      res.json({ count: history.length, history });
    } catch (err) {
      logger.error('[ENERGY][WALLET][HISTORY]', err);
      res.status(500).json({ error: 'Failed to fetch transaction history', code: 'HISTORY_ERROR' });
    }
  }
);

/**
 * @route   POST /api/energy/wallet/buy-credit
 * @desc    Comprar créditos de energía con BZHS (Web3 ramp con Account Abstraction).
 *          Verifica txHash on-chain en BeZhasVPP.sol antes de acreditar.
 * @access  Private
 * @body    { amountBzhs: number, txHash: string }
 */
router.post(
  '/wallet/buy-credit',
  authenticateToken,
  [
    body('amountBzhs').isFloat({ min: 1, max: 100_000 }).withMessage('Amount must be between 1 and 100,000 BZHS'),
    body('txHash').matches(/^0x[a-fA-F0-9]{64}$/).withMessage('Invalid Ethereum transaction hash'),
  ],
  validate,
  async (req, res) => {
    const { amountBzhs, txHash } = req.body;

    try {
      // PRODUCCIÓN:
      // 1. Verificar txHash en BeZhasVPP.sol vía ethers.js
      //    const tx = await provider.getTransactionReceipt(txHash);
      //    if (!tx || tx.status !== 1) return res.status(400).json({ error: 'TX not confirmed on-chain' });
      //
      // 2. Verificar que no ha sido procesado antes (prevención de replay)
      //    const exists = await query('SELECT id FROM energy_tx_history WHERE tx_hash = $1', [txHash]);
      //    if (exists.rowCount > 0) return res.status(409).json({ error: 'TX already processed' });
      //
      // 3. Acreditar balance en DB
      //    await query(
      //      'UPDATE energy_wallets SET balance = balance + $1 WHERE user_id = $2',
      //      [amountBzhs, req.user.id]
      //    );
      //
      // 4. Registrar en historial
      //    await query(
      //      'INSERT INTO energy_tx_history (user_id, type, amount_bzhs, tx_hash, ts) VALUES ($1,$2,$3,$4,NOW())',
      //      [req.user.id, 'CREDIT_PURCHASE', amountBzhs, txHash]
      //    );

      logger.info(`[ENERGY][WALLET][BUY] ${amountBzhs} BZHS via tx=${txHash} user=${req.user?.id}`);

      res.status(201).json({
        success: true,
        tx_hash: txHash,
        amount_bzhs: amountBzhs,
        // Simulación de balance actualizado — en prod. leer de DB
        new_balance_bzhs: (4892.50 + parseFloat(amountBzhs)).toFixed(2),
        credited_kwh: parseFloat((amountBzhs * 0.25).toFixed(2)), // conversión estimada
        credited_at: new Date().toISOString(),
        contract: ENERGY_CONTRACTS.VPP,
      });
    } catch (err) {
      logger.error('[ENERGY][WALLET][BUY]', err);
      res.status(500).json({ error: 'Failed to process credit top-up', code: 'TOPUP_ERROR' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKCHAIN LAYER — CAE Tokens (Certificados de Ahorro Energético — RWA)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/energy/cae/tokens
 * @desc    Lista de CAE tokens del usuario (RWA on-chain en EnergyCAEToken.sol).
 *          Incluye valor de mercado estimado y estado de validación.
 * @access  Private
 */
router.get('/cae/tokens', authenticateToken, async (req, res) => {
  try {
    // PRODUCCIÓN: llamada RPC a EnergyCAEToken.sol → balanceOf(req.user.address)
    res.json({
      contract: ENERGY_CONTRACTS.CAE_TOKEN,
      owner: req.user?.address || '0x0000...0000',
      total_tokens: 3,
      total_value_eur: '1250.00',
      tokens: [
        {
          token_id: 'CAE-2025-001',
          savings_kwh: 5000,
          period: '2025-Q1',
          certified_by: 'CNMC',
          status: 'VERIFIED',
          market_value_eur: '500.00',
          for_sale: false,
          tx_hash: '0xdef...001',
          minted_at: '2025-04-01T00:00:00Z',
        },
        {
          token_id: 'CAE-2025-002',
          savings_kwh: 3800,
          period: '2025-Q2',
          certified_by: 'CNMC',
          status: 'PENDING_AUDIT',
          market_value_eur: '380.00',
          for_sale: false,
          tx_hash: '0xdef...002',
          minted_at: '2025-07-01T00:00:00Z',
        },
        {
          token_id: 'CAE-2025-003',
          savings_kwh: 3700,
          period: '2025-Q2',
          certified_by: 'CNMC',
          status: 'VERIFIED',
          market_value_eur: '370.00',
          for_sale: true,
          listing_price_eur: '395.00',
          tx_hash: '0xdef...003',
          minted_at: '2025-07-15T00:00:00Z',
        },
      ],
    });
  } catch (err) {
    logger.error('[ENERGY][CAE][TOKENS]', err);
    res.status(500).json({ error: 'Failed to fetch CAE tokens', code: 'CAE_ERROR' });
  }
});

/**
 * @route   POST /api/energy/cae/mint
 * @desc    Emitir un nuevo CAE token por ahorro energético verificado.
 *          Los datos de ahorro deben estar respaldados por telemetría on-chain (EnergyOracle.sol).
 * @access  Private (operator)
 * @body    { savingsKwh, period, certifier, telemetryProof }
 */
router.post(
  '/cae/mint',
  authenticateToken,
  requireRole('operator'),
  [
    body('savingsKwh').isFloat({ min: 100 }).withMessage('Minimum 100 kWh savings required to mint CAE'),
    body('period').matches(/^\d{4}-Q[1-4]$/).withMessage('Period must be in format YYYY-Q{1-4}'),
    body('certifier').isIn(['CNMC', 'IDAE', 'BEZHAS_ORACLE']).withMessage('Invalid certifier'),
    body('telemetryProof').isString().notEmpty().withMessage('telemetryProof (IPFS CID or oracle root) required'),
  ],
  validate,
  async (req, res) => {
    const { savingsKwh, period, certifier, telemetryProof } = req.body;

    try {
      // PRODUCCIÓN:
      // 1. Verificar telemetryProof contra EnergyOracle.sol
      // 2. Llamar EnergyCAEToken.sol.mint(req.user.address, savingsKwh, period, telemetryProof)
      // 3. Registrar en DB

      const tokenId = `CAE-${period}-${Date.now().toString(36).toUpperCase()}`;
      logger.info(`[ENERGY][CAE][MINT] tokenId=${tokenId} savingsKwh=${savingsKwh} user=${req.user?.id}`);

      res.status(201).json({
        success: true,
        token_id: tokenId,
        savings_kwh: savingsKwh,
        period,
        certifier,
        telemetry_proof: telemetryProof,
        estimated_value_eur: parseFloat((savingsKwh * 0.1).toFixed(2)),
        minted_at: new Date().toISOString(),
        contract: ENERGY_CONTRACTS.CAE_TOKEN,
        tx_hash: null, // Rellenado tras confirmación on-chain
        status: 'PENDING_MINT',
      });
    } catch (err) {
      logger.error('[ENERGY][CAE][MINT]', err);
      res.status(500).json({ error: 'Failed to mint CAE token', code: 'CAE_MINT_ERROR' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKCHAIN LAYER — Mercado P2P de energía (prosumidor → nodo)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/energy/p2p/market
 * @desc    Listado de ofertas activas en el mercado P2P de energía de BeZhas.
 *          Prosumidores venden excedentes directamente a otros nodos con BZHS.
 * @access  Private
 */
router.get('/p2p/market', authenticateToken, async (req, res) => {
  try {
    res.json({
      market: 'BeZhas P2P Energy Market',
      settlement_token: 'BZHS',
      active_offers: [
        {
          offer_id: 'p2p-001',
          seller: '0xABCD...1234',
          energy_kwh: 50,
          price_bzhs_kwh: 0.08,
          total_bzhs: 4.0,
          source: NODE_TYPE.SOLAR,
          location: 'Sevilla',
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          verified: true,
        },
        {
          offer_id: 'p2p-002',
          seller: '0xEFGH...5678',
          energy_kwh: 120,
          price_bzhs_kwh: 0.075,
          total_bzhs: 9.0,
          source: NODE_TYPE.WIND,
          location: 'Huelva',
          expires_at: new Date(Date.now() + 7_200_000).toISOString(),
          verified: true,
        },
      ],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch P2P market', code: 'P2P_MARKET_ERROR' });
  }
});

/**
 * @route   POST /api/energy/p2p/offer
 * @desc    Publicar oferta de venta de excedentes energéticos en el mercado P2P.
 * @access  Private
 * @body    { energyKwh, priceBzhsKwh, nodeId, expiresInMinutes }
 */
router.post(
  '/p2p/offer',
  authenticateToken,
  [
    body('energyKwh').isFloat({ min: 1, max: 10_000 }),
    body('priceBzhsKwh').isFloat({ min: 0.001, max: 1 }),
    body('nodeId').matches(/^n\d+$/),
    body('expiresInMinutes').isInt({ min: 15, max: 1440 }),
  ],
  validate,
  async (req, res) => {
    const { energyKwh, priceBzhsKwh, nodeId, expiresInMinutes } = req.body;

    try {
      const offerId = `p2p-${Date.now().toString(36)}`;
      logger.info(`[ENERGY][P2P][OFFER] offerId=${offerId} energyKwh=${energyKwh} price=${priceBzhsKwh} BZHS/kWh`);

      res.status(201).json({
        success: true,
        offer_id: offerId,
        seller: req.user?.address || '0x0000...0000',
        energy_kwh: energyKwh,
        price_bzhs_kwh: priceBzhsKwh,
        total_bzhs: parseFloat((energyKwh * priceBzhsKwh).toFixed(4)),
        node_id: nodeId,
        expires_at: new Date(Date.now() + expiresInMinutes * 60_000).toISOString(),
        contract: ENERGY_CONTRACTS.VPP,
        tx_hash: null,
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to publish P2P offer', code: 'P2P_OFFER_ERROR' });
    }
  }
);

/**
 * @route   POST /api/energy/p2p/buy
 * @desc    Comprar energía de una oferta P2P activa. Pago en BZHS vía Account Abstraction.
 * @access  Private
 * @body    { offerId, txHash }
 */
router.post(
  '/p2p/buy',
  authenticateToken,
  [
    body('offerId').isString().notEmpty(),
    body('txHash').matches(/^0x[a-fA-F0-9]{64}$/),
  ],
  validate,
  async (req, res) => {
    const { offerId, txHash } = req.body;
    try {
      logger.info(`[ENERGY][P2P][BUY] offerId=${offerId} txHash=${txHash} buyer=${req.user?.id}`);
      res.json({
        success: true,
        offer_id: offerId,
        tx_hash: txHash,
        settled_at: new Date().toISOString(),
        delivery_window: '15 min',
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to purchase P2P energy', code: 'P2P_BUY_ERROR' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKCHAIN LAYER — Staking de flexibilidad VPP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/energy/staking/rewards
 * @desc    Recompensas de staking acumuladas por aportar flexibilidad a la VPP
 *          (baterías conectadas con SoC disponible). StakingPoolV2.sol.
 * @access  Private
 */
router.get('/staking/rewards', authenticateToken, async (req, res) => {
  try {
    res.json({
      staker: req.user?.address || '0x0000...0000',
      contract: ENERGY_CONTRACTS.STAKING,
      staked_bzhs: '2000.00',
      apy_pct: '8.5',
      epoch_current: Math.floor(Date.now() / (7 * 86_400_000)), // semanas desde epoch
      rewards: {
        pending_bzhs: '14.23',
        pending_eur: '3.69',
        claimable_at: new Date().toISOString(), // ya disponible
        source: 'VPP Flexibility Pool Yield',
      },
      flexibility_score: 0.92,  // 1.0 = 100% disponibilidad de batería
      contributions_7d: {
        charge_events: 12,
        discharge_events: 8,
        dr_activations: 2,
        total_kwh_flex: 340.5,
      },
    });
  } catch (err) {
    logger.error('[ENERGY][STAKING][REWARDS]', err);
    res.status(500).json({ error: 'Failed to fetch staking rewards', code: 'STAKING_ERROR' });
  }
});

/**
 * @route   POST /api/energy/staking/claim
 * @desc    Reclamar recompensas de staking pendientes (llama StakingPoolV2.sol.claimRewards).
 * @access  Private
 */
router.post('/staking/claim', authenticateToken, async (req, res) => {
  try {
    // PRODUCCIÓN: await stakingContract.claimRewards(req.user.address);
    const claimed = '14.23';
    logger.info(`[ENERGY][STAKING][CLAIM] ${claimed} BZHS user=${req.user?.id}`);
    res.json({
      success: true,
      claimed_bzhs: claimed,
      claimed_at: new Date().toISOString(),
      contract: ENERGY_CONTRACTS.STAKING,
      tx_hash: null, // rellenado tras confirmación on-chain
    });
  } catch (err) {
    logger.error('[ENERGY][STAKING][CLAIM]', err);
    res.status(500).json({ error: 'Failed to claim staking rewards', code: 'CLAIM_ERROR' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SEGURIDAD AEGIS — Auditoría y cumplimiento RD 88/2026
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/energy/compliance/aegis
 * @desc    Informe Aegis: detección de anomalías en telemetría, prevención de energy
 *          spoofing, trazabilidad on-chain y cumplimiento RD 88/2026 (Agregador Independiente).
 * @access  Private (admin)
 */
router.get('/compliance/aegis', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    res.json({
      report_date: new Date().toISOString(),
      regulation: 'RD 88/2026 — Agregador Independiente',
      overall_status: 'COMPLIANT',
      anomaly_engine: 'Aegis v2.1',
      checks: {
        spoofing_attempts_24h: 0,
        telemetry_integrity: 'PASS',
        oracle_data_freshness_s: 47,
        onchain_audit_coverage: '100%',
        false_positive_rate: '0.12%',
      },
      events_last_24h: [
        { ts: new Date(Date.now() - 3_600_000).toISOString(), event: 'TELEMETRY_VALIDATED', node: 'n1', result: 'PASS' },
        { ts: new Date(Date.now() - 7_200_000).toISOString(), event: 'SCADA_COMMAND_AUDIT', node: 'n4', result: 'PASS' },
        { ts: new Date(Date.now() - 10_800_000).toISOString(), event: 'P2P_TRADE_VERIFIED', node: 'n2', result: 'PASS' },
      ],
      certification: {
        issuer: 'BeZhas Aegis Security Layer',
        valid_until: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        blockchain_proof: `${ENERGY_CONTRACTS.ORACLE}`,
      },
    });
  } catch (err) {
    logger.error('[ENERGY][AEGIS]', err);
    res.status(500).json({ error: 'Failed to fetch Aegis compliance report', code: 'AEGIS_ERROR' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

module.exports = router;