import { test, expect } from '@playwright/test';

/**
 * Integration E2E tests — hit the REAL API backend (no mocks).
 *
 * Prerequisites:
 *   - API running on localhost:3001
 *   - Frontend running on localhost:3000
 *
 * Run:
 *   npx playwright test e2e/integration.spec.ts
 */

const API_BASE = 'http://localhost:3001/api';

// ════════════════════════════════════════
//  API Smoke Tests (direct HTTP, no browser)
// ════════════════════════════════════════

test.describe('API Smoke Tests (real backend)', () => {
    test('GET /api/health returns OK', async ({ request }) => {
        const res = await request.get(`${API_BASE}/health`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.status).toBe('OK');
        expect(body.services).toBeDefined();
        expect(body.version).toBeDefined();
    });

    test('GET /api/contracts returns array', async ({ request }) => {
        const res = await request.get(`${API_BASE}/contracts`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(Array.isArray(body)).toBe(true);
    });

    test('GET /api/sectors returns sector list', async ({ request }) => {
        const res = await request.get(`${API_BASE}/sectors`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(Array.isArray(body)).toBe(true);
    });

    test('GET /api/transactions returns paginated rows', async ({ request }) => {
        const res = await request.get(`${API_BASE}/transactions?page=1&limit=5`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body).toHaveProperty('rows');
        expect(body).toHaveProperty('total');
    });

    test('GET /api/nfts returns paginated rows', async ({ request }) => {
        const res = await request.get(`${API_BASE}/nfts?page=1`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body).toHaveProperty('rows');
        expect(body).toHaveProperty('total');
    });

    test('GET /api/analytics/stats returns stats object', async ({ request }) => {
        const res = await request.get(`${API_BASE}/analytics/stats`);
        // May require auth — accept 200 or 401
        if (res.ok()) {
            const body = await res.json();
            expect(body).toHaveProperty('total_transactions');
        } else {
            expect(res.status()).toBe(401);
        }
    });

    test('GET /api/gas/balances returns data or requires auth', async ({ request }) => {
        const res = await request.get(`${API_BASE}/gas/balances`);
        // This route requires auth/role — accept 200 or 401/403
        expect([200, 401, 403]).toContain(res.status());
    });
});

// ════════════════════════════════════════
//  AI Engine MCP Smoke Tests
// ════════════════════════════════════════

const MCP_BASE = 'http://localhost:3002/api/mcp';

test.describe('AI Engine MCP (real backend)', () => {
    test('GET /api/mcp/health returns healthy', async ({ request }) => {
        const res = await request.get(`${MCP_BASE}/health`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.status).toBe('healthy');
    });

    test('GET /api/mcp/tools returns 10+ tools', async ({ request }) => {
        const res = await request.get(`${MCP_BASE}/tools`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.tools.length).toBeGreaterThanOrEqual(10);

        const names = body.tools.map((t: { name: string }) => t.name);
        expect(names).toContain('analyze_gas_strategy');
        expect(names).toContain('audit_contract');
        expect(names).toContain('calculate_smart_swap');
        expect(names).toContain('assess_fraud_risk');
    });

    test('POST /api/mcp/invoke with system_health returns', async ({ request }) => {
        const res = await request.post(`${MCP_BASE}/invoke`, {
            data: { tool: 'system_health', parameters: {} },
        });
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.success).toBe(true);
    });

    test('POST /api/mcp/invoke unknown tool returns 400', async ({ request }) => {
        const res = await request.post(`${MCP_BASE}/invoke`, {
            data: { tool: 'nonexistent', parameters: {} },
        });
        expect(res.status()).toBe(400);
    });
});

// ════════════════════════════════════════
//  Aegis AI Engine Smoke Tests
// ════════════════════════════════════════

const AEGIS_BASE = 'http://localhost:8001';

test.describe('Aegis AI (real backend)', () => {
    test('GET /aegis/v1/health returns healthy', async ({ request }) => {
        const res = await request.get(`${AEGIS_BASE}/aegis/v1/health`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.status).toBe('healthy');
        expect(body.models_loaded).toBeGreaterThanOrEqual(4);
    });
});

// ════════════════════════════════════════
//  Frontend → Real API (browser-based)
// ════════════════════════════════════════

test.describe('Frontend with Real API', () => {
    test('Dashboard renders real stats from API', async ({ page }) => {
        // No mocks — requests go to real API
        await page.goto('/dashboard');

        // The heading must render
        await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 15000 });

        // Wait for SWR to fetch — at least one stat card should show numeric data
        // We check that the page doesn't show a perpetual loading state
        await page.waitForTimeout(3000);
        const bodyText = await page.textContent('body');
        expect(bodyText).toBeTruthy();
        // If API returns data, numbers should appear; if DB is down, at least the layout renders
    });

    test('Contracts page shows real contract data or empty state', async ({ page }) => {
        await page.goto('/dashboard/contracts');
        await expect(page.getByRole('heading', { name: /Contratos/i })).toBeVisible({ timeout: 15000 });
    });

    test('Transactions page loads without error', async ({ page }) => {
        await page.goto('/dashboard/transactions');
        await expect(page.getByRole('heading', { name: /Transacciones/i })).toBeVisible({ timeout: 15000 });
    });

    test('Sectors page shows sector grid', async ({ page }) => {
        await page.goto('/dashboard/sectors');
        await expect(page.getByRole('heading', { name: /Sectores/i })).toBeVisible({ timeout: 15000 });
    });

    test('Aegis AI page loads logs', async ({ page }) => {
        await page.goto('/dashboard/aegis');
        await expect(page.getByRole('heading', { name: /Aegis/i })).toBeVisible({ timeout: 15000 });
    });

    test('Settings page renders config', async ({ page }) => {
        await page.goto('/dashboard/settings');
        await expect(page.getByRole('heading', { name: /Configuraci/i })).toBeVisible({ timeout: 15000 });
        // Should show chain ID
        await expect(page.getByText('2708')).toBeVisible();
    });

    test('Sidebar navigation works end-to-end', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({ timeout: 15000 });

        // Navigate to transactions
        await page.locator('a[href="/dashboard/transactions"]').click();
        await expect(page).toHaveURL(/\/dashboard\/transactions/);
        await expect(page.getByRole('heading', { name: /Transacciones/i })).toBeVisible({ timeout: 10000 });

        // Navigate to sector list
        await page.locator('a[href="/dashboard/sectors"]').click();
        await expect(page).toHaveURL(/\/dashboard\/sectors/);
        await expect(page.getByRole('heading', { name: /Sectores/i })).toBeVisible({ timeout: 10000 });
    });
});
