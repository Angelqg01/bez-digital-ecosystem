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
const energyArbitrage = require('../services/energyArbitrageAgent'); // autonomous battery arbitrage
const vppChainBridge = require('../services/vppChainBridge'); // on-chain SCADA audit (BeZhasVPP.sol)
const ledger = require('../services/energyLedgerService'); // DB-backed wallet/staking/p2p/cae + on-chain reads
const aegis = require('../services/aegisAnomalyEngine'); // Phase 2 — real telemetry anomaly detection
const telemetryStore = require('../services/energyTelemetryStore'); // Phase 3 — persisted history/analytics
const controlSecurity = require('../services/controlSecurity'); // Phase 5 — sign outbound SCADA commands
const hitlQueue = require('../services/hitlQueue'); // Phase 5 — real human-in-the-loop approvals
const energyNodes = require('../services/energyNodes'); // registro de nodos propios + ingesta HTTPS
const { buildAlerts } = require('../services/energyAlerts'); // alertas calculadas con datos reales
const logger = require('../utils/logger');

/** Sign a SCADA command and publish it to the Edge (best-effort). Returns transport+onchain audit. */
async function dispatchSignedCommand(jobId, nodeId, command, params) {
  const signed = controlSecurity.signCommand({ jobId, command, params, ts: new Date().toISOString() });
  const published = vppBroker.publishSignedControl(nodeId, signed);
  logger.info(`[ENERGY][SCADA] job=${jobId} node=${nodeId} cmd=${command} transport=${published ? 'mqtt(signed)' : 'mock'}`);
  const onchain = await vppChainBridge.logCommandOnChain(jobId, nodeId, command, params, params.powerKw || 0);
  return { published, onchain };
}

/** Los nodos nd-… son de un titular: sólo él puede leer su histórico, analítica o mandarles comandos. Devuelve true si falta. */
async function nodeNotOwned(req, res, nodeId) {
  if (!String(nodeId).startsWith('nd-')) return false;
  const owner = req.user && req.user.bezhas_id;
  const mine = owner ? await energyNodes.listNodes(owner) : [];
  if (mine.some((n) => n.id === nodeId)) return false;
  res.status(404).json({ error: `Node ${nodeId} not found`, code: 'NODE_NOT_FOUND' });
  return true;
}

/** Map a service error (with optional .status) onto an HTTP response. */
function sendLedgerError(res, err, code) {
  const status = err && err.status ? err.status : 500;
  res.status(status).json({ error: err.message, code });
}

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

/**
 * Contratos de energía. Sin variable de entorno valen null: los contratos de
 * smart-contracts/src/energy/ aún no están desplegados y una dirección inventada
 * (antes 0x…01/02/03) hacía creer que había auditoría on-chain. STAKING tampoco
 * tiene valor por defecto: el de antes era la QualityEscrow/Safe, no un StakingPoolV2.
 */
const ENERGY_CONTRACTS = {
  VPP: process.env.CONTRACT_BEZHAS_VPP || null,
  ORACLE: process.env.CONTRACT_ENERGY_ORACLE || null,
  CAE_TOKEN: process.env.CONTRACT_ENERGY_CAE_TOKEN || null,
  STAKING: process.env.CONTRACT_STAKING_POOL_V2 || null,
};

/** Texto de auditoría honesto: solo dice «registrado on-chain» si hay contrato. */
const auditTrail = (contract, what) => (contract
  ? `${what} — contract: ${contract}`
  : `${what}: registro solo en la base de datos (contrato de energía aún no desplegado)`);

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

// Los precios OMIE y los indicadores de REE no tienen respaldo inventado: si el
// feed no responde, la ruta contesta 503 y la app pinta «SIN DATOS». Un precio
// aleatorio con «confianza 0,92» parecía una predicción real.

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
    // 1) Nodos propios del titular con lecturas reales (ingesta HTTPS). Nunca se mezclan con la demo.
    const owner = req.user && req.user.bezhas_id;
    if (owner) {
      const own = await energyNodes.latestFor(owner);
      if (own.telemetry) return res.json(own.telemetry);
    }
    // 2) Sin nodos propios: broker MQTT de la plataforma o, si no hay, demostración — siempre marcada.
    const data = await withCache('telemetry:all', CACHE_TTL.TELEMETRY, async () => {
      const live = vppBroker.getLatestTelemetry();
      return live ? { ...live, simulated: false, source: 'MQTT' } : { ...buildTelemetry(), simulated: true, source: 'simulated' };
    });
    res.json(data);
  } catch (err) {
    logger.error('[ENERGY][TELEMETRY]', err);
    res.status(500).json({ error: 'Failed to fetch VPP telemetry', code: 'TELEMETRY_ERROR' });
  }
});

/**
 * @route   POST /api/energy/telemetry/ingest
 * @desc    Lectura enviada por un nodo propio (Authorization: Bearer bzn_…). Se valida su plausibilidad y se guarda
 *          en telemetry_logs; una lectura imposible (p. ej. más potencia que la capacidad declarada) se rechaza con 422.
 * @access  Clave de nodo (no JWT)
 */
const ingestHits = new Map();
router.post('/telemetry/ingest', async (req, res) => {
  try {
    const key = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const node = await energyNodes.authenticate(key);
    if (!node) return res.status(401).json({ error: 'Clave de nodo no válida', code: 'INVALID_NODE_KEY' });
    // Máximo una lectura por segundo y nodo (un nodo ruidoso no debe llenar telemetry_logs).
    const last = ingestHits.get(node.id) || 0;
    if (Date.now() - last < 1000) return res.status(429).json({ error: 'Máximo una lectura por segundo', code: 'RATE_LIMITED' });
    ingestHits.set(node.id, Date.now());
    if (ingestHits.size > 5000) ingestHits.clear();
    res.status(201).json(await energyNodes.ingest(node, req.body || {}));
  } catch (err) {
    if (err instanceof energyNodes.NodeError) return res.status(err.status).json({ error: err.message, code: err.code });
    logger.error('[ENERGY][INGEST]', err);
    res.status(500).json({ error: 'No se pudo guardar la lectura', code: 'INGEST_ERROR' });
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
  [param('nodeId').matches(/^(n\d+|nd-[a-f0-9]{8})$/).withMessage('Invalid nodeId format')],
  validate,
  async (req, res) => {
    const { nodeId } = req.params;
    try {
      const owner = req.user && req.user.bezhas_id;
      if (owner && nodeId.startsWith('nd-')) {
        const own = await energyNodes.latestFor(owner);
        const one = own.telemetry && { ...own.telemetry, nodes: own.telemetry.nodes.filter((n) => n.id === nodeId) };
        if (!one || !one.nodes.length) return res.status(404).json({ error: `Node ${nodeId} not found`, code: 'NODE_NOT_FOUND' });
        return res.json(one);
      }
      const data = await withCache(`telemetry:${nodeId}`, CACHE_TTL.TELEMETRY, async () => {
        // Live node telemetry from MQTT when available; else simulated (marked).
        const live = vppBroker.getNodeTelemetry(nodeId);
        return live ? { ...live, simulated: false, source: 'MQTT' } : { ...buildTelemetry(nodeId), simulated: true, source: 'simulated' };
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
    const owner = req.user && req.user.bezhas_id;
    const own = owner ? await energyNodes.listNodes(owner) : [];
    if (own.length) return res.json({ total: own.length, simulated: false, nodes: own });
    // Sin nodos propios: lista de demostración, marcada como tal.
    const nodes = [
      { id: 'n1', type: NODE_TYPE.SOLAR, name: 'Array Alpha', location: 'Rooftop A', registered: '2025-01-15', status: 'ONLINE' },
      { id: 'n2', type: NODE_TYPE.WIND, name: 'Turbine V1', location: 'Field B', registered: '2025-02-01', status: 'ONLINE' },
      { id: 'n3', type: NODE_TYPE.HYDRO, name: 'Pumped Hydro', location: 'Basin C', registered: '2025-01-20', status: 'ONLINE' },
      { id: 'n4', type: NODE_TYPE.BATTERY, name: 'BESS Unit 1', location: 'Warehouse D', registered: '2025-03-10', status: 'ONLINE' },
      { id: 'n5', type: NODE_TYPE.LOAD, name: 'Industrial HVAC', location: 'Plant E', registered: '2025-04-01', status: 'ACTIVE' },
    ];
    res.json({ total: nodes.length, simulated: true, nodes });
  } catch (err) {
    logger.error('[ENERGY][NODES]', err);
    res.status(500).json({ error: 'Failed to fetch node registry', code: 'NODES_ERROR' });
  }
});

/**
 * @route   POST /api/energy/nodes
 * @desc    Conectar una planta: da de alta un nodo propio y devuelve su clave (bzn_…) UNA sola vez.
 * @body    { name, type: SOLAR|WIND|HYDRO|BATTERY|LOAD, capacityKw, location?, protocol? }
 */
router.post('/nodes', authenticateToken, async (req, res) => {
  try {
    const result = await energyNodes.registerNode(req.user && req.user.bezhas_id, req.body || {});
    res.status(201).json({ success: true, ...result, ingest: { method: 'POST', path: '/api/energy/telemetry/ingest', auth: 'Authorization: Bearer <nodeKey>' } });
  } catch (err) {
    if (err instanceof energyNodes.NodeError) return res.status(err.status).json({ error: err.message, code: err.code });
    logger.error('[ENERGY][NODES][REGISTER]', err);
    res.status(500).json({ error: 'No se pudo registrar el nodo', code: 'NODES_ERROR' });
  }
});

/** @route DELETE /api/energy/nodes/:id — revoca un nodo propio (su clave deja de valer). */
router.delete('/nodes/:id', authenticateToken, [param('id').matches(/^nd-[a-f0-9]{8}$/)], validate, async (req, res) => {
  try {
    res.json({ success: true, ...(await energyNodes.revokeNode(req.user && req.user.bezhas_id, req.params.id)) });
  } catch (err) {
    if (err instanceof energyNodes.NodeError) return res.status(err.status).json({ error: err.message, code: err.code });
    logger.error('[ENERGY][NODES][REVOKE]', err);
    res.status(500).json({ error: 'No se pudo revocar el nodo', code: 'NODES_ERROR' });
  }
});

/**
 * @route   GET /api/energy/telemetry/:nodeId/history
 * @desc    Histórico persistido de telemetría de un nodo (Fase 3, TimescaleDB).
 * @access  Private
 * @query   ?hours=24&limit=100
 */
router.get(
  '/telemetry/:nodeId/history',
  authenticateToken,
  [
    param('nodeId').matches(/^[\w-]+$/).withMessage('Invalid nodeId'),
    queryValidator('hours').optional().isInt({ min: 1, max: 2160 }).toInt(),
    queryValidator('limit').optional().isInt({ min: 1, max: 5000 }).toInt(),
  ],
  validate,
  async (req, res) => {
    try {
      if (await nodeNotOwned(req, res, req.params.nodeId)) return;
      const samples = await telemetryStore.getHistory(req.params.nodeId, {
        hours: req.query.hours || 24,
        limit: req.query.limit || 100,
      });
      res.json({ node_id: req.params.nodeId, count: samples.length, samples });
    } catch (err) {
      logger.error('[ENERGY][HISTORY]', err);
      res.status(500).json({ error: 'Failed to fetch telemetry history', code: 'HISTORY_ERROR' });
    }
  }
);

/**
 * @route   GET /api/energy/analytics
 * @desc    Analítica agregada (medias, picos, kWh) sobre telemetría persistida.
 * @access  Private
 * @query   ?nodeId=n1&hours=24
 */
router.get(
  '/analytics',
  authenticateToken,
  [
    queryValidator('nodeId').matches(/^[\w-]+$/).withMessage('nodeId required'),
    queryValidator('hours').optional().isInt({ min: 1, max: 2160 }).toInt(),
  ],
  validate,
  async (req, res) => {
    try {
      if (await nodeNotOwned(req, res, req.query.nodeId)) return;
      const stats = await telemetryStore.getAnalytics(req.query.nodeId, { hours: req.query.hours || 24 });
      res.json({ node_id: req.query.nodeId, window_hours: req.query.hours || 24, ...stats });
    } catch (err) {
      logger.error('[ENERGY][ANALYTICS]', err);
      res.status(500).json({ error: 'Failed to compute analytics', code: 'ANALYTICS_ERROR' });
    }
  }
);

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
    // Precio OMIE real (marginalpdbc). Sin él, 503: nunca un precio inventado (ni se cachea el fallo).
    const data = await withCache('omie', CACHE_TTL.OMIE_PRICE, async () => {
      const live = await energyFeed.getOmiePrice();
      if (!live) throw Object.assign(new Error('OMIE feed unavailable'), { code: 'OMIE_UNAVAILABLE' });
      return { ...live, simulated: false };
    });
    res.json(data);
  } catch (err) {
    if (err.code === 'OMIE_UNAVAILABLE') {
      return res.status(503).json({ error: 'Precio OMIE no disponible ahora mismo', code: 'OMIE_UNAVAILABLE' });
    }
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
      const ree = await energyFeed.getReeGrid();      // demanda y mix reales (apidatos.ree.es, sin clave)
      if (ree) return ree;
      const live = await energyFeed.getEsiosIndicators(); // ESIOS, con ESIOS_API_KEY
      if (live) return { ...live, simulated: false };
      // Sin REE ni ESIOS: 503, nunca un mix inventado (ni se cachea el fallo).
      throw Object.assign(new Error('REE/ESIOS feeds unavailable'), { code: 'GRID_UNAVAILABLE' });
    });
    res.json(data);
  } catch (err) {
    if (err.code === 'GRID_UNAVAILABLE') {
      return res.status(503).json({ error: 'Indicadores de la red no disponibles ahora mismo', code: 'GRID_UNAVAILABLE' });
    }
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
    // Alertas calculadas con la curva OMIE real y el estado de los nodos del titular (no cacheadas entre usuarios).
    const owner = req.user && req.user.bezhas_id;
    const own = owner ? await energyNodes.listNodes(owner) : [];
    const omie = (await energyFeed.getOmiePrice()) || null;
    let events = [];
    try { events = await telemetryStore.getAegisEvents({ hours: 24, limit: 50 }); } catch (_) { /* sin eventos */ }
    const data = buildAlerts({
      omie,
      nodes: own.length ? own : [{ id: 'n4', type: 'BATTERY' }, { id: 'n5', type: 'LOAD' }],
      simulated: own.length === 0,
      aegisEvents: events,
    });
    res.json({ count: data.length, simulated_nodes: own.length === 0, price_source: omie ? 'OMIE' : 'none', alerts: data });
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
    // Autonomous agent decision from real OMIE price + live battery telemetry (no dispatch).
    const decision = await energyArbitrage.runOnce({ dispatch: false });

    let { strategy, powerKw, reason } = decision;
    const { priceEurMwh, socPct, nodeId, priceSource } = decision;

    // Sin batería conectada no hay estrategia que recomendar: antes se inventaba
    // un SoC (y un precio, si faltaba) y se presentaba como decisión del agente.
    const sinBateria = socPct == null;
    if (sinBateria) {
      strategy = 'NO_BATTERY';
      powerKw = 0;
      reason = 'No hay ninguna batería conectada con telemetría: el agente no tiene estado de carga sobre el que decidir.';
    }

    res.json({
      timestamp: new Date().toISOString(),
      current_strategy: strategy,
      reason,
      power_kw: powerKw,
      battery_soc_pct: socPct,
      omie_price: priceEurMwh,
      price_source: priceSource,
      node_id: nodeId,
      thresholds: ARBITRAGE_THRESHOLD,
      estimated_yield_eur: sinBateria || priceEurMwh == null
        ? null
        : parseFloat((priceEurMwh * 0.05 * socPct / 100).toFixed(2)),
      next_evaluation: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
  } catch (err) {
    logger.error('[ENERGY][ARBITRAGE][STATUS]', err);
    res.status(500).json({ error: 'Failed to fetch arbitrage status', code: 'ARBITRAGE_ERROR' });
  }
});

/**
 * @route   GET /api/energy/arbitrage/pnl
 * @desc    Shadow-mode validation: notional P&L + recent decisions of the agent (Phase 6).
 *          Run the agent in VPP_ARBITRAGE_MODE=shadow for ~7 days before going live.
 * @access  Private
 */
router.get('/arbitrage/pnl', authenticateToken, (req, res) => {
  res.json({
    mode: energyArbitrage.RISK.mode,
    hitl_above_eur: energyArbitrage.RISK.hitlAboveEur,
    summary: energyArbitrage.getPnlSummary(),
    recent_decisions: energyArbitrage.getDecisionLog(20),
  });
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
    body('nodeId').matches(/^(n\d+|nd-[a-f0-9]{8})$/).withMessage('Invalid nodeId'),
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
      // Un operador sólo manda a nodos propios: los nd-… son de un titular concreto (los n1-n5 son la demo compartida).
      if (nodeId.startsWith('nd-')) {
        const owner = req.user && req.user.bezhas_id;
        const mine = owner ? await energyNodes.listNodes(owner) : [];
        if (!mine.some((n) => n.id === nodeId)) {
          return res.status(404).json({ error: `Node ${nodeId} not found`, code: 'NODE_NOT_FOUND' });
        }
      }
      const jobId = `scada_${Date.now()}_${nodeId}`;

      // HITL obligatorio para comandos críticos — encolar para aprobación humana real.
      if (cmdConfig.requiresApproval) {
        const job = hitlQueue.submit({ jobId, nodeId, command, params, requestedBy: req.user?.userId || req.user?.id });
        logger.warn(`[ENERGY][SCADA][HITL] job=${jobId} PENDING human approval`);
        return res.status(202).json({
          accepted: true,
          hitl_pending: true,
          job_id: jobId,
          status: job.status,
          message: `Command ${command} queued for Human-In-The-Loop approval`,
          approve_url: `/api/energy/control/${jobId}/approve`,
        });
      }

      // Despacho directo, FIRMADO (comandos que no requieren aprobación).
      const { published, onchain } = await dispatchSignedCommand(jobId, nodeId, command, params);

      res.json({
        success: true,
        job_id: jobId,
        nodeId,
        command,
        params,
        signed: true,
        transport: published ? 'mqtt' : 'mock',
        // Sin broker/edge conectado el comando queda firmado y auditado pero NO llega a ningún equipo: se dice.
        delivered: Boolean(published),
        ...(published ? {} : { warning: 'Ningún equipo ha recibido el comando: no hay un edge conectado por MQTT a este nodo.' }),
        dispatched_at: new Date().toISOString(),
        onchain_tx: onchain && onchain.ok ? onchain.hash : null,
        audit_trail: onchain && onchain.ok
          ? `Logged on-chain to BeZhasVPP.sol (tx ${onchain.hash})`
          : auditTrail(ENERGY_CONTRACTS.VPP, 'Comando SCADA pendiente de anclar on-chain'),
      });
    } catch (err) {
      logger.error(`[ENERGY][SCADA][${nodeId}]`, err);
      res.status(500).json({ error: 'Failed to dispatch SCADA command', code: 'SCADA_DISPATCH_ERROR' });
    }
  }
);

/**
 * @route   GET /api/energy/control/pubkey
 * @desc    Public key (PEM) Edge Nodes use to verify backend-signed commands (Phase 5).
 * @access  Private
 */
router.get('/control/pubkey', authenticateToken, (req, res) => {
  res.json({ keyId: controlSecurity.getKeyId(), publicKeyPem: controlSecurity.getPublicKeyPem(), algorithm: 'ECDSA-P256-SHA256' });
});

/**
 * @route   GET /api/energy/control/pending
 * @desc    SCADA commands awaiting Human-In-The-Loop approval.
 * @access  Private (operator)
 */
router.get('/control/pending', authenticateToken, requireRole('operator'), (req, res) => {
  res.json({ pending: hitlQueue.list('PENDING') });
});

/**
 * @route   POST /api/energy/control/:jobId/approve
 * @desc    Approve a pending SCADA command → sign + dispatch to the Edge (Phase 5 HITL).
 * @access  Private (operator)
 */
router.post(
  '/control/:jobId/approve',
  authenticateToken,
  requireRole('operator'),
  [param('jobId').isString().notEmpty()],
  validate,
  async (req, res) => {
    const approved = hitlQueue.approve(req.params.jobId, req.user?.userId || req.user?.id);
    if (approved.error) return res.status(409).json({ error: approved.error, code: 'HITL_APPROVE_ERROR' });

    // Los trabajos que crea el guard genérico (hitlApprove) no son comandos
    // SCADA de un nodo: no hay nada que firmar ni publicar. Quedan aprobados y
    // el cliente reenvía su petición original con el approvalJobId.
    if (!approved.nodeId) {
      logger.info(`[ENERGY][HITL] job=${approved.jobId} (${approved.command}) APPROVED by ${req.user?.userId}`);
      return res.json({
        success: true, job_id: approved.jobId, status: 'APPROVED', command: approved.command,
        dispatched: false,
        nextAction: 'resend_original_request_with_approvalJobId',
      });
    }

    try {
      const { published, onchain } = await dispatchSignedCommand(approved.jobId, approved.nodeId, approved.command, approved.params);
      logger.info(`[ENERGY][SCADA][HITL] job=${approved.jobId} APPROVED by ${req.user?.userId} → dispatched`);
      res.json({
        success: true, job_id: approved.jobId, status: 'APPROVED', signed: true,
        transport: published ? 'mqtt' : 'mock',
        onchain_tx: onchain && onchain.ok ? onchain.hash : null,
      });
    } catch (err) {
      logger.error('[ENERGY][SCADA][HITL][APPROVE]', err);
      res.status(500).json({ error: 'Failed to dispatch approved command', code: 'HITL_DISPATCH_ERROR' });
    }
  }
);

/**
 * @route   POST /api/energy/control/:jobId/reject
 * @desc    Reject a pending SCADA command (no dispatch). Audited.
 * @access  Private (operator)
 */
router.post(
  '/control/:jobId/reject',
  authenticateToken,
  requireRole('operator'),
  [param('jobId').isString().notEmpty(), body('reason').optional().isString()],
  validate,
  (req, res) => {
    const rejected = hitlQueue.reject(req.params.jobId, req.user?.userId || req.user?.id, req.body.reason);
    if (rejected.error) return res.status(409).json({ error: rejected.error, code: 'HITL_REJECT_ERROR' });
    res.json({ success: true, job_id: rejected.jobId, status: 'REJECTED' });
  }
);

/**
 * @route   POST /api/energy/control/ack
 * @desc    Edge Node reports the result of a dispatched command (Phase 5 ACK).
 * @access  Private
 * @body    { jobId, accepted, applied, error?, write? }
 */
router.post(
  '/control/ack',
  authenticateToken,
  [body('jobId').isString().notEmpty()],
  validate,
  (req, res) => {
    const updated = hitlQueue.recordAck(req.body.jobId, req.body);
    if (updated && updated.error) return res.status(404).json({ error: updated.error, code: 'ACK_UNKNOWN_JOB' });
    logger.info(`[ENERGY][SCADA][ACK] job=${req.body.jobId} applied=${req.body.applied} error=${req.body.error || 'none'}`);
    res.json({ success: true, job: updated });
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
    // Nodos elegibles = cargas controlables (LOAD) del propio titular. Ahorros e
    // incentivos: aún no se liquidan, así que null (antes eran aleatorios).
    const owner = req.user && req.user.bezhas_id;
    const own = owner ? await energyNodes.listNodes(owner) : [];
    res.json({
      active: false,
      program: 'REE P48 Demand Response',
      eligible_nodes: own.filter((n) => n.type === NODE_TYPE.LOAD).map((n) => n.id),
      current_trigger: 'PRICE_THRESHOLD',
      threshold_eur_mwh: ARBITRAGE_THRESHOLD.DISCHARGE_ABOVE_PRICE,
      savings_today_eur: null,
      incentive_pending_eur: null,
      settlement: 'not_available',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch DR status', code: 'DR_ERROR' });
  }
});

router.post(
  '/demand-response',
  authenticateToken,
  requireRole('operator'),
  hitlApprove({ command: 'DEMAND_RESPONSE' }),  // Aprobación humana real, atada a este comando
  [
    body('action').isIn(['ACTIVATE', 'DEACTIVATE']),
    body('nodeIds').isArray({ min: 1 }),
    body('durationMin').isInt({ min: 5, max: 120 }),
  ],
  validate,
  async (req, res) => {
    const { action, nodeIds, durationMin } = req.body;
    logger.info(`[ENERGY][DR] action=${action} nodes=${nodeIds} duration=${durationMin}min user=${req.user?.id}`);

    // La orden queda aprobada (HITL) y registrada, pero aún no se envía a los
    // equipos ni se liquida con REE: la respuesta lo dice en lugar de prometer un ahorro.
    res.json({
      success: true,
      action,
      nodeIds,
      durationMin,
      approved_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + durationMin * 60_000).toISOString(),
      dispatched: false,
      note: 'Orden aprobada y registrada; el envío a los equipos y la liquidación con REE aún no están conectados.',
      expected_saving_eur: null,
      audit_trail: auditTrail(ENERGY_CONTRACTS.VPP, 'Demand Response'),
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
    const stats = await ledger.getWalletStats(req);
    res.json({ ...stats, contracts: ENERGY_CONTRACTS });
  } catch (err) {
    logger.error('[ENERGY][WALLET][STATS]', err);
    sendLedgerError(res, err, 'WALLET_ERROR');
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
    try {
      res.json(await ledger.getHistory(req, { limit: req.query.limit || 20, type: req.query.type }));
    } catch (err) {
      logger.error('[ENERGY][WALLET][HISTORY]', err);
      sendLedgerError(res, err, 'HISTORY_ERROR');
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
      const result = await ledger.recordCreditPurchase(req, { amountBzhs, txHash });
      logger.info(`[ENERGY][WALLET][BUY] ${amountBzhs} BZHS via tx=${txHash} user=${req.user?.userId}`);
      res.status(201).json({ success: true, ...result, contract: ENERGY_CONTRACTS.VPP });
    } catch (err) {
      logger.error('[ENERGY][WALLET][BUY]', err);
      sendLedgerError(res, err, 'TOPUP_ERROR');
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
    const data = await ledger.listCaeTokens(req);
    res.json({ contract: ENERGY_CONTRACTS.CAE_TOKEN, ...data });
  } catch (err) {
    logger.error('[ENERGY][CAE][TOKENS]', err);
    sendLedgerError(res, err, 'CAE_ERROR');
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
      const result = await ledger.mintCae(req, { savingsKwh, period, certifier, telemetryProof });
      logger.info(`[ENERGY][CAE][MINT] tokenId=${result.token_id} savingsKwh=${savingsKwh} user=${req.user?.userId}`);
      res.status(201).json({ success: true, ...result, contract: ENERGY_CONTRACTS.CAE_TOKEN });
    } catch (err) {
      logger.error('[ENERGY][CAE][MINT]', err);
      sendLedgerError(res, err, 'CAE_MINT_ERROR');
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
    res.json(await ledger.listP2pOffers());
  } catch (err) {
    logger.error('[ENERGY][P2P][MARKET]', err);
    sendLedgerError(res, err, 'P2P_MARKET_ERROR');
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
    const { energyKwh, priceBzhsKwh, nodeId, expiresInMinutes, source, location } = req.body;
    try {
      const result = await ledger.createP2pOffer(req, { energyKwh, priceBzhsKwh, nodeId, expiresInMinutes, source, location });
      logger.info(`[ENERGY][P2P][OFFER] offerId=${result.offer_id} energyKwh=${energyKwh} price=${priceBzhsKwh} BZHS/kWh`);
      res.status(201).json({ success: true, ...result, contract: ENERGY_CONTRACTS.VPP });
    } catch (err) {
      logger.error('[ENERGY][P2P][OFFER]', err);
      sendLedgerError(res, err, 'P2P_OFFER_ERROR');
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
      const result = await ledger.buyP2pOffer(req, { offerId, txHash });
      logger.info(`[ENERGY][P2P][BUY] offerId=${offerId} txHash=${txHash} buyer=${req.user?.userId}`);
      res.json({ success: true, ...result });
    } catch (err) {
      logger.error('[ENERGY][P2P][BUY]', err);
      sendLedgerError(res, err, 'P2P_BUY_ERROR');
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
    const data = await ledger.getStaking(req);
    res.json({
      ...data,
      contract: ENERGY_CONTRACTS.STAKING,
      epoch_current: Math.floor(Date.now() / (7 * 86_400_000)),
    });
  } catch (err) {
    logger.error('[ENERGY][STAKING][REWARDS]', err);
    sendLedgerError(res, err, 'STAKING_ERROR');
  }
});

/**
 * @route   POST /api/energy/staking/claim
 * @desc    Reclamar recompensas de staking pendientes (llama StakingPoolV2.sol.claimRewards).
 * @access  Private
 */
router.post('/staking/claim', authenticateToken, async (req, res) => {
  try {
    const result = await ledger.claimStaking(req);
    logger.info(`[ENERGY][STAKING][CLAIM] ${result.claimed_bzhs} BZHS user=${req.user?.userId}`);
    res.json({ success: true, ...result, contract: ENERGY_CONTRACTS.STAKING });
  } catch (err) {
    logger.error('[ENERGY][STAKING][CLAIM]', err);
    sendLedgerError(res, err, 'CLAIM_ERROR');
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
    // Real anomaly stats + events from the Aegis engine (Phase 2) — no longer hardcoded.
    const s = aegis.stats();
    const events = aegis.recentEvents(20).map((e) => ({ ts: e.ts, event: e.type, node: e.node, severity: e.severity, result: e.result, message: e.message }));
    const integrityOk = s.telemetry_integrity === 'PASS';

    res.json({
      report_date: new Date().toISOString(),
      regulation: 'RD 88/2026 — Agregador Independiente',
      overall_status: integrityOk ? 'COMPLIANT' : 'REVIEW_REQUIRED',
      anomaly_engine: 'Aegis v2.1 (ECDSA P-256 telemetry verification)',
      signing_enforced: require('../services/telemetrySecurity').isEnforced(),
      checks: {
        spoofing_attempts_24h: s.spoofing_attempts,
        replay_attempts_24h: s.replay_attempts,
        implausible_values_24h: s.implausible_values,
        telemetry_integrity: s.telemetry_integrity,
        events_evaluated_24h: s.events_evaluated,
        fail_rate_pct: s.fail_rate_pct,
        // Sin EnergyOracle desplegado no hay anclaje on-chain: no se declara cobertura.
        onchain_audit_coverage: ENERGY_CONTRACTS.ORACLE ? 'anchored' : 'not_deployed',
      },
      events_last_24h: events,
      certification: {
        issuer: 'BeZhas Aegis Security Layer',
        valid_until: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        blockchain_proof: ENERGY_CONTRACTS.ORACLE,
      },
    });
  } catch (err) {
    logger.error('[ENERGY][AEGIS]', err);
    res.status(500).json({ error: 'Failed to fetch Aegis compliance report', code: 'AEGIS_ERROR' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY & RBAC — current user + admin operator management (real, DB-backed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/energy/me
 * @desc    Authenticated user's real identity + role, so the SPA can gate the UI
 *          (operator-only SCADA controls, admin-only OPERARIOS section).
 * @access  Private
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, wallet_address, username, email, role, bezhas_id FROM users WHERE wallet_address = $1',
      [req.user.address]
    );
    if (!rows.length) {
      // Authenticated token without a persisted row (e.g. dev auth bypass).
      const role = req.user.role || 'user';
      return res.json({
        address: req.user.address, role,
        is_operator: role === 'operator' || role === 'admin',
        is_admin: role === 'admin', persisted: false,
      });
    }
    const u = rows[0];
    res.json({
      id: u.id, address: u.wallet_address, username: u.username, email: u.email,
      role: u.role, bezhas_id: u.bezhas_id,
      is_operator: u.role === 'operator' || u.role === 'admin',
      is_admin: u.role === 'admin', persisted: true,
    });
  } catch (err) {
    logger.error('[ENERGY][ME]', err);
    res.status(500).json({ error: 'Failed to resolve identity', code: 'ME_ERROR' });
  }
});

/**
 * @route   GET /api/energy/admin/operators
 * @desc    List current operators/admins + recent promotable users (candidates).
 * @access  Private (admin)
 */
router.get('/admin/operators', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { rows: operators } = await query(
      `SELECT id, wallet_address, username, email, role, last_login, created_at
         FROM users WHERE role IN ('operator', 'admin')
         ORDER BY role DESC, created_at DESC`
    );
    const { rows: candidates } = await query(
      `SELECT id, wallet_address, username, email, role, created_at
         FROM users WHERE role = 'user'
         ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ total_operators: operators.length, operators, candidates });
  } catch (err) {
    logger.error('[ENERGY][ADMIN][OPERATORS][LIST]', err);
    res.status(500).json({ error: 'Failed to list operators', code: 'OPERATORS_LIST_ERROR' });
  }
});

/**
 * @route   POST /api/energy/admin/operators
 * @desc    Grant the operator role to a user (by userId | walletAddress | email).
 *          Audited in operator_provisioning_log.
 * @access  Private (admin)
 */
router.post(
  '/admin/operators',
  authenticateToken,
  requireRole('admin'),
  [
    body('userId').optional().isUUID(),
    body('walletAddress').optional().matches(/^0x[a-fA-F0-9]{40}$/),
    body('email').optional().isEmail(),
    body('note').optional().isString(),
  ],
  validate,
  async (req, res) => {
    const { userId, walletAddress, email, note } = req.body;
    if (!userId && !walletAddress && !email) {
      return res.status(422).json({ error: 'Provide userId, walletAddress or email', code: 'TARGET_REQUIRED' });
    }
    try {
      const { rows } = await query(
        `SELECT id, role FROM users
           WHERE ($1::uuid IS NULL OR id = $1)
             AND ($2::text IS NULL OR wallet_address = $2)
             AND ($3::text IS NULL OR email = $3)
           LIMIT 1`,
        [userId || null, walletAddress || null, email || null]
      );
      if (!rows.length) return res.status(404).json({ error: 'Target user not found', code: 'TARGET_NOT_FOUND' });

      const target = rows[0];
      if (target.role === 'admin') {
        return res.status(409).json({ error: 'User is an admin — not modified', code: 'TARGET_IS_ADMIN' });
      }
      if (target.role === 'operator') {
        return res.json({ success: true, already_operator: true, user_id: target.id, role: 'operator' });
      }

      await query("UPDATE users SET role = 'operator', updated_at = NOW() WHERE id = $1", [target.id]);
      await query(
        `INSERT INTO operator_provisioning_log (operator_id, admin_id, action, previous_role, note)
           VALUES ($1, $2, 'GRANT', $3, $4)`,
        [target.id, req.user.userId || null, target.role, note || null]
      );
      logger.info(`[ENERGY][ADMIN][OPERATORS] GRANT operator=${target.id} by admin=${req.user.userId}`);
      res.status(201).json({ success: true, user_id: target.id, role: 'operator', previous_role: target.role });
    } catch (err) {
      logger.error('[ENERGY][ADMIN][OPERATORS][GRANT]', err);
      res.status(500).json({ error: 'Failed to grant operator role', code: 'OPERATOR_GRANT_ERROR' });
    }
  }
);

/**
 * @route   DELETE /api/energy/admin/operators/:id
 * @desc    Revoke the operator role (back to 'user'). Audited.
 * @access  Private (admin)
 */
router.delete(
  '/admin/operators/:id',
  authenticateToken,
  requireRole('admin'),
  [param('id').isUUID().withMessage('Invalid user id')],
  validate,
  async (req, res) => {
    try {
      const { rows } = await query('SELECT id, role FROM users WHERE id = $1', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      if (rows[0].role !== 'operator') {
        return res.status(409).json({ error: `User role is '${rows[0].role}', not operator`, code: 'NOT_AN_OPERATOR' });
      }
      await query("UPDATE users SET role = 'user', updated_at = NOW() WHERE id = $1", [req.params.id]);
      await query(
        `INSERT INTO operator_provisioning_log (operator_id, admin_id, action, previous_role)
           VALUES ($1, $2, 'REVOKE', 'operator')`,
        [req.params.id, req.user.userId || null]
      );
      logger.info(`[ENERGY][ADMIN][OPERATORS] REVOKE operator=${req.params.id} by admin=${req.user.userId}`);
      res.json({ success: true, user_id: req.params.id, role: 'user' });
    } catch (err) {
      logger.error('[ENERGY][ADMIN][OPERATORS][REVOKE]', err);
      res.status(500).json({ error: 'Failed to revoke operator role', code: 'OPERATOR_REVOKE_ERROR' });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

module.exports = router;