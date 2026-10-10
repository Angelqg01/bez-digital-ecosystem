import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import { useChatActions } from './useChatActions';

const act1 = (over = {}) => ({ id: 'tokenize_asset', kind: 'navigate', title: 'Tokenizar', description: 'd', sensitive: true, locked: false, ...over });

const makeApi = (routes) => ({
    get: vi.fn(async (url) => { const r = routes[`GET ${url}`]; if (r instanceof Error) throw r; return { data: r }; }),
    post: vi.fn(async (url) => { const r = routes[`POST ${url}`]; if (r instanceof Error) throw r; return { data: r }; }),
});
const httpError = (status, data) => Object.assign(new Error('http'), { response: { status, data } });

let assign;
beforeEach(() => {
    navigate.mockReset();
    assign = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } });
});
afterEach(() => vi.restoreAllMocks());

describe('useChatActions', () => {
    test('loadCatalog guarda el catálogo y devuelve la lista; si falla, vacío', async () => {
        const api = makeApi({ 'GET /api/ai-workspace/actions': { actions: [act1()] } });
        const { result } = renderHook(() => useChatActions(api));
        let list;
        await act(async () => { list = await result.current.loadCatalog(); });
        expect(list).toHaveLength(1);
        expect(result.current.catalog).toHaveLength(1);

        const bad = makeApi({ 'GET /api/ai-workspace/actions': httpError(500, {}) });
        const r2 = renderHook(() => useChatActions(bad)).result;
        await act(async () => { list = await r2.current.loadCatalog(); });
        expect(list).toEqual([]);
        expect(r2.current.catalog).toEqual([]);
    });

    test('acción de navegación: pide abrir al servidor y muestra la confirmación', async () => {
        const api = makeApi({ 'POST /api/ai-workspace/actions/tokenize_asset/open': { id: 'tokenize_asset', kind: 'navigate', href: '/rwa', sensitive: true, external: false } });
        const { result } = renderHook(() => useChatActions(api));
        await act(async () => { await result.current.request(act1()); });
        expect(api.post).toHaveBeenCalledWith('/api/ai-workspace/actions/tokenize_asset/open');
        expect(result.current.dialog).toMatchObject({ type: 'confirm', result: { href: '/rwa' } });
        expect(result.current.busy).toBe(false);
    });

    test('el id se codifica en la URL (no se puede inyectar ruta)', async () => {
        const api = makeApi({});
        const { result } = renderHook(() => useChatActions(api));
        await act(async () => { await result.current.request(act1({ id: '../x?y=1' })); });
        expect(api.post.mock.calls[0][0]).toBe('/api/ai-workspace/actions/..%2Fx%3Fy%3D1/open');
    });

    test('acción de planes: carga los planes y el plan actual', async () => {
        const api = makeApi({
            'POST /api/ai-workspace/actions/subscribe_plans/open': { id: 'subscribe_plans', kind: 'plans', href: '/vip', sensitive: true },
            'GET /api/ai-workspace/plans': { plans: [{ id: 'starter', name: 'Starter' }], current: 'starter' },
        });
        const { result } = renderHook(() => useChatActions(api));
        await act(async () => { await result.current.request(act1({ id: 'subscribe_plans', kind: 'plans' })); });
        expect(result.current.dialog.type).toBe('plans');
        expect(result.current.plans).toHaveLength(1);
        expect(result.current.plans[0]).toMatchObject({ id: 'starter', name: 'Starter', purchasable: false });
        expect(result.current.currentPlan).toBe('starter');
    });

    test('acción de documentos: carga la lista de documentos accesibles', async () => {
        const api = makeApi({
            'POST /api/ai-workspace/actions/exclusive_docs/open': { id: 'exclusive_docs', kind: 'docs', href: '/docs', sensitive: false },
            'GET /api/ai-workspace/knowledge': { documents: [{ id: 'd1', title: 'Manual' }] },
        });
        const { result } = renderHook(() => useChatActions(api));
        await act(async () => { await result.current.request(act1({ id: 'exclusive_docs', kind: 'docs' })); });
        expect(result.current.dialog.type).toBe('docs');
        expect(result.current.docs).toEqual([{ id: 'd1', title: 'Manual' }]);
    });

    test('403: ventana «bloqueada» con el enlace de mejora', async () => {
        const api = makeApi({ 'POST /api/ai-workspace/actions/exclusive_docs/open': httpError(403, { error: 'Esta función requiere un plan de pago', upgradeActionId: 'subscribe_plans' }) });
        const { result } = renderHook(() => useChatActions(api));
        await act(async () => { await result.current.request(act1({ id: 'exclusive_docs', kind: 'docs' })); });
        expect(result.current.dialog).toMatchObject({ type: 'locked', message: 'Esta función requiere un plan de pago', upgradeActionId: 'subscribe_plans' });
    });

    test('otros errores: ventana de error con el mensaje del servidor', async () => {
        const api = makeApi({ 'POST /api/ai-workspace/actions/x/open': httpError(500, { error: 'Error interno' }) });
        const { result } = renderHook(() => useChatActions(api));
        await act(async () => { await result.current.request(act1({ id: 'x' })); });
        expect(result.current.dialog).toEqual({ type: 'error', message: 'Error interno' });
    });

    test.each(['https://evil.com', '//evil.com', 'javascript:alert(1)', '/a/../b', undefined])('descarta un destino inseguro del servidor (%s)', async (href) => {
        const api = makeApi({ 'POST /api/ai-workspace/actions/tokenize_asset/open': { id: 'tokenize_asset', kind: 'navigate', href } });
        const { result } = renderHook(() => useChatActions(api));
        await act(async () => { await result.current.request(act1()); });
        expect(result.current.dialog.type).toBe('error');
    });

    test('go: ruta de la SPA → router; app secundaria → navegación completa; inseguro → error', () => {
        const { result } = renderHook(() => useChatActions(makeApi({})));
        act(() => { expect(result.current.go({ href: '/rwa', external: false })).toBe(true); });
        expect(navigate).toHaveBeenCalledWith('/rwa');
        expect(assign).not.toHaveBeenCalled();
        act(() => { expect(result.current.go({ href: '/dashboard/farming', external: true })).toBe(true); });
        expect(assign).toHaveBeenCalledWith('/dashboard/farming');
        navigate.mockClear(); assign.mockClear();
        act(() => { expect(result.current.go({ href: 'https://evil.com', external: true })).toBe(false); });
        act(() => { expect(result.current.go(null)).toBe(false); });
        expect(navigate).not.toHaveBeenCalled();
        expect(assign).not.toHaveBeenCalled();
        expect(result.current.dialog.type).toBe('error');
    });

    test('go cierra la ventana', async () => {
        const api = makeApi({ 'POST /api/ai-workspace/actions/tokenize_asset/open': { id: 'tokenize_asset', kind: 'navigate', href: '/rwa' } });
        const { result } = renderHook(() => useChatActions(api));
        await act(async () => { await result.current.request(act1()); });
        act(() => { result.current.go(result.current.dialog.result); });
        expect(result.current.dialog).toBeNull();
    });

    test('requestById usa el catálogo cargado o lo pide al servidor; id desconocido → error', async () => {
        const api = makeApi({
            'GET /api/ai-workspace/actions': { actions: [act1({ id: 'subscribe_plans', kind: 'plans' })] },
            'POST /api/ai-workspace/actions/subscribe_plans/open': { id: 'subscribe_plans', kind: 'plans', href: '/vip' },
            'GET /api/ai-workspace/plans': { plans: [], current: 'free' },
        });
        const { result } = renderHook(() => useChatActions(api));
        await act(async () => { await result.current.requestById('subscribe_plans'); }); // catálogo aún sin cargar
        expect(api.get).toHaveBeenCalledWith('/api/ai-workspace/actions');
        expect(result.current.dialog.type).toBe('plans');
        await act(async () => { await result.current.requestById('no_existe'); });
        expect(result.current.dialog).toEqual({ type: 'error', message: 'La acción no está disponible.' });
    });

    test('close limpia la ventana', async () => {
        const api = makeApi({ 'POST /api/ai-workspace/actions/x/open': httpError(500, {}) });
        const { result } = renderHook(() => useChatActions(api));
        await act(async () => { await result.current.request(act1({ id: 'x' })); });
        act(() => result.current.close());
        expect(result.current.dialog).toBeNull();
    });

    describe('pagos con Stripe', () => {
        const STRIPE = 'https://checkout.stripe.com/c/pay/cs_test_abc';

        const LINK_M = 'https://buy.stripe.com/aaa';
        const LINK_A = 'https://buy.stripe.com/bbb';
        const conPlanes = async (planes) => {
            const api = makeApi({ 'POST /api/ai-workspace/actions/subscribe_plans/open': { kind: 'plans', href: '/vip', sensitive: true }, 'GET /api/ai-workspace/plans': { plans: planes, current: 'starter' } });
            const hook = renderHook(() => useChatActions(api));
            await act(async () => { await hook.result.current.request({ id: 'subscribe_plans', kind: 'plans', href: '/vip', sensitive: true }); });
            return hook;
        };
        const PLAN = { id: 'business', name: 'Business', priceEUR: 499, yearlyEUR: 4990, monthlyUrl: LINK_M, annualUrl: LINK_A };

        test('checkoutPlan abre el Payment Link del ciclo elegido (sin llamar a ningún endpoint de pago)', async () => {
            const { result } = await conPlanes([PLAN]);
            let ok;
            await act(async () => { ok = await result.current.checkoutPlan('business', 'yearly'); });
            expect(ok).toBe(true);
            expect(assign).toHaveBeenCalledWith(LINK_A);
            await act(async () => { await result.current.checkoutPlan('business', 'monthly'); });
            expect(assign).toHaveBeenLastCalledWith(LINK_M);
        });

        test('los planes llegan normalizados para la ventana (precio en EUR y comprable si hay enlace)', async () => {
            const { result } = await conPlanes([PLAN, { id: 'starter', name: 'Starter', priceEUR: 0, yearlyEUR: 0 }]);
            expect(result.current.plans[0]).toMatchObject({ priceMonthly: 499, priceYearly: 4990, currency: 'EUR', purchasable: true });
            expect(result.current.plans[1].purchasable).toBe(false);
        });

        test.each([
            ['enlace de otro dominio', { ...PLAN, monthlyUrl: 'https://evil.test/pay' }],
            ['http plano', { ...PLAN, monthlyUrl: 'http://buy.stripe.com/aaa' }],
            ['subdominio engañoso', { ...PLAN, monthlyUrl: 'https://buy.stripe.com.evil.test/x' }],
            ['javascript:', { ...PLAN, monthlyUrl: 'javascript:alert(1)' }],
        ])('checkoutPlan no redirige con un enlace inseguro (%s)', async (_n, plan) => {
            const { result } = await conPlanes([plan]);
            await act(async () => { await result.current.checkoutPlan('business', 'monthly'); });
            expect(assign).not.toHaveBeenCalled();
            expect(result.current.payError).toMatch(/no se puede contratar/);
        });

        test('un plan inexistente no redirige', async () => {
            const { result } = await conPlanes([PLAN]);
            await act(async () => { await result.current.checkoutPlan('no_existe', 'monthly'); });
            expect(assign).not.toHaveBeenCalled();
        });

        test.each([
            ['otro dominio', 'https://evil.test/pay'],
            ['http plano', 'http://checkout.stripe.com/x'],
            ['subdominio engañoso', 'https://checkout.stripe.com.evil.test/x'],
            ['credenciales', 'https://checkout.stripe.com@evil.test/x'],
            ['javascript:', 'javascript:alert(1)'],
            ['ausente', undefined],
        ])('no redirige si la URL no es de Stripe (%s)', async (_n, url) => {
            const api = makeApi({ 'POST /api/checkout/bez': { success: true, url } });
            const { result } = renderHook(() => useChatActions(api));
            await act(async () => { await result.current.buyBez('25'); });
            expect(assign).not.toHaveBeenCalled();
            expect(result.current.payError).toMatch(/no válida/);
        });

        test('muestra el error del servidor (p. ej. wallet sin vincular)', async () => {
            const api = makeApi({ 'POST /api/checkout/bez': httpError(409, { message: 'Vincula una wallet' }) });
            const { result } = renderHook(() => useChatActions(api));
            await act(async () => { await result.current.buyBez('25'); });
            expect(result.current.payError).toBe('Vincula una wallet');
            expect(assign).not.toHaveBeenCalled();
            expect(result.current.paying).toBe(false);
        });

        test('la acción buy_bez abre el diálogo de compra con tarjeta', async () => {
            const api = makeApi({ 'POST /api/ai-workspace/actions/buy_bez/open': { id: 'buy_bez', kind: 'navigate', href: '/buy-tokens', sensitive: true } });
            const { result } = renderHook(() => useChatActions(api));
            await act(async () => { await result.current.request(act1({ id: 'buy_bez' })); });
            expect(result.current.dialog.type).toBe('bez');
        });
    });
});
