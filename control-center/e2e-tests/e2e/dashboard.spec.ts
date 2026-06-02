import { test, expect, Page } from '@playwright/test';

const API = '**/localhost:3001/api/**';

// ── Mock API helpers ──

/** Register all common API mocks so the frontend can render. */
async function mockAllAPIs(page: Page) {
    // Analytics stats
    await page.route('**/api/analytics/stats', route =>
        route.fulfill({
            json: {
                total_transactions: 1247,
                total_nfts: 89,
                active_contracts: 3,
                total_enterprises: 5,
                block_height: 4521,
                total_gas_used: '12.45',
            },
        }),
    );

    await page.route('**/api/analytics/kpis/realtime', route =>
        route.fulfill({
            json: {
                tx_1m: 120,
                tx_5m: 480,
                tx_1h: 5400,
                tps_1m: 2,
                tps_5m: 1.6,
                tps_1h: 1.5,
                failed_24h: 7,
                avg_gas_24h: '24500.7',
                computed_at: new Date().toISOString(),
            },
        }),
    );

    await page.route('**/api/analytics/forecast**', route => {
        const url = new URL(route.request().url());
        const metric = (url.searchParams.get('metric') || 'transactions') as 'transactions' | 'gas_used' | 'nfts_minted';
        const horizon = Number(url.searchParams.get('horizon') || 7);
        const base = metric === 'gas_used' ? 32000 : metric === 'nfts_minted' ? 22 : 140;
        const step = metric === 'gas_used' ? 900 : metric === 'nfts_minted' ? 3 : 5;

        return route.fulfill({
            json: {
                metric,
                horizon,
                model: 'baseline_linear_trend_v1',
                generated_at: new Date().toISOString(),
                points: Array.from({ length: horizon }, (_, i) => ({
                    date: new Date(Date.now() + (i + 1) * 86400000).toISOString().slice(0, 10),
                    predicted: base + i * step,
                    lower: Math.max(0, base - step * 2 + i * step),
                    upper: base + step * 2 + i * step,
                })),
            },
        });
    });

    await page.route('**/api/analytics/deltas**', route => {
        const url = new URL(route.request().url());
        const metric = (url.searchParams.get('metric') || 'transactions') as 'transactions' | 'gas_used' | 'nfts_minted';
        const windowDays = Number(url.searchParams.get('window') || 7);

        const current = metric === 'gas_used' ? 240000 : metric === 'nfts_minted' ? 42 : 980;
        const previous = metric === 'gas_used' ? 210000 : metric === 'nfts_minted' ? 39 : 910;
        const deltaAbs = current - previous;
        const deltaPct = previous === 0 ? null : Number(((deltaAbs / previous) * 100).toFixed(2));

        return route.fulfill({
            json: {
                metric,
                window_days: windowDays,
                current_total: current,
                previous_total: previous,
                delta_abs: deltaAbs,
                delta_pct: deltaPct,
                trend: deltaAbs > 0 ? 'up' : deltaAbs < 0 ? 'down' : 'flat',
                computed_at: new Date().toISOString(),
            },
        });
    });

    // Chart data
    await page.route('**/api/analytics/chart**', route =>
        route.fulfill({
            json: Array.from({ length: 14 }, (_, i) => ({
                date: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
                transactions: Math.floor(Math.random() * 50) + 10,
                gas_used: Math.floor(Math.random() * 4000) + 20000,
                nfts_minted: Math.floor(Math.random() * 10),
            })),
        }),
    );

    // Transactions — frontend expects { rows: Transaction[], total: number }
    await page.route('**/api/transactions**', route => {
        const url = new URL(route.request().url());
        if (url.pathname.match(/\/transactions\/0x/)) {
            return route.fulfill({ json: { tx_hash: '0x' + 'a'.repeat(64), status: 'confirmed', contract_name: 'BEZCoinV2', method: 'transfer', block_number: 100 } });
        }
        return route.fulfill({
            json: {
                rows: [
                    { tx_hash: '0x' + 'a'.repeat(64), contract_name: 'BEZCoinV2', method: 'transfer', from_address: '0xf39F...', status: 'confirmed', gas_used: '21000', block_number: 100, created_at: new Date().toISOString() },
                    { tx_hash: '0x' + 'b'.repeat(64), contract_name: 'BeZhasLogisticsNFT', method: 'safeMint', from_address: '0xf39F...', status: 'confirmed', gas_used: '45000', block_number: 101, created_at: new Date().toISOString() },
                ],
                total: 2,
            },
        });
    });

    // Contracts — frontend expects DeployedContract[] (flat array)
    await page.route('**/api/contracts**', route => {
        const url = new URL(route.request().url());
        if (url.pathname.includes('/contracts/') && !url.pathname.endsWith('/contracts')) {
            return route.fulfill({ json: { contract_name: 'BEZCoinV2', address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', chain_id: 31337, sector: 'core', deployed_at: new Date().toISOString() } });
        }
        return route.fulfill({
            json: [
                { contract_name: 'BEZCoinV2', address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', chain_id: 31337, sector: 'core', deployed_at: new Date().toISOString() },
                { contract_name: 'BeZhasLogisticsNFT', address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', chain_id: 31337, sector: 'logistics', deployed_at: new Date().toISOString() },
                { contract_name: 'QualityEscrow', address: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', chain_id: 31337, sector: 'core', deployed_at: new Date().toISOString() },
            ],
        });
    });

    // Gas
    await page.route('**/api/gas/status', route =>
        route.fulfill({ json: { blockNumber: 4521, gasPrice: '1000000000', baseFee: '500000000' } }),
    );
    // Gas balances — frontend expects GasBalance[] (flat array)
    await page.route('**/api/gas/balances', route =>
        route.fulfill({
            json: [
                { enterprise_id: 1, wallet_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', balance_bez: 45.5, enterprise_name: 'ColdChain Corp', sector: 'logistics', updated_at: new Date().toISOString() },
                { enterprise_id: 2, wallet_address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', balance_bez: 0.3, enterprise_name: 'AgroTech SA', sector: 'agriculture', updated_at: new Date().toISOString() },
            ],
        }),
    );

    // Sectors — frontend expects Sector[] (flat array with key, contracts, transactions, active)
    await page.route('**/api/sectors**', route => {
        const url = new URL(route.request().url());
        if (url.pathname.match(/\/sectors\/\w+/)) {
            return route.fulfill({
                json: {
                    contracts: [
                        { contract_name: 'BEZCoinV2', address: '0x5FbDB2315678afecb367f032d93F642f64180aa3', sector: 'core', chain_id: 31337 },
                    ],
                    transactions: [],
                },
            });
        }
        return route.fulfill({
            json: [
                { key: 'core', contracts: 3, transactions: 120, active: true },
                { key: 'logistics', contracts: 1, transactions: 45, active: true },
            ],
        });
    });

    // Aegis AI logs
    await page.route('**/api/aegis/logs**', route =>
        route.fulfill({
            json: {
                rows: [
                    { id: 1, module: 'anomaly_detector', action: 'telemetry_validate', severity: 'info', confidence: 0.95, output_data: '{"approved":true}', created_at: new Date().toISOString() },
                    { id: 2, module: 'anomaly_detector', action: 'telemetry_validate', severity: 'warning', confidence: 0.35, output_data: '{"approved":false}', created_at: new Date().toISOString() },
                ],
                total: 2,
            },
        }),
    );

    // Notifications
    await page.route('**/api/notifications**', route =>
        route.fulfill({ json: [] }),
    );

    // NFTs
    await page.route('**/api/nfts**', route =>
        route.fulfill({
            json: {
                rows: [
                    { token_id: 0, contract_address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', owner_address: '0x70997...', nft_type: 'logistics', minted_at: new Date().toISOString() },
                ],
                total: 1,
            },
        }),
    );

    // Gamification
    await page.route('**/api/gamification/**', route =>
        route.fulfill({ json: { achievements: [], leaderboard: [] } }),
    );

    // Health
    await page.route('**/api/health', route =>
        route.fulfill({ json: { status: 'OK', services: { database: 'up' } } }),
    );
}

// ═══════════════════════════════════════════════
//  Dashboard Home
// ═══════════════════════════════════════════════

test.describe('Dashboard Home', () => {
    test('renders stat cards and heading', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard');

        await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible();

        // Stats should render with data
        await expect(page.getByText('1,247').or(page.getByText('1247'))).toBeVisible({ timeout: 10000 });
    });

    test('shows recent transactions table', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard');

        // Table should show transaction data
        await expect(page.getByText('BEZCoinV2').first()).toBeVisible({ timeout: 10000 });
    });
});

// ═══════════════════════════════════════════════
//  Analytics Page
// ═══════════════════════════════════════════════

test.describe('Analytics Page', () => {
    test('shows forecast delta insight summary', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard/analytics');

        const forecastPanel = page.locator('div.bg-white.rounded-xl.border.border-gray-100.p-5.shadow-sm').filter({
            has: page.getByText(/Proyeccion de/),
        }).first();

        await expect(forecastPanel.getByText('Delta vs ultimo dato')).toBeVisible({ timeout: 10000 });
    });

    test('switches forecast metric from TX to Gas', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard/analytics');

        await expect(page.getByRole('heading', { name: /Analytics/i })).toBeVisible();
        await expect(page.getByText('Proyeccion de TX (7 dias)')).toBeVisible({ timeout: 10000 });

        const forecastPanel = page.locator('div.bg-white.rounded-xl.border.border-gray-100.p-5.shadow-sm').filter({
            has: page.getByText(/Proyeccion de/),
        }).first();
        await forecastPanel.getByRole('button', { name: 'Gas' }).click();
        await expect(page.getByText('Proyeccion de Gas (7 dias)')).toBeVisible({ timeout: 10000 });
    });

    test('switches forecast horizon from 7d to 14d', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard/analytics');

        await expect(page.getByText('Proyeccion de TX (7 dias)')).toBeVisible({ timeout: 10000 });
        const forecastPanel = page.locator('div.bg-white.rounded-xl.border.border-gray-100.p-5.shadow-sm').filter({
            has: page.getByText(/Proyeccion de/),
        }).first();
        await forecastPanel.getByRole('button', { name: '14d' }).click();
        await expect(page.getByText('Proyeccion de TX (14 dias)')).toBeVisible({ timeout: 10000 });
    });
});

// ═══════════════════════════════════════════════
//  Navigation
// ═══════════════════════════════════════════════

test.describe('Sidebar Navigation', () => {
    test('navigates to Contracts page', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard');

        await page.locator('a[href="/dashboard/contracts"]').click();
        await expect(page).toHaveURL(/\/dashboard\/contracts/, { timeout: 15000 });
        await expect(page.getByRole('heading', { name: /Contratos/i })).toBeVisible();
    });

    test('navigates to Gas Tanks page', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard');

        await page.locator('a[href="/dashboard/gas"]').click();
        await expect(page).toHaveURL(/\/dashboard\/gas/, { timeout: 15000 });
        await expect(page.getByRole('heading', { name: /Gas/i })).toBeVisible();
    });

    test('navigates to Transactions page', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard');

        await page.locator('a[href="/dashboard/transactions"]').click();
        await expect(page).toHaveURL(/\/dashboard\/transactions/, { timeout: 15000 });
        await expect(page.getByRole('heading', { name: /Transacciones/i })).toBeVisible();
    });

    test('navigates to Aegis AI page', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard');

        await page.locator('a[href="/dashboard/aegis"]').click();
        await expect(page).toHaveURL(/\/dashboard\/aegis/, { timeout: 15000 });
        await expect(page.getByRole('heading', { name: /Aegis/i })).toBeVisible();
    });
});

// ═══════════════════════════════════════════════
//  Contracts Page
// ═══════════════════════════════════════════════

test.describe('Contracts Page', () => {
    test('renders deployed contract table', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard/contracts');

        await expect(page.getByRole('heading', { name: /Contratos/i })).toBeVisible();
        // Table should show contract names
        await expect(page.getByText('BEZCoinV2').first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('BeZhasLogisticsNFT').first()).toBeVisible();
        await expect(page.getByText('QualityEscrow').first()).toBeVisible();
    });
});

// ═══════════════════════════════════════════════
//  Gas Tanks Page
// ═══════════════════════════════════════════════

test.describe('Gas Tanks Page', () => {
    test('renders enterprise gas balances', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard/gas');

        await expect(page.getByRole('heading', { name: /Gas/i })).toBeVisible();
        // Enterprise names from mock data
        await expect(page.getByText('ColdChain Corp').first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('AgroTech SA').first()).toBeVisible();
    });

    test('highlights low-balance tanks', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard/gas');

        // AgroTech has 0.3 BEZ (< 1.0 threshold) — should appear with warning
        await expect(page.getByText('0.3').first()).toBeVisible({ timeout: 10000 });
    });
});

// ═══════════════════════════════════════════════
//  Transactions Page
// ═══════════════════════════════════════════════

test.describe('Transactions Page', () => {
    test('renders transaction table with data', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard/transactions');

        await expect(page.getByRole('heading', { name: /Transacciones/i })).toBeVisible();
        await expect(page.getByText('confirmed').first()).toBeVisible({ timeout: 10000 });
    });
});

// ═══════════════════════════════════════════════
//  Aegis AI Page
// ═══════════════════════════════════════════════

test.describe('Aegis AI Page', () => {
    test('renders AI logs table', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard/aegis');

        await expect(page.getByRole('heading', { name: /Aegis/i })).toBeVisible();
        await expect(page.getByText('anomaly_detector').first()).toBeVisible({ timeout: 10000 });
    });
});

// ═══════════════════════════════════════════════
//  Sectors Page
// ═══════════════════════════════════════════════

test.describe('Sectors Page', () => {
    test('renders sector overview', async ({ page }) => {
        await mockAllAPIs(page);
        await page.goto('/dashboard/sectors');

        await expect(page.getByRole('heading', { name: /Sectores/i })).toBeVisible();
        await expect(page.getByText('core').first()).toBeVisible({ timeout: 10000 });
    });
});
