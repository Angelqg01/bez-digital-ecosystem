/**
 * Límites por usuario: el chat (coste de IA) es estricto; abrir acciones, planes e historial no gastan ese presupuesto.
 */
const express = require('express');
const request = require('supertest');

jest.mock('../../middleware/auth.middleware', () => ({
    protect: (req, res, next) => {
        const raw = req.headers['x-test-user'];
        if (!raw) return res.status(401).json({ error: 'Not authorized, no token' });
        req.user = JSON.parse(raw);
        next();
    },
}));

process.env.KNOWLEDGE_AUTOSEED = 'false';
process.env.AI_WORKSPACE_RATE_LIMIT = '3';
process.env.AI_WORKSPACE_READ_RATE_LIMIT = '40';
process.env.AI_WORKSPACE_IP_RATE_LIMIT = '1000';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.AI_PROVIDER;

const router = require('../../routes/ai-workspace.routes');

const app = express();
app.use(express.json());
app.use('/api/ai-workspace', router);

const u = (id) => JSON.stringify({ id, tenantId: `T-${id}`, roles: ['USER'] });
const chat = (id) => request(app).post('/api/ai-workspace/chat').set('x-test-user', u(id)).send({ message: 'hola' });
const open = (id) => request(app).post('/api/ai-workspace/actions/staking/open').set('x-test-user', u(id));

describe('límites por usuario', () => {
    test('el chat se limita (3/min en este test) y devuelve 429', async () => {
        for (let i = 0; i < 3; i++) await chat('lim-a').expect(200);
        const res = await chat('lim-a').expect(429);
        expect(res.body.error).toMatch(/Demasiadas solicitudes/);
    });

    test('abrir acciones, catálogo y planes NO gastan el presupuesto del chat', async () => {
        for (let i = 0; i < 3; i++) await chat('lim-b').expect(200);
        await chat('lim-b').expect(429);
        // el chat está agotado, pero las acciones siguen funcionando
        for (let i = 0; i < 15; i++) await open('lim-b').expect(200);
        await request(app).get('/api/ai-workspace/actions').set('x-test-user', u('lim-b')).expect(200);
        await request(app).get('/api/ai-workspace/plans').set('x-test-user', u('lim-b')).expect(200);
    });

    test('el límite general también existe (40/min en este test)', async () => {
        for (let i = 0; i < 40; i++) await open('lim-c').expect(200);
        await open('lim-c').expect(429);
    });

    test('los límites son por usuario: agotar uno no bloquea a otro', async () => {
        for (let i = 0; i < 3; i++) await chat('lim-d').expect(200);
        await chat('lim-d').expect(429);
        await chat('lim-e').expect(200);
    });

    test('sin sesión → 401 (antes de gastar ningún límite)', async () => {
        await request(app).post('/api/ai-workspace/chat').send({ message: 'hola' }).expect(401);
        await request(app).post('/api/ai-workspace/actions/staking/open').expect(401);
    });
});
