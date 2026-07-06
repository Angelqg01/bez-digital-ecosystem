/**
 * Tests del Universal Bridge (Fase 3A — conexión terceros).
 * Cubre firma HMAC, fan-out por plataforma, degradación (no-adapter / not-configured),
 * aislamiento de fallos por-plataforma, y el gating por feature-flag en init().
 */
const crypto = require('crypto');
const bridge = require('../services/bridge/universalBridge');

afterEach(() => bridge.clearAdapters());

describe('signPayload', () => {
    it('produce HMAC-SHA256 estable y verificable', () => {
        const body = { event: 'client.provisioned', clientId: 'c1' };
        const sig = bridge.signPayload(body, 'secreto');
        const expected = 'sha256=' + crypto.createHmac('sha256', 'secreto').update(JSON.stringify(body)).digest('hex');
        expect(sig).toBe(expected);
        expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    });

    it('firma distinta con secreto distinto', () => {
        const b = { a: 1 };
        expect(bridge.signPayload(b, 's1')).not.toBe(bridge.signPayload(b, 's2'));
    });
});

describe('fanOut', () => {
    it('entrega webhook firmado a la plataforma con adapter configurado', async () => {
        const delivered = [];
        const deliver = async (url, body, headers) => { delivered.push({ url, body, headers }); return { httpStatus: 200 }; };
        bridge.registerAdapter(bridge.createWebhookAdapter('shopify', { url: 'https://hook.test/shopify', secret: 'sec' }));

        const payload = { clientId: 'c1', walletAddress: '0xabc', plan: 'pro', platforms: ['shopify'] };
        const results = await bridge.fanOut('client.provisioned', payload, { deliver });

        expect(results).toEqual([{ platform: 'shopify', status: 'delivered', httpStatus: 200 }]);
        expect(delivered).toHaveLength(1);
        expect(delivered[0].url).toBe('https://hook.test/shopify');
        // firma presente y correcta sobre el body entregado
        const sig = delivered[0].headers['X-BeZhas-Signature'];
        expect(sig).toBe(bridge.signPayload(delivered[0].body, 'sec'));
        expect(delivered[0].headers['X-BeZhas-Event']).toBe('client.provisioned');
        expect(delivered[0].body).toMatchObject({ event: 'client.provisioned', platform: 'shopify', clientId: 'c1' });
    });

    it('plataforma sin adapter → no-adapter (no rompe el resto)', async () => {
        const deliver = async () => ({ httpStatus: 200 });
        bridge.registerAdapter(bridge.createWebhookAdapter('shopify', { url: 'https://hook.test/s', secret: 'x' }));
        const results = await bridge.fanOut('client.provisioned',
            { platforms: ['shopify', 'amazon'], clientId: 'c2' }, { deliver });
        expect(results.find(r => r.platform === 'amazon')).toEqual({ platform: 'amazon', status: 'no-adapter' });
        expect(results.find(r => r.platform === 'shopify').status).toBe('delivered');
    });

    it('adapter sin URL configurada → skipped (degradación)', async () => {
        const deliver = jest.fn();
        bridge.registerAdapter(bridge.createWebhookAdapter('vinted', { url: null }));
        const results = await bridge.fanOut('client.provisioned', { platforms: ['vinted'] }, { deliver });
        expect(results[0]).toEqual({ platform: 'vinted', status: 'skipped', reason: 'not-configured' });
        expect(deliver).not.toHaveBeenCalled();
    });

    it('fallo de entrega se aísla por plataforma (status error, no throw)', async () => {
        const deliver = async (url) => { if (url.includes('amazon')) throw new Error('boom'); return { httpStatus: 200 }; };
        bridge.registerAdapter(bridge.createWebhookAdapter('shopify', { url: 'https://hook.test/shopify', secret: 'a' }));
        bridge.registerAdapter(bridge.createWebhookAdapter('amazon', { url: 'https://hook.test/amazon', secret: 'b' }));
        const results = await bridge.fanOut('client.provisioned', { platforms: ['shopify', 'amazon'] }, { deliver });
        expect(results.find(r => r.platform === 'shopify').status).toBe('delivered');
        expect(results.find(r => r.platform === 'amazon')).toMatchObject({ status: 'error', error: 'boom' });
    });

    it('payload sin platforms → fan-out vacío', async () => {
        const results = await bridge.fanOut('client.provisioned', { clientId: 'c3' }, { deliver: async () => ({}) });
        expect(results).toEqual([]);
    });
});

describe('init feature-flag', () => {
    const ORIG = process.env.FEATURE_THIRDPARTY_BRIDGE;
    afterEach(() => { process.env.FEATURE_THIRDPARTY_BRIDGE = ORIG; });

    it('no arranca si el flag no está en true', () => {
        delete process.env.FEATURE_THIRDPARTY_BRIDGE;
        expect(bridge.init()).toBe(false);
    });
});

describe('registerDefaultAdapters', () => {
    it('registra los 3 adapters de referencia', () => {
        bridge.registerDefaultAdapters();
        expect(bridge.listAdapters().sort()).toEqual(['amazon', 'shopify', 'vinted']);
    });
});
