/**
 * PlatformDiscovery.js
 * Auto-detects running BeZhas platforms and their capabilities.
 *
 * Probes each configured platform (blockchain, web3, defi, etc.)
 * and builds a runtime capability map that the SDK and OpenClaw
 * can use to route requests intelligently.
 *
 * Usage:
 *   const discovery = require('@bezhas/openclaw-unified/lib/PlatformDiscovery');
 *   const platforms = await discovery.discover();
 *   //=> { blockchain: { alive: true, version: '2.0.0', services: {...} }, ... }
 */

'use strict';

const http = require('http');
const https = require('https');
const config = require('./ConfigManager');

const PROBE_TIMEOUT_MS = 5_000;

// ── Known platform endpoints ────────────────────────────────────────────────
const DEFAULT_PLATFORMS = {
    blockchain: {
        baseUrl: 'http://localhost:3001',
        healthPath: '/api/health',
        gatewayPath: '/api/gateway/v1/token/info',
        services: ['api', 'gateway', 'contracts', 'agents', 'wallet', 'staking'],
    },
    web3: {
        baseUrl: 'http://localhost:3002',
        healthPath: '/health',
        gatewayPath: null,
        services: ['mcp', 'ai-tools'],
    },
    'control-center': {
        baseUrl: 'http://localhost:3000',
        healthPath: '/',
        gatewayPath: null,
        services: ['dashboard', 'admin'],
    },
    aegis: {
        baseUrl: 'http://localhost:8001',
        healthPath: '/aegis/v1/health',
        gatewayPath: null,
        services: ['anomaly', 'sentiment', 'gas-predictor', 'ux-optimizer'],
    },
    'edge-node': {
        baseUrl: 'http://localhost:4000',
        healthPath: '/health',
        gatewayPath: null,
        services: ['webhook-listener', 'auto-signer'],
    },
    'defi-backend': {
        baseUrl: 'http://localhost:3003',
        healthPath: '/health',
        gatewayPath: null,
        services: ['defi'],
    },
};

/**
 * Quick HTTP probe — returns status code or null.
 */
function probe(baseUrl, path, timeoutMs = PROBE_TIMEOUT_MS) {
    return new Promise((resolve) => {
        try {
            const url = new URL(path, baseUrl);
            const lib = url.protocol === 'https:' ? https : http;
            const start = Date.now();

            const req = lib.get(url, { timeout: timeoutMs }, (res) => {
                const chunks = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => {
                    let data = null;
                    try { data = JSON.parse(Buffer.concat(chunks).toString()); } catch { /* noop */ }
                    resolve({
                        status: res.statusCode,
                        latencyMs: Date.now() - start,
                        data,
                    });
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
        } catch {
            resolve(null);
        }
    });
}

/**
 * Discover all running platforms and their capabilities.
 * @param {Object} [opts]
 * @param {boolean} [opts.includeGateway] - Also probe Gateway endpoints
 * @returns {Promise<Object>}
 */
async function discover(opts = {}) {
    await config.load();
    const cfg = config.getAll();

    // Merge configured platforms with defaults
    const platforms = { ...DEFAULT_PLATFORMS };
    if (cfg.platforms) {
        for (const [name, pCfg] of Object.entries(cfg.platforms)) {
            if (platforms[name]) {
                platforms[name] = { ...platforms[name], ...pCfg };
            } else {
                platforms[name] = {
                    healthPath: pCfg.healthPath || '/health',
                    services: [],
                    ...pCfg,
                };
            }
        }
    }

    // Probe all platforms in parallel
    const results = {};
    const probes = Object.entries(platforms).map(async ([name, pCfg]) => {
        const baseUrl = pCfg.baseUrl;
        if (!baseUrl || pCfg.enabled === false) {
            results[name] = { alive: false, reason: 'disabled' };
            return;
        }

        const healthResult = await probe(baseUrl, pCfg.healthPath);

        if (!healthResult) {
            results[name] = { alive: false, reason: 'unreachable', baseUrl };
            return;
        }

        const entry = {
            alive: healthResult.status >= 200 && healthResult.status < 500,
            baseUrl,
            httpStatus: healthResult.status,
            latencyMs: healthResult.latencyMs,
            version: healthResult.data?.version || null,
            services: pCfg.services || [],
        };

        // If gateway probe requested and available
        if (opts.includeGateway && pCfg.gatewayPath) {
            const gwResult = await probe(baseUrl, pCfg.gatewayPath);
            entry.gateway = gwResult ? {
                alive: gwResult.status >= 200 && gwResult.status < 500,
                latencyMs: gwResult.latencyMs,
            } : { alive: false };
        }

        results[name] = entry;
    });

    await Promise.all(probes);
    return results;
}

/**
 * Get a summary of which platforms are alive.
 * @returns {Promise<{ total: number, alive: number, platforms: string[] }>}
 */
async function summary() {
    const all = await discover();
    const alive = Object.entries(all).filter(([, p]) => p.alive).map(([name]) => name);
    return {
        total: Object.keys(all).length,
        alive: alive.length,
        platforms: alive,
        details: all,
    };
}

module.exports = { discover, summary, probe, DEFAULT_PLATFORMS };
