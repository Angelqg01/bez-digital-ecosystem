/**
 * El límite de ritmo de los endpoints de observación, contra un servidor real.
 *
 * Se levanta un express de verdad en un puerto efímero en lugar de simular la
 * petición: lo que importa aquí es que el middleware devuelva 429 en la pila
 * completa, incluidas las cabeceras que emite `express-rate-limit`.
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import rateLimit from 'express-rate-limit';
import { GLOBAL_LIMIT_PER_MINUTE, watchdogLimiter } from '../../security/throttle.js';

let server: Server | undefined;

afterEach(async () => {
    if (server) await new Promise<void>((r) => server!.close(() => r()));
    server = undefined;
});

/** Levanta un servidor con el limitador puesto y devuelve su URL base. */
async function listen(limit: number, subject: () => string | undefined): Promise<string> {
    const app = express();
    app.get('/status', rateLimit(watchdogLimiter(limit, { resolveSubject: subject })), (_req, res) => {
        res.json({ ok: true });
    });
    app.get('/otra', rateLimit(watchdogLimiter(limit, { resolveSubject: subject })), (_req, res) => {
        res.json({ ok: true });
    });

    server = await new Promise<Server>((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('límite de ritmo de los endpoints de observación', () => {
    it('corta con 429 al pasar del cupo y lo dice en el cuerpo', async () => {
        const base = await listen(3, () => 'sbj_aaaa');

        const codes: number[] = [];
        for (let i = 0; i < 5; i++) {
            codes.push((await fetch(`${base}/status`)).status);
        }

        expect(codes).toEqual([200, 200, 200, 429, 429]);

        const blocked = await fetch(`${base}/status`);
        expect(blocked.status).toBe(429);
        expect(await blocked.json()).toMatchObject({ success: false, retryAfterSeconds: 60 });
        // Cabeceras estándar, para que un cliente sepa cuándo reintentar.
        expect(blocked.headers.get('ratelimit-limit')).toBe('3');
    });

    it('cuenta por sujeto: una clave abusiva no agota el cupo de otra', async () => {
        let who = 'sbj_abusador';
        const base = await listen(2, () => who);

        for (let i = 0; i < 4; i++) await fetch(`${base}/status`);
        expect((await fetch(`${base}/status`)).status).toBe(429);

        who = 'sbj_inocente';
        expect((await fetch(`${base}/status`)).status).toBe(200);
    });

    it('cuenta por ruta: agotar una no cierra las demás', async () => {
        const base = await listen(2, () => 'sbj_bbbb');

        for (let i = 0; i < 3; i++) await fetch(`${base}/status`);
        expect((await fetch(`${base}/status`)).status).toBe(429);
        expect((await fetch(`${base}/otra`)).status).toBe(200);
    });
});

describe('techo global del servidor', () => {
    it('un cupo único para todas las rutas: cambiar de endpoint no lo renueva', async () => {
        // Con clave por ruta, un abusador multiplicaba su cupo por el número
        // de endpoints. El techo global tiene que contarlas todas juntas.
        const app = express();
        app.use(rateLimit(watchdogLimiter(3, { resolveSubject: () => 'sbj_cccc', global: true })));
        app.get('/uno', (_req, res) => res.json({ ok: true }));
        app.get('/dos', (_req, res) => res.json({ ok: true }));

        server = await new Promise<Server>((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });
        const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

        expect((await fetch(`${base}/uno`)).status).toBe(200);
        expect((await fetch(`${base}/uno`)).status).toBe(200);
        expect((await fetch(`${base}/dos`)).status).toBe(200);
        // El cuarto ya excede el cupo, venga por donde venga.
        expect((await fetch(`${base}/dos`)).status).toBe(429);
        expect((await fetch(`${base}/uno`)).status).toBe(429);
    });

    it('el cupo global por defecto es configurable y razonable', () => {
        expect(GLOBAL_LIMIT_PER_MINUTE).toBeGreaterThan(0);
        expect(Number.isFinite(GLOBAL_LIMIT_PER_MINUTE)).toBe(true);
    });
});
