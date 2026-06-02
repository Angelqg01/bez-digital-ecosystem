#!/usr/bin/env node

/**
 * Secure local health checker for BeZhas services.
 * - No PowerShell Invoke-RestMethod usage
 * - Strict localhost allowlist to avoid outbound SSRF behavior
 * - Response size limit to reduce risk from hostile payloads
 */

const http = require('http');
const https = require('https');

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const ALLOWED_TARGETS = new Set([
    'http://localhost:3001/api/health',
    'http://127.0.0.1:3001/api/health',
    'http://localhost:8001/aegis/v1/health',
    'http://127.0.0.1:8001/aegis/v1/health',
    'http://localhost:3002/api/mcp/health',
    'http://127.0.0.1:3002/api/mcp/health',
    'http://localhost:3002/api/mcp/invoke',
    'http://127.0.0.1:3002/api/mcp/invoke',
]);

const TIMEOUT_MS = 6000;
const MAX_RESPONSE_BYTES = 64 * 1024;

function assertAllowedUrl(urlString) {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`Blocked protocol: ${url.protocol}`);
    }
    if (!ALLOWED_HOSTS.has(url.hostname)) {
        throw new Error(`Blocked host: ${url.hostname}`);
    }
    if (!ALLOWED_TARGETS.has(urlString)) {
        throw new Error(`Blocked target path: ${urlString}`);
    }
    return url;
}

function requestJson({ method, url, body }) {
    const parsed = assertAllowedUrl(url);
    const client = parsed.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;

        const req = client.request(
            {
                protocol: parsed.protocol,
                hostname: parsed.hostname,
                port: parsed.port,
                path: `${parsed.pathname}${parsed.search}`,
                method,
                timeout: TIMEOUT_MS,
                headers: {
                    Accept: 'application/json',
                    ...(payload
                        ? {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(payload),
                        }
                        : {}),
                },
            },
            (res) => {
                let raw = '';
                let size = 0;

                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    size += Buffer.byteLength(chunk);
                    if (size > MAX_RESPONSE_BYTES) {
                        req.destroy(new Error('Response too large'));
                        return;
                    }
                    raw += chunk;
                });

                res.on('end', () => {
                    try {
                        const json = raw ? JSON.parse(raw) : {};
                        resolve({
                            statusCode: res.statusCode || 0,
                            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
                            data: json,
                        });
                    } catch {
                        reject(new Error('Non-JSON response blocked'));
                    }
                });
            }
        );

        req.on('timeout', () => req.destroy(new Error('Request timeout')));
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function main() {
    const results = [];

    const checks = [
        {
            service: 'api',
            method: 'GET',
            url: 'http://localhost:3001/api/health',
            summarize: (r) => `${r.data.status || 'unknown'} db=${r.data.services?.database || 'unknown'}`,
        },
        {
            service: 'aegis',
            method: 'GET',
            url: 'http://localhost:8001/aegis/v1/health',
            summarize: (r) => `${r.data.status || 'unknown'} models=${(r.data.models_loaded || []).length}`,
        },
        {
            service: 'ai-engine',
            method: 'GET',
            url: 'http://localhost:3002/api/mcp/health',
            summarize: (r) => r.data.status || 'unknown',
        },
        {
            service: 'ai-engine-invoke',
            method: 'POST',
            url: 'http://localhost:3002/api/mcp/invoke',
            body: { tool: 'system_health', parameters: {} },
            summarize: (r) => `success=${r.data.success} result=${r.data.result?.success}`,
        },
    ];

    for (const check of checks) {
        try {
            const res = await requestJson(check);
            results.push({
                service: check.service,
                ok: res.ok,
                detail: check.summarize(res),
            });
        } catch (err) {
            results.push({
                service: check.service,
                ok: false,
                detail: err.message,
            });
        }
    }

    const allOk = results.every((r) => r.ok);
    console.log(JSON.stringify({ allOk, results }, null, 2));
    process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
    console.error(JSON.stringify({ allOk: false, error: err.message }, null, 2));
    process.exit(1);
});
