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
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.AI_PROVIDER;
const router = require('../../routes/ai-workspace.routes');
const gateway = require('../../services/ai-gateway');
const { ConversationStore } = require('../../services/ai-workspace/conversations');

const app = express();
app.use(express.json());
app.use('/api/ai-workspace', router);

const as = (u) => JSON.stringify(u);
const alice = { id: 'a', tenantId: 'T1', roles: ['USER'] };
const bob = { id: 'b', tenantId: 'T2', roles: ['USER'] };

/** Parsea un cuerpo SSE en [{event, data}]. */
const parseSse = (text) => text.trim().split('\n\n').map((block) => {
    const ev = /^event: (.*)$/m.exec(block);
    const data = /^data: (.*)$/m.exec(block);
    return { event: ev && ev[1], data: data ? JSON.parse(data[1]) : null };
});

const sse = (user, body) => request(app).post('/api/ai-workspace/chat/stream')
    .set('x-test-user', as(user)).send(body).buffer(true).parse((res, cb) => {
        let buf = ''; res.setEncoding('utf8'); res.on('data', (c) => { buf += c; }); res.on('end', () => cb(null, buf));
    });

describe('POST /api/ai-workspace/chat/stream', () => {
    beforeAll(() => new Promise((r) => setTimeout(r, 50))); // deja terminar el seed

    test('sin login → 401', async () => {
        await request(app).post('/api/ai-workspace/chat/stream').send({ message: 'hola' }).expect(401);
    });

    test('valida el mensaje antes de abrir el stream (400/413 JSON, no SSE)', async () => {
        const empty = await request(app).post('/api/ai-workspace/chat/stream').set('x-test-user', as(alice)).send({ message: ' ' }).expect(400);
        expect(empty.headers['content-type']).toMatch(/json/);
        await request(app).post('/api/ai-workspace/chat/stream').set('x-test-user', as(alice)).send({ message: 'x'.repeat(4001) }).expect(413);
    });

    test('emite meta → provider → delta* → done con fuentes y texto completo', async () => {
        const res = await sse(alice, { message: '¿Cómo hago staking de BEZ?' });
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/event-stream/);
        expect(res.headers['x-accel-buffering']).toBe('no');

        const events = parseSse(res.body);
        expect(events[0].event).toBe('meta');
        expect(events[0].data.sources[0].title).toMatch(/staking/i);
        expect(events[0].data.conversationId).toBeTruthy();
        expect(events.find((e) => e.event === 'provider').data.provider).toBe('extractive');

        const deltas = events.filter((e) => e.event === 'delta');
        expect(deltas.length).toBeGreaterThan(5);
        const full = deltas.map((d) => d.data.text).join('');
        expect(full).toMatch(/staking/i);
        expect(events[events.length - 1].event).toBe('done');
        expect(events[events.length - 1].data.length).toBe(full.length);
    });

    test('guarda la conversación, la lista en el historial y se puede continuar y borrar', async () => {
        const first = parseSse((await sse(alice, { message: 'Cuéntame sobre la DAO' })).body);
        const convId = first[0].data.conversationId;

        const list = await request(app).get('/api/ai-workspace/conversations').set('x-test-user', as(alice)).expect(200);
        const item = list.body.conversations.find((c) => c.id === convId);
        expect(item).toMatchObject({ title: 'Cuéntame sobre la DAO', messages: 2 });

        await sse(alice, { message: 'y los pagos?', conversationId: convId });
        const detail = await request(app).get(`/api/ai-workspace/conversations/${convId}`).set('x-test-user', as(alice)).expect(200);
        expect(detail.body.turns).toHaveLength(4);

        await request(app).delete(`/api/ai-workspace/conversations/${convId}`).set('x-test-user', as(alice)).expect(200);
        await request(app).get(`/api/ai-workspace/conversations/${convId}`).set('x-test-user', as(alice)).expect(404);
    });

    test('aislamiento: otro usuario no ve, lee ni borra la conversación', async () => {
        const convId = parseSse((await sse(alice, { message: 'secreto de alice' })).body)[0].data.conversationId;
        expect((await request(app).get('/api/ai-workspace/conversations').set('x-test-user', as(bob))).body.conversations.some((c) => c.id === convId)).toBe(false);
        await request(app).get(`/api/ai-workspace/conversations/${convId}`).set('x-test-user', as(bob)).expect(404);
        await request(app).delete(`/api/ai-workspace/conversations/${convId}`).set('x-test-user', as(bob)).expect(404);
        // y el mismo conversationId enviado por bob crea SU conversación, no escribe en la de alice
        await sse(bob, { message: 'hola', conversationId: convId });
        const aliceDetail = await request(app).get(`/api/ai-workspace/conversations/${convId}`).set('x-test-user', as(alice)).expect(200);
        expect(JSON.stringify(aliceDetail.body.turns)).not.toContain('hola');
    });

    test('el conocimiento privado de un tenant no llega al stream de otro', async () => {
        await request(app).post('/api/ai-workspace/knowledge').set('x-test-user', as(alice))
            .send({ title: 'Plan interno', content: 'El proyecto Orquídea lanza en marzo con presupuesto de 90000', classification: 'INTERNAL' }).expect(201);
        const a = (await sse(alice, { message: 'proyecto Orquídea presupuesto' })).body;
        const b = (await sse(bob, { message: 'proyecto Orquídea presupuesto' })).body;
        expect(a).toMatch(/Orquídea/);
        expect(b).not.toMatch(/Orquídea|90000/);
    });
});

describe('ai-gateway stream', () => {
    test('el modo extractivo respeta la cancelación', async () => {
        const controller = new AbortController();
        let n = 0;
        for await (const ev of gateway.stream({ contextText: '<untrusted_document ref="1">uno dos tres cuatro cinco seis</untrusted_document>', signal: controller.signal })) {
            if (ev.type === 'delta' && ++n === 2) controller.abort();
        }
        expect(n).toBeLessThan(10);
    });

    test('sin contexto responde que no hay información', async () => {
        const out = [];
        for await (const ev of gateway.stream({ contextText: '' })) if (ev.type === 'delta') out.push(ev.text);
        expect(out.join('')).toMatch(/No encuentro información/);
    });
});

describe('ConversationStore', () => {
    test('aísla por usuario, limita por usuario y caduca', () => {
        let t = 1_000_000;
        const store = new ConversationStore({ filePath: null, now: () => t });
        const c = store.getOrCreate('u1', 'conv-aaaaaaaa');
        store.append(c, 'hola', 'qué tal');
        expect(store.get('u2', 'conv-aaaaaaaa')).toBeNull();
        expect(store.list('u1')).toHaveLength(1);

        for (let i = 0; i < 60; i++) store.append(store.getOrCreate('u1', `conv-${String(i).padStart(8, '0')}`), `m${i}`, 'r');
        expect(store.list('u1').length).toBeLessThanOrEqual(50);

        t += 8 * 24 * 60 * 60 * 1000; // 8 días
        expect(store.list('u1')).toHaveLength(0);
    });

    test('persiste y recupera desde disco', () => {
        const fs = require('fs'); const os = require('os'); const path = require('path');
        const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'conv-')), 'c.json');
        const a = new ConversationStore({ filePath: file });
        a.append(a.getOrCreate('u1', 'conv-persist1'), 'pregunta', 'respuesta');
        const b = new ConversationStore({ filePath: file });
        expect(b.get('u1', 'conv-persist1').turns).toHaveLength(2);
    });
});
