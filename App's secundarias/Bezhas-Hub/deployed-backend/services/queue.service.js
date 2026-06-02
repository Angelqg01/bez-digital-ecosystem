/**
 * BeZhas Queue Service - Enhanced for AI/ML Pipeline
 * Manages multiple specialized queues for telemetry, anomaly detection, and auto-healing
 */

let connection = null;
let queues = {
  contactSync: null,
  telemetry: null,
  web3Events: null,
  anomalyDetection: null,
  autoHealing: null
};
let retryCount = 0;
const maxRetries = 3;
const axios = require('axios');

// Aegis AI Service URL
const AEGIS_URL = process.env.AEGIS_URL || 'http://localhost:8001';

// Helper functions
const addContactSyncJob = async (userId, contacts) => {
  if (!queues.contactSync) {
    console.warn('Job queue is not available. Using in-memory processing for contact sync.');
    console.log(`Processing contact sync for user ${userId} with ${contacts.length} contacts`);
    return Promise.resolve();
  }
  await queues.contactSync.add('sync-contacts', { userId, contacts });
};

const addTelemetryJob = async (telemetryData) => {
  if (!queues.telemetry) {
    console.warn('Telemetry queue not available. Processing in-memory.');
    // Fallback: enviar directamente a Aegis
    try {
      await axios.post(`${AEGIS_URL}/aegis/v1/ingest/telemetry`, telemetryData);
    } catch (error) {
      console.error('Failed to send telemetry to Aegis:', error.message);
    }
    return Promise.resolve();
  }
  await queues.telemetry.add('process-telemetry', telemetryData);
};

const addWeb3EventJob = async (eventData) => {
  if (!queues.web3Events) {
    console.warn('Web3 events queue not available.');
    return Promise.resolve();
  }
  await queues.web3Events.add('process-web3-event', eventData);
};

const addAnomalyDetectionJob = async (logData) => {
  if (!queues.anomalyDetection) {
    console.warn('Anomaly detection queue not available.');
    return Promise.resolve();
  }
  await queues.anomalyDetection.add('detect-anomaly', logData);
};

// Only initialize Redis connection and queues if REDIS_URL is provided
if (process.env.REDIS_URL && retryCount < maxRetries) {
  const { Queue, Worker } = require('bullmq');
  const IORedis = require('ioredis');

  console.log('🚀 REDIS_URL is set. Initializing enhanced job queues...');

  try {
    const redisUrl = process.env.REDIS_URL;
    const connectionOptions = {
      maxRetriesPerRequest: null,
      retryDelayOnFailover: 1000,
      connectTimeout: 10000,
      lazyConnect: true,
      enableReadyCheck: true,
      family: 0 // Allow both IPv4 and IPv6
    };

    // Enable TLS for rediss:// protocol (Upstash, etc.)
    if (redisUrl.startsWith('rediss://')) {
      connectionOptions.tls = {
        rejectUnauthorized: false
      };
      console.log('🔒 Queue Redis TLS mode enabled for rediss:// connection');
    }

    connection = new IORedis(redisUrl, connectionOptions);

    // Error handling
    connection.on('error', (err) => {
      retryCount++;
      if (retryCount >= maxRetries) {
        console.warn(`❌ Redis connection failed after ${maxRetries} attempts. Disabling queue functionality.`);
        connection = null;
        Object.keys(queues).forEach(key => queues[key] = null);
      } else {
        console.warn(`⚠️  Redis connection error (${retryCount}/${maxRetries}):`, err.message);
      }
    });

    connection.on('connect', () => {
      console.log('✅ Redis connected successfully');
      retryCount = 0;
    });

    // Initialize specialized queues
    queues.contactSync = new Queue('contact-sync', { connection });
    queues.telemetry = new Queue('telemetry', { connection });
    queues.web3Events = new Queue('web3-events', { connection });
    queues.anomalyDetection = new Queue('anomaly-detection', { connection });
    queues.autoHealing = new Queue('auto-healing', { connection });

    console.log('✅ All queues initialized successfully');

    // Workers - Process jobs and send to Aegis

    // Telemetry Worker
    const telemetryWorker = new Worker('telemetry', async (job) => {
      const { data } = job;
      try {
        // Send to Aegis AI Service
        await axios.post(`${AEGIS_URL}/aegis/v1/ingest/telemetry`, data, {
          timeout: 5000
        });
        console.log(`📊 Telemetry sent to Aegis: ${data.component}`);
      } catch (error) {
        console.error('Failed to send telemetry to Aegis:', error.message);
        throw error; // Will retry
      }
    }, {
      connection,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 1000
      }
    });

    // Web3 Events Worker
    const web3Worker = new Worker('web3-events', async (job) => {
      const { data } = job;
      try {
        await axios.post(`${AEGIS_URL}/aegis/v1/ingest/web3`, data, {
          timeout: 5000
        });
        console.log(`⛓️  Web3 event sent to Aegis: ${data.event}`);
      } catch (error) {
        console.error('Failed to send Web3 event to Aegis:', error.message);
        throw error;
      }
    }, {
      connection,
      concurrency: 5
    });

    // Anomaly Detection Worker
    const anomalyWorker = new Worker('anomaly-detection', async (job) => {
      const { data } = job;
      try {
        await axios.post(`${AEGIS_URL}/aegis/v1/ingest/log`, data, {
          timeout: 5000
        });
        console.log(`🔍 Log sent to Aegis for anomaly detection`);
      } catch (error) {
        console.error('Failed to send log to Aegis:', error.message);
        throw error;
      }
    }, {
      connection,
      concurrency: 10
    });

    // Export workers for lifecycle management
    module.exports.workers = {
      telemetryWorker,
      web3Worker,
      anomalyWorker
    };

  } catch (error) {
    console.warn('❌ Failed to initialize Redis queue:', error.message);
    connection = null;
    Object.keys(queues).forEach(key => queues[key] = null);
  }

} else {
  if (retryCount >= maxRetries) {
    console.warn('❌ Redis max retries exceeded. Queue functionality disabled.');
  } else {
    console.warn('⚠️  REDIS_URL not found, job queue will not function.');
  }
}

module.exports = {
  connection,
  queues,
  addContactSyncJob,
  addTelemetryJob,
  addWeb3EventJob,
  addAnomalyDetectionJob
};
