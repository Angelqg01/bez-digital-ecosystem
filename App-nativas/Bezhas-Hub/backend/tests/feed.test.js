const request = require('supertest');
const { app } = require('../server');

describe('Feed API', () => {
    it('GET /api/feed should return an array', async () => {
        const res = await request(app).get('/api/feed');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    // Publicar, dar «me gusta» y comentar exigen sesión y el autor sale del token (antes venía en el cuerpo y se podía suplantar).
    // Los flujos con sesión se prueban contra Postgres real en tests/integration/posts-shares-pg.test.js.
    it('POST /api/feed without a session is rejected, even with an author in the body', async () => {
        const res = await request(app).post('/api/feed').send({ author: '0xabc', content: 'Hello from test' });
        expect(res.status).toBe(401);
    });

    it('like and comment without a session are rejected', async () => {
        const id = '00000000-0000-4000-8000-000000000000';
        expect((await request(app).post(`/api/feed/${id}/like`).send({ author: '0xdef' })).status).toBe(401);
        expect((await request(app).post(`/api/feed/${id}/comment`).send({ author: '0xdef', content: 'Nice!' })).status).toBe(401);
    });
});
