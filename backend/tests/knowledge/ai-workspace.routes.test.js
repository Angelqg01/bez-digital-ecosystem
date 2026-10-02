const express = require('express');
const request = require('supertest');

// protect simulado: el usuario sale de la cabecera x-test-user (solo para el test).
jest.mock('../../middleware/auth.middleware', () => ({
    protect: (req, res, next) => {
        const raw = req.headers['x-test-user'];
        if (!raw) return res.status(401).json({ error: 'Not authorized, no token' });
        req.user = JSON.parse(raw);
        next();
    },
}));

process.env.KNOWLEDGE_AUTOSEED = 'true';
const router = require('../../routes/ai-workspace.routes');

const app = express();
app.use(express.json());
app.use('/api/ai-workspace', router);

const as = (u) => JSON.stringify(u);
const alice = { id: 'a', tenantId: 'T1', roles: ['USER'] };
const bob = { id: 'b', tenantId: 'T2', roles: ['USER'] };

describe('/api/ai-workspace', () => {
    beforeAll(() => new Promise((r) => setTimeout(r, 50))); // deja terminar el seed

    test('sin login → 401 en chat, conocimiento y conversaciones', async () => {
        await request(app).post('/api/ai-workspace/chat').send({ message: 'hola' }).expect(401);
        await request(app).get('/api/ai-workspace/knowledge').expect(401);
        await request(app).get('/api/ai-workspace/conversations/abcdefgh').expect(401);
    });

    test('chat con login responde con fuentes públicas', async () => {
        const res = await request(app).post('/api/ai-workspace/chat').set('x-test-user', as(alice)).send({ message: '¿Cómo hago staking de BEZ?' }).expect(200);
        expect(res.body.conversationId).toBeTruthy();
        expect(res.body.sources.length).toBeGreaterThan(0);
        expect(res.body.provider).toBe('extractive');
    });

    test('validación: mensaje vacío 400, demasiado largo 413', async () => {
        await request(app).post('/api/ai-workspace/chat').set('x-test-user', as(alice)).send({ message: '  ' }).expect(400);
        await request(app).post('/api/ai-workspace/chat').set('x-test-user', as(alice)).send({ message: 'x'.repeat(4001) }).expect(413);
    });

    test('aislamiento: el conocimiento privado de alice no llega a bob vía chat', async () => {
        await request(app).post('/api/ai-workspace/knowledge').set('x-test-user', as(alice))
            .send({ title: 'Plan interno', content: 'El proyecto Orquídea lanza en marzo con presupuesto de 90000', classification: 'INTERNAL', tenantId: 'T2' }).expect(201);
        const a = await request(app).post('/api/ai-workspace/chat').set('x-test-user', as(alice)).send({ message: 'proyecto Orquídea presupuesto' }).expect(200);
        const b = await request(app).post('/api/ai-workspace/chat').set('x-test-user', as(bob)).send({ message: 'proyecto Orquídea presupuesto' }).expect(200);
        expect(a.body.reply).toMatch(/Orquídea/);
        expect(b.body.reply).not.toMatch(/Orquídea|90000/);
        expect((await request(app).get('/api/ai-workspace/knowledge').set('x-test-user', as(bob))).body.documents.some((d) => d.title === 'Plan interno')).toBe(false);
    });

    test('conversaciones: otro usuario no puede leer la conversación ajena', async () => {
        const r = await request(app).post('/api/ai-workspace/chat').set('x-test-user', as(alice)).send({ message: 'staking' });
        await request(app).get(`/api/ai-workspace/conversations/${r.body.conversationId}`).set('x-test-user', as(alice)).expect(200);
        await request(app).get(`/api/ai-workspace/conversations/${r.body.conversationId}`).set('x-test-user', as(bob)).expect(404);
    });

    test('un usuario normal no puede publicar conocimiento global', async () => {
        await request(app).post('/api/ai-workspace/knowledge').set('x-test-user', as(alice))
            .send({ title: 'x', content: 'y', classification: 'PUBLIC', global: true }).expect(403);
    });
});
