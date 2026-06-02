/*  k6 load-test for BeZhas API (port 3001)
 *  Targets: 100 virtual users, 60 s duration
 *  Run (no DB):  k6 run scripts/k6-load-test.js
 *  Run (with DB): k6 run -e MODE=full scripts/k6-load-test.js
 *
 *  Without PostgreSQL only the health endpoint is tested.
 *  Set MODE=full when running with Docker (docker-compose up).
 *
 *  Thresholds
 *    - 95th percentile response time < 500ms
 *    - error rate < 5 %
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Config ──────────────────────────────────────────
const BASE = __ENV.API_URL || 'http://localhost:3001/api';
const FULL = __ENV.MODE === 'full';

export const options = {
    stages: [
        { duration: '10s', target: 50 },   // ramp up
        { duration: '30s', target: 100 },  // sustained
        { duration: '10s', target: 0 },    // ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],   // 95th < 500 ms
        http_req_failed: ['rate<0.05'],     // < 5 % errors
        errors: ['rate<0.05'],
    },
};

const errors = new Rate('errors');
const healthLatency = new Trend('health_latency');
const txLatency = new Trend('tx_latency');
const contractLatency = new Trend('contract_latency');

// ── Helpers ─────────────────────────────────────────
function get(path, tag) {
    const res = http.get(`${BASE}${path}`, { tags: { name: tag } });
    const ok = check(res, {
        [`${tag} status 200`]: (r) => r.status === 200,
    });
    errors.add(!ok);
    return res;
}

// ── Default scenario ────────────────────────────────
export default function () {

    group('Health', () => {
        const res = get('/health', 'health');
        healthLatency.add(res.timings.duration);
    });

    if (FULL) {
        group('Contracts', () => {
            const res = get('/contracts', 'contracts_list');
            contractLatency.add(res.timings.duration);
            get('/contracts/BEZCoinV2', 'contract_by_name');
        });

        group('Transactions', () => {
            const res = get('/transactions?page=1&limit=20', 'tx_list');
            txLatency.add(res.timings.duration);
        });

        group('Gas', () => {
            get('/gas/status', 'gas_status');
        });

        group('Sectors', () => {
            get('/sectors', 'sectors_list');
            get('/sectors/core', 'sector_detail');
        });

        group('NFTs', () => {
            get('/nfts?page=1&limit=10', 'nft_list');
        });

        group('Gamification', () => {
            get('/gamification/leaderboard/transactions?limit=10', 'leaderboard');
        });

        group('Market', () => {
            get('/market/stats', 'market_stats');
        });
    }

    sleep(0.3);
}

// ── Summary ─────────────────────────────────────────
export function handleSummary(data) {
    const p95 = data.metrics.http_req_duration?.values?.['p(95)'] ?? '-';
    const errRate = data.metrics.errors?.values?.rate ?? 0;
    const reqs = data.metrics.http_reqs?.values?.count ?? 0;

    const lines = [
        '═══════════════════════════════════════════',
        '  BeZhas API  ─  k6 Load Test Summary',
        '═══════════════════════════════════════════',
        `  Total requests  : ${reqs}`,
        `  p(95) latency   : ${typeof p95 === 'number' ? p95.toFixed(1) : p95} ms`,
        `  Error rate      : ${(errRate * 100).toFixed(2)} %`,
        `  Thresholds      : ${p95 < 500 && errRate < 0.01 ? 'ALL PASS ✓' : 'FAIL ✗'}`,
        '═══════════════════════════════════════════',
    ];
    console.log('\n' + lines.join('\n'));

    return {};
}
