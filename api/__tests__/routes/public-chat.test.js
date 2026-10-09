const request = require('supertest');
const app = require('../../index');

const preguntar = (message, origin = 'https://bezhas-hub-o5xep6gbwq-ew.a.run.app') =>
    request(app).post('/api/public-chat').set('Origin', origin).send({ message });

describe('POST /api/public-chat', () => {
    it('responde con la base pública y cita la fuente', async () => {
        const res = await preguntar('¿Cuánto cuesta el plan Business?');
        expect(res.status).toBe(200);
        expect(res.body.answered).toBe(true);
        expect(res.body.reply).toMatch(/499/);
        expect(res.body.sources[0].enlace).toMatch(/^https:\/\/bezhas\.com/);
    });

    it('sabe en qué red está BEZ y no afirma BNB Chain', async () => {
        const res = await preguntar('¿En qué blockchain está el token BEZ?');
        expect(res.body.reply).toMatch(/Polygon/);
        expect(res.body.reply).toMatch(/No está desplegado en BNB/);
    });

    it('lo que no sabe lo dice, sin inventar', async () => {
        const res = await preguntar('¿Cuál es la capital de Mongolia?');
        expect(res.body.answered).toBe(false);
        expect(res.body.reply).toMatch(/No tengo ese dato/);
    });

    it('no filtra material interno de docs/ (márgenes, financiación)', async () => {
        const res = await preguntar('margen interno de OPERANT por tarea y plan de financiación');
        expect(JSON.stringify(res.body)).not.toMatch(/1,25|0,1969|OPERANT/i);
    });

    it('permite CORS desde una SubApp en run.app y atiende el preflight', async () => {
        const pre = await request(app).options('/api/public-chat')
            .set('Origin', 'https://bezhas-energy-o5xep6gbwq-ew.a.run.app')
            .set('Access-Control-Request-Method', 'POST');
        expect(pre.headers['access-control-allow-origin']).toBe('*');
        const res = await preguntar('hola');
        expect(res.headers['access-control-allow-origin']).toBe('*');
        expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it.each([[''], ['a'], ['x'.repeat(301)], [null], [{ a: 1 }]])('rechaza mensaje inválido %#', async (m) => {
        const res = await preguntar(m);
        expect(res.status).toBe(400);
    });

    it('rechaza cuerpos grandes', async () => {
        const res = await request(app).post('/api/public-chat').send({ message: 'x'.repeat(10000) });
        expect(res.status).toBe(413);
    });
});

describe('GET /api/ai-workspace/public/apps', () => {
    it('lista las apps nativas sin sesión, con destino https y disponibilidad', async () => {
        const res = await request(app).get('/api/ai-workspace/public/apps');
        expect(res.status).toBe(200);
        expect(res.body.apps.map((a) => a.id).sort()).toEqual(['app_cargolink', 'app_defi', 'app_energy', 'app_hub', 'app_purescan']);
        for (const a of res.body.apps) { expect(a.href).toMatch(/^https:\/\//); expect(typeof a.unavailable).toBe('boolean'); }
    });
});
