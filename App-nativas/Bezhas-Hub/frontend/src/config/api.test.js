/**
 * Tests del módulo centralizado de endpoints (Fase 2.2).
 * Valida la normalización de `apiUrl` — la regresión que arregla es el doble `/api`.
 */
import { describe, it, expect } from 'vitest';
import { apiUrl, API_ROOT, API_BASE, WS_URL, MCP_URL } from './api.js';

describe('config/api', () => {
    it('API_ROOT no lleva barra final ni /api', () => {
        expect(API_ROOT.endsWith('/')).toBe(false);
        expect(API_ROOT.endsWith('/api')).toBe(false);
    });

    it('API_BASE = raíz + /api', () => {
        expect(API_BASE).toBe(`${API_ROOT}/api`);
    });

    it('apiUrl añade /api con barra inicial', () => {
        expect(apiUrl('/admin/users')).toBe(`${API_ROOT}/api/admin/users`);
    });

    it('apiUrl tolera path sin barra inicial', () => {
        expect(apiUrl('admin/users')).toBe(`${API_ROOT}/api/admin/users`);
    });

    it('apiUrl es idempotente si el path ya trae /api (no duplica)', () => {
        expect(apiUrl('/api/admin/users')).toBe(`${API_ROOT}/api/admin/users`);
        expect(apiUrl('/api/admin/users')).not.toContain('/api/api/');
    });

    it('apiUrl() sin args devuelve API_BASE', () => {
        expect(apiUrl()).toBe(API_BASE);
        expect(apiUrl('')).toBe(API_BASE);
    });

    it('WS_URL usa esquema ws/wss', () => {
        expect(WS_URL).toMatch(/^wss?:\/\//);
    });

    it('MCP_URL definido y sin barra final', () => {
        expect(MCP_URL).toMatch(/^https?:\/\//);
        expect(MCP_URL.endsWith('/')).toBe(false);
    });
});
