/**
 * BeZhas Queue Service - Enhanced for AI/ML Pipeline
 * Redis/BullMQ es OPCIONAL. Si Redis falla o supera su límite (Upstash 500K),
 * el backend continúa en modo stateless usando procesamiento en memoria.
 */

const axios = require('axios');
const AEGIS_URL = process.env.AEGIS_URL || 'http://localhost:8001';

// ── Estado global ─────────────────────────────────────────────────────────────
let connection = null;
let queues = {
  contactSync: null,
  telemetry: null,
  web3Events: null,
  anomalyDetection: null,
  autoHealing: null,
};
let retryCount = 0;
const maxRetries = 3;
let redisDisabled = false; // Se pone true cuando Upstash supera el límite

// ── Detector de error de límite Upstash ──────────────────────────────────────
function isUpstashLimitError(err) {
  const msg = err?.message || err?.toString() || '';
  return (
    msg.includes('max requests limit exceeded') ||
    msg.includes('ERR max requests') ||
    msg.includes('WRONGTYPE') ||
    msg.includes('maxmemory')
  );
}

/**
 * Desactiva todas las colas y la conexión Redis
 * cuando Upstash supera el límite o Redis falla definitivamente.
 */
function disableQueues(reason) {
  if (redisDisabled) return; // Ya desactivado
  redisDisabled = true;
  console.warn(`⚠️  Queues DISABLED (${reason}). Backend running in stateless/memory mode.`);
  Object.keys(queues).forEach(k => { queues[k] = null; });
  if (connection) {
    try { connection.disconnect(); } catch (_) { }
    connection = null;
  }
}

// ── Wrapper seguro para operaciones de cola ───────────────────────────────────
async function safeQueueAdd(queue, name, data) {
  if (!queue || redisDisabled) return null;
  try {
    return await queue.add(name, data);
  } catch (err) {
    if (isUpstashLimitError(err)) {
      disableQueues('Upstash request limit exceeded');
    } else {
      console.warn(`⚠️  Queue add failed: ${err.message}`);
    }
    return null;
  }
}

// ── Helpers públicos ──────────────────────────────────────────────────────────
const addContactSyncJob = async (userId, contacts) => {
  if (!queues.contactSync || redisDisabled) {
    console.log(`[stateless] Contact sync for user ${userId} — ${contacts.length} contacts (skipped, no queue)`);
    return;
  }
  await safeQueueAdd(queues.contactSync, 'sync-contacts', { userId, contacts });
};

const addTelemetryJob = async (telemetryData) => {
  if (!queues.telemetry || redisDisabled) {
    // Fallback: enviar directamente a Aegis (sin cola)
    try {
      await axios.post(`${AEGIS_URL}/aegis/v1/ingest/telemetry`, telemetryData, { timeout: 3000 });
    } catch (_) {
      // Aegis no disponible — silencio, no es crítico
    }
    return;
  }
  await safeQueueAdd(queues.telemetry, 'process-telemetry', telemetryData);
};

const addWeb3EventJob = async (eventData) => {
  if (!queues.web3Events || redisDisabled) return;
  await safeQueueAdd(queues.web3Events, 'process-web3-event', eventData);
};

const addAnomalyDetectionJob = async (logData) => {
  if (!queues.anomalyDetection || redisDisabled) return;
  await safeQueueAdd(queues.anomalyDetection, 'detect-anomaly', logData);
};

// ── Inicialización de Redis + BullMQ (solo si REDIS_URL está configurado) ─────
const BULLMQ_FORCE_DISABLED = ['true', '1'].includes((process.env.DISABLE_BULLMQ || '').toLowerCase());
if (process.env.REDIS_URL && !redisDisabled && !BULLMQ_FORCE_DISABLED) {
  const { Queue, Worker } = require('bullmq');
  const IORedis = require('ioredis');

  console.log('🚀 REDIS_URL present — initializing BullMQ queues...');

  try {
    const { processContactSync } = require('../workers/contactSync.worker');
    const redisUrl = process.env.REDIS_URL;
    const connectionOptions = {
      maxRetriesPerRequest: null, // Requerido por BullMQ
      retryStrategy: (times) => {
        if (times >= 3) {
          disableQueues('Redis connection failed after 3 retries');
          return null; // Dejar de reintentar
        }
        return Math.min(times * 1000, 3000);
      },
      connectTimeout: 10000,
      lazyConnect: true,
      enableReadyCheck: false, // Evita polling continuo de Upstash
      enableOfflineQueue: false, // No acumular comandos cuando offline
      family: 0,
    };

    if (redisUrl.startsWith('rediss://')) {
      connectionOptions.tls = { rejectUnauthorized: false };
      console.log('🔒 Queue Redis TLS enabled for rediss://');
    }

    connection = new IORedis(redisUrl, connectionOptions);

    connection.on('error', (err) => {
      if (isUpstashLimitError(err)) {
        disableQueues('Upstash request limit exceeded');
        return;
      }
      retryCount++;
      if (retryCount >= maxRetries) {
        disableQueues(`Redis max retries (${maxRetries}) reached`);
      } else {
        console.warn(`⚠️  Redis error (${retryCount}/${maxRetries}): ${err.message}`);
      }
    });

    connection.on('connect', () => {
      console.log('✅ Queue Redis connected');
      retryCount = 0;
    });

    // Inicializar colas con removeOnComplete para no acumular jobs y gastar requests
    const queueDefaults = {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 10 },  // Mantener solo los últimos 10
        removeOnFail: { count: 5 },
        attempts: 1, // Sin reintentos — economiza requests de Upstash
      },
    };

    queues.contactSync = new Queue('contact-sync', queueDefaults);
    queues.telemetry = new Queue('telemetry', queueDefaults);
    queues.web3Events = new Queue('web3-events', queueDefaults);
    queues.anomalyDetection = new Queue('anomaly-detection', queueDefaults);
    queues.autoHealing = new Queue('auto-healing', queueDefaults);

    console.log('✅ BullMQ queues initialized');

    // ── Workers ──────────────────────────────────────────────────────────
    const workerDefaults = {
      connection,
      concurrency: 3, // Reducido para economizar requests de Redis
    };

    const contactSyncWorker = new Worker('contact-sync', processContactSync, workerDefaults);

    const telemetryWorker = new Worker('telemetry', async (job) => {
      try {
        await axios.post(`${AEGIS_URL}/aegis/v1/ingest/telemetry`, job.data, { timeout: 5000 });
      } catch (err) {
        if (isUpstashLimitError(err)) disableQueues('Upstash limit in worker');
        // No throw — no reintentar (economiza requests)
      }
    }, workerDefaults);

    const web3Worker = new Worker('web3-events', async (job) => {
      try {
        await axios.post(`${AEGIS_URL}/aegis/v1/ingest/web3`, job.data, { timeout: 5000 });
      } catch (_) { }
    }, workerDefaults);

    const anomalyWorker = new Worker('anomaly-detection', async (job) => {
      try {
        await axios.post(`${AEGIS_URL}/aegis/v1/ingest/log`, job.data, { timeout: 5000 });
      } catch (_) { }
    }, workerDefaults);

    // Detectar errores de límite en los workers
    [contactSyncWorker, telemetryWorker, web3Worker, anomalyWorker].forEach(w => {
      w.on('error', (err) => {
        if (isUpstashLimitError(err)) disableQueues('Upstash limit in worker event');
      });
    });

    module.exports.workers = { contactSyncWorker, telemetryWorker, web3Worker, anomalyWorker };

  } catch (error) {
    console.warn(`❌ Failed to initialize BullMQ: ${error.message}. Running stateless.`);
    disableQueues('BullMQ initialization error');
  }

} else {
  if (!process.env.REDIS_URL) {
    console.warn('⚠️  REDIS_URL not set — queues disabled, running in stateless mode.');
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = Object.assign(module.exports || {}, {
  connection,
  queues,
  addContactSyncJob,
  addTelemetryJob,
  addWeb3EventJob,
  addAnomalyDetectionJob,
  isRedisDisabled: () => redisDisabled,
});
