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
        expect(result.current.plans).toEqual([{ id: 'starter', name: 'Starter' }]);
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
});
