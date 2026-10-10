/**
 * @jest-environment node
 */
import path from 'node:path';
import { NextRequest } from 'next/server';

// La guarda de sesión se prueba aparte; aquí se deja pasar para ejercitar la
// ruta. (Un 401 de la guarda real saldría antes de llegar a ningún caso de abajo.)
jest.mock('@/lib/adminGuard', () => ({ requireSuperAdmin: async () => null }));

const REPO_VAULT = path.resolve(__dirname, '../../../../../docs/obsidian-vault');

/**
 * La ruta fija VAULT_ROOT y READ_ONLY al cargar el módulo, así que cada caso
 * lo importa de nuevo con el entorno que quiere probar.
 */
async function loadRoute(env: Record<string, string | undefined>) {
    jest.resetModules();
    const keys = ['OBSIDIAN_VAULT_ROOT', 'OBSIDIAN_READONLY', 'NODE_ENV'];
    for (const k of keys) delete (process.env as Record<string, string | undefined>)[k];
    for (const [k, v] of Object.entries(env)) {
        if (v !== undefined) (process.env as Record<string, string | undefined>)[k] = v;
    }
    return import('@/app/api/obsidian/route');
}

const get = (route: { GET: (r: NextRequest) => Promise<Response> }) =>
    route.GET(new NextRequest('http://localhost/api/obsidian'));

const post = (route: { POST: (r: NextRequest) => Promise<Response> }, body: unknown) =>
    route.POST(new NextRequest('http://localhost/api/obsidian', { method: 'POST', body: JSON.stringify(body) }));

describe('/api/obsidian', () => {
    test('con el vault empaquetado (OBSIDIAN_VAULT_ROOT) devuelve el resumen', async () => {
        const route = await loadRoute({ OBSIDIAN_VAULT_ROOT: REPO_VAULT, NODE_ENV: 'production' });
        const res = await get(route);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.status).toBe('ok');
        expect(body.counts.notes).toBeGreaterThan(0);
        expect(body.counts.canvasNodes).toBeGreaterThan(0);
    });

    test('sin el directorio del vault responde 503 claro, no 500', async () => {
        const route = await loadRoute({ OBSIDIAN_VAULT_ROOT: '/ruta/que/no/existe/vault', NODE_ENV: 'production' });
        const res = await get(route);
        const body = await res.json();
        expect(res.status).toBe(503);
        expect(body.status).toBe('unavailable');
    });

    test('en producción no crea el directorio ausente al leer', async () => {
        const fs = await import('node:fs/promises');
        const route = await loadRoute({ OBSIDIAN_VAULT_ROOT: '/ruta/que/no/existe/vault', NODE_ENV: 'production' });
        await get(route);
        await expect(fs.stat('/ruta/que/no/existe/vault')).rejects.toThrow();
    });

    test('en producción las escrituras se rechazan con 403 (disco efímero)', async () => {
        const route = await loadRoute({ OBSIDIAN_VAULT_ROOT: REPO_VAULT, NODE_ENV: 'production' });
        const res = await post(route, { action: 'record_episode', goal: 'x', result: 'y' });
        const body = await res.json();
        expect(res.status).toBe(403);
        expect(body.status).toBe('read_only');
    });

    test('OBSIDIAN_READONLY=false permite escribir (vault en volumen persistente)', async () => {
        const route = await loadRoute({ OBSIDIAN_VAULT_ROOT: REPO_VAULT, NODE_ENV: 'production', OBSIDIAN_READONLY: 'false' });
        const res = await post(route, { action: 'acción-inexistente' });
        // Pasa la barrera de sólo lectura y llega a la validación de la acción.
        expect(res.status).toBe(400);
    });
});
