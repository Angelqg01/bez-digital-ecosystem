/**
 * api/services/gcpService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Cloud Platform integration layer for BeZhas.
 *
 * Services covered:
 *  • Secret Manager  — credentials & private keys (replaces .env secrets)
 *  • Cloud Storage   — NFT metadata, ERP documents, audit exports
 *  • Pub/Sub         — blockchain events → BigQuery streaming pipeline
 *  • Cloud Logging   — structured JSON logs (replaces console.log in prod)
 *  • Cloud Monitoring Metrics — custom Prometheus-compatible gauges
 *
 * GCP authentication:
 *  - Locally: set GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa-key.json
 *  - Cloud Run / GKE: Workload Identity (no key file needed)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { Storage } = require('@google-cloud/storage');
const { PubSub } = require('@google-cloud/pubsub');
const { Logging } = require('@google-cloud/logging');

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'bezhas-prod';
const GCP_REGION = process.env.GCP_REGION || 'europe-west1';
const GCS_BUCKET = process.env.GCS_BUCKET || 'bezhas-assets-prod';
const PUBSUB_TOPIC = process.env.PUBSUB_TOPIC || 'bezhas-blockchain-events';

// ── Disable GCP integrations in local dev unless explicitly opted in ──────────
const GCP_ENABLED = process.env.GCP_ENABLED === 'true';

// ── Lazy-initialised singletons ───────────────────────────────────────────────
let _secretClient = null;
let _storage = null;
let _pubsub = null;
let _logging = null;
let _gcpLog = null;

function getSecretClient() {
    if (!_secretClient) _secretClient = new SecretManagerServiceClient();
    return _secretClient;
}

function getStorage() {
    if (!_storage) _storage = new Storage({ projectId: GCP_PROJECT_ID });
    return _storage;
}

function getPubSub() {
    if (!_pubsub) _pubsub = new PubSub({ projectId: GCP_PROJECT_ID });
    return _pubsub;
}

function getLoggingLog() {
    if (!_gcpLog) {
        _logging = new Logging({ projectId: GCP_PROJECT_ID });
        _gcpLog = _logging.log('bezhas-api');
    }
    return _gcpLog;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  1. SECRET MANAGER
//     Fetches the latest version of a named secret. Results are in-process
//     cached per run to avoid repeated round-trips.
// ═══════════════════════════════════════════════════════════════════════════════
const _secretCache = new Map();

/**
 * Fetch a secret value from GCP Secret Manager.
 * Falls back to process.env[envFallback] when GCP is not enabled.
 *
 * @param {string} secretName  - e.g. "bezhas-jwt-secret"
 * @param {string} [envFallback] - env var name used in local dev
 * @returns {Promise<string>}
 */
async function getSecret(secretName, envFallback) {
    if (!GCP_ENABLED) {
        const val = envFallback ? process.env[envFallback] : undefined;
        if (!val) {
            throw new Error(`[GCP] Secret '${secretName}' not found. Set GCP_ENABLED=true or set env var '${envFallback}'.`);
        }
        return val;
    }

    if (_secretCache.has(secretName)) return _secretCache.get(secretName);

    const name = `projects/${GCP_PROJECT_ID}/secrets/${secretName}/versions/latest`;
    const [version] = await getSecretClient().accessSecretVersion({ name });
    const value = version.payload.data.toString('utf8');

    _secretCache.set(secretName, value);
    return value;
}

/**
 * Load all critical BeZhas secrets from Secret Manager into process.env.
 * Call this once at server startup BEFORE any route is registered.
 */
async function loadSecretsIntoEnv() {
    if (!GCP_ENABLED) {
        console.log('[GCP] GCP_ENABLED=false — using local .env secrets.');
        return;
    }

    const mapping = [
        // [secretName, envVarName]
        ['bezhas-jwt-secret', 'JWT_SECRET'],
        ['bezhas-admin-password-hash', 'ADMIN_PASSWORD_HASH'],
        ['bezhas-batcher-private-key', 'BATCHER_PRIVATE_KEY'],
        ['bezhas-edge-node-private-key', 'EDGE_NODE_PRIVATE_KEY'],
        ['bezhas-deployer-private-key', 'DEPLOYER_PRIVATE_KEY'],
        ['bezhas-bridge-api-key', 'BRIDGE_API_KEY'],
        ['bezhas-internal-api-key', 'INTERNAL_API_KEY'],
        ['bezhas-pinata-jwt', 'PINATA_JWT'],
        ['bezhas-deepseek-api-key', 'DEEPSEEK_API_KEY'],
        ['bezhas-gemini-api-key', 'GEMINI_API_KEY'],
        ['bezhas-postgres-url', 'DATABASE_URL'],
        ['bezhas-redis-url', 'REDIS_URL'],
    ];

    const results = await Promise.allSettled(
        mapping.map(async ([secret, envVar]) => {
            try {
                process.env[envVar] = await getSecret(secret, envVar);
                return { secret, ok: true };
            } catch (err) {
                // Non-blocking: log warning, keep existing env value
                console.warn(`[GCP] Could not load secret '${secret}': ${err.message}`);
                return { secret, ok: false };
            }
        })
    );

    const failed = results.filter(r => r.status === 'fulfilled' && !r.value.ok);
    if (failed.length > 0) {
        console.warn(`[GCP] ${failed.length} secrets could not be loaded from Secret Manager.`);
    } else {
        console.log('[GCP] All secrets loaded from Secret Manager.');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  2. CLOUD STORAGE  (NFT metadata, documents, audit exports)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Upload a buffer or stringifiable object to GCS.
 * @param {string} objectPath   - e.g. "nfts/metadata/0xabc.json"
 * @param {Buffer|string|object} data
 * @param {string} [contentType]
 * @returns {Promise<string>} - Public URL
 */
async function uploadToGCS(objectPath, data, contentType = 'application/json') {
    if (!GCP_ENABLED) throw new Error('[GCP] GCS not available in local mode.');

    const bucket = getStorage().bucket(GCS_BUCKET);
    const file = bucket.file(objectPath);

    const payload = typeof data === 'object' && !Buffer.isBuffer(data)
        ? JSON.stringify(data)
        : data;

    await file.save(payload, {
        contentType,
        metadata: { cacheControl: 'public, max-age=3600' },
    });

    return `https://storage.googleapis.com/${GCS_BUCKET}/${objectPath}`;
}

/**
 * Download a file from GCS as a Buffer.
 * @param {string} objectPath
 * @returns {Promise<Buffer>}
 */
async function downloadFromGCS(objectPath) {
    if (!GCP_ENABLED) throw new Error('[GCP] GCS not available in local mode.');
    const [contents] = await getStorage().bucket(GCS_BUCKET).file(objectPath).download();
    return contents;
}

/**
 * Generate a signed URL for a GCS object (for secure, time-limited access).
 * @param {string} objectPath
 * @param {number} [expiresInMinutes=60]
 * @returns {Promise<string>}
 */
async function getSignedUrl(objectPath, expiresInMinutes = 60) {
    if (!GCP_ENABLED) throw new Error('[GCP] GCS not available in local mode.');
    const options = {
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
    };
    const [url] = await getStorage().bucket(GCS_BUCKET).file(objectPath).getSignedUrl(options);
    return url;
}

/**
 * Upload an NFT metadata JSON to GCS and return the canonical IPFS-compatible URL.
 * Path: nfts/metadata/{tokenId}.json
 */
async function uploadNFTMetadata(tokenId, metadata) {
    const path = `nfts/metadata/${tokenId}.json`;
    return uploadToGCS(path, metadata, 'application/json');
}

/**
 * Upload a B2B document (PDF, XML invoice, etc.) to GCS.
 * Path: documents/{enterpriseId}/{filename}
 */
async function uploadDocument(enterpriseId, filename, buffer, mimeType) {
    const path = `documents/${enterpriseId}/${Date.now()}_${filename}`;
    return uploadToGCS(path, buffer, mimeType);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  3. CLOUD PUB/SUB  (Blockchain events → BigQuery live pipeline)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Publish a blockchain event to Pub/Sub for downstream consumption
 * (BigQuery analytics, Cloud Functions triggers, alerting).
 *
 * @param {object} event - { type, data, chainId, blockNumber, txHash }
 * @returns {Promise<string>} messageId
 */
async function publishBlockchainEvent(event) {
    if (!GCP_ENABLED) return null;

    const topic = getPubSub().topic(PUBSUB_TOPIC);
    const message = {
        data: Buffer.from(JSON.stringify({
            ...event,
            publishedAt: new Date().toISOString(),
            source: 'bezhas-api',
        })),
        attributes: {
            type: event.type || 'unknown',
            chainId: String(event.chainId || 2708),
        },
    };

    const [messageId] = await topic.publishMessage(message);
    return messageId;
}

/**
 * Create a Pub/Sub subscription for a given topic and return the subscription.
 * Typically used by Cloud Functions or worker services.
 */
async function getOrCreateSubscription(topicName, subscriptionName) {
    if (!GCP_ENABLED) return null;
    const [subscription] = await getPubSub()
        .topic(topicName)
        .subscription(subscriptionName)
        .get({ autoCreate: true });
    return subscription;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  4. CLOUD LOGGING  (Structured JSON logs → Cloud Logging)
// ═══════════════════════════════════════════════════════════════════════════════

const SEVERITY_MAP = {
    debug: 'DEBUG',
    info: 'INFO',
    notice: 'NOTICE',
    warning: 'WARNING',
    error: 'ERROR',
    critical: 'CRITICAL',
};

/**
 * Write a structured log entry to Cloud Logging.
 * Falls back to console in local mode.
 *
 * @param {'debug'|'info'|'warning'|'error'|'critical'} level
 * @param {string} message
 * @param {object} [fields] - Additional structured fields
 */
async function log(level, message, fields = {}) {
    const severity = SEVERITY_MAP[level] || 'DEFAULT';

    if (!GCP_ENABLED) {
        const prefix = `[${severity}]`;
        if (level === 'error' || level === 'critical') {
            console.error(prefix, message, fields);
        } else {
            console.log(prefix, message, fields);
        }
        return;
    }

    const gcpLog = getLoggingLog();
    const metadata = {
        severity,
        resource: { type: 'cloud_run_revision' },
        labels: { service: 'bezhas-api', region: GCP_REGION },
    };

    const entry = gcpLog.entry(metadata, { message, ...fields });
    await gcpLog.write(entry).catch(() => {
        // Never crash the server because of a logging failure
        console.warn('[GCP] Cloud Logging write failed.', message);
    });
}

// Convenience wrappers
const logger = {
    debug: (msg, fields) => log('debug', msg, fields),
    info: (msg, fields) => log('info', msg, fields),
    warning: (msg, fields) => log('warning', msg, fields),
    error: (msg, fields) => log('error', msg, fields),
    critical: (msg, fields) => log('critical', msg, fields),
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MODULE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
    // Config
    GCP_ENABLED,
    GCP_PROJECT_ID,
    GCP_REGION,
    GCS_BUCKET,

    // Secrets
    loadSecretsIntoEnv,
    getSecret,

    // Cloud Storage
    uploadToGCS,
    downloadFromGCS,
    getSignedUrl,
    uploadNFTMetadata,
    uploadDocument,

    // Pub/Sub
    publishBlockchainEvent,
    getOrCreateSubscription,

    // Logging
    logger,
};
