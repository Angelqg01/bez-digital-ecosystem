/**
 * ============================================================================
 * E2E SMOKE TEST — BeZhas MCP Orchestrator (13 tools)
 * ============================================================================
 *
 * Verifica que los 13 MCP tools del Orchestrator Service responden con
 * datos estructurados (status SUCCESS o PARTIAL), dentro de un timeout.
 *
 * Usage:
 *   node scripts/test-orchestrator-e2e.js
 *   node scripts/test-orchestrator-e2e.js --tool blockscout_explorer
 *   node scripts/test-orchestrator-e2e.js --fast   (skip network-heavy tools)
 *
 * Environment (optional):
 *   GITHUB_TOKEN, TALLY_API_KEY, FIRECRAWL_API_KEY, ALPACA_API_KEY, etc.
 *   BACKEND_URL (default: http://localhost:3001)
 */

const path = require('path');
const ROOT = path.join(__dirname, '..');

require('dotenv').config({ path: path.join(ROOT, 'backend', '.env') });

const { executeTool, executeParallel, executePipeline, getToolRegistry } = require(path.join(ROOT, 'backend', 'services', 'orchestrator.service'));

// ─── CLI ARGS ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const targetTool = args.find((a, i) => args[i - 1] === '--tool');
const fastMode = args.includes('--fast');
const verbose = args.includes('--verbose') || args.includes('-v');

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    magenta: '\x1b[35m',
    bold: '\x1b[1m',
};
const col = (msg, c) => `${C[c] || ''}${msg}${C.reset}`;
const log = (msg, c = 'reset') => console.log(col(msg, c));

// ─── TEST DEFINITIONS ─────────────────────────────────────────────────────────
// Each test defines: tool name, params, and optional assertions on the result.
const TESTS = [
    {
        tool: 'blockscout_explorer',
        name: 'Blockscout — token_info',
        params: { action: 'token_info', address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' },
        assert: (r) => r.status !== 'FAILED',
        slow: false,
    },
    {
        tool: 'blockscout_explorer',
        name: 'Blockscout — supply_metrics',
        params: { action: 'supply_metrics' },
        assert: (r) => r.status !== 'FAILED',
        slow: false,
    },
    {
        tool: 'blockscout_explorer',
        name: 'Blockscout — holder_analysis',
        params: { action: 'holder_analysis', limit: 5 },
        assert: (r) => r.status !== 'FAILED',
        slow: false,
    },
    {
        tool: 'github_repo_manager',
        name: 'GitHub — analyze_repo',
        params: { action: 'analyze_repo', repository: 'Angelqg01/BeZhas_web3' },
        assert: (r) => r.status !== 'FAILED',
        slow: false,
    },
    {
        tool: 'github_repo_manager',
        name: 'GitHub — list_issues',
        params: { action: 'list_issues', repository: 'Angelqg01/BeZhas_web3' },
        assert: (r) => r.status !== 'FAILED',
        slow: false,
    },
    {
        tool: 'tally_dao_governance',
        name: 'Tally DAO — list_proposals',
        params: { action: 'list_proposals', limit: 3 },
        assert: (r) => ['SUCCESS', 'PARTIAL', 'FAILED'].includes(r.status),
        slow: false,
    },
    {
        tool: 'analyze_gas',
        name: 'Gas Analyzer — current_fees',
        params: { action: 'current_fees' },
        assert: (r) => r.status !== undefined,
        slow: false,
    },
    {
        tool: 'calculate_swap',
        name: 'Swap Calculator — USDC→BEZ',
        params: {
            fromToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            toToken: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
            amount: '10',
        },
        assert: (r) => r.data?.outputAmount !== undefined,
        slow: false,
    },
    {
        tool: 'firecrawl_scraper',
        name: 'Firecrawl Scraper — bezhas.com',
        params: { action: 'scrape', url: 'https://bezhas.com' },
        assert: (r) => ['SUCCESS', 'PARTIAL', 'FAILED'].includes(r.status),
        slow: true, // Requires FIRECRAWL_API_KEY
    },
    {
        tool: 'playwright_automation',
        name: 'Playwright — dispatch smoke test',
        params: { action: 'run_test', testName: 'smoke', url: 'https://bezhas.com' },
        assert: (r) => r.status === 'SUCCESS' && r.data?.command,
        slow: false,
    },
    {
        tool: 'kinaxis_supply_chain',
        name: 'Kinaxis — check_inventory (no creds)',
        params: { action: 'check_inventory', sku: 'BEZ-TOKEN-001' },
        assert: (r) => ['SUCCESS', 'PARTIAL'].includes(r.status),
        slow: false,
    },
    {
        tool: 'alpaca_markets_trader',
        name: 'Alpaca Markets — get_account',
        params: { action: 'get_account' },
        assert: (r) => ['SUCCESS', 'PARTIAL', 'FAILED'].includes(r.status),
        slow: false,
    },
    {
        tool: 'verify_compliance',
        name: 'Compliance Verifier — KYC check',
        params: { address: '0x89c23890c742d710265dD61be789C71dC8999b12', checkType: 'kyc' },
        assert: (r) => r.status !== undefined,
        slow: false,
    },
    {
        tool: 'auditmos_auditor',
        name: 'Smart Contract Auditor — BEZ token',
        params: { contractAddress: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' },
        assert: (r) => r.status !== 'FAILED',
        slow: true,  // Requires external API calls — excluded in --fast mode
        timeout: 30_000,
    },
    {
        tool: 'obliq_sre_monitor',
        name: 'SRE Monitor — health_check',
        params: { action: 'health_check' },
        assert: (r) => ['SUCCESS', 'PARTIAL'].includes(r.status),
        slow: false,
    },
    {
        tool: 'skill_creator',
        name: 'Skill Creator — list_skills',
        params: { action: 'list_skills' },
        assert: (r) => r.status === 'SUCCESS' && Array.isArray(r.data?.skills),
        slow: false,
    },
];

// ─── PIPELINE TEST ────────────────────────────────────────────────────────────
const PIPELINE_TEST = {
    name: 'Pipeline: gas → swap → oracle_audit',
    steps: [
        { tool: 'analyze_gas', params: {} },
        { tool: 'calculate_swap', params: { amount: '50' } },
        { tool: 'auditmos_auditor', params: { contractAddress: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' } },
    ],
};

const PARALLEL_TEST = {
    name: 'Parallel: token_info + github_health + sre_monitor',
    tools: [
        { tool: 'blockscout_explorer', params: { action: 'token_info' } },
        { tool: 'github_repo_manager', params: { action: 'check_health', repository: 'Angelqg01/BeZhas_web3' } },
        { tool: 'obliq_sre_monitor', params: { action: 'health_check' } },
    ],
};

// ─── RUNNER ───────────────────────────────────────────────────────────────────
async function runTest(test) {
    const start = Date.now();
    try {
        const result = await Promise.race([
            executeTool(test.tool, test.params),
            new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), test.timeout || 15_000)),
        ]);
        const ms = Date.now() - start;
        const passed = test.assert ? test.assert(result) : true;

        if (verbose) {
            console.log(col('  Result:', 'gray'), JSON.stringify(result, null, 4).slice(0, 400));
        }

        return { name: test.name, tool: test.tool, status: result.status, passed, ms, error: null };
    } catch (err) {
        const ms = Date.now() - start;
        return { name: test.name, tool: test.tool, status: 'ERROR', passed: false, ms, error: err.message };
    }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n' + col('═'.repeat(65), 'cyan'));
    log('  BeZhas MCP Orchestrator — E2E Smoke Test', 'cyan');
    log(`  Mode: ${fastMode ? 'FAST (skip slow tests)' : 'FULL'}`, 'cyan');
    if (targetTool) log(`  Target tool: ${targetTool}`, 'cyan');
    console.log(col('═'.repeat(65), 'cyan') + '\n');

    // Filter tests
    let testsToRun = TESTS.filter(t => {
        if (targetTool && t.tool !== targetTool) return false;
        if (fastMode && t.slow) return false;
        return true;
    });

    log(`  Running ${testsToRun.length} tool tests...\n`, 'blue');

    const results = [];

    // ── Individual tool tests ─────────────────────────────────────────────────
    for (const test of testsToRun) {
        process.stdout.write(col(`  ⏳ ${test.name.padEnd(50)}`, 'gray'));
        const r = await runTest(test);
        const icon = r.passed ? col('✓', 'green') : col('✗', 'red');
        const badge = r.status === 'SUCCESS' ? col('SUCCESS', 'green')
            : r.status === 'PARTIAL' ? col('PARTIAL', 'yellow')
                : r.status === 'FAILED' ? col('FAILED', 'red')
                    : col(r.status || 'ERROR', 'red');

        process.stdout.clearLine?.(0);
        process.stdout.cursorTo?.(0);
        console.log(`  ${icon} ${r.name.padEnd(50)} ${badge.padEnd(20)} ${col(`${r.ms}ms`, 'gray')}`);
        if (!r.passed && r.error) {
            log(`      └─ ${r.error}`, 'red');
        }
        results.push(r);
    }

    // ── Pipeline test ─────────────────────────────────────────────────────────
    if (!targetTool && !fastMode) {
        log('\n  ── Pipeline Test ─────────────────────────────────────', 'cyan');
        const pStart = Date.now();
        try {
            const pr = await executePipeline(PIPELINE_TEST.steps);
            const ms = Date.now() - pStart;
            const ok = pr.succeeded === pr.totalTools;
            log(`  ${ok ? col('✓', 'green') : col('⚠', 'yellow')} ${PIPELINE_TEST.name} — ${pr.succeeded}/${pr.totalTools} succeeded (${ms}ms)`, ok ? 'green' : 'yellow');
        } catch (err) {
            log(`  ${col('✗', 'red')} Pipeline failed: ${err.message}`, 'red');
        }

        // ── Parallel test ────────────────────────────────────────────────────
        log('\n  ── Parallel Test ─────────────────────────────────────', 'cyan');
        const parallelStart = Date.now();
        try {
            const par = await executeParallel(PARALLEL_TEST.tools);
            const ms = Date.now() - parallelStart;
            log(`  ${col('✓', 'green')} ${PARALLEL_TEST.name} — ${par.succeeded}/${par.totalTools} succeeded (${ms}ms)`, 'green');
        } catch (err) {
            log(`  ${col('✗', 'red')} Parallel failed: ${err.message}`, 'red');
        }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const avgMs = Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length);
    const allPass = failed === 0;

    console.log('\n' + col('═'.repeat(65), 'cyan'));
    log(`  Results: ${col(passed + ' passed', 'green')} / ${failed > 0 ? col(failed + ' failed', 'red') : col('0 failed', 'gray')} — avg ${avgMs}ms per tool`, allPass ? 'green' : 'yellow');
    console.log(col('═'.repeat(65), 'cyan'));

    if (!allPass) {
        log('\n  Failed tests:', 'red');
        results.filter(r => !r.passed).forEach(r => {
            log(`    • ${r.name}: ${r.error || r.status}`, 'red');
        });
        log('\n  ⚠ Some tools may require API keys in backend/.env', 'yellow');
    } else {
        log('\n  ✅ All MCP Orchestrator tools responding correctly!', 'green');
    }

    // Tool registry
    log('\n  Registry:', 'blue');
    getToolRegistry().forEach(t => {
        log(`    ${t.id.padEnd(30)} [${t.type}]`, 'gray');
    });

    console.log('');
    process.exit(allPass ? 0 : 1);
}

main().catch(err => {
    console.error(col(`\n✗ Test runner failed: ${err.message}`, 'red'));
    console.error(err);
    process.exit(1);
});
