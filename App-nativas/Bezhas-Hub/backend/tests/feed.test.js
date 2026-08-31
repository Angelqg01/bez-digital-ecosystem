const request = require('supertest');
const { app } = require('../server');

describe('Feed API', () => {
    it('GET /api/feed should return an array', async () => {
        const res = await request(app).get('/api/feed');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/feed should create a post', async () => {
        const payload = { author: '0xabc', content: 'Hello from test' };
        const res = await request(app).post('/api/feed').send(payload);
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('content', payload.content);
    });

    it('POST /api/feed/:id/like and /comment should update a post', async () => {
        const create = await request(app).post('/api/feed').send({ author: '0xdef', content: 'Like me' });
        const id = create.body._id || create.body.id;
        const like = await request(app).post(`/api/feed/${id}/like`).send({ author: '0xdef' });
        expect(like.status).toBe(200);
        const comment = await request(app).post(`/api/feed/${id}/comment`).send({ author: '0xdef', content: 'Nice!' });
        expect(comment.status).toBe(200);
    });
});
