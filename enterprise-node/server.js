require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const { initSchema, query } = require('./lib/db');
const { syncAbis, getRegisteredAbis } = require('./lib/abi-sync');
const eventIndexer = require('./lib/event-indexer');
const sdkBridge = require('./lib/sdk-bridge');
const tokenomics = require('./lib/tokenomics-service');
const hooks = require('./lib/hook-dispatcher');
const validatorService = require('./lib/validator-service');

const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.CORE_CORS_ORIGINS ? process.env.CORE_CORS_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true,
}));

const PORT = parseInt(process.env.PORT || '4100', 10);
if (process.env.NODE_ENV === 'production' && !process.env.API_KEY) {
  throw new Error('API_KEY is required in production');
}

// ── Auth middleware (API key for B2B endpoints) ──
const requireAuth = (req, res, next) => {
  const rawKey = req.headers['authorization'] || req.query.api_key;
  const key = typeof rawKey === 'string' ? rawKey.replace(/^Bearer\s+/i, '') : rawKey;
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ── Webhook tier gate: only professional / enterprise plans can use webhooks ──
const CONTROL_API = process.env.CONTROL_API_URL || 'http://localhost:3001';
const ALLOWED_TIERS = ['professional', 'enterprise'];

const requireWebhookTier = async (req, res, next) => {
  try {
    const apiKey = req.headers['authorization'] || req.query.api_key;
    const resp = await fetch(`${CONTROL_API}/api/enterprises/by-key`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CONTROL_JWT || ''}`,
        'X-API-Key': apiKey || '',
      },
    });

    if (!resp.ok) {
      return res.status(403).json({ error: 'Unable to verify subscription tier.' });
    }

    const enterprise = await resp.json();
    const tier = enterprise.tier || 'basic';

    if (!ALLOWED_TIERS.includes(tier)) {
      return res.status(403).json({
        error: 'Webhook access requires a professional or enterprise plan.',
        current_tier: tier,
        required_tiers: ALLOWED_TIERS,
      });
    }

    req.enterpriseTier = tier;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Subscription verification failed.' });
  }
};

// ═══════════════════════════════════════════════
//  PUBLIC ENDPOINTS
// ═══════════════════════════════════════════════

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BeZhas Enterprise Node',
    version: '1.0.0',
    chain_id: parseInt(process.env.CHAIN_ID || '2708', 10),
    uptime_seconds: Math.floor(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    indexer: eventIndexer.getStats(),
  });
});

app.get('/network/stats', async (req, res) => {
  try {
    const rpcUrl = process.env.BEZHAS_L2_RPC_URL || 'http://bezhas-geth:8545';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const [blockNumber, network, feeData] = await Promise.all([
      provider.getBlockNumber(),
      provider.getNetwork(),
      provider.getFeeData(),
    ]);
    res.json({
      success: true,
      chain_id: Number(network.chainId),
      block_height: blockNumber,
      gas_price_gwei: feeData.gasPrice
        ? parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei'))
        : null,
      status: 'Operational',
    });
  } catch (err) {
    res.json({ success: false, status: 'RPC Unreachable', error: err.message });
  }
});

app.get('/sdk/frontend-config', (req, res) => {
  res.json({ success: true, ...sdkBridge.getFrontendConfig() });
});

// ═══════════════════════════════════════════════
//  AUTHENTICATED ENDPOINTS
// ═══════════════════════════════════════════════

// Query indexed events
app.get('/events', requireAuth, async (req, res) => {
  try {
    const { contract, event, from_block, limit = 50 } = req.query;
    const safLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
    let sql = 'SELECT * FROM blockchain_events WHERE 1=1';
    const params = [];
    let idx = 1;

    if (contract) {
      sql += ` AND contract_name = $${idx++}`;
      params.push(String(contract).slice(0, 100));
    }
    if (event) {
      sql += ` AND event_name = $${idx++}`;
      params.push(String(event).slice(0, 100));
    }
    if (from_block) {
      sql += ` AND block_number >= $${idx++}`;
      params.push(parseInt(from_block, 10));
    }
    sql += ` ORDER BY block_number DESC, log_index DESC LIMIT $${idx}`;
    params.push(safLimit);

    const { rows } = await query(sql, params);
    res.json({ success: true, count: rows.length, events: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List registered ABIs
app.get('/contracts', requireAuth, async (req, res) => {
  try {
    const abis = await getRegisteredAbis();
    res.json({
      success: true,
      count: abis.length,
      contracts: abis.map((a) => ({
        name: a.contract_name,
        address: a.address,
        chain_id: a.chain_id,
        synced_at: a.synced_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trigger ABI re-sync
app.post('/contracts/sync', requireAuth, async (req, res) => {
  try {
    await syncAbis();
    const abis = await getRegisteredAbis();
    res.json({ success: true, synced: abis.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Indexer control
app.get('/indexer/stats', requireAuth, (req, res) => {
  res.json({ success: true, ...eventIndexer.getStats() });
});

// SDK bridge and contract metadata for frontends/backends
app.get('/sdk/status', requireAuth, (req, res) => {
  res.json({ success: true, ...sdkBridge.getSdkStatus() });
});

app.get('/sdk/contracts', requireAuth, (req, res) => {
  res.json({ success: true, ...sdkBridge.getContractsForFrontend() });
});

// Tokenomics and profitability surfaces
app.get('/tokenomics/snapshot', requireAuth, async (req, res) => {
  try {
    const snapshot = await tokenomics.buildSnapshot({ persist: req.query.persist !== 'false' });
    res.json({ success: true, snapshot });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/tokenomics/latest', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, chain_id, snapshot, created_at FROM tokenomics_snapshots ORDER BY created_at DESC LIMIT 1'
    );
    res.json({ success: true, snapshot: rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/profitability/report', requireAuth, async (req, res) => {
  try {
    const report = await tokenomics.buildProfitabilityReport(req.query);
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/profitability/calculate', requireAuth, async (req, res) => {
  try {
    const report = await tokenomics.buildProfitabilityReport(req.body || {});
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Outgoing hooks for ERP/CRM/backend integrations
app.get('/hooks', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, hooks: await hooks.listHooks() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/hooks', requireAuth, async (req, res) => {
  try {
    const hook = await hooks.createHook(req.body || {});
    res.status(201).json({ success: true, hook });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/hooks/:id/test', requireAuth, async (req, res) => {
  try {
    const result = await hooks.dispatch(req.body?.event_type || 'hook.test', {
      hook_id: parseInt(req.params.id, 10),
      message: 'BeZhas hook test',
      sample: req.body?.sample || {},
    });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/hooks/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await hooks.deleteHook(req.params.id);
    res.json({ success: true, deleted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Validator operations. Write endpoints require VALIDATOR_PRIVATE_KEY.
app.get('/validator/status', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, status: await validatorService.getStatus() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/validator/approve-stake', requireAuth, async (req, res) => {
  try {
    const result = await validatorService.approveStake(req.body?.amount_bez);
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/validator/register', requireAuth, async (req, res) => {
  try {
    const result = await validatorService.registerValidator(req.body?.company_name, req.body?.stake_amount_bez);
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/validator/heartbeat', requireAuth, async (req, res) => {
  try {
    const result = await validatorService.heartbeat();
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/operations/checklist', requireAuth, async (req, res) => {
  const sdk = sdkBridge.getSdkStatus();
  const validator = validatorService.getConfig();
  res.json({
    success: true,
    checklist: {
      api_key_configured: Boolean(process.env.API_KEY && !process.env.API_KEY.includes('CHANGE_ME')),
      sdk_available: sdk.available,
      rpc_private_bind_recommended: process.env.RPC_HTTP_BIND !== '0.0.0.0',
      platform_abi_sync_configured: Boolean(process.env.BEZHAS_PLATFORM_API && process.env.BEZHAS_PLATFORM_API_KEY),
      validator_write_enabled: validator.has_private_key,
      public_frontend_config: '/sdk/frontend-config',
      required_next_steps: [
        'Set a strong API_KEY in .env.',
        'Configure contract addresses or BEZHAS_PLATFORM_API_KEY for live ABIs.',
        'Keep RPC bound to 127.0.0.1 unless protected by VPN/proxy.',
        'Create hooks for ERP/CRM systems that need blockchain events.',
        'Enable validator keys only on hardened infrastructure.',
      ],
    },
  });
});

// Generic webhook for ERP integration
app.post('/webhook', requireAuth, requireWebhookTier, async (req, res) => {
  try {
    const { sector, entity_id, data } = req.body;
    if (!sector || !entity_id || !data) {
      return res.status(400).json({ error: 'Missing: sector, entity_id, data' });
    }
    const safeSector = String(sector).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
    const safeEntityId = String(entity_id).slice(0, 100);

    // Store locally for audit
    await query(
      `INSERT INTO blockchain_events
       (contract_name, event_name, tx_hash, block_number, log_index, actor_address, event_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        safeSector,
        'WebhookReceived',
        `0x${Date.now().toString(16).padStart(64, '0')}`,
        0,
        0,
        null,
        JSON.stringify({ entity_id: safeEntityId, data, received_at: new Date().toISOString() }),
      ]
    );

    hooks.dispatch('erp.webhook.received', {
      sector: safeSector,
      entity_id: safeEntityId,
      data,
    }).catch((err) => {
      console.warn(`[Hooks] ERP dispatch failed: ${err.message}`);
    });

    res.json({ success: true, sector: safeSector, entity_id: safeEntityId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════
//  STARTUP
// ═══════════════════════════════════════════════

async function boot() {
  try {
    // 1. Initialize database schema
    await initSchema();

    // 2. Sync ABIs (from platform or bundled)
    await syncAbis();

    // 3. Start event indexer
    const abis = await getRegisteredAbis();
    await eventIndexer.start(abis);

    // 4. Start HTTP server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Enterprise Node] Listening on :${PORT}`);
      console.log(`[Enterprise Node] Chain ID: ${process.env.CHAIN_ID || 2708}`);
      console.log(`[Enterprise Node] RPC: ${process.env.BEZHAS_L2_RPC_URL || 'http://bezhas-geth:8545'}`);
    });
  } catch (err) {
    console.error('[Enterprise Node] Boot failed:', err);
    process.exit(1);
  }
}

boot();
