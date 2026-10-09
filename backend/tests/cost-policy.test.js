const { TtlCache, stableStringify, isCacheableTool, costContextFromRequest } = require('../services/cost-policy.service');

describe('TtlCache', () => {
    test('comparte una consulta en vuelo y cachea el resultado', async () => {
        const cache = new TtlCache({ ttlMs: 1000 });
        let calls = 0;
        const loader = async () => { calls++; await new Promise((r) => setTimeout(r, 10)); return { status: 'SUCCESS' }; };
        const [a, b] = await Promise.all([cache.wrap('k', loader), cache.wrap('k', loader)]);
        expect(calls).toBe(1);
        expect(a.cached).toBe(false);
        expect(b.cached).toBe(true);
        expect((await cache.wrap('k', loader)).cached).toBe(true);
        expect(calls).toBe(1);
    });

    test('expira y no guarda lo que shouldCache rechaza', async () => {
        let t = 0;
        const cache = new TtlCache({ ttlMs: 100, now: () => t });
        let calls = 0;
        const loader = async () => ({ n: ++calls });
        await cache.wrap('k', loader);
        t = 101;
        await cache.wrap('k', loader);
        expect(calls).toBe(2);
        await cache.wrap('bad', async () => ({ status: 'FAILED' }), { shouldCache: (r) => r.status === 'SUCCESS' });
        expect(cache.get('bad')).toBeUndefined();
    });

    test('expulsa la entrada menos usada al llenarse', () => {
        const cache = new TtlCache({ maxEntries: 2 });
        cache.set('a', 1); cache.set('b', 2); cache.get('a'); cache.set('c', 3);
        expect(cache.get('b')).toBeUndefined();
        expect(cache.get('a')).toBe(1);
    });

    test('la huella no depende del orden de las claves', () => {
        expect(stableStringify({ a: 1, b: { c: 2, d: 3 } })).toBe(stableStringify({ b: { d: 3, c: 2 }, a: 1 }));
    });
});

describe('política de coste', () => {
    test('solo se cachean herramientas de solo lectura', () => {
        expect(isCacheableTool({ type: 'explorer' })).toBe(true);
        expect(isCacheableTool({ type: 'finance' })).toBe(false); // trading
        expect(isCacheableTool({ type: 'marketing' })).toBe(false);
        expect(isCacheableTool({ type: 'automation' })).toBe(false);
    });

    test('admin no es facturable; usuario normal sí', () => {
        expect(costContextFromRequest({ admin: { id: 'x' } })).toEqual({ admin: true, billable: false });
        expect(costContextFromRequest({})).toEqual({ admin: false, billable: true });
    });
});

describe('orquestador MCP: coste', () => {
    test('admin => billable false; usuario => billable true solo en la primera llamada; la repetición sale de caché', async () => {
        jest.resetModules();
        const orch = require('../services/orchestrator.service');
        orch.toolCache.clear();
        let calls = 0;
        orch.TOOL_REGISTRY.analyze_gas.handler = async () => { calls++; return { status: 'SUCCESS', data: {} }; };

        const admin = await orch.executeTool('analyze_gas', { x: 1 }, { billable: false });
        expect(admin.billable).toBe(false);
        const user = await orch.executeTool('analyze_gas', { x: 2 }, { billable: true });
        expect(user.billable).toBe(true);
        const again = await orch.executeTool('analyze_gas', { x: 2 }, { billable: true });
        expect(again.cached).toBe(true);
        expect(again.billable).toBe(false);
        expect(calls).toBe(2);
    });

    test('un fallo no se cachea', async () => {
        jest.resetModules();
        const orch = require('../services/orchestrator.service');
        let calls = 0;
        orch.TOOL_REGISTRY.analyze_gas.handler = async () => { calls++; throw new Error('boom'); };
        const r = await orch.executeTool('analyze_gas', {});
        expect(r.status).toBe('FAILED');
        await orch.executeTool('analyze_gas', {});
        expect(calls).toBe(2);
    });
});
