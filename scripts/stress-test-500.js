/**
 * ============================================================================
 * BEZHAS STRESS TEST — 500 Concurrent Wallet + Payment + Chatbot Simulation
 * ============================================================================
 *
 * Run: node scripts/stress-test-500.js [--target http://localhost:3001] [--concurrency 500]
 *
 * Simulates:
 * 1. 500 concurrent WebSocket wallet connections
 * 2. Parallel crypto payment initiations (POST /api/crypto/quote)
 * 3. Parallel chatbot queries (POST /api/chat)
 * 4. Health endpoint hammering (GET /api/health)
 *
 * Metrics collected:
 * - p50 / p95 / p99 latencies
 * - Error rates per endpoint
 * - WebSocket connection drop rate
 * - Throughput (req/sec)
 *
 * @requires ws (WebSocket client)
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// ─── CLI ARGS ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, def) => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
};

const TARGET = getArg('--target', 'http://localhost:3001');
const CONCURRENCY = parseInt(getArg('--concurrency', '500'), 10);
const DURATION_SEC = parseInt(getArg('--duration', '30'), 10);

// ─── TEST WALLETS ──────────────────────────────────────────────────────────────
function randomWallet() {
    const hex = '0123456789abcdef';
    let addr = '0x';
    for (let i = 0; i < 40; i++) addr += hex[Math.floor(Math.random() * 16)];
    return addr;
}

// ─── HTTP REQUEST HELPER ───────────────────────────────────────────────────────
function makeRequest(method, path, body = null) {
    return new Promise((resolve) => {
        const url = new URL(path, TARGET);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;
        const start = Date.now();

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            timeout: 10000,
        };

        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    latency: Date.now() - start,
                    status: res.statusCode,
                    ok: res.statusCode >= 200 && res.statusCode < 400,
                    body: data,
                });
            });
        });

        req.on('error', () => {
            resolve({ latency: Date.now() - start, status: 0, ok: false, error: true });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ latency: Date.now() - start, status: 0, ok: false, timeout: true });
        });

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// ─── METRICS COLLECTOR ─────────────────────────────────────────────────────────
class MetricsCollector {
    constructor(name) {
        this.name = name;
        this.latencies = [];
        this.successes = 0;
        this.failures = 0;
        this.timeouts = 0;
    }

    record(result) {
        this.latencies.push(result.latency);
        if (result.timeout) this.timeouts++;
        else if (result.ok) this.successes++;
        else this.failures++;
    }

    percentile(p) {
        if (this.latencies.length === 0) return 0;
        const sorted = [...this.latencies].sort((a, b) => a - b);
        const idx = Math.ceil(p / 100 * sorted.length) - 1;
        return sorted[Math.max(0, idx)];
    }

    report() {
        const total = this.successes + this.failures + this.timeouts;
        const errorRate = total > 0 ? ((this.failures + this.timeouts) / total * 100).toFixed(1) : 0;
        return {
            endpoint: this.name,
            total,
            successes: this.successes,
            failures: this.failures,
            timeouts: this.timeouts,
            errorRate: `${errorRate}%`,
            p50: `${this.percentile(50)}ms`,
            p95: `${this.percentile(95)}ms`,
            p99: `${this.percentile(99)}ms`,
            throughput: total > 0 ? `${(total / DURATION_SEC).toFixed(1)} req/s` : '0 req/s',
        };
    }
}

// ─── TEST SCENARIOS ────────────────────────────────────────────────────────────
async function testHealth(metrics) {
    const result = await makeRequest('GET', '/api/health');
    metrics.record(result);
}

async function testCryptoQuote(metrics) {
    const result = await makeRequest('POST', '/api/crypto/quote', {
        amount: Math.random() * 1000,
        currency: ['USDT', 'USDC', 'MATIC'][Math.floor(Math.random() * 3)],
    });
    metrics.record(result);
}

async function testChatbot(metrics) {
    const messages = [
        '¿Cuál es el precio actual de BEZ?',
        '¿Cómo funciona el staking?',
        '¿Qué es un NFT?',
        '¿Cómo puedo comprar BEZ tokens?',
        '¿Cuáles son las tarifas de gas?',
        'Quiero saber sobre la DAO',
        '¿Cómo funciona el marketplace?',
        'Explícame el Quality Oracle',
    ];

    const result = await makeRequest('POST', '/api/chat', {
        message: messages[Math.floor(Math.random() * messages.length)],
        userId: randomWallet(),
    });
    metrics.record(result);
}

async function testPaymentStatus(metrics) {
    const result = await makeRequest('GET', '/api/health');
    metrics.record(result);
}

async function testTokenPrice(metrics) {
    const result = await makeRequest('GET', '/api/token/price');
    metrics.record(result);
}

// ─── WEBSOCKET STRESS ──────────────────────────────────────────────────────────
async function testWebSocketConnections(count) {
    let connected = 0;
    let failed = 0;
    let dropped = 0;

    const wsUrl = TARGET.replace('http', 'ws');

    // Try to use 'ws' module, fallback to reporting N/A
    let WebSocket;
    try {
        WebSocket = require('ws');
    } catch (e) {
        return {
            attempted: count,
            connected: 'N/A (ws module not installed)',
            failed: 'N/A',
            dropped: 'N/A',
            note: 'Install "ws" package to enable WebSocket stress testing: npm i ws',
        };
    }

    const promises = [];
    for (let i = 0; i < count; i++) {
        promises.push(
            new Promise((resolve) => {
                try {
                    const ws = new WebSocket(wsUrl, {
                        timeout: 5000,
                        headers: { 'x-wallet-address': randomWallet() },
                    });

                    const timeout = setTimeout(() => {
                        ws.terminate();
                        failed++;
                        resolve();
                    }, 5000);

                    ws.on('open', () => {
                        connected++;
                        clearTimeout(timeout);
                        // Hold connection for 2 seconds then close
                        setTimeout(() => {
                            ws.close();
                            resolve();
                        }, 2000);
                    });

                    ws.on('error', () => {
                        clearTimeout(timeout);
                        failed++;
                        resolve();
                    });

                    ws.on('close', (code) => {
                        if (code !== 1000 && code !== 1005) dropped++;
                    });
                } catch (e) {
                    failed++;
                    resolve();
                }
            })
        );
    }

    await Promise.allSettled(promises);
    return { attempted: count, connected, failed, dropped };
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║           BeZhas Stress Test — ${CONCURRENCY} Concurrent Connections         ║
╠══════════════════════════════════════════════════════════════╣
║  Target:      ${TARGET.padEnd(44)}║
║  Concurrency: ${String(CONCURRENCY).padEnd(44)}║
║  Duration:    ${(DURATION_SEC + 's').padEnd(44)}║
╚══════════════════════════════════════════════════════════════╝
`);

    // 1. Health check baseline
    console.log('🏥 Phase 1: Health check baseline...');
    const baseResult = await makeRequest('GET', '/api/health');
    if (!baseResult.ok) {
        console.error(`❌ Server not responding at ${TARGET}/api/health (status: ${baseResult.status})`);
        console.log('   Make sure the backend is running and accessible.');
        process.exit(1);
    }
    console.log(`   ✅ Server responded in ${baseResult.latency}ms\n`);

    // 2. HTTP endpoint stress
    console.log(`🔥 Phase 2: HTTP endpoint stress (${DURATION_SEC}s)...`);
    const healthMetrics = new MetricsCollector('GET /api/health');
    const cryptoMetrics = new MetricsCollector('POST /api/crypto/quote');
    const chatMetrics = new MetricsCollector('POST /api/chat');
    const priceMetrics = new MetricsCollector('GET /api/token/price');

    const endTime = Date.now() + DURATION_SEC * 1000;
    const workers = [];

    for (let i = 0; i < CONCURRENCY; i++) {
        workers.push((async () => {
            while (Date.now() < endTime) {
                const scenario = Math.random();
                if (scenario < 0.3) await testHealth(healthMetrics);
                else if (scenario < 0.55) await testCryptoQuote(cryptoMetrics);
                else if (scenario < 0.85) await testChatbot(chatMetrics);
                else await testTokenPrice(priceMetrics);
            }
        })());
    }

    await Promise.allSettled(workers);

    // 3. WebSocket stress
    console.log(`🔌 Phase 3: WebSocket connection stress (${Math.min(CONCURRENCY, 200)} connections)...`);
    const wsResults = await testWebSocketConnections(Math.min(CONCURRENCY, 200));

    // 4. Report
    console.log('\n' + '═'.repeat(80));
    console.log('                    📊 STRESS TEST RESULTS');
    console.log('═'.repeat(80));

    const allMetrics = [healthMetrics, cryptoMetrics, chatMetrics, priceMetrics];
    const reports = allMetrics.map(m => m.report());

    // Table header
    console.log('\n┌─────────────────────────┬───────┬──────────┬──────────┬────────┬────────┬────────┬─────────────┐');
    console.log('│ Endpoint                │ Total │ Success  │ Failures │  p50   │  p95   │  p99   │  Throughput  │');
    console.log('├─────────────────────────┼───────┼──────────┼──────────┼────────┼────────┼────────┼─────────────┤');

    for (const r of reports) {
        console.log(
            `│ ${r.endpoint.padEnd(23)} │ ${String(r.total).padStart(5)} │ ${String(r.successes).padStart(8)} │ ${String(r.failures).padStart(8)} │ ${r.p50.padStart(6)} │ ${r.p95.padStart(6)} │ ${r.p99.padStart(6)} │ ${r.throughput.padStart(11)} │`
        );
    }

    console.log('└─────────────────────────┴───────┴──────────┴──────────┴────────┴────────┴────────┴─────────────┘');

    // WebSocket results
    console.log('\n🔌 WebSocket Results:');
    for (const [key, value] of Object.entries(wsResults)) {
        console.log(`   ${key}: ${value}`);
    }

    // Overall assessment
    const totalReqs = reports.reduce((s, r) => s + r.total, 0);
    const totalFails = reports.reduce((s, r) => s + r.failures + r.timeouts, 0);
    const overallErrorRate = totalReqs > 0 ? (totalFails / totalReqs * 100).toFixed(1) : 0;

    console.log('\n📈 Overall:');
    console.log(`   Total requests:    ${totalReqs}`);
    console.log(`   Overall error rate: ${overallErrorRate}%`);
    console.log(`   Overall throughput: ${(totalReqs / DURATION_SEC).toFixed(1)} req/s`);

    const severity = overallErrorRate > 10 ? '🔴 CRITICAL' : overallErrorRate > 5 ? '🟡 WARNING' : '🟢 HEALTHY';
    console.log(`   System status:     ${severity}`);

    console.log('\n' + '═'.repeat(80));
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
