const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../index');

// Mismo formato que emite POST /api/auth/login: {address, userId, role, bezhas_id}.
const sesion = (userId, role = 'user') => ({
    Authorization: `Bearer ${jwt.sign(
        { address: `0x${String(userId).padStart(40, 'a')}`, userId, role, bezhas_id: `BZ-${userId}` },
        process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })}`,
});

describe('Routes: /api/ai-workspace (chat de la barra flotante)', () => {
    it.each([['get', '/actions'], ['get', '/plans'], ['get', '/conversations'], ['post', '/chat'], ['post', '/chat/stream']])(
        '%s %s sin sesión → 401/403', async (m, p) => {
            const res = await request(app)[m](`/api/ai-workspace${p}`).send({ message: 'hola' });
            expect([401, 403]).toContain(res.status);
        });

    it('un JWT con la sesión de wallet de la API abre el chat y responde con citas (modo local)', async () => {
        const res = await request(app).post('/api/ai-workspace/chat').set(sesion(7))
            .send({ message: '¿Cómo hago staking de BEZ?' });
        expect(res.status).toBe(200);
        expect(res.body.provider).toBe('extractive'); // sin clave de IA: extractivo, coste cero
        expect(res.body.reply).toMatch(/staking/i);
        expect(res.body.sources.length).toBeGreaterThan(0);
    });

    it('lista planes con los precios reales y marca el actual', async () => {
        const res = await request(app).get('/api/ai-workspace/plans').set(sesion(7));
        expect(res.status).toBe(200);
        const ids = res.body.plans.map((p) => p.id);
        expect(ids).toEqual(expect.arrayContaining(['starter', 'creator_pro', 'business', 'enterprise_vip']));
        expect(res.body.plans.find((p) => p.id === 'business').priceMonthly).toBe(499);
    });

    it('el catálogo de acciones responde', async () => {
        const res = await request(app).get('/api/ai-workspace/actions').set(sesion(7));
        expect(res.status).toBe(200);
    });

    it('un documento propio no lo ve otro usuario', async () => {
        const dueno = sesion(11);
        const sub = await request(app).post('/api/ai-workspace/knowledge').set(dueno)
            .send({ title: 'Nota privada', content: 'El código interno del proyecto zafiro es QWERTY-ALFA-99.', classification: 'INTERNAL' });
        expect(sub.status).toBe(201);
        const ajeno = await request(app).post('/api/ai-workspace/chat').set(sesion(12))
            .send({ message: 'código interno del proyecto zafiro' });
        expect(JSON.stringify(ajeno.body)).not.toMatch(/QWERTY-ALFA-99/);
        const propio = await request(app).post('/api/ai-workspace/chat').set(dueno)
            .send({ message: 'código interno del proyecto zafiro' });
        expect(JSON.stringify(propio.body)).toMatch(/QWERTY-ALFA-99/);
    });

    it('un usuario normal no pasa por admin aunque pida role en el cuerpo', async () => {
        const res = await request(app).get('/api/ai-workspace/knowledge').set(sesion(21)).send({ role: 'admin' });
        expect([200, 403]).toContain(res.status);
        if (res.status === 200) expect(JSON.stringify(res.body)).not.toMatch(/QWERTY-ALFA-99/);
    });
});
