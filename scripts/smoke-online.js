#!/usr/bin/env node

const http = require('http');
const https = require('https');

const baseUrl = process.env.BEZHAS_PUBLIC_URL || process.env.VITE_API_URL || 'http://localhost:3001';
const controlCenterUrl = process.env.BEZHAS_CONTROL_CENTER_URL || 'http://localhost:3000';
const ollamaUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
const redisUrl = process.env.REDIS_URL || '';
const dbUrl = process.env.MONGODB_URI || process.env.DATABASE_URL || '';

const checks = [
    { name: 'Backend health', url: `${baseUrl}/api/health`, required: false },
    { name: 'OpenClaw health', url: `${baseUrl}/api/openclaw/health`, required: true },
    { name: 'Agents status', url: `${baseUrl}/api/agents/status`, required: true },
    { name: 'AEGIS status', url: `${baseUrl}/api/aegis/status`, required: false },
    { name: 'Control Center', url: controlCenterUrl, required: false },
    { name: 'Ollama version', url: `${ollamaUrl}/api/version`, required: false }
];

function get(url) {
    return new Promise((resolve) => {
        const client = url.startsWith('https:') ? https : http;
        const req = client.get(url, { timeout: 8000 }, (res) => {
            res.resume();
            res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 500, status: res.statusCode }));
        });
        req.on('timeout', () => {
            req.destroy();
            resolve({ ok: false, status: 'timeout' });
        });
        req.on('error', (err) => resolve({ ok: false, status: err.message }));
    });
}

(async () => {
    console.log('BeZhas online smoke checks');
    console.log(`Backend base: ${baseUrl}`);
    console.log(`Control Center: ${controlCenterUrl}`);
    console.log(`Redis configured: ${redisUrl ? 'yes' : 'no'}`);
    console.log(`DB configured: ${dbUrl ? 'yes' : 'no'}`);

    let failed = 0;
    for (const check of checks) {
        const result = await get(check.url);
        const pass = result.ok || !check.required;
        if (!pass) failed += 1;
        console.log(`${pass ? 'OK' : 'FAIL'} ${check.name}: ${result.status} ${check.url}`);
    }

    if (!redisUrl) {
        console.log('WARN Redis URL is not configured.');
    }
    if (!dbUrl) {
        console.log('WARN Database URL is not configured.');
    }

    process.exit(failed > 0 ? 1 : 0);
})();
