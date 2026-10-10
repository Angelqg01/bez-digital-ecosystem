'use strict';

// La pestaña Skills del panel llama a /api/agent/skills con la cookie de sesión
// SuperAdmin (issuer 'bezhas-admin-auth'). Con sólo authenticateToken +
// requireRole('admin') esa cookie nunca valía y todas las llamadas daban 401.
process.env.JWT_SECRET = 'test-secret-0123456789abcdef0123456789';
process.env.INTERNAL_API_KEY = 'test-internal-key';

const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

describe('/api/agent/skills — acceso desde el panel de administración', () => {
    let server;
    let base;

    beforeAll(async () => {
        const router = require('../../routes/unified-agent');
        const app = express();
        app.use(cookieParser());
        app.use(express.json());
        app.use('/api/agent', router);
        await new Promise((resolve) => { server = app.listen(0, resolve); });
        base = `http://127.0.0.1:${server.address().port}/api/agent`;
    });

    afterAll(() => new Promise((resolve) => server.close(resolve)));

    const sign = (issuer) => jwt.sign(
        { role: 'SUPER_ADMIN', wallet: '0x1' },
        process.env.JWT_SECRET,
        { issuer, expiresIn: '1h' },
    );

    test('sin credenciales: 401', async () => {
        const res = await fetch(`${base}/skills?limit=1`);
        expect(res.status).toBe(401);
    });

    test('cookie de SuperAdmin válida: 200', async () => {
        const res = await fetch(`${base}/skills?limit=1`, {
            headers: { Cookie: `bezhas_admin_token=${sign('bezhas-admin-auth')}` },
        });
        expect(res.status).toBe(200);
        expect((await res.json()).status).toBe('success');
    });

    test('token con otro emisor: 401 (no sirve un JWT cualquiera)', async () => {
        const res = await fetch(`${base}/skills?limit=1`, {
            headers: { Cookie: `bezhas_admin_token=${sign('otro-emisor')}` },
        });
        expect(res.status).toBe(401);
    });
});
