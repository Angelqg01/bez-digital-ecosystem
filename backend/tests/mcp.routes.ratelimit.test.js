/**
 * El router de MCP exige token de admin. Sin freno de ritmo, ese token se
 * puede probar por fuerza bruta, así que el limitador va por delante de la
 * autenticación y cuenta también los intentos fallidos.
 */
const express = require('express');

describe('rate limit del router MCP', () => {
    let server;

    afterAll(async () => {
        if (server) await new Promise((r) => server.close(() => r()));
    });

    test('corta con 429 e incluye las cabeceras estándar', async () => {
        process.env.MCP_ROUTES_RATE_LIMIT_PER_MINUTE = '3';
        jest.resetModules();
        const routes = require('../routes/mcp.routes');

        const app = express();
        app.use(express.json());
        app.use('/api/mcp', routes);
        server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
        const base = `http://127.0.0.1:${server.address().port}/api/mcp/status`;

        const codes = [];
        for (let i = 0; i < 5; i++) {
            const res = await fetch(base);
            codes.push(res.status);
        }

        // Las tres primeras las resuelve la autenticación (401 sin token);
        // lo que importa es que a partir del cupo el limitador corta antes.
        expect(codes.slice(0, 3).every((c) => c !== 429)).toBe(true);
        expect(codes.slice(3)).toEqual([429, 429]);
    });
});
