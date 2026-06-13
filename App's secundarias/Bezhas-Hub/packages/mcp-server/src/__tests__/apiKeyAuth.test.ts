/**
 * Tests del middleware de auth por API key del HTTP wrapper MCP.
 * Cubre los 3 modos: legacy (sin clave configurada), clave válida, clave inválida,
 * más rutas públicas y carga de claves desde env.
 */
import { describe, it, expect, vi } from 'vitest';
import { createApiKeyAuth, loadKeysFromEnv } from '../middleware/apiKeyAuth.js';
import type { Request, Response, NextFunction } from 'express';

function mockReqRes(path: string, headers: Record<string, string> = {}) {
    const req = {
        path,
        header: (name: string) => headers[name.toLowerCase()],
    } as unknown as Request;
    const res = {
        statusCode: 0,
        body: undefined as unknown,
        status(code: number) { this.statusCode = code; return this; },
        json(payload: unknown) { this.body = payload; return this; },
    } as unknown as Response & { statusCode: number; body: unknown };
    const next = vi.fn() as unknown as NextFunction;
    return { req, res, next };
}

describe('createApiKeyAuth', () => {
    it('modo legacy (sin claves): permite el paso y avisa una sola vez', () => {
        const warn = vi.fn();
        const mw = createApiKeyAuth({ keys: [], warn });

        const a = mockReqRes('/api/mcp/tools');
        mw(a.req, a.res, a.next);
        const b = mockReqRes('/api/mcp/analyze-gas');
        mw(b.req, b.res, b.next);

        expect(a.next).toHaveBeenCalledOnce();
        expect(b.next).toHaveBeenCalledOnce();
        expect(warn).toHaveBeenCalledOnce(); // warning único, no spam
    });

    it('con claves configuradas: rechaza sin clave (401) y no llama next', () => {
        const mw = createApiKeyAuth({ keys: ['secreta'], warn: () => {} });
        const { req, res, next } = mockReqRes('/api/mcp/tools');
        mw(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect((res as any).statusCode).toBe(401);
        expect((res as any).body).toMatchObject({ error: 'Unauthorized' });
    });

    it('acepta X-API-Key válida', () => {
        const mw = createApiKeyAuth({ keys: ['secreta'], warn: () => {} });
        const { req, res, next } = mockReqRes('/api/mcp/github', { 'x-api-key': 'secreta' });
        mw(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('acepta Authorization: Bearer válida', () => {
        const mw = createApiKeyAuth({ keys: ['secreta'], warn: () => {} });
        const { req, res, next } = mockReqRes('/api/mcp/github', { authorization: 'Bearer secreta' });
        mw(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });

    it('rechaza clave incorrecta (401)', () => {
        const mw = createApiKeyAuth({ keys: ['secreta'], warn: () => {} });
        const { req, res, next } = mockReqRes('/api/mcp/alpaca-markets', { 'x-api-key': 'otra' });
        mw(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect((res as any).statusCode).toBe(401);
    });

    it('/api/mcp/health siempre público (probes de Cloud Run)', () => {
        const mw = createApiKeyAuth({ keys: ['secreta'], warn: () => {} });
        const { req, res, next } = mockReqRes('/api/mcp/health');
        mw(req, res, next);
        expect(next).toHaveBeenCalledOnce();
    });
});

describe('loadKeysFromEnv', () => {
    it('carga MCP_API_KEY única', () => {
        expect(loadKeysFromEnv({ MCP_API_KEY: 'k1' } as any)).toEqual(['k1']);
    });

    it('carga MCP_API_KEYS lista + MCP_API_KEY, sin duplicados ni vacíos', () => {
        const keys = loadKeysFromEnv({ MCP_API_KEYS: 'a, b,,a', MCP_API_KEY: 'b' } as any);
        expect(keys.sort()).toEqual(['a', 'b']);
    });

    it('sin env → lista vacía (modo legacy)', () => {
        expect(loadKeysFromEnv({} as any)).toEqual([]);
    });
});
