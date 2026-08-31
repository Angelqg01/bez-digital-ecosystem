/**
 * Test de contrato Hub ↔ SubApps (Fase 2.3 — Conexión API-Hub).
 *
 * Fija la superficie estable que SubApps y clientes consumen del Hub, montando
 * el código REAL del contrato (`control-plane/policy.js` + `routes/health.routes.js`)
 * sobre un express mínimo — sin arrancar `server.js` (cuyo grafo mongoose/mongodb
 * no resuelve bajo jest en este entorno) y sin tocar DB.
 *
 *  1. Health endpoints (probes Cloud Run) — 200 con la forma esperada.
 *  2. Contrato de capacidad MIGRADA: las verticales delegadas devuelven 410 Gone
 *     con `code: CAPABILITY_MIGRATED_TO_SUBAPP`, header de rol control-plane,
 *     `targetUrl` de la SubApp y `Location` — así un cliente legacy sabe a dónde ir.
 *  3. 404 estable del Hub.
 */
const express = require('express');
const request = require('supertest');
const healthRoutes = require('../routes/health.routes');
const { createDeprecatedSubappRoute, getCapabilityTarget } = require('../control-plane/policy');

// App mínima que replica el cableado real de server.js para estas rutas.
function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/health', healthRoutes);
    app.use('/api/health', healthRoutes);

    // Mismas capacidades migradas que monta server.js (muestra representativa).
    const MIGRATED = {
        '/api/staking': 'staking_operations',
        '/api/farming': 'farming_operations',
        '/api/wallet': 'wallet_operations',
        '/api/governance': 'governance_operations',
        '/api/defi': 'defi_vertical_operations',
    };
    for (const [path, cap] of Object.entries(MIGRATED)) {
        app.use(path, createDeprecatedSubappRoute(cap, { appName: cap }));
    }

    app.use('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));
    return app;
}

describe('Hub ↔ SubApp contract', () => {
    const app = buildApp();

    describe('Health surface', () => {
        it('GET /api/health → 200 con status', async () => {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('status');
        });

        it('GET /health/live → 200 alive (liveness probe)', async () => {
            const res = await request(app).get('/health/live');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('alive', true);
        });

        // Regresión: /:service ensombrecía estas probes y devolvían 404 (fix 2026-06-14).
        it('GET /health/ready → 200|503 con flag ready (readiness probe, NO 404)', async () => {
            const res = await request(app).get('/health/ready');
            expect([200, 503]).toContain(res.status);
            expect(res.body).toHaveProperty('ready');
        });

        it('GET /health/startup → 200|503 con flag started (startup probe, NO 404)', async () => {
            const res = await request(app).get('/health/startup');
            expect([200, 503]).toContain(res.status);
            expect(res.body).toHaveProperty('started');
        });
    });

    describe('Capacidades migradas → 410 Gone con redirect a SubApp', () => {
        const migrated = ['/api/staking', '/api/farming', '/api/wallet', '/api/governance', '/api/defi'];

        it.each(migrated)('%s devuelve el contrato de migración', async (path) => {
            const res = await request(app).get(path);
            expect(res.status).toBe(410);
            expect(res.body).toMatchObject({ code: 'CAPABILITY_MIGRATED_TO_SUBAPP' });
            expect(res.body).toHaveProperty('migratedTo');
            expect(res.body).toHaveProperty('targetUrl');
            expect(res.headers['x-bezhas-hub-role']).toBe('control-plane');
        });

        it('Location apunta al targetUrl de la SubApp', async () => {
            const res = await request(app).get('/api/staking');
            expect(res.headers.location).toBe(res.body.targetUrl);
            expect(res.body.targetUrl).toMatch(/^https?:\/\//);
        });

        it('el targetUrl coincide con el registry de control-plane (fuente única)', async () => {
            const res = await request(app).get('/api/wallet');
            const target = getCapabilityTarget('wallet_operations');
            expect(res.body.targetUrl).toBe(target.targetUrl);
            expect(res.body.migratedTo).toBe(target.appName);
        });
    });

    describe('404 estable', () => {
        it('ruta /api inexistente → 404 con forma de error', async () => {
            const res = await request(app).get('/api/__definitely_not_a_route__');
            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error');
        });
    });
});
