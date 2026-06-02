import { test, expect, Page } from '@playwright/test'; import { test, expect, Page } from '@playwright/test';







































































































































































































});    }); await expect(page.getByText('PASS').first()).toBeVisible(); await expect(page.getByText('deployments')).toBeVisible({ timeout: 5000 }); await page.getByRole('button', { name: /Run Audit/i }).click(); await page.goto('/dashboard/parity'); test('displays check results table after audit', async ({ page }) => { }); await expect(page.getByText('12')).toBeVisible(); // total checks        await expect(page.getByText('Total Checks')).toBeVisible();        await expect(page.getByText('Parity Check PASSED')).toBeVisible({ timeout: 5000 });        // Wait for results        await page.getByRole('button', { name: /Run Audit/i }).click();        await page.goto('/dashboard/parity');    test('runs audit and displays results', async ({ page }) => {    });        await expect(page.getByText(/Run Audit.*to verify/i)).toBeVisible();        await page.goto('/dashboard/parity');    test('shows empty state before audit', async ({ page }) => {    });        await expect(page.getByRole('button', { name: /Run Audit/i })).toBeVisible();        await expect(page.getByText('Parity Audit')).toBeVisible();        await page.goto('/dashboard/parity');    test('renders parity page with audit button', async ({ page }) => {    });        });            localStorage.setItem('bezhas_user', JSON.stringify({ role: 'admin', address: '0xdev' }));            localStorage.setItem('bezhas_token', 'dev-token');        await page.addInitScript(() => {        await mockRuntimeAPIs(page);    test.beforeEach(async ({ page }) => {test.describe('Parity Report', () => {// ── Parity Report Tests ─────────────────────────────────────});    });        await expect(page.getByText('global').first()).toBeVisible();        await expect(page.getByText('logistics')).toBeVisible();        await page.goto('/dashboard/runtime');    test('tools table shows sector badges', async ({ page }) => {    });        await expect(page.getByText('Online', { exact: false })).toBeVisible();        await page.goto('/dashboard/runtime');    test('shows online status badge', async ({ page }) => {    });        await expect(page.getByText('incident-report')).toBeVisible();        await expect(page.getByText('bridge-health')).toBeVisible();        await page.goto('/dashboard/runtime');    test('renders tools table with tool names', async ({ page }) => {    });        await expect(page.getByText('Plugins Cargados')).toBeVisible();        await expect(page.getByText('24')).toBeVisible();        await expect(page.getByText('Tools Registradas')).toBeVisible();        await page.goto('/dashboard/runtime');    test('displays stats cards with correct values', async ({ page }) => {    });        await expect(page.getByText('v0.4.0')).toBeVisible();        await expect(page.getByText('Agent Runtime')).toBeVisible();        await page.goto('/dashboard/runtime');    test('renders runtime dashboard page', async ({ page }) => {    });        });            localStorage.setItem('bezhas_user', JSON.stringify({ role: 'admin', address: '0xdev' }));            localStorage.setItem('bezhas_token', 'dev-token');        await page.addInitScript(() => {        // Set dev auth token        await mockRuntimeAPIs(page);    test.beforeEach(async ({ page }) => {test.describe('Runtime Dashboard', () => {// ── Runtime Dashboard Tests ─────────────────────────────────}    );        route.fulfill({ json: { token: 'dev-token', user: { role: 'admin' } } }),    await page.route('**/api/auth/**', route =>    // Auth - dev mode    );        route.fulfill({ json: {} }),    await page.route('**/api/analytics/**', route =>    // Mock analytics for dashboard redirect    );        }),            },                },                    total: 3,                    ],                        { name: 'governance', version: '1.0.0', sector: 'gobierno', tools: 2, commands: 1 },                        { name: 'defi', version: '1.0.0', sector: 'finanzas', tools: 2, commands: 1 },                        { name: 'logistics', version: '1.0.0', sector: 'logistics', tools: 2, commands: 1 },                    plugins: [                data: {                status: 'success',            json: {        route.fulfill({    await page.route('**/api/runtime/plugins', route =>    );        route.fulfill({ json: MOCK_INVOKE_RESULT }),    await page.route('**/api/runtime/invoke', route =>    );        route.fulfill({ json: MOCK_PARITY }),    await page.route('**/api/runtime/parity', route =>    );        route.fulfill({ json: MOCK_COMMANDS }),    await page.route('**/api/runtime/commands', route =>    );        route.fulfill({ json: MOCK_TOOLS }),    await page.route('**/api/runtime/tools', route =>    );        route.fulfill({ json: MOCK_HEALTH }),    await page.route('**/api/runtime/health', route =>async function mockRuntimeAPIs(page: Page) {};    meta: { tool: 'bridge-health', timestamp: Date.now() },    },        finalization_lag_seconds: 45,        pending_withdrawals: 1,        pending_deposits: 0,        health: 'healthy',    data: {    status: 'success',const MOCK_INVOKE_RESULT = {};    },        ],            { category: 'plugin-contracts', name: 'defi contracts', status: 'warn', message: 'Optional contract not deployed' },            { category: 'sdk-mapping', name: 'BEZCoinV2 in contracts.js', status: 'pass', message: 'Mapped in SDK' },            { category: 'sdk-abis', name: 'BEZCoinV2 ABI', status: 'pass', message: 'ABI artifact found' },            { category: 'address-validity', name: 'BEZCoinV2 address', status: 'pass', message: 'Valid Ethereum address' },            { category: 'deployments', name: '31337.json exists', status: 'pass', message: 'Deployment file found' },        checks: [        summary: { total: 12, pass: 10, warn: 2, fail: 0 },        timestamp: Date.now(),        passed: true,    data: {    status: 'success',const MOCK_PARITY = {};    },        total: 4,        ],            { name: 'incident', description: 'Create incident', aliases: ['inc'] },            { name: 'parity-audit', description: 'Run parity audit', aliases: ['pa'] },            { name: 'validator-status', description: 'Check validators', aliases: ['vs'] },            { name: 'bridge-health', description: 'Check bridge health', aliases: ['bh'] },        commands: [    data: {    status: 'success',const MOCK_COMMANDS = {};    },        total: 6,        ],            { name: 'logistics:cargo-track', description: 'Track cargo shipments', permissions: ['runtime:read'], sector: 'logistics' },            { name: 'sector-query', description: 'Query sector agents', permissions: ['runtime:read'], sector: null },            { name: 'incident-report', description: 'Creates incident report', permissions: ['runtime:write', 'incident:create'], sector: null },            { name: 'gas-analytics', description: 'Aegis GasPredictor proxy', permissions: ['runtime:read'], sector: null },            { name: 'validator-status', description: 'Validator health monitor', permissions: ['runtime:read', 'validator:read'], sector: null },            { name: 'bridge-health', description: 'Checks L1↔L2 bridge status', permissions: ['runtime:read', 'bridge:status'], sector: null },        tools: [    data: {    status: 'success',const MOCK_TOOLS = {};    },        mcp: { state: 'CLOSED', failures: 0, lastFailure: null },        aegis: { state: 'CLOSED', failures: 0, lastFailure: null },    circuits: {    sessions_active: 2,    plugins_loaded: 3,    commands_registered: 8,    tools_registered: 24,    version: '0.4.0',    status: 'ok',const MOCK_HEALTH = {// ── Mock helpers ──────────────────────────────────────────── */ * Uses mocked API routes (no backend required). * E2E tests for Agent Runtime Dashboard & Parity Report pages./**
/**
 * E2E Tests: Agent Runtime Dashboard + Parity Report
 * Uses mocked API routes (no backend required).
 */

// ── Mock helpers ──────────────────────────────────────────────

const RUNTIME_HEALTH = {
    status: 'ok',
    version: '0.4.0',
    tools_registered: 24,
    commands_registered: 8,
    plugins_loaded: 3,
    sessions_active: 2,
    circuits: {
        aegis: { state: 'CLOSED', failures: 0, lastFailure: null },
        mcp: { state: 'CLOSED', failures: 0, lastFailure: null },
    },
};

const RUNTIME_TOOLS = {
    status: 'success',
    data: {
        total: 5,
        tools: [
            { name: 'bridge-health', description: 'L1↔L2 bridge status', permissions: ['runtime:read', 'bridge:status'], sector: null },
            { name: 'validator-status', description: 'Validator health check', permissions: ['runtime:read', 'validator:read'], sector: null },
            { name: 'gas-analytics', description: 'Gas price analysis via Aegis', permissions: ['runtime:read'], sector: null },
            { name: 'incident-report', description: 'Create incident report', permissions: ['runtime:write', 'incident:create'], sector: null },
            { name: 'sector-query', description: 'Query sector agents & tools', permissions: ['runtime:read'], sector: null },
        ],
    },
};

const RUNTIME_COMMANDS = {
    status: 'success',
    data: {
        total: 5,
        commands: [
            { name: 'bridge-health', description: 'Check bridge status', aliases: ['bh'] },
            { name: 'validator-status', description: 'Validator health', aliases: ['vs'] },
            { name: 'parity-audit', description: 'Run parity audit', aliases: ['pa'] },
            { name: 'deploy-check', description: 'Check deployment', aliases: ['dc'] },
            { name: 'incident', description: 'Create incident', aliases: ['inc'] },
        ],
    },
};

const PARITY_REPORT = {
    status: 'success',
    data: {
        passed: true,
        timestamp: Date.now(),
        summary: { total: 12, pass: 10, warn: 2, fail: 0 },
        checks: [
            { category: 'deployments', name: '31337.json exists', status: 'pass', message: 'Found 66 contracts' },
            { category: 'deployments', name: '137.json exists', status: 'pass', message: 'Found 10 contracts' },
            { category: 'address-validity', name: 'BEZCoinV2', status: 'pass', message: 'Valid address 0xd8a5...' },
            { category: 'sdk-abis', name: 'BezhasToken.json', status: 'pass', message: 'ABI found with 20 entries' },
            { category: 'sdk-mapping', name: 'contracts.js mapping', status: 'pass', message: 'All 5 chains configured' },
            { category: 'plugin-contracts', name: 'LiquidityFarming', status: 'warn', message: 'Contract declared by defi plugin, not in deployment' },
            { category: 'plugin-contracts', name: 'StakingPool', status: 'pass', message: 'Found in 31337 deployment' },
        ],
    },
};

async function mockRuntimeAPIs(page: Page) {
    await page.route('**/api/runtime/health', route => route.fulfill({ json: RUNTIME_HEALTH }));
    await page.route('**/api/runtime/tools', route => route.fulfill({ json: RUNTIME_TOOLS }));
    await page.route('**/api/runtime/commands', route => route.fulfill({ json: RUNTIME_COMMANDS }));
    await page.route('**/api/runtime/plugins', route => route.fulfill({ json: { status: 'success', data: { plugins: [], total: 0 } } }));
    await page.route('**/api/runtime/parity', route => route.fulfill({ json: PARITY_REPORT }));
    await page.route('**/api/runtime/invoke', route => route.fulfill({
        json: { status: 'success', data: { health: 'healthy' }, meta: { tool: 'bridge-health', timestamp: Date.now() } },
    }));
    // SSE stream — deliver one mock event then close
    await page.route('**/api/runtime/stream**', route => route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: `data: ${JSON.stringify({ id: 1, type: 'tool:invoke', ts: Date.now(), tool: 'bridge-health' })}\n\n`,
    }));
}

// ── Tests ─────────────────────────────────────────────────────

test.describe('Runtime Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await mockRuntimeAPIs(page);
    });

    test('shows runtime health status and version', async ({ page }) => {
        await page.goto('/dashboard/runtime');
        await expect(page.locator('text=Agent Runtime')).toBeVisible();
        await expect(page.locator('text=v0.4.0')).toBeVisible();
        await expect(page.locator('text=Online')).toBeVisible();
    });

    test('displays stat cards with correct values', async ({ page }) => {
        await page.goto('/dashboard/runtime');
        await expect(page.locator('text=Tools Registradas')).toBeVisible();
        await expect(page.locator('text=Comandos')).toBeVisible();
        await expect(page.locator('text=Plugins Cargados')).toBeVisible();
        await expect(page.locator('text=Sesiones Activas')).toBeVisible();
    });

    test('shows tools table with all registered tools', async ({ page }) => {
        await page.goto('/dashboard/runtime');
        await expect(page.locator('text=bridge-health')).toBeVisible();
        await expect(page.locator('text=incident-report')).toBeVisible();
        await expect(page.locator('text=sector-query')).toBeVisible();
    });

    test('tool invoker widget is present', async ({ page }) => {
        await page.goto('/dashboard/runtime');
        await expect(page.locator('text=Invocar Tool')).toBeVisible();
        // Select dropdown should be present
        const select = page.locator('select');
        await expect(select).toBeVisible();
    });

    test('shows circuit breaker statuses', async ({ page }) => {
        await page.goto('/dashboard/runtime');
        await expect(page.locator('text=Circuit Breakers')).toBeVisible();
        await expect(page.locator('text=aegis')).toBeVisible();
        await expect(page.locator('text=CLOSED').first()).toBeVisible();
    });

    test('shows live events panel', async ({ page }) => {
        await page.goto('/dashboard/runtime');
        await expect(page.locator('text=Eventos en Tiempo Real')).toBeVisible();
    });
});

test.describe('Parity Report', () => {
    test.beforeEach(async ({ page }) => {
        await mockRuntimeAPIs(page);
    });

    test('shows parity audit page with run button', async ({ page }) => {
        await page.goto('/dashboard/parity');
        await expect(page.locator('text=Parity Audit')).toBeVisible();
        await expect(page.locator('text=Run Audit')).toBeVisible();
    });

    test('clicking Run Audit shows results', async ({ page }) => {
        await page.goto('/dashboard/parity');
        await page.click('text=Run Audit');

        // Wait for results
        await expect(page.locator('text=Total Checks')).toBeVisible();
        await expect(page.locator('text=Passed')).toBeVisible();
        await expect(page.locator('text=Parity Check PASSED')).toBeVisible();
    });

    test('parity table shows check details', async ({ page }) => {
        await page.goto('/dashboard/parity');
        await page.click('text=Run Audit');

        await expect(page.locator('text=deployments')).toBeVisible();
        await expect(page.locator('text=31337.json exists')).toBeVisible();
        await expect(page.locator('text=PASS').first()).toBeVisible();
    });
});
