'use strict';

/**
 * BeZhas Edge Gateway — entry point.
 *
 * Reads a config (nodes + drivers + broker), connects each device driver and the
 * MQTT publisher, then polls every device on an interval and publishes canonical
 * telemetry to `bezhas/edge/<nodeId>/telemetry`. This is the PHYSICAL-LAYER piece
 * that the rest of the VPP stack was already waiting for (see
 * docs/ARQUITECTURA_REAL_Y_PLAN.md): the backend prioritises live broker data and
 * only falls back to simulated values, so once this gateway runs against real
 * hardware the dashboard shows real data with no other changes.
 *
 * Usage:
 *   node src/index.js --config ./config.json
 *   node src/index.js --config ./config.json --dry-run   # log payloads, no MQTT
 */

const fs = require('fs');
const path = require('path');
const { createDriver } = require('./drivers/base');
const { createPublisher } = require('./publisher');
const { createBuffer } = require('./buffer');

const logger = {
  info: (...a) => console.log(...a),
  warn: (...a) => console.warn(...a),
  error: (...a) => console.error(...a),
};

function parseArgs(argv) {
  const args = { config: './config.json', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') args.config = argv[++i];
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  return args;
}

function loadConfig(configPath) {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Config not found: ${resolved} (copy config.example.json → config.json)`);
  }
  return { config: JSON.parse(fs.readFileSync(resolved, 'utf8')), baseDir: path.dirname(resolved) };
}

/**
 * Build and start a gateway from a config object. Exposed (not just CLI) so the
 * verification script can drive it in-process.
 * @returns {Promise<{stop:Function, pollOnce:Function, publisher:object, nodes:object[]}>}
 */
async function startGateway(config, { baseDir = process.cwd(), dryRun = false, log = logger } = {}) {
  const buffer = createBuffer(config.buffer || {});

  // Phase 2 — optional telemetry signing. Key from config.security.privateKeyFile
  // (PEM on disk in dev; a hardware signer replaces this in production).
  let signer = null;
  if (config.security && config.security.privateKeyFile) {
    const { createSoftwareSigner } = require('./security/signer');
    const keyPath = path.resolve(baseDir, config.security.privateKeyFile);
    signer = createSoftwareSigner({
      keyId: config.security.keyId || 'edge-key-1',
      privateKeyPem: fs.readFileSync(keyPath, 'utf8'),
    });
    log.info(`[edge] telemetry signing ENABLED (keyId=${signer.keyId}, ECDSA P-256)`);
  }

  // Phase 5 — SCADA control: verify backend-signed commands, apply, ACK.
  // Backend public key from config.control.backendPublicKeyFile (fetch once from
  // GET /api/energy/control/pubkey and save it next to the gateway).
  let backendPublicKeyPem = null;
  if (config.control && config.control.backendPublicKeyFile) {
    try {
      backendPublicKeyPem = fs.readFileSync(path.resolve(baseDir, config.control.backendPublicKeyFile), 'utf8');
      log.info('[edge] SCADA control ENABLED (verifying backend-signed commands)');
    } catch (e) { log.warn(`[edge] control disabled — cannot read backend key: ${e.message}`); }
  }

  const dispatchers = new Map(); // nodeId → dispatcher (built after drivers connect)
  const controlHandler = backendPublicKeyPem
    ? async (nodeId, command) => {
        const d = dispatchers.get(nodeId);
        if (!d) return { jobId: command && command.jobId, accepted: false, applied: false, error: 'unknown_node', ts: new Date().toISOString() };
        return d.handle(command);
      }
    : null;

  const publisher = createPublisher({
    brokerUrl: config.broker?.url,
    username: config.broker?.username || undefined,
    password: config.broker?.password || undefined,
    buffer,
    logger: log,
    dryRun,
    signer,
    controlHandler,
  });
  await publisher.connect();

  // Instantiate + connect every node driver (a failed device degrades only itself).
  const nodes = [];
  for (const nodeCfg of config.nodes || []) {
    const driver = createDriver(nodeCfg, baseDir);
    try {
      await driver.connect();
      log.info(`[edge] node ${nodeCfg.nodeId} (${nodeCfg.type}) connected via ${nodeCfg.driver}`);
      nodes.push({ ...nodeCfg, driver });
    } catch (err) {
      log.warn(`[edge] node ${nodeCfg.nodeId} connect failed: ${err.message} — will retry on poll`);
      nodes.push({ ...nodeCfg, driver, _needsConnect: true });
    }
    // Build a control dispatcher for this node (signs ACKs with the gateway key).
    if (backendPublicKeyPem) {
      const { createDispatcher } = require('./control/dispatcher');
      dispatchers.set(nodeCfg.nodeId, createDispatcher({ driver, backendPublicKeyPem, ackSigner: signer, logger: log }));
    }
  }

  async function pollOnce() {
    for (const node of nodes) {
      try {
        if (node._needsConnect || !node.driver.isConnected()) {
          await node.driver.connect();
          node._needsConnect = false;
        }
        const reading = await node.driver.read();
        await publisher.publish({ nodeId: node.nodeId, name: node.name, type: node.type, protocol: node.protocol }, reading);
      } catch (err) {
        node._needsConnect = true;
        log.warn(`[edge] poll ${node.nodeId} failed: ${err.message}`);
      }
    }
  }

  const intervalMs = config.publishIntervalMs || 5000;
  const timer = setInterval(() => { pollOnce().catch((e) => log.error('[edge] poll loop error', e)); }, intervalMs);
  // Kick an immediate first poll so data flows without waiting a full interval.
  await pollOnce();

  async function stop() {
    clearInterval(timer);
    for (const node of nodes) { try { await node.driver.close(); } catch { /* ignore */ } }
    await publisher.close();
  }

  return { stop, pollOnce, publisher, nodes };
}

// ── CLI ──
if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const { config, baseDir } = loadConfig(args.config);
  startGateway(config, { baseDir, dryRun: args.dryRun, log: logger })
    .then((gw) => {
      logger.info(`[edge] gateway running — ${config.nodes?.length || 0} node(s), interval ${config.publishIntervalMs || 5000}ms${args.dryRun ? ' (dry-run)' : ''}`);
      const shutdown = async () => { logger.info('\n[edge] shutting down'); await gw.stop(); process.exit(0); };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    })
    .catch((err) => { logger.error('[edge] fatal:', err.message); process.exit(1); });
}

module.exports = { startGateway, loadConfig };
