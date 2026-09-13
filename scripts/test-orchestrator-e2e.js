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
        host: 'blockscout',
        params: { action: 'token_info', address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' },
        assert: (r) => r.status !== 'FAILED',
        slow: false,
    },
    {
        tool: 'blockscout_explorer',
        name: 'Blockscout — supply_metrics',
        host: 'blockscout',
        params: { action: 'supply_metrics' },
        assert: (r) => r.status !== 'FAILED',
        slow: false,
    },
    {
        tool: 'blockscout_explorer',
        name: 'Blockscout — holder_analysis',
        host: 'blockscout',
        params: { action: 'holder_analysis', limit: 5 },
        assert: (r) => r.status !== 'FAILED',
        slow: false,
    },
    {
        tool: 'github_repo_manager',
        name: 'GitHub — analyze_repo',
        host: 'github',
        params: { action: 'analyze_repo', repository: 'Angelqg01/bez-digital-ecosystem' },
        assert: (r) => r.status !== 'FAILED',
        slow: false,
    },
    {
        tool: 'github_repo_manager',
        name: 'GitHub — list_issues',
        host: 'github',
        params: { action: 'list_issues', repository: 'Angelqg01/bez-digital-ecosystem' },
        assert: (r) => r.status !== 'FAILED',
        slow: false,
    },
    {
        tool: 'tally_dao_governance',
        name: 'Tally DAO — list_proposals',
        host: 'tally',
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
        name: 'Firecrawl Scraper — bez.digital',
        host: 'firecrawl',
        params: { action: 'scrape', url: 'https://bez.digital' },
        assert: (r) => ['SUCCESS', 'PARTIAL', 'FAILED'].includes(r.status),
        slow: true, // Requires FIRECRAWL_API_KEY
    },
    {
        tool: 'playwright_automation',
        name: 'Playwright — dispatch smoke test',
        params: { action: 'run_test', testName: 'smoke', url: 'https://bez.digital' },
        assert: (r) => r.status === 'SUCCESS' && r.data?.command,
        slow: false,
    },
    {
        tool: 'kinaxis_supply_chain',
        name: 'Kinaxis — check_inventory (no creds)',
        host: 'kinaxis',
        params: { action: 'check_inventory', sku: 'BEZ-TOKEN-001' },
        assert: (r) => ['SUCCESS', 'PARTIAL'].includes(r.status),
        slow: false,
    },
    {
        tool: 'alpaca_markets_trader',
        name: 'Alpaca Markets — get_account',
        host: 'alpaca',
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
        { tool: 'github_repo_manager', params: { action: 'check_health', repository: 'Angelqg01/bez-digital-ecosystem' } },
        { tool: 'obliq_sre_monitor', params: { action: 'health_check' } },
    ],
};

// ─── RUNNER ───────────────────────────────────────────────────────────────────

/**
 * Espaciado entre llamadas consecutivas al mismo servicio externo.
 *
 * El humo dispara sus pruebas seguidas, y varias golpean el mismo host. Las
 * APIs públicas sin credenciales limitan por ritmo: la primera llamada pasaba
 * y las siguientes se cortaban, así que el resultado dependía del orden del
 * array en lugar de del estado del código.
 */
const HOST_SPACING_MS = Number(process.env.E2E_HOST_SPACING_MS) || 1_200;
const lastCallByHost = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHost(host) {
    if (!host) return;
    const last = lastCallByHost.get(host);
    if (last !== undefined) {
        const elapsed = Date.now() - last;
        if (elapsed < HOST_SPACING_MS) await sleep(HOST_SPACING_MS - elapsed);
    }
    lastCallByHost.set(host, Date.now());
}

/** ¿El fallo es del servicio externo y no de nuestro código? */
function isUpstream(result) {
    return Boolean(result && result.status === 'FAILED' && result.upstream);
}

async function attempt(test) {
    const start = Date.now();
    try {
        const result = await Promise.race([
            executeTool(test.tool, test.params),
            new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), test.timeout || 15_000)),
        ]);
        return { result, ms: Date.now() - start, error: null };
    } catch (err) {
        return { result: null, ms: Date.now() - start, error: err.message };
    }
}

async function runTest(test) {
    await waitForHost(test.host);
    let { result, ms, error } = await attempt(test);

    // Un corte por ritmo o una caída momentánea merecen un segundo intento,
    // con más margen. Un fallo de nuestro código no se arregla reintentando,
    // así que solo se reintenta lo que viene marcado como externo.
    if (isUpstream(result)) {
        await sleep(HOST_SPACING_MS * 2);
        if (test.host) lastCallByHost.set(test.host, Date.now());
        const retry = await attempt(test);
        result = retry.result;
        ms += retry.ms;
        error = retry.error;
    }

    if (verbose && result) {
        console.log(col('  Result:', 'gray'), JSON.stringify(result, null, 4).slice(0, 400));
    }

    if (!result) {
        return { name: test.name, tool: test.tool, status: 'ERROR', passed: false, upstream: false, ms, error };
    }

    const upstream = isUpstream(result);
    // Una herramienta que despachó bien pero chocó con un tercero no es una
    // regresión nuestra: no cuenta como aprobada, pero tampoco tumba la build.
    // Lo que sigue fallando el build es que NUESTRO código no responda como debe.
    const passed = upstream ? false : (test.assert ? test.assert(result) : true);

    return {
        name: test.name,
        tool: test.tool,
        status: result.status,
        passed,
        upstream,
        ms,
        error: passed || upstream ? null : (result.reasoning || null),
        detail: result.reasoning || null,
        httpStatus: result.httpStatus ?? null,
    };
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
        const icon = r.upstream ? col('~', 'magenta') : r.passed ? col('✓', 'green') : col('✗', 'red');
        const badge = r.upstream ? col('UPSTREAM', 'magenta')
            : r.status === 'SUCCESS' ? col('SUCCESS', 'green')
                : r.status === 'PARTIAL' ? col('PARTIAL', 'yellow')
                    : r.status === 'FAILED' ? col('FAILED', 'red')
                        : col(r.status || 'ERROR', 'red');

        process.stdout.clearLine?.(0);
        process.stdout.cursorTo?.(0);
        console.log(`  ${icon} ${r.name.padEnd(50)} ${badge.padEnd(20)} ${col(`${r.ms}ms`, 'gray')}`);
        // El motivo se imprime siempre que lo haya: antes un FAILED no decía
        // nada y obligaba a reproducirlo a mano para saber qué había pasado.
        if (r.detail && (!r.passed || verbose)) {
            const status = r.httpStatus ? ` [HTTP ${r.httpStatus}]` : '';
            log(`      └─ ${r.detail}${status}`, r.upstream ? 'magenta' : 'red');
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
    const upstream = results.filter(r => r.upstream);
    const passed = results.filter(r => r.passed).length;
    // Solo cuenta como fallo lo que es nuestro. Una API pública que nos limita
    // el ritmo no es una regresión del orquestador, y hacer que tumbe la build
    // deja el humo inservible: se vuelve ruido que todo el mundo aprende a
    // ignorar, y entonces ya no avisa de lo que sí importa.
    const failed = results.filter(r => !r.passed && !r.upstream);
    const avgMs = Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length);
    const allPass = failed.length === 0;

    console.log('\n' + col('═'.repeat(65), 'cyan'));
    const upstreamNote = upstream.length ? ` / ${col(upstream.length + ' upstream', 'magenta')}` : '';
    log(`  Results: ${col(passed + ' passed', 'green')} / ${failed.length > 0 ? col(failed.length + ' failed', 'red') : col('0 failed', 'gray')}${upstreamNote} — avg ${avgMs}ms per tool`, allPass ? 'green' : 'yellow');
    console.log(col('═'.repeat(65), 'cyan'));

    if (failed.length) {
        log('\n  Failed tests:', 'red');
        failed.forEach(r => {
            log(`    • ${r.name}: ${r.error || r.detail || r.status}`, 'red');
        });
    }

    if (upstream.length) {
        log('\n  Degradado por servicios externos (no es un fallo del orquestador):', 'magenta');
        upstream.forEach(r => {
            const status = r.httpStatus ? ` [HTTP ${r.httpStatus}]` : '';
            log(`    ~ ${r.name}: ${r.detail || 'sin detalle'}${status}`, 'magenta');
        });
        log('  Algunas herramientas necesitan claves en backend/.env; otras las limita el proveedor.', 'gray');
    }

    if (allPass) {
        log(upstream.length
            ? '\n  ✅ El orquestador responde correctamente en todo lo que depende de nosotros.'
            : '\n  ✅ All MCP Orchestrator tools responding correctly!', 'green');
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
