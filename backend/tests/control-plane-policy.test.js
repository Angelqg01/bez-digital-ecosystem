const express = require('express');
const request = require('supertest');

const controlPlaneRoutes = require('../routes/control-plane.routes');
const {
    buildManifest,
    createDeprecatedSubappRoute,
    getCapabilityTarget,
    getSubappRegistry
} = require('../control-plane/policy');

describe('BeZhas Hub control-plane policy', () => {
    test('Hub owns only control-plane capabilities', () => {
        const manifest = buildManifest();

        expect(manifest.hubRole).toBe('control-plane');
        expect(manifest.ownedCapabilities).toEqual(expect.arrayContaining([
            'auth_sso',
            'permissions_rbac',
            'developer_console',
            'billing_subscription',
            'global_notifications',
            'observability_dashboard',
            'app_switcher'
        ]));
        expect(manifest.policyFlags.hubExecutesWalletTransactions).toBe(false);
        expect(manifest.policyFlags.hubExecutesTokenPurchases).toBe(false);
        expect(manifest.policyFlags.hubExecutesBridgeTransfers).toBe(false);
        expect(manifest.policyFlags.hubExecutesDefiRuntime).toBe(false);
        expect(manifest.utilityValidatorToken).toMatchObject({
            name: 'BEZ-Coin',
            symbol: 'BEZ',
            address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
            role: 'utility-validator-token',
            status: 'active'
        });
    });

    test('runtime capabilities are mapped to their dedicated SubApps', () => {
        expect(getCapabilityTarget('wallet_operations')).toMatchObject({
            appKey: 'wallet',
            appName: 'BeZhas Wallet',
            targetUrl: 'http://localhost:3010/wallet'
        });

        expect(getCapabilityTarget('bridge_operations')).toMatchObject({
            appKey: 'wallet',
            targetUrl: 'http://localhost:3010/bridge'
        });

        expect(getCapabilityTarget('staking_operations')).toMatchObject({
            appKey: 'capital',
            appName: 'BZ Capital',
            targetUrl: 'http://localhost:3014/staking'
        });

        expect(getCapabilityTarget('payments_operations')).toMatchObject({
            appKey: 'pay',
            appName: 'BeZhas Pay Manager',
            targetUrl: 'http://localhost:3019'
        });

        expect(getCapabilityTarget('quality_oracle_operations')).toMatchObject({
            appKey: 'vision',
            appName: 'Vision Scan',
            targetUrl: 'http://localhost:3013/quality'
        });
    });

    test('SubApp registry exposes current ownership boundaries', () => {
        const registry = getSubappRegistry();

        expect(registry).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'wallet',
                owns: expect.arrayContaining(['wallet_operations', 'bridge_operations', 'bezcoin_operations'])
            }),
            expect.objectContaining({
                key: 'capital',
                owns: expect.arrayContaining(['defi_vertical_operations', 'staking_operations', 'farming_operations'])
            }),
            expect.objectContaining({
                key: 'pay',
                owns: expect.arrayContaining(['payments_operations', 'fiat_gateway_operations'])
            })
        ]));
    });

    test('deprecated runtime route returns 410 with target SubApp metadata', async () => {
        const app = express();
        app.use('/api/staking', createDeprecatedSubappRoute('staking_operations'));

        const res = await request(app).post('/api/staking/positions').send({ amount: 10 });

        expect(res.status).toBe(410);
        expect(res.headers['x-bezhas-hub-role']).toBe('control-plane');
        expect(res.headers['x-bezhas-migrated-to']).toBe('BZ Capital');
        expect(res.headers.location).toBe('http://localhost:3014/staking');
        expect(res.body).toMatchObject({
            code: 'CAPABILITY_MIGRATED_TO_SUBAPP',
            capability: 'staking_operations',
            migratedTo: 'BZ Capital',
            targetUrl: 'http://localhost:3014/staking',
            hubRole: 'control-plane-only'
        });
    });

    test('control-plane API exposes manifest and capability lookups', async () => {
        const app = express();
        app.use('/api/control-plane', controlPlaneRoutes);

        const manifest = await request(app).get('/api/control-plane/manifest');
        expect(manifest.status).toBe(200);
        expect(manifest.body.migratedCapabilities.bridge_operations.targetUrl).toBe('http://localhost:3010/bridge');

        const capability = await request(app).get('/api/control-plane/capabilities/payments_operations');
        expect(capability.status).toBe(200);
        expect(capability.body).toMatchObject({
            appKey: 'pay',
            appName: 'BeZhas Pay Manager',
            targetUrl: 'http://localhost:3019'
        });
    });
});
