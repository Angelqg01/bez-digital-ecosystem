/**
 * k6 Load Test — BeZhas Agent Runtime Endpoints
 *
 * Usage:
 *   k6 run scripts/k6-runtime-load.js
 *   k6 run scripts/k6-runtime-load.js --env MODE=full  # includes invoke/command
 *
 * Thresholds:
 *   p(95) < 500ms, error rate < 5%
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.API_URL || 'http://localhost:3001/api';
const MODE = __ENV.MODE || 'basic';
const TOKEN = __ENV.TOKEN || 'dev-jwt-token';

// Custom metrics
const errorRate = new Rate('errors');
const runtimeLatency = new Trend('runtime_latency_ms');

export const options = {
    stages: [
        { duration: '10s', target: 50 },   // Ramp up
        { duration: '30s', target: 100 },   // Sustain
        { duration: '10s', target: 0 },      // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],
        errors: ['rate<0.05'],
    },
};

const authHeaders = {
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
    },
};

export default function () {
    // 1. Health check (no auth required)
    const health = http.get(`${BASE}/runtime/health`);
    check(health, {
        'health status 200': (r) => r.status === 200,
        'health reports ok': (r) => {
            try { return JSON.parse(r.body).status === 'ok'; } catch { return false; }
        },
    }) || errorRate.add(1);
    runtimeLatency.add(health.timings.duration);

    sleep(0.2);

    // 2. List tools (auth required)
    const tools = http.get(`${BASE}/runtime/tools`, authHeaders);
    check(tools, {
        'tools status 200 or 401': (r) => r.status === 200 || r.status === 401,
    }) || errorRate.add(1);
    runtimeLatency.add(tools.timings.duration);

    sleep(0.2);

    // 3. List commands
    const commands = http.get(`${BASE}/runtime/commands`, authHeaders);
    check(commands, {
        'commands status 200 or 401': (r) => r.status === 200 || r.status === 401,
    }) || errorRate.add(1);

    sleep(0.2);

    // 4. Plugins list
    const plugins = http.get(`${BASE}/runtime/plugins`, authHeaders);
    check(plugins, {
        'plugins status 200 or 401': (r) => r.status === 200 || r.status === 401,
    }) || errorRate.add(1);

    sleep(0.2);

    // 5. Circuit breakers
    const circuits = http.get(`${BASE}/runtime/circuits`, authHeaders);
    check(circuits, {
        'circuits status 200 or 401': (r) => r.status === 200 || r.status === 401,
    }) || errorRate.add(1);

    if (MODE === 'full') {
        sleep(0.2);

        // 6. Invoke a read-only tool
        const invokeRes = http.post(`${BASE}/runtime/invoke`,
            JSON.stringify({ tool: 'bridge-health', params: {} }),
            authHeaders,
        );
        check(invokeRes, {
            'invoke status 200 or 401 or 403': (r) => [200, 401, 403].includes(r.status),
        }) || errorRate.add(1);
        runtimeLatency.add(invokeRes.timings.duration);

        sleep(0.2);

        // 7. Execute a slash command
        const cmdRes = http.post(`${BASE}/runtime/command`,
            JSON.stringify({ input: '/bridge-health' }),
            authHeaders,
        );
        check(cmdRes, {
            'command status 200 or 401 or 403': (r) => [200, 401, 403].includes(r.status),
        }) || errorRate.add(1);
        runtimeLatency.add(cmdRes.timings.duration);
    }

    sleep(0.3);
}

export function handleSummary(data) {
    const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
    const errRate = data.metrics.errors?.values?.rate || 0;
    const total = data.metrics.http_reqs?.values?.count || 0;
    const p95Pass = p95 < 500 ? '✓ PASS' : '✗ FAIL';
    const errPass = errRate < 0.05 ? '✓ PASS' : '✗ FAIL';

    console.log('\n══════════════════════════════════════════');
    console.log(' BeZhas Agent Runtime — k6 Load Test Results');
    console.log('══════════════════════════════════════════');
    console.log(`  Total requests:  ${total}`);
    console.log(`  p(95) latency:   ${p95.toFixed(1)}ms   ${p95Pass}`);
    console.log(`  Error rate:      ${(errRate * 100).toFixed(2)}%  ${errPass}`);
    console.log('══════════════════════════════════════════\n');

    return {};
}
