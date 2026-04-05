/**
 * mcp-scheduler.service.js
 * ============================================================
 * MCP Scheduler Automático — BeZhas Intelligence Layer
 * ============================================================
 *
 * Ejecuta automáticamente los 13 MCP tools del Orchestrator
 * y emite los resultados via WebSocket al frontend en tiempo real.
 *
 * Schedules:
 *   - Gas prices:     cada 3 min  → emite 'gas:update'
 *   - BEZ Price:      cada 5 min  → emite 'price:update'
 *   - Holders data:   cada 1 hora → emite 'holders:update'
 *   - DAO governance: cada 1 hora → emite 'dao:update'
 *   - Compliance:     cada 6 horas → emite 'compliance:update'
 */

const cron = require('node-cron');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Cargar el orchestrator (ya existe con los 13 tools)
let orchestrator;
try {
    orchestrator = require('./orchestrator.service');
} catch (e) {
    logger.warn('Orchestrator service not available — MCP scheduler disabled');
}

// WebSocket emit (si está disponible)
let wsServer;
function setWSServer(server) { wsServer = server; }

function emit(event, data) {
    if (!wsServer) return;
    try {
        wsServer.broadcast(JSON.stringify({ event, data, timestamp: Date.now() }));
    } catch (_) { }
}

// ── Estado caché ──────────────────────────────────────────────────────────────
const cache = {
    gas: null,
    price: null,
    holders: null,
    dao: null,
    compliance: null,
};

// ── Runners ───────────────────────────────────────────────────────────────────

/**
 * Gas prices — cada 3 minutos
 */
async function runGasUpdate() {
    if (!orchestrator) return;
    try {
        const result = await orchestrator.executeTool('analyze_gas', {
            transactionType: 'token_transfer',
            estimatedValueUSD: 100,
        });
        if (result?.status === 'SUCCESS') {
            cache.gas = result.data;
            emit('gas:update', result.data);
            logger.debug('Gas update emitted');
        }
    } catch (e) {
        logger.warn({ err: e.message }, 'Gas update failed');
    }
}

/**
 * BEZ price via Alpaca / Blockscout — cada 5 minutos
 */
async function runPriceUpdate() {
    if (!orchestrator) return;
    try {
        const result = await orchestrator.executeTool('blockscout_explorer', {
            type: 'token_info',
            contractAddress: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
        });
        if (result?.status === 'SUCCESS') {
            cache.price = result.data;
            emit('price:update', result.data);
            logger.debug('Price update emitted');
        }
    } catch (e) {
        logger.warn({ err: e.message }, 'Price update failed');
    }
}

/**
 * Holders & supply metrics — cada hora
 */
async function runHoldersUpdate() {
    if (!orchestrator) return;
    try {
        const [holdersResult, supplyResult] = await orchestrator.executeParallel([
            { tool: 'blockscout_explorer', params: { type: 'holder_analysis', contractAddress: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' } },
            { tool: 'blockscout_explorer', params: { type: 'supply_metrics', contractAddress: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' } },
        ]);
        cache.holders = { holders: holdersResult?.data, supply: supplyResult?.data };
        emit('holders:update', cache.holders);
        logger.info('Holders update emitted');
    } catch (e) {
        logger.warn({ err: e.message }, 'Holders update failed');
    }
}

/**
 * DAO governance (Tally) — cada hora
 */
async function runDAOUpdate() {
    if (!orchestrator) return;
    try {
        const result = await orchestrator.executeTool('tally_dao_governance', {
            organizationId: process.env.TALLY_ORG_ID || 'bezhas',
        });
        if (result?.status === 'SUCCESS') {
            cache.dao = result.data;
            emit('dao:update', result.data);
            logger.info('DAO governance update emitted');
        }
    } catch (e) {
        logger.warn({ err: e.message }, 'DAO update failed');
    }
}

/**
 * Compliance check — cada 6 horas
 */
async function runComplianceUpdate() {
    if (!orchestrator) return;
    try {
        const result = await orchestrator.executeTool('compliance_check', {
            entityType: 'platform',
            jurisdiction: 'EU',
        });
        if (result?.status === 'SUCCESS') {
            cache.compliance = result.data;
            emit('compliance:update', result.data);
            logger.info('Compliance update emitted');
        }
    } catch (e) {
        logger.warn({ err: e.message }, 'Compliance update failed');
    }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
let schedulesActive = false;
const schedules = [];

function start() {
    if (schedulesActive) {
        logger.warn('MCP Scheduler already running');
        return;
    }

    if (!orchestrator) {
        logger.warn('⚠️  Orchestrator not available — MCP Scheduler not started');
        return;
    }

    logger.info('🕐 Starting MCP Scheduler...');

    // Gas: cada 3 minutos
    schedules.push(cron.schedule('*/3 * * * *', runGasUpdate));

    // BEZ Price: cada 5 minutos
    schedules.push(cron.schedule('*/5 * * * *', runPriceUpdate));

    // Holders: cada hora (a los :00)
    schedules.push(cron.schedule('0 * * * *', runHoldersUpdate));

    // DAO: cada hora (a los :30)
    schedules.push(cron.schedule('30 * * * *', runDAOUpdate));

    // Compliance: cada 6 horas
    schedules.push(cron.schedule('0 */6 * * *', runComplianceUpdate));

    schedulesActive = true;
    logger.info('✅ MCP Scheduler started — 5 jobs active');

    // Ejecutar inmediatamente al iniciar (sin esperar el primer intervalo)
    setTimeout(async () => {
        logger.info('🚀 MCP Scheduler: running initial data fetch...');
        await runGasUpdate();
        await runPriceUpdate();
        // Los costosos los diferimos para no saturar al arrancar
        setTimeout(runHoldersUpdate, 10_000);
        setTimeout(runDAOUpdate, 20_000);
    }, 2000);
}

function stop() {
    schedules.forEach(s => s.stop());
    schedules.length = 0;
    schedulesActive = false;
    logger.info('MCP Scheduler stopped');
}

function getCache() {
    return { ...cache, schedulesActive };
}

module.exports = { start, stop, setWSServer, getCache, runGasUpdate, runPriceUpdate, runHoldersUpdate, runDAOUpdate };
