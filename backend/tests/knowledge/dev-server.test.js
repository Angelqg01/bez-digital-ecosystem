/**
 * Servidor de desarrollo local (scripts/dev-ai-workspace.js): usa las rutas REALES con `protect`,
 * pero con usuarios en memoria. Garantiza que no se reutilizan ids entre ejecuciones y que nada
 * se persiste (si no, el usuario "dev-1" de hoy heredaba las conversaciones del "dev-1" de ayer).
 */
// tests/setup.js fija REDIS_URL globalmente; estos tests ejercitan los nonces en memoria (el almacén Redis se prueba en wallet-nonce-store.test.js).
delete process.env.REDIS_URL;
delete process.env.REDIS_HOST;
delete process.env.REDIS_PORT;

const request = require('supertest');

process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.AI_PROVIDER;

const { app, MemoryUser } = require('../../scripts/dev-ai-workspace');

const register = async (email) => (await request(app).post('/api/auth/register-email').send({ email, password: 'secreto1' }).expect(201)).body;

describe('dev-ai-workspace', () => {
    test('ids únicos (uuid) y sin persistencia en disco', async () => {
        const a = await MemoryUser.create({ email: 'x1@t.dev' });
        const b = await MemoryUser.create({ email: 'x2@t.dev' });
        expect(a.id).toMatch(/^dev-[0-9a-f-]{36}$/);
        expect(a.id).not.toBe(b.id);
        expect(process.env.AI_CONVERSATIONS_PERSIST).toBe('false');
        expect(process.env.KNOWLEDGE_PERSIST).toBe('false');
    });

    test('registro y login por email validan entradas y no filtran si existe la cuenta', async () => {
        await request(app).post('/api/auth/register-email').send({ email: 'no-es-email', password: 'secreto1' }).expect(400);
        await request(app).post('/api/auth/register-email').send({ email: 'a@t.dev', password: '123' }).expect(400);
        await register('dup@t.dev');
        await request(app).post('/api/auth/register-email').send({ email: 'dup@t.dev', password: 'secreto1' }).expect(409);

        const bad = await request(app).post('/api/auth/login-email').send({ email: 'dup@t.dev', password: 'mala' }).expect(401);
        const ghost = await request(app).post('/api/auth/login-email').send({ email: 'nadie@t.dev', password: 'mala' }).expect(401);
        expect(bad.body).toEqual(ghost.body);
        const ok = await request(app).post('/api/auth/login-email').send({ email: 'dup@t.dev', password: 'secreto1' }).expect(200);
        expect(ok.body.token).toBeTruthy();
    });

    test('el chat real exige el token y cada usuario ve solo lo suyo', async () => {
        await request(app).post('/api/ai-workspace/chat').send({ message: 'hola' }).expect(401);
        await request(app).post('/api/ai-workspace/chat').set('Authorization', 'Bearer basura').send({ message: 'hola' }).expect(401);

        const ana = await register('ana2@t.dev');
        const bob = await register('bob2@t.dev');
        const chat = await request(app).post('/api/ai-workspace/chat').set('Authorization', `Bearer ${ana.token}`).send({ message: '¿Cómo hago staking de BEZ?' }).expect(200);
        expect(chat.body.sources[0].title).toMatch(/staking/i);

        const mine = await request(app).get('/api/ai-workspace/conversations').set('Authorization', `Bearer ${ana.token}`).expect(200);
        const theirs = await request(app).get('/api/ai-workspace/conversations').set('Authorization', `Bearer ${bob.token}`).expect(200);
        expect(mine.body.conversations).toHaveLength(1);
        expect(theirs.body.conversations).toHaveLength(0);
    });

    test('el login con wallet (SIWE) está montado', async () => {
        const { Wallet } = require('ethers');
        const res = await request(app).post('/api/wallet-auth/nonce').send({ address: Wallet.createRandom().address }).expect(200);
        expect(res.body.nonce).toBeTruthy();
    });

    test('CORS solo para el frontend local', async () => {
        const ok = await request(app).options('/api/ai-workspace/chat').set('Origin', 'http://localhost:3000').expect(204);
        expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
        // El frontend usa axios con withCredentials: sin esta cabecera el navegador bloquea la respuesta.
        expect(ok.headers['access-control-allow-credentials']).toBe('true');
        const bad = await request(app).options('/api/ai-workspace/chat').set('Origin', 'https://evil.example').expect(204);
        expect(bad.headers['access-control-allow-origin']).toBeUndefined();
        expect(bad.headers['access-control-allow-credentials']).toBeUndefined();
    });

    test('plan de desarrollo: los documentos exclusivos solo los ven los planes de pago', async () => {
        await new Promise((r) => setTimeout(r, 400)); // deja terminar el seed de documentos exclusivos
        const docsFor = async (email, plan) => {
            const { token } = (await request(app).post('/api/auth/register-email').send({ email, password: 'secreto1', plan }).expect(201)).body;
            const res = await request(app).get('/api/ai-workspace/knowledge').set('Authorization', `Bearer ${token}`).expect(200);
            return res.body.documents.map((d) => d.title);
        };
        expect((await docsFor('pago@t.dev', 'creator')).filter((t) => /exclusiv/i.test(t))).toHaveLength(2);
        expect((await docsFor('gratis@t.dev')).filter((t) => /exclusiv/i.test(t))).toHaveLength(0);
        // un plan inventado no concede nada
        expect((await docsFor('falso@t.dev', 'platino')).filter((t) => /exclusiv/i.test(t))).toHaveLength(0);
    });
});
